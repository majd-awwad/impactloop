import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/l10n.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/app_material_card.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../material_discovery/domain/discovery_material.dart';
import '../../../material_discovery/presentation/material_discovery_content.dart';
import '../../application/home_suggested_materials_provider.dart';
import 'empty_activity_card.dart';
import 'home_section_header.dart';

class SuggestedMaterialsSection extends ConsumerWidget {
  const SuggestedMaterialsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final materialsState = ref.watch(homeSuggestedMaterialsProvider);

    return LayoutBuilder(
      builder: (context, sectionConstraints) {
        final useMobileList = sectionConstraints.maxWidth < 600;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            HomeSectionHeader(
              title: l10n.sectionHomeSuggestedMaterialsTitle,
              subtitle: l10n.sectionHomeSuggestedMaterialsSubtitle,
              compactInlineAction: useMobileList,
              action: useMobileList
                  ? TextButton(
                      onPressed: () => context.go('/materials'),
                      child: Text(l10n.browseAll),
                    )
                  : HomeSectionActionButton(
                      onPressed: () => context.go('/materials'),
                      icon: const Icon(Icons.arrow_forward_rounded),
                      label: l10n.browseAll,
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
                    title: l10n.sectionHomeSuggestedMaterialsEmpty,
                    description: l10n.sectionHomeSuggestedMaterialsEmptyDescription,
                    actionLabel: l10n.openMaterials,
                    onAction: () => context.go('/materials'),
                  );
                }

                return LayoutBuilder(
                  builder: (context, constraints) {
                    final width = constraints.maxWidth;

                    if (useMobileList) {
                      final previewMaterials = materials.take(3).toList();

                      return ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: previewMaterials.length,
                        separatorBuilder: (context, index) =>
                            const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, index) {
                          final material = previewMaterials[index];
                          final imageUrl = _homeMaterialImageUrl(
                            material,
                            index,
                          );

                          return ImpactMaterialCompactCard(
                            title: material.title.resolve(context),
                            description: material.description.resolve(context),
                            category: material.category.resolve(context),
                            conditionLabel: material.conditionLabel.resolve(
                              context,
                            ),
                            conditionTone: material.conditionTone,
                            statusLabel: material.statusLabel.resolve(context),
                            statusTone: material.statusTone,
                            quantityLabel: material.quantityLabel.resolve(
                              context,
                            ),
                            priceLabel: material.priceLabel.resolve(context),
                            locationLabel: material.locationLabel.resolve(
                              context,
                            ),
                            availabilityLabel: material.availabilityLabel
                                .resolve(context),
                            deliveryAvailable: material.deliveryAvailable,
                            isFree: material.isFree,
                            gradientColors: materialGradient(material),
                            imageUrl: imageUrl,
                            ratingLabel: material.ratingLabel?.resolve(context),
                            viewsCount: material.viewsCount,
                            likesCount: material.likesCount,
                            isLiked: material.isLiked,
                            fallbackIcon: material.heroIconData,
                            onTap: () =>
                                context.push('/materials/${material.id}'),
                          );
                        },
                      );
                    }

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
                    final cardHeight = ImpactMaterialGridCard.heightForWidth(
                      itemWidth,
                      variant: AppMaterialCardVariant.compact,
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
                        final material = materials[index];
                        final imageUrl = _homeMaterialImageUrl(material, index);

                        return ImpactMaterialGridCard(
                          title: material.title.resolve(context),
                          description: material.description.resolve(context),
                          category: material.category.resolve(context),
                          conditionLabel: material.conditionLabel.resolve(
                            context,
                          ),
                          conditionTone: material.conditionTone,
                          statusLabel: material.statusLabel.resolve(context),
                          statusTone: material.statusTone,
                          quantityLabel: material.quantityLabel.resolve(
                            context,
                          ),
                          priceLabel: material.priceLabel.resolve(context),
                          locationLabel: material.locationLabel.resolve(
                            context,
                          ),
                          availabilityLabel: material.availabilityLabel.resolve(
                            context,
                          ),
                          deliveryAvailable: material.deliveryAvailable,
                          isFree: material.isFree,
                          gradientColors: materialGradient(material),
                          imageUrl: imageUrl,
                          ratingLabel: material.ratingLabel?.resolve(context),
                          viewsCount: material.viewsCount,
                          likesCount: material.likesCount,
                          isLiked: material.isLiked,
                          fallbackIcon: material.heroIconData,
                          variant: AppMaterialCardVariant.compact,
                          onTap: () =>
                              context.push('/materials/${material.id}'),
                        );
                      },
                    );
                  },
                );
              },
            ),
          ],
        );
      },
    );
  }
}

String _homeMaterialImageUrl(DiscoveryMaterial material, int index) {
  final rawUrl = material.imageUrl?.trim();
  if (rawUrl != null &&
      (rawUrl.startsWith('https://') || rawUrl.startsWith('http://'))) {
    return rawUrl;
  }

  final category = material.category.en.toLowerCase();
  final title = material.title.en.toLowerCase();
  final text = '$category $title';

  if (text.contains('wood') || text.contains('cardboard')) {
    return _homeMaterialFallbackImages[index % 2];
  }

  if (text.contains('epoxy') ||
      text.contains('resin') ||
      text.contains('plastic') ||
      text.contains('acrylic')) {
    return _homeMaterialFallbackImages[2];
  }

  if (text.contains('fabric') ||
      text.contains('cotton') ||
      text.contains('textile')) {
    return _homeMaterialFallbackImages[3];
  }

  if (text.contains('electronic') || text.contains('sensor')) {
    return _homeMaterialFallbackImages[4];
  }

  return _homeMaterialFallbackImages[index %
      _homeMaterialFallbackImages.length];
}

const _homeMaterialFallbackImages = [
  'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
];

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
    final l10n = context.l10n;
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
                  l10n.homeSuggestedMaterialsLoadError,
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: palette.textPrimary, letterSpacing: 0),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  l10n.homeSuggestedMaterialsLoadErrorSubtitle,
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                    height: 1.45,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                OutlinedButton(
                  onPressed: onRetry,
                  style: AppStatusButtonStyle.outlined(
                    context,
                    AppStatusTone.primary,
                  ),
                  child: Text(l10n.retry),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
