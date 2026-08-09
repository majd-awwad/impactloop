import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../locations/application/saved_locations_providers.dart';
import '../../../locations/data/saved_location.dart';
import '../../../materials/application/material_listing_providers.dart';
import '../../../materials/data/models/category.dart';
import '../../application/learner_material_requests_providers.dart';
import '../../data/learner_material_requests_api.dart';
import '../l10n/learner_material_requests_l10n.dart';

const _kMaxContentWidth = 640.0;

class LearnerMaterialRequestFormPage extends ConsumerStatefulWidget {
  const LearnerMaterialRequestFormPage({
    super.key,
    this.initialQuery,
    this.initialCategoryId,
    this.initialProjectId,
    this.initialProjectBuildId,
    this.initialProjectBuildItemId,
  });

  final String? initialQuery;
  final String? initialCategoryId;
  final String? initialProjectId;
  final String? initialProjectBuildId;
  final String? initialProjectBuildItemId;

  @override
  ConsumerState<LearnerMaterialRequestFormPage> createState() =>
      _LearnerMaterialRequestFormPageState();
}

class _LearnerMaterialRequestFormPageState
    extends ConsumerState<LearnerMaterialRequestFormPage> {
  final _formKey = GlobalKey<FormState>();
  late final _itemNameController = TextEditingController(
    text: widget.initialQuery?.trim() ?? '',
  );
  final _descriptionController = TextEditingController();
  final _quantityController = TextEditingController(text: '1');
  final _unitController = TextEditingController(text: 'piece');
  final _cityController = TextEditingController();
  final _areaController = TextEditingController();

  String? _categoryId;
  bool _alternativesAllowed = true;
  String? _selectedSavedLocationId;
  DateTime? _neededBy;
  bool _isSubmitting = false;
  String _idempotencyKey = generateLearnerMaterialRequestIdempotencyKey();

  @override
  void initState() {
    super.initState();
    _categoryId = widget.initialCategoryId;
  }

  @override
  void dispose() {
    _itemNameController.dispose();
    _descriptionController.dispose();
    _quantityController.dispose();
    _unitController.dispose();
    _cityController.dispose();
    _areaController.dispose();
    super.dispose();
  }

  void _applySavedLocation(SavedLocation? location) {
    setState(() {
      _selectedSavedLocationId = location?.id;
      if (location != null) {
        _cityController.text = location.city;
        _areaController.text = location.area ?? '';
      }
    });
  }

  Future<void> _pickNeededByDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _neededBy ?? now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() => _neededBy = picked);
    }
  }

  Future<void> _submit() async {
    if (_isSubmitting) return;
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }
    if (_categoryId == null) {
      showInfoSnackBar(
        context,
        LearnerMaterialRequestsL10n.chooseCategory.resolve(context),
      );
      return;
    }
    if (_selectedSavedLocationId == null &&
        _cityController.text.trim().isEmpty) {
      showInfoSnackBar(
        context,
        LearnerMaterialRequestsL10n.cityLabel.resolve(context),
      );
      return;
    }

    final quantity = double.tryParse(_quantityController.text.trim());
    if (quantity == null || quantity <= 0) {
      showInfoSnackBar(context, 'Enter a valid quantity.');
      return;
    }

    setState(() => _isSubmitting = true);

    final payload = CreateLearnerMaterialRequestPayload(
      requestedItemName: _itemNameController.text.trim(),
      categoryId: _categoryId!,
      description: _descriptionController.text.trim().isEmpty
          ? null
          : _descriptionController.text.trim(),
      quantity: quantity,
      unit: _unitController.text.trim().isEmpty
          ? 'piece'
          : _unitController.text.trim(),
      alternativesAllowed: _alternativesAllowed,
      sourceSavedLocationId: _selectedSavedLocationId,
      locationCity: _selectedSavedLocationId == null
          ? _cityController.text.trim()
          : null,
      locationArea: _selectedSavedLocationId == null
          ? (_areaController.text.trim().isEmpty
                ? null
                : _areaController.text.trim())
          : null,
      neededBy: _neededBy,
      projectId: widget.initialProjectId,
      projectBuildId: widget.initialProjectBuildId,
      projectBuildItemId: widget.initialProjectBuildItemId,
    );

    try {
      final created = await createLearnerMaterialRequest(
        ref,
        payload,
        idempotencyKey: _idempotencyKey,
      );
      if (!mounted) return;
      showInfoSnackBar(
        context,
        LearnerMaterialRequestsL10n.requestSentSuccess.resolve(context),
      );
      context.pushReplacement(
        '/learner/material-requests/${created.id}',
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _idempotencyKey = generateLearnerMaterialRequestIdempotencyKey();
      });
      showInfoSnackBar(context, _errorMessage(error));
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _idempotencyKey = generateLearnerMaterialRequestIdempotencyKey();
      });
      showInfoSnackBar(
        context,
        LearnerMaterialRequestsL10n.requestCreateFailed.resolve(context),
      );
    }
  }

  String _errorMessage(ApiException error) {
    switch (error.code) {
      case 'ACTIVE_REQUEST_LIMIT':
        return LearnerMaterialRequestsL10n.activeRequestLimitReached.resolve(
          context,
        );
      case 'DUPLICATE_OPEN_REQUEST':
        return LearnerMaterialRequestsL10n.duplicateOpenRequest.resolve(
          context,
        );
      default:
        return localizedApiErrorMessage(error, context.l10n);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final categoriesAsync = ref.watch(materialCategoriesProvider);
    final savedLocationsAsync = ref.watch(savedLocationsProvider);

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/home',
              phoneTitle: LearnerMaterialRequestsL10n.createRequestTitle
                  .resolve(context),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxWidth: _kMaxContentWidth,
                    ),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              IconButton(
                                onPressed: () =>
                                    context.popOrGo('/learner/material-requests'),
                                icon: const Icon(Icons.arrow_back_rounded),
                                tooltip: 'Back',
                              ),
                              const SizedBox(width: AppSpacing.xs),
                              Expanded(
                                child: Text(
                                  LearnerMaterialRequestsL10n
                                      .createRequestTitle
                                      .resolve(context),
                                  style: AppTextStyles.title(
                                    context,
                                  ).copyWith(color: palette.textPrimary),
                                ),
                              ),
                            ],
                          ),
                          Padding(
                            padding: const EdgeInsetsDirectional.only(
                              start: 48,
                            ),
                            child: Text(
                              LearnerMaterialRequestsL10n
                                  .createRequestSubtitle
                                  .resolve(context),
                              style: AppTextStyles.body(
                                context,
                              ).copyWith(color: palette.textSecondary),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          _PrivacyNote(),
                          const SizedBox(height: AppSpacing.lg),
                          Text(
                            LearnerMaterialRequestsL10n.itemNameLabel.resolve(
                              context,
                            ),
                            style: AppTextStyles.label(
                              context,
                            ).copyWith(color: palette.textPrimary),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          TextFormField(
                            controller: _itemNameController,
                            decoration: InputDecoration(
                              hintText: LearnerMaterialRequestsL10n
                                  .itemNameHint
                                  .resolve(context),
                              border: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                              ),
                            ),
                            validator: (value) {
                              if (value == null || value.trim().length < 2) {
                                return 'Enter at least 2 characters.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: AppSpacing.md),
                          Text(
                            LearnerMaterialRequestsL10n.categoryLabel.resolve(
                              context,
                            ),
                            style: AppTextStyles.label(
                              context,
                            ).copyWith(color: palette.textPrimary),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          categoriesAsync.when(
                            loading: () => const LinearProgressIndicator(),
                            error: (_, _) => Text(
                              'Categories could not be loaded.',
                              style: AppTextStyles.body(
                                context,
                              ).copyWith(color: palette.textSecondary),
                            ),
                            data: (categories) => DropdownButtonFormField<String>(
                              initialValue: _categoryId,
                              decoration: InputDecoration(
                                hintText: LearnerMaterialRequestsL10n
                                    .chooseCategory
                                    .resolve(context),
                                border: OutlineInputBorder(
                                  borderRadius: AppRadius.mdAll,
                                ),
                              ),
                              items: categories
                                  .map(
                                    (MaterialCategory category) =>
                                        DropdownMenuItem(
                                          value: category.id,
                                          child: Text(
                                            _categoryLabel(context, category),
                                          ),
                                        ),
                                  )
                                  .toList(growable: false),
                              onChanged: (value) =>
                                  setState(() => _categoryId = value),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          Text(
                            LearnerMaterialRequestsL10n.descriptionLabel
                                .resolve(context),
                            style: AppTextStyles.label(
                              context,
                            ).copyWith(color: palette.textPrimary),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          TextFormField(
                            controller: _descriptionController,
                            maxLines: 3,
                            decoration: InputDecoration(
                              hintText: LearnerMaterialRequestsL10n
                                  .descriptionHint
                                  .resolve(context),
                              border: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                              ),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          Row(
                            children: [
                              Expanded(
                                child: _LabeledField(
                                  label: LearnerMaterialRequestsL10n
                                      .quantityLabel
                                      .resolve(context),
                                  child: TextFormField(
                                    controller: _quantityController,
                                    keyboardType:
                                        const TextInputType.numberWithOptions(
                                          decimal: true,
                                        ),
                                    decoration: InputDecoration(
                                      border: OutlineInputBorder(
                                        borderRadius: AppRadius.mdAll,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.md),
                              Expanded(
                                child: _LabeledField(
                                  label: LearnerMaterialRequestsL10n.unitLabel
                                      .resolve(context),
                                  child: TextFormField(
                                    controller: _unitController,
                                    decoration: InputDecoration(
                                      hintText: LearnerMaterialRequestsL10n
                                          .unitHint
                                          .resolve(context),
                                      border: OutlineInputBorder(
                                        borderRadius: AppRadius.mdAll,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.md),
                          SwitchListTile.adaptive(
                            contentPadding: EdgeInsets.zero,
                            value: _alternativesAllowed,
                            onChanged: (value) =>
                                setState(() => _alternativesAllowed = value),
                            title: Text(
                              LearnerMaterialRequestsL10n
                                  .alternativesAllowedLabel
                                  .resolve(context),
                              style: AppTextStyles.label(
                                context,
                              ).copyWith(color: palette.textPrimary),
                            ),
                            subtitle: Text(
                              LearnerMaterialRequestsL10n
                                  .alternativesAllowedSubtitle
                                  .resolve(context),
                              style: AppTextStyles.body(
                                context,
                              ).copyWith(color: palette.textSecondary),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.lg),
                          Text(
                            LearnerMaterialRequestsL10n
                                .locationSectionTitle
                                .resolve(context),
                            style: AppTextStyles.subtitle(
                              context,
                            ).copyWith(color: palette.textPrimary),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            LearnerMaterialRequestsL10n
                                .locationSectionSubtitle
                                .resolve(context),
                            style: AppTextStyles.body(
                              context,
                            ).copyWith(color: palette.textSecondary),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          savedLocationsAsync.maybeWhen(
                            data: (locations) {
                              if (locations.isEmpty) {
                                return const SizedBox.shrink();
                              }
                              return Padding(
                                padding: const EdgeInsets.only(
                                  bottom: AppSpacing.sm,
                                ),
                                child: DropdownButtonFormField<String?>(
                                  initialValue: _selectedSavedLocationId,
                                  decoration: InputDecoration(
                                    labelText: LearnerMaterialRequestsL10n
                                        .useSavedLocation
                                        .resolve(context),
                                    border: OutlineInputBorder(
                                      borderRadius: AppRadius.mdAll,
                                    ),
                                  ),
                                  items: [
                                    const DropdownMenuItem<String?>(
                                      value: null,
                                      child: Text('Enter manually'),
                                    ),
                                    ...locations.map(
                                      (SavedLocation location) =>
                                          DropdownMenuItem<String?>(
                                            value: location.id,
                                            child: Text(location.displayLabel),
                                          ),
                                    ),
                                  ],
                                  onChanged: (value) {
                                    final location = value == null
                                        ? null
                                        : locations.firstWhere(
                                            (loc) => loc.id == value,
                                          );
                                    _applySavedLocation(location);
                                  },
                                ),
                              );
                            },
                            orElse: () => const SizedBox.shrink(),
                          ),
                          if (_selectedSavedLocationId == null) ...[
                            Row(
                              children: [
                                Expanded(
                                  child: _LabeledField(
                                    label: LearnerMaterialRequestsL10n
                                        .cityLabel
                                        .resolve(context),
                                    child: TextFormField(
                                      controller: _cityController,
                                      decoration: InputDecoration(
                                        border: OutlineInputBorder(
                                          borderRadius: AppRadius.mdAll,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.md),
                                Expanded(
                                  child: _LabeledField(
                                    label: LearnerMaterialRequestsL10n
                                        .areaLabel
                                        .resolve(context),
                                    child: TextFormField(
                                      controller: _areaController,
                                      decoration: InputDecoration(
                                        border: OutlineInputBorder(
                                          borderRadius: AppRadius.mdAll,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: AppSpacing.lg),
                          Text(
                            LearnerMaterialRequestsL10n.neededByLabel.resolve(
                              context,
                            ),
                            style: AppTextStyles.label(
                              context,
                            ).copyWith(color: palette.textPrimary),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Row(
                            children: [
                              OutlinedButton.icon(
                                onPressed: _pickNeededByDate,
                                icon: const Icon(Icons.calendar_today_outlined),
                                label: Text(
                                  _neededBy == null
                                      ? LearnerMaterialRequestsL10n.chooseDate
                                            .resolve(context)
                                      : '${_neededBy!.year}-${_neededBy!.month.toString().padLeft(2, '0')}-${_neededBy!.day.toString().padLeft(2, '0')}',
                                ),
                              ),
                              if (_neededBy != null) ...[
                                const SizedBox(width: AppSpacing.sm),
                                TextButton(
                                  onPressed: () =>
                                      setState(() => _neededBy = null),
                                  child: Text(
                                    LearnerMaterialRequestsL10n.clearDate
                                        .resolve(context),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: AppSpacing.xl),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              onPressed: _isSubmitting ? null : _submit,
                              child: _isSubmitting
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : Text(
                                      LearnerMaterialRequestsL10n
                                          .submitRequest
                                          .resolve(context),
                                    ),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xl),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _categoryLabel(BuildContext context, MaterialCategory category) {
  final isArabic = Localizations.localeOf(context).languageCode == 'ar';
  final name = isArabic ? category.nameAr : category.nameEn;
  return name.isEmpty ? category.nameEn : name;
}

class _LabeledField extends StatelessWidget {
  const _LabeledField({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textPrimary),
        ),
        const SizedBox(height: AppSpacing.xs),
        child,
      ],
    );
  }
}

class _PrivacyNote extends StatelessWidget {
  const _PrivacyNote();

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.info.withValues(alpha: 0.08),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.info.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.privacy_tip_outlined, color: colors.info, size: 18),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              LearnerMaterialRequestsL10n.privacyNote.resolve(context),
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}
