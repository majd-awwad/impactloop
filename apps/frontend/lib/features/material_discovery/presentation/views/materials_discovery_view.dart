import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/app_material_card.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../domain/discovery_material.dart';
import '../material_discovery_content.dart';
import '../widgets/material_search_filters.dart';
import '../widgets/materials_hero_section.dart';
import '../widgets/nearby_map_placeholder.dart';

class MaterialsDiscoveryView extends StatefulWidget {
  const MaterialsDiscoveryView({
    super.key,
    required this.materials,
    this.onMaterialTap,
    this.showHeroSection = true,
    this.showNearbyMap = true,
    this.showTipPanel = true,
    this.cardVariant = AppMaterialCardVariant.standard,
  });

  final List<DiscoveryMaterial> materials;
  final ValueChanged<DiscoveryMaterial>? onMaterialTap;
  final bool showHeroSection;
  final bool showNearbyMap;
  final bool showTipPanel;
  final AppMaterialCardVariant cardVariant;

  @override
  State<MaterialsDiscoveryView> createState() => _MaterialsDiscoveryViewState();
}

class _MaterialsDiscoveryViewState extends State<MaterialsDiscoveryView> {
  late final TextEditingController _searchController;
  String _searchValue = '';
  int _selectedCategoryIndex = 0;
  int _selectedQuickFilterIndex = 0;

  bool get _hasActiveFilters =>
      _searchValue.trim().isNotEmpty ||
      _selectedCategoryIndex != 0 ||
      _selectedQuickFilterIndex != 0;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filteredMaterials = _filteredMaterials(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.showHeroSection) ...[
          MaterialsHeroSection(
            title: const LocalizedText(
              en: 'Material Discovery',
              ar: 'اكتشاف المواد',
            ),
            subtitle: const LocalizedText(
              en: 'Browse reusable materials with a premium public marketplace layout that can later drop into dashboard sections without rewrites.',
              ar: 'تصفح المواد القابلة لإعادة الاستخدام ضمن واجهة سوق عامة احترافية يمكن نقلها لاحقاً إلى أقسام لوحة التحكم دون إعادة بناء.',
            ),
            stats: materialDiscoveryStats,
          ),
          const SizedBox(height: AppSpacing.lg),
        ],
        MaterialSearchFilters(
          controller: _searchController,
          searchValue: _searchValue,
          onSearchChanged: (value) {
            setState(() {
              _searchValue = value;
            });
          },
          categories: materialDiscoveryCategories,
          quickFilters: materialQuickFilters,
          selectedCategoryIndex: _selectedCategoryIndex,
          selectedQuickFilterIndex: _selectedQuickFilterIndex,
          onCategorySelected: (index) {
            setState(() {
              _selectedCategoryIndex = index;
            });
          },
          onQuickFilterSelected: (index) {
            setState(() {
              _selectedQuickFilterIndex = index;
            });
          },
          hasActiveFilters: _hasActiveFilters,
          onClearFilters: _clearFilters,
        ),
        const SizedBox(height: AppSpacing.xl),
        _ResultsHeader(
          resultCount: filteredMaterials.length,
          hasActiveFilters: _hasActiveFilters,
        ),
        const SizedBox(height: AppSpacing.md),
        if (filteredMaterials.isEmpty)
          const _EmptyStatePanel(
            title: materialDiscoveryEmptyTitle,
            subtitle: materialDiscoveryEmptySubtitle,
          )
        else
          LayoutBuilder(
            builder: (context, constraints) {
              final width = constraints.maxWidth;
              var columns = 1;

              if (width >= 1160) {
                columns = 3;
              } else if (width >= 760) {
                columns = 2;
              }

              final itemWidth =
                  (width - ((columns - 1) * AppSpacing.md)) / columns;

              return Wrap(
                spacing: AppSpacing.md,
                runSpacing: AppSpacing.md,
                children: filteredMaterials.map((material) {
                  return SizedBox(
                    width: itemWidth,
                    child: AppMaterialCard(
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
                      ratingLabel: material.ratingLabel?.resolve(context),
                      fallbackIcon: material.heroIconData,
                      variant: widget.cardVariant,
                      onTap: widget.onMaterialTap == null
                          ? null
                          : () => widget.onMaterialTap!(material),
                    ),
                  );
                }).toList(),
              );
            },
          ),
        if (widget.showNearbyMap) ...[
          const SizedBox(height: AppSpacing.xl),
          const NearbyMapPlaceholder(
            title: LocalizedText(
              en: 'Nearby Material Map',
              ar: 'خريطة المواد القريبة',
            ),
            subtitle: LocalizedText(
              en: 'Public locations stay approximate until reservation or delivery steps are connected.',
              ar: 'تظل المواقع العامة تقريبية حتى يتم ربط الحجز أو خطوات التوصيل.',
            ),
          ),
        ],
        if (widget.showTipPanel) ...[
          const SizedBox(height: AppSpacing.xl),
          const _TipPanel(),
        ],
      ],
    );
  }

  List<DiscoveryMaterial> _filteredMaterials(BuildContext context) {
    final normalizedSearch = _searchValue.trim().toLowerCase();
    final selectedCategory = _selectedCategoryIndex == 0
        ? null
        : materialDiscoveryCategories[_selectedCategoryIndex].resolve(context);

    return widget.materials.where((material) {
      final matchesCategory = selectedCategory == null ||
          material.category.resolve(context) == selectedCategory;

      final matchesQuickFilter = switch (_selectedQuickFilterIndex) {
        1 => material.statusTone == MaterialStatusBadgeTone.available,
        2 => material.isFree,
        3 => material.deliveryAvailable,
        _ => true,
      };

      if (!matchesCategory || !matchesQuickFilter) {
        return false;
      }

      if (normalizedSearch.isEmpty) {
        return true;
      }

      final searchPool = [
        material.title.resolve(context),
        material.description.resolve(context),
        material.category.resolve(context),
        material.locationLabel.resolve(context),
      ].join(' ').toLowerCase();

      return searchPool.contains(normalizedSearch);
    }).toList();
  }

  void _clearFilters() {
    _searchController.clear();
    setState(() {
      _searchValue = '';
      _selectedCategoryIndex = 0;
      _selectedQuickFilterIndex = 0;
    });
  }
}

