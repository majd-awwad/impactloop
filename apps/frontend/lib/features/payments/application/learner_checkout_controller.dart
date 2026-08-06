import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../reservations/data/models/learner_reservation.dart';
import '../../reservations/data/reservations_repository.dart';
import '../data/models/payment_order.dart';
import '../data/models/reservation_payment_requirement.dart';
import '../data/payments_api.dart';
import '../data/payments_repository.dart';

/// Visual step index matching the reference stepper.
enum CheckoutStep {
  summary,
  method,
  confirm,
  result,
}

/// UI phase driven exclusively from backend PaymentOrder / attempt truth.
enum CheckoutPhase {
  loading,
  summary,
  method,
  confirming,
  processing,
  success,
  failure,
  cancelled,
  expired,
  alreadyPaid,
  refundPending,
  refunded,
  orderCancelled,
  error,
  missing,
}

class LearnerCheckoutState {
  const LearnerCheckoutState({
    required this.orderId,
    this.phase = CheckoutPhase.loading,
    this.step = CheckoutStep.summary,
    this.order,
    this.reservation,
    this.requirement,
    this.session,
    this.errorMessage,
    this.errorCode,
    this.errorStatusCode,
    this.submitting = false,
    this.idempotencyKey,
    this.reviewOpen = false,
  });

  final String orderId;
  final CheckoutPhase phase;
  final CheckoutStep step;
  final PaymentOrder? order;
  final LearnerReservation? reservation;
  final ReservationPaymentRequirement? requirement;
  final PaymentCheckoutSession? session;
  final String? errorMessage;
  final String? errorCode;
  final int? errorStatusCode;
  final bool submitting;
  final String? idempotencyKey;
  final bool reviewOpen;

  bool get canSubmit =>
      !submitting &&
      (phase == CheckoutPhase.summary ||
          phase == CheckoutPhase.method ||
          phase == CheckoutPhase.failure ||
          phase == CheckoutPhase.cancelled ||
          phase == CheckoutPhase.expired);

  bool get isTerminalResult =>
      phase == CheckoutPhase.success ||
      phase == CheckoutPhase.alreadyPaid ||
      phase == CheckoutPhase.refundPending ||
      phase == CheckoutPhase.refunded ||
      phase == CheckoutPhase.orderCancelled;

  bool get blocksDuplicateSubmission =>
      submitting || phase == CheckoutPhase.processing;

  String? get activeAttemptId =>
      session?.attemptId ?? order?.activeAttempt?.id;

  LearnerCheckoutState copyWith({
    CheckoutPhase? phase,
    CheckoutStep? step,
    PaymentOrder? order,
    LearnerReservation? reservation,
    ReservationPaymentRequirement? requirement,
    PaymentCheckoutSession? session,
    String? errorMessage,
    String? errorCode,
    int? errorStatusCode,
    bool? submitting,
    String? idempotencyKey,
    bool? reviewOpen,
    bool clearError = false,
    bool clearSession = false,
  }) {
    return LearnerCheckoutState(
      orderId: orderId,
      phase: phase ?? this.phase,
      step: step ?? this.step,
      order: order ?? this.order,
      reservation: reservation ?? this.reservation,
      requirement: requirement ?? this.requirement,
      session: clearSession ? null : (session ?? this.session),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      errorCode: clearError ? null : (errorCode ?? this.errorCode),
      errorStatusCode:
          clearError ? null : (errorStatusCode ?? this.errorStatusCode),
      submitting: submitting ?? this.submitting,
      idempotencyKey: idempotencyKey ?? this.idempotencyKey,
      reviewOpen: reviewOpen ?? this.reviewOpen,
    );
  }
}

final learnerCheckoutControllerProvider = NotifierProvider.autoDispose
    .family<LearnerCheckoutController, LearnerCheckoutState, String>(
  LearnerCheckoutController.new,
);

