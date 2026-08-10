import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/learner_discovery/learner_discovery.dart';
import '../../../materials/data/models/category.dart';
import '../../domain/material_discovery_constants.dart';

class DiscoveryCategoryPicker extends StatefulWidget {
  const DiscoveryCategoryPicker({
    super.key,
    required this.categories,
    required this.selectedCategoryIndex,
    required this.onCategorySelected,
    this.compact = false,
  });

  final List<MaterialCategory> categories;
  final int selectedCategoryIndex;
  final ValueChanged<int> onCategorySelected;
  final bool compact;

  @override
  State<DiscoveryCategoryPicker> createState() =>
      _DiscoveryCategoryPickerState();
}

class _DiscoveryCategoryPickerState extends State<DiscoveryCategoryPicker> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final visible = widget.categories
        .take(discoveryVisibleCategoryCount)
        .toList();
    final hiddenCount = widget.categories.length - visible.length;
    final hasHidden = hiddenCount > 0;
    final selectedHidden = widget.selectedCategoryIndex > visible.length;

    final chips = <Widget>[
      LearnerFilterChip(
        label: const LocalizedText(en: 'All', ar: 'الكل').resolve(context),
        selected: widget.selectedCategoryIndex == 0,
        onSelected: () => widget.onCategorySelected(0),
        style: LearnerFilterChipStyle.solid,
        dense: widget.compact,
      ),
      ...visible.asMap().entries.map((entry) {
        final index = entry.key + 1;
        final category = entry.value;
        return LearnerFilterChip(
          label: _categoryLabel(category).resolve(context),
          selected: widget.selectedCategoryIndex == index,
          onSelected: () => widget.onCategorySelected(index),
          dense: widget.compact,
        );
      }),
      if (hasHidden)
        LearnerFilterChip(
          label: _expanded
              ? const LocalizedText(en: 'Fewer', ar: 'أقل').resolve(context)
              : selectedHidden
              ? const LocalizedText(
                  en: 'More • selected',
                  ar: 'المزيد • محدد',
                ).resolve(context)
              : LocalizedText(
                  en: 'More ($hiddenCount)',
                  ar: 'المزيد ($hiddenCount)',
                ).resolve(context),
          selected: _expanded || selectedHidden,
          onSelected: () => setState(() => _expanded = !_expanded),
          dense: widget.compact,
        ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LearnerChipRow(children: chips),
        if (_expanded && hasHidden) ...[
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: widget.categories.asMap().entries.map((entry) {
              final index = entry.key + 1;
              final category = entry.value;
              return LearnerFilterChip(
                label: _categoryLabel(category).resolve(context),
                selected: widget.selectedCategoryIndex == index,
                onSelected: () {
                  widget.onCategorySelected(index);
                  setState(() => _expanded = false);
                },
                dense: widget.compact,
              );
            }).toList(),
          ),
        ],
      ],
    );
  }

  LocalizedText _categoryLabel(MaterialCategory category) {
    return LocalizedText(
      en: category.nameEn,
      ar: category.nameAr.isNotEmpty ? category.nameAr : category.nameEn,
    );
  }
}
