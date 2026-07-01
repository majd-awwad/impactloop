import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../materials/data/models/category.dart';
import 'discovery_category_picker.dart';

class MaterialSearchFilters extends StatefulWidget {
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
    this.compactMobile = false,
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
  final bool compactMobile;

  @override
  State<MaterialSearchFilters> createState() => _MaterialSearchFiltersState();
}

class _MaterialSearchFiltersState extends State<MaterialSearchFilters> {
  bool _showLocationFields = false;

  void _openMobileFiltersSheet() {
    var showLocationFields = _showLocationFields;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return DraggableScrollableSheet(
              expand: false,
              initialChildSize: 0.82,
              minChildSize: 0.45,
              maxChildSize: 0.95,
              builder: (context, scrollController) {
                return SingleChildScrollView(
                  controller: scrollController,
                  padding: const EdgeInsetsDirectional.fromSTEB(
                    AppSpacing.md,
                    0,
                    AppSpacing.md,
                    AppSpacing.lg,
                  ),
                  child: _MaterialDiscoveryFilterPanel(
                    searchController: widget.searchController,
                    cityController: widget.cityController,
                    areaController: widget.areaController,
                    searchValue: widget.searchValue,
                    onSearchChanged: widget.onSearchChanged,
                    onCityChanged: widget.onCityChanged,
                    onAreaChanged: widget.onAreaChanged,
                    categories: widget.categories,
                    selectedCategoryIndex: widget.selectedCategoryIndex,
                    onCategorySelected: widget.onCategorySelected,
                    quickFilters: widget.quickFilters,
                    selectedQuickFilterIndex: widget.selectedQuickFilterIndex,
                    onQuickFilterSelected: widget.onQuickFilterSelected,
                    sortOptions: widget.sortOptions,
                    selectedSortIndex: widget.selectedSortIndex,
                    onSortSelected: widget.onSortSelected,
                    conditionFilters: widget.conditionFilters,
                    selectedConditionIndex: widget.selectedConditionIndex,
                    onConditionSelected: widget.onConditionSelected,
                    hasActiveFilters: widget.hasActiveFilters,
                    onClearFilters: widget.onClearFilters,
                    showLocationFields: showLocationFields,
                    onToggleLocationFields: () {
                      setSheetState(() {
                        showLocationFields = !showLocationFields;
                      });
                    },
                    includeSearchField: false,
                    dense: true,
                  ),
                );
              },
            );
          },
        );
      },
    ).whenComplete(() {
      if (mounted) {
        setState(() => _showLocationFields = showLocationFields);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    if (widget.compactMobile) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _DiscoverySearchField(
            controller: widget.searchController,
            searchValue: widget.searchValue,
            onSearchChanged: widget.onSearchChanged,
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: _openMobileFiltersSheet,
                style: OutlinedButton.styleFrom(
                  foregroundColor: palette.textPrimary,
                  side: BorderSide(color: palette.borderStrong),
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                ),
                icon: Icon(Icons.tune_rounded, color: palette.mint, size: 18),
                label: Text(
                  LocalizedText(en: 'Filters', ar: 'الفلاتر').resolve(context),
                ),
              ),
              if (widget.hasActiveFilters) ...[
                const Spacer(),
                TextButton.icon(
                  onPressed: widget.onClearFilters,
                  style: TextButton.styleFrom(foregroundColor: palette.mint),
                  icon: const Icon(Icons.restart_alt_rounded, size: 18),
                  label: Text(
                    LocalizedText(
                      en: 'Clear',
                      ar: 'مسح',
                    ).resolve(context),
                  ),
                ),
              ],
            ],
          ),
          if (widget.hasActiveFilters) ...[
            const SizedBox(height: AppSpacing.sm),
            _ActiveFilterChips(
              searchValue: widget.searchValue,
              onSearchChanged: widget.onSearchChanged,
              searchController: widget.searchController,
              categories: widget.categories,
              selectedCategoryIndex: widget.selectedCategoryIndex,
              onCategorySelected: widget.onCategorySelected,
              quickFilters: widget.quickFilters,
              selectedQuickFilterIndex: widget.selectedQuickFilterIndex,
              onQuickFilterSelected: widget.onQuickFilterSelected,
              sortOptions: widget.sortOptions,
              selectedSortIndex: widget.selectedSortIndex,
              onSortSelected: widget.onSortSelected,
              conditionFilters: widget.conditionFilters,
              selectedConditionIndex: widget.selectedConditionIndex,
              onConditionSelected: widget.onConditionSelected,
              cityController: widget.cityController,
              areaController: widget.areaController,
              onCityChanged: widget.onCityChanged,
              onAreaChanged: widget.onAreaChanged,
            ),
          ],
        ],
      );
    }

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: _MaterialDiscoveryFilterPanel(
        searchController: widget.searchController,
        cityController: widget.cityController,
        areaController: widget.areaController,
        searchValue: widget.searchValue,
        onSearchChanged: widget.onSearchChanged,
        onCityChanged: widget.onCityChanged,
        onAreaChanged: widget.onAreaChanged,
        categories: widget.categories,
        selectedCategoryIndex: widget.selectedCategoryIndex,
        onCategorySelected: widget.onCategorySelected,
        quickFilters: widget.quickFilters,
        selectedQuickFilterIndex: widget.selectedQuickFilterIndex,
        onQuickFilterSelected: widget.onQuickFilterSelected,
        sortOptions: widget.sortOptions,
        selectedSortIndex: widget.selectedSortIndex,
        onSortSelected: widget.onSortSelected,
        conditionFilters: widget.conditionFilters,
        selectedConditionIndex: widget.selectedConditionIndex,
        onConditionSelected: widget.onConditionSelected,
        hasActiveFilters: widget.hasActiveFilters,
        onClearFilters: widget.onClearFilters,
        showLocationFields: _showLocationFields,
        onToggleLocationFields: () {
          setState(() => _showLocationFields = !_showLocationFields);
        },
        includeSearchField: true,
        dense: true,
      ),
    );
  }
}

