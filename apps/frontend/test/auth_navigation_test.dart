import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/application/auth_route_helpers.dart';
import 'package:frontend/features/auth/data/models/user.dart';

User _testUser({List<String> roles = const ['LEARNER']}) {
  return User(
    id: 'user-1',
    displayName: 'Test Learner',
    email: 'learner@test.com',
    accountStatus: 'ACTIVE',
    roles: roles,
    createdAt: DateTime.utc(2026, 1, 1),
  );
}

void main() {
  group('supplierEntryRouteForUser', () {
    test('returns supplier registration for signed-out users', () {
      expect(supplierEntryRouteForUser(null), '/register?intent=supplier');
    });

    test('returns onboarding for learner-only users', () {
      expect(supplierEntryRouteForUser(_testUser()), becomeSupplierRoute);
    });

    test('returns overview for supplier users', () {
      expect(
        supplierEntryRouteForUser(
          _testUser(roles: const ['LEARNER', 'SUPPLIER']),
        ),
        supplierOverviewRoute,
      );
    });
  });
}
