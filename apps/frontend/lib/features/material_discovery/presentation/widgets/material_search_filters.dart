import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_close_button.dart';
import '../../../../shared/widgets/learner_discovery/learner_discovery.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../locations/data/saved_location.dart';
import '../../../materials/data/models/category.dart';
import 'discovery_category_picker.dart';

class MaterialSearchFilters extends StatefulWidget {
  const MaterialSearchFilters({
    super.key,
    required this.searchController,
    required this.cityController,
    required this.areaController,
    required this.latitudeController,
    required this.longitudeController,
    required this.searchValue,
    required this.savedLocations,
    required this.savedLocationsLoading,
    required this.selectedSavedLocationId,
    required this.onSearchChanged,
    required this.onCityChanged,
    required this.onAreaChanged,
    required this.onLatitudeChanged,
    required this.onLongitudeChanged,
    required this.onSavedLocationSelected,
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
    this.resultsCount,
    this.compactMobile = false,
  });

  final TextEditingController searchController;
  final TextEditingController cityController;
  final TextEditingController areaController;
  final TextEditingController latitudeController;
  final TextEditingController longitudeController;
  final String searchValue;
  final List<SavedLocation> savedLocations;
  final bool savedLocationsLoading;
  final String? selectedSavedLocationId;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<String> onCityChanged;
  final ValueChanged<String> onAreaChanged;
  final ValueChanged<String> onLatitudeChanged;
  final ValueChanged<String> onLongitudeChanged;
  final ValueChanged<String?> onSavedLocationSelected;
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
  final int? resultsCount;
  final bool compactMobile;

  @override
  State<MaterialSearchFilters> createState() => _MaterialSearchFiltersState();
}

class _MaterialSearchFiltersState extends State<MaterialSearchFilters> {
  bool _showAdvanced = false;

  bool get _hasAdvancedSelection =>
      widget.selectedConditionIndex > 0 ||
      widget.cityController.text.trim().isNotEmpty ||
      widget.areaController.text.trim().isNotEmpty ||
      widget.latitudeController.text.trim().isNotEmpty ||
      widget.longitudeController.text.trim().isNotEmpty ||
      widget.selectedSavedLocationId != null;

