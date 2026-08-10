import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/application/auth_navigation.dart';
import 'package:frontend/features/auth/application/portal_navigation.dart';
import 'package:frontend/features/auth/data/models/user.dart';

User _user({
  List<String> roles = const ['LEARNER'],
  String activeRole = 'LEARNER',
  bool canSwitchToLearner = false,
  bool canSwitchToSupplier = false,
  bool canBecomeLearner = false,
  SupplierProfile? supplierProfile,
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
    canBecomeLearner: canBecomeLearner,
    supplierProfile: supplierProfile,
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

    test('become supplier is hidden for existing suppliers', () {
      final user = _user(
        roles: const ['LEARNER', 'SUPPLIER'],
        activeRole: 'LEARNER',
        canSwitchToSupplier: true,
        supplierProfile: const SupplierProfile(
          supplierType: 'STUDENT_SUPPLIER',
          publicName: 'Test Supplier',
        ),
      );

      expect(shouldShowBecomeSupplier(user), isFalse);
    });

    test('become supplier is shown for learner-only accounts', () {
      final user = _user(roles: const ['LEARNER'], activeRole: 'LEARNER');

      expect(shouldShowBecomeSupplier(user), isTrue);
    });

    test('become learner is hidden for admin accounts', () {
      final user = _user(
        roles: const ['ADMIN', 'SUPPLIER'],
        activeRole: 'SUPPLIER',
        supplierProfile: const SupplierProfile(
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: 'Test Supplier',
        ),
      );

      expect(shouldShowBecomeLearner(user), isFalse);
    });

    test(
      'become learner is shown for personal supplier without learner access',
      () {
        final user = _user(
          roles: const ['SUPPLIER'],
          activeRole: 'SUPPLIER',
          canBecomeLearner: true,
          supplierProfile: const SupplierProfile(
            supplierType: 'INDIVIDUAL_SUPPLIER',
            publicName: 'Test Supplier',
          ),
        );

        expect(shouldShowBecomeLearner(user), isTrue);
        expect(shouldShowSwitchToLearner(user), isFalse);
      },
    );
  });

  group('profileRouteForActiveRole', () {
    test('learner-active account stays on learner profile hub', () {
      final user = _user(
        roles: const ['LEARNER', 'SUPPLIER'],
        activeRole: 'LEARNER',
        canSwitchToSupplier: true,
      );

      expect(profileRouteForActiveRole(user), profileRoute);
    });

    test('supplier-active account targets its supplier overview', () {
      final user = _user(
        roles: const ['LEARNER', 'SUPPLIER'],
        activeRole: 'SUPPLIER',
        canSwitchToLearner: true,
        canSwitchToSupplier: true,
        supplierProfile: const SupplierProfile(
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: 'Reuse Lab',
        ),
      );

      expect(profileRouteForActiveRole(user), supplierOverviewRoute);
    });

    test('staff active roles use their existing portal targets', () {
      expect(
        profileRouteForActiveRole(
          _user(roles: const ['ADMIN'], activeRole: 'ADMIN'),
        ),
        adminPortalRoute,
      );
      expect(
        profileRouteForActiveRole(
          _user(roles: const ['DRIVER'], activeRole: 'DRIVER'),
        ),
        driverPortalRoute,
      );
    });
  });

  group('activeLearnerProfileRedirect', () {
    test('allows only learner-active accounts', () {
      expect(activeLearnerProfileRedirect(_user()), isNull);
      expect(
        activeLearnerProfileRedirect(
          _user(roles: const ['LEARNER', 'SUPPLIER'], activeRole: 'LEARNER'),
        ),
        isNull,
      );
    });

    test('returns supplier-active accounts to their supplier overview', () {
      expect(
        activeLearnerProfileRedirect(
          _user(roles: const ['LEARNER', 'SUPPLIER'], activeRole: 'SUPPLIER'),
        ),
        supplierOverviewRoute,
      );
      expect(
        activeLearnerProfileRedirect(
          _user(roles: const ['SUPPLIER'], activeRole: 'SUPPLIER'),
        ),
        supplierOverviewRoute,
      );
    });

    test('returns staff accounts to their active portal', () {
      expect(
        activeLearnerProfileRedirect(
          _user(roles: const ['ADMIN'], activeRole: 'ADMIN'),
        ),
        adminPortalRoute,
      );
      expect(
        activeLearnerProfileRedirect(
          _user(roles: const ['DRIVER'], activeRole: 'DRIVER'),
        ),
        driverPortalRoute,
      );
    });
  });

  group('resolveSupplierEntryDestination', () {
    test('learner without supplier role goes to onboarding', () {
      expect(
        resolveSupplierEntryDestination(_user()),
        SupplierEntryDestination.onboarding,
      );
      expect(resolveSupplierEntryDestination(null), SupplierEntryDestination.onboarding);
    });

    test('supplier-capable user in learner mode switches portal', () {
      expect(
        resolveSupplierEntryDestination(
          _user(
            roles: const ['LEARNER', 'SUPPLIER'],
            activeRole: 'LEARNER',
            canSwitchToSupplier: true,
          ),
        ),
        SupplierEntryDestination.switchToSupplierPortal,
      );
    });

    test('supplier-mode user opens supplier overview', () {
      expect(
        resolveSupplierEntryDestination(
          _user(
            roles: const ['LEARNER', 'SUPPLIER'],
            activeRole: 'SUPPLIER',
          ),
        ),
        SupplierEntryDestination.supplierOverview,
      );
    });
  });
}
