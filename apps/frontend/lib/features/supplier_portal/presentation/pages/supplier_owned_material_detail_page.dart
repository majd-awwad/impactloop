import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../../shared/widgets/materials/material_price_badge.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../application/supplier_my_materials_providers.dart';
import '../../data/models/supplier_my_materials_models.dart';
import '../../data/supplier_my_materials_repository.dart';
import '../theme/supplier_theme_extension.dart';
import '../supplier_reservation_ui_helpers.dart';
import '../widgets/materials/supplier_material_delete_helper.dart';
import '../widgets/materials/supplier_material_edit_helper.dart';
import '../widgets/materials/supplier_material_label_helper.dart';
import '../widgets/materials/supplier_my_materials_colors.dart';

const _contentMaxWidth = 1360.0;
const _desktopBreakpoint = 980.0;
const _wideMetricsBreakpoint = 1000.0;

class SupplierOwnedMaterialDetailPage extends ConsumerWidget {
  const SupplierOwnedMaterialDetailPage({super.key, required this.materialId});

  final String materialId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.s;
    final materialAsync = ref.watch(supplierMyMaterialByIdProvider(materialId));

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _contentMaxWidth),
        child: materialAsync.when(
          loading: _WorkspaceSkeleton.new,
          error: (error, _) => _ErrorPanel(
            isNotFound: error is ApiException && error.statusCode == 404,
            message: l.myMaterialsLoadError,
            onRetry: () {
              ref.invalidate(supplierMyMaterialsProvider);
              ref.invalidate(supplierMyMaterialByIdProvider(materialId));
            },
          ),
          data: (material) =>
              _MaterialWorkspace(material: material, materialId: materialId),
        ),
      ),
    );
  }
}

class _MaterialWorkspace extends ConsumerStatefulWidget {
  const _MaterialWorkspace({required this.material, required this.materialId});

  final SupplierMyMaterial material;
  final String materialId;

  @override
  ConsumerState<_MaterialWorkspace> createState() => _MaterialWorkspaceState();
}

class _MaterialWorkspaceState extends ConsumerState<_MaterialWorkspace> {
  bool _statusSubmitting = false;

  Future<void> _refreshMaterial() async {
    ref.invalidate(supplierMyMaterialsProvider);
    ref.invalidate(supplierMyMaterialByIdProvider(widget.materialId));
  }

  Future<void> _markUnavailable() async {
    setState(() => _statusSubmitting = true);
    try {
      await ref
          .read(supplierMyMaterialsRepositoryProvider)
          .markMaterialUnavailable(widget.materialId);
      await _refreshMaterial();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(context.s.markUnavailableAction)));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.displayMessage),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _statusSubmitting = false);
    }
  }

  Future<void> _restoreAvailable() async {
    setState(() => _statusSubmitting = true);
    try {
      await ref
          .read(supplierMyMaterialsRepositoryProvider)
          .restoreMaterialAvailable(widget.materialId);
      await _refreshMaterial();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(context.s.restoreAvailableAction)));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.displayMessage),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _statusSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final material = widget.material;
    final l = context.s;
    final deleteBlockedMessage = supplierMaterialDeleteBlockedMessage(
      l,
      material.deleteBlockedReason,
    );
    final editBlockedMessage = supplierMaterialEditBlockedMessage(
      l,
      material.editBlockedReason,
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final desktop = constraints.maxWidth >= _desktopBreakpoint;

        return Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _Breadcrumb(onBack: _goBack),
                    const SizedBox(height: AppSpacing.md),
                    _MaterialHero(material: material, desktop: desktop),
                    const SizedBox(height: AppSpacing.md),
                    _MetricGrid(material: material),
                    const SizedBox(height: AppSpacing.md),
                    _ManagementGrid(material: material, desktop: desktop),
                    const SizedBox(height: AppSpacing.xl),
                  ],
                ),
              ),
            ),
            _ActionFooter(
              material: material,
              statusSubmitting: _statusSubmitting,
              deleteBlockedMessage: deleteBlockedMessage,
              editBlockedMessage: editBlockedMessage,
              onBack: _goBack,
              onEdit: () =>
                  context.push('/supplier/materials/${material.id}/edit'),
              onDelete: () => handleSupplierMaterialDelete(
                context: context,
                ref: ref,
                material: material,
              ),
              onMarkUnavailable: _markUnavailable,
              onRestoreAvailable: _restoreAvailable,
            ),
          ],
        );
      },
    );
  }

  void _goBack() => context.popOrGo('/supplier/materials');
}

