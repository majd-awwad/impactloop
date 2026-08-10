import 'package:flutter/material.dart';

import '../../../../shared/widgets/learner_discovery/learner_discovery.dart';
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
    return LearnerChipRow(
      children: [
        for (var index = 0; index < categories.length; index++)
          LearnerFilterChip(
            label: categories[index].resolve(context),
            selected: index == selectedIndex,
            onSelected: onSelected == null ? () {} : () => onSelected!(index),
            style: index == 0
                ? LearnerFilterChipStyle.solid
                : LearnerFilterChipStyle.soft,
            dense: true,
          ),
      ],
    );
  }
}
