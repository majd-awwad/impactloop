import '../../reservations/data/models/handover_credential.dart';
import '../../reservations/data/models/reservation_message.dart';
import 'models/handover_verify_preview.dart';
import 'models/supplier_incoming_request.dart';
import 'supplier_requests_repository.dart';

class MockSupplierRequestsRepository implements SupplierRequestsRepository {
  MockSupplierRequestsRepository() : _requests = List.of(_seedRequests);

  final List<SupplierIncomingRequest> _requests;

  @override
  Future<SupplierReservationListResponse> fetchIncomingRequests({
    String? status,
    String? search,
    String? attentionState,
    String? fulfillmentMethod,
    String? historyScope,
    DateTime? dateFrom,
    DateTime? dateTo,
    required int page,
    required int limit,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 350));
    final items =
        _requests
            .where(
              (request) =>
                  (status == null ||
                      status == 'all' ||
                      request.status.apiValue == status) &&
                  (search == null ||
                      search.isEmpty ||
                      request.materialTitle.toLowerCase().contains(
                        search.toLowerCase(),
                      ) ||
                      request.learnerName.toLowerCase().contains(
                        search.toLowerCase(),
                      )) &&
                  (fulfillmentMethod == null ||
                      request.fulfillmentMethod == fulfillmentMethod),
            )
            .toList()
          ..sort((a, b) => b.requestedAt.compareTo(a.requestedAt));
    final start = (page - 1) * limit;
    return SupplierReservationListResponse(
      items: start >= items.length
          ? const []
          : items.skip(start).take(limit).toList(),
      pagination: SupplierReservationPagination(
        page: page,
        limit: limit,
        total: items.length,
        totalPages: items.isEmpty ? 0 : (items.length / limit).ceil(),
      ),
    );
  }

  @override
  Future<SupplierReservationDetail> fetchReservationDetail(
    String requestId,
  ) async =>
      throw UnsupportedError('Mock reservation details are not configured.');

  @override
  Future<void> confirmDeliveryReturn(String deliveryId) async {}

  @override
  Future<SupplierIncomingRequest> acceptRequest(
    String requestId,
    SupplierPickupWindow pickupWindow,
  ) async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    final index = _requests.indexWhere((request) => request.id == requestId);
    if (index == -1) {
      throw StateError('Request not found');
    }

    final updated = _requests[index].copyWith(
      status: SupplierIncomingRequestStatus.accepted,
      pickupWindow: pickupWindow,
      canSupplierComplete: true,
    );
    _requests[index] = updated;
    return updated;
  }

  @override
  Future<SupplierIncomingRequest> declineRequest(
    String requestId, {
    String? reason,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    final index = _requests.indexWhere((request) => request.id == requestId);
    if (index == -1) {
      throw StateError('Request not found');
    }

    final updated = _requests[index].copyWith(
      status: SupplierIncomingRequestStatus.declined,
      declineReason: reason,
    );
    _requests[index] = updated;
    return updated;
  }

  @override
  Future<SupplierIncomingRequest> completeRequest(
    String requestId, {
    required String confirmationCode,
    bool cashReceivedConfirmed = false,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    final index = _requests.indexWhere((request) => request.id == requestId);
    if (index == -1) {
      throw StateError('Request not found');
    }

    final current = _requests[index];
    if (current.status != SupplierIncomingRequestStatus.accepted) {
      throw StateError('Only accepted reservations can be completed');
    }

    final updated = current.copyWith(
      status: SupplierIncomingRequestStatus.completed,
      canSupplierComplete: false,
    );
    _requests[index] = updated;
    return updated;
  }

  @override
  Future<HandoverCredential> issueDriverPickupHandoverCredential(
    String reservationId,
  ) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return HandoverCredential(
      reservationId: reservationId,
      handoverToken: 'mock-supplier-pickup-token-aaaaaaaa',
      qrPayload:
          'impactloop://supplier-pickup-handover/mock-supplier-pickup-token-aaaaaaaa',
      expiresAt: DateTime.now().add(const Duration(hours: 1)),
    );
  }

  @override
  Future<HandoverVerifyPreview> verifyHandoverCredential(
    String handoverToken,
  ) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    SupplierIncomingRequest? accepted;
    for (final request in _requests) {
      if (request.status == SupplierIncomingRequestStatus.accepted) {
        accepted = request;
        break;
      }
    }
    if (accepted == null) {
      throw StateError('No accepted reservation to verify');
    }
    return HandoverVerifyPreview(
      reservationId: accepted.id,
      materialId: '',
      materialTitle: accepted.materialTitle,
      quantity: accepted.quantityRequested,
      unit: accepted.unit,
      learnerDisplayName: accepted.learnerName,
      expiresAt: DateTime.now().add(const Duration(hours: 1)),
    );
  }

  @override
  Future<SupplierIncomingRequest> confirmHandoverCredential(
    String handoverToken, {
    bool cashReceivedConfirmed = false,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    SupplierIncomingRequest? accepted;
    for (final request in _requests) {
      if (request.status == SupplierIncomingRequestStatus.accepted) {
        accepted = request;
        break;
      }
    }
    if (accepted == null) {
      throw StateError('No accepted reservation to confirm');
    }
    return completeRequest(accepted.id, confirmationCode: '000000');
  }

  @override
  Future<SupplierIncomingRequest> rescheduleRequest(
    String requestId,
    SupplierPickupWindow pickupWindow, {
    required String reason,
    String? messageToLearner,
    String? note,
  }) async {
    final index = _requests.indexWhere((request) => request.id == requestId);
    if (index == -1) throw StateError('Request not found');
    final updated = _requests[index].copyWith(
      status: SupplierIncomingRequestStatus.awaitingConfirmation,
      pickupWindow: pickupWindow,
      isOverdue: false,
      needsFollowUp: false,
    );
    _requests[index] = updated;
    return updated;
  }

  @override
  Future<SupplierIncomingRequest> acceptLearnerReschedule(
    String requestId,
  ) async {
    final index = _requests.indexWhere((request) => request.id == requestId);
    if (index == -1) throw StateError('Request not found');
    final updated = _requests[index].copyWith(
      status: SupplierIncomingRequestStatus.accepted,
    );
    _requests[index] = updated;
    return updated;
  }

  @override
  Future<SupplierIncomingRequest> submitNoDriverPickupWindow(
    String requestId,
    SupplierPickupWindow pickupWindow,
  ) async {
    final index = _requests.indexWhere((request) => request.id == requestId);
    if (index == -1) throw StateError('Request not found');
    final updated = _requests[index].copyWith(
      status: SupplierIncomingRequestStatus.accepted,
      pickupWindow: pickupWindow,
    );
    _requests[index] = updated;
    return updated;
  }

  @override
  Future<SupplierIncomingRequest> cancelAcceptedRequest(
    String requestId, {
    String? reason,
  }) async {
    final index = _requests.indexWhere((request) => request.id == requestId);
    if (index == -1) throw StateError('Request not found');
    final updated = _requests[index].copyWith(
      status: SupplierIncomingRequestStatus.declined,
      declineReason: reason,
    );
    _requests[index] = updated;
    return updated;
  }

  @override
  Future<void> submitNoShowReport(
    String requestId, {
    required String reasonCode,
    String? note,
  }) async {}

  @override
  Future<SupplierIncomingRequest> markLearnerNoShow(
    String requestId, {
    required String reason,
    String? note,
  }) async {
    final index = _requests.indexWhere((item) => item.id == requestId);
    if (index < 0) {
      throw StateError('Request not found');
    }
    final updated = _requests[index].copyWith(
      status: SupplierIncomingRequestStatus.noShow,
    );
    _requests[index] = updated;
    return updated;
  }

  @override
  Future<SupplierIncomingRequest> markDeliveryPickupExpired(
    String requestId,
  ) async {
    final index = _requests.indexWhere((item) => item.id == requestId);
    if (index < 0) {
      throw StateError('Request not found');
    }
    final updated = _requests[index].copyWith(
      status: SupplierIncomingRequestStatus.needsResolution,
    );
    _requests[index] = updated;
    return updated;
  }

  @override
  Future<SupplierIncomingRequest> reportNoDriverAvailable(
    String requestId, {
    required String note,
  }) async {
    final index = _requests.indexWhere((item) => item.id == requestId);
    if (index < 0) {
      throw StateError('Request not found');
    }
    final updated = _requests[index].copyWith(
      status: SupplierIncomingRequestStatus.needsResolution,
    );
    _requests[index] = updated;
    return updated;
  }

  @override
  Future<SupplierIncomingRequest> markDriverNoShow(
    String deliveryId, {
    required String note,
  }) async {
    final index = _requests.indexWhere(
      (item) => item.activeDelivery?.id == deliveryId,
    );
    if (index < 0) {
      throw StateError('Request not found');
    }
    final updated = _requests[index].copyWith(
      status: SupplierIncomingRequestStatus.needsResolution,
    );
    _requests[index] = updated;
    return updated;
  }

  @override
  Future<List<ReservationMessage>> fetchReservationMessages(
    String requestId,
  ) async {
    return const [];
  }

  @override
  Future<ReservationMessage> sendReservationMessage(
    String requestId,
    String body,
  ) async {
    return ReservationMessage(
      id: 'mock-message',
      reservationId: requestId,
      body: body,
      createdAt: DateTime.now(),
      sender: const ReservationMessageSender(id: 'mock', displayName: 'You'),
    );
  }
}