class _Breadcrumb extends StatelessWidget {
  const _Breadcrumb({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final style = context.supplierBody();

    return LayoutBuilder(
      builder: (context, constraints) => Semantics(
        label: l.backToMyMaterials,
        child: constraints.maxWidth < 600
            ? TextButton.icon(
                onPressed: onBack,
                icon: const BackButtonIcon(),
                label: Text(l.backToMyMaterials),
              )
            : Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: AppSpacing.xs,
                children: [
                  TextButton.icon(
                    onPressed: onBack,
                    icon: const BackButtonIcon(),
                    label: Text(l.navMyMaterials),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: context.supplierColors.textMuted,
                  ),
                  Text(
                    l.manageMaterial,
                    style: style.copyWith(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
      ),
    );
  }
}

class _MaterialHero extends StatelessWidget {
  const _MaterialHero({required this.material, required this.desktop});

  final SupplierMyMaterial material;
  final bool desktop;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final l10n = context.l10n;
    final colors = context.supplierColors;
    final isArabic = l.isArabic;
    final statusTone = SupplierMaterialLabelHelper.statusMeta(
      material.status,
    ).tone;
    final conditionTone = SupplierMaterialLabelHelper.conditionMeta(
      material.condition,
    ).tone;
    final category = isArabic
        ? material.category.nameAr
        : material.category.nameEn;
    final image = material.coverImageUrl;

    final imagePanel = ClipRRect(
      borderRadius: AppRadius.lgAll,
      child: SizedBox(
        height: desktop ? 238 : 220,
        width: desktop ? 350 : double.infinity,
        child: image == null || image.isEmpty
            ? ColoredBox(
                color: colors.chipUnselected,
                child: Icon(
                  Icons.image_outlined,
                  size: 52,
                  color: colors.textMuted,
                ),
              )
            : Image.network(
                ApiConfig.resolveMediaUrl(image),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => ColoredBox(
                  color: colors.chipUnselected,
                  child: Icon(
                    Icons.image_outlined,
                    size: 52,
                    color: colors.textMuted,
                  ),
                ),
              ),
      ),
    );

    final details = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          category,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: context.supplierChip().copyWith(color: colors.accent),
        ),
        const SizedBox(height: AppSpacing.xs),
        Tooltip(
          message: material.title,
          child: Text(
            material.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: context.supplierTitle().copyWith(fontSize: 24),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          children: [
            MaterialStatusBadge(
              label: SupplierMaterialLabelHelper.statusText(
                material.status,
                l10n,
              ),
              tone: statusTone,
            ),
            MaterialConditionBadge(
              label: SupplierMaterialLabelHelper.conditionText(
                material.condition,
                l10n,
              ),
              tone: conditionTone,
            ),
            MaterialPriceBadge(
              label: SupplierMaterialLabelHelper.priceText(
                isFree: material.isFree,
                price: material.price,
                currency: material.currency,
                l10n: l10n,
              ),
              isFree: material.isFree,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          material.description,
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
          style: context.supplierBody().copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.md),
        _MetadataStrip(material: material, desktop: desktop),
      ],
    );

    return _SurfaceCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: desktop
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                imagePanel,
                const SizedBox(width: AppSpacing.lg),
                Expanded(child: details),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                imagePanel,
                const SizedBox(height: AppSpacing.lg),
                details,
              ],
            ),
    );
  }
}

class _MetadataStrip extends StatelessWidget {
  const _MetadataStrip({required this.material, required this.desktop});

  final SupplierMyMaterial material;
  final bool desktop;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final l10n = context.l10n;
    final isArabic = l.isArabic;
    final formatters = LocalizedFormatters(l10n);
    final metadata = [
      _MetadataItem(
        icon: Icons.inventory_2_outlined,
        text: SupplierMaterialLabelHelper.stockText(
          quantity: material.quantity,
          availableQuantity: material.availableQuantity ?? material.quantity,
          unit: material.unit,
          l10n: l10n,
        ),
      ),
      _MetadataItem(
        icon: Icons.location_on_outlined,
        text: SupplierMaterialLabelHelper.resolveText(
          SupplierMaterialLabelHelper.locationLabel(
            city: material.location.city,
            area: material.location.area,
          ),
          isArabic,
        ),
      ),
      _MetadataItem(
        icon: Icons.local_shipping_outlined,
        text: SupplierMaterialLabelHelper.resolveText(
          SupplierMaterialLabelHelper.availabilityLabel(
            pickupAllowed: material.pickupAllowed,
            deliveryAvailable: material.deliveryAllowed,
          ),
          isArabic,
        ),
      ),
      _MetadataItem(
        icon: Icons.schedule_outlined,
        text:
            '${l.createdLabel}: ${formatters.date(material.createdAt)}\n${l.updatedLabel}: ${formatters.date(material.updatedAt)}',
      ),
    ];

