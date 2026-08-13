import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/driver_portal/application/driver_supplier_pickup_qr_controller.dart';
import 'package:frontend/features/driver_portal/application/supplier_pickup_handover_qr_payload.dart';
import 'package:frontend/features/driver_portal/data/driver_deliveries_repository.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery.dart';
import 'package:frontend/features/driver_portal/data/models/supplier_pickup_handover_verify_preview.dart';

class _FakeDriverDeliveriesRepository implements DriverDeliveriesRepository {
  Future<SupplierPickupHandoverVerifyPreview> Function(String token)? onVerify;
  Future<DriverDelivery> Function(String token)? onConfirm;

  int verifyCalls = 0;
  int confirmCalls = 0;

  @override
  Future<SupplierPickupHandoverVerifyPreview> verifySupplierPickupHandoverCredential(
    String handoverToken,
  ) async {
    verifyCalls += 1;
    final handler = onVerify;
    if (handler == null) {
      throw StateError('onVerify not configured');
    }
    return handler(handoverToken);
  }

  @override
  Future<DriverDelivery> confirmSupplierPickupHandoverCredential(
    String handoverToken,
  ) async {
    confirmCalls += 1;
    final handler = onConfirm;
    if (handler == null) {
      throw StateError('onConfirm not configured');
    }
    return handler(handoverToken);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

SupplierPickupHandoverVerifyPreview _preview() {
  return SupplierPickupHandoverVerifyPreview(
    deliveryId: 'del-1',
    reservationId: 'res-1',
    supplierDisplayName: 'ImpactLoop Supplier',
    materialTitle: 'Arduino Uno',
    quantity: 1,
    unit: 'piece',
    pickupCity: 'Ramallah',
  );
}

DriverDelivery _completedDelivery() {
  return DriverDelivery.fromJson({
    'id': 'del-1',
    'status': 'PICKED_UP',
    'requestedAt': '2026-08-12T10:00:00.000Z',
    'material': {
      'id': 'mat-1',
      'title': 'Arduino Uno',
      'quantityRequested': 1,
      'unit': 'piece',
    },
    'pickupLocation': {'city': 'Ramallah'},
    'dropoffLocation': {'city': 'Ramallah'},
  });
}

const _validPayload =
    'impactloop://supplier-pickup-handover/opaque-token-aaaaaaaaaaaaaaaaaaaaaaaa';

ProviderContainer _container(_FakeDriverDeliveriesRepository repo) {
  final container = ProviderContainer(
    overrides: [
      driverDeliveriesRepositoryProvider.overrideWithValue(repo),
    ],
  );
  container.listen(driverSupplierPickupQrControllerProvider, (_, _) {});
  return container;
}

void main() {
  test('looksLikeImpactLoopSupplierPickupHandoverQr accepts URI and opaque token', () {
    expect(looksLikeImpactLoopSupplierPickupHandoverQr(_validPayload), isTrue);
    expect(
      looksLikeImpactLoopSupplierPickupHandoverQr(
        'opaque-token-aaaaaaaaaaaaaaaaaaaaaaaa',
      ),
      isTrue,
    );
    expect(
      looksLikeImpactLoopSupplierPickupHandoverQr(
        'impactloop://delivery-handover/token',
      ),
      isFalse,
    );
    expect(looksLikeImpactLoopSupplierPickupHandoverQr(''), isFalse);
  });

  test('valid QR triggers exactly one verify request', () async {
    final repo = _FakeDriverDeliveriesRepository()
      ..onVerify = (_) async {
        await Future<void>.delayed(const Duration(milliseconds: 20));
        return _preview();
      };
    final container = _container(repo);
    addTearDown(container.dispose);
    final notifier = container.read(driverSupplierPickupQrControllerProvider.notifier);

    await notifier.onCodeDetected(_validPayload);

    expect(repo.verifyCalls, 1);
    expect(repo.confirmCalls, 0);
    final state = container.read(driverSupplierPickupQrControllerProvider);
    expect(state.phase, DriverSupplierPickupQrPhase.verified);
    expect(state.preview?.supplierDisplayName, 'ImpactLoop Supplier');
  });

  test(
    'repeated camera frames while verifying cause only one verify request',
    () async {
      final repo = _FakeDriverDeliveriesRepository()
        ..onVerify = (_) async {
          await Future<void>.delayed(const Duration(milliseconds: 40));
          return _preview();
        };
      final container = _container(repo);
      addTearDown(container.dispose);
      final notifier = container.read(driverSupplierPickupQrControllerProvider.notifier);

      await Future.wait([
        notifier.onCodeDetected(_validPayload),
        notifier.onCodeDetected(_validPayload),
        notifier.onCodeDetected(_validPayload),
        notifier.onCodeDetected(_validPayload),
        notifier.onCodeDetected(_validPayload),
      ]);

      expect(repo.verifyCalls, 1);
      expect(repo.confirmCalls, 0);
    },
  );

  test('unrelated QR stays invalid and never confirms', () async {
    final repo = _FakeDriverDeliveriesRepository();
    repo.onVerify = (_) async => _preview();
    repo.onConfirm = (_) async => _completedDelivery();
    final container = _container(repo);
    addTearDown(container.dispose);
    final notifier = container.read(driverSupplierPickupQrControllerProvider.notifier);

    await notifier.onCodeDetected('https://example.com');

    expect(repo.verifyCalls, 0);
    expect(repo.confirmCalls, 0);
    final state = container.read(driverSupplierPickupQrControllerProvider);
    expect(state.phase, DriverSupplierPickupQrPhase.error);
    expect(state.errorKind, DriverSupplierPickupQrErrorKind.invalidPayload);
  });

  test('explicit confirm issues one confirm request and succeeds', () async {
    final repo = _FakeDriverDeliveriesRepository();
    repo.onVerify = (_) async => _preview();
    repo.onConfirm = (token) async {
      expect(token, _validPayload);
      return _completedDelivery();
    };
    final container = _container(repo);
    addTearDown(container.dispose);
    final notifier = container.read(driverSupplierPickupQrControllerProvider.notifier);

    await notifier.onCodeDetected(_validPayload);
    await notifier.confirmPickup();

    expect(repo.verifyCalls, 1);
    expect(repo.confirmCalls, 1);
    expect(
      container.read(driverSupplierPickupQrControllerProvider).phase,
      DriverSupplierPickupQrPhase.completed,
    );
  });

  test('double confirm tap issues at most one confirm request', () async {
    final repo = _FakeDriverDeliveriesRepository();
    repo.onVerify = (_) async => _preview();
    repo.onConfirm = (_) async {
      await Future<void>.delayed(const Duration(milliseconds: 40));
      return _completedDelivery();
    };
    final container = _container(repo);
    addTearDown(container.dispose);
    final notifier = container.read(driverSupplierPickupQrControllerProvider.notifier);

    await notifier.onCodeDetected(_validPayload);
    await Future.wait([
      notifier.confirmPickup(),
      notifier.confirmPickup(),
      notifier.confirmPickup(),
    ]);

    expect(repo.confirmCalls, 1);
    expect(
      container.read(driverSupplierPickupQrControllerProvider).phase,
      DriverSupplierPickupQrPhase.completed,
    );
  });
}
