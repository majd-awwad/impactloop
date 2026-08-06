import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../../l10n/l10n.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../data/models/learner_reservation.dart';
import '../detail/reservation_detail_fulfillment_card.dart';
import '../detail/reservation_detail_header.dart';
import '../detail/reservation_detail_map_card.dart';
import '../detail/reservation_detail_material_supplier_card.dart';
import '../detail/reservation_detail_notes_card.dart';
import '../detail/reservation_detail_payment_card.dart';
import '../detail/reservation_detail_pickup_code_card.dart';
import '../detail/reservation_detail_pickup_window_card.dart';
import '../detail/reservation_detail_quick_actions.dart';
import '../detail/reservation_detail_summary_card.dart';
import '../detail/reservation_detail_timeline.dart';
import '../learner_reservation_ui_helpers.dart';
import 'learner_awaiting_confirmation_panel.dart';
import 'learner_reservation_messages_panel.dart';


const _threeColumnBreakpoint = 1024.0;
const _twoColumnBreakpoint = 768.0;

class LearnerReservationDetailsBody extends ConsumerStatefulWidget {
  const LearnerReservationDetailsBody({
    super.key,
    required this.reservation,
    required this.delivery,
    this.focusPaymentOrderId,
    this.highlightPayment = false,
    this.onCheckoutOrder,
    this.pickupCodeSectionKey,
  });

  final LearnerReservation reservation;
  final LearnerDelivery? delivery;
  final String? focusPaymentOrderId;
  final bool highlightPayment;
  final ValueChanged<String>? onCheckoutOrder;
  final GlobalKey? pickupCodeSectionKey;

  @override
  ConsumerState<LearnerReservationDetailsBody> createState() =>
      _LearnerReservationDetailsBodyState();
}

class _LearnerReservationDetailsBodyState
    extends ConsumerState<LearnerReservationDetailsBody> {
  final _paymentSectionKey = GlobalKey();
  bool _didScrollToPayment = false;

  @override
  void initState() {
    super.initState();
    _maybeScrollToPayment();
  }

  @override
  void didUpdateWidget(covariant LearnerReservationDetailsBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.highlightPayment != widget.highlightPayment ||
        oldWidget.focusPaymentOrderId != widget.focusPaymentOrderId) {
      _didScrollToPayment = false;
      _maybeScrollToPayment();
    }
  }

  void _maybeScrollToPayment() {
    if (_didScrollToPayment) return;
    if (!widget.highlightPayment && widget.focusPaymentOrderId == null) return;

    _didScrollToPayment = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _paymentSectionKey.currentContext;
      if (ctx != null) {
        Scrollable.ensureVisible(
          ctx,
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeInOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final reservation = widget.reservation;
    final delivery = widget.delivery;
    final userId = ref.watch(authControllerProvider).user?.id ?? '';
    final statusMessage = reservationStatusMessage(
      reservation,
      l10n: context.l10n,
    );
    final showFollowUpMessages =
        reservation.isAccepted &&
        (reservation.canSendMessage || reservation.latestMessage != null);
    final hasDeliveryRecord = delivery != null;

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final isMobile = width < _twoColumnBreakpoint;
        final isThreeColumn = width >= _threeColumnBreakpoint;

        final header = ReservationDetailHeader(
          reservation: reservation,
          delivery: delivery,
          statusMessage: statusMessage,
        );
        final hero = ReservationDetailHeroImage(
          reservation: reservation,
          compact: isMobile,
        );
        final materialSupplier = ReservationDetailMaterialSupplierCard(
          reservation: reservation,
          compact: isMobile,
          showImage: !isMobile,
        );
        final compactStats = ReservationDetailCompactStats(
          reservation: reservation,
        );
        final payment = ReservationDetailPaymentCard(
          reservation: reservation,
          delivery: delivery,
          sectionKey: _paymentSectionKey,
          onCheckoutOrder: widget.onCheckoutOrder,
        );
        final checkoutOrderId =
            reservation.paymentSummary?.checkoutableOrderId;
        final pickupCode = ReservationDetailPickupCodeCard(
          key: widget.pickupCodeSectionKey,
          reservation: reservation,
          onPayNow: checkoutOrderId != null && widget.onCheckoutOrder != null
              ? () => widget.onCheckoutOrder!(checkoutOrderId)
              : null,
        );
        final fulfillment = ReservationDetailFulfillmentCard(
          reservation: reservation,
          delivery: delivery,
        );
        final timeline = ReservationDetailTimeline(
          reservation: reservation,
          compact: isMobile,
        );
        final pickupWindow = ReservationDetailPickupWindowCard(
          reservation: reservation,
        );
        final showMap = shouldShowSelfPickupMap(
          reservation,
          hasDeliveryRecord: hasDeliveryRecord,
        );
        final mapCard = ReservationDetailMapCard(
          reservation: reservation,
          hasDeliveryRecord: hasDeliveryRecord,
          compact: isMobile,
        );
        final notes = ReservationDetailNotesCard(reservation: reservation);
        final summary = ReservationDetailSummaryCard(
          reservation: reservation,
          delivery: delivery,
        );
        final quickActions = ReservationDetailQuickActions(
          reservation: reservation,
          delivery: delivery,
        );
        final awaiting = reservation.isAwaitingConfirmation
            ? LearnerAwaitingConfirmationPanel(reservation: reservation)
            : null;
        final overdue = reservation.isAccepted && reservation.isOverdue
            ? const _OverdueWarningBanner()
            : null;
        final messages = showFollowUpMessages && userId.isNotEmpty
            ? LearnerReservationMessagesPanel(
                reservationId: reservation.id,
                canSendMessage: reservation.canSendMessage,
                currentUserId: userId,
                constrainWidth: !isMobile,
              )
            : null;
        final rescheduleNote =
            reservation.isAwaitingSupplierConfirmation &&
                reservation.pendingRescheduleReason?.trim().isNotEmpty == true
            ? _RescheduleReasonNote(reservation: reservation)
            : null;

        final pickupOrDelivery = reservation.isDeliveryFulfillment ||
                hasDeliveryRecord
            ? fulfillment
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  pickupCode,
                  if (!reservation.isDeliveryFulfillment) fulfillment,
                ],
              );

        if (isMobile) {
          return _MobileStack(
            children: [
              header,
              hero,
              materialSupplier,
              compactStats,
              if (awaiting != null) awaiting,
              if (overdue != null) overdue,
              payment,
              pickupOrDelivery,
              timeline,
              pickupWindow,
              mapCard,
              notes,
              if (messages != null) messages,
              quickActions,
              if (rescheduleNote != null) rescheduleNote,
            ],
          );
        }

        if (isThreeColumn) {
          return _ThreeColumnLayout(
            supporting: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                materialSupplier,
                const SizedBox(height: AppSpacing.md),
                summary,
              ],
            ),
            main: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                header,
                if (awaiting != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  awaiting,
                ],
                if (overdue != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  overdue,
                ],
                const SizedBox(height: AppSpacing.md),
                payment,
                const SizedBox(height: AppSpacing.md),
                timeline,
                const SizedBox(height: AppSpacing.md),
                fulfillment,
                if (showMap) ...[
                  const SizedBox(height: AppSpacing.md),
                  mapCard,
                ],
                if (messages != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  messages,
                ],
                if (rescheduleNote != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  rescheduleNote,
                ],
              ],
            ),
            actions: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                pickupWindow,
                const SizedBox(height: AppSpacing.md),
                pickupCode,
                const SizedBox(height: AppSpacing.md),
                notes,
                const SizedBox(height: AppSpacing.md),
                quickActions,
              ],
            ),
          );
        }

        return _TwoColumnLayout(
          sidebar: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              materialSupplier,
              const SizedBox(height: AppSpacing.md),
              summary,
              const SizedBox(height: AppSpacing.md),
              pickupWindow,
              const SizedBox(height: AppSpacing.md),
              pickupCode,
              const SizedBox(height: AppSpacing.md),
              notes,
              const SizedBox(height: AppSpacing.md),
              quickActions,
            ],
          ),
          main: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              header,
              const SizedBox(height: AppSpacing.md),
              compactStats,
              if (awaiting != null) ...[
                const SizedBox(height: AppSpacing.md),
                awaiting,
              ],
              if (overdue != null) ...[
                const SizedBox(height: AppSpacing.md),
                overdue,
              ],
              const SizedBox(height: AppSpacing.md),
              payment,
              const SizedBox(height: AppSpacing.md),
              fulfillment,
              const SizedBox(height: AppSpacing.md),
              timeline,
              if (showMap) ...[
                const SizedBox(height: AppSpacing.md),
                mapCard,
              ],
              if (messages != null) ...[
                const SizedBox(height: AppSpacing.md),
                messages,
              ],
              if (rescheduleNote != null) ...[
                const SizedBox(height: AppSpacing.md),
                rescheduleNote,
              ],
            ],
          ),
        );
      },
    );
  }
}

