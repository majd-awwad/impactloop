import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
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
      decoration: SupplierDecorations.sideInsightCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Material listing foundation ready',
            style: AuthDarkTextStyles.sectionTitle(context),
          ),
          const SizedBox(height: AppSpacing.sm),
          categories.when(
            data: (items) => Text(
              '${items.length} material categories loaded.',
              style: AuthDarkTextStyles.body(context),
            ),
            loading: () => Text(
              'Loading categories...',
              style: AuthDarkTextStyles.body(context),
            ),
            error: (_, _) => Text(
              'Categories could not be loaded yet.',
              style: AuthDarkTextStyles.body(
                context,
              ).copyWith(color: AuthDarkColors.error),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          policy.when(
            data: (value) => Text(
              value.message,
              style: AuthDarkTextStyles.body(
                context,
              ).copyWith(color: AuthDarkColors.accent),
            ),
            loading: () => Text(
              'Loading listing policy...',
              style: AuthDarkTextStyles.body(context),
            ),
            error: (_, _) => Text(
              'Listing policy unavailable.',
              style: AuthDarkTextStyles.body(context),
            ),
          ),
        ],
      ),
    );
  }
}
