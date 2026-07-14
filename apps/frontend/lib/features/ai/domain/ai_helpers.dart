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
