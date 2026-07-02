import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/app_material_card.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../materials/data/models/category.dart';
import '../../domain/discovery_material.dart';
import '../../domain/material_discovery_result.dart';
import '../material_discovery_content.dart';
import '../widgets/discovery_location_privacy_panel.dart';
import '../widgets/material_search_filters.dart';
import '../widgets/materials_hero_section.dart';

class MaterialsDiscoveryView extends StatelessWidget {
  const MaterialsDiscoveryView({
    super.key,
    required this.materials,
    required this.pagination,
    required this.categories,
    required this.searchController,
    required this.cityController,
    required this.areaController,
    required this.searchValue,
    required this.selectedCategoryIndex,
    required this.selectedQuickFilterIndex,
    required this.selectedSortIndex,
    required this.selectedConditionIndex,
    required this.hasActiveFilters,
    required this.isRefetching,
    required this.isLoadingMore,
    this.refetchErrorMessage,
    this.onRetryRefetch,
    required this.onSearchChanged,
    required this.onCityChanged,
    required this.onAreaChanged,
    required this.onCategorySelected,
    required this.onQuickFilterSelected,
    required this.onSortSelected,
    required this.onConditionSelected,
    required this.onClearFilters,
    required this.onLoadMore,
    this.onMaterialTap,
    this.showHeroSection = true,
    this.showLocationPrivacyPanel = true,
    this.cardVariant = AppMaterialCardVariant.standard,
  });

  final List<DiscoveryMaterial> materials;
  final MaterialDiscoveryPagination? pagination;
  final List<MaterialCategory> categories;
  final TextEditingController searchController;
  final TextEditingController cityController;
  final TextEditingController areaController;
  final String searchValue;
  final int selectedCategoryIndex;
  final int selectedQuickFilterIndex;
  final int selectedSortIndex;
  final int selectedConditionIndex;
  final bool hasActiveFilters;
  final bool isRefetching;
  final bool isLoadingMore;
  final String? refetchErrorMessage;
  final VoidCallback? onRetryRefetch;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<String> onCityChanged;
  final ValueChanged<String> onAreaChanged;
  final ValueChanged<int> onCategorySelected;
  final ValueChanged<int> onQuickFilterSelected;
  final ValueChanged<int> onSortSelected;
  final ValueChanged<int> onConditionSelected;
  final VoidCallback onClearFilters;
  final VoidCallback onLoadMore;
  final ValueChanged<DiscoveryMaterial>? onMaterialTap;
  final bool showHeroSection;
  final bool showLocationPrivacyPanel;
  final AppMaterialCardVariant cardVariant;

