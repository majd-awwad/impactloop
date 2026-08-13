import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/reservations/data/models/handover_credential.dart';
import 'package:frontend/features/supplier_portal/application/supplier_driver_pickup_handover_credential_controller.dart';
import 'package:frontend/features/supplier_portal/data/supplier_requests_api_repository.dart';
import 'package:frontend/features/supplier_portal/data/supplier_requests_repository.dart';

class _FakeSupplierRequestsRepository implements SupplierRequestsRepository {
  _FakeSupplierRequestsRepository(this._issue);

  final Future<HandoverCredential> Function(String reservationId) _issue;
  int issueCalls = 0;

  @override
  Future<HandoverCredential> issueDriverPickupHandoverCredential(
    String reservationId,
  ) {
    issueCalls += 1;
    return _issue(reservationId);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

HandoverCredential _credential({
  String token = 'opaque-token-aaaaaaaaaaaaaaaa',
  DateTime? expiresAt,
}) {
  final expiry =
      expiresAt ?? DateTime.now().toUtc().add(const Duration(hours: 1));
  return HandoverCredential(
    reservationId: 'res-1',
    handoverToken: token,
    qrPayload: 'impactloop://supplier-pickup-handover/$token',
    expiresAt: expiry.toLocal(),
  );
}

ProviderContainer _containerFor(
  _FakeSupplierRequestsRepository repo,
  String reservationId,
) {
  final container = ProviderContainer(
    overrides: [
      supplierRequestsRepositoryProvider.overrideWithValue(repo),
    ],
  );
  container.listen(
    supplierDriverPickupHandoverCredentialControllerProvider(reservationId),
    (_, _) {},
  );
  return container;
}

void main() {
  test('ensureIssued posts once and rebuilds reuse the same credential', () async {
    final repo = _FakeSupplierRequestsRepository((_) async {
      await Future<void>.delayed(const Duration(milliseconds: 20));
      return _credential(token: 'first-token-bbbbbbbbbbbbbbbb');
    });
    final container = _containerFor(repo, 'res-1');
    addTearDown(container.dispose);

    final notifier = container.read(
      supplierDriverPickupHandoverCredentialControllerProvider('res-1').notifier,
    );

    await Future.wait([
      notifier.ensureIssued(),
      notifier.ensureIssued(),
      notifier.ensureIssued(),
    ]);

    expect(repo.issueCalls, 1);
    final first = container.read(
      supplierDriverPickupHandoverCredentialControllerProvider('res-1'),
    );
    expect(
      first.phase,
      SupplierDriverPickupHandoverCredentialPhase.loaded,
    );
    expect(
      first.credential?.qrPayload,
      contains('first-token-bbbbbbbbbbbbbbbb'),
    );

    await notifier.ensureIssued();
    await notifier.ensureIssued();
    expect(repo.issueCalls, 1);
  });

  test('reissue forces a new credential', () async {
    var tokenIndex = 0;
    final repo = _FakeSupplierRequestsRepository((_) async {
      tokenIndex += 1;
      return _credential(token: 'token-$tokenIndex-${'x' * 20}');
    });
    final container = _containerFor(repo, 'res-3');
    addTearDown(container.dispose);

    final notifier = container.read(
      supplierDriverPickupHandoverCredentialControllerProvider('res-3').notifier,
    );

    await notifier.ensureIssued();
    final firstPayload = container
        .read(supplierDriverPickupHandoverCredentialControllerProvider('res-3'))
        .credential
        ?.qrPayload;
    await notifier.reissue();
    final secondPayload = container
        .read(supplierDriverPickupHandoverCredentialControllerProvider('res-3'))
        .credential
        ?.qrPayload;

    expect(repo.issueCalls, 2);
    expect(firstPayload, isNot(secondPayload));
  });

  test('expired credential is marked and reissue remains available', () async {
    final repo = _FakeSupplierRequestsRepository((_) async {
      return _credential(
        expiresAt: DateTime.now().toUtc().subtract(const Duration(minutes: 1)),
      );
    });
    final container = _containerFor(repo, 'res-5');
    addTearDown(container.dispose);

    final notifier = container.read(
      supplierDriverPickupHandoverCredentialControllerProvider('res-5').notifier,
    );
    await notifier.ensureIssued();
    notifier.markExpiredIfNeeded();

    final state = container.read(
      supplierDriverPickupHandoverCredentialControllerProvider('res-5'),
    );
    expect(state.phase, SupplierDriverPickupHandoverCredentialPhase.error);
    expect(state.error, 'EXPIRED');
    expect(state.isExpired, isTrue);
  });
}
