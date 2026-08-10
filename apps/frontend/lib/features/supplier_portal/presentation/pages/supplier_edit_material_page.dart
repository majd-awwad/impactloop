import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../materials/application/material_listing_providers.dart';
import '../../../materials/data/models/material_draft_image.dart';
import '../../application/supplier_my_materials_providers.dart';
import '../../data/models/supplier_my_materials_models.dart';
import '../../data/supplier_my_materials_repository.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/material_image_picker_section.dart';
import '../widgets/materials/supplier_material_edit_helper.dart';
import '../widgets/materials/supplier_material_label_helper.dart';
import '../widgets/materials/supplier_my_materials_colors.dart';
import '../widgets/supplier_dark_form_field.dart';
import '../widgets/supplier_feedback.dart';

const _contentMaxWidth = 720.0;

const _conditions = ['NEW', 'LIKE_NEW', 'GOOD', 'NEEDS_REPAIR'];

String _editableConditionValue(String? value) {
  return value == 'USED' ? 'GOOD' : value ?? 'GOOD';
}

class SupplierEditMaterialPage extends ConsumerStatefulWidget {
  const SupplierEditMaterialPage({super.key, required this.materialId});

  final String materialId;

  @override
  ConsumerState<SupplierEditMaterialPage> createState() =>
      _SupplierEditMaterialPageState();
}

