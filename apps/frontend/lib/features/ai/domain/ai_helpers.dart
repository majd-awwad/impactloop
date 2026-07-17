import 'dart:math';

import 'package:flutter/widgets.dart';

import 'ai_models.dart';

const aiMaxMessageLength = 4000;

String resolveAiLocale(BuildContext context) {
  final languageCode = Localizations.localeOf(context).languageCode;
  return languageCode == 'ar' ? 'ar' : 'en';
}

String createClientMessageId() {
  final random = Random();
  // Avoid `1 << 32` — on Flutter web it evaluates to 0 and crashes nextInt.
  final suffix = List<String>.generate(
    8,
    (_) => random.nextInt(16).toRadixString(16),
  ).join();
  return 'cmsg-${DateTime.now().microsecondsSinceEpoch}-$suffix';
}

String aiErrorMessageForCode(String? code, String fallback) {
  switch (code) {
    case 'AI_DISABLED':
      return fallback;
    case 'AI_RATE_LIMITED':
      return fallback;
    case 'AI_CONVERSATION_BUSY':
      return fallback;
    case 'AI_PROVIDER_TIMEOUT':
    case 'AI_PROVIDER_ERROR':
    case 'AI_PROVIDER_QUOTA_EXCEEDED':
    case 'AI_PROVIDER_MODEL_UNAVAILABLE':
    case 'AI_RESPONSE_INVALID':
      return fallback;
    case 'AI_PROVIDER_AUTH_ERROR':
      return fallback;
    case 'AI_CONVERSATION_NOT_FOUND':
      return fallback;
    default:
      return fallback;
  }
}

bool isRetryableAiError(String? code) {
  return code == 'AI_PROVIDER_TIMEOUT' ||
      code == 'AI_PROVIDER_ERROR' ||
      code == 'AI_PROVIDER_QUOTA_EXCEEDED' ||
      code == 'AI_RESPONSE_INVALID' ||
      code == 'TIMEOUT' ||
      code == 'NETWORK_ERROR';
}

List<AiMessageItem> mergeTurnIntoMessages({
  required List<AiMessageItem> existing,
  required AiTurnResponse turn,
  required String userText,
  required String optimisticId,
}) {
  final preserved = existing
      .where(
        (message) =>
            message.id != optimisticId &&
            message.id != turn.userMessageId &&
            message.id != turn.assistantMessageId,
      )
      .toList(growable: false);

  final now = DateTime.now().toUtc();
  final userMessage = AiMessageItem(
    id: turn.userMessageId,
    role: 'USER',
    status: 'COMPLETED',
    contentText: userText,
    contentBlocks: const [],
    createdAt: now,
  );

  final assistantId = turn.assistantMessageId;
  if (assistantId == null || turn.contentBlocks.isEmpty) {
    return [...preserved, userMessage];
  }

  final assistantMessage = AiMessageItem(
    id: assistantId,
    role: 'ASSISTANT',
    status: 'COMPLETED',
    contentText: null,
    contentBlocks: turn.contentBlocks,
    createdAt: now.add(const Duration(milliseconds: 1)),
  );

  return [...preserved, userMessage, assistantMessage];
}

AiContentBlock? findActionResultForConfirmation(
  List<AiContentBlock> blocks,
  int confirmationIndex,
) {
  for (var index = confirmationIndex + 1; index < blocks.length; index += 1) {
    final block = blocks[index];
    if (block.type == 'action_result') {
      return block;
    }
    if (block.type == 'action_confirmation') {
      break;
    }
  }
  return null;
}

bool isActionConfirmationExpired(AiContentBlock block) {
  final expiresAt = block.expiresAt;
  if (expiresAt == null) {
    return false;
  }
  return DateTime.now().toUtc().isAfter(expiresAt.toUtc());
}

class AiActionConfirmationUiState {
  const AiActionConfirmationUiState({
    required this.isBusy,
    required this.isDisabled,
    this.errorMessage,
    this.resolvedStatus,
  });

  final bool isBusy;
  final bool isDisabled;
  final String? errorMessage;
  final String? resolvedStatus;
}

AiActionConfirmationUiState resolveActionConfirmationUiState({
  required AiContentBlock block,
  required List<AiContentBlock> messageBlocks,
  required int blockIndex,
  required String? pendingActionBusyId,
  required String? actionErrorMessage,
}) {
  final result = findActionResultForConfirmation(messageBlocks, blockIndex);
  final resolvedStatus = result?.actionStatus;
  final isExpired =
      resolvedStatus == null && isActionConfirmationExpired(block);
  final isBusy = pendingActionBusyId == block.pendingActionId;
  final isResolved = resolvedStatus == 'EXECUTED' ||
      resolvedStatus == 'CANCELLED' ||
      resolvedStatus == 'FAILED';
  final isDisabled = isBusy || isResolved || isExpired;

  return AiActionConfirmationUiState(
    isBusy: isBusy,
    isDisabled: isDisabled,
    errorMessage: isResolved || isBusy ? null : actionErrorMessage,
    resolvedStatus: resolvedStatus ?? (isExpired ? 'EXPIRED' : null),
  );
}

