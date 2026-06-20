import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
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
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: selected ? learningLime : learningDarkSurfaceSoft,
        borderRadius: AppRadius.pillAll,
        border: Border.all(
          color: selected ? learningLime : learningBorderSubtle,
        ),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(
          context,
        ).copyWith(
          color: selected ? Colors.black87 : learningTextSecondary,
        ),
      ),
    );
  }
}