    if (!desktop) {
      return LayoutBuilder(
        builder: (context, constraints) {
          final itemWidth = (constraints.maxWidth - AppSpacing.md) / 2;
          return Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.sm,
            children: metadata
                .map((item) => SizedBox(width: itemWidth, child: item))
                .toList(growable: false),
          );
        },
      );
    }

    return Container(
      padding: const EdgeInsets.only(top: AppSpacing.md),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: context.supplierColors.border)),
      ),
      child: Row(
        children: [
          for (var index = 0; index < metadata.length; index++) ...[
            Expanded(child: metadata[index]),
            if (index < metadata.length - 1)
              Container(
                height: 34,
                width: 1,
                color: context.supplierColors.border,
              ),
          ],
        ],
      ),
    );
  }
}

class _MetadataItem extends StatelessWidget {
  const _MetadataItem({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 17, color: colors.textMuted),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Text(
              text,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: context.supplierBody().copyWith(
                color: colors.textSecondary,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.material});

  final SupplierMyMaterial material;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final metrics = [
      _Metric(
        Icons.visibility_outlined,
        '${material.viewsCount}',
        l.viewsLabel,
        _MetricTone.green,
      ),
      _Metric(
        Icons.favorite_border,
        '${material.likesCount}',
        l.likesLabel,
        _MetricTone.pink,
      ),
      _Metric(
        Icons.swap_horiz_rounded,
        '${material.totalActiveRequests}',
        l.totalActiveRequestsLabel,
        _MetricTone.amber,
      ),
      _Metric(
        Icons.schedule_outlined,
        '${material.pendingReservationsCount}',
        l.pendingReservationsLabel,
        _MetricTone.blue,
      ),
      _Metric(
        Icons.bookmark_border_rounded,
        '${material.reservedReservationsCount}',
        l.reservedReservationsLabel,
        _MetricTone.teal,
      ),
      _Metric(
        Icons.trending_up_rounded,
        l.overallDemandScoreValue(material.demandScorePercent),
        l.overallDemandScoreLabel,
        _MetricTone.green,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= _wideMetricsBreakpoint
            ? 6
            : constraints.maxWidth >= 620
            ? 3
            : constraints.maxWidth >= 420
            ? 2
            : 1;
        const gap = AppSpacing.sm;
        final itemWidth =
            (constraints.maxWidth - gap * (columns - 1)) / columns;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: metrics
              .map(
                (metric) => SizedBox(
                  width: itemWidth,
                  child: _MetricCard(metric: metric),
                ),
              )
              .toList(growable: false),
        );
      },
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.metric});

  final _Metric metric;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final color = switch (metric.tone) {
      _MetricTone.green => colors.accent,
      _MetricTone.pink => Theme.of(context).colorScheme.error,
      _MetricTone.amber => Theme.of(context).colorScheme.tertiary,
      _MetricTone.blue => Theme.of(context).colorScheme.primary,
      _MetricTone.teal => colors.accent,
    };
    return _SurfaceCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: SizedBox(
        height: 62,
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.10),
                borderRadius: AppRadius.mdAll,
              ),
              child: Icon(metric.icon, color: color, size: 20),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    metric.value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.supplierSectionTitle().copyWith(
                      fontSize: 19,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    metric.label,
                    maxLines: 2,
                    style: context.supplierBody().copyWith(
                      color: colors.textSecondary,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ManagementGrid extends StatelessWidget {
  const _ManagementGrid({required this.material, required this.desktop});

  final SupplierMyMaterial material;
  final bool desktop;

  @override
  Widget build(BuildContext context) {
    final cards = [
      _ActiveDemandCard(material: material),
      _DemandScoreCard(material: material),
      _ReuseHistoryCard(material: material),
      _ReservationsCard(material: material),
    ];

    if (!desktop) {
      return Column(
        children: [
          for (var index = 0; index < cards.length; index++) ...[
            cards[index],
            if (index < cards.length - 1) const SizedBox(height: AppSpacing.md),
          ],
        ],
      );
    }

    return Column(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: cards[0]),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: cards[1]),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: cards[2]),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: cards[3]),
          ],
        ),
      ],
    );
  }
}

