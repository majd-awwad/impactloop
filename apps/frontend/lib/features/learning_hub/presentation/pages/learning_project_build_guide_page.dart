import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../app/router/navigation_extensions.dart';
import '../../../../shared/widgets/app_back_action.dart';
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
    final build = await ref.read(
      projectBuildProvider(widget.projectId).future,
    );
    if (!mounted) {
      return;
    }
    if (build != null) {
      guideContext = BuildGuideContext.fromProjectBuild(build);
    }
    if (guideContext == null) {
      return;
    }

    _shellNotifier!.open(
      conversationId: widget.conversationId,
      buildGuideContext: guideContext,
    );
  }

  Future<void> _leaveGuide() async {
    _shellNotifier?.close();
    await context.popOrGo('/learning/${widget.projectId}/build');
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.buildContext?.projectTitle ?? 'Build guide';

    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) {
          _shellNotifier?.close();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(title),
          leading: AppBackAction.compact(onBack: _leaveGuide),
        ),
        body: const SafeArea(child: AiEmbeddedAssistantChat()),
      ),
    );
  }
}
