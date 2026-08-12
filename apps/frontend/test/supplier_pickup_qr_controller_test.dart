import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/supplier_portal/application/pickup_qr_payload.dart';
import 'package:frontend/features/supplier_portal/application/supplier_pickup_qr_controller.dart';
import 'package:frontend/features/supplier_portal/data/models/handover_verify_preview.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';
import 'package:frontend/features/supplier_portal/data/supplier_requests_api_repository.dart';
import 'package:frontend/features/supplier_portal/data/supplier_requests_repository.dart';

class _FakeSupplierRequestsRepository implements SupplierRequestsRepository {
  Future<HandoverVerifyPreview> Function(String token)? onVerify;
  Future<SupplierIncomingRequest> Function(String token)? onConfirm;

  int verifyCalls = 0;
  int confirmCalls = 0;
  final List<String> verifiedTokens = <String>[];
  final List<String> confirmedTokens = <String>[];

  @override
  Future<HandoverVerifyPreview> verifyHandoverCredential(
    String handoverToken,
  ) async {
    verifyCalls += 1;
    verifiedTokens.add(handoverToken);
    final handler = onVerify;
    if (handler == null) {
      throw StateError('onVerify not configured');
    }
    return handler(handoverToken);
  }

  @override
  Future<SupplierIncomingRequest> confirmHandoverCredential(
    String handoverToken,
  ) async {
    confirmCalls += 1;
    confirmedTokens.add(handoverToken);
    final handler = onConfirm;
    if (handler == null) {
      throw StateError('onConfirm not configured');
    }
    return handler(handoverToken);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

HandoverVerifyPreview _preview() {
  return HandoverVerifyPreview(
    reservationId: 'res-1',
    materialId: 'mat-1',
    materialTitle: 'Arduino Uno',
    quantity: 1,
    unit: 'piece',
    learnerDisplayName: 'Majd Awwad',
    expiresAt: DateTime.now().add(const Duration(hours: 1)),
  );
}

SupplierIncomingRequest _completedReservation() {
  return SupplierIncomingRequest.fromJson({
    'id': 'res-1',
    'materialTitle': 'Arduino Uno',
    'learnerName': 'Majd Awwad',
    'quantityRequested': 1,
    'unit': 'piece',
    'status': 'COMPLETED',
    'requestedAt': '2026-08-12T10:00:00.000Z',
    'canSupplierComplete': false,
  });
}

const _validPayload =
    'impactloop://handover/opaque-token-aaaaaaaaaaaaaaaaaaaaaaaa';

ProviderContainer _container(_FakeSupplierRequestsRepository repo) {
  final container = ProviderContainer(
    overrides: [
      supplierRequestsRepositoryProvider.overrideWithValue(repo),
    ],
  );
  container.listen(supplierPickupQrControllerProvider, (_, _) {});
  return container;
}

void main() {
  test('looksLikeImpactLoopPickupQr accepts URI and opaque token', () {
    expect(looksLikeImpactLoopPickupQr(_validPayload), isTrue);
    expect(
      looksLikeImpactLoopPickupQr('opaque-token-aaaaaaaaaaaaaaaaaaaaaaaa'),
      isTrue,
    );
    expect(looksLikeImpactLoopPickupQr('https://example.com'), isFalse);
    expect(looksLikeImpactLoopPickupQr(''), isFalse);
    expect(looksLikeImpactLoopPickupQr('impactloop://handover/'), isFalse);
  });

  test('HandoverVerifyPreview.fromJson maps backend verify fields', () {
    final parsed = HandoverVerifyPreview.fromJson({
      'reservationId': 'res-9',
      'material': {'id': 'mat-9', 'title': 'Breadboard'},
      'quantity': 2,
      'unit': 'piece',
      'learner': {'displayName': 'Sara'},
      'expiresAt': '2026-08-12T18:30:00.000Z',
    });

    expect(parsed.reservationId, 'res-9');
    expect(parsed.materialId, 'mat-9');
    expect(parsed.materialTitle, 'Breadboard');
    expect(parsed.quantity, 2);
    expect(parsed.unit, 'piece');
    expect(parsed.learnerDisplayName, 'Sara');
    expect(parsed.expiresAt, isNotNull);
  });

  test('valid ImpactLoop QR triggers exactly one verify request', () async {
    final repo = _FakeSupplierRequestsRepository()
      ..onVerify = (_) async {
        await Future<void>.delayed(const Duration(milliseconds: 20));
        return _preview();
      };
    final container = _container(repo);
    addTearDown(container.dispose);
    final notifier = container.read(supplierPickupQrControllerProvider.notifier);

    await notifier.onCodeDetected(_validPayload);

    expect(repo.verifyCalls, 1);
    expect(repo.confirmCalls, 0);
    final state = container.read(supplierPickupQrControllerProvider);
    expect(state.phase, SupplierPickupQrPhase.verified);
    expect(state.preview?.materialTitle, 'Arduino Uno');
  });

  test(
    'repeated camera frames while verifying cause only one verify request',
    () async {
      final repo = _FakeSupplierRequestsRepository()
        ..onVerify = (_) async {
          await Future<void>.delayed(const Duration(milliseconds: 40));
          return _preview();
        };
      final container = _container(repo);
      addTearDown(container.dispose);
      final notifier =
          container.read(supplierPickupQrControllerProvider.notifier);

      await Future.wait([
        notifier.onCodeDetected(_validPayload),
        notifier.onCodeDetected(_validPayload),
        notifier.onCodeDetected(_validPayload),
        notifier.onCodeDetected(_validPayload),
        notifier.onCodeDetected(_validPayload),
      ]);

      expect(repo.verifyCalls, 1);
      expect(repo.confirmCalls, 0);
      expect(
        container.read(supplierPickupQrControllerProvider).phase,
        SupplierPickupQrPhase.verified,
      );
    },
  );

  test('unrelated QR stays in invalid state and never confirms', () async {
    final repo = _FakeSupplierRequestsRepository();
    repo.onVerify = (_) async => _preview();
    repo.onConfirm = (_) async => _completedReservation();
    final container = _container(repo);
    addTearDown(container.dispose);
    final notifier = container.read(supplierPickupQrControllerProvider.notifier);

    await notifier.onCodeDetected('https://example.com');

    expect(repo.verifyCalls, 0);
    expect(repo.confirmCalls, 0);
    final state = container.read(supplierPickupQrControllerProvider);
    expect(state.phase, SupplierPickupQrPhase.error);
    expect(state.errorKind, SupplierPickupQrErrorKind.invalidPayload);
  });

  test('successful verify never calls confirm by itself', () async {
    final repo = _FakeSupplierRequestsRepository();
    repo.onVerify = (_) async => _preview();
    repo.onConfirm = (_) async => _completedReservation();
    final container = _container(repo);
    addTearDown(container.dispose);
    final notifier = container.read(supplierPickupQrControllerProvider.notifier);

    await notifier.onCodeDetected(_validPayload);

    expect(repo.verifyCalls, 1);
    expect(repo.confirmCalls, 0);
    expect(
      container.read(supplierPickupQrControllerProvider).phase,
      SupplierPickupQrPhase.verified,
    );
  });

  test('verify failure allows scanning again', () async {
    final repo = _FakeSupplierRequestsRepository()
      ..onVerify = (_) async {
        throw const ApiException(
          message: 'Invalid',
          code: 'HANDOVER_CREDENTIAL_INVALID',
        );
      };
    final container = _container(repo);
    addTearDown(container.dispose);
    final notifier = container.read(supplierPickupQrControllerProvider.notifier);

    await notifier.onCodeDetected(_validPayload);
    expect(
      container.read(supplierPickupQrControllerProvider).phase,
      SupplierPickupQrPhase.error,
    );
    expect(
      container.read(supplierPickupQrControllerProvider).errorKind,
      SupplierPickupQrErrorKind.verifyFailed,
    );

    notifier.resumeScanning();
    expect(
      container.read(supplierPickupQrControllerProvider).phase,
      SupplierPickupQrPhase.scanning,
    );

    repo.onVerify = (_) async => _preview();
    await notifier.onCodeDetected(_validPayload);
    expect(repo.verifyCalls, 2);
    expect(
      container.read(supplierPickupQrControllerProvider).phase,
      SupplierPickupQrPhase.verified,
    );
  });

  test('explicit confirm issues one confirm request and succeeds', () async {
    final repo = _FakeSupplierRequestsRepository();
    repo.onVerify = (_) async => _preview();
    repo.onConfirm = (token) async {
      expect(token, _validPayload);
      await Future<void>.delayed(const Duration(milliseconds: 10));
      return _completedReservation();
    };
    final container = _container(repo);
    addTearDown(container.dispose);
    final notifier = container.read(supplierPickupQrControllerProvider.notifier);

    await notifier.onCodeDetected(_validPayload);
    await notifier.confirmHandover();

    expect(repo.verifyCalls, 1);
    expect(repo.confirmCalls, 1);
    expect(
      container.read(supplierPickupQrControllerProvider).phase,
      SupplierPickupQrPhase.completed,
    );
  });

  test('double confirm tap issues at most one confirm request', () async {
    final repo = _FakeSupplierRequestsRepository();
    repo.onVerify = (_) async => _preview();
    repo.onConfirm = (_) async {
      await Future<void>.delayed(const Duration(milliseconds: 40));
      return _completedReservation();
    };
    final container = _container(repo);
    addTearDown(container.dispose);
    final notifier = container.read(supplierPickupQrControllerProvider.notifier);

    await notifier.onCodeDetected(_validPayload);
    await Future.wait([
      notifier.confirmHandover(),
      notifier.confirmHandover(),
      notifier.confirmHandover(),
    ]);

    expect(repo.confirmCalls, 1);
    expect(
      container.read(supplierPickupQrControllerProvider).phase,
      SupplierPickupQrPhase.completed,
    );
  });

  test('cancel after verify clears preview and allows another scan', () async {
    final repo = _FakeSupplierRequestsRepository();
    repo.onVerify = (_) async => _preview();
    final container = _container(repo);
    addTearDown(container.dispose);
    final notifier = container.read(supplierPickupQrControllerProvider.notifier);

    await notifier.onCodeDetected(_validPayload);
    expect(
      container.read(supplierPickupQrControllerProvider).phase,
      SupplierPickupQrPhase.verified,
    );
    expect(repo.confirmCalls, 0);

    notifier.resumeScanning();
    final cleared = container.read(supplierPickupQrControllerProvider);
    expect(cleared.phase, SupplierPickupQrPhase.scanning);
    expect(cleared.preview, isNull);
    expect(cleared.scannedPayload, isNull);

    await notifier.onCodeDetected(_validPayload);
    expect(repo.verifyCalls, 2);
    expect(repo.confirmCalls, 0);
    expect(
      container.read(supplierPickupQrControllerProvider).phase,
      SupplierPickupQrPhase.verified,
    );
  });

  test('invalid QR then valid QR recovers without confirm', () async {
    final repo = _FakeSupplierRequestsRepository();
    repo.onVerify = (_) async => _preview();
    final container = _container(repo);
    addTearDown(container.dispose);
    final notifier = container.read(supplierPickupQrControllerProvider.notifier);

    await notifier.onCodeDetected('https://example.com');
    expect(
      container.read(supplierPickupQrControllerProvider).errorKind,
      SupplierPickupQrErrorKind.invalidPayload,
    );

    notifier.resumeScanning();
    await notifier.onCodeDetected(_validPayload);

    expect(repo.verifyCalls, 1);
    expect(repo.confirmCalls, 0);
    expect(
      container.read(supplierPickupQrControllerProvider).phase,
      SupplierPickupQrPhase.verified,
    );
  });

  test('confirm failure after verify keeps non-completed state and allows rescan', () async {
    final repo = _FakeSupplierRequestsRepository();
    repo.onVerify = (_) async => _preview();
    repo.onConfirm = (_) async {
      throw const ApiException(
        message: 'Expired',
        code: 'HANDOVER_CREDENTIAL_INVALID',
      );
    };
    final container = _container(repo);
    addTearDown(container.dispose);
    final notifier = container.read(supplierPickupQrControllerProvider.notifier);

    await notifier.onCodeDetected(_validPayload);
    await notifier.confirmHandover();

    final failed = container.read(supplierPickupQrControllerProvider);
    expect(failed.phase, SupplierPickupQrPhase.error);
    expect(failed.errorKind, SupplierPickupQrErrorKind.confirmFailed);
    expect(failed.completedReservation, isNull);

    notifier.resumeScanning();
    repo.onConfirm = (_) async => _completedReservation();
    await notifier.onCodeDetected(_validPayload);
    await notifier.confirmHandover();

    expect(
      container.read(supplierPickupQrControllerProvider).phase,
      SupplierPickupQrPhase.completed,
    );
  });
}