class LearnerCheckoutController extends Notifier<LearnerCheckoutState> {
  LearnerCheckoutController(this.orderId);

  final String orderId;

  Timer? _pollTimer;

  PaymentsRepository get _payments => ref.read(paymentsRepositoryProvider);
  ReservationsRepository get _reservations =>
      ref.read(reservationsRepositoryProvider);

  @override
  LearnerCheckoutState build() {
    ref.onDispose(_disposeResources);
    Future.microtask(load);
    return LearnerCheckoutState(orderId: orderId);
  }

  void _disposeResources() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> load() async {
    state = state.copyWith(
      phase: CheckoutPhase.loading,
      clearError: true,
    );

    try {
      final order = await _payments.fetchPaymentOrder(state.orderId);
      LearnerReservation? reservation;
      ReservationPaymentRequirement? requirement;

      final reservationId = order.reservationId;
      if (reservationId != null && reservationId.isNotEmpty) {
        try {
          reservation = await _reservations.fetchReservation(reservationId);
        } catch (_) {
          reservation = null;
        }
        try {
          requirement = await _payments
              .fetchReservationPaymentRequirement(reservationId);
        } catch (_) {
          requirement = null;
        }
      }

      state = state.copyWith(
        order: order,
        reservation: reservation,
        requirement: requirement,
        clearError: true,
      );
      _applyOrderTruth(order, preserveMethodStep: false);
    } on ApiException catch (error) {
      _applyLoadError(error);
    } catch (error) {
      state = state.copyWith(
        phase: CheckoutPhase.error,
        step: CheckoutStep.summary,
        errorMessage: error.toString(),
        submitting: false,
      );
    }
  }

  Future<void> reconcile({bool soft = false}) async {
    if (state.submitting && soft) return;

    try {
      final order = await _payments.fetchPaymentOrder(state.orderId);
      ReservationPaymentRequirement? requirement = state.requirement;
      final reservationId = order.reservationId;
      if (reservationId != null && reservationId.isNotEmpty) {
        try {
          requirement = await _payments
              .fetchReservationPaymentRequirement(reservationId);
        } catch (_) {}
      }

      LearnerReservation? reservation = state.reservation;
      if (reservationId != null &&
          reservationId.isNotEmpty &&
          reservation == null) {
        try {
          reservation = await _reservations.fetchReservation(reservationId);
        } catch (_) {}
      }

      state = state.copyWith(
        order: order,
        reservation: reservation,
        requirement: requirement,
        clearError: true,
      );
      _applyOrderTruth(order, preserveMethodStep: soft);
    } on ApiException catch (error) {
      if (!soft) {
        _applyLoadError(error);
      }
    }
  }

  void _applyLoadError(ApiException error) {
    final missing = error.statusCode == 404 || error.code == 'NOT_FOUND';
    final unauthorized = error.statusCode == 401 ||
        error.statusCode == 403 ||
        error.code == 'FORBIDDEN' ||
        error.code == 'UNAUTHENTICATED';

    state = state.copyWith(
      phase: missing ? CheckoutPhase.missing : CheckoutPhase.error,
      step: CheckoutStep.summary,
      errorMessage: unauthorized
          ? error.message
          : (error.message.isEmpty ? 'Could not load payment order' : error.message),
      errorCode: error.code,
      errorStatusCode: error.statusCode,
      submitting: false,
    );
    _stopPolling();
  }

