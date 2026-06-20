import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/app_material_card.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../material_discovery/presentation/material_discovery_content.dart';
import '../../application/home_suggested_materials_provider.dart';
import 'empty_activity_card.dart';
import 'home_section_header.dart';

class SuggestedMaterialsSection extends ConsumerWidget {
  const SuggestedMaterialsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final materialsState = ref.watch(homeSuggestedMaterialsProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        HomeSectionHeader(
          title: 'Suggested materials',
          subtitle: 'A few currently listed materials to help you start.',
          action: TextButton.icon(
            onPressed: () => context.go('/materials'),
            icon: const Icon(Icons.arrow_forward_rounded),
            label: const Text('Browse all'),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        materialsState.when(
          loading: () => const _SuggestedMaterialsLoading(),
          error: (error, stackTrace) => _SuggestedMaterialsError(
            onRetry: () => ref.invalidate(homeSuggestedMaterialsProvider),
          ),
          data: (materials) {
            if (materials.isEmpty) {
              return EmptyActivityCard(
                icon: Icons.inventory_2_outlined,
                title: 'No materials available yet',
                description:
                    'When suppliers list reusable materials, a small set will appear here.',
                actionLabel: 'Open materials',
                onAction: () => context.go('/materials'),
              );
            }

            return LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth;
                var columns = 1;
                if (width >= 1180) {
                  columns = 4;
                } else if (width >= 860) {
                  columns = 3;
                } else if (width >= 620) {
                  columns = 2;
                }

                final itemWidth =
                    (width - ((columns - 1) * AppSpacing.md)) / columns;

                return Wrap(
                  spacing: AppSpacing.md,
                  runSpacing: AppSpacing.md,
                  children: materials.map((material) {
                    return SizedBox(
                      width: itemWidth,
                      child: AppMaterialCard(
                        title: material.title.resolve(context),
                        description: material.description.resolve(context),
                        category: material.category.resolve(context),
                        conditionLabel: material.conditionLabel.resolve(
                          context,
                        ),
                        conditionTone: material.conditionTone,
                        statusLabel: material.statusLabel.resolve(context),
                        statusTone: material.statusTone,
                        quantityLabel: material.quantityLabel.resolve(context),
                        priceLabel: material.priceLabel.resolve(context),
                        locationLabel: material.locationLabel.resolve(context),
                        availabilityLabel: material.availabilityLabel.resolve(
                          context,
                        ),
                        deliveryAvailable: material.deliveryAvailable,
                        isFree: material.isFree,
                        gradientColors: materialGradient(material),
                        imageUrl: material.imageUrl,
                        ratingLabel: material.ratingLabel?.resolve(context),
                        fallbackIcon: material.heroIconData,
                        variant: AppMaterialCardVariant.compact,
                        onTap: () => context.go('/materials/${material.id}'),
                      ),
                    );
                  }).toList(),
                );
              },
            );
          },
        ),
      ],
    );
  }
}

class _SuggestedMaterialsLoading extends StatelessWidget {
  const _SuggestedMaterialsLoading();

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      height: 178,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: CircularProgressIndicator(color: palette.mint),
    );
  }
}

class _SuggestedMaterialsError extends StatelessWidget {
  const _SuggestedMaterialsError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.cloud_off_outlined, color: materialWarning),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Unable to load suggested materials',
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: palette.textPrimary, letterSpacing: 0),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'The home page is still available. Try again when the materials API is running.',
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                    height: 1.45,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                OutlinedButton(
                  onPressed: onRetry,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: palette.mint,
                    side: BorderSide(color: palette.borderStrong),
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadius.pillAll,
                    ),
                  ),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
