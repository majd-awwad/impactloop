import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../materials/application/material_listing_providers.dart';
import '../../../materials/data/material_listing_repository.dart';
import '../../../materials/data/models/category.dart';
import '../../../materials/data/models/create_material_request.dart';
import '../../../materials/data/models/created_material.dart';
import '../../../materials/data/models/material_listing_policy.dart';
import '../../../materials/data/models/material_price_check_request.dart';
import '../../../materials/data/models/category_request.dart';
import '../../../materials/data/models/material_draft_image.dart';
import '../../../materials/data/models/material_price_check_result.dart';
import '../../../materials/data/models/material_type.dart' as material_models;
import '../../../materials/data/models/price_rule_request.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/supplier_verification_access.dart';
import '../../data/supplier_materials_repository.dart';
import '../controllers/supplier_dashboard_providers.dart';
import '../controllers/supplier_notifications_providers.dart';
import '../controllers/supplier_profile_providers.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/add_material_pickup_section.dart';
import '../widgets/add_material_preview_card.dart';
import '../widgets/add_material_price_verification_card.dart';
import '../widgets/material_image_picker_section.dart';
import '../widgets/supplier_dark_form_field.dart';
import '../widgets/supplier_feedback.dart';

const _conditions = [
  'NEW',
  'LIKE_NEW',
  'GOOD',
  'NEEDS_REPAIR',
];

String _createConditionValue(String? value) {
  return value == 'USED' ? 'GOOD' : value ?? 'GOOD';
}

class AddMaterialPage extends ConsumerStatefulWidget {
  const AddMaterialPage({
    super.key,
    this.categoryRequestId,
    this.priceRuleRequestId,
  });

  final String? categoryRequestId;
  final String? priceRuleRequestId;

  @override
  ConsumerState<AddMaterialPage> createState() => _AddMaterialPageState();
}

class _AddMaterialPageState extends ConsumerState<AddMaterialPage> {
  final _formKey = GlobalKey<FormState>();
  final _pickupSectionKey = GlobalKey<AddMaterialPickupSectionState>();
  final _materialNameController = TextEditingController();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _suggestedUsesController = TextEditingController();
  final _pickupNotesController = TextEditingController();
  final _quantityController = TextEditingController(text: '1');
  final _unitController = TextEditingController(text: 'piece');
  final _priceController = TextEditingController();
  final _requestedCategoryController = TextEditingController();
  final _categoryRequestReasonController = TextEditingController();

  String? _categoryId;
  bool _categoryManuallySelected = false;
  material_models.MaterialType? _selectedMaterialType;
  String _condition = 'GOOD';
  bool _isFree = true;
  bool _unitEditedByUser = false;
  bool _pickupAllowed = true;
  bool _deliveryAllowed = false;
  bool _showCategoryRequestField = false;
  bool _isSubmittingCategoryRequest = false;
  String? _categoryRequestMessage;
  String? _categoryResumeMessage;
  MaterialPriceCheckResult? _priceCheck;
  CreatedMaterial? _createdMaterial;
  bool _isCheckingPrice = false;
  bool _isSubmitting = false;
  bool _isRequestingPriceReview = false;
  bool _isUploadingImages = false;
  String? _priceReviewMessage;
  double? _maxAllowedUnitPrice;
  String? _maxAllowedUnitLabel;
  final List<MaterialDraftImage> _images = [];
  bool _resumeHandled = false;
  bool _isResumingDraft = false;
  String? _resumeError;
  String? _sourceCategoryRequestId;
  String? _sourcePriceRuleRequestId;