  void _applyOrderTruth(PaymentOrder order, {required bool preserveMethodStep}) {
    if (order.isPaid) {
      _stopPolling();
      state = state.copyWith(
        phase: CheckoutPhase.success,
        step: CheckoutStep.result,
        submitting: false,
        reviewOpen: false,
      );
      return;
    }

    if (order.isRefundPending) {
      _stopPolling();
      state = state.copyWith(
        phase: CheckoutPhase.refundPending,
        step: CheckoutStep.result,
        submitting: false,
        reviewOpen: false,
      );
      return;
    }

    if (order.isRefunded) {
      _stopPolling();
      state = state.copyWith(
        phase: CheckoutPhase.refunded,
        step: CheckoutStep.result,
        submitting: false,
        reviewOpen: false,
      );
      return;
    }

    if (order.isCancelled) {
      _stopPolling();
      state = state.copyWith(
        phase: CheckoutPhase.orderCancelled,
        step: CheckoutStep.result,
        submitting: false,
        reviewOpen: false,
      );
      return;
    }

    final active = order.activeAttempt;
    final terminal = order.latestTerminalAttempt;

    if (order.isCheckoutPending && active != null) {
      if (active.status == 'PENDING') {
        state = state.copyWith(
          phase: CheckoutPhase.processing,
          step: CheckoutStep.result,
          session: PaymentCheckoutSession(
            orderId: order.id,
            orderStatus: order.status,
            attemptId: active.id,
            attemptStatus: active.status,
            checkoutUrl: state.session?.checkoutUrl ?? '',
            expiresAt: active.expiresAt,
          ),
          submitting: false,
          reviewOpen: false,
        );
        _startPolling();
        return;
      }

      // CREATED — resume into method step with existing attempt.
      state = state.copyWith(
        phase: CheckoutPhase.method,
        step: CheckoutStep.method,
        session: PaymentCheckoutSession(
          orderId: order.id,
          orderStatus: order.status,
          attemptId: active.id,
          attemptStatus: active.status,
          checkoutUrl: state.session?.checkoutUrl ?? '',
          expiresAt: active.expiresAt,
        ),
        submitting: false,
      );
      _stopPolling();
      return;
    }

    if (terminal != null &&
        (terminal.isFailed || terminal.isCancelled || terminal.isExpired) &&
        order.status == 'REQUIRES_PAYMENT' &&
        !preserveMethodStep) {
      // Surface the most recent recoverable outcome, then allow retry.
      final phase = terminal.isFailed
          ? CheckoutPhase.failure
          : terminal.isExpired
              ? CheckoutPhase.expired
              : CheckoutPhase.cancelled;
      state = state.copyWith(
        phase: phase,
        step: CheckoutStep.result,
        submitting: false,
        reviewOpen: false,
        clearSession: true,
      );
      _stopPolling();
      return;
    }

    if (order.status == 'REQUIRES_PAYMENT') {
      state = state.copyWith(
        phase: CheckoutPhase.summary,
        step: CheckoutStep.summary,
        submitting: false,
        reviewOpen: false,
        clearSession: true,
      );
      _stopPolling();
      return;
    }

    // Fallback for CHECKOUT_PENDING without active attempt — reconcile to summary.
    state = state.copyWith(
      phase: CheckoutPhase.summary,
      step: CheckoutStep.summary,
      submitting: false,
      clearSession: true,
    );
    _stopPolling();
  }

