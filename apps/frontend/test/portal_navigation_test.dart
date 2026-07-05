import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/application/auth_navigation.dart';
import 'package:frontend/features/auth/data/models/user.dart';

User _user({
  List<String> roles = const ['LEARNER'],
  String activeRole = 'LEARNER',
  bool canSwitchToLearner = false,
  bool canSwitchToSupplier = false,
}) {
  return User(
    id: 'user-1',
    displayName: 'Test User',
    email: 'user@test.com',
    accountStatus: 'ACTIVE',
    roles: roles,
    activeRole: activeRole,
    canSwitchToLearner: canSwitchToLearner,
    canSwitchToSupplier: canSwitchToSupplier,
    createdAt: DateTime.utc(2026, 1, 1),
  );
}

void main() {
  group('postAuthRouteForUser', () {
    test('dual-role user with learner active role lands on home', () {
      expect(
        postAuthRouteForUser(
          _user(
            roles: const ['LEARNER', 'SUPPLIER'],
            activeRole: 'LEARNER',
            canSwitchToSupplier: true,
          ),
        ),
        homeRoute,
      );
    });

    test(
      'dual-role user with supplier active role lands on supplier overview',
      () {
        expect(
          postAuthRouteForUser(
            _user(
              roles: const ['LEARNER', 'SUPPLIER'],
              activeRole: 'SUPPLIER',
              canSwitchToLearner: true,
              canSwitchToSupplier: true,
            ),
          ),
          supplierOverviewRoute,
        );
      },
    );
  });

  group('portal switch helpers', () {
    test('switching to learner lands on home', () {
      final user = _user(
        roles: const ['LEARNER', 'SUPPLIER'],
        activeRole: 'LEARNER',
        canSwitchToSupplier: true,
      );

      expect(oppositePortalSwitchRoute(user, 'LEARNER'), homeRoute);
    });

    test('switching to supplier lands on supplier overview', () {
      final user = _user(
        roles: const ['LEARNER', 'SUPPLIER'],
        activeRole: 'SUPPLIER',
        canSwitchToLearner: true,
      );

      expect(
        oppositePortalSwitchRoute(user, 'SUPPLIER'),
        supplierOverviewRoute,
      );
    });

    test('shows learner switch for supplier mode individual supplier', () {
      final user = _user(
        roles: const ['LEARNER', 'SUPPLIER'],
        activeRole: 'SUPPLIER',
        canSwitchToLearner: true,
      );

      expect(shouldShowSwitchToLearner(user), isTrue);
      expect(shouldShowSwitchToSupplier(user), isFalse);
    });
  });
}
