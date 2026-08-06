import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../deliveries/application/learner_deliveries_provider.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../application/my_reservations_provider.dart';
import '../../data/models/learner_reservation.dart';
import '../widgets/learner_reservation_list_card.dart';
import '../learner_reservation_payment_presentation.dart';
import '../learner_reservation_ui_helpers.dart';

const _learnerReservationsMaxWidth = 1240.0;
const _reservationRefreshInterval = Duration(seconds: 10);
/// Comfort gap above the mobile bottom nav so the last card clears it.
const _listBottomNavClearance = 24.0;

class LearnerReservationsPage extends ConsumerWidget {
  const LearnerReservationsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final authState = ref.watch(authControllerProvider);
    final isLearner = authState.user?.hasRole('LEARNER') == true;

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/home',
            ),
            Expanded(
              child: !isLearner
                  ? SingleChildScrollView(
                      padding: _reservationsScrollPadding(context),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(
                            maxWidth: _learnerReservationsMaxWidth,
                          ),
                          child: _StatePanel(
                            icon: Icons.lock_outline,
                            title: context.l10n.learnerAccountRequired,
                            subtitle:
                                context.l10n.learnerAccountRequiredReservations,
                          ),
                        ),
                      ),
                    )
                  : const _ReservationsContent(),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReservationsContent extends ConsumerStatefulWidget {
  const _ReservationsContent();

  @override
  ConsumerState<_ReservationsContent> createState() =>
      _ReservationsContentState();
}

class _ReservationsContentState extends ConsumerState<_ReservationsContent> {
  LearnerReservationStatusFilter _selectedFilter =
      LearnerReservationStatusFilter.all;
  Timer? _refreshTimer;
  var _hasLoadedOnce = false;

