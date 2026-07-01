import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../core/config/api_config.dart';
import '../../../data/models/supplier_my_materials_models.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_material_card.dart';
import 'supplier_material_label_helper.dart';
import 'supplier_my_materials_colors.dart';

class SupplierMaterialsGrid extends StatelessWidget {
  const SupplierMaterialsGrid({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
  });

  final int itemCount;
  final Widget Function(BuildContext context, int index) itemBuilder;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth.isFinite && constraints.maxWidth > 0
            ? constraints.maxWidth
            : MediaQuery.sizeOf(context).width;
        var columns = 1;

        if (width >= 1100) {
          columns = 3;
        } else if (width >= AppSpacing.supplierLayoutBreakpoint) {
          columns = 2;
        }

        final itemWidth = (width - ((columns - 1) * AppSpacing.md)) / columns;

        return Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.md,
          children: List.generate(itemCount, (index) {
            return SizedBox(
              width: itemWidth,
              child: itemBuilder(context, index),
            );
          }),
        );
      },
    );
  }
}

class SupplierMaterialCardSkeleton extends StatelessWidget {
  const SupplierMaterialCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      height: supplierMaterialCardHeight,
      decoration: BoxDecoration(
        color: colors.surfaceSolid.withValues(alpha: colors.isDark ? 0.5 : 0.85),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border.withValues(alpha: 0.35)),
      ),
    );
  }
}

Widget buildSupplierMaterialCard({
  required BuildContext context,
  required SupplierMyMaterial material,
  required bool isArabic,
  VoidCallback? onTap,
  List<Widget>? actions,
  String? createdAtLabel,
}) {
  final condition = SupplierMaterialLabelHelper.conditionMeta(material.condition);
  final status = SupplierMaterialLabelHelper.statusMeta(material.status);
  final category =
      isArabic ? material.category.nameAr : material.category.nameEn;
  final imageUrl = material.coverImageUrl == null
      ? null
      : ApiConfig.resolveMediaUrl(material.coverImageUrl!);

  return SupplierMaterialCard(
    title: material.title,
    description: material.description,
    categoryLabel: category,
    conditionLabel:
        SupplierMaterialLabelHelper.resolveText(condition.label, isArabic),
    conditionTone: condition.tone,
    statusLabel: SupplierMaterialLabelHelper.resolveText(status.label, isArabic),
    statusTone: status.tone,
    quantityLabel: SupplierMaterialLabelHelper.resolveText(
      SupplierMaterialLabelHelper.quantityLabel(
        material.quantity,
        material.unit,
      ),
      isArabic,
    ),
    priceLabel: SupplierMaterialLabelHelper.resolveText(
      SupplierMaterialLabelHelper.priceLabel(
        isFree: material.isFree,
        price: material.price,
        currency: material.currency,
      ),
      isArabic,
    ),
    locationLabel: SupplierMaterialLabelHelper.resolveText(
      SupplierMaterialLabelHelper.locationLabel(
        city: material.location.city,
        area: material.location.area,
      ),
      isArabic,
    ),
    availabilityLabel: SupplierMaterialLabelHelper.resolveText(
      SupplierMaterialLabelHelper.availabilityLabel(
        pickupAllowed: material.pickupAllowed,
        deliveryAvailable: material.deliveryAllowed,
      ),
      isArabic,
    ),
    deliveryAvailable: material.deliveryAllowed,
    isFree: material.isFree,
    imageUrl: imageUrl,
    viewsCount: material.viewsCount,
    likesCount: material.likesCount,
    createdAtLabel: createdAtLabel,
    onTap: onTap,
    actions: actions,
  );
}

List<Widget> buildSupplierMaterialCardActions({
  required BuildContext context,
  required VoidCallback onManage,
  required VoidCallback onEdit,
  required String manageLabel,
  required String editLabel,
  VoidCallback? onDelete,
  String? deleteLabel,
  String? deleteBlockedMessage,
  bool canDelete = false,
  bool canEdit = true,
  String? editBlockedMessage,
}) {
  final actions = <Widget>[
    FilledButton(
      onPressed: onManage,
      style: SupplierMyMaterialsColors.manageButtonStyle(context),
      child: Text(manageLabel),
    ),
    Tooltip(
      message: canEdit ? '' : (editBlockedMessage ?? ''),
      child: OutlinedButton(
        onPressed: canEdit ? onEdit : null,
        style: SupplierMyMaterialsColors.editButtonStyle(
          context,
          enabled: canEdit,
        ),
        child: Text(editLabel),
      ),
    ),
  ];

  if (deleteLabel != null) {
    actions.add(
      Tooltip(
        message: canDelete ? '' : (deleteBlockedMessage ?? ''),
        child: OutlinedButton(
          onPressed: canDelete ? onDelete : null,
          style: SupplierMyMaterialsColors.deleteButtonStyle(
            context,
            enabled: canDelete,
          ),
          child: Text(deleteLabel),
        ),
      ),
    );
  }

  return actions;
}