class _ResultsHeader extends StatelessWidget {
  const _ResultsHeader({
    required this.resultCount,
    required this.hasActiveFilters,
  });

  final int resultCount;
  final bool hasActiveFilters;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 600;

        final summary = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              LocalizedText(
                en: 'Reusable Materials',
                ar: 'المواد القابلة لإعادة الاستخدام',
              ).resolve(context),
              style: AppTextStyles.display(
                context,
              ).copyWith(color: materialTextPrimary),
              textAlign: TextAlign.start,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              (hasActiveFilters
                      ? LocalizedText(
                          en: '$resultCount matching results',
                          ar: '$resultCount نتيجة مطابقة',
                        )
                      : LocalizedText(
                          en: '$resultCount public results in this mock',
                          ar: '$resultCount نتيجة عامة في هذا النموذج',
                        ))
                  .resolve(context),
              style: AppTextStyles.subtitle(
                context,
              ).copyWith(color: materialTextSecondary),
              textAlign: TextAlign.start,
            ),
          ],
        );

        final infoChip = Container(
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: materialHintSurface,
            borderRadius: AppRadius.pillAll,
            border: Border.all(color: materialBorderStrong),
          ),
          child: Text(
            LocalizedText(
              en: 'Shared card component ready',
              ar: 'مكون البطاقة المشترك جاهز',
            ).resolve(context),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: materialMint),
            textAlign: TextAlign.start,
          ),
        );

        if (compact) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              summary,
              const SizedBox(height: AppSpacing.md),
              infoChip,
            ],
          );
        }

        return Row(
          children: [
            Expanded(child: summary),
            const SizedBox(width: AppSpacing.md),
            infoChip,
          ],
        );
      },
    );
  }
}

class _EmptyStatePanel extends StatelessWidget {
  const _EmptyStatePanel({required this.title, required this.subtitle});

  final LocalizedText title;
  final LocalizedText subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: materialHintSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: materialHintBorder),
      ),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: materialMint.withValues(alpha: 0.14),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.search_off_rounded,
              color: materialMint,
              size: 32,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            title.resolve(context),
            style: AppTextStyles.title(
              context,
            ).copyWith(color: materialTextPrimary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 580),
            child: Text(
              subtitle.resolve(context),
              style: AppTextStyles.subtitle(
                context,
              ).copyWith(color: materialTextSecondary),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

class _TipPanel extends StatelessWidget {
  const _TipPanel();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: materialHintSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: materialHintBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: materialMint.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.tips_and_updates_outlined, color: materialMint),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  LocalizedText(
                    en: 'UI implementation note',
                    ar: 'ملاحظة تنفيذ الواجهة',
                  ).resolve(context),
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: materialTextPrimary),
                  textAlign: TextAlign.start,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  materialDiscoveryTip.resolve(context),
                  style: AppTextStyles.subtitle(
                    context,
                  ).copyWith(color: materialTextSecondary),
                  textAlign: TextAlign.start,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
