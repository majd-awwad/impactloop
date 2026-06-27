import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';

void main() {
  test('SupplierIncomingRequest.fromJson parses reservation payload', () {
    final request = SupplierIncomingRequest.fromJson({
      'id': 'res-1',
      'status': 'PENDING',
      'quantityRequested': 2,
      'message': 'Need this for class.',
      'pickupType': 'SELF_PICKUP',
      'deliveryRequested': false,
      'createdAt': '2026-06-17T10:30:00.000Z',
      'material': {
        'title': 'Arduino Uno',
        'unit': 'piece',
        'images': [
          {'url': '/uploads/materials/test.jpg'},
        ],
      },
      'requester': {
        'displayName': 'Ahmad',
      },
      'learner': {
        'displayName': 'Ahmad',
      },
      'rejectionReason': 'Unavailable',
    });

    expect(request.id, 'res-1');
    expect(request.materialTitle, 'Arduino Uno');
    expect(request.learnerName, 'Ahmad');
    expect(request.status, SupplierIncomingRequestStatus.pending);
    expect(request.pickupPreference, 'Self pickup');
    expect(request.learnerNote, 'Need this for class.');
    expect(request.materialImageUrl, '/uploads/materials/test.jpg');
    expect(request.declineReason, 'Unavailable');
  });

  test('SupplierIncomingRequestStatus maps backend rejected status', () {
    expect(
      SupplierIncomingRequestStatusLabels.fromApiValue('REJECTED'),
      SupplierIncomingRequestStatus.declined,
    );
  });
}
