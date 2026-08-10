import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../l10n/ai_l10n.dart';

class AiSuggestionCategory {
  const AiSuggestionCategory({
    required this.label,
    required this.prompt,
    required this.icon,
  });

  final LocalizedText label;
  final LocalizedText prompt;
  final IconData icon;
}

const aiSuggestionCategories = [
  AiSuggestionCategory(
    label: AiL10n.categorySafety,
    prompt: AiL10n.categorySafetyPrompt,
    icon: Icons.health_and_safety_outlined,
  ),
  AiSuggestionCategory(
    label: AiL10n.categoryMaterials,
    prompt: AiL10n.categoryMaterialsPrompt,
    icon: Icons.eco_outlined,
  ),
  AiSuggestionCategory(
    label: AiL10n.categoryTools,
    prompt: AiL10n.categoryToolsPrompt,
    icon: Icons.handyman_outlined,
  ),
];

class AiAssistantSuggestionChips extends StatelessWidget {
  const AiAssistantSuggestionChips({
    super.key,
    required this.onCategoryTap,
    this.onFilterTap,
    this.padding,
  });

  final ValueChanged<String> onCategoryTap;
  final VoidCallback? onFilterTap;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final isCompact = MediaQuery.sizeOf(context).width < 400;
    final showFilter = onFilterTap != null && !isCompact;

    return Padding(
      padding: padding ??
          const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.sm,
          ),
      child: Row(
        children: [
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (var i = 0; i < aiSuggestionCategories.length; i++) ...[
                    if (i > 0) const SizedBox(width: AppSpacing.sm),
                    _CategoryChip(
                      label: aiSuggestionCategories[i].label.resolve(context),
                      icon: aiSuggestionCategories[i].icon,
                      onTap: () => onCategoryTap(
                        aiSuggestionCategories[i].prompt.resolve(context),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (showFilter) ...[
            const SizedBox(width: AppSpacing.xs),
            IconButton(
              tooltip: AiL10n.history.resolve(context),
              onPressed: onFilterTap,
              visualDensity: VisualDensity.compact,
              style: IconButton.styleFrom(
                foregroundColor: palette.textSecondary,
                backgroundColor: palette.mutedSurface.withValues(alpha: 0.65),
                side: BorderSide(
                  color: palette.borderSubtle.withValues(alpha: 0.8),
                ),
              ),
              icon: Icon(Icons.tune_rounded, color: colors.primary, size: 18),
            ),
          ],
        ],
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
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
        child: Ink(
          decoration: BoxDecoration(
            color: palette.panelSurface,
            borderRadius: AppRadius.pillAll,
            border: Border.all(
              color: palette.borderSubtle.withValues(alpha: 0.9),
            ),
            boxShadow: [
              BoxShadow(
                color: colors.shadow.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 16, color: colors.primary),
                const SizedBox(width: AppSpacing.xs),
                Text(
                  label,
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
