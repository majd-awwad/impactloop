import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../../core/polling/lifecycle_polling_controller.dart';
import '../../../../core/polling/lifecycle_polling_host.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../../deliveries/application/learner_deliveries_provider.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../application/learner_reservation_provider.dart';
import '../../data/models/learner_reservation.dart';
import '../../application/learner_reservation_refresh.dart';
import '../detail/reservation_detail_sticky_action_bar.dart';
import '../widgets/learner_reservation_details_body.dart';

const _detailMaxWidth = 1240.0;

class LearnerReservationDetailPage extends ConsumerWidget {
  const LearnerReservationDetailPage({
    super.key,
    required this.reservationId,
    this.focusPayment = false,
    this.focusPaymentOrderId,
    this.focusSection,
  });

  final String reservationId;
  final bool focusPayment;
  final String? focusPaymentOrderId;
  final String? focusSection;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final isLearner =
        ref.watch(authControllerProvider).user?.hasRole('LEARNER') == true;
    final normalizedFocus =
        (focusSection ?? (focusPayment ? 'payment' : null))?.toLowerCase();

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
                  ? Center(
                      child: Padding(
                        padding: appMobileAwareScrollPadding(context),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(
                            maxWidth: _detailMaxWidth,
                          ),
                          child: _DetailStatePanel(
                            icon: Icons.lock_outline,
                            title: l10n.learnerAccountRequired,
                            subtitle: l10n.learnerAccountRequiredReservations,
                          ),
                        ),
                      ),
                    )
                  : _ReservationDetailContent(
                      reservationId: reservationId,
                      focusSection: normalizedFocus,
                      focusPayment: normalizedFocus == 'payment',
                      focusPaymentOrderId: focusPaymentOrderId,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReservationDetailContent extends ConsumerStatefulWidget {
  const _ReservationDetailContent({
    required this.reservationId,
    required this.focusPayment,
    required this.focusPaymentOrderId,
    this.focusSection,
  });

  final String reservationId;
  final bool focusPayment;
  final String? focusPaymentOrderId;
  final String? focusSection;

  @override
  ConsumerState<_ReservationDetailContent> createState() =>
      _ReservationDetailContentState();
}

class _ReservationDetailContentState
    extends ConsumerState<_ReservationDetailContent>
    with WidgetsBindingObserver, LifecyclePollingHost<_ReservationDetailContent> {
  String? _checkoutableOrderId;
  final _pickupCodeSectionKey = GlobalKey();

  late final LifecyclePollingController _refreshController =
      LifecyclePollingController(
        interval: learnerReservationRefreshInterval,
        onRefresh: _refresh,
      );

  @override
  LifecyclePollingController get lifecyclePollingController =>
      _refreshController;

  @override
  void initState() {
    super.initState();
    initLifecyclePollingHost();
    _checkoutableOrderId = widget.focusPaymentOrderId;
    Future.microtask(_refresh);
  }

  @override
  void didUpdateWidget(covariant _ReservationDetailContent oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.focusPaymentOrderId != null &&
        widget.focusPaymentOrderId != oldWidget.focusPaymentOrderId) {
      _checkoutableOrderId = widget.focusPaymentOrderId;
    }
  }

  @override
  void dispose() {
    disposeLifecyclePollingHost();
    super.dispose();
  }

  @override
  void onLifecyclePollingRouteVisible() {
    _refresh();
  }

  @override
  void onLifecyclePollingAppResumed() {
    _refresh();
  }

  void _syncReservationPolling(
    LearnerReservation reservation,
    List<LearnerDelivery> deliveries,
  ) {
    _refreshController.syncEnabled(
      learnerReservationDetailNeedsActiveRefresh(reservation, deliveries),
    );
  }

  void _refresh() {
    if (!mounted) return;
    ref.invalidate(learnerReservationProvider(widget.reservationId));
    ref.invalidate(learnerDeliveriesProvider);
  }

  void _onCheckoutOrder(String orderId) {
    setState(() => _checkoutableOrderId = orderId);
    context.push(learnerReservationCheckoutRoute(widget.reservationId));
  }

  void _scrollToPickupCode() {
    final ctx = _pickupCodeSectionKey.currentContext;
    if (ctx != null) {
      Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final reservationAsync = ref.watch(
      learnerReservationProvider(widget.reservationId),
    );
    final deliveriesAsync = ref.watch(learnerDeliveriesProvider);
    final width = MediaQuery.sizeOf(context).width;
    final compact = width < 720;
    final showStickyOnMobile = width < 600;

    ref.listen(learnerReservationProvider(widget.reservationId), (
      previous,
      next,
    ) {
      final reservation = next.asData?.value;
      final deliveries = ref.read(learnerDeliveriesProvider).asData?.value;
      if (reservation != null && deliveries != null) {
        _syncReservationPolling(reservation, deliveries);
      }
    });

    ref.listen(learnerDeliveriesProvider, (previous, next) {
      final deliveries = next.asData?.value;
      final reservation = ref
          .read(learnerReservationProvider(widget.reservationId))
          .asData
          ?.value;
      if (reservation != null && deliveries != null) {
        _syncReservationPolling(reservation, deliveries);
      }
    });

    return Column(
      key: const Key('reservation-details-layout'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: SingleChildScrollView(
            // Detail route is outside the mobile nav shell — do not reserve
            // bottom-nav height that is not present on this page.
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.xl,
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: _detailMaxWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              TextButton.icon(
                                onPressed: () =>
                                    context.popOrGo('/learner/reservations'),
                                style: AppStatusButtonStyle.text(
                                  context,
                                  AppStatusTone.neutral,
                                ),
                                icon: const Icon(
                                  Icons.arrow_back_rounded,
                                  size: 18,
                                ),
                                label: Text(l10n.allReservations),
                              ),
                              const SizedBox(height: AppSpacing.xs),
                              Text(
                                l10n.reservationDetailsTitle,
                                style:
                                    (compact
                                            ? AppTextStyles.title(context)
                                            : AppTextStyles.display(context))
                                        .copyWith(color: palette.textPrimary),
                              ),
                            ],
                          ),
                        ),
                        if (compact)
                          SizedBox(
                            width: 44,
                            height: 44,
                            child: IconButton(
                              tooltip: l10n.refresh,
                              onPressed: _refresh,
                              icon: const Icon(Icons.refresh_rounded),
                            ),
                          )
                        else
                          TextButton.icon(
                            onPressed: _refresh,
                            style: AppStatusButtonStyle.text(
                              context,
                              AppStatusTone.info,
                            ),
                            icon: const Icon(Icons.refresh_rounded, size: 18),
                            label: Text(l10n.refresh),
                          ),
                      ],
                    ),
                    if (widget.focusPayment &&
                        _checkoutableOrderId != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        l10n.checkoutableOrderReadyHint,
                        key: Key('checkoutable-order-$_checkoutableOrderId'),
                        style: AppTextStyles.label(
                          context,
                        ).copyWith(color: palette.textMuted),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),
                    reservationAsync.when(
                      skipLoadingOnReload: true,
                      skipLoadingOnRefresh: true,
                      loading: () => const _DetailSkeleton(),
                      error: (_, _) => _DetailStatePanel(
                        icon: Icons.cloud_off_outlined,
                        title: l10n.reservationLoadError,
                        subtitle: l10n.tryAgain,
                        actionLabel: l10n.tryAgainAction,
                        onAction: _refresh,
                      ),
                      data: (reservation) {
                        final delivery = deliveriesAsync.maybeWhen(
                          data: (deliveries) => _latestDeliveryForReservation(
                            deliveries,
                            reservation.id,
                          ),
                          orElse: () => null,
                        );

                        final orderId =
                            widget.focusPaymentOrderId ??
                            reservation.paymentSummary?.checkoutableOrderId;

                        if (orderId != null && _checkoutableOrderId == null) {
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            if (mounted && _checkoutableOrderId == null) {
                              setState(() => _checkoutableOrderId = orderId);
                            }
                          });
                        }

                        return LearnerReservationDetailsBody(
                          key: const Key('reservation-details-body'),
                          reservation: reservation,
                          delivery: delivery,
                          highlightPayment: widget.focusPayment,
                          focusPaymentOrderId: orderId,
                          focusSection: widget.focusSection,
                          onCheckoutOrder: _onCheckoutOrder,
                          pickupCodeSectionKey: _pickupCodeSectionKey,
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        reservationAsync.maybeWhen(
          skipLoadingOnReload: true,
          skipLoadingOnRefresh: true,
          data: (reservation) {
            final delivery = deliveriesAsync.maybeWhen(
              data: (deliveries) =>
                  _latestDeliveryForReservation(deliveries, reservation.id),
              orElse: () => null,
            );

            if (!showStickyOnMobile ||
                !shouldShowReservationDetailStickyBar(
                  reservation,
                  delivery: delivery,
                )) {
              return const SizedBox.shrink();
            }

            return ReservationDetailStickyActionBar(
              reservation: reservation,
              delivery: delivery,
              onCheckoutOrder: _onCheckoutOrder,
              onScrollToPickupCode: _scrollToPickupCode,
            );
          },
          orElse: () => const SizedBox.shrink(),
        ),
      ],
    );
  }
}

LearnerDelivery? _latestDeliveryForReservation(
  List<LearnerDelivery> deliveries,
  String reservationId,
) {
  LearnerDelivery? latest;

  for (final delivery in deliveries) {
    if (delivery.reservationId != reservationId) {
      continue;
    }

    if (latest == null || delivery.requestedAt.isAfter(latest.requestedAt)) {
      latest = delivery;
    }
  }

  return latest;
}

class _DetailStatePanel extends StatelessWidget {
  const _DetailStatePanel({
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
        borderRadius: BorderRadius.circular(16),
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
            FilledButton(
              onPressed: onAction,
              style: AppStatusButtonStyle.filled(
                context,
                AppStatusTone.primary,
              ),
              child: Text(actionLabel!),
            ),
          ],
        ],
      ),
    );
  }
}

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton();

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          height: 180,
          decoration: BoxDecoration(
            color: palette.inputSurface,
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Container(
          height: 120,
          decoration: BoxDecoration(
            color: palette.inputSurface,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Container(
          height: 220,
          decoration: BoxDecoration(
            color: palette.inputSurface,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ],
    );
  }
}
