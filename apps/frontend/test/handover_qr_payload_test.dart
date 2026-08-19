import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/driver_portal/application/delivery_handover_qr_payload.dart';
import 'package:frontend/features/driver_portal/application/supplier_pickup_handover_qr_payload.dart';
import 'package:frontend/features/supplier_portal/application/pickup_qr_payload.dart';
import 'package:frontend/shared/handover/handover_qr_payload.dart';

void main() {
  group('parseHandoverQr', () {
    test('parses the three supported ImpactLoop hosts', () {
      final reservation = parseHandoverQr('impactloop://handover/abc123');
      expect(reservation?.type, HandoverQrType.reservationPickup);
      expect(reservation?.token, 'abc123');

      final delivery = parseHandoverQr(
        'impactloop://delivery-handover/abc123',
      );
      expect(delivery?.type, HandoverQrType.deliveryHandover);
      expect(delivery?.token, 'abc123');

      final pickup = parseHandoverQr(
        'impactloop://supplier-pickup-handover/abc123',
      );
      expect(pickup?.type, HandoverQrType.supplierDriverPickup);
      expect(pickup?.token, 'abc123');
    });

    test('rejects malformed payloads', () {
      expect(parseHandoverQr('http://handover/abc'), isNull);
      expect(parseHandoverQr('impactloop://unknown/abc'), isNull);
      expect(parseHandoverQr('impactloop://handover/'), isNull);
      expect(parseHandoverQr('impactloop://handover/a/b'), isNull);
      expect(parseHandoverQr('impactloop:///abc'), isNull);
      expect(parseHandoverQr(''), isNull);
      expect(parseHandoverQr('   '), isNull);
    });

    test('preserves the token exactly', () {
      const token = 'opaque-token-aaaaaaaaaaaaaaaaaaaaaaaa';
      final parsed = parseHandoverQr('impactloop://handover/$token');
      expect(parsed?.token, token);
      expect(parsed?.rawPayload, 'impactloop://handover/$token');
    });
  });

  group('in-app scanner validators share the parser', () {
    const reservation =
        'impactloop://handover/opaque-token-aaaaaaaaaaaaaaaaaaaaaaaa';
    const delivery =
        'impactloop://delivery-handover/opaque-token-aaaaaaaaaaaaaaaaaaaaaaaa';
    const pickup =
        'impactloop://supplier-pickup-handover/opaque-token-aaaaaaaaaaaaaaaaaaaaaaaa';

    test('scanner payload and deep link resolve to the same type', () {
      expect(parseHandoverQr(reservation)?.type, HandoverQrType.reservationPickup);
      expect(looksLikeImpactLoopPickupQr(reservation), isTrue);
      expect(looksLikeImpactLoopDeliveryHandoverQr(reservation), isFalse);
      expect(looksLikeImpactLoopSupplierPickupHandoverQr(reservation), isFalse);

      expect(parseHandoverQr(delivery)?.type, HandoverQrType.deliveryHandover);
      expect(looksLikeImpactLoopDeliveryHandoverQr(delivery), isTrue);
      expect(looksLikeImpactLoopPickupQr(delivery), isFalse);

      expect(
        parseHandoverQr(pickup)?.type,
        HandoverQrType.supplierDriverPickup,
      );
      expect(looksLikeImpactLoopSupplierPickupHandoverQr(pickup), isTrue);
      expect(looksLikeImpactLoopPickupQr(pickup), isFalse);
    });
  });
}
