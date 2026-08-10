import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/ai_assistant_shell_provider.dart';
import '../../application/ai_chat_controller.dart';
import '../../domain/ai_models.dart';
import '../l10n/ai_l10n.dart';

enum _HistorySurfaceTab { conversations, attachments }

class AiHistoryPanel extends ConsumerStatefulWidget {
  const AiHistoryPanel({
    super.key,
    required this.tab,
    required this.selectedConversationId,
    required this.onTabChanged,
    required this.onConversationSelected,
    required this.onRestoreConversation,
    this.embedded = false,
    this.onViewAll,
  });

  final AiHistoryTab tab;
  final String? selectedConversationId;
  final ValueChanged<AiHistoryTab> onTabChanged;
  final ValueChanged<String> onConversationSelected;
  final ValueChanged<String> onRestoreConversation;
  final bool embedded;
  final VoidCallback? onViewAll;

  @override
  ConsumerState<AiHistoryPanel> createState() => _AiHistoryPanelState();
}

class _AiHistoryPanelState extends ConsumerState<AiHistoryPanel> {
  final _searchController = TextEditingController();
  _HistorySurfaceTab _surfaceTab = _HistorySurfaceTab.conversations;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final conversationsAsync = widget.tab == AiHistoryTab.active
        ? ref.watch(aiActiveConversationsProvider)
        : ref.watch(aiArchivedConversationsProvider);
    final query = _searchController.text.trim().toLowerCase();

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
          child: Column(
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  color: palette.inputSurface.withValues(alpha: 0.9),
                  borderRadius: AppRadius.pillAll,
                  border: Border.all(
                    color: palette.borderSubtle.withValues(alpha: 0.85),
                  ),
                ),
                child: TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: AiL10n.searchConversations.resolve(context),
                    hintStyle: AppTextStyles.body(context).copyWith(
                      color: palette.textMuted,
                      fontSize: 13,
                    ),
                    prefixIcon: Icon(
                      Icons.search_rounded,
                      color: palette.textMuted,
                      size: 20,
                    ),
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: const EdgeInsetsDirectional.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: AppSpacing.sm + 2,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: _HistoryTabButton(
                      label: AiL10n.conversationsTab.resolve(context),
                      selected: _surfaceTab == _HistorySurfaceTab.conversations,
                      onTap: () => setState(
                        () => _surfaceTab = _HistorySurfaceTab.conversations,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _HistoryTabButton(
                      label: AiL10n.attachmentsTab.resolve(context),
                      selected: _surfaceTab == _HistorySurfaceTab.attachments,
                      onTap: () => setState(
                        () => _surfaceTab = _HistorySurfaceTab.attachments,
                      ),
                    ),
                  ),
                ],
              ),
              if (_surfaceTab == _HistorySurfaceTab.conversations) ...[
                const SizedBox(height: AppSpacing.sm),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: Wrap(
                    spacing: AppSpacing.xs,
                    children: [
                      _FilterChip(
                        label: AiL10n.activeConversations.resolve(context),
                        selected: widget.tab == AiHistoryTab.active,
                        onTap: () => widget.onTabChanged(AiHistoryTab.active),
                      ),
                      _FilterChip(
                        label: AiL10n.archivedConversations.resolve(context),
                        selected: widget.tab == AiHistoryTab.archived,
                        onTap: () => widget.onTabChanged(AiHistoryTab.archived),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        Expanded(
          child: _surfaceTab == _HistorySurfaceTab.attachments
              ? Center(
                  child: Padding(
                    padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.attach_file_rounded,
                          size: 28,
                          color: palette.textMuted,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          AiL10n.noAttachments.resolve(context),
                          style: AppTextStyles.body(context).copyWith(
                            color: palette.textMuted,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                )
              : conversationsAsync.when(
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
                    final filtered = query.isEmpty
                        ? conversations
                        : conversations.where((conversation) {
                            final title = conversation.title?.toLowerCase() ?? '';
                            final preview =
                                conversation.preview?.toLowerCase() ?? '';
                            return title.contains(query) ||
                                preview.contains(query);
                          }).toList(growable: false);

                    if (filtered.isEmpty) {
                      return Center(
                        child: Text(
                          widget.tab == AiHistoryTab.active
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
                      itemCount: filtered.length,
                      separatorBuilder: (_, _) =>
                          const SizedBox(height: AppSpacing.sm),
                      itemBuilder: (context, index) {
                        final conversation = filtered[index];
                        return AiConversationListItem(
                          conversation: conversation,
                          selected:
                              conversation.id == widget.selectedConversationId,
                          showRestore: widget.tab == AiHistoryTab.archived,
                          onTap: () =>
                              widget.onConversationSelected(conversation.id),
                          onRestore: () =>
                              widget.onRestoreConversation(conversation.id),
                        );
                      },
                    );
                  },
                ),
        ),
        if (widget.embedded && widget.onViewAll != null)
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.md,
            ),
            child: OutlinedButton.icon(
              onPressed: widget.onViewAll,
              icon: Icon(Icons.history_rounded, color: colors.primary, size: 18),
              label: Text(AiL10n.viewAllConversations.resolve(context)),
              style: OutlinedButton.styleFrom(
                foregroundColor: palette.textPrimary,
                side: BorderSide(color: palette.borderSubtle),
                shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
                padding: const EdgeInsetsDirectional.symmetric(
                  vertical: AppSpacing.sm + 2,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class AiConversationListItem extends StatelessWidget {
  const AiConversationListItem({
    super.key,
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
    final colors = AppThemeColors.of(context);
    final title = conversation.title?.trim();
    final preview = conversation.preview?.trim();
    final lastMessage = preview == null || preview.isEmpty
        ? null
        : '${AiL10n.lastMessagePrefix.resolve(context)} $preview';

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: showRestore ? null : onTap,
        borderRadius: AppRadius.xlAll,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: selected
                ? colors.primary.withValues(alpha: 0.10)
                : palette.panelSurface,
            borderRadius: AppRadius.xlAll,
            border: Border.all(
              color: selected
                  ? colors.primary.withValues(alpha: 0.28)
                  : palette.borderSubtle.withValues(alpha: 0.85),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: colors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.chat_bubble_outline_rounded,
                  size: 16,
                  color: colors.primary,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            title?.isNotEmpty == true
                                ? title!
                                : AiL10n.untitledConversation.resolve(context),
                            style: AppTextStyles.body(context).copyWith(
                              color: palette.textPrimary,
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Text(
                          _formatUpdatedAt(context, conversation.updatedAt),
                          style: AppTextStyles.label(context).copyWith(
                            color: palette.textMuted,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                    if (lastMessage != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        lastMessage,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.body(context).copyWith(
                          color: palette.textMuted,
                          fontSize: 12.5,
                          height: 1.35,
                        ),
                      ),
                    ],
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

  String _formatUpdatedAt(BuildContext context, DateTime updatedAt) {
    final local = updatedAt.toLocal();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(local.year, local.month, local.day);
    final localeTag = Localizations.localeOf(context).toLanguageTag();

    if (day == today) {
      return DateFormat.jm(localeTag).format(local);
    }
    if (day == today.subtract(const Duration(days: 1))) {
      return AiL10n.yesterday.resolve(context);
    }
    return DateFormat.MMMd(localeTag).format(local);
  }
}

class _HistoryTabButton extends StatelessWidget {
  const _HistoryTabButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsetsDirectional.symmetric(
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: selected
                ? colors.primary.withValues(alpha: 0.12)
                : palette.mutedSurface.withValues(alpha: 0.55),
            borderRadius: AppRadius.pillAll,
            border: Border.all(
              color: selected
                  ? colors.primary.withValues(alpha: 0.25)
                  : palette.borderSubtle.withValues(alpha: 0.7),
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: AppTextStyles.label(context).copyWith(
              color: selected ? colors.primary : palette.textSecondary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);

    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.pillAll,
      child: Container(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm + 2,
          vertical: AppSpacing.xs,
        ),
        decoration: BoxDecoration(
          color: selected
              ? colors.primary.withValues(alpha: 0.14)
              : Colors.transparent,
          borderRadius: AppRadius.pillAll,
        ),
        child: Text(
          label,
          style: AppTextStyles.label(context).copyWith(
            color: selected ? colors.primary : palette.textMuted,
            fontSize: 12,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}
