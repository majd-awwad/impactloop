import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/app_back_action.dart';
import '../../../../app/router/navigation_extensions.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../application/learner_checkout_controller.dart';
import '../widgets/checkout_amount_summary.dart';
import '../widgets/checkout_mock_provider_panel.dart';
import '../widgets/checkout_reservation_summary_card.dart';
import '../widgets/checkout_result_view.dart';
import '../widgets/checkout_stepper.dart';
import '../widgets/checkout_sticky_action_bar.dart';

class LearnerCheckoutPage extends ConsumerStatefulWidget {
  const LearnerCheckoutPage({super.key, required this.reservationId});

  final String reservationId;

  @override
  ConsumerState<LearnerCheckoutPage> createState() =>
      _LearnerCheckoutPageState();
}

class _LearnerCheckoutPageState extends ConsumerState<LearnerCheckoutPage>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ref
          .read(
            learnerCheckoutControllerProvider(widget.reservationId).notifier,
          )
          .reconcile(soft: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state =
        ref.watch(learnerCheckoutControllerProvider(widget.reservationId));
    final controller = ref.read(
      learnerCheckoutControllerProvider(widget.reservationId).notifier,
    );
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);
    final width = MediaQuery.sizeOf(context).width;
    final isMobile = width < 900;
    final showSticky = isMobile &&
        (state.phase == CheckoutPhase.ready ||
            state.phase == CheckoutPhase.method);
    final stickyPad =
        showSticky ? checkoutStickyContentPadding(context) : AppSpacing.lg;

    return Scaffold(
      backgroundColor: colors.pageBackground,
      appBar: AppBar(
        title: Text(l10n.checkoutPageTitle),
        leading: AppBackAction.compact(onBack: () => _goBack(context, state)),
        actions: [
          if (state.phase != CheckoutPhase.loading)
            IconButton(
              tooltip: l10n.checkoutRetryLoad,
              onPressed: state.submitting ? null : controller.load,
              icon: const Icon(Icons.refresh_rounded),
            ),
        ],
      ),
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: () => controller.reconcile(),
            child: LayoutBuilder(
              builder: (context, constraints) {
                return SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: EdgeInsets.fromLTRB(
                    isMobile ? AppSpacing.md : AppSpacing.lg,
                    AppSpacing.md,
                    isMobile ? AppSpacing.md : AppSpacing.lg,
                    stickyPad,
                  ),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 1180),
                      child: _buildBody(
                        context,
                        state: state,
                        controller: controller,
                        isMobile: isMobile,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          if (state.reviewOpen)
            Positioned.fill(
              child: GestureDetector(
                onTap: state.submitting ? null : controller.closeReview,
                child: ColoredBox(
                  color: colors.overlay.withValues(alpha: 0.35),
                ),
              ),
            ),
          if (state.reviewOpen)
            Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: isMobile ? 0 : AppSpacing.lg,
                  vertical: isMobile ? 0 : AppSpacing.md,
                ),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Material(
                    elevation: 12,
                    shadowColor: colors.overlay.withValues(alpha: 0.28),
                    color: colors.surface,
                    borderRadius: BorderRadius.vertical(
                      top: const Radius.circular(16),
                      bottom: Radius.circular(isMobile ? 0 : 16),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: CheckoutReviewSheet(
                      amount: state.displayPayAmount,
                      session: state.session,
                      submitting: state.submitting,
                      onConfirm: controller.confirmMockPayment,
                      onClose: controller.closeReview,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: showSticky
          ? CheckoutStickyActionBar(
              label: state.phase == CheckoutPhase.method
                  ? l10n.checkoutReviewOrder
                  : l10n.checkoutContinueToPayment,
              loading: state.submitting,
              icon: state.phase == CheckoutPhase.method
                  ? Icons.lock_rounded
                  : Icons.arrow_forward_rounded,
              onPressed: state.blocksDuplicateSubmission
                  ? null
                  : () {
                      if (state.phase == CheckoutPhase.method) {
                        controller.openReview();
                      } else {
                        controller.continueToPayment();
                      }
                    },
            )
          : null,
    );
  }

  Widget _buildBody(
    BuildContext context, {
    required LearnerCheckoutState state,
    required LearnerCheckoutController controller,
    required bool isMobile,
  }) {
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);

    if (state.phase == CheckoutPhase.loading) {
      return SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.55,
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    if (state.phase == CheckoutPhase.error ||
        state.phase == CheckoutPhase.missing ||
        state.phase == CheckoutPhase.processing ||
        state.phase == CheckoutPhase.succeeded ||
        state.phase == CheckoutPhase.alreadyPaid ||
        state.phase == CheckoutPhase.declined ||
        state.phase == CheckoutPhase.cancelled ||
        state.phase == CheckoutPhase.expired ||
        state.phase == CheckoutPhase.partiallyRefunded ||
        state.phase == CheckoutPhase.refunded ||
        state.phase == CheckoutPhase.orderCancelled ||
        state.phase == CheckoutPhase.invariantBlocked) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CheckoutStepper(step: state.step),
          const SizedBox(height: AppSpacing.xl),
          CheckoutResultView(
            phase: state.phase,
            reservationId: state.reservationId,
            sessionId: state.session?.checkoutSessionId,
            failureMessage: state.errorMessage ??
                state.order?.latestTerminalAttempt?.failureMessage,
            onBackToReservation: () => _goToReservation(context, state),
            onViewReservations: () => context.go(learnerReservationsRoute),
            onRetry: controller.retryFromFailure,
            onChangeMethod: () async {
              await controller.retryFromFailure();
              await controller.continueToPayment();
            },
            onRetryLoad: controller.load,
          ),
        ],
      );
    }

    final reservation = state.reservation;
    if (reservation == null && state.requirement == null) {
      return CheckoutResultView(
        phase: CheckoutPhase.missing,
        reservationId: state.reservationId,
        onViewReservations: () => context.go(learnerReservationsRoute),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!isMobile) _Breadcrumbs(state: state),
        if (!isMobile) const SizedBox(height: AppSpacing.md),
        Text(
          l10n.checkoutPageTitle,
          style: AppTextStyles.display(context).copyWith(
            fontSize: isMobile ? 26 : 32,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          l10n.checkoutPageSubtitle,
          style: AppTextStyles.body(context).copyWith(
            color: colors.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        CheckoutStepper(step: state.step),
        if (state.errorMessage != null) ...[
          const SizedBox(height: AppSpacing.md),
          Material(
            color: colors.dangerSoft,
            borderRadius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Text(
                state.errorMessage!,
                style: AppTextStyles.label(context).copyWith(
                  color: colors.danger,
                ),
              ),
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        if (isMobile)
          _MobileCheckoutColumns(
            state: state,
            controller: controller,
            onViewDetails: () => _goToReservation(context, state),
          )
        else
          _DesktopCheckoutColumns(
            state: state,
            controller: controller,
            onViewDetails: () => _goToReservation(context, state),
          ),
        if (!isMobile &&
            (state.phase == CheckoutPhase.ready ||
                state.phase == CheckoutPhase.method)) ...[
          const SizedBox(height: AppSpacing.xl),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 360),
              child: FilledButton.icon(
                key: const Key('checkout_desktop_primary'),
                onPressed: state.blocksDuplicateSubmission
                    ? null
                    : () {
                        if (state.phase == CheckoutPhase.method) {
                          controller.openReview();
                        } else {
                          controller.continueToPayment();
                        }
                      },
                icon: state.submitting
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: colors.textOnPrimary,
                        ),
                      )
                    : Icon(
                        state.phase == CheckoutPhase.method
                            ? Icons.lock_rounded
                            : Icons.arrow_forward_rounded,
                        size: 18,
                      ),
                label: Text(
                  state.phase == CheckoutPhase.method
                      ? l10n.checkoutReviewOrder
                      : l10n.checkoutContinueToPayment,
                ),
                style: AppStatusButtonStyle.filled(
                  context,
                  AppStatusTone.primary,
                ).copyWith(
                  minimumSize:
                      const WidgetStatePropertyAll(Size.fromHeight(50)),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Future<void> _goBack(BuildContext context, LearnerCheckoutState state) async {
    final fallback = state.reservationId.isNotEmpty
        ? learnerReservationDetailRoute(state.reservationId)
        : learnerReservationsRoute;
    await context.popOrGo(fallback);
  }

  void _goToReservation(BuildContext context, LearnerCheckoutState state) {
    final reservationId = state.reservationId;
    if (reservationId.isNotEmpty) {
      context.go(learnerReservationDetailRoute(reservationId));
      return;
    }
    context.go(learnerReservationsRoute);
  }
}

class _Breadcrumbs extends StatelessWidget {
  const _Breadcrumbs({required this.state});

  final LearnerCheckoutState state;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = AppThemeColors.of(context);
    final reservationId = state.reservationId;

    Widget crumb(String label, {VoidCallback? onTap}) {
      final text = Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: onTap == null ? colors.textPrimary : colors.textSecondary,
          fontWeight: onTap == null ? FontWeight.w700 : FontWeight.w500,
        ),
      );
      if (onTap == null) return text;
      return InkWell(onTap: onTap, child: text);
    }

    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        crumb(l10n.checkoutBreadcrumbHome, onTap: () => context.go(homeRoute)),
        Text('  ›  ', style: TextStyle(color: colors.textMuted)),
        crumb(
          l10n.checkoutBreadcrumbReservations,
          onTap: () => context.go(learnerReservationsRoute),
        ),
        if (reservationId.isNotEmpty) ...[
          Text('  ›  ', style: TextStyle(color: colors.textMuted)),
          crumb(
            l10n.checkoutBreadcrumbDetails,
            onTap: () =>
                context.go(learnerReservationDetailRoute(reservationId)),
          ),
        ],
        Text('  ›  ', style: TextStyle(color: colors.textMuted)),
        crumb(l10n.checkoutBreadcrumbCheckout),
      ],
    );
  }
}

class _DesktopCheckoutColumns extends StatelessWidget {
  const _DesktopCheckoutColumns({
    required this.state,
    required this.controller,
    required this.onViewDetails,
  });

  final LearnerCheckoutState state;
  final LearnerCheckoutController controller;
  final VoidCallback onViewDetails;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 3,
          child: CheckoutReservationSummaryCard(
            reservation: state.reservation,
            order: state.order,
            reservationId: state.reservationId,
            onViewDetails: onViewDetails,
          ),
        ),
        const SizedBox(width: AppSpacing.lg),
        Expanded(
          flex: 4,
          child: Column(
            children: [
              if (state.phase == CheckoutPhase.ready) ...[
                CheckoutPurposeCard(
                  order: state.order,
                  requirement: state.requirement,
                  session: state.session,
                ),
                const SizedBox(height: AppSpacing.md),
                const CheckoutSecureFooter(),
              ] else ...[
                CheckoutMockProviderPanel(
                  amount: state.displayPayAmount,
                  state: state,
                  onReview: controller.openReview,
                  onSimulateDecline: controller.simulateDecline,
                  onCancelAttempt: controller.cancelActiveAttempt,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.lg),
        Expanded(
          flex: 3,
          child: Column(
            children: [
              CheckoutAmountSummaryCard(
                order: state.order,
                reservation: state.reservation,
                requirement: state.requirement,
                session: state.session,
              ),
              const SizedBox(height: AppSpacing.md),
              CheckoutIncludesSection(
                order: state.order,
                reservation: state.reservation,
                requirement: state.requirement,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MobileCheckoutColumns extends StatelessWidget {
  const _MobileCheckoutColumns({
    required this.state,
    required this.controller,
    required this.onViewDetails,
  });

  final LearnerCheckoutState state;
  final LearnerCheckoutController controller;
  final VoidCallback onViewDetails;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        CheckoutReservationSummaryCard(
          reservation: state.reservation,
          order: state.order,
          reservationId: state.reservationId,
          onViewDetails: onViewDetails,
        ),
        const SizedBox(height: AppSpacing.md),
        CheckoutAmountSummaryCard(
          order: state.order,
          reservation: state.reservation,
          requirement: state.requirement,
          session: state.session,
        ),
        const SizedBox(height: AppSpacing.md),
        if (state.phase == CheckoutPhase.ready) ...[
          CheckoutPurposeCard(
            order: state.order,
            requirement: state.requirement,
            session: state.session,
          ),
          const SizedBox(height: AppSpacing.md),
          CheckoutIncludesSection(
            order: state.order,
            reservation: state.reservation,
            requirement: state.requirement,
          ),
          const SizedBox(height: AppSpacing.md),
          const CheckoutSecureFooter(),
        ] else ...[
          CheckoutMockProviderPanel(
            amount: state.displayPayAmount,
            state: state,
            onReview: controller.openReview,
            onSimulateDecline: controller.simulateDecline,
            onCancelAttempt: controller.cancelActiveAttempt,
          ),
        ],
      ],
    );
  }
}
