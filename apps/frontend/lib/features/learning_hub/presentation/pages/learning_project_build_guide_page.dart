import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../ai/application/ai_assistant_shell_provider.dart';
import '../../../ai/presentation/widgets/ai_assistant_shell.dart';
import '../../application/learning_hub_providers.dart';
import '../../domain/models/project_build.dart';

class LearningProjectBuildGuidePage extends ConsumerStatefulWidget {
  const LearningProjectBuildGuidePage({
    super.key,
    required this.projectId,
    required this.conversationId,
    this.buildContext,
  });

  final String projectId;
  final String conversationId;
  final BuildGuideContext? buildContext;

  @override
  ConsumerState<LearningProjectBuildGuidePage> createState() =>
      _LearningProjectBuildGuidePageState();
}

class _LearningProjectBuildGuidePageState
    extends ConsumerState<LearningProjectBuildGuidePage> {
  AiAssistantShellNotifier? _shellNotifier;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }

      _shellNotifier = ref.read(aiAssistantShellProvider.notifier);
      _initializeGuide();
    });
  }

  Future<void> _initializeGuide() async {
    BuildGuideContext? guideContext = widget.buildContext;
    if (guideContext == null) {
      final build = await ref.read(projectBuildProvider(widget.projectId).future);
      if (!mounted || build == null) {
        return;
      }

      guideContext = BuildGuideContext.fromProjectBuild(build);
    }

    _shellNotifier!.open(
      conversationId: widget.conversationId,
      buildGuideContext: guideContext,
    );
  }

  void _leaveGuide() {
    _shellNotifier?.close();
    if (context.canPop()) {
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.buildContext?.projectTitle ?? 'Build guide';

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) {
          _leaveGuide();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(title),
          leading: BackButton(
            onPressed: _leaveGuide,
          ),
        ),
        body: const SafeArea(
          child: AiEmbeddedAssistantChat(),
        ),
      ),
    );
  }
}