  Future<void> continueToPayment() async {
    if (state.blocksDuplicateSubmission) return;
    if (state.order == null || !state.order!.isPayable) return;

    final existingAttempt = state.order!.activeAttempt;
    if (existingAttempt != null) {
      state = state.copyWith(
        phase: CheckoutPhase.method,
        step: CheckoutStep.method,
        session: PaymentCheckoutSession(
          orderId: state.order!.id,
          orderStatus: state.order!.status,
          attemptId: existingAttempt.id,
          attemptStatus: existingAttempt.status,
          checkoutUrl: state.session?.checkoutUrl ?? '',
          expiresAt: existingAttempt.expiresAt,
        ),
        clearError: true,
      );
      return;
    }

    state = state.copyWith(submitting: true, clearError: true);

    final key =
        state.idempotencyKey ?? generatePaymentCheckoutIdempotencyKey();
    state = state.copyWith(idempotencyKey: key);

    try {
      final session = await _payments.startCheckout(
        orderId: state.orderId,
        idempotencyKey: key,
      );
      final order = await _payments.fetchPaymentOrder(state.orderId);
      state = state.copyWith(
        order: order,
        session: session,
        phase: CheckoutPhase.method,
        step: CheckoutStep.method,
        submitting: false,
        clearError: true,
      );
    } on ApiException catch (error) {
      if (error.code == 'IDEMPOTENCY_IN_PROGRESS') {
        state = state.copyWith(
          phase: CheckoutPhase.processing,
          step: CheckoutStep.result,
          submitting: false,
          errorMessage: error.message,
          errorCode: error.code,
        );
        _startPolling();
        return;
      }

      // Force a fresh key after a failed/completed conflict so retry works.
      final refreshKey = error.code == 'IDEMPOTENCY_PREVIOUSLY_FAILED' ||
          error.code == 'IDEMPOTENCY_KEY_REUSED';
      state = state.copyWith(
        submitting: false,
        errorMessage: error.message,
        errorCode: error.code,
        errorStatusCode: error.statusCode,
        idempotencyKey:
            refreshKey ? generatePaymentCheckoutIdempotencyKey() : key,
        phase: CheckoutPhase.summary,
        step: CheckoutStep.summary,
      );
      await reconcile();
    } catch (error) {
      state = state.copyWith(
        submitting: false,
        errorMessage: error.toString(),
        phase: CheckoutPhase.summary,
        step: CheckoutStep.summary,
        idempotencyKey: generatePaymentCheckoutIdempotencyKey(),
      );
    }
  }

  void openReview() {
    if (state.activeAttemptId == null || state.blocksDuplicateSubmission) {
      return;
    }
    state = state.copyWith(
      reviewOpen: true,
      phase: CheckoutPhase.confirming,
      step: CheckoutStep.confirm,
    );
  }

  void closeReview() {
    if (state.submitting) return;
    state = state.copyWith(
      reviewOpen: false,
      phase: CheckoutPhase.method,
      step: CheckoutStep.method,
    );
  }

  Future<void> confirmMockPayment() => _act('success');

  Future<void> simulateDecline() => _act('decline');

  Future<void> cancelActiveAttempt() async {
    final attemptId = state.activeAttemptId;
    if (attemptId == null || state.blocksDuplicateSubmission) return;

    state = state.copyWith(submitting: true, clearError: true);
    try {
      await _payments.cancelAttempt(
        orderId: state.orderId,
        attemptId: attemptId,
      );
      state = state.copyWith(
        submitting: false,
        reviewOpen: false,
        idempotencyKey: generatePaymentCheckoutIdempotencyKey(),
        clearSession: true,
      );
      await reconcile();
    } on ApiException catch (error) {
      state = state.copyWith(
        submitting: false,
        errorMessage: error.message,
        errorCode: error.code,
      );
      await reconcile();
    }
  }

  Future<void> retryFromFailure() async {
    state = state.copyWith(
      phase: CheckoutPhase.summary,
      step: CheckoutStep.summary,
      reviewOpen: false,
      clearSession: true,
      clearError: true,
      idempotencyKey: generatePaymentCheckoutIdempotencyKey(),
    );

    try {
      final order = await _payments.fetchPaymentOrder(state.orderId);
      ReservationPaymentRequirement? requirement = state.requirement;
      final reservationId = order.reservationId;
      if (reservationId != null && reservationId.isNotEmpty) {
        try {
          requirement = await _payments
              .fetchReservationPaymentRequirement(reservationId);
        } catch (_) {}
      }

      state = state.copyWith(
        order: order,
        requirement: requirement,
        clearError: true,
      );

      if (order.isPaid ||
          order.isRefundPending ||
          order.isRefunded ||
          order.isCancelled) {
        _applyOrderTruth(order, preserveMethodStep: false);
        return;
      }

      if (order.activeAttempt != null && order.isCheckoutPending) {
        _applyOrderTruth(order, preserveMethodStep: true);
        return;
      }

      state = state.copyWith(
        phase: CheckoutPhase.summary,
        step: CheckoutStep.summary,
        submitting: false,
        clearSession: true,
      );
      _stopPolling();
    } on ApiException catch (error) {
      _applyLoadError(error);
    }
  }

