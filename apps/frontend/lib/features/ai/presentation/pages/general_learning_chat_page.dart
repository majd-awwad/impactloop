import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/ai_assistant_shell_provider.dart';

class AiAssistantRoutePage extends ConsumerStatefulWidget {
  const AiAssistantRoutePage({
    super.key,
    this.conversationId,
  });

  final String? conversationId;

  @override
  ConsumerState<AiAssistantRoutePage> createState() =>
      _AiAssistantRoutePageState();
}

class _AiAssistantRoutePageState extends ConsumerState<AiAssistantRoutePage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(aiAssistantShellProvider.notifier).open(
            conversationId: widget.conversationId,
          );
      if (mounted && context.canPop()) {
        context.pop();
      } else if (mounted) {
        context.go('/home');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}

class GeneralLearningChatPage extends AiAssistantRoutePage {
  const GeneralLearningChatPage({
    super.key,
    String? initialConversationId,
  }) : super(conversationId: initialConversationId);
}