  Future<void> _openMobileFiltersSheet() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: LearnerDiscoveryStyle.cardSurface(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      builder: (sheetContext) {
        return _MaterialFiltersSheet(
          cityController: widget.cityController,
          areaController: widget.areaController,
          latitudeController: widget.latitudeController,
          longitudeController: widget.longitudeController,
          savedLocations: widget.savedLocations,
          savedLocationsLoading: widget.savedLocationsLoading,
          selectedSavedLocationId: widget.selectedSavedLocationId,
          onCityChanged: widget.onCityChanged,
          onAreaChanged: widget.onAreaChanged,
          onLatitudeChanged: widget.onLatitudeChanged,
          onLongitudeChanged: widget.onLongitudeChanged,
          onSavedLocationSelected: widget.onSavedLocationSelected,
          conditionFilters: widget.conditionFilters,
          selectedConditionIndex: widget.selectedConditionIndex,
          onConditionSelected: (index) {
            widget.onConditionSelected(index);
          },
          hasActiveFilters: widget.hasActiveFilters || _hasAdvancedSelection,
          onClearFilters: () {
            widget.onClearFilters();
            Navigator.of(sheetContext).pop();
          },
          resultsCount: widget.resultsCount,
          onApply: () => Navigator.of(sheetContext).pop(),
        );
      },
    );
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final filterActive =
        widget.hasActiveFilters || _hasAdvancedSelection || _showAdvanced;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LearnerSearchField(
          controller: widget.searchController,
          onChanged: widget.onSearchChanged,
          hintText: const LocalizedText(
            en: 'Search materials, categories, suppliers, or location',
            ar: 'ابحث عن مواد أو فئات أو موردين أو مدينة',
          ).resolve(context),
        ),
        const SizedBox(height: AppSpacing.sm),
        LearnerChipRow(
          children: [
            LearnerFilterActionButton(
              label: const LocalizedText(en: 'Filters', ar: 'تصفية').resolve(
                context,
              ),
              active: filterActive,
              onPressed: widget.compactMobile
                  ? _openMobileFiltersSheet
                  : () => setState(() => _showAdvanced = !_showAdvanced),
            ),
            ...List.generate(widget.sortOptions.length, (index) {
              return LearnerFilterChip(
                label: widget.sortOptions[index].resolve(context),
                selected: widget.selectedSortIndex == index,
                onSelected: () => widget.onSortSelected(index),
                icon: index == 0 ? Icons.schedule_rounded : null,
                dense: true,
              );
            }),
            for (var index = 1; index < widget.quickFilters.length; index++)
              LearnerFilterChip(
                label: widget.quickFilters[index].resolve(context),
                selected: widget.selectedQuickFilterIndex == index,
                onSelected: () => widget.onQuickFilterSelected(
                  widget.selectedQuickFilterIndex == index ? 0 : index,
                ),
                dense: true,
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        DiscoveryCategoryPicker(
          categories: widget.categories,
          selectedCategoryIndex: widget.selectedCategoryIndex,
          onCategorySelected: widget.onCategorySelected,
          compact: true,
        ),
        if (widget.hasActiveFilters || _hasAdvancedSelection) ...[
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
            latitudeController: widget.latitudeController,
            longitudeController: widget.longitudeController,
            onCityChanged: widget.onCityChanged,
            onAreaChanged: widget.onAreaChanged,
            onLatitudeChanged: widget.onLatitudeChanged,
            onLongitudeChanged: widget.onLongitudeChanged,
            savedLocations: widget.savedLocations,
            selectedSavedLocationId: widget.selectedSavedLocationId,
            onSavedLocationSelected: widget.onSavedLocationSelected,
          ),
        ],
        if (!widget.compactMobile)
          AnimatedSize(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            alignment: Alignment.topCenter,
            child: _showAdvanced
                ? Padding(
                    padding: const EdgeInsetsDirectional.only(top: AppSpacing.md),
                    child: _DesktopFiltersPanel(
                      cityController: widget.cityController,
                      areaController: widget.areaController,
                      latitudeController: widget.latitudeController,
                      longitudeController: widget.longitudeController,
                      savedLocations: widget.savedLocations,
                      savedLocationsLoading: widget.savedLocationsLoading,
                      selectedSavedLocationId: widget.selectedSavedLocationId,
                      onCityChanged: (value) {
                        widget.onCityChanged(value);
                        setState(() {});
                      },
                      onAreaChanged: (value) {
                        widget.onAreaChanged(value);
                        setState(() {});
                      },
                      onLatitudeChanged: (value) {
                        widget.onLatitudeChanged(value);
                        setState(() {});
                      },
                      onLongitudeChanged: (value) {
                        widget.onLongitudeChanged(value);
                        setState(() {});
                      },
                      onSavedLocationSelected: (value) {
                        widget.onSavedLocationSelected(value);
                        setState(() {});
                      },
                      conditionFilters: widget.conditionFilters,
                      selectedConditionIndex: widget.selectedConditionIndex,
                      onConditionSelected: (index) {
                        widget.onConditionSelected(index);
                        setState(() {});
                      },
                      hasActiveFilters:
                          widget.hasActiveFilters || _hasAdvancedSelection,
                      onClearFilters: () {
                        widget.onClearFilters();
                        setState(() => _showAdvanced = false);
                      },
                      resultsCount: widget.resultsCount,
                      onClose: () => setState(() => _showAdvanced = false),
                      onApply: () => setState(() => _showAdvanced = false),
                    ),
                  )
                : const SizedBox.shrink(),
          ),
      ],
    );
  }
}

class _DesktopFiltersPanel extends StatefulWidget {
  const _DesktopFiltersPanel({
    required this.cityController,
    required this.areaController,
    required this.latitudeController,
    required this.longitudeController,
    required this.savedLocations,
    required this.savedLocationsLoading,
    required this.selectedSavedLocationId,
    required this.onCityChanged,
    required this.onAreaChanged,
    required this.onLatitudeChanged,
    required this.onLongitudeChanged,
    required this.onSavedLocationSelected,
    required this.conditionFilters,
    required this.selectedConditionIndex,
    required this.onConditionSelected,
    required this.hasActiveFilters,
    required this.onClearFilters,
    required this.onClose,
    required this.onApply,
    this.resultsCount,
  });