  Future<void> _act(String action) async {
    final attemptId = state.activeAttemptId;
    if (attemptId == null || state.blocksDuplicateSubmission) return;

    state = state.copyWith(
      submitting: true,
      reviewOpen: false,
      phase: CheckoutPhase.processing,
      step: CheckoutStep.result,
      clearError: true,
    );

    try {
      final order = await _payments.actOnMockCheckout(
        attemptId: attemptId,
        action: action,
      );
      state = state.copyWith(
        order: order,
        idempotencyKey: generatePaymentCheckoutIdempotencyKey(),
      );

      if (action == 'pending') {
        state = state.copyWith(submitting: false);
        _applyOrderTruth(order, preserveMethodStep: true);
        return;
      }

      if (action == 'success' && order.isPaid) {
        final chainedOk = await _payRemainingSiblingOrders();
        if (!chainedOk) {
          // Primary order paid; sibling failure is already on state.errorMessage.
          state = state.copyWith(submitting: false);
          _applyOrderTruth(order, preserveMethodStep: false);
          return;
        }
      }

      state = state.copyWith(submitting: false);
      _applyOrderTruth(
        state.order ?? order,
        preserveMethodStep: false,
      );
    } on ApiException catch (error) {
      state = state.copyWith(
        submitting: false,
        errorMessage: error.message,
        errorCode: error.code,
        errorStatusCode: error.statusCode,
      );
      await reconcile();
    } catch (error) {
      state = state.copyWith(
        submitting: false,
        errorMessage: error.toString(),
      );
      await reconcile();
    }
  }

  /// After material (or fee) succeeds, silently settle any other payable
  /// sibling orders for the same reservation so the learner pays once.
  Future<bool> _payRemainingSiblingOrders() async {
    final reservationId = state.reservation?.id ??
        state.requirement?.reservationId ??
        state.order?.reservationId;
    if (reservationId == null || reservationId.isEmpty) {
      return true;
    }

    ReservationPaymentRequirement? requirement;
    try {
      requirement =
          await _payments.fetchReservationPaymentRequirement(reservationId);
      state = state.copyWith(requirement: requirement);
    } catch (_) {
      return true;
    }

    final siblings = requirement.orders
        .where(
          (row) =>
              row.id != state.orderId &&
              row.isCurrent &&
              row.canStartCheckout,
        )
        .toList(growable: false);

    for (final sibling in siblings) {
      try {
        final session = await _payments.startCheckout(
          orderId: sibling.id,
          idempotencyKey: generatePaymentCheckoutIdempotencyKey(),
        );
        final paid = await _payments.actOnMockCheckout(
          attemptId: session.attemptId,
          action: 'success',
        );
        if (!paid.isPaid) {
          state = state.copyWith(
            errorMessage:
                'Primary payment succeeded, but a remaining payment could not be completed. Finish it from reservation details.',
            errorCode: 'CHAINED_CHECKOUT_INCOMPLETE',
          );
          return false;
        }
      } on ApiException catch (error) {
        state = state.copyWith(
          errorMessage: error.message.isEmpty
              ? 'Primary payment succeeded, but a remaining payment could not be completed.'
              : error.message,
          errorCode: error.code,
          errorStatusCode: error.statusCode,
        );
        return false;
      } catch (error) {
        state = state.copyWith(
          errorMessage: error.toString(),
        );
        return false;
      }
    }

    try {
      requirement =
          await _payments.fetchReservationPaymentRequirement(reservationId);
      state = state.copyWith(requirement: requirement);
    } catch (_) {}

    return true;
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 2), (_) async {
      if (!ref.mounted) return;
      await reconcile(soft: true);
    });
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }
}
