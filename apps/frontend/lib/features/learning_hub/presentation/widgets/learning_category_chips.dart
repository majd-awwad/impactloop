import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_color_tokens.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../data/learning_hub_mock_data.dart';
import '../../domain/models/learning_project.dart';
import 'learning_hub_text.dart';

class LearningCategoryChips extends StatelessWidget {
  const LearningCategoryChips({
    super.key,
    required this.categories,
    required this.selectedIndex,
  });

  final List<LocalizedText> categories;
  final int selectedIndex;

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsetsDirectional.only(end: AppSpacing.md),
        child: Row(
          children: [
            for (var index = 0; index < categories.length; index++) ...[
              _CategoryChip(
                label: categories[index].resolve(context),
                selected: index == selectedIndex,
              ),
              if (index != categories.length - 1)
                const SizedBox(width: AppSpacing.sm),
            ],
          ],
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({required this.label, required this.selected});

  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final background = selected ? palette.lime : palette.cardSurface;
    final border = selected ? palette.lime : palette.borderSubtle;
    final foreground = selected
        ? AppColorTokens.emeraldDeep
        : isDark
        ? palette.textSecondary
        : palette.textPrimary;

    return Container(
      constraints: const BoxConstraints(minHeight: 42),
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: border),
      ),
      child: Center(
        child: Text(
          label,
          style: AppTextStyles.label(context).copyWith(
            color: foreground,
            fontSize: 13,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w700,
            letterSpacing: 0,
          ),
        ),
      ),
    );
  }
}