  final TextEditingController cityController;
  final TextEditingController areaController;
  final TextEditingController latitudeController;
  final TextEditingController longitudeController;
  final List<SavedLocation> savedLocations;
  final bool savedLocationsLoading;
  final String? selectedSavedLocationId;
  final ValueChanged<String> onCityChanged;
  final ValueChanged<String> onAreaChanged;
  final ValueChanged<String> onLatitudeChanged;
  final ValueChanged<String> onLongitudeChanged;
  final ValueChanged<String?> onSavedLocationSelected;
  final List<({String? value, LocalizedText label})> conditionFilters;
  final int selectedConditionIndex;
  final ValueChanged<int> onConditionSelected;
  final bool hasActiveFilters;
  final VoidCallback onClearFilters;
  final VoidCallback onClose;
  final VoidCallback onApply;
  final int? resultsCount;

  @override
  State<_DesktopFiltersPanel> createState() => _DesktopFiltersPanelState();
}

class _DesktopFiltersPanelState extends State<_DesktopFiltersPanel> {
  bool _showExtraOptions = false;

  @override
  void initState() {
    super.initState();
    _showExtraOptions =
        widget.latitudeController.text.trim().isNotEmpty ||
        widget.longitudeController.text.trim().isNotEmpty ||
        widget.selectedSavedLocationId != null;
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Material(
      color: palette.cardSurface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
        side: BorderSide(color: palette.borderSubtle),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.sm,
              AppSpacing.sm,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    const LocalizedText(
                      en: 'Filters',
                      ar: 'الفلترة',
                    ).resolve(context),
                    style: AppTextStyles.title(context).copyWith(
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                ),
                AppCloseButton(onPressed: widget.onClose),
              ],
            ),
          ),
          Divider(height: 1, color: palette.borderSubtle),
          Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: _FilterFormBody(
              cityController: widget.cityController,
              areaController: widget.areaController,
              latitudeController: widget.latitudeController,
              longitudeController: widget.longitudeController,
              savedLocations: widget.savedLocations,
              savedLocationsLoading: widget.savedLocationsLoading,
              selectedSavedLocationId: widget.selectedSavedLocationId,
              onCityChanged: widget.onCityChanged,
              onAreaChanged: widget.onAreaChanged,
              onLatitudeChanged: widget.onLatitudeChanged,
              onLongitudeChanged: widget.onLongitudeChanged,
              onSavedLocationSelected: widget.onSavedLocationSelected,
              conditionFilters: widget.conditionFilters,
              selectedConditionIndex: widget.selectedConditionIndex,
              onConditionSelected: widget.onConditionSelected,
              showExtraOptions: _showExtraOptions,
              onToggleExtraOptions: () {
                setState(() => _showExtraOptions = !_showExtraOptions);
              },
              compact: false,
            ),
          ),
          Divider(height: 1, color: palette.borderSubtle),
          Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: _FilterActionsBar(
              hasActiveFilters: widget.hasActiveFilters,
              resultsCount: widget.resultsCount,
              onClear: widget.onClearFilters,
              onApply: widget.onApply,
            ),
          ),
        ],
      ),
    );
  }
}

class _MaterialFiltersSheet extends StatefulWidget {
  const _MaterialFiltersSheet({
    required this.cityController,
    required this.areaController,
    required this.latitudeController,
    required this.longitudeController,
    required this.savedLocations,
    required this.savedLocationsLoading,
    required this.selectedSavedLocationId,
    required this.onCityChanged,
    required this.onAreaChanged,
    required this.onLatitudeChanged,
    required this.onLongitudeChanged,
    required this.onSavedLocationSelected,
    required this.conditionFilters,
    required this.selectedConditionIndex,
    required this.onConditionSelected,
    required this.hasActiveFilters,
    required this.onClearFilters,
    required this.onApply,
    this.resultsCount,
  });

