import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/materials/app_material_card.dart';
import '../../../../shared/models/localized_text.dart';
import '../../domain/discovery_material.dart';
import '../material_discovery_content.dart';

int materialDiscoveryGridColumnCount(double width) {
  if (width >= 1320) {
    return 4;
  }
  if (width >= 900) {
    return 3;
  }
  if (width >= 600) {
    return 2;
  }
  return 1;
}

String? materialDiscoverySupplierDisplayName(
  DiscoveryMaterial material,
  BuildContext context,
) {
  final supplier = material.supplier;
  if (supplier != null) {
    final displayName = supplier.displayName.trim();
    if (displayName.isNotEmpty) {
      return displayName;
    }
  }

  final fallbackName = material.supplierName.resolve(context).trim();
  if (fallbackName.isNotEmpty) {
    return fallbackName;
  }

  return null;
}

VoidCallback? materialDiscoverySupplierTapHandler(
  BuildContext context,
  DiscoveryMaterial material,
) {
  final supplierId = material.supplier?.id.trim();
  if (supplierId == null || supplierId.isEmpty) {
    return null;
  }

  return () => context.go('/suppliers/$supplierId');
}

class MaterialsDiscoveryResultsGrid extends StatelessWidget {
  const MaterialsDiscoveryResultsGrid({
    super.key,
    required this.materials,
    this.cardVariant = AppMaterialCardVariant.standard,
    this.onMaterialTap,
    this.showSupplierAttribution = true,
    this.trailingBuilder,
  });

  final List<DiscoveryMaterial> materials;
  final AppMaterialCardVariant cardVariant;
  final ValueChanged<DiscoveryMaterial>? onMaterialTap;
  final bool showSupplierAttribution;
  final Widget Function(BuildContext context, DiscoveryMaterial material)?
  trailingBuilder;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        if (width < 600) {
          return ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: materials.length,
            separatorBuilder: (context, index) =>
                const SizedBox(height: AppSpacing.sm),
            itemBuilder: (context, index) {
              return _buildCompactCard(context, materials[index]);
            },
          );
        }

        final columns = materialDiscoveryGridColumnCount(width);
        final itemWidth = (width - ((columns - 1) * AppSpacing.md)) / columns;
        final effectiveCardVariant = itemWidth < 400
            ? AppMaterialCardVariant.compact
            : cardVariant;
        final includesSupplierAttribution =
            showSupplierAttribution &&
            materials.any(
              (material) =>
                  materialDiscoverySupplierDisplayName(material, context) !=
                  null,
            );
        final cardHeight = ImpactMaterialGridCard.heightForWidth(
          itemWidth,
          variant: effectiveCardVariant,
          includesSupplierAttribution: includesSupplierAttribution,
        );

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: materials.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            crossAxisSpacing: AppSpacing.md,
            mainAxisSpacing: AppSpacing.md,
            mainAxisExtent: cardHeight,
          ),
          itemBuilder: (context, index) {
            return _buildGridCard(
              context,
              materials[index],
              effectiveCardVariant: effectiveCardVariant,
            );
          },
        );
      },
    );
  }

  Widget _buildCompactCard(BuildContext context, DiscoveryMaterial material) {
    return ImpactMaterialCompactCard(
      title: material.title.resolve(context),
      description: material.description.resolve(context),
      category: material.category.resolve(context),
      conditionLabel: material.conditionLabel.resolve(context),
      conditionTone: material.conditionTone,
      statusLabel: material.statusLabel.resolve(context),
      statusTone: material.statusTone,
      quantityLabel: material.quantityLabel.resolve(context),
      priceLabel: material.priceLabel.resolve(context),
      locationLabel: material.locationLabel.resolve(context),
      availabilityLabel: material.availabilityLabel.resolve(context),
      deliveryAvailable: material.deliveryAvailable,
      isFree: material.isFree,
      gradientColors: materialGradient(material),
      imageUrl: material.imageUrl,
      ratingLabel: material.isPopular
          ? null
          : material.ratingLabel?.resolve(context),
      viewsCount: material.viewsCount,
      likesCount: material.likesCount,
      isLiked: material.isLiked,
      showPopularBadge: material.isPopular,
      fallbackIcon: material.heroIconData,
      supplierDisplayName: showSupplierAttribution
          ? materialDiscoverySupplierDisplayName(material, context)
          : null,
      supplierAvatarUrl: material.supplier?.avatarUrl,
      supplierVerified: material.supplierVerified,
      onSupplierTap: showSupplierAttribution
          ? materialDiscoverySupplierTapHandler(context, material)
          : null,
      onTap: onMaterialTap == null ? null : () => onMaterialTap!(material),
      trailing: trailingBuilder?.call(context, material),
    );
  }

  Widget _buildGridCard(
    BuildContext context,
    DiscoveryMaterial material, {
    required AppMaterialCardVariant effectiveCardVariant,
  }) {
    return ImpactMaterialGridCard(
      title: material.title.resolve(context),
      description: material.description.resolve(context),
      category: material.category.resolve(context),
      conditionLabel: material.conditionLabel.resolve(context),
      conditionTone: material.conditionTone,
      statusLabel: material.statusLabel.resolve(context),
      statusTone: material.statusTone,
      quantityLabel: material.quantityLabel.resolve(context),
      priceLabel: material.priceLabel.resolve(context),
      locationLabel: material.locationLabel.resolve(context),
      availabilityLabel: material.availabilityLabel.resolve(context),
      deliveryAvailable: material.deliveryAvailable,
      isFree: material.isFree,
      gradientColors: materialGradient(material),
      imageUrl: material.imageUrl,
      ratingLabel: material.isPopular
          ? null
          : material.ratingLabel?.resolve(context),
      viewsCount: material.viewsCount,
      likesCount: material.likesCount,
      isLiked: material.isLiked,
      showPopularBadge: material.isPopular,
      fallbackIcon: material.heroIconData,
      variant: effectiveCardVariant,
      supplierDisplayName: showSupplierAttribution
          ? materialDiscoverySupplierDisplayName(material, context)
          : null,
      supplierAvatarUrl: material.supplier?.avatarUrl,
      supplierVerified: material.supplierVerified,
      onSupplierTap: showSupplierAttribution
          ? materialDiscoverySupplierTapHandler(context, material)
          : null,
      onTap: onMaterialTap == null ? null : () => onMaterialTap!(material),
      trailing: trailingBuilder?.call(context, material),
    );
  }
}

