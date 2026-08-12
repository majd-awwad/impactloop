import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'models/create_reservation_request.dart';
import 'models/created_reservation.dart';
import 'models/handover_credential.dart';
import 'models/learner_reservation.dart';
import 'models/reservation_message.dart';
import 'models/reservation_quote.dart';
import 'models/reservation_review.dart';
import 'reservations_api.dart';

final reservationsApiProvider = Provider<ReservationsApi>((ref) {
  return ReservationsApi(ref.watch(apiClientProvider));
});

final reservationsRepositoryProvider = Provider<ReservationsRepository>((ref) {
  return ReservationsRepository(ref.watch(reservationsApiProvider));
});

class ReservationsRepository {
  const ReservationsRepository(this._api);

  final ReservationsApi _api;

  Future<CreatedReservation> createReservation(
    CreateReservationRequest request, {
    String? recommendationImpressionId,
  }) {
    return _api.createReservation(
      request,
      recommendationImpressionId: recommendationImpressionId,
    );
  }

  Future<ReservationQuote> fetchReservationQuote(
    ReservationQuoteRequest request,
  ) {
    return _api.fetchReservationQuote(request);
  }

  Future<List<LearnerReservation>> fetchMyReservations() {
    return _api.fetchMyReservations();
  }

  Future<LearnerReservation> fetchReservation(String reservationId) {
    return _api.fetchReservation(reservationId);
  }

  Future<void> cancelReservation(String reservationId) {
    return _api.cancelReservation(reservationId);
  }

  Future<LearnerReservation> resolveLearnerConfirmation({
    required String reservationId,
    required String action,
    DateTime? deliveryWindowStart,
    DateTime? deliveryWindowEnd,
  }) {
    return _api.resolveLearnerConfirmation(
      reservationId: reservationId,
      action: action,
      deliveryWindowStart: deliveryWindowStart,
      deliveryWindowEnd: deliveryWindowEnd,
    );
  }

  Future<List<ReservationMessage>> fetchReservationMessages(
    String reservationId,
  ) {
    return _api.fetchReservationMessages(reservationId);
  }

  Future<ReservationMessage> sendReservationMessage(
    String reservationId,
    String body,
  ) {
    return _api.sendReservationMessage(reservationId, body);
  }

  Future<LearnerReservation> requestPickupReschedule({
    required String reservationId,
    required DateTime pickupWindowStart,
    required DateTime pickupWindowEnd,
    required String reason,
    String? note,
  }) {
    return _api.requestPickupReschedule(
      reservationId: reservationId,
      pickupWindowStart: pickupWindowStart,
      pickupWindowEnd: pickupWindowEnd,
      reason: reason,
      note: note,
    );
  }

  Future<LearnerReservation> reportSupplierIssue({
    required String reservationId,
    required String reason,
    String? note,
  }) {
    return _api.reportSupplierIssue(
      reservationId: reservationId,
      reason: reason,
      note: note,
    );
  }

  Future<LearnerReservation> reportNoDriverAvailable({
    required String reservationId,
    required String note,
  }) {
    return _api.reportNoDriverAvailable(
      reservationId: reservationId,
      note: note,
    );
  }

  Future<ReservationReviewsState> saveReservationReview({
    required String reservationId,
    required String targetType,
    required int rating,
    String? comment,
  }) {
    return _api.upsertReservationReview(
      reservationId: reservationId,
      targetType: targetType,
      rating: rating,
      comment: comment,
    );
  }

  Future<ReservationReviewsState> deleteReservationReview({
    required String reservationId,
    required String targetType,
  }) {
    return _api.deleteReservationReview(
      reservationId: reservationId,
      targetType: targetType,
    );
  }

  Future<HandoverCredential> issueHandoverCredential(String reservationId) {
    return _api.issueHandoverCredential(reservationId);
  }
}
