import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/ai_assistant_shell_provider.dart';
import '../../application/ai_chat_controller.dart';
import '../../domain/ai_models.dart';
import '../l10n/ai_l10n.dart';

class AiHistoryPanel extends ConsumerWidget {
  const AiHistoryPanel({
    super.key,
    required this.tab,
    required this.selectedConversationId,
    required this.onTabChanged,
    required this.onConversationSelected,
    required this.onRestoreConversation,
  });

  final AiHistoryTab tab;
  final String? selectedConversationId;
  final ValueChanged<AiHistoryTab> onTabChanged;
  final ValueChanged<String> onConversationSelected;
  final ValueChanged<String> onRestoreConversation;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final conversationsAsync = tab == AiHistoryTab.active
        ? ref.watch(aiActiveConversationsProvider)
        : ref.watch(aiArchivedConversationsProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.sm,
          ),
          child: SegmentedButton<AiHistoryTab>(
            segments: [
              ButtonSegment(
                value: AiHistoryTab.active,
                label: Text(AiL10n.activeConversations.resolve(context)),
              ),
              ButtonSegment(
                value: AiHistoryTab.archived,
                label: Text(AiL10n.archivedConversations.resolve(context)),
              ),
            ],
            selected: {tab},
            onSelectionChanged: (selection) =>
                onTabChanged(selection.first),
          ),
        ),
        Expanded(
          child: conversationsAsync.when(
            loading: () => const Center(
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            error: (error, _) => Center(
              child: Padding(
                padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
                child: Text(
                  AiL10n.genericFailure.resolve(context),
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textMuted,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
            data: (conversations) {
              if (conversations.isEmpty) {
                return Center(
                  child: Text(
                    tab == AiHistoryTab.active
                        ? AiL10n.noConversations.resolve(context)
                        : AiL10n.noArchivedConversations.resolve(context),
                    style: AppTextStyles.body(context).copyWith(
                      color: palette.textMuted,
                    ),
                  ),
                );
              }

              return ListView.separated(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  0,
                  AppSpacing.md,
                  AppSpacing.md,
                ),
                itemCount: conversations.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(height: AppSpacing.sm),
                itemBuilder: (context, index) {
                  final conversation = conversations[index];
                  return _ConversationHistoryTile(
                    conversation: conversation,
                    selected: conversation.id == selectedConversationId,
                    showRestore: tab == AiHistoryTab.archived,
                    onTap: () => onConversationSelected(conversation.id),
                    onRestore: () => onRestoreConversation(conversation.id),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}

class _ConversationHistoryTile extends StatelessWidget {
  const _ConversationHistoryTile({
    required this.conversation,
    required this.selected,
    required this.showRestore,
    required this.onTap,
    required this.onRestore,
  });

  final AiConversationSummary conversation;
  final bool selected;
  final bool showRestore;
  final VoidCallback onTap;
  final VoidCallback onRestore;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final title = conversation.title?.trim();
    final preview = conversation.preview?.trim();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: showRestore ? null : onTap,
        borderRadius: AppRadius.lgAll,
        child: Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: selected
                ? palette.mint.withValues(alpha: 0.12)
                : palette.panelSurface.withValues(alpha: 0.88),
            borderRadius: AppRadius.lgAll,
            border: Border.all(
              color: selected
                  ? palette.mint.withValues(alpha: 0.35)
                  : palette.borderSubtle.withValues(alpha: 0.82),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title?.isNotEmpty == true
                          ? title!
                          : AiL10n.untitledConversation.resolve(context),
                      style: AppTextStyles.body(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (preview?.isNotEmpty == true) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        preview!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.body(context).copyWith(
                          color: palette.textMuted,
                          fontSize: 13,
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      _formatUpdatedAt(conversation.updatedAt),
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              if (showRestore)
                TextButton(
                  onPressed: onRestore,
                  child: Text(AiL10n.restore.resolve(context)),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatUpdatedAt(DateTime updatedAt) {
    final local = updatedAt.toLocal();
    return '${local.year}-${local.month.toString().padLeft(2, '0')}-'
        '${local.day.toString().padLeft(2, '0')} '
        '${local.hour.toString().padLeft(2, '0')}:'
        '${local.minute.toString().padLeft(2, '0')}';
  }
}