class _ActiveDemandCard extends StatelessWidget {
  const _ActiveDemandCard({required this.material});

  final SupplierMyMaterial material;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    return _SectionCard(
      icon: Icons.trending_up_rounded,
      title: l.activeDemandSectionTitle,
      child: Column(
        children: [
          _MetricRow(
            label: l.pendingReservationsLabel,
            value: '${material.pendingReservationsCount}',
          ),
          _MetricRow(
            label: l.reservedReservationsLabel,
            value: '${material.reservedReservationsCount}',
          ),
          const Divider(height: AppSpacing.lg),
          _MetricRow(
            label: l.totalActiveRequestsLabel,
            value: '${material.totalActiveRequests}',
            emphasized: true,
          ),
          _MetricRow(
            label: l.activeDemandScoreLabel,
            value: '${material.activeDemandScore}',
            emphasized: true,
          ),
        ],
      ),
    );
  }
}

class _DemandScoreCard extends StatelessWidget {
  const _DemandScoreCard({required this.material});

  final SupplierMyMaterial material;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final score = material.demandScorePercent.clamp(0, 100);
    final hasDemand =
        material.totalActiveRequests > 0 ||
        material.demandScorePercent > 0 ||
        material.completedReservationsCount > 0;

    return _SectionCard(
      icon: Icons.insights_outlined,
      title: l.interestScoreSectionTitle,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.overallDemandScoreLabel, style: context.supplierBody()),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  l.demandScoreExplanation,
                  style: context.supplierBody().copyWith(
                    color: colors.textSecondary,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  l.materialDemandStatusMessage(
                    activeRequestsCount: material.totalActiveRequests,
                    completedReservationsCount:
                        material.completedReservationsCount,
                    demandScorePercent: material.demandScorePercent,
                    viewsCount: material.viewsCount,
                    likesCount: material.likesCount,
                  ),
                  style: context.supplierBody().copyWith(
                    color: hasDemand ? colors.accent : colors.textMuted,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Semantics(
            label:
                '${l.overallDemandScoreLabel}: ${l.overallDemandScoreValue(material.demandScorePercent)}',
            child: SizedBox(
              width: 94,
              height: 94,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 82,
                    height: 82,
                    child: CircularProgressIndicator(
                      value: score / 100,
                      strokeWidth: 10,
                      backgroundColor: colors.border.withValues(alpha: 0.55),
                      valueColor: AlwaysStoppedAnimation(colors.accent),
                    ),
                  ),
                  Text(
                    l.overallDemandScoreValue(material.demandScorePercent),
                    style: context.supplierSectionTitle().copyWith(
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReuseHistoryCard extends StatelessWidget {
  const _ReuseHistoryCard({required this.material});

  final SupplierMyMaterial material;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final formatters = LocalizedFormatters(context.l10n);
    final empty =
        material.completedReservationsCount == 0 && material.reusedCount == 0;
    return _SectionCard(
      icon: Icons.recycling_outlined,
      title: l.reuseHistorySectionTitle,
      child: Column(
        children: [
          _MetricRow(
            label: l.completedReservationsMetricLabel,
            value: '${material.completedReservationsCount}',
          ),
          _MetricRow(
            label: l.completedReusesMetricLabel,
            value: '${material.reusedCount}',
          ),
          if (material.lastCompletedAt != null)
            _MetricRow(
              label: l.lastCompletedLabel,
              value: formatters.date(material.lastCompletedAt!),
            ),
          if (empty) ...[
            const SizedBox(height: AppSpacing.sm),
            _InfoBanner(
              icon: Icons.info_outline_rounded,
              text: l.reuseHistoryWillAppear,
            ),
          ],
        ],
      ),
    );
  }
}

class _ReservationsCard extends StatelessWidget {
  const _ReservationsCard({required this.material});

  final SupplierMyMaterial material;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    return _SectionCard(
      icon: Icons.event_note_outlined,
      title: l.reservationsSectionTitle,
      child: material.reservations.isEmpty
          ? _InfoBanner(
              icon: Icons.info_outline_rounded,
              text: l.noMaterialReservationsYet,
            )
          : Column(
              children: [
                for (
                  var index = 0;
                  index < material.reservations.length;
                  index++
                ) ...[
                  _ReservationCard(reservation: material.reservations[index]),
                  if (index < material.reservations.length - 1)
                    const SizedBox(height: AppSpacing.sm),
                ],
              ],
            ),
    );
  }
}

class _ReservationCard extends StatelessWidget {
  const _ReservationCard({required this.reservation});

  final SupplierMaterialReservationSummary reservation;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final formatters = LocalizedFormatters(context.l10n);
    final learner = reservation.learnerDisplayName?.trim();
    final status = l.reservationStatusLabel(reservation.status);
    final fulfillment = SupplierReservationUiHelpers.of(
      context,
    ).pickupTypeLabel(reservation.fulfillmentLabel);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        border: Border.all(color: colors.border.withValues(alpha: 0.85)),
        borderRadius: AppRadius.mdAll,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.person_outline_rounded, color: colors.textMuted),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  learner == null || learner.isEmpty ? l.learnerLabel : learner,
                  style: context.supplierBody().copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              _ReservationStatusBadge(label: status),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${formatters.quantity(reservation.quantityRequested, reservation.unit)} · $status · ${formatters.date(reservation.createdAt)}',
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 12,
            ),
          ),
          if (fulfillment.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              fulfillment,
              style: context.supplierBody().copyWith(
                color: colors.textMuted,
                fontSize: 12,
              ),
            ),
          ],
          if (reservation.canReview || reservation.canOpen) ...[
            const SizedBox(height: AppSpacing.xs),
            TextButton.icon(
              onPressed: () => context.push(
                reservation.canReview
                    ? '/supplier/reservations?tab=pending&focus=${reservation.id}'
                    : '/supplier/reservations?focus=${reservation.id}',
              ),
              icon: const Icon(Icons.arrow_forward_rounded, size: 16),
              label: Text(
                reservation.canReview
                    ? l.reviewRequestAction
                    : l.openReservationActionLabel,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ReservationStatusBadge extends StatelessWidget {
  const _ReservationStatusBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: colors.chipUnselected,
        borderRadius: AppRadius.mdAll,
      ),
      child: Text(
        label,
        style: context.supplierChip().copyWith(color: colors.textSecondary),
      ),
    );
  }
}

class _ActionFooter extends StatelessWidget {
  const _ActionFooter({
    required this.material,
    required this.statusSubmitting,
    required this.deleteBlockedMessage,
    required this.editBlockedMessage,
    required this.onBack,
    required this.onEdit,
    required this.onDelete,
    required this.onMarkUnavailable,
    required this.onRestoreAvailable,
  });

