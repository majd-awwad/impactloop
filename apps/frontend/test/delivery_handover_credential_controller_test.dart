import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/deliveries/application/delivery_handover_credential_controller.dart';
import 'package:frontend/features/deliveries/data/deliveries_repository.dart';
import 'package:frontend/features/deliveries/data/models/delivery_handover_credential.dart';

class _FakeDeliveriesRepository implements DeliveriesRepository {
  _FakeDeliveriesRepository(this._issue);

  final Future<DeliveryHandoverCredential> Function(String deliveryId) _issue;
  int issueCalls = 0;

  @override
  Future<DeliveryHandoverCredential> issueDeliveryHandoverCredential(
    String deliveryId,
  ) {
    issueCalls += 1;
    return _issue(deliveryId);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

DeliveryHandoverCredential _credential({
  String token = 'opaque-token-aaaaaaaaaaaaaaaa',
  DateTime? expiresAt,
}) {
  final expiry =
      expiresAt ?? DateTime.now().toUtc().add(const Duration(hours: 1));
  return DeliveryHandoverCredential(
    deliveryId: 'del-1',
    handoverToken: token,
    qrPayload: 'impactloop://delivery-handover/$token',
    expiresAt: expiry.toLocal(),
  );
}

ProviderContainer _containerFor(
  _FakeDeliveriesRepository repo,
  String deliveryId,
) {
  final container = ProviderContainer(
    overrides: [
      deliveriesRepositoryProvider.overrideWithValue(repo),
    ],
  );
  container.listen(
    deliveryHandoverCredentialControllerProvider(deliveryId),
    (_, _) {},
  );
  return container;
}

void main() {
  test('DeliveryHandoverCredential.fromJson parses qrPayload and expiresAt', () {
    final parsed = DeliveryHandoverCredential.fromJson({
      'deliveryId': 'del-9',
      'handoverToken': 'tok-abc',
      'qrPayload': 'impactloop://delivery-handover/tok-abc',
      'expiresAt': '2026-08-12T18:30:00.000Z',
    });

    expect(parsed.deliveryId, 'del-9');
    expect(parsed.handoverToken, 'tok-abc');
    expect(parsed.qrPayload, 'impactloop://delivery-handover/tok-abc');
    expect(parsed.expiresAt.isUtc, isFalse);
  });

  test('ensureIssued posts once and rebuilds reuse the same credential', () async {
    final repo = _FakeDeliveriesRepository((_) async {
      await Future<void>.delayed(const Duration(milliseconds: 20));
      return _credential(token: 'first-token-bbbbbbbbbbbbbbbb');
    });
    final container = _containerFor(repo, 'del-1');
    addTearDown(container.dispose);

    final notifier = container.read(
      deliveryHandoverCredentialControllerProvider('del-1').notifier,
    );

    await Future.wait([
      notifier.ensureIssued(),
      notifier.ensureIssued(),
      notifier.ensureIssued(),
    ]);

    expect(repo.issueCalls, 1);
    final first = container.read(
      deliveryHandoverCredentialControllerProvider('del-1'),
    );
    expect(first.phase, DeliveryHandoverCredentialPhase.loaded);
    expect(first.credential?.qrPayload, contains('first-token-bbbbbbbbbbbbbbbb'));

    await notifier.ensureIssued();
    await notifier.ensureIssued();
    expect(repo.issueCalls, 1);
    expect(
      container.read(deliveryHandoverCredentialControllerProvider('del-1'))
          .credential
          ?.qrPayload,
      first.credential?.qrPayload,
    );
  });

  test('reissue forces a new credential', () async {
    var tokenIndex = 0;
    final repo = _FakeDeliveriesRepository((_) async {
      tokenIndex += 1;
      return _credential(token: 'token-$tokenIndex-${'x' * 20}');
    });
    final container = _containerFor(repo, 'del-3');
    addTearDown(container.dispose);

    final notifier = container.read(
      deliveryHandoverCredentialControllerProvider('del-3').notifier,
    );

    await notifier.ensureIssued();
    final firstPayload = container
        .read(deliveryHandoverCredentialControllerProvider('del-3'))
        .credential
        ?.qrPayload;
    await notifier.reissue();
    final secondPayload = container
        .read(deliveryHandoverCredentialControllerProvider('del-3'))
        .credential
        ?.qrPayload;

    expect(repo.issueCalls, 2);
    expect(firstPayload, isNot(secondPayload));
  });

  test('expired credential is marked and reissue remains available', () async {
    final repo = _FakeDeliveriesRepository((_) async {
      return _credential(
        expiresAt: DateTime.now().toUtc().subtract(const Duration(minutes: 1)),
      );
    });
    final container = _containerFor(repo, 'del-5');
    addTearDown(container.dispose);

    final notifier = container.read(
      deliveryHandoverCredentialControllerProvider('del-5').notifier,
    );
    await notifier.ensureIssued();
    notifier.markExpiredIfNeeded();

    final state = container.read(
      deliveryHandoverCredentialControllerProvider('del-5'),
    );
    expect(state.phase, DeliveryHandoverCredentialPhase.error);
    expect(state.error, 'EXPIRED');
    expect(state.isExpired, isTrue);
  });
}