class _MaterialDiscoveryFilterPanel extends StatelessWidget {
  const _MaterialDiscoveryFilterPanel({
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
    required this.showLocationFields,
    required this.onToggleLocationFields,
    required this.includeSearchField,
    required this.dense,
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
  final bool showLocationFields;
  final VoidCallback onToggleLocationFields;
  final bool includeSearchField;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final hasLocationInput = cityController.text.trim().isNotEmpty ||
        areaController.text.trim().isNotEmpty;
    const sectionGap = AppSpacing.md;
    const chipSectionGap = AppSpacing.sm;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (includeSearchField) ...[
          _DiscoverySearchField(
            controller: searchController,
            searchValue: searchValue,
            onSearchChanged: onSearchChanged,
            comfortableHeight: dense,
          ),
          SizedBox(height: sectionGap),
        ],
        InkWell(
          onTap: onToggleLocationFields,
          borderRadius: AppRadius.lgAll,
          child: Padding(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.xs,
              vertical: AppSpacing.xs,
            ),
            child: Row(
              children: [
                Icon(
                  Icons.location_on_outlined,
                  size: 18,
                  color: hasLocationInput ? palette.mint : palette.textSecondary,
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    hasLocationInput
                        ? LocalizedText(
                            en:
                                'Location: ${cityController.text.trim().isEmpty ? 'Any city' : cityController.text.trim()}${areaController.text.trim().isEmpty ? '' : ', ${areaController.text.trim()}'}',
                            ar: 'الموقع: مفلتر',
                          ).resolve(context)
                        : const LocalizedText(
                            en: 'Filter by city or area',
                            ar: 'تصفية حسب المدينة أو المنطقة',
                          ).resolve(context),
                    style: AppTextStyles.label(context).copyWith(
                      color: hasLocationInput
                          ? palette.textPrimary
                          : palette.textSecondary,
                    ),
                    textAlign: TextAlign.start,
                  ),
                ),
                Icon(
                  showLocationFields
                      ? Icons.expand_less_rounded
                      : Icons.expand_more_rounded,
                  color: palette.textSecondary,
                ),
              ],
            ),
          ),
        ),
        if (showLocationFields) ...[
          SizedBox(height: sectionGap),
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
                    isDense: true,
                    filled: true,
                    fillColor: palette.cardSurfaceAlt,
                    border: OutlineInputBorder(
                      borderRadius: AppRadius.lgAll,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
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
                    isDense: true,
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
        ],
        SizedBox(height: sectionGap),
        DiscoveryCategoryPicker(
          categories: categories,
          selectedCategoryIndex: selectedCategoryIndex,
          onCategorySelected: onCategorySelected,
        ),
        SizedBox(height: sectionGap),
        _FilterSectionTitle(
          label: const LocalizedText(
            en: 'Quick filters & sort',
            ar: 'فلاتر سريعة وترتيب',
          ),
        ),
        const SizedBox(height: chipSectionGap),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              ...List.generate(quickFilters.length, (index) {
                return Padding(
                  padding: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
                  child: _FilterChipButton(
                    label: quickFilters[index].resolve(context),
                    selected: selectedQuickFilterIndex == index,
                    onPressed: () => onQuickFilterSelected(index),
                  ),
                );
              }),
              Container(
                width: 1,
                height: 28,
                margin: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
                color: palette.borderSubtle,
              ),
              ...List.generate(sortOptions.length, (index) {
                return Padding(
                  padding: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
                  child: _FilterChipButton(
                    label: sortOptions[index].resolve(context),
                    selected: selectedSortIndex == index,
                    onPressed: () => onSortSelected(index),
                  ),
                );
              }),
            ],
          ),
        ),
        SizedBox(height: sectionGap),
        _FilterSectionTitle(
          label: const LocalizedText(en: 'Condition', ar: 'الحالة'),
        ),
        const SizedBox(height: chipSectionGap),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: List.generate(conditionFilters.length, (index) {
              return Padding(
                padding: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
                child: _FilterChipButton(
                  label: conditionFilters[index].label.resolve(context),
                  selected: selectedConditionIndex == index,
                  onPressed: () => onConditionSelected(index),
                ),
              );
            }),
          ),
        ),
        if (hasActiveFilters) ...[
          const SizedBox(height: AppSpacing.xs),
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
    );
  }
}

