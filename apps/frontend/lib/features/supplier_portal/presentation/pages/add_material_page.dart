import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../materials/application/material_listing_providers.dart';
import '../../../materials/data/models/category.dart';
import '../../../materials/data/models/create_material_request.dart';
import '../../../materials/data/models/created_material.dart';
import '../../../materials/data/models/material_listing_policy.dart';
import '../../../materials/data/models/material_price_check_request.dart';
import '../../../materials/data/models/category_request.dart';
import '../../../materials/data/models/material_draft_image.dart';
import '../../../materials/data/models/material_price_check_result.dart';
import '../../../materials/data/models/price_rule_request.dart';
import '../../data/supplier_materials_repository.dart';
import '../controllers/supplier_dashboard_providers.dart';
import '../controllers/supplier_profile_providers.dart';
import '../widgets/add_material_preview_card.dart';
import '../widgets/add_material_price_verification_card.dart';
import '../widgets/category_requests_panel.dart';
import '../widgets/material_image_picker_section.dart';
import '../widgets/supplier_dark_form_field.dart';
import '../widgets/supplier_feedback.dart';
import '../widgets/supplier_pickup_map_preview.dart';

const _conditions = [
  'NEW',
  'LIKE_NEW',
  'GOOD',
  'USED',
  'NEEDS_REPAIR',
];

const _sourceTypes = [
  'STUDENT_LEFTOVER',
  'WORKSHOP_SURPLUS',
  'FACTORY_SURPLUS',
  'EDUCATIONAL_INSTITUTION',
];

class AddMaterialPage extends ConsumerStatefulWidget {
  const AddMaterialPage({super.key});

  @override
  ConsumerState<AddMaterialPage> createState() => _AddMaterialPageState();
}

class _AddMaterialPageState extends ConsumerState<AddMaterialPage> {
  final _formKey = GlobalKey<FormState>();
  final _materialNameController = TextEditingController();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _suggestedUsesController = TextEditingController();
  final _pickupNotesController = TextEditingController();
  final _quantityController = TextEditingController(text: '1');
  final _unitController = TextEditingController(text: 'piece');
  final _priceController = TextEditingController();
  final _requestedCategoryController = TextEditingController();

