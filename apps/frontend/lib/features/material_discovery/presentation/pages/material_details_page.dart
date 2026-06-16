import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../../shared/widgets/materials/material_price_badge.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../data/mock_materials.dart';
import '../widgets/nearby_map_placeholder.dart';

class MaterialDetailsPage extends StatelessWidget {
  const MaterialDetailsPage({super.key, required this.materialId});

  final String materialId;

  @override
  Widget build(BuildContext context) {
    final material = mockMaterialById(materialId);

    if (material == null) {
      return Scaffold(
        backgroundColor: materialPageBackground,
        body: Center(
          child: Text(
            const LocalizedText(
              en: 'Material not found',
              ar: 'المادة غير موجودة',
            ).resolve(context),
            style: AppTextStyles.title(
              context,
            ).copyWith(color: materialTextPrimary),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: materialPageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(
              showSignIn: true,
              showCreateAccount: true,
              homeRoute: '/',
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xl),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _MaterialDetailsHero(materialId: materialId),
                    Transform.translate(
                      offset: const Offset(0, -34),
                      child: Padding(
                        padding: const EdgeInsetsDirectional.symmetric(
                          horizontal: AppSpacing.md,
                        ),
                        child: Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 1400),
                            child: LayoutBuilder(
                              builder: (context, constraints) {
                                final wide = constraints.maxWidth >= 980;

                                final mainColumn = _DetailsMainColumn(
                                  materialId: materialId,
                                );
                                final sideColumn = _DetailsSideColumn(
                                  materialId: materialId,
                                );

                                if (!wide) {
                                  return Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      mainColumn,
                                      const SizedBox(height: AppSpacing.lg),
                                      sideColumn,
                                    ],
                                  );
                                }

                                return Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Expanded(flex: 7, child: mainColumn),
                                    const SizedBox(width: AppSpacing.lg),
                                    Expanded(flex: 4, child: sideColumn),
                                  ],
                                );
                              },
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MaterialDetailsHero extends StatelessWidget {
  const _MaterialDetailsHero({required this.materialId});

  final String materialId;

  @override
  Widget build(BuildContext context) {
    final material = mockMaterialById(materialId)!;
    final screenWidth = MediaQuery.sizeOf(context).width;
    final heroHeight = screenWidth >= 1100
        ? 380.0
        : screenWidth >= 700
        ? 340.0
        : 296.0;

    return SizedBox(
      height: heroHeight,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: AlignmentDirectional.topStart,
            end: AlignmentDirectional.bottomEnd,
            colors: materialGradient(material),
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (material.imageUrl != null)
              Image.network(
                material.imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) =>
                    const SizedBox.shrink(),
              ),
            const DecoratedBox(
              decoration: BoxDecoration(color: materialOverlayDark),
            ),
            PositionedDirectional(
              top: 34,
              start: 24,
              child: IconButton.filled(
                onPressed: () => context.go('/materials'),
                style: IconButton.styleFrom(
                  backgroundColor: materialPanelSurface.withValues(alpha: 0.9),
                ),
                icon: const Icon(Icons.arrow_back_rounded),
              ),
            ),
            PositionedDirectional(
              top: 34,
              end: 24,
              child: Container(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                decoration: BoxDecoration(
                  color: materialPanelSurface.withValues(alpha: 0.88),
                  borderRadius: AppRadius.pillAll,
                  border: Border.all(color: materialBorderSubtle),
                ),
                child: Text(
                  material.category.resolve(context),
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: materialTextPrimary),
                  textAlign: TextAlign.start,
                ),
              ),
            ),
            Align(
              alignment: AlignmentDirectional.center,
              child: Container(
                width: 112,
                height: 112,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: AlignmentDirectional.topStart,
                    end: AlignmentDirectional.bottomEnd,
                    colors: [
                      materialFallbackStart,
                      materialFallbackMid,
                      materialFallbackEnd,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(color: materialBorderStrong),
                ),
                child: Icon(
                  material.heroIconData,
                  size: 52,
                  color: materialMint,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailsMainColumn extends StatelessWidget {
  const _DetailsMainColumn({required this.materialId});

  final String materialId;

  @override
  Widget build(BuildContext context) {
    final material = mockMaterialById(materialId)!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                material.title.resolve(context),
                style: AppTextStyles.display(
                  context,
                ).copyWith(color: materialTextPrimary),
                textAlign: TextAlign.start,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                material.description.resolve(context),
                style: AppTextStyles.subtitle(
                  context,
                ).copyWith(color: materialTextSecondary),
                textAlign: TextAlign.start,
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  MaterialConditionBadge(
                    label: material.conditionLabel.resolve(context),
                    tone: material.conditionTone,
                  ),
                  MaterialStatusBadge(
                    label: material.statusLabel.resolve(context),
                    tone: material.statusTone,
                  ),
                  MaterialPriceBadge(
                    label: material.priceLabel.resolve(context),
                    isFree: material.isFree,
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SectionTitle(
                title: const LocalizedText(
                  en: 'Material Details',
                  ar: 'تفاصيل المادة',
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              _InfoRow(
                icon: Icons.straighten_rounded,
                label: const LocalizedText(
                  en: 'Quantity',
                  ar: 'الكمية',
                ).resolve(context),
                value: material.quantityLabel.resolve(context),
              ),
              const SizedBox(height: AppSpacing.md),
              _InfoRow(
                icon: Icons.location_on_outlined,
                label: const LocalizedText(
                  en: 'Location',
                  ar: 'الموقع',
                ).resolve(context),
                value: material.locationLabel.resolve(context),
              ),
              const SizedBox(height: AppSpacing.md),
              _InfoRow(
                icon: material.deliveryAvailable
                    ? Icons.local_shipping_outlined
                    : Icons.storefront_outlined,
                label: const LocalizedText(
                  en: 'Delivery',
                  ar: 'التوصيل',
                ).resolve(context),
                value: material.availabilityLabel.resolve(context),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        const NearbyMapPlaceholder(
          title: LocalizedText(
            en: 'Nearby Map Preview',
            ar: 'معاينة الخريطة القريبة',
          ),
          subtitle: LocalizedText(
            en: 'Exact public coordinates remain hidden until reservation logic exists.',
            ar: 'تبقى الإحداثيات العامة الدقيقة مخفية حتى يوجد منطق حجز فعلي.',
          ),
        ),
      ],
    );
  }
}

class _DetailsSideColumn extends StatelessWidget {
  const _DetailsSideColumn({required this.materialId});

  final String materialId;

  @override
  Widget build(BuildContext context) {
    final material = mockMaterialById(materialId)!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SectionTitle(
                title: const LocalizedText(
                  en: 'Supplier',
                  ar: 'المورد',
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: materialMint.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.apartment_rounded,
                      color: materialMint,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          material.supplierName.resolve(context),
                          style: AppTextStyles.title(
                            context,
                          ).copyWith(color: materialTextPrimary),
                          textAlign: TextAlign.start,
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          material.supplierSubtitle.resolve(context),
                          style: AppTextStyles.body(
                            context,
                          ).copyWith(color: materialTextSecondary),
                          textAlign: TextAlign.start,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (material.ratingLabel != null) ...[
                const SizedBox(height: AppSpacing.md),
                Container(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                    decoration: BoxDecoration(
                      color: materialCardSurfaceAlt,
                      borderRadius: AppRadius.pillAll,
                      border: Border.all(color: materialBorderStrong),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                      const Icon(Icons.star_rounded, color: materialLime),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        LocalizedText(
                          en: '${material.ratingLabel!.resolve(context)} supplier rating',
                          ar: 'تقييم المورد ${material.ratingLabel!.resolve(context)}',
                        ).resolve(context),
                        style: AppTextStyles.label(
                          context,
                        ).copyWith(color: materialTextPrimary),
                        textAlign: TextAlign.start,
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _SectionTitle(
                title: const LocalizedText(
                  en: 'Reservation',
                  ar: 'الحجز',
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                const LocalizedText(
                  en: 'The button is visual only in this UI mock.',
                  ar: 'هذا الزر بصري فقط ضمن هذا النموذج.',
                ).resolve(context),
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: materialTextSecondary),
                textAlign: TextAlign.start,
              ),
              const SizedBox(height: AppSpacing.md),
              FilledButton.icon(
                onPressed: () {
                  showInfoSnackBar(
                    context,
                    'Reservation flow will be connected later.',
                  );
                },
                style: FilledButton.styleFrom(
                  backgroundColor: materialMint,
                  foregroundColor: materialCtaForeground,
                  minimumSize: const Size.fromHeight(54),
                  shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
                ),
                icon: const Icon(Icons.shopping_bag_outlined),
                label: Text(
                  const LocalizedText(
                    en: 'Reserve Material',
                    ar: 'احجز المادة',
                  ).resolve(context),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: materialPanelSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: materialBorderStrong),
        boxShadow: const [
          BoxShadow(
            color: materialCardShadow,
            blurRadius: 28,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});

  final LocalizedText title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title.resolve(context),
      style: AppTextStyles.title(context).copyWith(color: materialTextPrimary),
      textAlign: TextAlign.start,
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: materialCardSurfaceAlt,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: materialBorderSubtle),
          ),
          child: Icon(icon, color: materialMint, size: 20),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: materialTextSecondary),
                textAlign: TextAlign.start,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                value,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: materialTextPrimary),
                textAlign: TextAlign.start,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
