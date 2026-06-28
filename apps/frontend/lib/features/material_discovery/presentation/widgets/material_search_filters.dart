import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../materials/data/models/category.dart';

class MaterialSearchFilters extends StatelessWidget {
  const MaterialSearchFilters({
    super.key,
    required this.searchController,
    required this.cityController,
    required this.areaController,
    required this.searchValue,
    required this.onSearchChanged,
    required this.onCityChanged,
    required this.onAreaChanged,
    required this.categories,
    required this.selectedCategoryIndex,
    required this.onCategorySelected,
    required this.quickFilters,
    required this.selectedQuickFilterIndex,
    required this.onQuickFilterSelected,
    required this.sortOptions,
    required this.selectedSortIndex,
    required this.onSortSelected,
    required this.conditionFilters,
    required this.selectedConditionIndex,
    required this.onConditionSelected,
    required this.hasActiveFilters,
    required this.onClearFilters,
  });

  final TextEditingController searchController;
  final TextEditingController cityController;
  final TextEditingController areaController;
  final String searchValue;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<String> onCityChanged;
  final ValueChanged<String> onAreaChanged;
  final List<MaterialCategory> categories;
  final int selectedCategoryIndex;
  final ValueChanged<int> onCategorySelected;
  final List<LocalizedText> quickFilters;
  final int selectedQuickFilterIndex;
  final ValueChanged<int> onQuickFilterSelected;
  final List<LocalizedText> sortOptions;
  final int selectedSortIndex;
  final ValueChanged<int> onSortSelected;
  final List<({String? value, LocalizedText label})> conditionFilters;
  final int selectedConditionIndex;
  final ValueChanged<int> onConditionSelected;
  final bool hasActiveFilters;
  final VoidCallback onClearFilters;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final categoryLabels = [
      const LocalizedText(en: 'All', ar: 'الكل'),
      ...categories.map(
        (category) => LocalizedText(
          en: category.nameEn,
          ar: category.nameAr.isNotEmpty ? category.nameAr : category.nameEn,
        ),
      ),
    ];

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: searchController,
            onChanged: onSearchChanged,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textPrimary),
            textAlign: TextAlign.start,
            decoration: InputDecoration(
              hintText: LocalizedText(
                en: 'Search materials, categories, or city',
                ar: 'ابحث عن مواد أو فئات أو مدينة',
              ).resolve(context),
              hintStyle: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
              prefixIcon: Icon(
                Icons.search_rounded,
                color: palette.textSecondary,
              ),
              suffixIcon: searchValue.isEmpty
                  ? Icon(Icons.grid_view_rounded, color: palette.mint)
                  : IconButton(
                      onPressed: () {
                        searchController.clear();
                        onSearchChanged('');
                      },
                      icon: Icon(
                        Icons.close_rounded,
                        color: palette.textSecondary,
                      ),
                    ),
              filled: true,
              fillColor: palette.cardSurfaceAlt,
              border: OutlineInputBorder(
                borderRadius: AppRadius.lgAll,
                borderSide: BorderSide(color: palette.borderStrong),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: AppRadius.lgAll,
                borderSide: BorderSide(color: palette.borderStrong),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: AppRadius.lgAll,
                borderSide: BorderSide(color: palette.mint, width: 1.5),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: cityController,
                  onChanged: onCityChanged,
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textPrimary),
                  decoration: InputDecoration(
                    labelText: LocalizedText(
                      en: 'City',
                      ar: 'المدينة',
                    ).resolve(context),
                    filled: true,
                    fillColor: palette.cardSurfaceAlt,
                    border: OutlineInputBorder(
                      borderRadius: AppRadius.lgAll,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: TextField(
                  controller: areaController,
                  onChanged: onAreaChanged,
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textPrimary),
                  decoration: InputDecoration(
                    labelText: LocalizedText(
                      en: 'Area',
                      ar: 'المنطقة',
                    ).resolve(context),
                    filled: true,
                    fillColor: palette.cardSurfaceAlt,
                    border: OutlineInputBorder(
                      borderRadius: AppRadius.lgAll,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _FilterSectionTitle(
            label: const LocalizedText(en: 'Categories', ar: 'الفئات'),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: List.generate(categoryLabels.length, (index) {
              return _FilterChipButton(
                label: categoryLabels[index].resolve(context),
                selected: selectedCategoryIndex == index,
                onPressed: () => onCategorySelected(index),
              );
            }),
          ),
          const SizedBox(height: AppSpacing.md),
          _FilterSectionTitle(
            label: const LocalizedText(en: 'Quick filters', ar: 'فلاتر سريعة'),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: List.generate(quickFilters.length, (index) {
              return _FilterChipButton(
                label: quickFilters[index].resolve(context),
                selected: selectedQuickFilterIndex == index,
                onPressed: () => onQuickFilterSelected(index),
              );
            }),
          ),
          const SizedBox(height: AppSpacing.md),
          _FilterSectionTitle(
            label: const LocalizedText(en: 'Sort', ar: 'الترتيب'),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: List.generate(sortOptions.length, (index) {
              return _FilterChipButton(
                label: sortOptions[index].resolve(context),
                selected: selectedSortIndex == index,
                onPressed: () => onSortSelected(index),
              );
            }),
          ),
          const SizedBox(height: AppSpacing.md),
          _FilterSectionTitle(
            label: const LocalizedText(en: 'Condition', ar: 'الحالة'),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: List.generate(conditionFilters.length, (index) {
              return _FilterChipButton(
                label: conditionFilters[index].label.resolve(context),
                selected: selectedConditionIndex == index,
                onPressed: () => onConditionSelected(index),
              );
            }),
          ),
          if (hasActiveFilters) ...[
            const SizedBox(height: AppSpacing.md),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton.icon(
                onPressed: onClearFilters,
                style: TextButton.styleFrom(
                  foregroundColor: palette.mint,
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                ),
                icon: const Icon(Icons.restart_alt_rounded),
                label: Text(
                  LocalizedText(
                    en: 'Clear filters',
                    ar: 'مسح الفلاتر',
                  ).resolve(context),
                  textAlign: TextAlign.start,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _FilterSectionTitle extends StatelessWidget {
  const _FilterSectionTitle({required this.label});

  final LocalizedText label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Text(
      label.resolve(context),
      style: AppTextStyles.label(
        context,
      ).copyWith(color: palette.textPrimary),
      textAlign: TextAlign.start,
    );
  }
}

class _FilterChipButton extends StatelessWidget {
  const _FilterChipButton({
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
