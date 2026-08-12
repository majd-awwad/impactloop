import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import 'models/create_reservation_request.dart';
import 'models/created_reservation.dart';
import 'models/handover_credential.dart';
import 'models/learner_reservation.dart';
import 'models/reservation_message.dart';
import 'models/reservation_quote.dart';
import 'models/reservation_review.dart';

class ReservationsApi {
  const ReservationsApi(this._client);

  final Dio _client;

  Future<CreatedReservation> createReservation(
    CreateReservationRequest request, {
    String? recommendationImpressionId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/reservations',
        data: request.toJson(),
        options: Options(
          headers: recommendationHeaders(recommendationImpressionId),
        ),
      ),
      CreatedReservation.fromJson,
    );
  }

  Future<ReservationQuote> fetchReservationQuote(
    ReservationQuoteRequest request,
  ) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/reservations/quote',
        data: request.toJson(),
      ),
      ReservationQuote.fromJson,
    );
  }

  Future<List<LearnerReservation>> fetchMyReservations() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/reservations/my'),
      (json) {
        final reservations = json['reservations'];
        if (reservations is! List) {
          return const <LearnerReservation>[];
        }

        return reservations
            .whereType<Map>()
            .map(
              (item) =>
                  LearnerReservation.fromJson(Map<String, dynamic>.from(item)),
            )
            .toList(growable: false);
      },
    );
  }

  Future<LearnerReservation> fetchReservation(String reservationId) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/reservations/$reservationId'),
      LearnerReservation.fromJson,
    );
  }

  Future<void> cancelReservation(String reservationId) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/reservations/$reservationId/cancel',
      ),
      (_) {},
    );
  }

  Future<LearnerReservation> resolveLearnerConfirmation({
    required String reservationId,
    required String action,
    DateTime? deliveryWindowStart,
    DateTime? deliveryWindowEnd,
  }) {
    final payload = <String, dynamic>{'action': action};

    if (deliveryWindowStart != null && deliveryWindowEnd != null) {
      payload['deliveryWindow'] = {
        'start': deliveryWindowStart.toUtc().toIso8601String(),
        'end': deliveryWindowEnd.toUtc().toIso8601String(),
      };
    }

    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/reservations/$reservationId/learner-confirmation',
        data: payload,
      ),
      LearnerReservation.fromJson,
    );
  }

  Future<List<ReservationMessage>> fetchReservationMessages(
    String reservationId,
  ) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/reservations/$reservationId/messages',
      ),
      (json) {
        final messages = json['messages'];
        if (messages is! List) {
          return const <ReservationMessage>[];
        }

        return messages
            .whereType<Map>()
            .map(
              (item) =>
                  ReservationMessage.fromJson(Map<String, dynamic>.from(item)),
            )
            .toList(growable: false);
      },
    );
  }

  Future<ReservationMessage> sendReservationMessage(
    String reservationId,
    String body,
  ) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/reservations/$reservationId/messages',
        data: {'body': body},
      ),
      (json) => ReservationMessage.fromJson(json),
    );
  }

  Future<LearnerReservation> requestPickupReschedule({
    required String reservationId,
    required DateTime pickupWindowStart,
    required DateTime pickupWindowEnd,
    required String reason,
    String? note,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/reservations/$reservationId/request-reschedule',
        data: {
          'pickupWindowStart': pickupWindowStart.toUtc().toIso8601String(),
          'pickupWindowEnd': pickupWindowEnd.toUtc().toIso8601String(),
          'reason': reason,
          if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        },
      ),
      LearnerReservation.fromJson,
    );
  }

  Future<LearnerReservation> reportSupplierIssue({
    required String reservationId,
    required String reason,
    String? note,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/reservations/$reservationId/report-supplier-issue',
        data: {
          'reason': reason,
          if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        },
      ),
      LearnerReservation.fromJson,
    );
  }

  Future<LearnerReservation> reportNoDriverAvailable({
    required String reservationId,
    required String note,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/reservations/$reservationId/report-no-driver',
        data: {'note': note.trim()},
      ),
      LearnerReservation.fromJson,
    );
  }

  Future<ReservationReviewsState> upsertReservationReview({
    required String reservationId,
    required String targetType,
    required int rating,
    String? comment,
  }) {
    return unwrapApiResponse(
      _client.put<Map<String, dynamic>>(
        '/api/reservations/$reservationId/review',
        data: {
          'targetType': targetType,
          'rating': rating,
          if (comment != null && comment.trim().isNotEmpty)
            'comment': comment.trim(),
        },
      ),
      (json) => ReservationReviewsState.fromJson(
        Map<String, dynamic>.from(
          json['reviews'] as Map? ?? const <String, dynamic>{},
        ),
      ),
    );
  }

  Future<ReservationReviewsState> deleteReservationReview({
    required String reservationId,
    required String targetType,
  }) {
    return unwrapApiResponse(
      _client.delete<Map<String, dynamic>>(
        '/api/reservations/$reservationId/review/$targetType',
      ),
      (json) => ReservationReviewsState.fromJson(
        Map<String, dynamic>.from(
          json['reviews'] as Map? ?? const <String, dynamic>{},
        ),
      ),
    );
  }

  Future<HandoverCredential> issueHandoverCredential(String reservationId) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/reservations/$reservationId/handover-credential',
      ),
      HandoverCredential.fromJson,
    );
  }
}
