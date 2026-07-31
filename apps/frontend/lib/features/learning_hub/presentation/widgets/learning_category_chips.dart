import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../presentation/theme/learning_ui_palette.dart';
import '../../domain/models/learning_project.dart';
import 'learning_hub_text.dart';

class LearningCategoryChips extends StatelessWidget {
  const LearningCategoryChips({
    super.key,
    required this.categories,
    required this.selectedIndex,
    this.onSelected,
  });

  final List<LocalizedText> categories;
  final int selectedIndex;
  final ValueChanged<int>? onSelected;

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
                onTap: onSelected == null ? null : () => onSelected!(index),
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
  const _CategoryChip({
    required this.label,
    required this.selected,
    this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    final background = selected ? palette.limeSoft : palette.cardSurface;
    final border = selected
        ? palette.lime.withValues(alpha: 0.34)
        : palette.borderSubtle;
    final foreground = selected ? palette.lime : palette.textSecondary;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: Container(
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
              style: textTheme.labelMedium?.copyWith(
                color: foreground,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
