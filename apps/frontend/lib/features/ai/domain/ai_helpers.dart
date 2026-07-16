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