  @override
  Widget build(BuildContext context) {
    final total = pagination?.total ?? materials.length;
    final showingCount = materials.length;
    final hasMore = pagination?.hasMore ?? false;

    return LayoutBuilder(
      builder: (context, constraints) {
        final isMobile = constraints.maxWidth < 600;
        final showHero = showHeroSection && !isMobile;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (showHero) ...[
              MaterialsHeroSection(
                compact: true,
                title: const LocalizedText(
                  en: 'Material Discovery',
                  ar: 'اكتشاف المواد',
                ),
                subtitle: const LocalizedText(
                  en:
                      'Browse reusable materials from verified suppliers. Search, filter, and reserve what you need.',
                  ar:
                      'تصفح المواد القابلة لإعادة الاستخدام من موردين موثوقين. ابحث، وفلتر، واحجز ما تحتاجه.',
                ),
                stats: {
                  const LocalizedText(
                    en: 'loaded',
                    ar: 'محمّلة',
                  ): '$showingCount',
                  const LocalizedText(
                    en: 'matches',
                    ar: 'مطابقة',
                  ): '$total',
                },
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            if (isMobile) ...[
              _CompactDiscoveryHeader(
                showingCount: showingCount,
                total: total,
                hasActiveFilters: hasActiveFilters,
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            if (refetchErrorMessage != null) ...[
              _RefetchErrorBanner(
                message: refetchErrorMessage!,
                onRetry: onRetryRefetch,
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            if (isRefetching) ...[
              const _RefetchingIndicator(),
              const SizedBox(height: AppSpacing.sm),
            ],
            MaterialSearchFilters(
              compactMobile: isMobile,
              searchController: searchController,
              cityController: cityController,
              areaController: areaController,
              searchValue: searchValue,
              onSearchChanged: onSearchChanged,
              onCityChanged: onCityChanged,
              onAreaChanged: onAreaChanged,
              categories: categories,
              selectedCategoryIndex: selectedCategoryIndex,
              onCategorySelected: onCategorySelected,
              quickFilters: materialQuickFilters,
              selectedQuickFilterIndex: selectedQuickFilterIndex,
              onQuickFilterSelected: onQuickFilterSelected,
              sortOptions: materialSortOptions,
              selectedSortIndex: selectedSortIndex,
              onSortSelected: onSortSelected,
              conditionFilters: materialConditionFilters,
              selectedConditionIndex: selectedConditionIndex,
              onConditionSelected: onConditionSelected,
              hasActiveFilters: hasActiveFilters,
              onClearFilters: onClearFilters,
            ),
            SizedBox(height: isMobile ? AppSpacing.sm : AppSpacing.xl),
            if (!isMobile) ...[
              _ResultsHeader(
                showingCount: showingCount,
                total: total,
                hasActiveFilters: hasActiveFilters,
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            if (materials.isEmpty)
              const _EmptyStatePanel(
                title: materialDiscoveryEmptyTitle,
                subtitle: materialDiscoveryEmptySubtitle,
              )
            else
              _MaterialsResultsGrid(
                materials: materials,
                cardVariant: cardVariant,
                onMaterialTap: onMaterialTap,
              ),
            if (hasMore) ...[
              const SizedBox(height: AppSpacing.lg),
              Center(
                child: FilledButton.icon(
                  onPressed: isLoadingMore ? null : onLoadMore,
                  icon: isLoadingMore
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.expand_more_rounded),
                  label: Text(
                    isLoadingMore
                        ? const LocalizedText(
                            en: 'Loading more...',
                            ar: 'جارٍ تحميل المزيد...',
                          ).resolve(context)
                        : LocalizedText(
                            en: 'Load more ($showingCount of $total)',
                            ar: 'تحميل المزيد ($showingCount من $total)',
                          ).resolve(context),
                  ),
                ),
              ),
            ],
            if (showLocationPrivacyPanel) ...[
              SizedBox(height: isMobile ? AppSpacing.lg : AppSpacing.xl),
              const DiscoveryLocationPrivacyPanel(),
            ],
          ],
        );
      },
    );
  }
}

class _MaterialsResultsGrid extends StatelessWidget {
  const _MaterialsResultsGrid({
    required this.materials,
    required this.cardVariant,
    required this.onMaterialTap,
  });

  final List<DiscoveryMaterial> materials;
  final AppMaterialCardVariant cardVariant;
  final ValueChanged<DiscoveryMaterial>? onMaterialTap;

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
              final material = materials[index];

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
                availabilityLabel: material.availabilityLabel.resolve(
                  context,
                ),
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
                onTap: onMaterialTap == null
                    ? null
                    : () => onMaterialTap!(material),
              );
            },
          );
        }

        final columns = _materialGridColumnCount(width);
        final itemWidth = (width - ((columns - 1) * AppSpacing.md)) / columns;
        final effectiveCardVariant = itemWidth < 400
            ? AppMaterialCardVariant.compact
            : cardVariant;
        final cardHeight = ImpactMaterialGridCard.heightForWidth(
          itemWidth,
          variant: effectiveCardVariant,
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
            return SizedBox(
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
                availabilityLabel: material.availabilityLabel.resolve(
                  context,
                ),
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
                onTap: onMaterialTap == null
                    ? null
                    : () => onMaterialTap!(material),
              ),
            );
          },
        );
      },
    );
  }
}

