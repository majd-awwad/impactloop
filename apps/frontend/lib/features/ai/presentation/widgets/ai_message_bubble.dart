import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../domain/ai_models.dart';
import '../l10n/ai_l10n.dart';

class AiMessageBubble extends StatelessWidget {
  const AiMessageBubble({
    super.key,
    required this.message,
  });

  final AiMessageItem message;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
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
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            for (final block in message.contentBlocks)
                              if (block.type == 'text')
                                _AssistantTextBlock(block: block)
                              else if (block.type == 'error')
                                _AssistantErrorBlock(block: block),
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

class _AssistantTextBlock extends StatelessWidget {
  const _AssistantTextBlock({required this.block});

  final AiContentBlock block;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final purpose = block.purpose ?? 'answer';

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (purpose == 'safety')
            Padding(
              padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
              child: Text(
                AiL10n.purposeLabel(context, purpose),
                style: AppTextStyles.label(context).copyWith(
                  color: _purposeColor(palette, purpose),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          Text(
            block.text ?? '',
            style: AppTextStyles.body(context).copyWith(
              color: palette.textPrimary,
              height: 1.45,
            ),
            textAlign: TextAlign.start,
          ),
        ],
      ),
    );
  }

  Color _purposeColor(MaterialsUiPalette palette, String purpose) {
    switch (purpose) {
      case 'refusal':
        return materialWarning;
      case 'safety':
        return palette.mint;
      default:
        return palette.textMuted;
    }
  }
}

class _AssistantErrorBlock extends StatelessWidget {
  const _AssistantErrorBlock({required this.block});

  final AiContentBlock block;

  @override
  Widget build(BuildContext context) {
    return Text(
      block.message ?? AiL10n.genericFailure.resolve(context),
      style: AppTextStyles.body(context).copyWith(
        color: materialWarning,
        height: 1.45,
      ),
      textAlign: TextAlign.start,
    );
  }
}
