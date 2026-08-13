import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/driver_portal/application/delivery_handover_qr_payload.dart';
import 'package:frontend/features/driver_portal/application/driver_delivery_qr_controller.dart';
import 'package:frontend/features/driver_portal/data/driver_deliveries_repository.dart';
import 'package:frontend/features/driver_portal/data/models/delivery_handover_verify_preview.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery.dart';

class _FakeDriverDeliveriesRepository implements DriverDeliveriesRepository {
  Future<DeliveryHandoverVerifyPreview> Function(String token)? onVerify;
  Future<DriverDelivery> Function(String token)? onConfirm;

  int verifyCalls = 0;
  int confirmCalls = 0;

  @override
  Future<DeliveryHandoverVerifyPreview> verifyDeliveryHandoverCredential(
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
  Future<DriverDelivery> confirmDeliveryHandoverCredential(
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

DeliveryHandoverVerifyPreview _preview() {
  return DeliveryHandoverVerifyPreview(
    deliveryId: 'del-1',
    learnerDisplayName: 'Majd Awwad',
    destinationCity: 'Ramallah',
    items: const [
      DeliveryHandoverVerifyPreviewItem(
        reservationId: 'res-1',
        materialId: 'mat-1',
        materialTitle: 'Arduino Uno',
        quantity: 1,
        unit: 'piece',
      ),
    ],
    expiresAt: DateTime.now().add(const Duration(hours: 1)),
  );
}

DriverDelivery _completedDelivery() {
  return DriverDelivery.fromJson({
    'id': 'del-1',
    'status': 'DELIVERED',
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
    'impactloop://delivery-handover/opaque-token-aaaaaaaaaaaaaaaaaaaaaaaa';

ProviderContainer _container(_FakeDriverDeliveriesRepository repo) {
  final container = ProviderContainer(
    overrides: [
      driverDeliveriesRepositoryProvider.overrideWithValue(repo),
    ],
  );
  container.listen(driverDeliveryQrControllerProvider, (_, _) {});
  return container;
}

void main() {
  test('looksLikeImpactLoopDeliveryHandoverQr accepts URI and opaque token', () {
    expect(looksLikeImpactLoopDeliveryHandoverQr(_validPayload), isTrue);
    expect(
      looksLikeImpactLoopDeliveryHandoverQr(
        'opaque-token-aaaaaaaaaaaaaaaaaaaaaaaa',
      ),
      isTrue,
    );
    expect(looksLikeImpactLoopDeliveryHandoverQr('https://example.com'), isFalse);
    expect(looksLikeImpactLoopDeliveryHandoverQr(''), isFalse);
  });

  test('valid QR triggers exactly one verify request', () async {
    final repo = _FakeDriverDeliveriesRepository()
      ..onVerify = (_) async {
        await Future<void>.delayed(const Duration(milliseconds: 20));
        return _preview();
      };
    final container = _container(repo);
    addTearDown(container.dispose);
    final notifier = container.read(driverDeliveryQrControllerProvider.notifier);

    await notifier.onCodeDetected(_validPayload);

    expect(repo.verifyCalls, 1);
    expect(repo.confirmCalls, 0);
    final state = container.read(driverDeliveryQrControllerProvider);
    expect(state.phase, DriverDeliveryQrPhase.verified);
    expect(state.preview?.learnerDisplayName, 'Majd Awwad');
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
      final notifier = container.read(driverDeliveryQrControllerProvider.notifier);

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
    final notifier = container.read(driverDeliveryQrControllerProvider.notifier);

    await notifier.onCodeDetected('https://example.com');

    expect(repo.verifyCalls, 0);
    expect(repo.confirmCalls, 0);
    final state = container.read(driverDeliveryQrControllerProvider);
    expect(state.phase, DriverDeliveryQrPhase.error);
    expect(state.errorKind, DriverDeliveryQrErrorKind.invalidPayload);
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
    final notifier = container.read(driverDeliveryQrControllerProvider.notifier);

    await notifier.onCodeDetected(_validPayload);
    await notifier.confirmHandover();

    expect(repo.verifyCalls, 1);
    expect(repo.confirmCalls, 1);
    expect(
      container.read(driverDeliveryQrControllerProvider).phase,
      DriverDeliveryQrPhase.completed,
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
    final notifier = container.read(driverDeliveryQrControllerProvider.notifier);

    await notifier.onCodeDetected(_validPayload);
    await Future.wait([
      notifier.confirmHandover(),
      notifier.confirmHandover(),
      notifier.confirmHandover(),
    ]);

    expect(repo.confirmCalls, 1);
    expect(
      container.read(driverDeliveryQrControllerProvider).phase,
      DriverDeliveryQrPhase.completed,
    );
  });
}