class _SupplierEditMaterialPageState
    extends ConsumerState<SupplierEditMaterialPage> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _quantityController = TextEditingController();
  final _unitController = TextEditingController();
  final _pickupNotesController = TextEditingController();
  final _suggestedUsesController = TextEditingController();

  final List<MaterialDraftImage> _images = [];
  String _condition = 'GOOD';
  bool _pickupAllowed = true;
  String? _loadedMaterialId;
  bool _saving = false;
  bool _isUploadingImages = false;

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _quantityController.dispose();
    _unitController.dispose();
    _pickupNotesController.dispose();
    _suggestedUsesController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant SupplierEditMaterialPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.materialId != widget.materialId) {
      _loadedMaterialId = null;
      _images.clear();
    }
  }

  void _bindMaterialToForm(SupplierMyMaterial material) {
    if (_loadedMaterialId == material.id) {
      return;
    }

    _loadedMaterialId = material.id;
    _titleController.text = material.title;
    _descriptionController.text = material.description;
    _quantityController.text = _formatQuantity(material.quantity);
    _unitController.text = material.unit;
    _condition = _editableConditionValue(material.condition);
    _pickupAllowed = material.pickupAllowed;
    _pickupNotesController.text = material.pickupNotes ?? '';
    _suggestedUsesController.text = material.suggestedUses ?? '';

    final sortedImages = [...material.images]
      ..sort((a, b) {
        if (a.isCover != b.isCover) {
          return a.isCover ? -1 : 1;
        }
        return a.sortOrder.compareTo(b.sortOrder);
      });

    _images
      ..clear()
      ..addAll(
        sortedImages
            .where((image) => image.imageUrl.trim().isNotEmpty)
            .map((image) => MaterialDraftImage.fromUrl(image.imageUrl)),
      );
  }

  String _formatQuantity(double quantity) {
    if (quantity == quantity.roundToDouble()) {
      return quantity.toInt().toString();
    }
    return quantity.toString();
  }

  void _goBack() {
    context.popOrGo('/supplier/materials');
  }

  Future<void> _pickImages() async {
    if (_saving || _isUploadingImages) {
      return;
    }

    final picked = await MaterialImagePickerSection.pickImages(
      currentCount: _images.length,
      l: context.s,
      onError: (message) => showSupplierErrorSnackBar(context, message),
    );

    if (picked == null || picked.isEmpty || !mounted) {
      return;
    }

    setState(() => _images.addAll(picked));
  }

  void _removeImage(int index) {
    if (_saving || _isUploadingImages) {
      return;
    }
    if (_images.length <= 1) {
      showSupplierErrorSnackBar(context, context.s.addAtLeastOneMaterialPhoto);
      return;
    }
    setState(() => _images.removeAt(index));
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

    final uploadFailedMessage = context.s.imageUploadFailed;
    setState(() => _isUploadingImages = true);
    try {
      final uploaded = await uploadMaterialImages(ref, pending);
      if (uploaded.length != pending.length) {
        throw ApiException(message: uploadFailedMessage);
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

  Future<void> _save() async {
    if (_saving || _isUploadingImages || !_formKey.currentState!.validate()) {
      return;
    }

    if (_images.isEmpty) {
      showSupplierErrorSnackBar(context, context.s.addAtLeastOneMaterialPhoto);
      return;
    }

    final quantity = double.tryParse(_quantityController.text.trim());
    if (quantity == null || quantity <= 0) {
      return;
    }

    setState(() => _saving = true);

    final pickupNotes = _pickupNotesController.text.trim();
    final suggestedUses = _suggestedUsesController.text.trim();

    try {
      final imageUrls = await _resolveImageUrls();
      if (imageUrls.isEmpty) {
        if (mounted) {
          showSupplierErrorSnackBar(
            context,
            context.s.addAtLeastOneMaterialPhoto,
          );
        }
        return;
      }

      final request = UpdateSupplierMyMaterialRequest(
        title: _titleController.text.trim(),
        description: _descriptionController.text.trim(),
        quantity: quantity,
        unit: _unitController.text.trim(),
        condition: _condition,
        pickupAllowed: _pickupAllowed,
        deliveryAllowed: false,
        pickupNotes: pickupNotes.isEmpty ? null : pickupNotes,
        suggestedUses: suggestedUses.isEmpty ? null : suggestedUses,
        imageUrls: imageUrls,
      );

      await ref
          .read(supplierMyMaterialsRepositoryProvider)
          .updateMaterial(widget.materialId, request);

      if (!mounted) {
        return;
      }

      invalidateSupplierMyMaterials(ref);
      ref.invalidate(supplierMyMaterialByIdProvider(widget.materialId));
      showSupplierInfoSnackBar(context, context.s.materialUpdatedSuccess);
      context.popOrGo('/supplier/materials');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      showSupplierErrorSnackBar(
        context,
        localizedApiErrorMessage(error, context.l10n),
      );
    } catch (_) {
      if (!mounted) {
        return;
      }
      showSupplierErrorSnackBar(context, context.s.materialUpdateFailed);
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final materialAsync = ref.watch(
      supplierMyMaterialByIdProvider(widget.materialId),
    );

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _contentMaxWidth),
        child: materialAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(AppSpacing.xl),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (error, _) {
            final message = error is ApiException
                ? localizedApiErrorMessage(error, context.l10n)
                : l.myMaterialsLoadError;

            return Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                children: [
                  Text(message, textAlign: TextAlign.center),
                  const SizedBox(height: AppSpacing.md),
                  FilledButton(
                    onPressed: () {
                      ref.invalidate(
                        supplierMyMaterialByIdProvider(widget.materialId),
                      );
                    },
                    child: Text(l.tryAgain),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  OutlinedButton(
                    onPressed: _goBack,
                    child: Text(l.backToMyMaterials),
                  ),
                ],
              ),
            );
          },
          data: (material) {
            _bindMaterialToForm(material);

            if (!material.canEdit) {
              return Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      l.editMaterialBlockedTitle,
                      style: context.supplierSectionTitle(),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      supplierMaterialEditBlockedMessage(
                        l,
                        material.editBlockedReason,
                      ),
                      style: context.supplierBody(),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    OutlinedButton(
                      onPressed: _goBack,
                      child: Text(l.backToMyMaterials),
                    ),
                  ],
                ),
              );
            }

            final isArabic = l.isArabic;
            final category = isArabic
                ? material.category.nameAr
                : material.category.nameEn;
            final priceLabel = SupplierMaterialLabelHelper.priceText(
              isFree: material.isFree,
              price: material.price,
              currency: material.currency,
              l10n: context.l10n,
            );
            final locationLabel = SupplierMaterialLabelHelper.resolveText(
              SupplierMaterialLabelHelper.locationLabel(
                city: material.location.city,
                area: material.location.area,
              ),
              isArabic,
            );
            final busy = _saving || _isUploadingImages;

            return SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    MaterialImagePickerSection(
                      images: _images,
                      isUploading: busy,
                      minImages: 1,
                      onPickImages: _pickImages,
                      onRemoveImage: _removeImage,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    SupplierDarkTextField(
                      controller: _titleController,
                      label: l.materialName,
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return l.required;
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SupplierDarkTextArea(
                      controller: _descriptionController,
                      label: l.description,
                      hint: l.descriptionHint,
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return l.required;
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: SupplierDarkTextField(
                            controller: _quantityController,
                            label: l.quantity,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            validator: (value) {
                              final parsed = double.tryParse(
                                value?.trim() ?? '',
                              );
                              if (parsed == null || parsed <= 0) {
                                return l.enterValidQuantityPrice;
                              }
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: SupplierDarkTextField(
                            controller: _unitController,
                            label: l.unit,
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return l.required;
                              }
                              return null;
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SupplierDarkDropdownField<String>(
                      label: l.condition,
                      hint: l.condition,
                      value: _condition,
                      items: _conditions
                          .map(
                            (value) => DropdownMenuItem(
                              value: value,
                              child: Text(l.conditionLabel(value)),
                            ),
                          )
                          .toList(growable: false),
                      onChanged: (value) {
                        if (busy || value == null) {
                          return;
                        }
                        setState(() => _condition = value);
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(l.pickupAllowed),
                      subtitle: Text(l.pickupAllowedSubtitle),
                      value: _pickupAllowed,
                      onChanged: busy
                          ? null
                          : (value) => setState(() => _pickupAllowed = value),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SupplierDarkTextField(
                      controller: _pickupNotesController,
                      label: l.pickupNotesLabel,
                      hint: l.pickupNotesHint,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SupplierDarkTextField(
                      controller: _suggestedUsesController,
                      label: l.suggestedUsesLabel,
                      hint: l.suggestedUsesHint,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                      l.readOnlyLabel,
                      style: context.supplierSectionTitle(),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    _ReadOnlyRow(label: l.filterCategory, value: category),
                    if (material.materialType != null &&
                        material.materialType!.trim().isNotEmpty)
                      _ReadOnlyRow(
                        label: l.materialTypeLabel,
                        value: material.materialType!,
                      ),
                    _ReadOnlyRow(label: l.price, value: priceLabel),
                    _ReadOnlyRow(label: l.pickupLocation, value: locationLabel),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      l.editMaterialReadOnlyHelper,
                      style: context.supplierBody().copyWith(
                        color: context.supplierColors.textMuted,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Row(
                      children: [
                        OutlinedButton(
                          onPressed: busy ? null : _goBack,
                          style: SupplierMyMaterialsColors.editButtonStyle(
                            context,
                          ),
                          child: Text(l.cancel),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        FilledButton(
                          onPressed: busy ? null : _save,
                          style: AppStatusButtonStyle.filled(
                            context,
                            AppStatusTone.primary,
                          ),
                          child: busy
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : Text(l.saveChanges),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _ReadOnlyRow extends StatelessWidget {
  const _ReadOnlyRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: context.supplierBody()),
          ),
          Expanded(child: Text(value, style: context.supplierSectionTitle())),
        ],
      ),
    );
  }
}