  @override
  void initState() {
    super.initState();
    _sourceCategoryRequestId = widget.categoryRequestId?.trim();
    _sourcePriceRuleRequestId = widget.priceRuleRequestId?.trim();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeResumeFromRoute());
  }

  @override
  void didUpdateWidget(covariant AddMaterialPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.categoryRequestId != widget.categoryRequestId ||
        oldWidget.priceRuleRequestId != widget.priceRuleRequestId) {
      _resumeHandled = false;
      _resumeError = null;
      _sourceCategoryRequestId = widget.categoryRequestId?.trim();
      _sourcePriceRuleRequestId = widget.priceRuleRequestId?.trim();
      WidgetsBinding.instance.addPostFrameCallback((_) => _maybeResumeFromRoute());
    }
  }

  @override
  void dispose() {
    _materialNameController.dispose();
    _titleController.dispose();
    _descriptionController.dispose();
    _suggestedUsesController.dispose();
    _pickupNotesController.dispose();
    _quantityController.dispose();
    _unitController.dispose();
    _priceController.dispose();
    _requestedCategoryController.dispose();
    _categoryRequestReasonController.dispose();
    super.dispose();
  }

  void _invalidatePriceCheck() {
    setState(() {
      _priceCheck = null;
      _priceReviewMessage = null;
    });
  }

  void _onMaterialNameChanged(String value) {
    setState(() {
      if (_selectedMaterialType != null &&
          value.trim() != _selectedMaterialType!.nameEn) {
        _selectedMaterialType = null;
      }
      _priceCheck = null;
      _priceReviewMessage = null;
    });
  }

  void _selectMaterialType(material_models.MaterialType materialType) {
    setState(() {
      _selectedMaterialType = materialType;
      _materialNameController.text = materialType.nameEn;
      final currentUnit = _unitController.text.trim();
      if (!_unitEditedByUser &&
          (currentUnit.isEmpty || currentUnit == 'piece') &&
          materialType.defaultUnit.isNotEmpty) {
        _unitController.text = materialType.defaultUnit;
      }
      _priceCheck = null;
      _priceReviewMessage = null;
    });
  }

  MaterialCategory? _findCategoryById(
    List<MaterialCategory> categories,
    String? categoryId,
  ) {
    if (categoryId == null) {
      return null;
    }
    for (final category in categories) {
      if (category.id == categoryId) {
        return category;
      }
    }
    return null;
  }

  bool _isPaidOtherBlockedForCategory(MaterialCategory? category) {
    if (_isFree || category == null) {
      return false;
    }
    return category.nameEn.toLowerCase() == 'other';
  }

  /// Paid listings can publish after a successful price check, including
  /// admin-reviewed price rule requests resumed on this page.
  bool _paidListingCanPublish(MaterialCategory? category) {
    if (_isFree) {
      return true;
    }
    if (_isPaidOtherBlockedForCategory(category)) {
      return false;
    }
    return _priceCheck?.allowed == true;
  }

  bool _canPublishListing(MaterialCategory? category) {
    return _paidListingCanPublish(category);
  }

  bool _isWithinApprovedPriceRuleCap() {
    if (_isFree || _maxAllowedUnitPrice == null) {
      return false;
    }
    final price = double.tryParse(_priceController.text.trim());
    return price != null && price > 0 && price <= _maxAllowedUnitPrice!;
  }

  AddMaterialPreviewPriceStatus? _previewPriceStatus(MaterialCategory? category) {
    if (_isFree) {
      return null;
    }
    if (_paidListingCanPublish(category)) {
      return AddMaterialPreviewPriceStatus.verified;
    }
    if (_priceCheck != null && !_priceCheck!.allowed) {
      return AddMaterialPreviewPriceStatus.verificationFailed;
    }
    if (_isWithinApprovedPriceRuleCap() &&
        _sourcePriceRuleRequestId != null &&
        !_isPaidOtherBlockedForCategory(category)) {
      return AddMaterialPreviewPriceStatus.withinApprovedCapVerifyPending;
    }
    return AddMaterialPreviewPriceStatus.verifyRequired;
  }

  void _onCategoryChanged(String? value) {
    if (value == _categoryId) {
      return;
    }
    setState(() {
      _categoryId = value;
      _categoryManuallySelected = value != null;
      _selectedMaterialType = null;
      _priceCheck = null;
      _priceReviewMessage = null;
      _maxAllowedUnitPrice = null;
      _maxAllowedUnitLabel = null;
      _categoryResumeMessage = null;
    });
  }

  Future<void> _restoreSelectedMaterialTypeFromDraft() async {
    final categoryId = _categoryId;
    final materialName = _materialNameController.text.trim();
    if (categoryId == null || materialName.length < 2) {
      return;
    }

    try {
      final result = await ref
          .read(materialListingRepositoryProvider)
          .searchMaterialTypes(categoryId: categoryId, query: materialName);

      material_models.MaterialType? exactMatch;
      for (final item in result.items) {
        if (item.nameEn.toLowerCase() == materialName.toLowerCase()) {
          exactMatch = item;
          break;
        }
      }

      if (!mounted || exactMatch == null) {
        return;
      }

      setState(() => _selectedMaterialType = exactMatch);
    } catch (_) {
      // Leave unselected when lookup fails.
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final supplierProfile = user?.supplierProfile;
    if (!canSupplierPublishMaterials(
      supplierType: supplierProfile?.supplierType,
      verificationStatus: supplierProfile?.verificationStatus,
    )) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.verified_user_outlined, size: 48),
                const SizedBox(height: 16),
                Text(
                  'Your supplier account is waiting for admin approval. You can publish materials after approval.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
          ),
        ),
      );
    }

    final l = context.s;
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;
    final profile = ref.watch(supplierProfileProvider);
    final categories = ref.watch(materialCategoriesProvider);
    final policy = ref.watch(materialListingPolicyProvider);
    final compact = MediaQuery.sizeOf(context).width <
        AppSpacing.supplierLayoutBreakpoint;

    return SingleChildScrollView(
      padding: decorations.pagePadding(compact: compact),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Header(policy: policy),
          if (_isResumingDraft) ...[
            const SizedBox(height: AppSpacing.md),
            Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: colors.accent,
                ),
              ),
            ),
          ],
          if (_resumeError != null) ...[
            const SizedBox(height: AppSpacing.md),
            _ResumeErrorBanner(
              message: _resumeError!,
              onRetry: _retryResume,
              onBack: () => context.go('/supplier/notifications'),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          profile.when(
            data: (profile) {
              if (!profile.hasSupplierProfile || profile.supplier == null) {
                return _BlockerCard(
                  title: l.completeProfileFirst,
                  message: l.completeProfileFirstMessage,
                  buttonLabel: l.goToProfile,
                  onPressed: () => context.go('/supplier/profile'),
                );
              }

              final pickupLocation = profile.supplier!.defaultPickupLocation;
              if (pickupLocation == null) {
                return _BlockerCard(
                  title: l.setPickupLocation,
                  message: l.setPickupLocationMessage,
                  buttonLabel: l.editSupplierProfile,
                  onPressed: () => context.go('/supplier/profile'),
                );
              }

              return categories.when(
                data: (items) => _buildForm(
                  items,
                  pickupLocation,
                  profile.supplier!.supplierType,
                ),
                loading: () => Center(
                  child: CircularProgressIndicator(
                    color: colors.accent,
                  ),
                ),
                error: (_, _) => _BlockerCard(
                  title: l.categoriesUnavailable,
                  message: l.categoriesUnavailableMessage,
                  buttonLabel: l.backToDashboard,
                  onPressed: () => context.go('/supplier'),
                ),
              );
            },
            loading: () => Center(
              child: CircularProgressIndicator(color: colors.accent),
            ),
            error: (_, _) => _BlockerCard(
              title: l.profileLoadError,
              message: l.profileLoadErrorMessage,
              buttonLabel: l.goToProfile,
              onPressed: () => context.go('/supplier/profile'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildForm(
    List<MaterialCategory> categories,
    pickupLocation,
    String supplierType,
  ) {
    final l = context.s;
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;
    MaterialCategory? selectedCategory;
    for (final category in categories) {
      if (category.id == _categoryId) {
        selectedCategory = category;
        break;
      }
    }
    final paidOtherBlocked = _isPaidOtherBlockedForCategory(selectedCategory);
    final canPublish = _canPublishListing(selectedCategory);
    final wide = MediaQuery.sizeOf(context).width >= 1100;
    final formContent = Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_createdMaterial != null) ...[
            _SuccessCard(
              material: _createdMaterial!,
              onAddAnother: _resetForm,
            ),
            const SizedBox(height: AppSpacing.xl),
          ],
          _Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SupplierFormSectionHeader(
                  icon: Icons.category_outlined,
                  title: l.categorySectionTitle,
                  subtitle: l.categorySectionSubtitle,
                ),
                const SizedBox(height: AppSpacing.lg),
                SupplierDarkDropdownField<String>(
                  label: l.broadCategory,
                  hint: l.chooseCategory,
                  value: _categoryId,
                  items: categories
                      .map(
                        (category) => DropdownMenuItem(
                          value: category.id,
                          child: Text(category.nameEn),
                        ),
                      )
                      .toList(),
                  onChanged: _onCategoryChanged,
                  validator: (value) =>
                      value == null ? l.categoryRequired : null,
                ),
                const SizedBox(height: AppSpacing.sm),
                TextButton(
                  onPressed: () => setState(
                    () =>
                        _showCategoryRequestField = !_showCategoryRequestField,
                  ),
                  child: Text(
                    _showCategoryRequestField
                        ? l.hideCategoryRequest
                        : l.cannotFindCategory,
                  ),
                ),
                if (_showCategoryRequestField) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: decorations.profileSectionPanel,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l.categoryRequest,
                          style: context.supplierSectionTitle(),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          l.categoryRequestMessage,
                          style: context.supplierBody(),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        SupplierDarkTextField(
                          controller: _requestedCategoryController,
                          label: l.requestedCategoryName,
                          hint: l.requestedCategoryHint,
                          onChanged: (_) => setState(() {}),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        SupplierDarkTextArea(
                          controller: _categoryRequestReasonController,
                          label: 'Why existing categories do not fit',
                          hint:
                              'Explain what kind of material this is and why none of the current categories work.',
                          maxLines: 4,
                          onChanged: (_) => setState(() {}),
                        ),
                        if (_categoryRequestValidationMessage() != null) ...[
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            _categoryRequestValidationMessage()!,
                            style: context.supplierBody().copyWith(
                              color: colors.error,
                            ),
                          ),
                        ],
                        const SizedBox(height: AppSpacing.sm),
                        OutlinedButton.icon(
                          onPressed: _isSubmittingCategoryRequest ||
                                  !_canSubmitCategoryRequest()
                              ? null
                              : _submitCategoryRequest,
                          icon: _isSubmittingCategoryRequest
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.send_outlined),
                          label: Text(
                            _isSubmittingCategoryRequest
                                ? l.sending
                                : l.sendCategoryRequest,
                          ),
                        ),
                        if (_categoryRequestMessage != null) ...[
                          const SizedBox(height: AppSpacing.sm),
                          _InlineInfo(message: _categoryRequestMessage!),
                        ],
                      ],
                    ),
                  ),
                ],
                if (_categoryResumeMessage != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  _InlineInfo(message: _categoryResumeMessage!),
                ],
                if (_isFree &&
                    selectedCategory?.nameEn.toLowerCase() == 'other' &&
                    !_showCategoryRequestField) ...[
                  const SizedBox(height: AppSpacing.md),
                  _InlineInfo(
                    message: l.freeOtherAllowed,
                  ),
                ],
                if (paidOtherBlocked && !_showCategoryRequestField) ...[
                  const SizedBox(height: AppSpacing.md),
                  _InlineInfo(
                    message: l.paidOtherBlockedMessage,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          _Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SupplierFormSectionHeader(
                  icon: Icons.edit_note_outlined,
                  title: l.listingSectionTitle,
                  subtitle: l.listingSectionSubtitle,
                ),
                const SizedBox(height: AppSpacing.lg),
                _MaterialTypeAutocompleteField(
                  controller: _materialNameController,
                  label: l.materialName,
                  hint: l.materialNameHint,
                  categoryId: _categoryId,
                  selectedMaterialType: _selectedMaterialType,
                  validator: _required,
                  onChanged: _onMaterialNameChanged,
                  onSelected: _selectMaterialType,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  l.materialNameHelper,
                  style: context.supplierBody().copyWith(
                    color: colors.textMuted,
                  ),
                ),
                if (!_isFree &&
                    (_selectedMaterialType == null ||
                        !_selectedMaterialType!.hasActivePriceRule)) ...[
                  const SizedBox(height: AppSpacing.sm),
                  _InlineInfo(message: l.paidListingsNeedReviewedMaterialType),
                ],
                const SupplierFieldGap(),
                SupplierDarkTextField(
                  controller: _titleController,
                  label: l.listingTitle,
                  hint: l.listingTitleHint,
                  validator: _required,
                  onChanged: (_) => setState(() {}),
                ),
                const SupplierFieldGap(),
                SupplierDarkTextArea(
                  controller: _descriptionController,
                  label: l.description,
                  hint: l.descriptionHint,
                  validator: _required,
                  maxLines: 5,
                ),
                const SupplierFieldGap(),
                SupplierDarkDropdownField<String>(
                  label: l.condition,
                  hint: l.chooseCondition,
                  value: _condition,
                  items: _conditions
                      .map(
                        (value) => DropdownMenuItem(
                          value: value,
                          child: Text(l.conditionLabel(value)),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    setState(() {
                      _condition = _createConditionValue(value);
                      _invalidatePriceCheck();
                    });
                  },
                ),
                const SupplierFieldGap(),
                SupplierDarkTextArea(
                  controller: _suggestedUsesController,
                  label: l.suggestedUses,
                  hint: l.suggestedUsesHint,
                  maxLines: 3,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          _Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SupplierFormSectionHeader(
                  icon: Icons.straighten_outlined,
                  title: l.quantityAndPricing,
                  subtitle: l.quantityPricingSubtitle,
                ),
                if (_maxAllowedUnitPrice != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  _InlineInfo(
                    message: l.maxPricePerUnitMessage(
                      _maxAllowedUnitLabel ?? _unitController.text.trim(),
                      _maxAllowedUnitPrice!.toStringAsFixed(0),
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                _ResponsiveRow(
                  children: [
                    SupplierDarkTextField(
                      controller: _quantityController,
                      label: l.quantity,
                      hint: '8',
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      validator: _positiveNumber,
                      onChanged: (_) => _invalidatePriceCheck(),
                    ),
                    SupplierDarkTextField(
                      controller: _unitController,
                      label: l.unit,
                      hint: l.unitHint,
                      validator: _required,
                      onChanged: (_) {
                        _unitEditedByUser = true;
                        _invalidatePriceCheck();
                      },
                    ),
                  ],
                ),
                const SupplierFieldGap(),
                SegmentedButton<bool>(
                  segments: [
                    ButtonSegment(value: true, label: Text(l.free)),
                    ButtonSegment(value: false, label: Text(l.paid)),
                  ],
                  selected: {_isFree},
                  onSelectionChanged: (values) {
                    setState(() {
                      _isFree = values.first;
                      _invalidatePriceCheck();
                      if (_isFree) {
                        _priceController.clear();
                      }
                    });
                  },
                ),
                if (!_isFree) ...[
                  const SupplierFieldGap(),
                  SupplierDarkTextField(
                    controller: _priceController,
                    label: l.pricePerUnit,
                    hint: '25',
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    validator: _unitPriceValidator,
                    onChanged: (_) => _invalidatePriceCheck(),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l.quantityPricingSubtitle,
                    style: context.supplierBody().copyWith(
                      fontSize: 12,
                      color: colors.textMuted,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  OutlinedButton.icon(
                    onPressed: _isCheckingPrice || paidOtherBlocked
                        ? null
                        : _verifyPrice,
                    icon: _isCheckingPrice
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.verified_outlined),
                    label: Text(l.verifyPrice),
                  ),
                ],
                if (_priceCheck != null && !paidOtherBlocked) ...[
                  const SizedBox(height: AppSpacing.md),
                  AddMaterialPriceVerificationCard(
                    result: _priceCheck!,
                    isRequestingPriceReview: _isRequestingPriceReview,
                    priceReviewMessage: _priceReviewMessage,
                    onSubmitPriceReview: _requestPriceReview,
                    onSelectSuggestion: _applySuggestion,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          MaterialImagePickerSection(
            images: _images,
            isUploading: _isUploadingImages,
            onPickImages: _pickImages,
            onRemoveImage: (index) {
              setState(() => _images.removeAt(index));
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          _Card(
            child: AddMaterialPickupSection(
              key: _pickupSectionKey,
              supplierType: supplierType,
              profilePickupLocation: pickupLocation,
              pickupAllowed: _pickupAllowed,
              deliveryAllowed: _deliveryAllowed,
              pickupNotesController: _pickupNotesController,
              onPickupAllowedChanged: (value) =>
                  setState(() => _pickupAllowed = value),
              onDeliveryAllowedChanged: (value) =>
                  setState(() => _deliveryAllowed = value),
              onChanged: () => setState(() {}),
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _isSubmitting || !canPublish ? null : _publish,
              icon: _isSubmitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.publish_outlined),
              label: Text(_isSubmitting ? l.publishing : l.publishMaterial),
            ),
          ),
          if (!_isFree && !canPublish) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              paidOtherBlocked
                  ? l.paidCannotUseOther
                  : l.paidMustVerifyPrice,
              style: context.supplierBody(),
            ),
          ],
        ],
      ),
    );

    if (!wide) {
      return formContent;
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: formContent),
        const SizedBox(width: AppSpacing.lg),
        SizedBox(
          width: 320,
          child: AddMaterialPreviewCard(
            materialName: _materialNameController.text.trim(),
            title: _titleController.text.trim(),
            category: selectedCategory,
            condition: _condition,
            quantity: _quantityController.text.trim(),
            unit: _unitController.text.trim(),
            isFree: _isFree,
            price: _priceController.text.trim(),
            pickupLabel: _pickupSectionKey.currentState?.buildPreviewPickupLabel() ??
                pickupLocation.summary,
            deliveryAllowed: _deliveryAllowed,
            coverImageUrl: _images.isEmpty ? null : _images.first.url,
            priceStatus: _previewPriceStatus(selectedCategory),
          ),
        ),
      ],
    );
  }

  Map<String, dynamic> _buildListingDraftJson(
    String requestedCategoryName, {
    List<String>? imageUrls,
  }) {
    final quantity = double.tryParse(_quantityController.text.trim()) ?? 1;
    final price = double.tryParse(_priceController.text.trim());
    final reason = _categoryRequestReasonController.text.trim();
    final categoryLabel = requestedCategoryName.trim().isEmpty
        ? 'General'
        : requestedCategoryName.trim();

    final draft = <String, dynamic>{
      'materialName': _materialNameController.text.trim(),
      'title': _titleController.text.trim(),
      'description': _descriptionController.text.trim(),
      'requestedCategoryName': categoryLabel,
      if (_categoryId != null) 'categoryId': _categoryId,
      'condition': _condition,
      'quantity': quantity,
      'unit': _unitController.text.trim().isEmpty
          ? 'piece'
          : _unitController.text.trim(),
      'isFree': _isFree,
      'currency': 'NIS',
      'pickupAllowed': _pickupAllowed,
      'deliveryAllowed': _deliveryAllowed,
      if (!_isFree && price != null) 'price': price,
      if (_pickupNotesController.text.trim().isNotEmpty)
        'pickupNotes': _pickupNotesController.text.trim(),
      if (_suggestedUsesController.text.trim().isNotEmpty)
        'suggestedUses': _suggestedUsesController.text.trim(),
      if (reason.isNotEmpty) 'categoryRequestReason': reason,
      'imageUrls': imageUrls ?? _imageUrlValues(),
      ...?_pickupSectionKey.currentState?.buildDraftPickupJson(),
    };

    if (_sourceCategoryRequestId != null) {
      draft['sourceCategoryRequestId'] = _sourceCategoryRequestId;
    }

    return draft;
  }

  List<String> _imageUrlValues() {
    return _images
        .map((image) => image.url)
        .whereType<String>()
        .toList(growable: false);
  }

  Future<List<String>> _resolveImageUrls() async {
    final pending = _images.where((image) => image.isPending).toList();
    if (pending.isEmpty) {
      return _imageUrlValues();
    }

    setState(() => _isUploadingImages = true);
    try {
      final uploaded = await uploadMaterialImages(ref, pending);
      if (uploaded.length != pending.length) {
        throw const ApiException(message: 'Image upload failed');
      }

      var uploadIndex = 0;
      final resolvedImages = <MaterialDraftImage>[];

      for (final image in _images) {
        if (image.isPending) {
          final uploadedImage = uploaded[uploadIndex++];
          resolvedImages.add(
            MaterialDraftImage.uploaded(
              url: uploadedImage.url,
              fileName: uploadedImage.filename,
              mimeType: uploadedImage.mimeType,
              sizeBytes: uploadedImage.sizeBytes,
            ),
          );
        } else {
          resolvedImages.add(image);
        }
      }

      if (!mounted) {
        return resolvedImages
            .map((image) => image.url)
            .whereType<String>()
            .toList(growable: false);
      }

      setState(() {
        _images
          ..clear()
          ..addAll(resolvedImages);
        _isUploadingImages = false;
      });

      return resolvedImages
          .map((image) => image.url)
          .whereType<String>()
          .toList(growable: false);
    } catch (error) {
      if (mounted) {
        setState(() => _isUploadingImages = false);
      }
      rethrow;
    }
  }

  Future<void> _pickImages() async {
    final picked = await MaterialImagePickerSection.pickImages(
      currentCount: _images.length,
      onError: (message) => showSupplierErrorSnackBar(context, message),
    );

    if (picked == null || picked.isEmpty || !mounted) {
      return;
    }

    setState(() => _images.addAll(picked));
  }

  bool _canSubmitCategoryRequest() => _categoryRequestValidationMessage() == null;

  String? _categoryRequestValidationMessage() {
    final materialName = _materialNameController.text.trim();
    final title = _titleController.text.trim();
    if (materialName.length < 2 && title.length < 2) {
      return 'Enter the material name before requesting a new category.';
    }

    if (_descriptionController.text.trim().length < 10) {
      return 'Describe the material so admin can review the category request.';
    }

    if (_requestedCategoryController.text.trim().isEmpty) {
      return 'Enter the requested category name.';
    }

    if (_categoryRequestReasonController.text.trim().length < 10) {
      return 'Explain why existing categories do not fit.';
    }

    final quantity = double.tryParse(_quantityController.text.trim());
    if (quantity == null || quantity <= 0) {
      return 'Enter a valid quantity for this material.';
    }

    if (_unitController.text.trim().isEmpty) {
      return 'Enter the unit for this material.';
    }

    return null;
  }

  Future<void> _submitCategoryRequest() async {
    final validationMessage = _categoryRequestValidationMessage();
    if (validationMessage != null) {
      setState(() => _showCategoryRequestField = true);
      showSupplierErrorSnackBar(context, validationMessage);
      return;
    }

    final requestedName = _requestedCategoryController.text.trim();
    setState(() => _isSubmittingCategoryRequest = true);
    try {
      final imageUrls = await _resolveImageUrls();
      final payload = CreateCategoryRequestPayload(
        requestedName: requestedName,
        listingDraftJson: _buildListingDraftJson(
          requestedName,
          imageUrls: imageUrls,
        ),
      );
      if (kDebugMode) {
        debugPrint(
          '[category-request request] POST /api/supplier/category-requests body=${payload.toJson()}',
        );
      }
      await submitCategoryRequest(ref, payload);
      if (!mounted) return;
      setState(() {
        _isSubmittingCategoryRequest = false;
        _categoryRequestMessage = context.s.categoryRequestSubmittedWithApproval;
      });
      showSupplierInfoSnackBar(
        context,
        context.s.categoryRequestSubmitted,
      );
      ref.invalidate(categoryRequestsProvider);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _isSubmittingCategoryRequest = false);
      if (kDebugMode) {
        debugPrint(
          '[category-request failed] status=${error.statusCode} code=${error.code} message=${error.message} details=${error.details}',
        );
      }
      showSupplierErrorSnackBar(context, _apiErrorMessage(error));
    } catch (error, stackTrace) {
      if (!mounted) return;
      setState(() => _isSubmittingCategoryRequest = false);
      if (kDebugMode) {
        debugPrint('[category-request failed] unexpected: $error\n$stackTrace');
      }
      showSupplierErrorSnackBar(
        context,
        'We could not upload the images. Please try again.',
      );
    }
  }

  Future<void> _maybeResumeFromRoute() async {
    if (_resumeHandled || !mounted) {
      return;
    }

    final categoryRequestId = widget.categoryRequestId?.trim();
    final priceRuleRequestId = widget.priceRuleRequestId?.trim();
    if ((categoryRequestId == null || categoryRequestId.isEmpty) &&
        (priceRuleRequestId == null || priceRuleRequestId.isEmpty)) {
      return;
    }

    _resumeHandled = true;
    setState(() {
      _isResumingDraft = true;
      _resumeError = null;
    });

    if (categoryRequestId != null && categoryRequestId.isNotEmpty) {
      await _continueCategoryRequest(categoryRequestId);
      return;
    }

    if (priceRuleRequestId != null && priceRuleRequestId.isNotEmpty) {
      await _continuePriceRuleRequest(priceRuleRequestId);
    }
  }

  void _retryResume() {
    _resumeHandled = false;
    _maybeResumeFromRoute();
  }

  void _setControllerIfEmpty(TextEditingController controller, String? value) {
    if (controller.text.trim().isNotEmpty) {
      return;
    }
    if (value == null || value.trim().isEmpty) {
      return;
    }
    controller.text = value.trim();
  }

  String? _resolveResumeCategoryId({
    required CategoryRequestDraftResponse draft,
    required Map<String, dynamic> json,
  }) {
    final approvedId = draft.approvedCategoryId ?? draft.approvedCategory?.id;
    if (approvedId != null && approvedId.trim().isNotEmpty) {
      return approvedId;
    }

    if (draft.status == 'REJECTED') {
      final suggestedId =
          draft.suggestedCategoryId ?? draft.suggestedCategory?.id;
      if (suggestedId != null && suggestedId.trim().isNotEmpty) {
        return suggestedId;
      }
    }

    final draftCategoryId = json['categoryId'] as String?;
    return draftCategoryId?.trim().isNotEmpty == true ? draftCategoryId : null;
  }

  void _applyListingDraftJson(
    Map<String, dynamic> json, {
    String? categoryId,
    String? resumeMessage,
    double? maxAllowedUnitPrice,
    String? maxAllowedUnitLabel,
    bool preserveUserInput = false,
  }) {
    final price = json['price'];
    final isFree = json['isFree'] as bool? ?? true;
    final draftMaterialName = json['materialName'] as String?;
    final draftTitle = json['title'] as String?;
    final draftDescription = json['description'] as String?;

    if (!preserveUserInput) {
      _materialNameController.text = draftMaterialName?.trim() ?? '';
      _titleController.text = draftTitle?.trim() ?? '';
      _descriptionController.text = draftDescription?.trim() ?? '';
    } else {
      _setControllerIfEmpty(_materialNameController, draftMaterialName);
      _setControllerIfEmpty(_titleController, draftTitle);
      _setControllerIfEmpty(_descriptionController, draftDescription);
    }

    _selectedMaterialType = null;

    if (!preserveUserInput || _quantityController.text.trim().isEmpty) {
      _quantityController.text = (json['quantity'] as num?)?.toString() ?? '1';
    }
    if (!preserveUserInput || !_unitEditedByUser) {
      _unitController.text = json['unit'] as String? ?? 'piece';
      _unitEditedByUser = _unitController.text.trim().isNotEmpty;
    }

    _condition = _createConditionValue(json['condition'] as String?);
    _isFree = isFree;
    if (price is num && !isFree) {
      if (!preserveUserInput || _priceController.text.trim().isEmpty) {
        _priceController.text =
            price % 1 == 0 ? price.toInt().toString() : price.toString();
      }
    } else if (isFree && !preserveUserInput) {
      _priceController.clear();
    }

    _pickupAllowed = json['pickupAllowed'] as bool? ?? true;
    _deliveryAllowed = json['deliveryAllowed'] as bool? ?? false;
    _setControllerIfEmpty(_pickupNotesController, json['pickupNotes'] as String?);
    _setControllerIfEmpty(
      _suggestedUsesController,
      json['suggestedUses'] as String?,
    );
    _setControllerIfEmpty(
      _categoryRequestReasonController,
      json['categoryRequestReason'] as String?,
    );

    if (!preserveUserInput) {
      _images
        ..clear()
        ..addAll(
          (json['imageUrls'] as List?)
                  ?.whereType<String>()
                  .map(MaterialDraftImage.fromUrl)
                  .toList() ??
              const [],
        );
      _requestedCategoryController.clear();
      _showCategoryRequestField = false;
      _categoryRequestMessage = null;
    }

    if (!_categoryManuallySelected) {
      _categoryId = categoryId ?? json['categoryId'] as String? ?? _categoryId;
    }

    _priceCheck = null;
    _priceReviewMessage = null;
    _maxAllowedUnitPrice = maxAllowedUnitPrice;
    _maxAllowedUnitLabel = maxAllowedUnitLabel ?? _unitController.text.trim();
    _categoryResumeMessage = resumeMessage;
    _pickupSectionKey.currentState?.applyDraftPickup(json);
  }

  Future<void> _continueCategoryRequest(String requestId) async {
    try {
      ref.invalidate(materialCategoriesProvider);
      final draft = await loadCategoryRequestDraft(ref, requestId);
      if (!mounted) return;

      if (draft.status == 'PENDING') {
        setState(() {
          _isResumingDraft = false;
          _resumeError =
              'Your category request is still pending admin review.';
        });
        return;
      }

      final json = draft.listingDraftJson;
      if (json == null) {
        setState(() {
          _isResumingDraft = false;
          _resumeError = context.s.savedDraftNotFound;
        });
        return;
      }

      final resolvedCategoryId = _resolveResumeCategoryId(
        draft: draft,
        json: json,
      );

      if (resolvedCategoryId != null) {
        final categories =
            await ref.read(materialCategoriesProvider.future);
        final categoryExists =
            categories.any((category) => category.id == resolvedCategoryId);
        if (!categoryExists) {
          setState(() {
            _isResumingDraft = false;
            _resumeError =
                'The selected category is no longer available. Refresh categories and choose again.';
          });
          return;
        }
      }

      final resumeMessage = _categoryResumeMessageForDraft(draft);
      final hasSavedMaterialContext =
          (json['materialName'] as String?)?.trim().isNotEmpty == true ||
          (json['title'] as String?)?.trim().isNotEmpty == true;

      setState(() {
        _applyListingDraftJson(
          json,
          categoryId: resolvedCategoryId,
          resumeMessage: hasSavedMaterialContext
              ? resumeMessage
              : 'Some material details were not saved. Please complete the missing fields.',
          preserveUserInput: _categoryManuallySelected,
        );
        _isResumingDraft = false;
        _resumeError = null;
      });

      await _restoreSelectedMaterialTypeFromDraft();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _isResumingDraft = false;
        _resumeError = _apiErrorMessage(error);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isResumingDraft = false;
        _resumeError = 'Could not load saved listing draft. Please try again.';
      });
    }
  }

  String _categoryResumeMessageForDraft(CategoryRequestDraftResponse draft) {
    final approvedName = draft.approvedCategory?.nameEn;
    if (draft.isSuggestion && approvedName != null) {
      return 'Use $approvedName for this listing.';
    }
    if (draft.status == 'REJECTED') {
      final suggestedName = draft.suggestedCategory?.nameEn;
      if (suggestedName != null && suggestedName.isNotEmpty) {
        return 'Your category request was rejected. Use $suggestedName for this listing.';
      }
      return 'Your category request was rejected. Choose an existing category and continue.';
    }
    if (draft.canContinue) {
      if (draft.requestedName.isNotEmpty) {
        return '${draft.requestedName} was approved. Continue your listing.';
      }
      return context.s.categoryApprovedContinue;
    }
    return context.s.continueEditingDraft;
  }

  Future<void> _continuePriceRuleRequest(String requestId) async {
    try {
      final draft = await loadPriceRuleRequestDraft(ref, requestId);
      if (!mounted) return;

      final json = draft.listingDraftJson;
      if (json == null) {
        setState(() {
          _isResumingDraft = false;
          _resumeError = context.s.savedDraftNotFound;
        });
        return;
      }

      final unitLabel = draft.unit ?? json['unit'] as String? ?? 'unit';
      final maxPrice = draft.maxAllowedUnitPriceNis;
      final resumeMessage = maxPrice != null
          ? 'Maximum allowed price per $unitLabel is ${maxPrice.toStringAsFixed(0)} NIS.'
          : context.s.continueListingFromDraft;

      setState(() {
        _applyListingDraftJson(
          json,
          categoryId: draft.category?.id,
          resumeMessage: resumeMessage,
          maxAllowedUnitPrice: maxPrice,
          maxAllowedUnitLabel: unitLabel,
          preserveUserInput: _categoryManuallySelected,
        );
        _isFree = false;
        _isResumingDraft = false;
        _resumeError = null;
      });

      await _restoreSelectedMaterialTypeFromDraft();

      if (mounted) {
        await _verifyPrice();
      }
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _isResumingDraft = false;
        _resumeError = _apiErrorMessage(error);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isResumingDraft = false;
        _resumeError = 'Could not load saved listing draft. Please try again.';
      });
    }
  }

  void _applySuggestion(String suggestion) {
    setState(() {
      _materialNameController.text = suggestion;
      _selectedMaterialType = null;
      _priceCheck = null;
      _priceReviewMessage = null;
    });
    _verifyPrice();
  }

  Future<void> _requestPriceReview() async {
    if (_showCategoryRequestField) {
      showSupplierErrorSnackBar(
        context,
        'Resolve the category request before submitting price review.',
      );
      return;
    }

    final categoryId = _categoryId?.trim();
    if (categoryId == null || categoryId.isEmpty) {
      showSupplierErrorSnackBar(
        context,
        'Please select a valid category before submitting price review.',
      );
      return;
    }

    final materialName = _materialNameController.text.trim();
    final title = _titleController.text.trim();
    final description = _descriptionController.text.trim();
    if (materialName.length < 2 && title.length < 2) {
      showSupplierErrorSnackBar(
        context,
        'Enter material name before submitting price review.',
      );
      return;
    }
    if (description.length < 10) {
      showSupplierErrorSnackBar(
        context,
        'Enter material description before submitting price review.',
      );
      return;
    }

    final unit = _unitController.text.trim().isEmpty
        ? 'piece'
        : _unitController.text.trim();
    final quantity = double.tryParse(_quantityController.text.trim());
    if (quantity == null || quantity <= 0) {
      showSupplierErrorSnackBar(
        context,
        'Quantity and unit are required before submitting price review.',
      );
      return;
    }

    final price = double.tryParse(_priceController.text.trim());
    if (price == null || price <= 0) {
      showSupplierErrorSnackBar(
        context,
        'Enter a valid paid price before submitting price review.',
      );
      return;
    }

    final materialTypeId =
        _selectedMaterialType?.id ??
        _priceCheck?.materialTypeId ??
        _priceCheck?.matchedReference?.id;

    if (materialTypeId == null && materialName.isEmpty) {
      showSupplierErrorSnackBar(
        context,
        'Enter a material name before submitting price review.',
      );
      return;
    }

    setState(() => _isRequestingPriceReview = true);
    try {
      final categories = await ref.read(materialCategoriesProvider.future);
      final selectedCategory = _findCategoryById(categories, categoryId);
      if (selectedCategory == null) {
        if (mounted) {
          setState(() => _isRequestingPriceReview = false);
          ref.invalidate(materialCategoriesProvider);
          showSupplierErrorSnackBar(
            context,
            'The selected category is no longer available. Refresh categories and choose again.',
          );
        }
        return;
      }

      if (kDebugMode) {
        debugPrint(
          '[price-review] categoryId=$categoryId categoryName=${selectedCategory.nameEn} '
          'materialName=$materialName title=$title categoryRequestId=$_sourceCategoryRequestId',
        );
      }

      final result = await submitPriceReview(
        ref,
        CreatePriceRuleRequest(
          materialTypeId: materialTypeId,
          materialName: materialTypeId == null ? materialName : null,
          categoryId: categoryId,
          condition: _condition,
          quantity: quantity,
          unit: unit,
          supplierPriceNis: price,
          listingDraftJson: _buildListingDraftJson(selectedCategory.nameEn),
        ),
      );
      if (!mounted) return;
      setState(() {
        _isRequestingPriceReview = false;
        _priceReviewMessage =
            result.message ?? context.s.priceReviewSubmitted;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _isRequestingPriceReview = false);
      if (kDebugMode) {
        debugPrint(
          '[price-review failed] status=${error.statusCode} code=${error.code} message=${error.message}',
        );
      }
      showSupplierErrorSnackBar(context, error.displayMessage);
    } catch (error, stackTrace) {
      if (!mounted) return;
      setState(() => _isRequestingPriceReview = false);
      if (kDebugMode) {
        debugPrint('[price-review failed] unexpected: $error\n$stackTrace');
      }
      showSupplierErrorSnackBar(context, context.s.priceReviewRequestFailed);
    }
  }

  Future<void> _verifyPrice() async {
    if (_categoryId == null) {
      showSupplierErrorSnackBar(context, context.s.chooseCategoryFirst);
      return;
    }
    final materialName = _materialNameController.text.trim();
    if (materialName.isEmpty) {
      showSupplierErrorSnackBar(context, context.s.enterMaterialNameFirst);
      return;
    }
    final quantity = double.tryParse(_quantityController.text.trim());
    final price = double.tryParse(_priceController.text.trim());
    if (quantity == null || quantity <= 0 || price == null || price <= 0) {
      showSupplierErrorSnackBar(context, context.s.enterValidQuantityPrice);
      return;
    }

    final unit = _unitController.text.trim().isEmpty
        ? 'piece'
        : _unitController.text.trim();

    // If we resumed from a reviewed price request, we already have an admin-approved
    // max allowed unit price. A supplier price <= max is accepted immediately without
    // requiring a new review submission.
    if (_sourcePriceRuleRequestId != null && _maxAllowedUnitPrice != null) {
      final maxAllowed = _maxAllowedUnitPrice!;
      setState(() {
        _isCheckingPrice = false;
        _priceReviewMessage = null;
        _priceCheck = MaterialPriceCheckResult(
          allowed: price <= maxAllowed,
          reason: price <= maxAllowed ? null : 'PRICE_TOO_HIGH',
          currency: 'NIS',
          currencySymbol: '₪',
          maxAllowedPrice: maxAllowed,
          approvedUnit: _maxAllowedUnitLabel ?? unit,
          message: price <= maxAllowed
              ? 'Price accepted. Maximum allowed price is ${maxAllowed.toStringAsFixed(0)} NIS.'
              : 'The maximum allowed price is ${maxAllowed.toStringAsFixed(0)} NIS. Please enter ${maxAllowed.toStringAsFixed(0)} NIS or less.',
        );
      });
      return;
    }

    setState(() => _isCheckingPrice = true);
    try {
      final request = MaterialPriceCheckRequest(
        isFree: false,
        categoryId: _categoryId!,
        materialName: materialName,
        materialTypeId: _selectedMaterialType?.id,
        condition: _condition,
        quantity: quantity,
        unit: unit,
        price: price,
        currency: 'NIS',
      );
      if (kDebugMode) {
        debugPrint(
          '[price-check request] POST /api/materials/price-check body=${request.toJson()}',
        );
      }
      final result = await checkMaterialPrice(ref, request);
      if (!mounted) return;
      setState(() {
        _priceCheck = result;
        _isCheckingPrice = false;
        if (result.approvedUnit != null &&
            result.approvedUnit!.isNotEmpty &&
            result.reason == 'UNIT_MISMATCH') {
          _unitController.text = result.approvedUnit!;
        }
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _isCheckingPrice = false);
      if (kDebugMode) {
        debugPrint(
          '[price-check failed] status=${error.statusCode} code=${error.code} message=${error.message} details=${error.details}',
        );
      }
      showSupplierErrorSnackBar(context, _apiErrorMessage(error));
    } catch (error, stackTrace) {
      if (!mounted) return;
      setState(() => _isCheckingPrice = false);
      if (kDebugMode) {
        debugPrint('[price-check failed] unexpected: $error\n$stackTrace');
      }
      showSupplierErrorSnackBar(
        context,
        'Price verification failed: $error',
      );
    }
  }

  String _apiErrorMessage(ApiException error) {
    final details = error.details;
    if (details is Map<String, dynamic>) {
      final reason = details['reason']?.toString();
      final maxAllowed = details['maxAllowedPrice'];
      final approvedUnit = details['approvedUnit']?.toString() ?? 'piece';
      if (reason == 'PRICE_TOO_HIGH' && maxAllowed is num) {
        final max = maxAllowed.toDouble();
        return 'Maximum allowed price is ${max.toStringAsFixed(0)} NIS per $approvedUnit. Please enter ${max.toStringAsFixed(0)} NIS or less.';
      }
      if (reason == 'MATERIAL_REVIEW_REQUIRED') {
        return 'This paid material needs admin price review before publishing.';
      }
    }

    final issues = error.fieldIssues;
    if (issues.isNotEmpty) {
      return issues.map((issue) => '${issue.path}: ${issue.message}').join('\n');
    }

    final statusPrefix =
        error.statusCode != null ? '[${error.statusCode}] ' : '';
    final message = error.displayMessage.trim();

    if (message.isNotEmpty) {
      return '$statusPrefix$message';
    }

    return '${statusPrefix}Request failed.';
  }

  Future<void> _publish() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }
    if (_categoryId == null) {
      showSupplierErrorSnackBar(
        context,
        'Please select a valid category before publishing.',
      );
      return;
    }
    if (_images.isEmpty) {
      showSupplierErrorSnackBar(context, context.s.addAtLeastOneMaterialPhoto);
      return;
    }
    final quantity = double.tryParse(_quantityController.text.trim());
    if (quantity == null || quantity <= 0) return;
    final price = _isFree ? null : double.tryParse(_priceController.text.trim());
    if (!_isFree) {
      final categoriesAsync = ref.read(materialCategoriesProvider);
      final categories = categoriesAsync.hasValue
          ? categoriesAsync.value!
          : <MaterialCategory>[];
      final selectedCategory = _findCategoryById(categories, _categoryId);
      if (!_paidListingCanPublish(selectedCategory)) {
        showSupplierErrorSnackBar(
          context,
          _isPaidOtherBlockedForCategory(selectedCategory)
              ? context.s.paidCannotUseOther
              : context.s.paidMustVerifyPrice,
        );
        return;
      }
    }

    final pickupError =
        _pickupSectionKey.currentState?.validateOverrideLocation();
    if (pickupError != null) {
      showSupplierErrorSnackBar(context, pickupError);
      return;
    }
    final pickupSubmitData =
        _pickupSectionKey.currentState?.buildSubmitData() ??
        const MaterialPickupSubmitData(useDefaultPickupLocation: true);

    setState(() => _isSubmitting = true);
    List<String> imageUrls;
    try {
      imageUrls = await _resolveImageUrls();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      showSupplierErrorSnackBar(context, _apiErrorMessage(error));
      return;
    } catch (_) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      showSupplierErrorSnackBar(
        context,
        'We could not upload the images. Please try again.',
      );
      return;
    }

    try {
      final material = await ref
          .read(supplierMaterialsRepositoryProvider)
          .createMaterial(
            CreateMaterialRequest(
              materialName: _materialNameController.text.trim(),
              title: _titleController.text.trim(),
              description: _descriptionController.text.trim(),
              categoryId: _categoryId!,
              quantity: quantity,
              unit: _unitController.text.trim(),
              condition: _condition,
              isFree: _isFree,
              price: price,
              pickupAllowed: _pickupAllowed,
              deliveryAllowed: _deliveryAllowed,
              pickupNotes: _pickupNotesController.text.trim().isEmpty
                  ? null
                  : _pickupNotesController.text.trim(),
              suggestedUses: _suggestedUsesController.text.trim().isEmpty
                  ? null
                  : _suggestedUsesController.text.trim(),
              imageUrls: imageUrls,
              sourceCategoryRequestId: _sourceCategoryRequestId,
              sourcePriceRuleRequestId: _sourcePriceRuleRequestId,
              useDefaultPickupLocation: pickupSubmitData.useDefaultPickupLocation,
              pickupLocation: pickupSubmitData.pickupLocation,
            ),
          );

      ref.invalidate(supplierDashboardProvider);
      ref.invalidate(supplierNotificationsProvider);
      if (!mounted) return;
      setState(() {
        _createdMaterial = material;
        _isSubmitting = false;
      });
      showSupplierInfoSnackBar(context, context.s.materialListedSuccess);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      showSupplierErrorSnackBar(context, _apiErrorMessage(error));
    } catch (_) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      showSupplierErrorSnackBar(context, context.s.materialCouldNotBeListed);
    }
  }

  void _resetForm() {
    setState(() {
      _createdMaterial = null;
      _materialNameController.clear();
      _selectedMaterialType = null;
      _titleController.clear();
      _descriptionController.clear();
      _suggestedUsesController.clear();
      _pickupNotesController.clear();
      _quantityController.text = '1';
      _unitController.text = 'piece';
      _unitEditedByUser = false;
      _priceController.clear();
      _images.clear();
      _priceCheck = null;
      _priceReviewMessage = null;
      _isFree = true;
      _pickupAllowed = true;
      _deliveryAllowed = false;
    });
    _pickupSectionKey.currentState?.reset();
  }

  String? _required(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'This field is required';
    }
    return null;
  }

  String? _positiveNumber(String? value) {
    final parsed = double.tryParse(value?.trim() ?? '');
    if (parsed == null || parsed <= 0) {
      return 'Enter a number greater than zero';
    }
    return null;
  }

  String? _unitPriceValidator(String? value) {
    final baseValidation = _positiveNumber(value);
    if (baseValidation != null) {
      return baseValidation;
    }

    if (_maxAllowedUnitPrice == null) {
      return null;
    }

    final parsed = double.tryParse(value?.trim() ?? '');
    if (parsed != null && parsed > _maxAllowedUnitPrice!) {
      return 'Unit price must be ${_maxAllowedUnitPrice!.toStringAsFixed(0)} NIS or less.';
    }

    return null;
  }
}

