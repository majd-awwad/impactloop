import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../materials/data/models/category.dart';
import '../../domain/material_discovery_constants.dart';

class DiscoveryCategoryPicker extends StatefulWidget {
  const DiscoveryCategoryPicker({
    super.key,
    required this.categories,
    required this.selectedCategoryIndex,
    required this.onCategorySelected,
  });

  final List<MaterialCategory> categories;
  final int selectedCategoryIndex;
  final ValueChanged<int> onCategorySelected;

  @override
  State<DiscoveryCategoryPicker> createState() =>
      _DiscoveryCategoryPickerState();
}

class _DiscoveryCategoryPickerState extends State<DiscoveryCategoryPicker> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final visible = widget.categories.take(discoveryVisibleCategoryCount).toList();
    final hiddenCount = widget.categories.length - visible.length;
    final hasHidden = hiddenCount > 0;
    final selectedHidden = widget.selectedCategoryIndex > visible.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          const LocalizedText(en: 'Categories', ar: 'الفئات').resolve(context),
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textPrimary),
          textAlign: TextAlign.start,
        ),
        const SizedBox(height: AppSpacing.sm),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _CategoryChip(
                label: const LocalizedText(en: 'All', ar: 'الكل').resolve(
                  context,
                ),
                selected: widget.selectedCategoryIndex == 0,
                onPressed: () => widget.onCategorySelected(0),
              ),
              const SizedBox(width: AppSpacing.sm),
              ...visible.asMap().entries.map((entry) {
                final index = entry.key + 1;
                final category = entry.value;
                return Padding(
                  padding: const EdgeInsetsDirectional.only(
                    end: AppSpacing.sm,
                  ),
                  child: _CategoryChip(
                    label: _categoryLabel(category).resolve(context),
                    selected: widget.selectedCategoryIndex == index,
                    onPressed: () => widget.onCategorySelected(index),
                  ),
                );
              }),
              if (hasHidden)
                _CategoryChip(
                  label: _expanded
                      ? const LocalizedText(
                          en: 'Fewer',
                          ar: 'أقل',
                        ).resolve(context)
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
                  onPressed: () => setState(() => _expanded = !_expanded),
                ),
            ],
          ),
        ),
        if (_expanded && hasHidden) ...[
          const SizedBox(height: AppSpacing.sm),
          Container(
            constraints: const BoxConstraints(maxHeight: 168),
            padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: palette.cardSurfaceAlt,
              borderRadius: AppRadius.lgAll,
              border: Border.all(color: palette.borderSubtle),
            ),
            child: SingleChildScrollView(
              child: Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: widget.categories.asMap().entries.map((entry) {
                  final index = entry.key + 1;
                  final category = entry.value;
                  return _CategoryChip(
                    label: _categoryLabel(category).resolve(context),
                    selected: widget.selectedCategoryIndex == index,
                    onPressed: () {
                      widget.onCategorySelected(index);
                      setState(() => _expanded = false);
                    },
                  );
                }).toList(),
              ),
            ),
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

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onPressed,
  });

  final String label;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return InkWell(
      onTap: onPressed,
      borderRadius: AppRadius.pillAll,
      child: Container(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: selected
              ? palette.mint.withValues(alpha: 0.14)
              : palette.cardSurfaceAlt,
          borderRadius: AppRadius.pillAll,
          border: Border.all(
            color: selected ? palette.mint : palette.borderSubtle,
          ),
        ),
        child: Text(
          label,
          style: AppTextStyles.label(context).copyWith(
            color: selected ? palette.textPrimary : palette.textSecondary,
          ),
          textAlign: TextAlign.start,
        ),
      ),
    );
  }
}