class _MobileStack extends StatelessWidget {
  const _MobileStack({required this.children});

  final List<Widget?> children;

  @override
  Widget build(BuildContext context) {
    final visible = children.whereType<Widget>().toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < visible.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.md),
          visible[i],
        ],
      ],
    );
  }
}

class _ThreeColumnLayout extends StatelessWidget {
  const _ThreeColumnLayout({
    required this.supporting,
    required this.main,
    required this.actions,
  });

  final Widget supporting;
  final Widget main;
  final Widget actions;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(flex: 3, child: supporting),
        const SizedBox(width: AppSpacing.lg),
        Expanded(flex: 4, child: main),
        const SizedBox(width: AppSpacing.lg),
        Expanded(flex: 3, child: actions),
      ],
    );
  }
}

class _TwoColumnLayout extends StatelessWidget {
  const _TwoColumnLayout({required this.sidebar, required this.main});

  final Widget sidebar;
  final Widget main;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(flex: 2, child: sidebar),
        const SizedBox(width: AppSpacing.lg),
        Expanded(flex: 3, child: main),
      ],
    );
  }
}

class _OverdueWarningBanner extends StatelessWidget {
  const _OverdueWarningBanner();

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.warningSoft,
        borderRadius: AppRadius.smAll,
        border: Border.all(color: colors.warningBorder),
      ),
      child: Text(
        context.l10n.reservationDetailOverdueBanner,
        style: AppTextStyles.label(
          context,
        ).copyWith(color: colors.warningText, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _RescheduleReasonNote extends StatelessWidget {
  const _RescheduleReasonNote({required this.reservation});

  final LearnerReservation reservation;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Text(
      context.l10n.yourRescheduleRequest(
        reservation.pendingRescheduleReason!.trim(),
      ),
      style: AppTextStyles.label(context).copyWith(
        color: palette.textSecondary,
        fontWeight: FontWeight.w500,
      ),
    );
  }
}