  @override
  void initState() {
    super.initState();
    // Keep existing data visible; avoid forced invalidate on first frame in tests.
    _refreshTimer = Timer.periodic(
      _reservationRefreshInterval,
      (_) => _refreshReservations(),
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  void _refreshReservations() {
    if (!mounted) return;
    ref.invalidate(myReservationsProvider);
    ref.invalidate(learnerDeliveriesProvider);
  }

  Future<void> _onPullToRefresh() async {
    _refreshReservations();
    await ref.read(myReservationsProvider.future);
  }

  @override
  Widget build(BuildContext context) {
    final reservationsAsync = ref.watch(myReservationsProvider);
    final deliveriesAsync = ref.watch(learnerDeliveriesProvider);
    final deliveriesByReservationId = deliveriesAsync.maybeWhen(
      data: _latestDeliveryByReservationId,
      orElse: () => const <String, LearnerDelivery>{},
    );
    final deliveryStateUnavailable = deliveriesAsync.hasError;
    final width = MediaQuery.sizeOf(context).width;
    final compact = width < 720;

    ref.listen(myReservationsProvider, (previous, next) {
      next.whenData((_) {
        if (!_hasLoadedOnce) {
          setState(() => _hasLoadedOnce = true);
        }
      });
    });

    return RefreshIndicator(
      onRefresh: _onPullToRefresh,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: _reservationsScrollPadding(context),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              maxWidth: _learnerReservationsMaxWidth,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _PageHeader(
                  compact: compact,
                  onRefresh: _refreshReservations,
                  refreshing: reservationsAsync.isLoading && _hasLoadedOnce,
                ),
                const SizedBox(height: AppSpacing.md),
                reservationsAsync.maybeWhen(
                  data: (reservations) {
                    if (reservations.isEmpty) {
                      return const SizedBox.shrink();
                    }
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _SummaryStrip(reservations: reservations),
                        const SizedBox(height: AppSpacing.md),
                        _StatusFilterChips(
                          selected: _selectedFilter,
                          onSelected: (filter) =>
                              setState(() => _selectedFilter = filter),
                        ),
                      ],
                    );
                  },
                  orElse: () => const SizedBox.shrink(),
                ),
                const SizedBox(height: AppSpacing.md),
                if (deliveryStateUnavailable) ...[
                  _DeliveryLoadWarning(
                    onRetry: () => ref.invalidate(learnerDeliveriesProvider),
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],
                _ReservationsBody(
                  reservationsAsync: reservationsAsync,
                  selectedFilter: _selectedFilter,
                  deliveriesByReservationId: deliveriesByReservationId,
                  hasLoadedOnce: _hasLoadedOnce,
                  onRetry: () => ref.invalidate(myReservationsProvider),
                  onResetFilter: () => setState(
                    () => _selectedFilter = LearnerReservationStatusFilter.all,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ReservationsBody extends StatelessWidget {
  const _ReservationsBody({
    required this.reservationsAsync,
    required this.selectedFilter,
    required this.deliveriesByReservationId,
    required this.hasLoadedOnce,
    required this.onRetry,
    required this.onResetFilter,
  });

  final AsyncValue<List<LearnerReservation>> reservationsAsync;
  final LearnerReservationStatusFilter selectedFilter;
  final Map<String, LearnerDelivery> deliveriesByReservationId;
  final bool hasLoadedOnce;
  final VoidCallback onRetry;
  final VoidCallback onResetFilter;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    if (reservationsAsync.hasError && !reservationsAsync.hasValue) {
      return _StatePanel(
        icon: Icons.cloud_off_outlined,
        title: l10n.reservationsLoadError,
        subtitle: l10n.tryAgain,
        actionLabel: l10n.tryAgainAction,
        onAction: onRetry,
      );
    }

    if (reservationsAsync.isLoading && !reservationsAsync.hasValue) {
      return hasLoadedOnce
          ? const SizedBox.shrink()
          : const _ReservationsSkeleton();
    }

    final reservations = reservationsAsync.asData?.value;
    if (reservations == null) {
      if (reservationsAsync.hasError) {
        return _StatePanel(
          icon: Icons.cloud_off_outlined,
          title: l10n.reservationsLoadError,
          subtitle: l10n.tryAgain,
          actionLabel: l10n.tryAgainAction,
          onAction: onRetry,
        );
      }
      return const _ReservationsSkeleton();
    }

    if (reservations.isEmpty) {
      return _StatePanel(
        icon: Icons.assignment_turned_in_outlined,
        title: l10n.noReservations,
        subtitle: l10n.noReservationsSubtitle,
        actionLabel: l10n.browseMaterials,
        onAction: () => context.go('/materials'),
      );
    }

    final filtered = reservations
        .where(
          (reservation) =>
              reservationMatchesStatusFilter(reservation, selectedFilter),
        )
        .toList(growable: false);

    if (filtered.isEmpty) {
      return _StatePanel(
        icon: Icons.filter_list_off_outlined,
        title: l10n.noMatchingReservations,
        subtitle: l10n.noMatchingReservationsSubtitle,
        actionLabel: l10n.viewAllReservations,
        onAction: onResetFilter,
      );
    }

    return Column(
      children: [
        ...filtered.map(
          (reservation) => Padding(
            key: ValueKey('reservation-${reservation.id}'),
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: LearnerReservationListCard(
              reservation: reservation,
              delivery: deliveriesByReservationId[reservation.id],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          l10n.reservationsTimezoneNote,
          style: AppTextStyles.label(
            context,
          ).copyWith(color: MaterialsUiPalette.of(context).textMuted),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _PageHeader extends StatelessWidget {
  const _PageHeader({
    required this.compact,
    required this.onRefresh,
    required this.refreshing,
  });

  final bool compact;
  final VoidCallback onRefresh;
  final bool refreshing;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final l10n = context.l10n;

    final refreshIcon = refreshing
        ? SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: colors.primary,
            ),
          )
        : const Icon(Icons.refresh_rounded);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.myReservations,
                style:
                    (compact
                            ? AppTextStyles.title(context).copyWith(fontSize: 24)
                            : AppTextStyles.display(context).copyWith(
                                fontSize: 30,
                              ))
                        .copyWith(
                          color: palette.textPrimary,
                          fontWeight: FontWeight.w700,
                        ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                l10n.reservationsSubtitle,
                style: AppTextStyles.subtitle(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        if (compact)
          SizedBox(
            width: 44,
            height: 44,
            child: IconButton(
              tooltip: l10n.refresh,
              onPressed: onRefresh,
              icon: refreshIcon,
            ),
          )
        else
          TextButton.icon(
            onPressed: onRefresh,
            icon: refreshIcon,
            label: Text(l10n.refresh),
          ),
      ],
    );
  }
}

class _SummaryStrip extends StatelessWidget {
  const _SummaryStrip({required this.reservations});

  final List<LearnerReservation> reservations;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final width = MediaQuery.sizeOf(context).width;
    final counts = _ReservationSummaryCounts.from(reservations);

    final desktopItems = [
      _SummaryItem(
        value: counts.active,
        label: l10n.reservationsSummaryActive,
        icon: Icons.event_available_outlined,
        tone: AppStatusTone.success,
      ),
      _SummaryItem(
        value: counts.actionRequired,
        label: l10n.reservationsSummaryActionRequired,
        icon: Icons.priority_high_rounded,
        tone: AppStatusTone.warning,
        emphasize: true,
      ),
      _SummaryItem(
        value: counts.paymentsRequired,
        label: l10n.reservationsSummaryPaymentsRequired,
        icon: Icons.credit_card_rounded,
        tone: AppStatusTone.danger,
      ),
      _SummaryItem(
        value: counts.deliveries,
        label: l10n.reservationsSummaryDeliveries,
        icon: Icons.local_shipping_outlined,
        tone: AppStatusTone.info,
      ),
      _SummaryItem(
        value: counts.total,
        label: l10n.reservationsSummaryTotal,
        icon: Icons.list_alt_rounded,
        tone: AppStatusTone.neutral,
      ),
    ];

    // Mobile priority: action → payments → active → delivery → total
    final mobileItems = [
      desktopItems[1],
      desktopItems[2],
      desktopItems[0],
      desktopItems[3],
      desktopItems[4],
    ];

    if (width < 600) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SingleChildScrollView(
            key: const Key('reservations-summary-carousel'),
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsetsDirectional.symmetric(horizontal: 16),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < mobileItems.length; i++) ...[
                    if (i > 0) const SizedBox(width: 12),
                    SizedBox(width: 124, child: mobileItems[i]),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Padding(
            padding: const EdgeInsetsDirectional.symmetric(horizontal: 16),
            child: Text(
              l10n.reservationsSummaryLoadedHint,
              style: AppTextStyles.label(
                context,
              ).copyWith(color: MaterialsUiPalette.of(context).textMuted),
            ),
          ),
        ],
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 1000 ? 5 : 3;
        return Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: desktopItems
              .map(
                (item) => SizedBox(
                  width:
                      (constraints.maxWidth -
                          (AppSpacing.sm * (columns - 1))) /
                      columns,
                  child: item,
                ),
              )
              .toList(growable: false),
        );
      },
    );
  }
}

class _ReservationSummaryCounts {
  const _ReservationSummaryCounts({
    required this.active,
    required this.actionRequired,
    required this.paymentsRequired,
    required this.deliveries,
    required this.total,
  });

  final int active;
  final int actionRequired;
  final int paymentsRequired;
  final int deliveries;
  final int total;

  factory _ReservationSummaryCounts.from(
    List<LearnerReservation> reservations,
  ) {
    var active = 0;
    var actionRequired = 0;
    var paymentsRequired = 0;
    var deliveries = 0;

    for (final reservation in reservations) {
      if (reservationMatchesStatusFilter(
        reservation,
        LearnerReservationStatusFilter.active,
      )) {
        active += 1;
      }
      if (learnerReservationNeedsAction(reservation)) {
        actionRequired += 1;
      }
      if (learnerReservationNeedsPaymentAction(reservation)) {
        paymentsRequired += 1;
      }
      if (reservation.isDeliveryFulfillment ||
          reservation.activeDelivery != null) {
        if (!reservation.isCompleted && !reservation.isReadOnlyFinalState) {
          deliveries += 1;
        }
      }
    }

    return _ReservationSummaryCounts(
      active: active,
      actionRequired: actionRequired,
      paymentsRequired: paymentsRequired,
      deliveries: deliveries,
      total: reservations.length,
    );
  }
}

class _SummaryItem extends StatelessWidget {
  const _SummaryItem({
    required this.value,
    required this.label,
    required this.icon,
    required this.tone,
    this.emphasize = false,
  });

  final int value;
  final String label;
  final IconData icon;
  final AppStatusTone tone;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final style = AppStatusStyle.of(context, tone);

    return Semantics(
      label: '$label: $value',
      child: Container(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: emphasize ? style.background : palette.cardSurface,
          borderRadius: AppRadius.mdAll,
          border: Border.all(
            color: emphasize
                ? style.foreground.withValues(alpha: 0.35)
                : palette.borderSubtle,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$value',
                    style: AppTextStyles.title(context).copyWith(
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    label,
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textSecondary,
                      fontWeight:
                          emphasize ? FontWeight.w600 : FontWeight.w500,
                      fontSize: 12,
                      height: 1.2,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 4),
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: style.background,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 14, color: style.foreground),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusFilterChips extends StatelessWidget {
  const _StatusFilterChips({required this.selected, required this.onSelected});

  final LearnerReservationStatusFilter selected;
  final ValueChanged<LearnerReservationStatusFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final l10n = context.l10n;

    final chips = LearnerReservationStatusFilter.values.map((filter) {
      final isSelected = filter == selected;
      return Padding(
        padding: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
        child: Semantics(
          button: true,
          selected: isSelected,
          label: filter.labelFor(l10n),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => onSelected(filter),
              borderRadius: AppRadius.pillAll,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 44),
                child: Ink(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected ? colors.primary : palette.panelSurface,
                    borderRadius: AppRadius.pillAll,
                    border: Border.all(
                      color: isSelected
                          ? colors.primary
                          : palette.borderSubtle,
                    ),
                  ),
                  child: Center(
                    child: Text(
                      filter.labelFor(l10n),
                      style: AppTextStyles.label(context).copyWith(
                        color: isSelected
                            ? colors.textOnPrimary
                            : palette.textSecondary,
                        fontWeight:
                            isSelected ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }).toList(growable: false);

    final isMobile = MediaQuery.sizeOf(context).width < 600;

    if (isMobile) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.symmetric(horizontal: 16),
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: Icon(
                Icons.filter_list_rounded,
                size: 20,
                color: palette.textMuted,
                semanticLabel: l10n.reservationsFilter,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          SizedBox(
            height: 48,
            child: ListView(
              key: const Key('reservations-filter-carousel'),
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsetsDirectional.symmetric(horizontal: 16),
              children: chips,
            ),
          ),
        ],
      );
    }

    return Row(
      children: [
        Icon(Icons.filter_list_rounded, size: 18, color: palette.textMuted),
        const SizedBox(width: AppSpacing.xs),
        Text(
          l10n.reservationsFilter,
          style: AppTextStyles.label(context).copyWith(
            color: palette.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsetsDirectional.only(end: AppSpacing.lg),
            child: Row(children: chips),
          ),
        ),
      ],
    );
  }
}

class _ReservationsSkeleton extends StatelessWidget {
  const _ReservationsSkeleton();

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Semantics(
      label: context.l10n.skeletonLoadingReservations,
      child: Column(
        children: List.generate(3, (index) {
          return Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: Container(
              height: 148,
              decoration: BoxDecoration(
                color: palette.cardSurface,
                borderRadius: AppRadius.lgAll,
                border: Border.all(color: palette.borderSubtle),
              ),
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: palette.inputSurface,
                      borderRadius: AppRadius.mdAll,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          height: 14,
                          width: double.infinity,
                          color: palette.inputSurface,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Container(
                          height: 12,
                          width: 160,
                          color: palette.inputSurface,
                        ),
                        const Spacer(),
                        Container(
                          height: 36,
                          width: double.infinity,
                          color: palette.inputSurface,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _StatePanel extends StatelessWidget {
  const _StatePanel({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Column(
        children: [
          Icon(icon, color: palette.mint, size: 34),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            subtitle,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
            textAlign: TextAlign.center,
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.lg),
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}

class _DeliveryLoadWarning extends StatelessWidget {
  const _DeliveryLoadWarning({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Row(
        children: [
          Icon(Icons.sync_problem_outlined, color: palette.textMuted),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              context.l10n.deliveryUpdatesUnavailable,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
          ),
          TextButton(onPressed: onRetry, child: Text(context.l10n.retry)),
        ],
      ),
    );
  }
}

Map<String, LearnerDelivery> _latestDeliveryByReservationId(
  List<LearnerDelivery> deliveries,
) {
  final result = <String, LearnerDelivery>{};

  for (final delivery in deliveries) {
    final current = result[delivery.reservationId];
    if (current == null || delivery.requestedAt.isAfter(current.requestedAt)) {
      result[delivery.reservationId] = delivery;
    }
  }

  return result;
}

EdgeInsetsDirectional _reservationsScrollPadding(BuildContext context) {
  final isMobile = MediaQuery.sizeOf(context).width < 600;
  final safeBottom = MediaQuery.paddingOf(context).bottom;
  final bottom = isMobile
      ? AppSpacing.xl +
          appMobileBottomNavReservedHeight +
          safeBottom +
          _listBottomNavClearance
      : AppSpacing.xl;

  return EdgeInsetsDirectional.fromSTEB(
    AppSpacing.md,
    AppSpacing.md,
    AppSpacing.md,
    bottom,
  );
}