  String? _categoryId;
  String _condition = 'USED';
  String _sourceType = 'STUDENT_LEFTOVER';
  bool _isFree = true;
  bool _pickupAllowed = true;
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
  final List<MaterialDraftImage> _images = [];

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
    super.dispose();
  }

  void _invalidatePriceCheck() {
    setState(() {
      _priceCheck = null;
      _priceReviewMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(supplierProfileProvider);
    final categories = ref.watch(materialCategoriesProvider);
    final policy = ref.watch(materialListingPolicyProvider);
    final categoryRequests = ref.watch(categoryRequestsProvider);
    final compact = MediaQuery.sizeOf(context).width <
        AppSpacing.supplierLayoutBreakpoint;

    return SingleChildScrollView(
      padding: SupplierDecorations.pagePadding(compact: compact),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Header(policy: policy),
          const SizedBox(height: AppSpacing.lg),
          categoryRequests.when(
            data: (requests) => CategoryRequestsPanel(
              requests: requests,
              onContinue: _continueCategoryRequest,
            ),
            loading: () => const SizedBox.shrink(),
            error: (_, _) => const SizedBox.shrink(),
          ),
          const SizedBox(height: AppSpacing.xl),
          profile.when(
            data: (profile) {
              if (!profile.hasSupplierProfile || profile.supplier == null) {
                return _BlockerCard(
                  title: 'Complete your supplier profile first.',
                  message:
                      'Supplier details are required before you can publish reusable materials.',
                  buttonLabel: 'Go to Supplier Profile',
                  onPressed: () => context.go('/supplier/profile'),
                );
              }

              final pickupLocation = profile.supplier!.defaultPickupLocation;
              if (pickupLocation == null) {
                return _BlockerCard(
                  title: 'Set your pickup location before listing materials.',
                  message:
                      'Pickup location comes from your Supplier Profile and is used for every material in this step.',
                  buttonLabel: 'Edit Supplier Profile',
                  onPressed: () => context.go('/supplier/profile'),
                );
              }

              return categories.when(
                data: (items) => _buildForm(items, pickupLocation),
                loading: () => const Center(
                  child: CircularProgressIndicator(
                    color: AuthDarkColors.accent,
                  ),
                ),
                error: (_, _) => _BlockerCard(
                  title: 'Material categories are unavailable.',
                  message: 'Please try again after the backend is reachable.',
                  buttonLabel: 'Back to Dashboard',
                  onPressed: () => context.go('/supplier'),
                ),
              );
            },
            loading: () => const Center(
              child: CircularProgressIndicator(color: AuthDarkColors.accent),
            ),
            error: (_, _) => _BlockerCard(
              title: 'Supplier profile could not load.',
              message: 'Please refresh or complete your profile first.',
              buttonLabel: 'Go to Supplier Profile',
              onPressed: () => context.go('/supplier/profile'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildForm(List<MaterialCategory> categories, pickupLocation) {
    MaterialCategory? selectedCategory;
    for (final category in categories) {
      if (category.id == _categoryId) {
        selectedCategory = category;
        break;
      }
    }
    final isOther = selectedCategory?.nameEn.toLowerCase() == 'other';
    final paidOtherBlocked = !_isFree && isOther;
    final paidCanPublish = _isFree || (_priceCheck?.allowed == true);
    final wide = MediaQuery.sizeOf(context).width >= 1100;

    if (_categoryId == null && categories.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _categoryId == null) {
          setState(() => _categoryId = categories.first.id);
        }
      });
    }

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
                const SupplierFormSectionHeader(
                  icon: Icons.edit_note_outlined,
                  title: 'What are you listing?',
                  subtitle: 'Describe the surplus material clearly.',
                ),
                const SizedBox(height: AppSpacing.lg),
                SupplierDarkTextField(
                  controller: _materialNameController,
                  label: 'Material name',
                  hint: 'Wax molds, Arduino Uno, fabric scraps...',
                  validator: _required,
                  onChanged: (_) {
                    setState(() {});
                    _invalidatePriceCheck();
                  },
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Use the common name of the item. We use this to verify paid listing prices.',
                  style: AuthDarkTextStyles.body(context).copyWith(
                    color: AuthDarkColors.textMuted,
                  ),
                ),
                const SupplierFieldGap(),
                SupplierDarkTextField(
                  controller: _titleController,
                  label: 'Listing title',
                  hint: 'Used wax molds - 8 pieces',
                  validator: _required,
                  onChanged: (_) => setState(() {}),
                ),
                const SupplierFieldGap(),
                SupplierDarkTextArea(
                  controller: _descriptionController,
                  label: 'Description',
                  hint: 'Describe condition, quantity, and what is included.',
                  validator: _required,
                  maxLines: 5,
                ),
                const SupplierFieldGap(),
                _ResponsiveRow(
                  children: [
                    SupplierDarkDropdownField<String>(
                      label: 'Source type',
                      hint: 'Choose source',
                      value: _sourceType,
                      items: _sourceTypes
                          .map(
                            (value) => DropdownMenuItem(
                              value: value,
                              child: Text(_label(value)),
                            ),
                          )
                          .toList(),
                      onChanged: (value) =>
                          setState(() => _sourceType = value ?? _sourceType),
                    ),
                    SupplierDarkDropdownField<String>(
                      label: 'Condition',
                      hint: 'Choose condition',
                      value: _condition,
                      items: _conditions
                          .map(
                            (value) => DropdownMenuItem(
                              value: value,
                              child: Text(_label(value)),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        setState(() {
                          _condition = value ?? _condition;
                          _invalidatePriceCheck();
                        });
                      },
                    ),
                  ],
                ),
                const SupplierFieldGap(),
                SupplierDarkTextArea(
                  controller: _suggestedUsesController,
                  label: 'Suggested uses',
                  hint: 'Candles, resin casting, craft projects.',
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
                const SupplierFormSectionHeader(
                  icon: Icons.category_outlined,
                  title: 'Category',
                  subtitle: 'Choose the closest broad category.',
                ),
                const SizedBox(height: AppSpacing.lg),
                SupplierDarkDropdownField<String>(
                  label: 'Broad category',
                  hint: 'Choose category',
                  value: _categoryId,
                  items: categories
                      .map(
                        (category) => DropdownMenuItem(
                          value: category.id,
                          child: Text(category.nameEn),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    setState(() {
                      _categoryId = value;
                      _invalidatePriceCheck();
                    });
                  },
                  validator: (value) =>
                      value == null ? 'Category is required' : null,
                ),
                const SizedBox(height: AppSpacing.sm),
                TextButton(
                  onPressed: () => setState(
                    () => _showCategoryRequestField = !_showCategoryRequestField,
                  ),
                  child: Text(
                    _showCategoryRequestField
                        ? 'Hide category request'
                        : 'Cannot find your category?',
                  ),
                ),
                if (_showCategoryRequestField) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: SupplierDecorations.profileSectionPanel,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Category request',
                          style: AuthDarkTextStyles.sectionTitle(context),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          'Send this category name to admin for approval. Your current listing form will be saved so you can continue later.',
                          style: AuthDarkTextStyles.body(context),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        SupplierDarkTextField(
                          controller: _requestedCategoryController,
                          label: 'Requested category name',
                          hint: 'Example: Candle Making Tools',
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        OutlinedButton.icon(
                          onPressed: _isSubmittingCategoryRequest
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
                                ? 'Sending...'
                                : 'Send category request',
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
                if (_isFree && isOther && !_showCategoryRequestField) ...[
                  const SizedBox(height: AppSpacing.md),
                  _InlineInfo(
                    message:
                        'Free listings may use Other when no reviewed category fits.',
                  ),
                ],
                if (paidOtherBlocked && !_showCategoryRequestField) ...[
                  const SizedBox(height: AppSpacing.md),
                  _InlineInfo(
                    message:
                        'Paid listings cannot use Other. Use Cannot find your category? to request a reviewed category first.',
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
                const SupplierFormSectionHeader(
                  icon: Icons.straighten_outlined,
                  title: 'Quantity and pricing',
                  subtitle: 'Paid materials are verified against internal price references.',
                ),
                const SizedBox(height: AppSpacing.lg),
                _ResponsiveRow(
                  children: [
                    SupplierDarkTextField(
                      controller: _quantityController,
                      label: 'Quantity',
                      hint: '8',
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      validator: _positiveNumber,
                      onChanged: (_) => _invalidatePriceCheck(),
                    ),
                    SupplierDarkTextField(
                      controller: _unitController,
                      label: 'Unit',
                      hint: 'piece',
                      validator: _required,
                      onChanged: (_) => _invalidatePriceCheck(),
                    ),
                  ],
                ),
                const SupplierFieldGap(),
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(value: true, label: Text('Free')),
                    ButtonSegment(value: false, label: Text('Paid')),
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
                    label: 'Price (₪)',
                    hint: '25',
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    validator: _positiveNumber,
                    onChanged: (_) => _invalidatePriceCheck(),
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
                    label: const Text('Verify price'),
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SupplierFormSectionHeader(
                  icon: Icons.place_outlined,
                  title: 'Pickup',
                  subtitle: 'Pickup location comes from your Supplier Profile.',
                ),
                const SizedBox(height: AppSpacing.lg),
                SupplierPickupMapPreview(
                  city: pickupLocation.city,
                  area: pickupLocation.area,
                  country: pickupLocation.country,
                  visibility: pickupLocation.visibility,
                  latitude: pickupLocation.latitude,
                  longitude: pickupLocation.longitude,
                  compact: true,
                ),
                const SizedBox(height: AppSpacing.md),
                SupplierDarkSwitchTile(
                  title: 'Pickup allowed',
                  subtitle: 'Learners can request self pickup for this material.',
                  value: _pickupAllowed,
                  onChanged: (value) => setState(() => _pickupAllowed = value),
                ),
                const SupplierFieldGap(),
                SupplierDarkSwitchTile(
                  title: 'Delivery allowed',
                  subtitle: 'Delivery workflow is coming later.',
                  value: false,
                  onChanged: (_) {},
                ),
                const SupplierFieldGap(),
                SupplierDarkTextArea(
                  controller: _pickupNotesController,
                  label: 'Pickup notes',
                  hint: 'Pickup near campus.',
                  maxLines: 3,
                ),
                const SizedBox(height: AppSpacing.md),
                OutlinedButton.icon(
                  onPressed: () => context.go('/supplier/profile'),
                  icon: const Icon(Icons.edit_location_alt_outlined),
                  label: const Text('Edit pickup location'),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _isSubmitting || !paidCanPublish ? null : _publish,
              icon: _isSubmitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.publish_outlined),
              label: Text(_isSubmitting ? 'Publishing...' : 'Publish Material'),
            ),
          ),
          if (!_isFree && !paidCanPublish) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              paidOtherBlocked
                  ? 'Paid listings cannot use Other.'
                  : 'Paid listings must pass price verification before publishing.',
              style: AuthDarkTextStyles.body(context),
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
            pickupCity: pickupLocation.city,
            coverImageUrl: _images.isEmpty ? null : _images.first.url,
            priceCheck: _priceCheck,
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

    return {
      'materialName': _materialNameController.text.trim(),
      'title': _titleController.text.trim(),
      'description': _descriptionController.text.trim(),
      'requestedCategoryName': requestedCategoryName,
      'categoryId': _categoryId,
      'condition': _condition,
      'sourceType': _sourceType,
      'quantity': quantity,
      'unit': _unitController.text.trim().isEmpty
          ? 'piece'
          : _unitController.text.trim(),
      'isFree': _isFree,
      'price': _isFree ? null : price,
      'currency': 'NIS',
      'pickupAllowed': _pickupAllowed,
      'deliveryAllowed': false,
      'pickupNotes': _pickupNotesController.text.trim().isEmpty
          ? null
          : _pickupNotesController.text.trim(),
      'suggestedUses': _suggestedUsesController.text.trim().isEmpty
          ? null
          : _suggestedUsesController.text.trim(),
      'imageUrls': imageUrls ?? _imageUrlValues(),
    };
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

  Future<void> _submitCategoryRequest() async {
    final requestedName = _requestedCategoryController.text.trim();
    if (requestedName.isEmpty) {
      setState(() => _showCategoryRequestField = true);
      showSupplierErrorSnackBar(
        context,
        'Enter the category name you want to request.',
      );
      return;
    }

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
        _categoryRequestMessage =
            'Category request submitted. Your listing draft was saved. You can continue after admin approval.';
      });
      showSupplierInfoSnackBar(
        context,
        'Category request submitted. Your listing draft was saved.',
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

  Future<void> _continueCategoryRequest(String requestId) async {
    try {
      final draft = await loadCategoryRequestDraft(ref, requestId);
      if (!mounted) return;

      final json = draft.listingDraftJson;
      if (json == null) {
        showSupplierErrorSnackBar(context, 'Saved listing draft was not found.');
        return;
      }

      setState(() {
        _materialNameController.text = json['materialName'] as String? ?? '';
        _titleController.text = json['title'] as String? ?? '';
        _descriptionController.text = json['description'] as String? ?? '';
        _condition = json['condition'] as String? ?? _condition;
        _sourceType = json['sourceType'] as String? ?? _sourceType;
        _quantityController.text =
            (json['quantity'] as num?)?.toString() ?? '1';
        _unitController.text = json['unit'] as String? ?? 'piece';
        _isFree = json['isFree'] as bool? ?? true;
        final price = json['price'];
        if (price is num && !_isFree) {
          _priceController.text = price % 1 == 0
              ? price.toInt().toString()
              : price.toString();
        } else if (_isFree) {
          _priceController.clear();
        }
        _pickupAllowed = json['pickupAllowed'] as bool? ?? true;
        _pickupNotesController.text = json['pickupNotes'] as String? ?? '';
        _suggestedUsesController.text = json['suggestedUses'] as String? ?? '';
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
        _categoryId = draft.approvedCategory?.id ?? _categoryId;
        _priceCheck = null;
        _priceReviewMessage = null;
        _categoryResumeMessage = draft.canContinue
            ? 'Category approved. Continue your listing from where you stopped.'
            : null;
      });
    } catch (_) {
      if (!mounted) return;
      showSupplierErrorSnackBar(context, 'Could not load saved listing draft.');
    }
  }

  void _applySuggestion(String suggestion) {
    setState(() {
      _materialNameController.text = suggestion;
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
    if (_categoryId == null) {
      showSupplierErrorSnackBar(context, 'Choose a category first.');
      return;
    }

    final materialTypeId =
        _priceCheck?.materialTypeId ?? _priceCheck?.matchedReference?.id;
    final materialName = _materialNameController.text.trim();
    final unit = _unitController.text.trim().isEmpty
        ? 'piece'
        : _unitController.text.trim();
    final quantity = double.tryParse(_quantityController.text.trim());
    final price = double.tryParse(_priceController.text.trim());

    if (materialTypeId == null && materialName.isEmpty) {
      showSupplierErrorSnackBar(
        context,
        'Enter a material name before submitting price review.',
      );
      return;
    }

    setState(() => _isRequestingPriceReview = true);
    try {
      final result = await submitPriceReview(
        ref,
        CreatePriceRuleRequest(
          materialTypeId: materialTypeId,
          materialName: materialTypeId == null ? materialName : null,
          categoryId: materialTypeId == null ? _categoryId : null,
          condition: _condition,
          quantity: quantity,
          unit: unit,
          supplierPriceNis: price,
        ),
      );
      if (!mounted) return;
      setState(() {
        _isRequestingPriceReview = false;
        _priceReviewMessage = result.message ??
            'Price review submitted. A Gemini-assisted price suggestion was generated for admin review.';
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
      showSupplierErrorSnackBar(context, 'Price review request failed.');
    }
  }

  Future<void> _verifyPrice() async {
    if (_categoryId == null) {
      showSupplierErrorSnackBar(context, 'Choose a category first.');
      return;
    }
    final materialName = _materialNameController.text.trim();
    if (materialName.isEmpty) {
      showSupplierErrorSnackBar(context, 'Enter a material name first.');
      return;
    }
    final quantity = double.tryParse(_quantityController.text.trim());
    final price = double.tryParse(_priceController.text.trim());
    if (quantity == null || quantity <= 0 || price == null || price <= 0) {
      showSupplierErrorSnackBar(context, 'Enter a valid quantity and price.');
      return;
    }

    final unit = _unitController.text.trim().isEmpty
        ? 'piece'
        : _unitController.text.trim();

    setState(() => _isCheckingPrice = true);
    try {
      final request = MaterialPriceCheckRequest(
        isFree: false,
        categoryId: _categoryId!,
        materialName: materialName,
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
    if (!(_formKey.currentState?.validate() ?? false) || _categoryId == null) {
      return;
    }
    final quantity = double.tryParse(_quantityController.text.trim());
    if (quantity == null || quantity <= 0) return;
    final price = _isFree ? null : double.tryParse(_priceController.text.trim());
    if (!_isFree && _priceCheck?.allowed != true) {
      showSupplierErrorSnackBar(
        context,
        'Verify price before publishing paid listings.',
      );
      return;
    }

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
              sourceType: _sourceType,
              isFree: _isFree,
              price: price,
              pickupAllowed: _pickupAllowed,
              deliveryAllowed: false,
              pickupNotes: _pickupNotesController.text.trim().isEmpty
                  ? null
                  : _pickupNotesController.text.trim(),
              suggestedUses: _suggestedUsesController.text.trim().isEmpty
                  ? null
                  : _suggestedUsesController.text.trim(),
              imageUrls: imageUrls,
            ),
          );

      ref.invalidate(supplierDashboardProvider);
      if (!mounted) return;
      setState(() {
        _createdMaterial = material;
        _isSubmitting = false;
      });
      showSupplierInfoSnackBar(context, 'Material listed successfully.');
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      showSupplierErrorSnackBar(context, _apiErrorMessage(error));
    } catch (_) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      showSupplierErrorSnackBar(context, 'Material could not be listed.');
    }
  }

  void _resetForm() {
    setState(() {
      _createdMaterial = null;
      _materialNameController.clear();
      _titleController.clear();
      _descriptionController.clear();
      _suggestedUsesController.clear();
      _pickupNotesController.clear();
      _quantityController.text = '1';
      _unitController.text = 'piece';
      _priceController.clear();
      _images.clear();
      _priceCheck = null;
      _priceReviewMessage = null;
      _isFree = true;
    });
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

  String _label(String value) {
    return value
        .split('_')
        .map((part) => part[0] + part.substring(1).toLowerCase())
        .join(' ');
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.policy});

  final AsyncValue<MaterialListingPolicy> policy;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: SupplierDecorations.profileGlassCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Add Material', style: AuthDarkTextStyles.display(context)),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'List surplus materials for reuse by learners and makers.',
            style: AuthDarkTextStyles.body(context),
          ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: const [
              _PolicyBadge(label: 'NIS only'),
              _PolicyBadge(label: 'Free Other allowed'),
              _PolicyBadge(label: 'Paid needs price verification'),
            ],
          ),
          policy.when(
            data: (value) => Padding(
              padding: const EdgeInsets.only(top: AppSpacing.md),
              child: Text(value.message, style: AuthDarkTextStyles.body(context)),
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
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: SupplierDecorations.badge(
        background: AuthDarkColors.accentSoft.withValues(alpha: 0.16),
      ),
      child: Text(label, style: AuthDarkTextStyles.chip(context)),
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
      decoration: SupplierDecorations.dashboardCard,
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
          Text(title, style: AuthDarkTextStyles.title(context)),
          const SizedBox(height: AppSpacing.sm),
          Text(message, style: AuthDarkTextStyles.body(context)),
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton(onPressed: onPressed, child: Text(buttonLabel)),
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
      decoration: SupplierDecorations.profileSectionPanel,
      child: Text(message, style: AuthDarkTextStyles.body(context)),
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
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Material listed successfully.',
            style: AuthDarkTextStyles.title(context).copyWith(
              color: AuthDarkColors.accent,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '${material.title} • ${material.category.nameEn} • ${material.isFree ? 'Free' : '₪${material.price?.toStringAsFixed(2) ?? ''}'}',
            style: AuthDarkTextStyles.body(context),
          ),
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton.icon(
            onPressed: onAddAnother,
            icon: const Icon(Icons.add_circle_outline),
            label: const Text('Add another material'),
          ),
        ],
      ),
    );
  }
}