bool isOptimisticAiMessageId(String messageId) {
  return messageId.startsWith('optimistic-');
}

bool messageHasPendingActionConfirmation(AiMessageItem message) {
  for (var index = 0; index < message.contentBlocks.length; index += 1) {
    final block = message.contentBlocks[index];
    if (block.type != 'action_confirmation' || block.pendingActionId == null) {
      continue;
    }
    if (isActionConfirmationExpired(block)) {
      continue;
    }
    if (findActionResultForConfirmation(message.contentBlocks, index) != null) {
      continue;
    }
    return true;
  }
  return false;
}

List<AiContentBlock> reconcileMessageContentBlocks({
  required List<AiContentBlock> localBlocks,
  required List<AiContentBlock> incomingBlocks,
}) {
  if (incomingBlocks.isEmpty) {
    return localBlocks;
  }

  final incomingHasActionResult =
      incomingBlocks.any((block) => block.type == 'action_result');
  if (incomingHasActionResult) {
    return incomingBlocks;
  }

  final merged = List<AiContentBlock>.from(incomingBlocks);
  final incomingPendingIds = merged
      .where((block) => block.type == 'action_confirmation')
      .map((block) => block.pendingActionId)
      .whereType<String>()
      .toSet();

  for (var index = 0; index < localBlocks.length; index += 1) {
    final localBlock = localBlocks[index];
    if (localBlock.type == 'action_result') {
      final hasSameResult = merged.any(
        (block) =>
            block.type == 'action_result' &&
            block.actionType == localBlock.actionType &&
            block.actionStatus == localBlock.actionStatus,
      );
      if (!hasSameResult) {
        merged.add(localBlock);
      }
      continue;
    }

    if (localBlock.type != 'action_confirmation') {
      continue;
    }

    final pendingId = localBlock.pendingActionId;
    if (pendingId == null || incomingPendingIds.contains(pendingId)) {
      continue;
    }

    final existingResult =
        findActionResultForConfirmation(localBlocks, index);
    if (existingResult != null) {
      continue;
    }

    if (isActionConfirmationExpired(localBlock)) {
      continue;
    }

    merged.add(localBlock);
  }

  return merged;
}

AiMessageItem reconcileMessageItem({
  required AiMessageItem local,
  required AiMessageItem incoming,
}) {
  return AiMessageItem(
    id: incoming.id,
    role: incoming.role,
    status: incoming.status,
    contentText: incoming.contentText ?? local.contentText,
    contentBlocks: reconcileMessageContentBlocks(
      localBlocks: local.contentBlocks,
      incomingBlocks: incoming.contentBlocks,
    ),
    createdAt: incoming.createdAt,
  );
}

List<AiMessageItem> reconcileConversationMessages({
  required List<AiMessageItem> current,
  required List<AiMessageItem> incoming,
}) {
  if (incoming.isEmpty) {
    return current;
  }

  final currentById = <String, AiMessageItem>{
    for (final message in current) message.id: message,
  };
  final incomingIds = <String>{};

  final reconciled = <AiMessageItem>[
    for (final incomingMessage in incoming)
      ...() {
        incomingIds.add(incomingMessage.id);
        final local = currentById[incomingMessage.id];
        if (local == null) {
          return [incomingMessage];
        }
        return [reconcileMessageItem(local: local, incoming: incomingMessage)];
      }(),
  ];

  final latestIncomingAt = incoming
      .map((message) => message.createdAt)
      .fold<DateTime?>(
        null,
        (latest, createdAt) =>
            latest == null || createdAt.isAfter(latest) ? createdAt : latest,
      );

  final localOnly = current
      .where((message) => !incomingIds.contains(message.id))
      .where((message) => !isOptimisticAiMessageId(message.id))
      .where((message) {
        if (messageHasPendingActionConfirmation(message)) {
          return true;
        }
        if (latestIncomingAt == null) {
          return false;
        }
        return message.createdAt.isAfter(latestIncomingAt);
      })
      .toList(growable: false);

  if (localOnly.isEmpty) {
    return reconciled;
  }

  return [...reconciled, ...localOnly]
    ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
}

List<AiMessageItem> appendActionResultToMessages({
  required List<AiMessageItem> messages,
  required String pendingActionId,
  required AiContentBlock resultBlock,
}) {
  return messages
      .map((message) {
        final confirmIndex = message.contentBlocks.indexWhere(
          (block) => block.pendingActionId == pendingActionId,
        );
        if (confirmIndex < 0) {
          return message;
        }

        final existingResult = findActionResultForConfirmation(
          message.contentBlocks,
          confirmIndex,
        );
        if (existingResult != null) {
          return message;
        }

        return AiMessageItem(
          id: message.id,
          role: message.role,
          status: message.status,
          contentText: message.contentText,
          contentBlocks: [...message.contentBlocks, resultBlock],
          createdAt: message.createdAt,
        );
      })
      .toList(growable: false);
}
