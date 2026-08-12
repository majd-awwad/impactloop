import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/reservations/application/handover_credential_controller.dart';
import 'package:frontend/features/reservations/data/models/handover_credential.dart';
import 'package:frontend/features/reservations/data/reservations_repository.dart';

class _FakeReservationsRepository implements ReservationsRepository {
  _FakeReservationsRepository(this._issue);

  final Future<HandoverCredential> Function(String reservationId) _issue;
  int issueCalls = 0;

  @override
  Future<HandoverCredential> issueHandoverCredential(String reservationId) {
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
    qrPayload: 'impactloop://handover/$token',
    expiresAt: expiry.toLocal(),
  );
}

ProviderContainer _containerFor(
  _FakeReservationsRepository repo,
  String reservationId,
) {
  final container = ProviderContainer(
    overrides: [
      reservationsRepositoryProvider.overrideWithValue(repo),
    ],
  );
  // Keep autoDispose family alive across async issuance (mirrors detail page watch).
  container.listen(
    handoverCredentialControllerProvider(reservationId),
    (_, __) {},
  );
  return container;
}

void main() {
  test('HandoverCredential.fromJson parses qrPayload and expiresAt', () {
    final parsed = HandoverCredential.fromJson({
      'reservationId': 'res-9',
      'handoverToken': 'tok-abc',
      'qrPayload': 'impactloop://handover/tok-abc',
      'expiresAt': '2026-08-12T18:30:00.000Z',
    });

    expect(parsed.reservationId, 'res-9');
    expect(parsed.handoverToken, 'tok-abc');
    expect(parsed.qrPayload, 'impactloop://handover/tok-abc');
    expect(parsed.expiresAt.isUtc, isFalse);
  });

  test('ensureIssued posts once and rebuilds reuse the same credential', () async {
    final repo = _FakeReservationsRepository((_) async {
      await Future<void>.delayed(const Duration(milliseconds: 20));
      return _credential(token: 'first-token-bbbbbbbbbbbbbbbb');
    });
    final container = _containerFor(repo, 'res-1');
    addTearDown(container.dispose);

    final notifier = container.read(
      handoverCredentialControllerProvider('res-1').notifier,
    );

    await Future.wait([
      notifier.ensureIssued(),
      notifier.ensureIssued(),
      notifier.ensureIssued(),
    ]);

    expect(repo.issueCalls, 1);
    final first = container.read(handoverCredentialControllerProvider('res-1'));
    expect(first.phase, HandoverCredentialPhase.loaded);
    expect(first.credential?.qrPayload, contains('first-token-bbbbbbbbbbbbbbbb'));

    await notifier.ensureIssued();
    await notifier.ensureIssued();
    expect(repo.issueCalls, 1);
    expect(
      container.read(handoverCredentialControllerProvider('res-1')).credential?.qrPayload,
      first.credential?.qrPayload,
    );
  });

  test('overlapping ensureIssued while loading issues at most once', () async {
    final repo = _FakeReservationsRepository((_) async {
      await Future<void>.delayed(const Duration(milliseconds: 40));
      return _credential();
    });
    final container = _containerFor(repo, 'res-2');
    addTearDown(container.dispose);

    final notifier = container.read(
      handoverCredentialControllerProvider('res-2').notifier,
    );

    await Future.wait([
      notifier.ensureIssued(),
      notifier.ensureIssued(),
    ]);

    expect(repo.issueCalls, 1);
  });

  test('reissue forces a new credential', () async {
    var tokenIndex = 0;
    final repo = _FakeReservationsRepository((_) async {
      tokenIndex += 1;
      return _credential(token: 'token-$tokenIndex-${'x' * 20}');
    });
    final container = _containerFor(repo, 'res-3');
    addTearDown(container.dispose);

    final notifier = container.read(
      handoverCredentialControllerProvider('res-3').notifier,
    );

    await notifier.ensureIssued();
    final firstPayload = container
        .read(handoverCredentialControllerProvider('res-3'))
        .credential
        ?.qrPayload;
    await notifier.reissue();
    final secondPayload = container
        .read(handoverCredentialControllerProvider('res-3'))
        .credential
        ?.qrPayload;

    expect(repo.issueCalls, 2);
    expect(firstPayload, isNot(secondPayload));
  });

  test('API failure surfaces error without crashing controller', () async {
    final repo = _FakeReservationsRepository((_) async {
      throw Exception('network down');
    });
    final container = _containerFor(repo, 'res-4');
    addTearDown(container.dispose);

    final notifier = container.read(
      handoverCredentialControllerProvider('res-4').notifier,
    );
    await notifier.ensureIssued();

    final state = container.read(handoverCredentialControllerProvider('res-4'));
    expect(state.phase, HandoverCredentialPhase.error);
    expect(state.error, isNotNull);
  });

  test('expired credential is marked and reissue remains available', () async {
    final repo = _FakeReservationsRepository((_) async {
      return _credential(
        expiresAt: DateTime.now().toUtc().subtract(const Duration(minutes: 1)),
      );
    });
    final container = _containerFor(repo, 'res-5');
    addTearDown(container.dispose);

    final notifier = container.read(
      handoverCredentialControllerProvider('res-5').notifier,
    );
    await notifier.ensureIssued();
    notifier.markExpiredIfNeeded();

    final state = container.read(handoverCredentialControllerProvider('res-5'));
    expect(state.phase, HandoverCredentialPhase.error);
    expect(state.error, 'EXPIRED');
    expect(state.isExpired, isTrue);
  });
}