final List<SupplierIncomingRequest> _seedRequests = [
  SupplierIncomingRequest(
    id: 'req-arduino-1',
    materialTitle: 'Arduino Uno',
    learnerName: 'Ahmad',
    quantityRequested: 1,
    unit: 'piece',
    status: SupplierIncomingRequestStatus.pending,
    requestedAt: DateTime.now().subtract(const Duration(hours: 2)),
    learnerNote: 'I need it for a robotics project.',
  ),
  SupplierIncomingRequest(
    id: 'req-fabric-1',
    materialTitle: 'Cotton fabric scraps',
    materialImageUrl:
        'https://images.unsplash.com/photo-1558171813-4c088753af8f?auto=format&fit=crop&w=240&q=80',
    learnerName: 'Sara',
    quantityRequested: 3,
    unit: 'kg',
    status: SupplierIncomingRequestStatus.pending,
    requestedAt: DateTime.now().subtract(const Duration(days: 1, hours: 3)),
  ),
  SupplierIncomingRequest(
    id: 'req-wax-accepted',
    materialTitle: 'Used wax molds',
    learnerName: 'Omar',
    quantityRequested: 4,
    unit: 'piece',
    status: SupplierIncomingRequestStatus.accepted,
    requestedAt: DateTime.now().subtract(const Duration(days: 2)),
    canSupplierComplete: true,
    pickupWindow: SupplierPickupWindow(
      start: DateTime.now().add(const Duration(days: 1, hours: 10)),
      end: DateTime.now().add(const Duration(days: 1, hours: 12)),
      note: 'Ring the workshop bell when you arrive.',
    ),
  ),
  SupplierIncomingRequest(
    id: 'req-plywood-declined',
    materialTitle: 'Plywood offcuts',
    learnerName: 'Lina',
    quantityRequested: 2,
    unit: 'sheet',
    status: SupplierIncomingRequestStatus.declined,
    requestedAt: DateTime.now().subtract(const Duration(days: 4)),
    declineReason: 'Already reserved for another learner.',
  ),
  SupplierIncomingRequest(
    id: 'req-resin-completed',
    materialTitle: 'Epoxy resin bottles',
    learnerName: 'Yousef',
    quantityRequested: 1,
    unit: 'bottle',
    status: SupplierIncomingRequestStatus.completed,
    requestedAt: DateTime.now().subtract(const Duration(days: 8)),
    pickupWindow: SupplierPickupWindow(
      start: DateTime.now().subtract(const Duration(days: 6, hours: 2)),
      end: DateTime.now().subtract(const Duration(days: 6)),
      note: 'Pickup completed at the main gate.',
    ),
  ),
];