class SliverMaterialsDiscoveryResultsGrid extends StatelessWidget {
  const SliverMaterialsDiscoveryResultsGrid({
    super.key,
    required this.materials,
    this.cardVariant = AppMaterialCardVariant.standard,
    this.onMaterialTap,
    this.showSupplierAttribution = true,
  });

  final List<DiscoveryMaterial> materials;
  final AppMaterialCardVariant cardVariant;
  final ValueChanged<DiscoveryMaterial>? onMaterialTap;
  final bool showSupplierAttribution;

  @override
  Widget build(BuildContext context) {
    final helper = MaterialsDiscoveryResultsGrid(
      materials: materials,
      cardVariant: cardVariant,
      onMaterialTap: onMaterialTap,
      showSupplierAttribution: showSupplierAttribution,
    );
    return SliverLayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.crossAxisExtent;
        if (width < 600) {
          return SliverList.separated(
            itemCount: materials.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
            itemBuilder: (context, index) =>
                helper._buildCompactCard(context, materials[index]),
          );
        }

        final columns = materialDiscoveryGridColumnCount(width);
        final itemWidth = (width - ((columns - 1) * AppSpacing.md)) / columns;
        final effectiveCardVariant = itemWidth < 400
            ? AppMaterialCardVariant.compact
            : cardVariant;
        final includesSupplierAttribution =
            showSupplierAttribution &&
            materials.any(
              (material) =>
                  materialDiscoverySupplierDisplayName(material, context) !=
                  null,
            );
        final cardHeight = ImpactMaterialGridCard.heightForWidth(
          itemWidth,
          variant: effectiveCardVariant,
          includesSupplierAttribution: includesSupplierAttribution,
        );
        return SliverGrid(
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            crossAxisSpacing: AppSpacing.md,
            mainAxisSpacing: AppSpacing.md,
            mainAxisExtent: cardHeight,
          ),
          delegate: SliverChildBuilderDelegate(
            (context, index) => helper._buildGridCard(
              context,
              materials[index],
              effectiveCardVariant: effectiveCardVariant,
            ),
            childCount: materials.length,
          ),
        );
      },
    );
  }
}
