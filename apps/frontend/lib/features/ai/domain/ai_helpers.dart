import 'dart:math';

import 'package:flutter/widgets.dart';

import '../../../core/errors/api_exception.dart';
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
      return fallback;
    case 'AI_RESPONSE_INVALID':
      return 'The assistant returned an invalid response. The latest authoring state was refreshed; try generating the stage again.';
    case 'AI_PROVIDER_AUTH_ERROR':
      return fallback;
    case 'AI_AUTHORING_PROPOSAL_STALE':
      return 'The draft changed after this component suggestion.';
    case 'AI_AUTHORING_SESSION_STALE':
      return 'This authoring session changed on the server. Reloading the latest state.';
    case 'AI_AUTHORING_TURN_SUPERSEDED':
      return 'This suggestion was replaced. Reloading the latest state.';
    case 'AI_AUTHORING_CONTEXT_MISMATCH':
    case 'AI_AUTHORING_PROJECT_CONTEXT_MISMATCH':
      return 'This authoring session does not belong to this project. Reload the workspace.';
    case 'AI_AUTHORING_ACTION_NOT_ALLOWED':
      return 'That action is not available right now. Reload and try again.';
    case 'AI_AUTHORING_TURN_NOT_ACTIVE':
      return 'This suggestion is no longer active. Refresh and try again.';
    case 'AI_PROVIDER_RESPONSE_INVALID':
      return 'The assistant could not create a valid revised suggestion. Retry.';
    case 'INVALID_ESTIMATED_DURATION':
      return 'Estimated duration must be a positive number of minutes.';
    case 'AI_AUTHORING_CONTEXT_INCONSISTENT':
      return 'The accepted project fields contradict each other. Correct the conflicting stage, then retry.';
    case 'AI_AUTHORING_SCALAR_CONTEXT_INCONSISTENT':
      return 'That suggestion changed the project concept. Correct it, then retry.';
    case 'AI_COMPONENT_PROPOSAL_INVALID':
      return 'The assistant could not create a valid component list. Retry.';
    case 'AI_COMPONENT_INTENT_UNCLEAR':
      return 'Do you want a complete component list or help changing an existing list?';
    case 'AI_COMPONENT_PROPOSAL_IDENTICAL':
      return 'The assistant returned the same component list. Retry another suggestion.';
    case 'AI_AUTHORING_NO_ALTERNATIVE':
      return 'The assistant could not produce a different suggestion. Describe the change you want.';
    case 'AI_COMPONENT_SAVE_FAILED':
      return 'Could not save the component list. Your proposed list was preserved.';
    case 'AI_COMPONENT_CLIENT_SYNC_FAILED':
      return 'Components were saved on the server. Reload the draft.';
    case 'AI_STEP_GENERATION_FAILED_AFTER_COMPONENT_SAVE':
      return 'Components were saved, but the step plan could not be generated.';
    case 'AI_AUTHORING_STEP_GENERATION_FAILED':
      return 'The step plan could not be generated. Retry generation.';
    case 'AI_STEP_GENERATION_FAILED':
      return 'Components were saved, but the step plan could not be generated.';
    case 'AI_STEP_PROPOSAL_INVALID':
      return 'The assistant could not create a valid step plan. Retry.';
    case 'AI_STEP_PLAN_IDENTICAL':
      return 'The assistant returned the same step plan. Retry another plan.';
    case 'AI_STEP_COMPONENT_INCONSISTENT':
      return 'The step plan references components that are not in the saved component list.';
    case 'AI_STEP_SAVE_FAILED':
      return 'Could not save the steps. Your reviewed plan was preserved.';
    case 'CANONICAL_CLIENT_SYNC_FAILED':
      return 'Saved on the server. Reload the draft.';
    case 'NETWORK_ERROR':
      return 'Could not reach the server. Your input was preserved.';
    case 'VALIDATION_ERROR':
      return fallback;
    case 'AI_CONVERSATION_NOT_FOUND':
      return fallback;
    default:
      return fallback;
  }
}

bool isAuthoringStructuredHistoryBlock(String type) {
  return type == 'project_authoring_session' ||
      type == 'project_authoring_turn' ||
      type == 'project_authoring_review_state' ||
      type == 'project_authoring_proposal_diff';
}

String normalizeAuthoringComponentName(String value) =>
    value.trim().toLowerCase();

