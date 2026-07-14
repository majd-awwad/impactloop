import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'ai_chat_controller.dart';

enum AiHistoryTab { active, archived }

class AiAssistantShellState {
  const AiAssistantShellState({
    this.isOpen = false,
    this.isExpanded = false,
    this.showHistory = false,
    this.historyTab = AiHistoryTab.active,
  });

  final bool isOpen;
  final bool isExpanded;
  final bool showHistory;
  final AiHistoryTab historyTab;

  AiAssistantShellState copyWith({
    bool? isOpen,
    bool? isExpanded,
    bool? showHistory,
    AiHistoryTab? historyTab,
  }) {
    return AiAssistantShellState(
      isOpen: isOpen ?? this.isOpen,
      isExpanded: isExpanded ?? this.isExpanded,
      showHistory: showHistory ?? this.showHistory,
      historyTab: historyTab ?? this.historyTab,
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

  void open({String? conversationId}) {
    state = state.copyWith(
      isOpen: true,
      showHistory: false,
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
}