class _MaterialTypeAutocompleteField extends ConsumerStatefulWidget {
  const _MaterialTypeAutocompleteField({
    required this.controller,
    required this.label,
    required this.hint,
    required this.categoryId,
    required this.selectedMaterialType,
    required this.onChanged,
    required this.onSelected,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final String? categoryId;
  final material_models.MaterialType? selectedMaterialType;
  final ValueChanged<String> onChanged;
  final ValueChanged<material_models.MaterialType> onSelected;
  final String? Function(String?)? validator;

  @override
  ConsumerState<_MaterialTypeAutocompleteField> createState() =>
      _MaterialTypeAutocompleteFieldState();
}

class _MaterialTypeAutocompleteFieldState
    extends ConsumerState<_MaterialTypeAutocompleteField> {
  static const _debounceDuration = Duration(milliseconds: 300);

  final _focusNode = FocusNode();
  Timer? _debounce;
  String _debouncedSearch = '';

  @override
  void initState() {
    super.initState();
    _debouncedSearch = widget.controller.text.trim();
    _focusNode.addListener(() => setState(() {}));
  }

  @override
  void didUpdateWidget(covariant _MaterialTypeAutocompleteField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.categoryId != widget.categoryId) {
      _debounce?.cancel();
      _debouncedSearch = widget.controller.text.trim();
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _focusNode.dispose();
    super.dispose();
  }

  void _handleChanged(String value) {
    widget.onChanged(value);
    _debounce?.cancel();
    _debounce = Timer(_debounceDuration, () {
      if (!mounted) return;
      setState(() => _debouncedSearch = value.trim());
    });
  }

  void _select(material_models.MaterialType materialType) {
    _debounce?.cancel();
    setState(() => _debouncedSearch = materialType.nameEn);
    widget.onSelected(materialType);
    _focusNode.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;
    final trimmedSearch = _debouncedSearch.trim();
    final canSearch =
        widget.categoryId != null && trimmedSearch.length >= 2;
    final searchResult = canSearch
        ? ref.watch(
            materialTypesSearchProvider(
              MaterialTypesSearchQuery(
                categoryId: widget.categoryId,
                search: trimmedSearch,
              ),
            ),
          )
        : null;
    final showPanel = _focusNode.hasFocus && canSearch;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SupplierFormLabel(label: widget.label),
        const SizedBox(height: AppSpacing.sm),
        TextFormField(
          controller: widget.controller,
          focusNode: _focusNode,
          validator: widget.validator,
          onChanged: _handleChanged,
          style: TextStyle(color: colors.textPrimary),
          decoration: decorations.formFieldDecoration(hint: widget.hint).copyWith(
            suffixIcon: widget.selectedMaterialType == null
                ? Icon(Icons.search_outlined, color: colors.textMuted)
                : Tooltip(
                    message: l.reviewedPriceAvailable,
                    child: Icon(
                      Icons.check_circle_outline,
                      color: widget.selectedMaterialType!.hasActivePriceRule
                          ? colors.accent
                          : colors.amberAccent,
                    ),
                  ),
          ),
        ),
        if (widget.categoryId == null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            l.chooseCategoryFirstToSearchReviewedMaterialTypes,
            style: context.supplierBody().copyWith(
              fontSize: 12,
              color: colors.textMuted,
            ),
          ),
        ],
        if (showPanel) ...[
          const SizedBox(height: AppSpacing.sm),
          Container(
            width: double.infinity,
            constraints: const BoxConstraints(maxHeight: 280),
            decoration: decorations.profileSectionPanel,
            child: searchResult!.when(
              data: (result) {
                if (result.items.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    child: Text(
                      l.noMaterialTypeResults,
                      style: context.supplierBody().copyWith(
                        color: colors.textMuted,
                      ),
                    ),
                  );
                }

                return ListView.separated(
                  shrinkWrap: true,
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                  itemCount: result.items.length,
                  separatorBuilder: (_, _) => Divider(
                    height: 1,
                    color: colors.border.withValues(alpha: 0.25),
                  ),
                  itemBuilder: (context, index) {
                    final item = result.items[index];
                    return _MaterialTypeOptionRow(
                      materialType: item,
                      onSelect: () => _select(item),
                    );
                  },
                );
              },
              loading: () => Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Row(
                  children: [
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: colors.accent,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(l.loading, style: context.supplierBody()),
                  ],
                ),
              ),
              error: (_, _) => Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Text(
                  l.noMaterialTypeResults,
                  style: context.supplierBody().copyWith(
                    color: colors.textMuted,
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _MaterialTypeOptionRow extends StatelessWidget {
  const _MaterialTypeOptionRow({
    required this.materialType,
    required this.onSelect,
  });

  final material_models.MaterialType materialType;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final aliasText = materialType.aliases.take(3).join(', ');
    final secondaryParts = [
      materialType.category.nameEn,
      materialType.defaultUnit,
      if (aliasText.isNotEmpty) l.materialTypeAliases(aliasText),
    ];

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => onSelect(),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    materialType.nameEn,
                    style: context.supplierLabel().copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    secondaryParts.join(' • '),
                    style: context.supplierBody().copyWith(
                      fontSize: 12,
                      color: colors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            _MaterialTypePriceRuleBadge(
              hasActivePriceRule: materialType.hasActivePriceRule,
            ),
          ],
        ),
      ),
    );
  }
}

class _MaterialTypePriceRuleBadge extends StatelessWidget {
  const _MaterialTypePriceRuleBadge({required this.hasActivePriceRule});

  final bool hasActivePriceRule;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final label = hasActivePriceRule
        ? l.reviewedPriceAvailable
        : l.noReviewedPrice;
    final color = hasActivePriceRule ? colors.accent : colors.amberAccent;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: context.supplierDecorations.badge(
        background: color.withValues(alpha: 0.16),
      ),
      child: Text(
        label,
        style: context.supplierChip().copyWith(color: color),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.policy});

  final AsyncValue<MaterialListingPolicy> policy;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final decorations = context.supplierDecorations;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: decorations.profileGlassCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.navAddMaterial, style: context.supplierDisplay()),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l.subtitleAddMaterial,
            style: context.supplierBody(),
          ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              _PolicyBadge(label: l.policyBadgeNisOnly),
              _PolicyBadge(label: l.policyBadgeFreeOther),
              _PolicyBadge(label: l.policyBadgePaidVerify),
            ],
          ),
          policy.when(
            data: (value) => Padding(
              padding: const EdgeInsets.only(top: AppSpacing.md),
              child: Text(value.message, style: context.supplierBody()),
            ),
            loading: () => const SizedBox.shrink(),
            error: (_, _) => const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}

