import '../../reservations/data/models/reservation_message.dart';
import 'models/supplier_incoming_request.dart';
import 'supplier_requests_repository.dart';

class MockSupplierRequestsRepository implements SupplierRequestsRepository {
  MockSupplierRequestsRepository() : _requests = List.of(_seedRequests);

  final List<SupplierIncomingRequest> _requests;

  @override
  Future<List<SupplierIncomingRequest>> fetchIncomingRequests(
    SupplierIncomingRequestTab status,
  ) async {
    await Future<void>.delayed(const Duration(milliseconds: 350));
    return _requests.where((request) => _matchesTab(request, status)).toList()
      ..sort((a, b) => b.requestedAt.compareTo(a.requestedAt));
  }

  bool _matchesTab(
    SupplierIncomingRequest request,
    SupplierIncomingRequestTab tab,
  ) {
    switch (tab) {
      case SupplierIncomingRequestTab.all:
        return true;
      case SupplierIncomingRequestTab.pending:
        return request.status == SupplierIncomingRequestStatus.pending;
      case SupplierIncomingRequestTab.needsLearner:
        return request.status ==
            SupplierIncomingRequestStatus.awaitingConfirmation;
      case SupplierIncomingRequestTab.accepted:
        return request.status == SupplierIncomingRequestStatus.accepted;
      case SupplierIncomingRequestTab.declined:
        return request.status == SupplierIncomingRequestStatus.declined;
      case SupplierIncomingRequestTab.completed:
        return request.status == SupplierIncomingRequestStatus.completed;
      case SupplierIncomingRequestTab.cancelled:
        return request.status == SupplierIncomingRequestStatus.cancelled;
    }
  }

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
  Future<SupplierIncomingRequest> rescheduleRequest(
    String requestId,
    SupplierPickupWindow pickupWindow, {
    String? messageToLearner,
  }) async {
    final index = _requests.indexWhere((request) => request.id == requestId);
    if (index == -1) throw StateError('Request not found');
    final updated = _requests[index].copyWith(
      pickupWindow: pickupWindow,
      isOverdue: false,
      needsFollowUp: false,
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
    pickupPreference: 'Self pickup',
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
    pickupPreference: 'Self pickup',
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
    pickupPreference: 'Self pickup',
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
    pickupPreference: 'Self pickup',
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
    pickupPreference: 'Self pickup',
    pickupWindow: SupplierPickupWindow(
      start: DateTime.now().subtract(const Duration(days: 6, hours: 2)),
      end: DateTime.now().subtract(const Duration(days: 6)),
      note: 'Pickup completed at the main gate.',
    ),
  ),
];
