import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../learning_hub/application/learning_hub_providers.dart';
import '../../learning_hub/domain/models/project_build.dart';
import 'ai_chat_controller.dart';

enum AiHistoryTab { active, archived }

class AiAssistantShellState {
  const AiAssistantShellState({
    this.isOpen = false,
    this.isExpanded = false,
    this.showHistory = false,
    this.historyTab = AiHistoryTab.active,
    this.buildGuideContext,
  });

  final bool isOpen;
  final bool isExpanded;
  final bool showHistory;
  final AiHistoryTab historyTab;
  final BuildGuideContext? buildGuideContext;

  AiAssistantShellState copyWith({
    bool? isOpen,
    bool? isExpanded,
    bool? showHistory,
    AiHistoryTab? historyTab,
    BuildGuideContext? buildGuideContext,
    bool clearBuildGuideContext = false,
  }) {
    return AiAssistantShellState(
      isOpen: isOpen ?? this.isOpen,
      isExpanded: isExpanded ?? this.isExpanded,
      showHistory: showHistory ?? this.showHistory,
      historyTab: historyTab ?? this.historyTab,
      buildGuideContext: clearBuildGuideContext
          ? null
          : buildGuideContext ?? this.buildGuideContext,
    );
  }
}

final aiAssistantShellProvider =
    NotifierProvider<AiAssistantShellNotifier, AiAssistantShellState>(
  AiAssistantShellNotifier.new,
);

class AiAssistantShellNotifier extends Notifier<AiAssistantShellState> {
  @override
  AiAssistantShellState build() => const AiAssistantShellState();

  void open({
    String? conversationId,
    BuildGuideContext? buildGuideContext,
    bool? clearBuildGuideContext,
  }) {
    final shouldClearBuildGuideContext =
        clearBuildGuideContext ??
        (conversationId == null && buildGuideContext == null);

    state = state.copyWith(
      isOpen: true,
      showHistory: false,
      buildGuideContext: shouldClearBuildGuideContext
          ? null
          : (buildGuideContext ?? state.buildGuideContext),
      clearBuildGuideContext: shouldClearBuildGuideContext,
    );

    if (conversationId != null && conversationId.isNotEmpty) {
      ref
          .read(aiAssistantControllerProvider.notifier)
          .openConversation(conversationId);
    }
  }

  void close() {
    state = const AiAssistantShellState();
  }

  void toggleHistory({AiHistoryTab? tab}) {
    state = state.copyWith(
      showHistory: !state.showHistory,
      historyTab: tab ?? state.historyTab,
    );
  }

  void setHistoryTab(AiHistoryTab tab) {
    state = state.copyWith(historyTab: tab, showHistory: true);
  }

  void toggleExpanded() {
    state = state.copyWith(isExpanded: !state.isExpanded);
  }

  void clearBuildGuideContext() {
    state = state.copyWith(clearBuildGuideContext: true);
  }

  Future<void> refreshBuildGuideContext() async {
    final current = state.buildGuideContext;
    if (current == null) {
      return;
    }

    final build = await ref
        .read(learningHubRepositoryProvider)
        .fetchMyBuild(current.projectId);
    if (build == null) {
      return;
    }

    state = state.copyWith(
      buildGuideContext: BuildGuideContext(
        buildId: build.id,
        projectId: build.projectId,
        projectTitle: build.project.title,
        buildStatus: build.status,
        materialReadiness: build.materialReadiness,
        currentStep: build.stepProgress.currentStep,
        stepProgress: ProjectBuildStepProgressSummary(
          completed: build.stepProgress.completed,
          total: build.stepProgress.total,
          percent: build.stepProgress.percent,
        ),
      ),
    );
  }
}