class _CompactDiscoveryHeader extends StatelessWidget {
  const _CompactDiscoveryHeader({
    required this.showingCount,
    required this.total,
    required this.hasActiveFilters,
  });

  final int showingCount;
  final int total;
  final bool hasActiveFilters;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          LocalizedText(
            en: 'Reusable Materials',
            ar: 'المواد القابلة لإعادة الاستخدام',
          ).resolve(context),
          style: AppTextStyles.title(context).copyWith(
            color: palette.textPrimary,
            fontSize: 24,
            fontWeight: FontWeight.w800,
          ),
          textAlign: TextAlign.start,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          (hasActiveFilters
                  ? LocalizedText(
                      en: 'Showing $showingCount of $total matching results',
                      ar: 'عرض $showingCount من $total نتيجة مطابقة',
                    )
                  : LocalizedText(
                      en: 'Showing $showingCount of $total public results',
                      ar: 'عرض $showingCount من $total نتيجة عامة',
                    ))
              .resolve(context),
          style: AppTextStyles.subtitle(context).copyWith(
            color: palette.textSecondary,
            fontSize: 14,
          ),
          textAlign: TextAlign.start,
        ),
      ],
    );
  }
}

int _materialGridColumnCount(double width) {
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

class _ResultsHeader extends StatelessWidget {
  const _ResultsHeader({
    required this.showingCount,
    required this.total,
    required this.hasActiveFilters,
  });

  final int showingCount;
  final int total;
  final bool hasActiveFilters;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          LocalizedText(
            en: 'Reusable Materials',
            ar: 'المواد القابلة لإعادة الاستخدام',
          ).resolve(context),
          style: AppTextStyles.display(
            context,
          ).copyWith(color: palette.textPrimary),
          textAlign: TextAlign.start,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          (hasActiveFilters
                  ? LocalizedText(
                      en: 'Showing $showingCount of $total matching results',
                      ar: 'عرض $showingCount من $total نتيجة مطابقة',
                    )
                  : LocalizedText(
                      en: 'Showing $showingCount of $total public results',
                      ar: 'عرض $showingCount من $total نتيجة عامة',
                    ))
              .resolve(context),
          style: AppTextStyles.subtitle(
            context,
          ).copyWith(color: palette.textSecondary),
          textAlign: TextAlign.start,
        ),
      ],
    );
  }
}

class _EmptyStatePanel extends StatelessWidget {
  const _EmptyStatePanel({required this.title, required this.subtitle});

  final LocalizedText title;
  final LocalizedText subtitle;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: palette.hintSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.hintBorder),
      ),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: palette.mint.withValues(alpha: 0.14),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.search_off_rounded,
              color: palette.mint,
              size: 32,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            title.resolve(context),
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 580),
            child: Text(
              subtitle.resolve(context),
              style: AppTextStyles.subtitle(
                context,
              ).copyWith(color: palette.textSecondary),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

class _RefetchingIndicator extends StatelessWidget {
  const _RefetchingIndicator();

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClipRRect(
          borderRadius: AppRadius.pillAll,
          child: LinearProgressIndicator(
            minHeight: 3,
            backgroundColor: palette.borderSubtle,
            color: palette.mint,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          const LocalizedText(
            en: 'Updating results...',
            ar: 'جارٍ تحديث النتائج...',
          ).resolve(context),
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textSecondary, fontSize: 12),
          textAlign: TextAlign.start,
        ),
      ],
    );
  }
}

class _RefetchErrorBanner extends StatelessWidget {
  const _RefetchErrorBanner({
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.hintSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.hintBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.error_outline_rounded, color: palette.mint),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
              textAlign: TextAlign.start,
            ),
          ),
          if (onRetry != null) ...[
            const SizedBox(width: AppSpacing.sm),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ],
      ),
    );
  }
}
