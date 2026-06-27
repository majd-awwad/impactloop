import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../materials/application/material_listing_providers.dart';

class MaterialListingFoundationPreview extends ConsumerWidget {
  const MaterialListingFoundationPreview({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categories = ref.watch(materialCategoriesProvider);
    final policy = ref.watch(materialListingPolicyProvider);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: context.supplierDecorations.sideInsightCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.s.materialListingFoundationReady,
            style: context.supplierSectionTitle(),
          ),
          const SizedBox(height: AppSpacing.sm),
          categories.when(
            data: (items) => Text(
              context.s.materialCategoriesLoaded(items.length),
              style: context.supplierBody(),
            ),
            loading: () => Text(
              context.s.loadingCategories,
              style: context.supplierBody(),
            ),
            error: (_, _) => Text(
              context.s.categoriesCouldNotLoad,
              style: context.supplierBody().copyWith(
                color: context.supplierColors.error,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          policy.when(
            data: (value) => Text(
              value.message,
              style: context.supplierBody().copyWith(
                color: context.supplierColors.accent,
              ),
            ),
            loading: () => Text(
              context.s.loadingListingPolicy,
              style: context.supplierBody(),
            ),
            error: (_, _) => Text(
              context.s.listingPolicyUnavailable,
              style: context.supplierBody(),
            ),
          ),
        ],
      ),
    );
  }
}
