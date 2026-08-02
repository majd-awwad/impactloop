import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/app_material_card.dart';
import '../../../material_discovery/domain/discovery_material.dart';
import '../../../material_discovery/presentation/material_discovery_content.dart';
import '../../domain/learner_home_models.dart';
import '../learner_home_localization.dart';

class HomeMaterialRecommendationGrid extends StatelessWidget {
  const HomeMaterialRecommendationGrid({
    super.key,
    required this.items,
    this.maxItems,
  });

  final List<LearnerHomeMaterialRecommendation> items;
  final int? maxItems;

  @override
  Widget build(BuildContext context) {
    final preview = (maxItems == null ? items : items.take(maxItems!)).toList();

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

        final itemWidth = (width - ((columns - 1) * AppSpacing.md)) / columns;
        final cardHeight = ImpactMaterialGridCard.heightForWidth(
          itemWidth,
          variant: AppMaterialCardVariant.compact,
        );
        final includesReason = preview.any(
          (item) => item.reasons.isNotEmpty || item.reasonDetails.isNotEmpty,
        );
        final tileHeight =
            cardHeight +
            (includesReason
                ? ImpactMaterialGridCard.recommendationReasonBandHeight
                : 0);

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: preview.length,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            crossAxisSpacing: AppSpacing.md,
            mainAxisSpacing: AppSpacing.md,
            mainAxisExtent: tileHeight,
          ),
          itemBuilder: (context, index) {
            final item = preview[index];
            return _HomeMaterialRecommendationTile(
              item: item,
              cardHeight: cardHeight,
              index: index,
            );
          },
        );
      },
    );
  }
}

class _HomeMaterialRecommendationTile extends StatelessWidget {
  const _HomeMaterialRecommendationTile({
    required this.item,
    required this.cardHeight,
    required this.index,
  });

  final LearnerHomeMaterialRecommendation item;
  final double cardHeight;
  final int index;

  @override
  Widget build(BuildContext context) {
    final material = item.material;
    final imageUrl = _homeMaterialImageUrl(material, index);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: cardHeight,
          child: ImpactMaterialGridCard(
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
            imageUrl: imageUrl,
            ratingLabel: material.ratingLabel?.resolve(context),
            viewsCount: material.viewsCount,
            likesCount: material.likesCount,
            isLiked: material.isLiked,
            fallbackIcon: material.heroIconData,
            variant: AppMaterialCardVariant.compact,
            onTap: () => context.push(
              '/materials/${material.id}',
              extra: material.recommendationImpressionId,
            ),
          ),
        ),
        if (localizedLearnerHomeReason(item, context.l10n)
            case final reason?) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            reason,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              height: 1.25,
            ),
          ),
        ],
      ],
    );
  }
}

String _homeMaterialImageUrl(DiscoveryMaterial material, int index) {
  final rawUrl = material.imageUrl?.trim();
  if (rawUrl != null && rawUrl.isNotEmpty) {
    return ApiConfig.resolveMediaUrl(rawUrl);
  }

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
