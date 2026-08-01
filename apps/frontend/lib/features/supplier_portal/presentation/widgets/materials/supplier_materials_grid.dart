import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_theme_colors.dart';
import '../../../../../core/config/api_config.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
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

        if (width >= 1180) {
          columns = 3;
        } else if (width >= 760) {
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
    final colors = AppThemeColors.of(context);

    return Container(
      height: supplierMaterialCardHeight,
      decoration: BoxDecoration(
        color: colors.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
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
  final condition = SupplierMaterialLabelHelper.conditionMeta(
    material.condition,
  );
  final status = SupplierMaterialLabelHelper.statusMeta(material.status);
  final category = isArabic
      ? material.category.nameAr
      : material.category.nameEn;
  final imageUrl = material.coverImageUrl == null
      ? null
      : ApiConfig.resolveMediaUrl(material.coverImageUrl!);
  final compactBadges = <String>[];
  if (material.totalActiveRequests > 0) {
    compactBadges.add(
      context.s.materialRequestsBadge(material.totalActiveRequests),
    );
  }
  if (material.demandScorePercent > 0) {
    compactBadges.add(context.s.highDemandBadge);
  }

  final engagementParts = <String>[
    if (material.viewsCount > 0) '${material.viewsCount} views',
    if (material.likesCount > 0) '${material.likesCount} likes',
  ];

  return SupplierMaterialCard(
    title: material.title,
    categoryLabel: category,
    conditionLabel: SupplierMaterialLabelHelper.resolveText(
      condition.label,
      isArabic,
    ),
    conditionTone: condition.tone,
    statusLabel: SupplierMaterialLabelHelper.resolveText(
      status.label,
      isArabic,
    ),
    statusTone: status.tone,
    quantityLabel: SupplierMaterialLabelHelper.resolveText(
      SupplierMaterialLabelHelper.stockLabel(
        quantity: material.quantity,
        availableQuantity: material.availableQuantity ?? material.quantity,
        unit: material.unit,
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
    isFree: material.isFree,
    imageUrl: imageUrl,
    engagementLabel: engagementParts.isEmpty
        ? null
        : engagementParts.join(' · '),
    compactBadgeLabels: compactBadges,
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
  const actionSize = 44.0;
  ButtonStyle squareActionStyle(ButtonStyle base) => base.copyWith(
    fixedSize: const WidgetStatePropertyAll(Size.square(actionSize)),
    minimumSize: const WidgetStatePropertyAll(Size.square(actionSize)),
    maximumSize: const WidgetStatePropertyAll(Size.square(actionSize)),
    padding: const WidgetStatePropertyAll(EdgeInsets.zero),
    alignment: Alignment.center,
    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
  );

  final actions = <Widget>[
    Tooltip(
      message: manageLabel,
      child: SizedBox(
        height: actionSize,
        child: FilledButton(
          onPressed: onManage,
          style: AppStatusButtonStyle.filled(context, AppStatusTone.primary),
          child: Text(manageLabel),
        ),
      ),
    ),
    Tooltip(
      message: canEdit ? editLabel : (editBlockedMessage ?? editLabel),
      child: Semantics(
        label: editLabel,
        button: true,
        child: SizedBox.square(
          dimension: actionSize,
          child: OutlinedButton(
            onPressed: canEdit ? onEdit : null,
            style: squareActionStyle(
              SupplierMyMaterialsColors.editButtonStyle(
                context,
                enabled: canEdit,
              ),
            ),
            child: const Icon(Icons.edit_outlined, size: 20),
          ),
        ),
      ),
    ),
  ];

  if (deleteLabel != null) {
    actions.add(
      Tooltip(
        message: canDelete
            ? deleteLabel
            : (deleteBlockedMessage ?? deleteLabel),
        child: Semantics(
          label: deleteLabel,
          button: true,
          child: SizedBox.square(
            dimension: actionSize,
            child: OutlinedButton(
              onPressed: canDelete ? onDelete : null,
              style: squareActionStyle(
                SupplierMyMaterialsColors.deleteButtonStyle(
                  context,
                  enabled: canDelete,
                ),
              ),
              child: const Icon(Icons.delete_outline, size: 20),
            ),
          ),
        ),
      ),
    );
  }

  return actions;
}
