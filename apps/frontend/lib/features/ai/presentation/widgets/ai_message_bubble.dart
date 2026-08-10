import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/utils/content_text_direction.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/ai_chat_controller.dart';
import '../../domain/ai_helpers.dart';
import '../../domain/ai_models.dart';
import 'ai_content_blocks.dart';

class AiMessageBubble extends ConsumerWidget {
  const AiMessageBubble({
    super.key,
    required this.message,
    required this.locale,
    this.authoringProjectUpdatedAt,
    this.authoringDraftSnapshot,
    this.hideStructuredAuthoringBlocks = false,
  });

  final AiMessageItem message;
  final String locale;
  final DateTime? authoringProjectUpdatedAt;
  final AuthoringDraftSnapshot? authoringDraftSnapshot;
  final bool hideStructuredAuthoringBlocks;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final chatState = ref.watch(aiAssistantControllerProvider);
    final controller = ref.read(aiAssistantControllerProvider.notifier);
    final isUser = message.role == 'USER';
    final timeLabel = _formatTime(context, message.createdAt);

    return LayoutBuilder(
      builder: (context, constraints) {
        final avatarReserve = isUser ? 0.0 : 36.0;
        final maxBubbleWidth =
            (constraints.maxWidth - avatarReserve).clamp(120.0, 560.0);

        return Align(
          alignment: isUser
              ? AlignmentDirectional.centerEnd
              : AlignmentDirectional.centerStart,
          child: Row(
            // Keep the row intrinsic so Align can place user/assistant sides
            // explicitly in both LTR and RTL without relying on Row direction.
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            textDirection: Directionality.of(context),
            children: [
              if (!isUser) ...[
                Container(
                  width: 28,
                  height: 28,
                  margin: const EdgeInsetsDirectional.only(bottom: 18),
                  decoration: BoxDecoration(
                    color: colors.primary.withValues(alpha: 0.14),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.auto_awesome_rounded,
                    color: colors.primary,
                    size: 15,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
              ],
              ConstrainedBox(
                constraints: BoxConstraints(maxWidth: maxBubbleWidth),
                child: Column(
                    crossAxisAlignment: isUser
                        ? CrossAxisAlignment.end
                        : CrossAxisAlignment.start,
                    children: [
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: isUser
                              ? colors.primary.withValues(alpha: 0.12)
                              : palette.panelSurface,
                          borderRadius: BorderRadiusDirectional.only(
                            topStart: const Radius.circular(AppRadius.lg),
                            topEnd: const Radius.circular(AppRadius.lg),
                            bottomStart: Radius.circular(
                              isUser ? AppRadius.lg : AppRadius.sm,
                            ),
                            bottomEnd: Radius.circular(
                              isUser ? AppRadius.sm : AppRadius.lg,
                            ),
                          ),
                          border: Border.all(
                            color: isUser
                                ? colors.primary.withValues(alpha: 0.22)
                                : palette.borderSubtle.withValues(alpha: 0.85),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: colors.shadow.withValues(alpha: 0.04),
                              blurRadius: 10,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Padding(
                          padding: const EdgeInsetsDirectional.fromSTEB(
                            AppSpacing.md,
                            AppSpacing.sm + 2,
                            AppSpacing.md,
                            AppSpacing.sm + 2,
                          ),
                          child: isUser
                              ? Text(
                                  message.contentText ?? '',
                                  style: AppTextStyles.body(context).copyWith(
                                    color: palette.textPrimary,
                                    height: 1.5,
                                  ),
                                  softWrap: true,
                                  textAlign: TextAlign.start,
                                  textDirection: resolveContentTextDirection(
                                    message.contentText ?? '',
                                  ),
                                )
                              : Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    for (var index = 0;
                                        index < message.contentBlocks.length;
                                        index += 1)
                                      if (!hideStructuredAuthoringBlocks ||
                                          !isAuthoringStructuredHistoryBlock(
                                            message.contentBlocks[index].type,
                                          ))
                                        AiContentBlockView(
                                          block: message.contentBlocks[index],
                                          messageBlocks: message.contentBlocks,
                                          blockIndex: index,
                                          locale: locale,
                                          authoringProjectUpdatedAt:
                                              authoringProjectUpdatedAt,
                                          authoringDraftSnapshot:
                                              authoringDraftSnapshot,
                                          pendingActionBusyId:
                                              chatState.pendingActionBusyId,
                                          actionErrorMessage: message
                                                      .contentBlocks[index]
                                                      .pendingActionId ==
                                                  null
                                              ? null
                                              : chatState
                                                  .actionErrors[message
                                                          .contentBlocks[index]
                                                          .pendingActionId!]
                                                  ?.message,
                                          onConfirmAction: message
                                                      .contentBlocks[index]
                                                      .pendingActionId ==
                                                  null
                                              ? null
                                              : () => controller
                                                  .confirmPendingAction(
                                                    pendingActionId: message
                                                        .contentBlocks[index]
                                                        .pendingActionId!,
                                                    locale: locale,
                                                  ),
                                          onCancelAction: message
                                                      .contentBlocks[index]
                                                      .pendingActionId ==
                                                  null
                                              ? null
                                              : () => controller
                                                  .cancelPendingAction(
                                                    message
                                                        .contentBlocks[index]
                                                        .pendingActionId!,
                                                  ),
                                        ),
                                    if (message.contentBlocks.isEmpty &&
                                        (message.contentText?.isNotEmpty ??
                                            false))
                                      Text(
                                        message.contentText!,
                                        style: AppTextStyles.body(context)
                                            .copyWith(
                                          color: palette.textPrimary,
                                          height: 1.5,
                                        ),
                                        softWrap: true,
                                        textAlign: TextAlign.start,
                                      ),
                                  ],
                                ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (isUser) ...[
                            Icon(
                              Icons.done_all_rounded,
                              size: 14,
                              color: colors.primary.withValues(alpha: 0.75),
                            ),
                            const SizedBox(width: 4),
                          ],
                          Text(
                            timeLabel,
                            style: AppTextStyles.label(context).copyWith(
                              color: palette.textMuted,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
              ),
            ],
          ),
        );
      },
    );
  }

  String _formatTime(BuildContext context, DateTime createdAt) {
    final localeTag = Localizations.localeOf(context).toLanguageTag();
    return DateFormat.jm(localeTag).format(createdAt.toLocal());
  }
}
