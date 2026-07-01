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
  State<MaterialSearchFilters> createState() => _MaterialSearchFiltersState();
}

class _MaterialSearchFiltersState extends State<MaterialSearchFilters> {
  bool _showLocationFields = false;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final hasLocationInput = widget.cityController.text.trim().isNotEmpty ||
        widget.areaController.text.trim().isNotEmpty;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: widget.searchController,
            onChanged: widget.onSearchChanged,
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
              suffixIcon: widget.searchValue.isEmpty
                  ? Icon(Icons.grid_view_rounded, color: palette.mint)
                  : IconButton(
                      onPressed: () {
                        widget.searchController.clear();
                        widget.onSearchChanged('');
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
          const SizedBox(height: AppSpacing.sm),
          InkWell(
            onTap: () => setState(() => _showLocationFields = !_showLocationFields),
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
                                  'Location: ${widget.cityController.text.trim().isEmpty ? 'Any city' : widget.cityController.text.trim()}${widget.areaController.text.trim().isEmpty ? '' : ', ${widget.areaController.text.trim()}'}',
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
                    _showLocationFields
                        ? Icons.expand_less_rounded
                        : Icons.expand_more_rounded,
                    color: palette.textSecondary,
                  ),
                ],
              ),
            ),
          ),
          if (_showLocationFields) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: widget.cityController,
                    onChanged: widget.onCityChanged,
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
                    controller: widget.areaController,
                    onChanged: widget.onAreaChanged,
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
          const SizedBox(height: AppSpacing.md),
          DiscoveryCategoryPicker(
            categories: widget.categories,
            selectedCategoryIndex: widget.selectedCategoryIndex,
            onCategorySelected: widget.onCategorySelected,
          ),
          const SizedBox(height: AppSpacing.md),
          _FilterSectionTitle(
            label: const LocalizedText(
              en: 'Quick filters & sort',
              ar: 'فلاتر سريعة وترتيب',
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                ...List.generate(widget.quickFilters.length, (index) {
                  return Padding(
                    padding: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
                    child: _FilterChipButton(
                      label: widget.quickFilters[index].resolve(context),
                      selected: widget.selectedQuickFilterIndex == index,
                      onPressed: () => widget.onQuickFilterSelected(index),
                    ),
                  );
                }),
                Container(
                  width: 1,
                  height: 28,
                  margin: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
                  color: palette.borderSubtle,
                ),
                ...List.generate(widget.sortOptions.length, (index) {
                  return Padding(
                    padding: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
                    child: _FilterChipButton(
                      label: widget.sortOptions[index].resolve(context),
                      selected: widget.selectedSortIndex == index,
                      onPressed: () => widget.onSortSelected(index),
                    ),
                  );
                }),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _FilterSectionTitle(
            label: const LocalizedText(en: 'Condition', ar: 'الحالة'),
          ),
          const SizedBox(height: AppSpacing.sm),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: List.generate(widget.conditionFilters.length, (index) {
                return Padding(
                  padding: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
                  child: _FilterChipButton(
                    label: widget.conditionFilters[index].label.resolve(context),
                    selected: widget.selectedConditionIndex == index,
                    onPressed: () => widget.onConditionSelected(index),
                  ),
                );
              }),
            ),
          ),
          if (widget.hasActiveFilters) ...[
            const SizedBox(height: AppSpacing.sm),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton.icon(
                onPressed: widget.onClearFilters,
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