class _PolicyBadge extends StatelessWidget {
  const _PolicyBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: decorations.badge(
        background: colors.accentSoft.withValues(alpha: 0.16),
      ),
      child: Text(label, style: context.supplierChip()),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: context.supplierDecorations.dashboardCard,
      child: child,
    );
  }
}

class _ResponsiveRow extends StatelessWidget {
  const _ResponsiveRow({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 760;
    if (!wide) {
      return Column(
        children: children
            .expand((child) => [child, const SizedBox(height: AppSpacing.md)])
            .toList()
          ..removeLast(),
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children
          .expand((child) => [
                Expanded(child: child),
                const SizedBox(width: AppSpacing.md),
              ])
          .toList()
        ..removeLast(),
    );
  }
}

class _BlockerCard extends StatelessWidget {
  const _BlockerCard({
    required this.title,
    required this.message,
    required this.buttonLabel,
    required this.onPressed,
  });

  final String title;
  final String message;
  final String buttonLabel;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: context.supplierTitle()),
          const SizedBox(height: AppSpacing.sm),
          Text(message, style: context.supplierBody()),
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton(onPressed: onPressed, child: Text(buttonLabel)),
        ],
      ),
    );
  }
}

class _ResumeErrorBanner extends StatelessWidget {
  const _ResumeErrorBanner({
    required this.message,
    required this.onRetry,
    required this.onBack,
  });