  final SupplierMyMaterial material;
  final bool statusSubmitting;
  final String deleteBlockedMessage;
  final String editBlockedMessage;
  final VoidCallback onBack;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onMarkUnavailable;
  final VoidCallback onRestoreAvailable;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceSolid,
        border: Border(top: BorderSide(color: colors.border)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.md,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!material.canDelete) ...[
                _InfoBanner(
                  icon: Icons.info_outline_rounded,
                  text: deleteBlockedMessage,
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                runSpacing: AppSpacing.sm,
                spacing: AppSpacing.sm,
                children: [
                  OutlinedButton.icon(
                    onPressed: onBack,
                    icon: const BackButtonIcon(),
                    label: Text(l.backToMyMaterials),
                  ),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      if (material.canMarkUnavailable)
                        OutlinedButton(
                          onPressed: statusSubmitting
                              ? null
                              : onMarkUnavailable,
                          style: AppStatusButtonStyle.outlined(
                            context,
                            AppStatusTone.danger,
                          ),
                          child: statusSubmitting
                              ? const _SmallProgress()
                              : Text(l.markUnavailableAction),
                        ),
                      if (material.canRestoreAvailable)
                        OutlinedButton(
                          onPressed: statusSubmitting
                              ? null
                              : onRestoreAvailable,
                          style: AppStatusButtonStyle.outlined(
                            context,
                            AppStatusTone.primary,
                          ),
                          child: statusSubmitting
                              ? const _SmallProgress()
                              : Text(l.restoreAvailableAction),
                        ),
                      Tooltip(
                        message: material.canEdit ? '' : editBlockedMessage,
                        child: OutlinedButton.icon(
                          onPressed: material.canEdit ? onEdit : null,
                          style: SupplierMyMaterialsColors.editButtonStyle(
                            context,
                            enabled: material.canEdit,
                          ),
                          icon: const Icon(Icons.edit_outlined),
                          label: Text(l.editListing),
                        ),
                      ),
                      Tooltip(
                        message: material.canDelete ? '' : deleteBlockedMessage,
                        child: OutlinedButton.icon(
                          onPressed: material.canDelete ? onDelete : null,
                          style: SupplierMyMaterialsColors.deleteButtonStyle(
                            context,
                            enabled: material.canDelete,
                          ),
                          icon: const Icon(Icons.delete_outline_rounded),
                          label: Text(l.deleteMaterial),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SmallProgress extends StatelessWidget {
  const _SmallProgress();

  @override
  Widget build(BuildContext context) => const SizedBox(
    width: 18,
    height: 18,
    child: CircularProgressIndicator(strokeWidth: 2),
  );
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.icon,
    required this.title,
    required this.child,
  });

  final IconData icon;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return _SurfaceCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.xs),
                decoration: BoxDecoration(
                  color: colors.accent.withValues(alpha: 0.10),
                  borderRadius: AppRadius.smAll,
                ),
                child: Icon(icon, size: 18, color: colors.accent),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(title, style: context.supplierSectionTitle()),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}

class _SurfaceCard extends StatelessWidget {
  const _SurfaceCard({required this.child, required this.padding});

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceSolid,
        border: Border.all(color: colors.border.withValues(alpha: 0.85)),
        borderRadius: AppRadius.lgAll,
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

class _MetricRow extends StatelessWidget {
  const _MetricRow({
    required this.label,
    required this.value,
    this.emphasized = false,
  });

  final String label;
  final String value;
  final bool emphasized;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
    child: Row(
      children: [
        Expanded(child: Text(label, style: context.supplierBody())),
        Text(
          value,
          style: context.supplierBody().copyWith(
            fontWeight: emphasized ? FontWeight.w800 : FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _InfoBanner extends StatelessWidget {
  const _InfoBanner({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.accent.withValues(alpha: 0.07),
        border: Border.all(color: colors.accent.withValues(alpha: 0.16)),
        borderRadius: AppRadius.smAll,
      ),
      child: Row(
        children: [
          Icon(icon, color: colors.accent, size: 17),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              text,
              style: context.supplierBody().copyWith(
                color: colors.textSecondary,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WorkspaceSkeleton extends StatelessWidget {
  const _WorkspaceSkeleton();

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    Widget block({double? height}) => Container(
      height: height,
      decoration: BoxDecoration(
        color: colors.chipUnselected,
        borderRadius: AppRadius.lgAll,
      ),
    );

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          block(height: 34),
          const SizedBox(height: AppSpacing.md),
          block(height: 280),
          const SizedBox(height: AppSpacing.md),
          LayoutBuilder(
            builder: (context, constraints) {
              final width = (constraints.maxWidth - AppSpacing.sm * 5) / 6;
              return Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: List.generate(
                  6,
                  (_) => SizedBox(width: width, child: block(height: 94)),
                ),
              );
            },
          ),
          const SizedBox(height: AppSpacing.md),
          block(height: 180),
          const SizedBox(height: AppSpacing.md),
          block(height: 180),
        ],
      ),
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({
    required this.message,
    required this.onRetry,
    required this.isNotFound,
  });

  final String message;
  final VoidCallback onRetry;
  final bool isNotFound;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.inventory_2_outlined,
              size: 48,
              color: context.supplierColors.textMuted,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              isNotFound ? l.materialNotFoundTitle : message,
              style: context.supplierSectionTitle(),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              isNotFound ? l.materialNotFoundSubtitle : message,
              textAlign: TextAlign.center,
              style: context.supplierBody().copyWith(
                color: context.supplierColors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              children: [
                OutlinedButton(
                  onPressed: () => context.popOrGo('/supplier/materials'),
                  child: Text(l.backToMyMaterials),
                ),
                FilledButton(onPressed: onRetry, child: Text(l.tryAgain)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

enum _MetricTone { green, pink, amber, blue, teal }

class _Metric {
  const _Metric(this.icon, this.value, this.label, this.tone);

  final IconData icon;
  final String value;
  final String label;
  final _MetricTone tone;
}
