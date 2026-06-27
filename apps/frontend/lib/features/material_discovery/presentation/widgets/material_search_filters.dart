import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';

class MaterialSearchFilters extends StatelessWidget {
  const MaterialSearchFilters({
    super.key,
    required this.controller,
    required this.searchValue,
    required this.onSearchChanged,
    required this.categories,
    required this.quickFilters,
    required this.selectedCategoryIndex,
    required this.selectedQuickFilterIndex,
    required this.onCategorySelected,
    required this.onQuickFilterSelected,
    required this.hasActiveFilters,
    required this.onClearFilters,
  });

  final TextEditingController controller;
  final String searchValue;
  final ValueChanged<String> onSearchChanged;
  final List<LocalizedText> categories;
  final List<LocalizedText> quickFilters;
  final int selectedCategoryIndex;
  final int selectedQuickFilterIndex;
  final ValueChanged<int> onCategorySelected;
  final ValueChanged<int> onQuickFilterSelected;
  final bool hasActiveFilters;
  final VoidCallback onClearFilters;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

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
          Text(
            LocalizedText(en: 'Categories', ar: 'الفئات').resolve(context),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textPrimary),
            textAlign: TextAlign.start,
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: List.generate(categories.length, (index) {
              return _FilterChipButton(
                label: categories[index].resolve(context),
                selected: selectedCategoryIndex == index,
                onPressed: () => onCategorySelected(index),
              );
            }),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            LocalizedText(
              en: 'Quick filters',
              ar: 'فلاتر سريعة',
            ).resolve(context),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textPrimary),
            textAlign: TextAlign.start,
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
