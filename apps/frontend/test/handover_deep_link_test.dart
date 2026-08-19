import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/application/auth_navigation.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/shared/handover/handover_deep_link.dart';
import 'package:frontend/shared/handover/handover_qr_payload.dart';

User _user({List<String> roles = const ['LEARNER'], String? activeRole}) {
  return User(
    id: 'user-1',
    displayName: 'Test User',
    email: 'user@test.com',
    accountStatus: 'ACTIVE',
    roles: roles,
    activeRole: activeRole ?? roles.first,
    createdAt: DateTime.utc(2026, 1, 1),
  );
}

void main() {
  group('normalizeHandoverDeepLink', () {
    test('rewrites supported custom-scheme URIs onto /handover-entry', () {
      expect(
        normalizeHandoverDeepLink(Uri.parse('impactloop://handover/TOKEN')),
        '/handover-entry?type=reservationPickup&token=TOKEN',
      );
      expect(
        normalizeHandoverDeepLink(
          Uri.parse('impactloop://delivery-handover/TOKEN'),
        ),
        '/handover-entry?type=deliveryHandover&token=TOKEN',
      );
      expect(
        normalizeHandoverDeepLink(
          Uri.parse('impactloop://supplier-pickup-handover/TOKEN'),
        ),
        '/handover-entry?type=supplierDriverPickup&token=TOKEN',
      );
    });

    test('maps unsupported impactloop hosts to the entry route without a token', () {
      expect(
        normalizeHandoverDeepLink(Uri.parse('impactloop://unknown/abc')),
        handoverEntryRoute,
      );
    });

    test('ignores ordinary app locations', () {
      expect(normalizeHandoverDeepLink(Uri.parse('/home')), isNull);
      expect(normalizeHandoverDeepLink(Uri.parse('/login')), isNull);
    });
  });

  test('login from= keeps the internal handover entry including the token', () {
    const from = '/handover-entry?type=reservationPickup&token=TOKEN';
    expect(sanitizeRedirectTarget(from, fallback: '/home'), from);
  });

  group('userCanProcessHandoverQr', () {
    test('reservation pickup is a supplier capability', () {
      expect(
        userCanProcessHandoverQr(
          _user(roles: const ['SUPPLIER'], activeRole: 'SUPPLIER'),
          HandoverQrType.reservationPickup,
        ),
        isTrue,
      );
      expect(
        userCanProcessHandoverQr(
          _user(roles: const ['DRIVER'], activeRole: 'DRIVER'),
          HandoverQrType.reservationPickup,
        ),
        isFalse,
      );
    });

    test('delivery and supplier-driver pickup are driver capabilities', () {
      final driver = _user(roles: const ['DRIVER'], activeRole: 'DRIVER');
      expect(
        userCanProcessHandoverQr(driver, HandoverQrType.deliveryHandover),
        isTrue,
      );
      expect(
        userCanProcessHandoverQr(driver, HandoverQrType.supplierDriverPickup),
        isTrue,
      );
      expect(
        userCanProcessHandoverQr(
          _user(roles: const ['SUPPLIER'], activeRole: 'SUPPLIER'),
          HandoverQrType.deliveryHandover,
        ),
        isFalse,
      );
    });
  });
}