bool authoringComponentsSynchronized(
  List<AiAuthoringProposalComponent> canonical,
  List<AiAuthoringProposalComponent> visible,
) {
  if (canonical.length != visible.length) {
    return false;
  }
  for (var index = 0; index < canonical.length; index += 1) {
    final left = canonical[index];
    final right = visible[index];
    if (left.id != null &&
        right.id != null &&
        left.id!.trim().isNotEmpty &&
        right.id!.trim().isNotEmpty &&
        left.id != right.id) {
      return false;
    }
    if (normalizeAuthoringComponentName(left.componentName) !=
            normalizeAuthoringComponentName(right.componentName) ||
        left.quantity != right.quantity ||
        left.unit.trim().toLowerCase() != right.unit.trim().toLowerCase() ||
        left.componentRole != right.componentRole ||
        left.isRequired != right.isRequired) {
      return false;
    }
  }
  return true;
}

bool authoringStepsSynchronized(
  List<AiAuthoringProposalStep> canonical,
  List<AiAuthoringProposalStep> visible,
) {
  if (canonical.length != visible.length) {
    return false;
  }
  for (var index = 0; index < canonical.length; index += 1) {
    final left = canonical[index];
    final right = visible[index];
    if (left.title.trim() != right.title.trim() ||
        left.description.trim() != right.description.trim()) {
      return false;
    }
  }
  return true;
}

bool authoringDraftSnapshotsSynchronized(
  AuthoringDraftSnapshot canonical,
  AuthoringDraftSnapshot visible, {
  bool checkSteps = false,
}) {
  if (canonical.title != visible.title ||
      canonical.shortDescription != visible.shortDescription ||
      canonical.description != visible.description ||
      canonical.difficulty != visible.difficulty ||
      canonical.estimatedMinutes != visible.estimatedMinutes) {
    return false;
  }
  if (!authoringComponentsSynchronized(canonical.components, visible.components)) {
    return false;
  }
  if (checkSteps &&
      !authoringStepsSynchronized(canonical.steps, visible.steps)) {
    return false;
  }
  return true;
}

bool isGenericStepPlaceholderText(String text) {
  final normalized = text.trim().toLowerCase();
  return normalized.contains('ordered step outline') ||
      normalized.contains('خطة خطوات مرتبة') ||
      (normalized.contains('review the complete plan') &&
          !normalized.contains(':'));
}

bool isAuthoringSaveAckText(String? text) {
  if (text == null) {
    return false;
  }
  final normalized = text.trim().toLowerCase();
  return normalized == 'your value was saved.' ||
      normalized == 'تم حفظ قيمتك.' ||
      normalized.startsWith('title saved.') ||
      normalized.startsWith('duration saved.') ||
      normalized.startsWith('تم حفظ العنوان.') ||
      normalized.startsWith('تم حفظ المدة.');
}

bool isRetryableAiError(String? code) {
  return code == 'AI_PROVIDER_TIMEOUT' ||
      code == 'AI_PROVIDER_RATE_LIMITED' ||
      code == 'AI_PROVIDER_ERROR' ||
      code == 'AI_RESPONSE_INVALID' ||
      code == 'TIMEOUT' ||
      code == 'NETWORK_ERROR';
}

bool isRetryableAuthoringError(String? code) {
  return isRetryableAiError(code) ||
      code == 'AI_PROVIDER_RESPONSE_INVALID' ||
      code == 'AI_AUTHORING_TURN_NOT_ACTIVE';
}

bool hasStaleComponentProposalRecovery(String? code, String? stage) {
  return code == 'AI_AUTHORING_PROPOSAL_STALE' && stage == 'COMPONENTS';
}

bool hasStepPlanGenerationRecovery(String? code) {
  return code == 'AI_STEP_GENERATION_FAILED_AFTER_COMPONENT_SAVE';
}

bool hasStepComponentInconsistencyRecovery(String? code) {
  return code == 'AI_STEP_COMPONENT_INCONSISTENT';
}

String staleComponentProposalRecoveryLabel() {
  return 'Generate a new component suggestion';
}

String authoringErrorMessageForDisplay(
  ApiException error, {
  String? stage,
}) {
  if (hasStaleComponentProposalRecovery(error.code, stage)) {
    return 'The draft changed after this component suggestion.';
  }
  return aiErrorMessageForCode(error.code, error.message);
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
