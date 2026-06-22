import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/errors/api_exception.dart';
import '../../application/supplier_my_materials_providers.dart';
import '../../data/models/supplier_my_materials_models.dart';
import '../../data/supplier_my_materials_repository.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/materials/supplier_material_label_helper.dart';
import '../widgets/materials/supplier_my_materials_colors.dart';
import '../widgets/supplier_dark_form_field.dart';
import '../widgets/supplier_feedback.dart';

const _contentMaxWidth = 720.0;

const _conditions = [
  'NEW',
  'LIKE_NEW',
  'GOOD',
  'USED',
  'NEEDS_REPAIR',
];

class SupplierEditMaterialPage extends ConsumerStatefulWidget {
  const SupplierEditMaterialPage({
    super.key,
    required this.materialId,
  });

  final String materialId;

  @override
  ConsumerState<SupplierEditMaterialPage> createState() =>
      _SupplierEditMaterialPageState();
}

class _SupplierEditMaterialPageState extends ConsumerState<SupplierEditMaterialPage> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _quantityController = TextEditingController();
  final _unitController = TextEditingController();
  final _pickupNotesController = TextEditingController();
  final _suggestedUsesController = TextEditingController();

  String _condition = 'GOOD';
  bool _pickupAllowed = true;
  bool _deliveryAllowed = false;
  String? _loadedMaterialId;
  bool _saving = false;

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
    _condition = material.condition;
    _pickupAllowed = material.pickupAllowed;
    _deliveryAllowed = material.deliveryAllowed;
    _pickupNotesController.text = material.pickupNotes ?? '';
    _suggestedUsesController.text = material.suggestedUses ?? '';
  }

  String _formatQuantity(double quantity) {
    if (quantity == quantity.roundToDouble()) {
      return quantity.toInt().toString();
    }
    return quantity.toString();
  }

  void _goBack() {
    if (context.canPop()) {
      context.pop();
      return;
    }
    context.go('/supplier/materials');
  }

  Future<void> _save() async {
    if (_saving || !_formKey.currentState!.validate()) {
      return;
    }

    final quantity = double.tryParse(_quantityController.text.trim());
    if (quantity == null || quantity <= 0) {
      return;
    }

    setState(() => _saving = true);

    final pickupNotes = _pickupNotesController.text.trim();
    final suggestedUses = _suggestedUsesController.text.trim();

    final request = UpdateSupplierMyMaterialRequest(
      title: _titleController.text.trim(),
      description: _descriptionController.text.trim(),
      quantity: quantity,
      unit: _unitController.text.trim(),
      condition: _condition,
      pickupAllowed: _pickupAllowed,
      deliveryAllowed: _deliveryAllowed,
      pickupNotes: pickupNotes.isEmpty ? null : pickupNotes,
      suggestedUses: suggestedUses.isEmpty ? null : suggestedUses,
    );

    try {
      await ref
          .read(supplierMyMaterialsRepositoryProvider)
          .updateMaterial(widget.materialId, request);

      if (!mounted) {
        return;
      }

      invalidateSupplierMyMaterials(ref);
      ref.invalidate(supplierMyMaterialByIdProvider(widget.materialId));
      showSupplierInfoSnackBar(context, context.s.materialUpdatedSuccess);
      context.go('/supplier/materials');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      showSupplierErrorSnackBar(context, error.message);
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
    final materialAsync =
        ref.watch(supplierMyMaterialByIdProvider(widget.materialId));

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
                ? error.message
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

            final isArabic = l.isArabic;
            final category =
                isArabic ? material.category.nameAr : material.category.nameEn;
            final priceLabel = SupplierMaterialLabelHelper.resolveText(
              SupplierMaterialLabelHelper.priceLabel(
                isFree: material.isFree,
                price: material.price,
                currency: material.currency,
              ),
              isArabic,
            );
            final locationLabel = SupplierMaterialLabelHelper.resolveText(
              SupplierMaterialLabelHelper.locationLabel(
                city: material.location.city,
                area: material.location.area,
              ),
              isArabic,
            );
            final coverUrl = material.coverImageUrl == null
                ? null
                : ApiConfig.resolveMediaUrl(material.coverImageUrl!);

            return SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
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
                              final parsed =
                                  double.tryParse(value?.trim() ?? '');
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
                        if (value != null) {
                          setState(() => _condition = value);
                        }
                      },
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(l.pickupAllowed),
                      subtitle: Text(l.pickupAllowedSubtitle),
                      value: _pickupAllowed,
                      onChanged: (value) =>
                          setState(() => _pickupAllowed = value),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(l.deliveryAllowed),
                      subtitle: Text(l.deliveryAllowedSubtitle),
                      value: _deliveryAllowed,
                      onChanged: (value) =>
                          setState(() => _deliveryAllowed = value),
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
                    Text(l.readOnlyLabel, style: context.supplierSectionTitle()),
                    const SizedBox(height: AppSpacing.sm),
                    if (coverUrl != null) ...[
                      ClipRRect(
                        borderRadius: AppRadius.lgAll,
                        child: SizedBox(
                          height: 140,
                          width: double.infinity,
                          child: Image.network(
                            coverUrl,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => Container(
                              color: context.supplierColors.chipUnselected,
                              alignment: Alignment.center,
                              child: Icon(
                                Icons.image_outlined,
                                color: context.supplierColors.textMuted,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                    ],
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
                          onPressed: _saving ? null : _goBack,
                          style: SupplierMyMaterialsColors.editButtonStyle(
                            context,
                          ),
                          child: Text(l.cancel),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        FilledButton(
                          onPressed: _saving ? null : _save,
                          style: SupplierMyMaterialsColors.manageButtonStyle(
                            context,
                          ),
                          child: _saving
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