  final String message;
  final VoidCallback onRetry;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.error.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.error.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l.restoreDraftError,
            style: context.supplierTitle().copyWith(
              fontSize: 15,
              color: colors.error,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(message, style: context.supplierBody()),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              OutlinedButton(onPressed: onRetry, child: Text(l.tryAgain)),
              TextButton(onPressed: onBack, child: Text(l.backToNotifications)),
            ],
          ),
        ],
      ),
    );
  }
}

class _InlineInfo extends StatelessWidget {
  const _InlineInfo({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: context.supplierDecorations.profileSectionPanel,
      child: Text(message, style: context.supplierBody()),
    );
  }
}

class _SuccessCard extends StatelessWidget {
  const _SuccessCard({
    required this.material,
    required this.onAddAnother,
  });

  final CreatedMaterial material;
  final VoidCallback onAddAnother;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final priceLabel = material.isFree
        ? l.free
        : '₪${material.price?.toStringAsFixed(2) ?? ''}';

    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l.materialListedSuccess,
            style: context.supplierTitle().copyWith(
              color: colors.accent,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l.materialSummaryLine(
              material.title,
              material.category.nameEn,
              priceLabel,
            ),
            style: context.supplierBody(),
          ),
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton.icon(
            onPressed: onAddAnother,
            icon: const Icon(Icons.add_circle_outline),
            label: Text(l.addAnotherMaterial),
          ),
        ],
      ),
    );
  }
}
