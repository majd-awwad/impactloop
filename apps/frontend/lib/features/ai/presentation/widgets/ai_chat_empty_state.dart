import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../l10n/ai_l10n.dart';

class AiChatEmptyState extends StatelessWidget {
  const AiChatEmptyState({
    super.key,
    required this.onSuggestedQuestionTap,
  });

  final ValueChanged<String> onSuggestedQuestionTap;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: colors.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Icon(
                  Icons.auto_awesome_rounded,
                  color: colors.primary,
                  size: 28,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                AiL10n.emptyTitle.resolve(context),
                style: AppTextStyles.title(context).copyWith(
                  color: palette.textPrimary,
                  fontSize: 20,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                AiL10n.emptySubtitle.resolve(context),
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textMuted,
                  height: 1.45,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                alignment: WrapAlignment.center,
                children: [
                  for (final question in AiL10n.suggestedQuestions)
                    _SuggestedPromptChip(
                      label: question.resolve(context),
                      onTap: () => onSuggestedQuestionTap(question.resolve(context)),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SuggestedPromptChip extends StatelessWidget {
  const _SuggestedPromptChip({
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);

    return ActionChip(
      label: Text(
        label,
        style: AppTextStyles.body(context).copyWith(
          color: palette.textPrimary,
          fontSize: 13,
        ),
      ),
      backgroundColor: palette.panelSurface.withValues(alpha: 0.92),
      side: BorderSide(color: palette.borderSubtle.withValues(alpha: 0.82)),
      shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
      avatar: Icon(Icons.lightbulb_outline, size: 16, color: colors.primary),
      onPressed: onTap,
    );
  }
}
