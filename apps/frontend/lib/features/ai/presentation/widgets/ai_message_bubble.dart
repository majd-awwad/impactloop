import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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

    return Align(
      alignment:
          isUser ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.82,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!isUser) ...[
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: colors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Icon(Icons.auto_awesome_rounded, color: colors.primary, size: 16),
              ),
              const SizedBox(width: AppSpacing.sm),
            ],
            Flexible(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: isUser
                      ? palette.mint.withValues(alpha: 0.14)
                      : palette.panelSurface.withValues(alpha: 0.92),
                  borderRadius: AppRadius.lgAll,
                  border: Border.all(
                    color: isUser
                        ? palette.mint.withValues(alpha: 0.28)
                        : palette.borderSubtle.withValues(alpha: 0.82),
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                  child: isUser
                      ? Text(
                          message.contentText ?? '',
                          style: AppTextStyles.body(context).copyWith(
                            color: palette.textPrimary,
                            height: 1.45,
                          ),
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
                                authoringProjectUpdatedAt: authoringProjectUpdatedAt,
                                authoringDraftSnapshot: authoringDraftSnapshot,
                                pendingActionBusyId:
                                    chatState.pendingActionBusyId,
                                actionErrorMessage: message
                                            .contentBlocks[index]
                                            .pendingActionId ==
                                        null
                                    ? null
                                    : chatState.actionErrors[message
                                            .contentBlocks[index]
                                            .pendingActionId!]
                                        ?.message,
                                onConfirmAction: message
                                            .contentBlocks[index]
                                            .pendingActionId ==
                                        null
                                    ? null
                                    : () => controller.confirmPendingAction(
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
                                    : () => controller.cancelPendingAction(
                                          message.contentBlocks[index]
                                              .pendingActionId!,
                                        ),
                              ),
                            if (message.contentBlocks.isEmpty &&
                                (message.contentText?.isNotEmpty ?? false))
                              Text(
                                message.contentText!,
                                style: AppTextStyles.body(context).copyWith(
                                  color: palette.textPrimary,
                                  height: 1.45,
                                ),
                                textAlign: TextAlign.start,
                              ),
                          ],
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