class _DiscoverySearchField extends StatelessWidget {
  const _DiscoverySearchField({
    required this.controller,
    required this.searchValue,
    required this.onSearchChanged,
    this.comfortableHeight = false,
  });

  final TextEditingController controller;
  final String searchValue;
  final ValueChanged<String> onSearchChanged;
  final bool comfortableHeight;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return TextField(
      controller: controller,
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
                  controller.clear();
                  onSearchChanged('');
                },
                icon: Icon(
                  Icons.close_rounded,
                  color: palette.textSecondary,
                ),
              ),
        filled: true,
        fillColor: palette.cardSurfaceAlt,
        contentPadding: comfortableHeight
            ? const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.md,
                vertical: 14,
              )
            : null,
        constraints: comfortableHeight
            ? const BoxConstraints(minHeight: 52)
            : null,
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
    );
  }
}

class _ActiveFilterChips extends StatelessWidget {
  const _ActiveFilterChips({
    required this.searchValue,
    required this.onSearchChanged,
    required this.searchController,
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
    required this.cityController,
    required this.areaController,
    required this.onCityChanged,
    required this.onAreaChanged,
  });

  final String searchValue;
  final ValueChanged<String> onSearchChanged;
  final TextEditingController searchController;
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
  final TextEditingController cityController;
  final TextEditingController areaController;
  final ValueChanged<String> onCityChanged;
  final ValueChanged<String> onAreaChanged;

  @override
  Widget build(BuildContext context) {
    final chips = <Widget>[];

    if (searchValue.trim().isNotEmpty) {
      chips.add(
        _ActiveFilterChip(
          label: searchValue.trim(),
          onDeleted: () {
            searchController.clear();
            onSearchChanged('');
          },
        ),
      );
    }

    if (selectedCategoryIndex > 0 &&
        selectedCategoryIndex - 1 < categories.length) {
      final category = categories[selectedCategoryIndex - 1];
      chips.add(
        _ActiveFilterChip(
          label: LocalizedText(
            en: category.nameEn,
            ar: category.nameAr,
          ).resolve(context),
          onDeleted: () => onCategorySelected(0),
        ),
      );
    }

    if (selectedQuickFilterIndex > 0) {
      chips.add(
        _ActiveFilterChip(
          label: quickFilters[selectedQuickFilterIndex].resolve(context),
          onDeleted: () => onQuickFilterSelected(0),
        ),
      );
    }

    if (selectedSortIndex > 0) {
      chips.add(
        _ActiveFilterChip(
          label: sortOptions[selectedSortIndex].resolve(context),
          onDeleted: () => onSortSelected(0),
        ),
      );
    }

    if (selectedConditionIndex > 0) {
      chips.add(
        _ActiveFilterChip(
          label: conditionFilters[selectedConditionIndex].label.resolve(context),
          onDeleted: () => onConditionSelected(0),
        ),
      );
    }

    final city = cityController.text.trim();
    if (city.isNotEmpty) {
      chips.add(
        _ActiveFilterChip(
          label: LocalizedText(
            en: 'City: $city',
            ar: 'المدينة: $city',
          ).resolve(context),
          onDeleted: () {
            cityController.clear();
            onCityChanged('');
          },
        ),
      );
    }

    final area = areaController.text.trim();
    if (area.isNotEmpty) {
      chips.add(
        _ActiveFilterChip(
          label: LocalizedText(
            en: 'Area: $area',
            ar: 'المنطقة: $area',
          ).resolve(context),
          onDeleted: () {
            areaController.clear();
            onAreaChanged('');
          },
        ),
      );
    }

    if (chips.isEmpty) {
      return const SizedBox.shrink();
    }

    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: chips,
    );
  }
}

class _ActiveFilterChip extends StatelessWidget {
  const _ActiveFilterChip({
    required this.label,
    required this.onDeleted,
  });

  final String label;
  final VoidCallback onDeleted;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return InputChip(
      label: Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: palette.textPrimary,
          fontSize: 12,
        ),
      ),
      deleteIcon: Icon(Icons.close_rounded, size: 16, color: palette.textSecondary),
      onDeleted: onDeleted,
      backgroundColor: palette.mint.withValues(alpha: 0.12),
      side: BorderSide(color: palette.mint.withValues(alpha: 0.35)),
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.compact,
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
          vertical: AppSpacing.xs,
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
            fontSize: 12,
          ),
          textAlign: TextAlign.start,
        ),
      ),
    );
  }
}
