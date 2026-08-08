import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/app_material_card.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/material_discovery_providers.dart';
import '../../domain/discovery_material.dart';
import '../../domain/material_performance_models.dart';
import '../material_discovery_content.dart';

const materialDetailsSectionGap = AppSpacing.lg;
const relatedCompactCardWidth = 340.0;

enum RelatedMaterialsLayout { desktop, mobile }

class MaterialDetailsRelatedSections extends ConsumerStatefulWidget {
  const MaterialDetailsRelatedSections({
    required this.material,
    required this.layout,
  });

  final DiscoveryMaterial material;
  final RelatedMaterialsLayout layout;

  @override
  ConsumerState<MaterialDetailsRelatedSections> createState() =>
      MaterialDetailsRelatedSectionsState();
}

class MaterialDetailsRelatedSectionsState
    extends ConsumerState<MaterialDetailsRelatedSections> {
  RelatedMaterialsResult? _result;
  CancelToken? _cancelToken;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant MaterialDetailsRelatedSections oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.material.id != widget.material.id) {
      _load();
    }
  }

  @override
  void dispose() {
    _cancelToken?.cancel('Related section disposed');
    super.dispose();
  }

  Future<void> _load() async {
    _cancelToken?.cancel('Related request replaced');
    final repository = ref.read(materialDiscoveryRepositoryProvider);
    if (repository is! MaterialDetailsPerformanceRepository) {
      return;
    }
    final performanceRepository =
        repository as MaterialDetailsPerformanceRepository;
    final token = CancelToken();
    _cancelToken = token;
    if (mounted) {
      setState(() {
        _result = null;
        _error = null;
      });
    }
    try {
      final result = await performanceRepository.fetchRelatedMaterials(
        widget.material.id,
        cancelToken: token,
      );
      if (mounted && !token.isCancelled) {
        setState(() => _result = result);
      }
    } on DioException catch (error) {
      if (!CancelToken.isCancel(error) && mounted) {
        setState(() => _error = error);
      }
    } catch (error) {
      if (error is ApiException && error.isCancellation) {
        return;
      }
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    if (result == null) {
      if (_error == null) return const SizedBox.shrink();
      return Align(
        alignment: AlignmentDirectional.centerStart,
        child: TextButton.icon(
          onPressed: _load,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Retry related materials'),
        ),
      );
    }
    final strips = <Widget>[
      if (result.category.isNotEmpty)
        _RelatedMaterialsStrip(
          layout: widget.layout,
          materials: result.category,
          title: LocalizedText(
            en: 'More in ${widget.material.category.en}',
            ar: 'المزيد في ${widget.material.category.ar}',
          ),
        ),
      if (result.nearby.isNotEmpty)
        _RelatedMaterialsStrip(
          layout: widget.layout,
          materials: result.nearby,
          title: const LocalizedText(
            en: 'More nearby',
            ar: 'المزيد بالقرب منك',
          ),
        ),
    ];
    if (strips.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < strips.length; i++) ...[
          if (i > 0) const SizedBox(height: materialDetailsSectionGap),
          strips[i],
        ],
      ],
    );
  }
}

class _RelatedMaterialsStrip extends StatelessWidget {
  const _RelatedMaterialsStrip({
    required this.layout,
    required this.materials,
    required this.title,
  });

  final RelatedMaterialsLayout layout;
  final List<DiscoveryMaterial> materials;
  final LocalizedText title;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title.resolve(context),
          style: AppTextStyles.title(
            context,
          ).copyWith(color: palette.textPrimary),
        ),
        const SizedBox(height: AppSpacing.md),
        if (layout == RelatedMaterialsLayout.desktop)
          Wrap(
            spacing: AppSpacing.lg,
            runSpacing: AppSpacing.lg,
            children: materials
                .map(
                  (related) => SizedBox(
                    width: relatedCompactCardWidth,
                    height: ImpactMaterialCompactCard.baseHeight,
                    child: _RelatedMaterialCompactCard(material: related),
                  ),
                )
                .toList(growable: false),
          )
        else
          SizedBox(
            height: ImpactMaterialCompactCard.baseHeight,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: materials.length,
              separatorBuilder: (context, index) =>
                  const SizedBox(width: AppSpacing.md),
              itemBuilder: (context, index) {
                final related = materials[index];

                return SizedBox(
                  width: 320,
                  child: _RelatedMaterialCompactCard(material: related),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _RelatedMaterialCompactCard extends StatelessWidget {
  const _RelatedMaterialCompactCard({required this.material});

  final DiscoveryMaterial material;

  @override
  Widget build(BuildContext context) {
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
      onTap: () => context.push('/materials/${material.id}'),
    );
  }
}