  final TextEditingController cityController;
  final TextEditingController areaController;
  final TextEditingController latitudeController;
  final TextEditingController longitudeController;
  final List<SavedLocation> savedLocations;
  final bool savedLocationsLoading;
  final String? selectedSavedLocationId;
  final ValueChanged<String> onCityChanged;
  final ValueChanged<String> onAreaChanged;
  final ValueChanged<String> onLatitudeChanged;
  final ValueChanged<String> onLongitudeChanged;
  final ValueChanged<String?> onSavedLocationSelected;
  final List<({String? value, LocalizedText label})> conditionFilters;
  final int selectedConditionIndex;
  final ValueChanged<int> onConditionSelected;
  final bool hasActiveFilters;
  final VoidCallback onClearFilters;
  final VoidCallback onApply;
  final int? resultsCount;

  @override
  State<_MaterialFiltersSheet> createState() => _MaterialFiltersSheetState();
}

class _MaterialFiltersSheetState extends State<_MaterialFiltersSheet> {
  late int _conditionIndex;
  bool _showExtraOptions = false;

  @override
  void initState() {
    super.initState();
    _conditionIndex = widget.selectedConditionIndex;
    _showExtraOptions =
        widget.latitudeController.text.trim().isNotEmpty ||
        widget.longitudeController.text.trim().isNotEmpty ||
        widget.selectedSavedLocationId != null;
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsetsDirectional.only(bottom: bottomInset),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.92,
        child: Column(
          children: [
            const SizedBox(height: AppSpacing.sm),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: palette.borderSubtle,
                borderRadius: AppRadius.pillAll,
              ),
            ),
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: Row(
                children: [
                  AppCloseButton(
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  Expanded(
                    child: Text(
                      const LocalizedText(
                        en: 'Filters',
                        ar: 'تصفية',
                      ).resolve(context),
                      textAlign: TextAlign.center,
                      style: AppTextStyles.title(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  const SizedBox(width: 40),
                ],
              ),
            ),
            Divider(height: 1, color: palette.borderSubtle),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                child: _FilterFormBody(
                  cityController: widget.cityController,
                  areaController: widget.areaController,
                  latitudeController: widget.latitudeController,
                  longitudeController: widget.longitudeController,
                  savedLocations: widget.savedLocations,
                  savedLocationsLoading: widget.savedLocationsLoading,
                  selectedSavedLocationId: widget.selectedSavedLocationId,
                  onCityChanged: (value) {
                    widget.onCityChanged(value);
                    setState(() {});
                  },
                  onAreaChanged: (value) {
                    widget.onAreaChanged(value);
                    setState(() {});
                  },
                  onLatitudeChanged: (value) {
                    widget.onLatitudeChanged(value);
                    setState(() {});
                  },
                  onLongitudeChanged: (value) {
                    widget.onLongitudeChanged(value);
                    setState(() {});
                  },
                  onSavedLocationSelected: (value) {
                    widget.onSavedLocationSelected(value);
                    setState(() {});
                  },
                  conditionFilters: widget.conditionFilters,
                  selectedConditionIndex: _conditionIndex,
                  onConditionSelected: (index) {
                    setState(() => _conditionIndex = index);
                    widget.onConditionSelected(index);
                  },
                  showExtraOptions: _showExtraOptions,
                  onToggleExtraOptions: () {
                    setState(() => _showExtraOptions = !_showExtraOptions);
                  },
                  compact: true,
                ),
              ),
            ),
            Container(
              decoration: BoxDecoration(
                color: palette.cardSurface,
                border: Border(
                  top: BorderSide(color: palette.borderSubtle),
                ),
              ),
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.md,
                AppSpacing.lg,
              ),
              child: _FilterActionsBar(
                hasActiveFilters: widget.hasActiveFilters ||
                    _conditionIndex > 0 ||
                    widget.cityController.text.trim().isNotEmpty ||
                    widget.areaController.text.trim().isNotEmpty,
                resultsCount: widget.resultsCount,
                onClear: widget.onClearFilters,
                onApply: widget.onApply,
                stacked: true,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterFormBody extends StatelessWidget {
  const _FilterFormBody({
    required this.cityController,
    required this.areaController,
    required this.latitudeController,
    required this.longitudeController,
    required this.savedLocations,
    required this.savedLocationsLoading,
    required this.selectedSavedLocationId,
    required this.onCityChanged,
    required this.onAreaChanged,
    required this.onLatitudeChanged,
    required this.onLongitudeChanged,
    required this.onSavedLocationSelected,
    required this.conditionFilters,
    required this.selectedConditionIndex,
    required this.onConditionSelected,
    required this.showExtraOptions,
    required this.onToggleExtraOptions,
    required this.compact,
  });

  final TextEditingController cityController;
  final TextEditingController areaController;
  final TextEditingController latitudeController;
  final TextEditingController longitudeController;
  final List<SavedLocation> savedLocations;
  final bool savedLocationsLoading;
  final String? selectedSavedLocationId;
  final ValueChanged<String> onCityChanged;
  final ValueChanged<String> onAreaChanged;
  final ValueChanged<String> onLatitudeChanged;
  final ValueChanged<String> onLongitudeChanged;
  final ValueChanged<String?> onSavedLocationSelected;
  final List<({String? value, LocalizedText label})> conditionFilters;
  final int selectedConditionIndex;
  final ValueChanged<int> onConditionSelected;
  final bool showExtraOptions;
  final VoidCallback onToggleExtraOptions;
  final bool compact;

  InputDecoration _fieldDecoration(BuildContext context, String label) {
    final palette = MaterialsUiPalette.of(context);
    return InputDecoration(
      labelText: label,
      isDense: true,
      filled: true,
      fillColor: palette.cardSurfaceAlt,
      contentPadding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: 14,
      ),
      border: OutlineInputBorder(borderRadius: AppRadius.lgAll),
      enabledBorder: OutlineInputBorder(
        borderRadius: AppRadius.lgAll,
        borderSide: BorderSide(color: palette.borderSubtle),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: AppRadius.lgAll,
        borderSide: BorderSide(color: palette.mint, width: 1.4),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final savedLocationValue =
        savedLocations.any(
          (location) =>
              location.id == selectedSavedLocationId && location.hasCoordinates,
        )
        ? selectedSavedLocationId
        : null;

    final cityField = TextField(
      controller: cityController,
      onChanged: onCityChanged,
      decoration: _fieldDecoration(
        context,
        const LocalizedText(en: 'City', ar: 'المدينة').resolve(context),
      ),
    );
    final areaField = TextField(
      controller: areaController,
      onChanged: onAreaChanged,
      decoration: _fieldDecoration(
        context,
        const LocalizedText(en: 'Area / region', ar: 'المنطقة').resolve(
          context,
        ),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          const LocalizedText(en: 'Condition', ar: 'الحالة').resolve(context),
          style: AppTextStyles.label(context).copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: List.generate(conditionFilters.length, (index) {
            return LearnerFilterChip(
              label: conditionFilters[index].label.resolve(context),
              selected: selectedConditionIndex == index,
              onSelected: () => onConditionSelected(index),
              dense: true,
            );
          }),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          const LocalizedText(en: 'Location', ar: 'الموقع').resolve(context),
          style: AppTextStyles.label(context).copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (compact) ...[
          cityField,
          const SizedBox(height: AppSpacing.sm),
          areaField,
        ] else
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: cityField),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: areaField),
            ],
          ),
        const SizedBox(height: AppSpacing.md),
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onToggleExtraOptions,
            borderRadius: AppRadius.lgAll,
            child: Padding(
              padding: const EdgeInsetsDirectional.symmetric(
                vertical: AppSpacing.sm,
                horizontal: AppSpacing.xs,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      const LocalizedText(
                        en: 'Additional options',
                        ar: 'خيارات إضافية',
                      ).resolve(context),
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Icon(
                    showExtraOptions
                        ? Icons.expand_less_rounded
                        : Icons.expand_more_rounded,
                    color: palette.textSecondary,
                  ),
                ],
              ),
            ),
          ),
        ),
        AnimatedCrossFade(
          firstChild: const SizedBox(width: double.infinity),
          secondChild: Padding(
            padding: const EdgeInsetsDirectional.only(top: AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (savedLocationsLoading)
                  LinearProgressIndicator(
                    minHeight: 2,
                    color: palette.mint,
                    backgroundColor: palette.borderSubtle,
                  )
                else if (savedLocations.isNotEmpty) ...[
                  DropdownButtonFormField<String?>(
                    initialValue: savedLocationValue,
                    isExpanded: true,
                    decoration: _fieldDecoration(
                      context,
                      const LocalizedText(
                        en: 'Saved location (for nearest)',
                        ar: 'موقع محفوظ (للأقرب)',
                      ).resolve(context),
                    ),
                    items: [
                      DropdownMenuItem<String?>(
                        value: null,
                        child: Text(
                          const LocalizedText(
                            en: 'No saved location',
                            ar: 'بدون موقع محفوظ',
                          ).resolve(context),
                        ),
                      ),
                      ...savedLocations
                          .where((location) => location.hasCoordinates)
                          .map(
                            (location) => DropdownMenuItem<String?>(
                              value: location.id,
                              child: Text(
                                location.displayLabel,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                    ],
                    onChanged: onSavedLocationSelected,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
                Text(
                  const LocalizedText(
                    en: 'Optional coordinates for nearest sorting',
                    ar: 'إحداثيات اختيارية للترتيب حسب الأقرب',
                  ).resolve(context),
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                if (compact) ...[
                  TextField(
                    controller: latitudeController,
                    onChanged: onLatitudeChanged,
                    keyboardType: const TextInputType.numberWithOptions(
                      signed: true,
                      decimal: true,
                    ),
                    decoration: _fieldDecoration(
                      context,
                      const LocalizedText(
                        en: 'Latitude',
                        ar: 'خط العرض',
                      ).resolve(context),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    controller: longitudeController,
                    onChanged: onLongitudeChanged,
                    keyboardType: const TextInputType.numberWithOptions(
                      signed: true,
                      decimal: true,
                    ),
                    decoration: _fieldDecoration(
                      context,
                      const LocalizedText(
                        en: 'Longitude',
                        ar: 'خط الطول',
                      ).resolve(context),
                    ),
                  ),
                ] else
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: latitudeController,
                          onChanged: onLatitudeChanged,
                          keyboardType: const TextInputType.numberWithOptions(
                            signed: true,
                            decimal: true,
                          ),
                          decoration: _fieldDecoration(
                            context,
                            const LocalizedText(
                              en: 'Latitude',
                              ar: 'خط العرض',
                            ).resolve(context),
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: TextField(
                          controller: longitudeController,
                          onChanged: onLongitudeChanged,
                          keyboardType: const TextInputType.numberWithOptions(
                            signed: true,
                            decimal: true,
                          ),
                          decoration: _fieldDecoration(
                            context,
                            const LocalizedText(
                              en: 'Longitude',
                              ar: 'خط الطول',
                            ).resolve(context),
                          ),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
          crossFadeState: showExtraOptions
              ? CrossFadeState.showSecond
              : CrossFadeState.showFirst,
          duration: const Duration(milliseconds: 180),
        ),
      ],
    );
  }
}

class _FilterActionsBar extends StatelessWidget {
  const _FilterActionsBar({
    required this.hasActiveFilters,
    required this.onClear,
    required this.onApply,
    this.resultsCount,
    this.stacked = false,
  });

  final bool hasActiveFilters;
  final VoidCallback onClear;
  final VoidCallback onApply;
  final int? resultsCount;
  final bool stacked;

  String _applyLabel(BuildContext context) {
    final count = resultsCount;
    if (count == null) {
      return const LocalizedText(
        en: 'Show results',
        ar: 'عرض النتائج',
      ).resolve(context);
    }
    return LocalizedText(
      en: 'Show $count results',
      ar: 'عرض $count نتيجة',
    ).resolve(context);
  }

  @override
  Widget build(BuildContext context) {
    final clearButton = OutlinedButton(
      onPressed: hasActiveFilters ? onClear : null,
      style: OutlinedButton.styleFrom(
        minimumSize: Size(stacked ? double.infinity : 140, 46),
        foregroundColor: LearnerDiscoveryStyle.textPrimary(context),
        side: BorderSide(color: LearnerDiscoveryStyle.border(context)),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
      ),
      child: Text(
        const LocalizedText(en: 'Clear all', ar: 'مسح الكل').resolve(context),
      ),
    );

    final applyButton = FilledButton(
      onPressed: onApply,
      style: FilledButton.styleFrom(
        minimumSize: Size(stacked ? double.infinity : 180, 46),
        backgroundColor: LearnerDiscoveryStyle.primary(context),
        foregroundColor: LearnerDiscoveryStyle.textOnPrimary(context),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
      ),
      child: Text(
        _applyLabel(context),
        style: AppTextStyles.label(context).copyWith(
          color: LearnerDiscoveryStyle.textOnPrimary(context),
          fontWeight: FontWeight.w800,
        ),
      ),
    );

    if (stacked) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          applyButton,
          const SizedBox(height: AppSpacing.sm),
          clearButton,
        ],
      );
    }

    return Row(
      children: [
        clearButton,
        const Spacer(),
        applyButton,
      ],
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
    required this.latitudeController,
    required this.longitudeController,
    required this.onCityChanged,
    required this.onAreaChanged,
    required this.onLatitudeChanged,
    required this.onLongitudeChanged,
    required this.savedLocations,
    required this.selectedSavedLocationId,
    required this.onSavedLocationSelected,
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
  final TextEditingController latitudeController;
  final TextEditingController longitudeController;
  final ValueChanged<String> onCityChanged;
  final ValueChanged<String> onAreaChanged;
  final ValueChanged<String> onLatitudeChanged;
  final ValueChanged<String> onLongitudeChanged;
  final List<SavedLocation> savedLocations;
  final String? selectedSavedLocationId;
  final ValueChanged<String?> onSavedLocationSelected;

  @override
  Widget build(BuildContext context) {
    final chips = <Widget>[];

    if (searchValue.trim().isNotEmpty) {
      chips.add(
        _RemovableChip(
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
        _RemovableChip(
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
        _RemovableChip(
          label: quickFilters[selectedQuickFilterIndex].resolve(context),
          onDeleted: () => onQuickFilterSelected(0),
        ),
      );
    }

    if (selectedSortIndex > 0) {
      chips.add(
        _RemovableChip(
          label: sortOptions[selectedSortIndex].resolve(context),
          onDeleted: () => onSortSelected(0),
        ),
      );
    }

    if (selectedConditionIndex > 0) {
      chips.add(
        _RemovableChip(
          label: conditionFilters[selectedConditionIndex].label.resolve(
            context,
          ),
          onDeleted: () => onConditionSelected(0),
        ),
      );
    }

    final city = cityController.text.trim();
    if (city.isNotEmpty) {
      chips.add(
        _RemovableChip(
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
        _RemovableChip(
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

    SavedLocation? selectedSavedLocation;
    for (final location in savedLocations) {
      if (location.id == selectedSavedLocationId) {
        selectedSavedLocation = location;
        break;
      }
    }
    if (selectedSavedLocation != null) {
      chips.add(
        _RemovableChip(
          label: selectedSavedLocation.displayLabel,
          onDeleted: () => onSavedLocationSelected(null),
        ),
      );
    }

    final latitude = latitudeController.text.trim();
    final longitude = longitudeController.text.trim();
    if (latitude.isNotEmpty || longitude.isNotEmpty) {
      chips.add(
        _RemovableChip(
          label: const LocalizedText(
            en: 'Nearest point',
            ar: 'نقطة الأقرب',
          ).resolve(context),
          onDeleted: () {
            latitudeController.clear();
            longitudeController.clear();
            onLatitudeChanged('');
            onLongitudeChanged('');
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

class _RemovableChip extends StatelessWidget {
  const _RemovableChip({required this.label, required this.onDeleted});

  final String label;
  final VoidCallback onDeleted;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return InputChip(
      label: Text(
        label,
        style: AppTextStyles.label(
          context,
        ).copyWith(color: palette.textPrimary, fontSize: 12),
      ),
      deleteIcon: Icon(
        Icons.close_rounded,
        size: 16,
        color: palette.textSecondary,
      ),
      onDeleted: onDeleted,
      backgroundColor: palette.mint.withValues(alpha: 0.12),
      side: BorderSide(color: palette.mint.withValues(alpha: 0.35)),
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.compact,
    );
  }
}
