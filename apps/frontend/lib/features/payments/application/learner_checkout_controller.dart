import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/errors/idempotency_error_codes.dart';
import '../../deliveries/application/learner_deliveries_provider.dart';
import '../../reservations/application/learner_reservation_provider.dart';
import '../../reservations/application/my_reservations_provider.dart';
import '../../reservations/data/models/learner_reservation.dart';
import '../../reservations/data/reservations_repository.dart';
import '../data/models/payment_order.dart';
import '../data/models/reservation_checkout_session.dart';
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

/// UI phase driven from reservation requirement + checkout session truth.
enum CheckoutPhase {
  loading,
  ready,
  method,
  confirming,
  processing,
  succeeded,
  declined,
  cancelled,
  expired,
  alreadyPaid,
  partiallyRefunded,
  refunded,
  orderCancelled,
  invariantBlocked,
  error,
  missing,
}

class LearnerCheckoutState {
  const LearnerCheckoutState({
    required this.reservationId,
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

  final String reservationId;
  final CheckoutPhase phase;
  final CheckoutStep step;
  final PaymentOrder? order;
  final LearnerReservation? reservation;
  final ReservationPaymentRequirement? requirement;
  final ReservationCheckoutSession? session;
  final String? errorMessage;
  final String? errorCode;
  final int? errorStatusCode;
  final bool submitting;
  final String? idempotencyKey;
  final bool reviewOpen;

  bool get canSubmit =>
      !submitting &&
      (phase == CheckoutPhase.ready ||
          phase == CheckoutPhase.method ||
          phase == CheckoutPhase.declined ||
          phase == CheckoutPhase.cancelled ||
          phase == CheckoutPhase.expired);

  bool get isTerminalResult =>
      phase == CheckoutPhase.succeeded ||
      phase == CheckoutPhase.alreadyPaid ||
      phase == CheckoutPhase.partiallyRefunded ||
      phase == CheckoutPhase.refunded ||
      phase == CheckoutPhase.orderCancelled ||
      phase == CheckoutPhase.invariantBlocked;

  bool get blocksDuplicateSubmission =>
      submitting || phase == CheckoutPhase.processing;

  String? get activeAttemptId => session?.attemptId ?? order?.activeAttempt?.id;

  String? get activeSessionId => session?.checkoutSessionId;

  /// Amount shown on review / mock panels — session total when available.
  /// Never sums money with Dart [double].
  String get displayPayAmount {
    final sessionAmount = session?.totalAmount;
    if (sessionAmount != null && sessionAmount.isNotEmpty) {
      return sessionAmount;
    }
    final outstanding = requirement?.orders
        .where(
          (row) =>
              row.isCurrent &&
              (row.status == 'REQUIRES_PAYMENT' ||
                  row.status == 'CHECKOUT_PENDING'),
        )
        .map((row) => row.amount)
        .where((amount) => amount.trim().isNotEmpty)
        .toList(growable: false);
    if (outstanding != null && outstanding.isNotEmpty) {
      if (outstanding.length == 1) return outstanding.first;
      // Without a session, avoid inventing a combined total client-side.
      return outstanding.join(' + ');
    }
    return order?.amount ?? '0.00';
  }

  bool get canStartCheckout {
    final req = requirement;
    if (req == null) return false;
    if (req.overallStatus == 'INVARIANT_VIOLATION') return false;
    if (req.material.canStartCheckout) return true;
    if (req.deliveryFee?.canStartCheckout == true) return true;
    return req.orders.any((row) => row.isCurrent && row.canStartCheckout);
  }

  LearnerCheckoutState copyWith({
    CheckoutPhase? phase,
    CheckoutStep? step,
    PaymentOrder? order,
    LearnerReservation? reservation,
    ReservationPaymentRequirement? requirement,
    ReservationCheckoutSession? session,
    String? errorMessage,
    String? errorCode,
    int? errorStatusCode,
    bool? submitting,
    String? idempotencyKey,
    bool? reviewOpen,
    bool clearError = false,
    bool clearSession = false,
    bool clearOrder = false,
  }) {
    return LearnerCheckoutState(
      reservationId: reservationId,
      phase: phase ?? this.phase,
      step: step ?? this.step,
      order: clearOrder ? null : (order ?? this.order),
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
  LearnerCheckoutController(this.reservationId);

  final String reservationId;

  Timer? _pollTimer;

  PaymentsRepository get _payments => ref.read(paymentsRepositoryProvider);
  ReservationsRepository get _reservations =>
      ref.read(reservationsRepositoryProvider);

  @override
  LearnerCheckoutState build() {
    ref.onDispose(_disposeResources);
    Future.microtask(load);
    return LearnerCheckoutState(reservationId: reservationId);
  }

  void _disposeResources() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  void _invalidateReservationCaches() {
    ref.invalidate(myReservationsProvider);
    ref.invalidate(learnerDeliveriesProvider);
    ref.invalidate(learnerReservationProvider(reservationId));
  }

  Future<void> load() async {
    state = state.copyWith(
      phase: CheckoutPhase.loading,
      clearError: true,
    );

    try {
      // Authoritative TTL expiry before resume (not a list/detail GET write).
      try {
        await _payments.reconcileExpiredCheckoutSessions(
          reservationId: reservationId,
        );
      } catch (_) {
        // Resume still proceeds; reconcile is best-effort on load.
      }

      final results = await Future.wait<Object?>([
        _reservations.fetchReservation(reservationId),
        _payments.fetchReservationPaymentRequirement(reservationId),
        _payments.fetchReservationCheckoutSession(reservationId),
      ]);

      final reservation = results[0] as LearnerReservation;
      final requirement = results[1] as ReservationPaymentRequirement;
      final session = results[2] as ReservationCheckoutSession?;

      PaymentOrder? order;
      final orderId = _primaryOrderId(requirement);
      if (orderId != null) {
        try {
          order = await _payments.fetchPaymentOrder(orderId);
        } catch (_) {
          order = null;
        }
      }

      state = state.copyWith(
        reservation: reservation,
        requirement: requirement,
        order: order,
        session: session,
        clearSession: session == null,
        clearError: true,
      );
      _applyReservationTruth(
        requirement: requirement,
        session: session,
        preserveMethodStep: false,
      );
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
      ReservationPaymentRequirement? requirement = state.requirement;
      try {
        requirement =
            await _payments.fetchReservationPaymentRequirement(reservationId);
      } catch (_) {
        if (!soft) rethrow;
      }

      LearnerReservation? reservation = state.reservation;
      if (reservation == null) {
        try {
          reservation = await _reservations.fetchReservation(reservationId);
        } catch (_) {}
      }

      try {
        await _payments.reconcileExpiredCheckoutSessions(
          reservationId: reservationId,
        );
      } catch (_) {}

      ReservationCheckoutSession? session = state.session;
      try {
        session = await _payments.fetchReservationCheckoutSession(reservationId);
      } catch (_) {
        if (!soft) {
          final sessionId = session?.checkoutSessionId;
          if (sessionId != null && sessionId.isNotEmpty) {
            try {
              session = await _payments.fetchCheckoutSession(sessionId);
            } catch (_) {}
          }
        }
      }

      PaymentOrder? order = state.order;
      if (!soft) {
        final orderId = _primaryOrderId(requirement) ?? order?.id;
        if (orderId != null && orderId.isNotEmpty) {
          try {
            order = await _payments.fetchPaymentOrder(orderId);
          } catch (_) {}
        }
      }

      state = state.copyWith(
        reservation: reservation,
        requirement: requirement,
        session: session,
        clearSession: session == null,
        order: order,
        clearError: true,
      );
      _applyReservationTruth(
        requirement: requirement ?? state.requirement,
        session: session,
        preserveMethodStep: soft,
      );
    } on ApiException catch (error) {
      if (!soft) {
        _applyLoadError(error);
      }
    }
  }

  String? _primaryOrderId(ReservationPaymentRequirement? requirement) {
    if (requirement == null) return null;
    if (requirement.outstandingPaymentOrderIds.isNotEmpty) {
      return requirement.outstandingPaymentOrderIds.first;
    }
    final materialId = requirement.material.paymentOrderId;
    if (materialId != null && materialId.isNotEmpty) return materialId;
    final feeId = requirement.deliveryFee?.paymentOrderId;
    if (feeId != null && feeId.isNotEmpty) return feeId;
    for (final row in requirement.orders) {
      if (row.isCurrent) return row.id;
    }
    return null;
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
          : (error.message.isEmpty
              ? 'Could not load reservation checkout'
              : error.message),
      errorCode: error.code,
      errorStatusCode: error.statusCode,
      submitting: false,
    );
    _stopPolling();
  }

  void _applyReservationTruth({
    required ReservationPaymentRequirement? requirement,
    required ReservationCheckoutSession? session,
    required bool preserveMethodStep,
  }) {
    if (requirement == null) {
      state = state.copyWith(
        phase: CheckoutPhase.error,
        step: CheckoutStep.summary,
        submitting: false,
      );
      _stopPolling();
      return;
    }

    if (requirement.overallStatus == 'INVARIANT_VIOLATION') {
      _stopPolling();
      state = state.copyWith(
        phase: CheckoutPhase.invariantBlocked,
        step: CheckoutStep.result,
        submitting: false,
        reviewOpen: false,
      );
      return;
    }

    if (requirement.overallStatus == 'REFUNDED') {
      _stopPolling();
      state = state.copyWith(
        phase: CheckoutPhase.refunded,
        step: CheckoutStep.result,
        submitting: false,
        reviewOpen: false,
      );
      return;
    }

    if (requirement.overallStatus == 'REFUND_PENDING' ||
        requirement.overallStatus == 'PARTIALLY_REFUNDED') {
      _stopPolling();
      state = state.copyWith(
        phase: CheckoutPhase.partiallyRefunded,
        step: CheckoutStep.result,
        submitting: false,
        reviewOpen: false,
      );
      return;
    }

    // Prefer live session status when present.
    if (session != null) {
      if (session.isSucceeded) {
        _stopPolling();
        state = state.copyWith(
          phase: CheckoutPhase.succeeded,
          step: CheckoutStep.result,
          submitting: false,
          reviewOpen: false,
          session: session,
        );
        return;
      }

      if (session.isFailed) {
        _stopPolling();
        state = state.copyWith(
          phase: CheckoutPhase.declined,
          step: CheckoutStep.result,
          submitting: false,
          reviewOpen: false,
          session: session,
        );
        return;
      }

      if (session.isCancelled) {
        _stopPolling();
        state = state.copyWith(
          phase: CheckoutPhase.cancelled,
          step: CheckoutStep.result,
          submitting: false,
          reviewOpen: false,
          session: session,
          clearSession: !preserveMethodStep,
        );
        return;
      }

      if (session.isExpired) {
        _stopPolling();
        state = state.copyWith(
          phase: CheckoutPhase.expired,
          step: CheckoutStep.result,
          submitting: false,
          reviewOpen: false,
          session: session,
          clearSession: !preserveMethodStep,
        );
        return;
      }

      if (session.isActive) {
        final attemptStatus = session.attemptStatus;
        if (attemptStatus == 'PENDING') {
          state = state.copyWith(
            phase: CheckoutPhase.processing,
            step: CheckoutStep.result,
            session: session,
            submitting: false,
            reviewOpen: false,
          );
          _startPolling();
          return;
        }

        // CREATED (or active without PENDING) — resume into method step.
        state = state.copyWith(
          phase: CheckoutPhase.method,
          step: CheckoutStep.method,
          session: session,
          submitting: false,
        );
        _stopPolling();
        return;
      }
    }

    final fullyPaid = requirement.overallStatus == 'PAID' ||
        (requirement.outstandingPaymentOrderIds.isEmpty &&
            requirement.material.isPaid &&
            (requirement.deliveryFee == null ||
                !requirement.deliveryFee!.required ||
                requirement.deliveryFee!.isPaid));
    if (fullyPaid) {
      _stopPolling();
      state = state.copyWith(
        phase: CheckoutPhase.alreadyPaid,
        step: CheckoutStep.result,
        submitting: false,
        reviewOpen: false,
        clearSession: true,
      );
      return;
    }

    if (requirement.reservationStatus == 'CANCELLED') {
      _stopPolling();
      state = state.copyWith(
        phase: CheckoutPhase.orderCancelled,
        step: CheckoutStep.result,
        submitting: false,
        reviewOpen: false,
        clearSession: true,
      );
      return;
    }

    // Recoverable attempt outcomes from a primary order snapshot.
    final order = state.order;
    final terminal = order?.latestTerminalAttempt;
    if (terminal != null &&
        (terminal.isFailed || terminal.isCancelled || terminal.isExpired) &&
        order!.isPayable &&
        !preserveMethodStep &&
        session == null) {
      final phase = terminal.isFailed
          ? CheckoutPhase.declined
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

    if (state.canStartCheckout || requirement.overallStatus == 'REQUIRES_PAYMENT') {
      state = state.copyWith(
        phase: CheckoutPhase.ready,
        step: CheckoutStep.summary,
        submitting: false,
        reviewOpen: false,
        clearSession: session == null || !session.isActive,
      );
      _stopPolling();
      return;
    }

    state = state.copyWith(
      phase: CheckoutPhase.ready,
      step: CheckoutStep.summary,
      submitting: false,
      clearSession: true,
    );
    _stopPolling();
  }

  Future<void> continueToPayment() async {
    if (state.blocksDuplicateSubmission) return;
    if (!state.canStartCheckout && state.session?.isActive != true) return;

    final existing = state.session;
    if (existing != null &&
        existing.isActive &&
        existing.attemptId != null &&
        existing.attemptId!.isNotEmpty) {
      state = state.copyWith(
        phase: CheckoutPhase.method,
        step: CheckoutStep.method,
        session: existing,
        clearError: true,
      );
      return;
    }

    state = state.copyWith(submitting: true, clearError: true);

    final key =
        state.idempotencyKey ?? generatePaymentCheckoutIdempotencyKey();
    state = state.copyWith(idempotencyKey: key);

    try {
      final session = await _payments.startReservationCheckout(
        reservationId: reservationId,
        idempotencyKey: key,
      );
      state = state.copyWith(
        session: session,
        phase: CheckoutPhase.method,
        step: CheckoutStep.method,
        submitting: false,
        clearError: true,
      );
    } on ApiException catch (error) {
      if (error.code == IdempotencyErrorCodes.inProgress) {
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

      final refreshKey =
          error.code == IdempotencyErrorCodes.previouslyFailed ||
          error.code == IdempotencyErrorCodes.keyReused;
      state = state.copyWith(
        submitting: false,
        errorMessage: error.message,
        errorCode: error.code,
        errorStatusCode: error.statusCode,
        idempotencyKey:
            refreshKey ? generatePaymentCheckoutIdempotencyKey() : key,
        phase: CheckoutPhase.ready,
        step: CheckoutStep.summary,
      );
      await reconcile(soft: true);
    } catch (error) {
      state = state.copyWith(
        submitting: false,
        errorMessage: error.toString(),
        phase: CheckoutPhase.ready,
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

  Future<void> simulatePending() => _act('pending');

  Future<void> cancelActiveAttempt() async {
    final attemptId = state.activeAttemptId;
    final sessionId = state.activeSessionId;
    if (attemptId == null ||
        sessionId == null ||
        state.blocksDuplicateSubmission) {
      return;
    }

    state = state.copyWith(submitting: true, clearError: true);
    try {
      final session = await _payments.cancelReservationCheckoutAttempt(
        sessionId: sessionId,
        attemptId: attemptId,
      );
      state = state.copyWith(
        session: session,
        submitting: false,
        reviewOpen: false,
        idempotencyKey: generatePaymentCheckoutIdempotencyKey(),
      );
      _invalidateReservationCaches();
      await reconcile(soft: true);
    } on ApiException catch (error) {
      state = state.copyWith(
        submitting: false,
        errorMessage: error.message,
        errorCode: error.code,
      );
      await reconcile(soft: true);
    }
  }

  Future<void> retryFromFailure() async {
    state = state.copyWith(
      phase: CheckoutPhase.ready,
      step: CheckoutStep.summary,
      reviewOpen: false,
      clearSession: true,
      clearError: true,
      idempotencyKey: generatePaymentCheckoutIdempotencyKey(),
    );

    _invalidateReservationCaches();

    // Refresh requirement truth only — do not restore a terminal FAILED/CANCELLED
    // session as the current handoff (that would block starting a new checkout).
    try {
      final requirement =
          await _payments.fetchReservationPaymentRequirement(reservationId);
      state = state.copyWith(
        requirement: requirement,
        clearSession: true,
        clearError: true,
      );
      _applyReservationTruth(
        requirement: requirement,
        session: null,
        preserveMethodStep: false,
      );
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
      final result = await _payments.actOnMockCheckout(
        attemptId: attemptId,
        action: action,
      );

      final session = result.checkoutSession ?? state.session;
      final order = result.order ?? state.order;

      state = state.copyWith(
        session: session,
        order: order,
        idempotencyKey: generatePaymentCheckoutIdempotencyKey(),
      );

      // Soft-reconcile requirement without blanking the page.
      try {
        final requirement = await _payments
            .fetchReservationPaymentRequirement(reservationId);
        state = state.copyWith(requirement: requirement);
      } catch (_) {}

      if (action == 'pending') {
        state = state.copyWith(submitting: false);
        _applyReservationTruth(
          requirement: state.requirement,
          session: state.session,
          preserveMethodStep: true,
        );
        return;
      }

      // Always refresh reservation-facing caches after a provider act so list,
      // details, and notifications do not keep a contradictory Pay CTA after
      // decline/cancel/success. Never auto-chain sibling order checkouts.
      _invalidateReservationCaches();

      state = state.copyWith(submitting: false);
      _applyReservationTruth(
        requirement: state.requirement,
        session: state.session,
        preserveMethodStep: false,
      );
    } on ApiException catch (error) {
      state = state.copyWith(
        submitting: false,
        errorMessage: error.message,
        errorCode: error.code,
        errorStatusCode: error.statusCode,
      );
      await reconcile(soft: true);
    } catch (error) {
      state = state.copyWith(
        submitting: false,
        errorMessage: error.toString(),
      );
      await reconcile(soft: true);
    }
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
