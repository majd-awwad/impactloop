import 'dart:async';
import 'dart:ui' show Tristate;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/driver_portal/application/driver_deliveries_provider.dart';
import 'package:frontend/features/driver_portal/application/driver_profile_provider.dart';
import 'package:frontend/features/driver_portal/data/driver_deliveries_api.dart';
import 'package:frontend/features/driver_portal/data/driver_deliveries_repository.dart';
import 'package:frontend/features/driver_portal/data/driver_profile_api.dart';
import 'package:frontend/features/driver_portal/data/driver_profile_repository.dart';
import 'package:frontend/features/driver_portal/data/models/driver_deliveries_list_result.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery.dart';
import 'package:frontend/features/driver_portal/data/models/driver_operational_profile.dart';
import 'package:frontend/features/driver_portal/presentation/pages/driver_dashboard_page.dart';
import 'package:frontend/features/driver_portal/presentation/pages/driver_jobs_page.dart';
import 'package:frontend/features/driver_portal/presentation/pages/driver_profile_page.dart';
import 'package:frontend/features/driver_portal/presentation/shell/driver_portal_shell.dart';
import 'package:frontend/features/driver_portal/presentation/widgets/driver_availability_summary_card.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_notifications_providers.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/shared/widgets/user_avatar.dart';

void main() {
  group('DR-03 models and requests', () {
    test('parses active, inactive, and suspended administrative states', () {
      expect(_profile(status: 'ACTIVE').status, DriverProfileStatus.active);
      expect(_profile(status: 'INACTIVE').status, DriverProfileStatus.inactive);
      expect(
        _profile(status: 'SUSPENDED').status,
        DriverProfileStatus.suspended,
      );
    });

    test('parses AVAILABLE, OFFLINE, and ON_DELIVERY states', () {
      expect(
        _profile(availability: 'AVAILABLE').availability,
        DriverOperationalAvailability.available,
      );
      expect(
        _profile(availability: 'OFFLINE').availability,
        DriverOperationalAvailability.offline,
      );
      expect(
        _profile(availability: 'ON_DELIVERY').availability,
        DriverOperationalAvailability.onDelivery,
      );
    });

    test(
      'unknown and absent future fields do not fabricate contract values',
      () {
        final parsed = DriverOperationalProfile.fromJson(const {
          'status': 'FUTURE_STATUS',
          'availability': 'FUTURE_AVAILABILITY',
          'transportationType': 'SCOOTER',
        });
        expect(parsed.status, DriverProfileStatus.unknown);
        expect(parsed.availability, DriverOperationalAvailability.unknown);
        expect(parsed.transportationType, DriverTransportationType.unknown);
        expect(parsed.acceptingNewJobs, isNull);
        expect(parsed.activeDeliveryCount, isNull);
        expect(parsed.updatedAt, isNull);
        expect(parsed.city, isNull);
      },
    );

    test('nullable vehicle fields remain nullable', () {
      final parsed = _profile(
        vehicleLabel: null,
        vehiclePlate: null,
        capacityNotes: null,
      );
      expect(parsed.vehicleLabel, isNull);
      expect(parsed.vehiclePlate, isNull);
      expect(parsed.capacityNotes, isNull);
    });

    test('profile update serializes only supported normalized fields', () {
      const request = UpdateDriverOperationalProfileRequest(
        city: '  Hebron ',
        area: ' Ein Sara  ',
        transportationType: DriverTransportationType.bicycle,
        vehicleLabel: ' Cargo bike ',
        vehiclePlate: '   ',
        capacityNotes: null,
      );
      expect(request.toJson(), {
        'city': 'Hebron',
        'area': 'Ein Sara',
        'transportationType': 'BICYCLE',
        'vehicleLabel': 'Cargo bike',
        'vehiclePlate': null,
        'capacityNotes': null,
      });
      expect(request.toJson(), isNot(contains('status')));
      expect(request.toJson(), isNot(contains('availability')));
      expect(request.toJson(), isNot(contains('addressLine')));
    });

    test('availability request contains only acceptingNewJobs', () {
      expect(
        const UpdateDriverAvailabilityRequest(acceptingNewJobs: false).toJson(),
        {'acceptingNewJobs': false},
      );
    });

    test(
      'available-jobs metadata parses authoritative availability fields',
      () {
        final meta = DriverDeliveriesListMeta.fromJson(const {
          'activeDeliveryCount': 1,
          'maxActiveDeliveries': 3,
          'canAcceptMore': false,
          'canBrowseAvailableJobs': false,
          'status': 'ACTIVE',
          'availability': 'ON_DELIVERY',
          'acceptingNewJobs': false,
        });
        expect(meta.status, DriverProfileStatus.active);
        expect(meta.availability, DriverOperationalAvailability.onDelivery);
        expect(meta.acceptingNewJobs, isFalse);
        expect(meta.canBrowseAvailableJobs, isFalse);
      },
    );

    test('validation details and Driver preference errors are localized', () {
      const error = ApiException(
        message: 'Backend English',
        code: 'VALIDATION_ERROR',
        details: {
          'issues': [
            {'path': 'city', 'message': 'Too short'},
          ],
        },
      );
      expect(firstFieldError(error, const ['city']), 'Too short');
      final l10n = lookupAppLocalizations(const Locale('ar'));
      expect(localizedApiErrorMessage(error, l10n), l10n.validationError);
      expect(
        localizedApiErrorMessage(
          const ApiException(
            message: 'Backend English',
            code: 'DRIVER_NOT_ACCEPTING_NEW_JOBS',
          ),
          l10n,
        ),
        l10n.driverNotAcceptingNewJobsError,
      );
    });
  });

  group('DR-03 profile provider', () {
    test('loads the operational profile initially', () async {
      final repository = _FakeProfileRepository(initial: _profile());
      final container = _profileContainer(repository);
      addTearDown(container.dispose);

      final state = await container.read(driverProfileProvider.future);
      expect(repository.fetchCalls, 1);
      expect(state.profile.city, 'Nablus');
    });

    test(
      'save success uses the authoritative response and refreshes profile state',
      () async {
        final repository = _FakeProfileRepository(initial: _profile());
        final container = _profileContainer(repository);
        addTearDown(container.dispose);
        await container.read(driverProfileProvider.future);

        final saved = await container
            .read(driverProfileProvider.notifier)
            .saveProfile(_updateRequest(city: 'Hebron'));
        final state = container.read(driverProfileProvider).requireValue;
        expect(saved, isTrue);
        expect(repository.updateCalls, 1);
        expect(state.profile.city, 'Hebron');
        expect(state.saveSucceeded, isTrue);
      },
    );

    test('save failure preserves profile state for the form', () async {
      final repository = _FakeProfileRepository(
        initial: _profile(),
        profileUpdateError: const ApiException(
          message: 'Invalid',
          code: 'VALIDATION_ERROR',
          details: {
            'issues': [
              {'path': 'city', 'message': 'Too short'},
            ],
          },
        ),
      );
      final container = _profileContainer(repository);
      addTearDown(container.dispose);
      await container.read(driverProfileProvider.future);

      final saved = await container
          .read(driverProfileProvider.notifier)
          .saveProfile(_updateRequest(city: 'X'));
      final state = container.read(driverProfileProvider).requireValue;
      expect(saved, isFalse);
      expect(state.profile.city, 'Nablus');
      expect(state.saveError?.fieldIssues.single.path, 'city');
    });

    test(
      'preference success waits for and adopts the Backend response',
      () async {
        final repository = _FakeProfileRepository(initial: _profile());
        final container = _profileContainer(repository);
        addTearDown(container.dispose);
        await container.read(driverProfileProvider.future);

        final operation = container
            .read(driverProfileProvider.notifier)
            .setAcceptingNewJobs(false);
        expect(
          container
              .read(driverProfileProvider)
              .requireValue
              .profile
              .acceptingNewJobs,
          isTrue,
          reason: 'must not optimistically contradict the server',
        );
        expect(await operation, isTrue);
        final profile = container
            .read(driverProfileProvider)
            .requireValue
            .profile;
        expect(profile.acceptingNewJobs, isFalse);
        expect(profile.availability, DriverOperationalAvailability.offline);
      },
    );

    test('preference failure keeps the previous authoritative state', () async {
      final repository = _FakeProfileRepository(
        initial: _profile(),
        availabilityError: const ApiException(
          message: 'Offline',
          code: 'NETWORK_ERROR',
        ),
      );
      final container = _profileContainer(repository);
      addTearDown(container.dispose);
      await container.read(driverProfileProvider.future);

      expect(
        await container
            .read(driverProfileProvider.notifier)
            .setAcceptingNewJobs(false),
        isFalse,
      );
      final state = container.read(driverProfileProvider).requireValue;
      expect(state.profile.acceptingNewJobs, isTrue);
      expect(state.availabilityError?.code, 'NETWORK_ERROR');
    });

    test('duplicate preference requests are prevented while pending', () async {
      final completer = Completer<DriverOperationalProfile>();
      final repository = _FakeProfileRepository(
        initial: _profile(),
        availabilityCompleter: completer,
      );
      final container = _profileContainer(repository);
      addTearDown(container.dispose);
      await container.read(driverProfileProvider.future);

      final first = container
          .read(driverProfileProvider.notifier)
          .setAcceptingNewJobs(false);
      await Future<void>.delayed(Duration.zero);
      final second = await container
          .read(driverProfileProvider.notifier)
          .setAcceptingNewJobs(false);
      expect(second, isFalse);
      expect(repository.availabilityCalls, 1);
      completer.complete(_profile(acceptingNewJobs: false));
      expect(await first, isTrue);
    });

    test('pending save blocks preference mutation', () async {
      final saveCompleter = Completer<DriverOperationalProfile>();
      final repository = _FakeProfileRepository(
        initial: _profile(),
        profileUpdateCompleter: saveCompleter,
      );
      final container = _profileContainer(repository);
      addTearDown(container.dispose);
      await container.read(driverProfileProvider.future);

      final save = container
          .read(driverProfileProvider.notifier)
          .saveProfile(_updateRequest(city: 'Hebron'));
      await Future<void>.delayed(Duration.zero);
      final pending = container.read(driverProfileProvider).requireValue;
      expect(pending.isSaving, isTrue);
      expect(pending.isMutating, isTrue);
      expect(
        await container
            .read(driverProfileProvider.notifier)
            .setAcceptingNewJobs(false),
        isFalse,
      );
      expect(repository.availabilityCalls, 0);

      saveCompleter.complete(_profile(city: 'Hebron'));
      expect(await save, isTrue);
    });

    test('pending preference mutation blocks profile save', () async {
      final availabilityCompleter = Completer<DriverOperationalProfile>();
      final repository = _FakeProfileRepository(
        initial: _profile(),
        availabilityCompleter: availabilityCompleter,
      );
      final container = _profileContainer(repository);
      addTearDown(container.dispose);
      await container.read(driverProfileProvider.future);

      final preference = container
          .read(driverProfileProvider.notifier)
          .setAcceptingNewJobs(false);
      await Future<void>.delayed(Duration.zero);
      final pending = container.read(driverProfileProvider).requireValue;
      expect(pending.isUpdatingAvailability, isTrue);
      expect(pending.isMutating, isTrue);
      expect(
        await container
            .read(driverProfileProvider.notifier)
            .saveProfile(_updateRequest(city: 'Hebron')),
        isFalse,
      );
      expect(repository.updateCalls, 0);

      availabilityCompleter.complete(_profile(acceptingNewJobs: false));
      expect(await preference, isTrue);
    });

    test(
      'stale completion cannot clear a newer mutation pending state',
      () async {
        final oldAvailability = Completer<DriverOperationalProfile>();
        final newSave = Completer<DriverOperationalProfile>();
        final repository = _FakeProfileRepository(
          initial: _profile(),
          availabilityCompleter: oldAvailability,
        );
        final container = _profileContainer(repository);
        addTearDown(container.dispose);
        await container.read(driverProfileProvider.future);

        final oldOperation = container
            .read(driverProfileProvider.notifier)
            .setAcceptingNewJobs(false);
        await Future<void>.delayed(Duration.zero);

        repository.initial = _profile(city: 'Ramallah');
        repository.profileUpdateCompleter = newSave;
        container.invalidate(driverProfileProvider);
        await container.read(driverProfileProvider.future);
        final newOperation = container
            .read(driverProfileProvider.notifier)
            .saveProfile(_updateRequest(city: 'Hebron'));
        await Future<void>.delayed(Duration.zero);
        expect(
          container.read(driverProfileProvider).requireValue.isSaving,
          isTrue,
        );

        oldAvailability.complete(
          _profile(city: 'Old city', acceptingNewJobs: false),
        );
        expect(await oldOperation, isFalse);
        final stillPending = container.read(driverProfileProvider).requireValue;
        expect(stillPending.isSaving, isTrue);
        expect(stillPending.isUpdatingAvailability, isFalse);
        expect(stillPending.profile.city, 'Ramallah');

        newSave.complete(_profile(city: 'Hebron'));
        expect(await newOperation, isTrue);
      },
    );

    test(
      'late response cannot restore an older authoritative profile',
      () async {
        final oldSave = Completer<DriverOperationalProfile>();
        final newAvailability = Completer<DriverOperationalProfile>();
        final repository = _FakeProfileRepository(
          initial: _profile(),
          profileUpdateCompleter: oldSave,
        );
        final container = _profileContainer(repository);
        addTearDown(container.dispose);
        await container.read(driverProfileProvider.future);

        final oldOperation = container
            .read(driverProfileProvider.notifier)
            .saveProfile(_updateRequest(city: 'Old city'));
        await Future<void>.delayed(Duration.zero);

        repository.initial = _profile(city: 'Ramallah');
        repository.profileUpdateCompleter = null;
        repository.availabilityCompleter = newAvailability;
        container.invalidate(driverProfileProvider);
        await container.read(driverProfileProvider.future);
        final newOperation = container
            .read(driverProfileProvider.notifier)
            .setAcceptingNewJobs(false);
        await Future<void>.delayed(Duration.zero);

        oldSave.complete(_profile(city: 'Old city', acceptingNewJobs: true));
        expect(await oldOperation, isFalse);
        final latest = container.read(driverProfileProvider).requireValue;
        expect(latest.isUpdatingAvailability, isTrue);
        expect(latest.profile.city, 'Ramallah');
        expect(latest.profile.acceptingNewJobs, isTrue);

        newAvailability.complete(
          _profile(city: 'Ramallah', acceptingNewJobs: false),
        );
        expect(await newOperation, isTrue);
        final completed = container.read(driverProfileProvider).requireValue;
        expect(completed.profile.city, 'Ramallah');
        expect(completed.profile.acceptingNewJobs, isFalse);
      },
    );

    test(
      'successful preference refreshes Dashboard and Jobs contracts',
      () async {
        final profileRepository = _FakeProfileRepository(initial: _profile());
        final deliveriesRepository = _FakeDeliveriesRepository();
        final container = _profileContainer(
          profileRepository,
          deliveriesRepository: deliveriesRepository,
        );
        addTearDown(container.dispose);
        final subscriptions = [
          container.listen(availableDriverDeliveriesProvider, (_, _) {}),
          container.listen(activeDriverDeliveriesProvider, (_, _) {}),
        ];
        addTearDown(() {
          for (final subscription in subscriptions) {
            subscription.close();
          }
        });
        await Future.wait([
          container.read(driverProfileProvider.future),
          container.read(availableDriverDeliveriesProvider.future),
          container.read(activeDriverDeliveriesProvider.future),
        ]);

        await container
            .read(driverProfileProvider.notifier)
            .setAcceptingNewJobs(false);
        await Future<void>.delayed(const Duration(milliseconds: 10));
        expect(deliveriesRepository.availableCalls, greaterThanOrEqualTo(2));
        expect(deliveriesRepository.activeCalls, greaterThanOrEqualTo(2));
      },
    );

    test(
      'non-active profile cannot submit edits or preference changes',
      () async {
        final repository = _FakeProfileRepository(
          initial: _profile(status: 'SUSPENDED', acceptingNewJobs: false),
        );
        final container = _profileContainer(repository);
        addTearDown(container.dispose);
        await container.read(driverProfileProvider.future);

        expect(
          await container
              .read(driverProfileProvider.notifier)
              .setAcceptingNewJobs(true),
          isFalse,
        );
        expect(
          await container
              .read(driverProfileProvider.notifier)
              .saveProfile(_updateRequest()),
          isFalse,
        );
        expect(repository.availabilityCalls, 0);
        expect(repository.updateCalls, 0);
      },
    );
  });

  group('DR-03 UI and navigation', () {
    testWidgets('Profile shows loading, error, retry, and success states', (
      tester,
    ) async {
      final repository = _FakeProfileRepository(
        initial: _profile(),
        fetchError: const ApiException(
          message: 'Offline',
          code: 'NETWORK_ERROR',
        ),
      );
      await _pumpPage(
        tester,
        const DriverProfilePage(),
        profileRepository: repository,
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.pumpAndSettle();
      expect(find.text('Could not load Driver Profile'), findsOneWidget);

      repository.fetchError = null;
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();
      expect(find.text('Driver Profile'), findsOneWidget);
    });

    testWidgets(
      'Profile validates form and preserves text after server error',
      (tester) async {
        final repository = _FakeProfileRepository(
          initial: _profile(),
          profileUpdateError: const ApiException(
            message: 'Invalid',
            code: 'VALIDATION_ERROR',
            details: {
              'issues': [
                {'path': 'city', 'message': 'Too short'},
              ],
            },
          ),
        );
        await _pumpPage(
          tester,
          const DriverProfilePage(),
          profileRepository: repository,
        );
        await tester.pumpAndSettle();
        await tester.enterText(
          find.byKey(const ValueKey('driver-profile-city')),
          'X',
        );
        await tester.scrollUntilVisible(
          find.byKey(const ValueKey('driver-profile-save')),
          300,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const ValueKey('driver-profile-save')));
        await tester.pumpAndSettle();
        expect(
          find.text('Enter a city between 2 and 100 characters.'),
          findsOneWidget,
        );

        await tester.enterText(
          find.byKey(const ValueKey('driver-profile-city')),
          'Hebron',
        );
        await tester.scrollUntilVisible(
          find.byKey(const ValueKey('driver-profile-save')),
          300,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const ValueKey('driver-profile-save')));
        await tester.pumpAndSettle();
        final field = tester.widget<TextFormField>(
          find.byKey(const ValueKey('driver-profile-city')),
        );
        expect(field.controller?.text, 'Hebron');
        expect(repository.updateCalls, 1);
      },
    );

    testWidgets('Profile exposes read-only states and account settings route', (
      tester,
    ) async {
      final router = GoRouter(
        initialLocation: '/driver/profile',
        routes: [
          GoRoute(
            path: '/driver/profile',
            builder: (_, _) => const Scaffold(body: DriverProfilePage()),
          ),
          GoRoute(
            path: '/profile/account',
            builder: (_, _) =>
                const Scaffold(body: Text('Account destination')),
          ),
        ],
      );
      addTearDown(router.dispose);
      await _pumpRouter(
        tester,
        router,
        profileRepository: _FakeProfileRepository(initial: _profile()),
      );
      await tester.pumpAndSettle();
      expect(find.text('Profile status: Active'), findsOneWidget);
      expect(find.text('Operational state: Available'), findsOneWidget);
      expect(find.text('System-managed operational state'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey('driver-account-settings-link')),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      await tester.tap(
        find.byKey(const ValueKey('driver-account-settings-link')),
      );
      await tester.pumpAndSettle();
      expect(
        router.routeInformationProvider.value.uri.path,
        '/profile/account',
      );
    });

    testWidgets('ON_DELIVERY plus paused preference explains continuation', (
      tester,
    ) async {
      await _pumpPage(
        tester,
        DriverAvailabilitySummaryCard(
          profile: _profile(
            availability: 'ON_DELIVERY',
            acceptingNewJobs: false,
            activeDeliveryCount: 1,
          ),
          isMutating: false,
          isUpdatingAvailability: false,
          onPreferenceChanged: (_) {},
        ),
        profileRepository: _FakeProfileRepository(initial: _profile()),
      );
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Your active deliveries continue. You will not receive new job offers.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('inactive and suspended controls are disabled safely', (
      tester,
    ) async {
      for (final status in ['INACTIVE', 'SUSPENDED']) {
        await _pumpPage(
          tester,
          DriverAvailabilitySummaryCard(
            profile: _profile(status: status, acceptingNewJobs: false),
            isMutating: false,
            isUpdatingAvailability: false,
            onPreferenceChanged: (_) {},
          ),
          profileRepository: _FakeProfileRepository(initial: _profile()),
        );
        await tester.pumpAndSettle();
        final toggle = tester.widget<SwitchListTile>(
          find.byType(SwitchListTile),
        );
        expect(toggle.onChanged, isNull);
      }
    });

    testWidgets('Available Jobs hides stale cards when offers are paused', (
      tester,
    ) async {
      final profileRepository = _FakeProfileRepository(
        initial: _profile(acceptingNewJobs: false),
      );
      final deliveriesRepository = _FakeDeliveriesRepository(
        available: _listResult(
          acceptingNewJobs: false,
          canBrowse: false,
          includeDelivery: true,
        ),
      );
      await _pumpPage(
        tester,
        const DriverJobsPage(),
        profileRepository: profileRepository,
        deliveriesRepository: deliveriesRepository,
      );
      await tester.pumpAndSettle();
      expect(find.text('New job offers are paused'), findsOneWidget);
      expect(
        find.byKey(const ValueKey('driver-resume-new-jobs')),
        findsOneWidget,
      );
      expect(find.text('Stale available job'), findsNothing);

      await tester.tap(find.byKey(const ValueKey('driver-resume-new-jobs')));
      await tester.pumpAndSettle();
      expect(profileRepository.availabilityCalls, 1);
    });

    testWidgets('Available Jobs uses blocker-safe copy and actions', (
      tester,
    ) async {
      final l10n = lookupAppLocalizations(const Locale('en'));
      final states = <(String, String)>[
        ('INACTIVE', l10n.driverProfileInactiveExplanation),
        ('SUSPENDED', l10n.driverProfileSuspendedExplanation),
        ('FUTURE_STATUS', l10n.driverProfileUnknownExplanation),
      ];

      for (final (status, explanation) in states) {
        await _pumpPage(
          tester,
          const DriverJobsPage(),
          profileRepository: _FakeProfileRepository(
            initial: _profile(status: status, acceptingNewJobs: false),
          ),
          deliveriesRepository: _FakeDeliveriesRepository(
            available: _listResult(
              acceptingNewJobs: false,
              canBrowse: false,
              includeDelivery: true,
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.textContaining(explanation), findsOneWidget);
        expect(
          find.textContaining(l10n.driverAssignedDeliveriesContinue),
          findsNothing,
        );
        expect(
          find.byKey(const ValueKey('driver-open-active-deliveries')),
          findsNothing,
        );
        expect(
          find.byKey(const ValueKey('driver-resume-new-jobs')),
          findsNothing,
        );
      }

      await _pumpPage(
        tester,
        const DriverJobsPage(),
        profileRepository: _FakeProfileRepository(
          initial: _profile(acceptingNewJobs: false),
        ),
        deliveriesRepository: _FakeDeliveriesRepository(
          available: _listResult(acceptingNewJobs: false, canBrowse: false),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.textContaining(l10n.driverAssignedDeliveriesContinue),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey('driver-open-active-deliveries')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey('driver-resume-new-jobs')),
        findsOneWidget,
      );
    });

    testWidgets('Toggle and Save controls are mutually disabled', (
      tester,
    ) async {
      final saveCompleter = Completer<DriverOperationalProfile>();
      final availabilityCompleter = Completer<DriverOperationalProfile>();
      final repository = _FakeProfileRepository(
        initial: _profile(),
        profileUpdateCompleter: saveCompleter,
        availabilityCompleter: availabilityCompleter,
      );
      await _pumpPage(
        tester,
        const DriverProfilePage(),
        profileRepository: repository,
      );
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const ValueKey('driver-profile-city')),
        'Hebron',
      );
      await tester.pump();
      final container = ProviderScope.containerOf(
        tester.element(find.byType(DriverProfilePage)),
      );

      final save = container
          .read(driverProfileProvider.notifier)
          .saveProfile(_updateRequest(city: 'Hebron'));
      await tester.pump();
      expect(
        tester.widget<SwitchListTile>(find.byType(SwitchListTile)).onChanged,
        isNull,
      );
      expect(
        tester
            .widget<TextFormField>(
              find.byKey(const ValueKey('driver-profile-city')),
            )
            .enabled,
        isFalse,
      );
      saveCompleter.complete(_profile(city: 'Hebron'));
      expect(await save, isTrue);
      await tester.pump();

      final preference = container
          .read(driverProfileProvider.notifier)
          .setAcceptingNewJobs(false);
      await tester.pump();
      expect(
        tester
            .widget<TextFormField>(
              find.byKey(const ValueKey('driver-profile-city')),
            )
            .enabled,
        isFalse,
      );
      expect(
        tester
            .widget<FilledButton>(
              find.byKey(const ValueKey('driver-profile-save')),
            )
            .onPressed,
        isNull,
      );
      expect(
        tester.widget<SwitchListTile>(find.byType(SwitchListTile)).onChanged,
        isNull,
      );
      availabilityCompleter.complete(
        _profile(city: 'Hebron', acceptingNewJobs: false),
      );
      expect(await preference, isTrue);
    });

    testWidgets(
      'non-active profile form is natively disabled and stays clean',
      (tester) async {
        final semanticsHandle = tester.ensureSemantics();
        try {
          for (final status in ['INACTIVE', 'SUSPENDED']) {
            final repository = _FakeProfileRepository(
              initial: _profile(status: status, acceptingNewJobs: false),
            );
            await _pumpPage(
              tester,
              const DriverProfilePage(),
              profileRepository: repository,
            );
            await tester.pumpAndSettle();

            final fields = find.byType(TextFormField);
            expect(fields, findsNWidgets(5));
            for (final field in tester.widgetList<TextFormField>(fields)) {
              expect(field.enabled, isFalse);
            }
            expect(
              tester
                  .widget<DropdownButtonFormField<DriverTransportationType>>(
                    find.byKey(const ValueKey('driver-profile-transportation')),
                  )
                  .onChanged,
              isNull,
            );
            expect(
              tester
                  .widget<FilledButton>(
                    find.byKey(const ValueKey('driver-profile-save')),
                  )
                  .onPressed,
              isNull,
            );

            final cityFinder = find.byKey(
              const ValueKey('driver-profile-city'),
            );
            final editableFinder = find.descendant(
              of: cityFinder,
              matching: find.byType(EditableText),
            );
            final initialText = tester
                .widget<EditableText>(editableFinder)
                .controller
                .text;
            await tester.tap(cityFinder);
            await tester.sendKeyEvent(LogicalKeyboardKey.keyX);
            await tester.sendKeyEvent(LogicalKeyboardKey.tab);
            await tester.pump();
            final editable = tester.widget<EditableText>(editableFinder);
            expect(editable.controller.text, initialText);
            expect(editable.focusNode.hasFocus, isFalse);
            final semantics = tester.getSemantics(editableFinder);
            expect(semantics.flagsCollection.isEnabled, Tristate.isFalse);

            await tester.binding.handlePopRoute();
            await tester.pump();
            expect(find.byType(AlertDialog), findsNothing);
            expect(repository.updateCalls, 0);
            expect(repository.availabilityCalls, 0);
          }
        } finally {
          semanticsHandle.dispose();
        }
      },
    );

    testWidgets('Dashboard shows compact availability integration', (
      tester,
    ) async {
      await _pumpPage(
        tester,
        const DriverDashboardPage(),
        profileRepository: _FakeProfileRepository(
          initial: _profile(
            availability: 'ON_DELIVERY',
            activeDeliveryCount: 1,
          ),
        ),
        deliveriesRepository: _FakeDeliveriesRepository(),
      );
      await tester.pumpAndSettle();
      expect(find.text('Availability and status'), findsOneWidget);
      expect(find.text('Operational state: On delivery'), findsOneWidget);
      expect(
        find.byKey(const ValueKey('driver-accepting-new-jobs-switch')),
        findsOneWidget,
      );
    });

    testWidgets('mobile Profile keeps four unselected navigation actions', (
      tester,
    ) async {
      final router = GoRouter(
        initialLocation: '/driver/profile',
        routes: [
          GoRoute(
            path: '/driver/profile',
            builder: (_, _) => const DriverPortalShell(child: Text('Profile')),
          ),
          GoRoute(path: '/driver', builder: (_, _) => const SizedBox()),
          GoRoute(path: '/driver/jobs', builder: (_, _) => const SizedBox()),
          GoRoute(path: '/driver/active', builder: (_, _) => const SizedBox()),
          GoRoute(
            path: '/driver/notifications',
            builder: (_, _) => const SizedBox(),
          ),
        ],
      );
      addTearDown(router.dispose);
      await _pumpRouter(
        tester,
        router,
        size: const Size(320, 900),
        scale: 1.6,
        profileRepository: _FakeProfileRepository(initial: _profile()),
        includeAuth: true,
      );
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('driver-unselected-bottom-nav')),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('driver-mobile-nav-0')), findsOneWidget);
      expect(find.byKey(const ValueKey('driver-mobile-nav-3')), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('desktop sidebar and account menu expose Driver Profile', (
      tester,
    ) async {
      final router = GoRouter(
        initialLocation: '/driver',
        routes: [
          GoRoute(
            path: '/driver',
            builder: (_, _) => const DriverPortalShell(child: Text('Home')),
          ),
          GoRoute(
            path: '/driver/profile',
            builder: (_, _) => const Text('Driver Profile destination'),
          ),
          GoRoute(path: '/profile', builder: (_, _) => const SizedBox()),
          GoRoute(
            path: '/profile/account',
            builder: (_, _) => const SizedBox(),
          ),
        ],
      );
      addTearDown(router.dispose);
      await _pumpRouter(
        tester,
        router,
        size: const Size(1100, 850),
        profileRepository: _FakeProfileRepository(initial: _profile()),
        includeAuth: true,
      );
      await tester.pumpAndSettle();
      expect(find.text('Driver Profile'), findsOneWidget);
      await tester.tap(find.byType(UserAvatar).first);
      await tester.pumpAndSettle();
      expect(find.text('Driver Profile'), findsNWidgets(2));
    });

    testWidgets('Arabic RTL 320px and technical plate stay overflow-safe', (
      tester,
    ) async {
      await _pumpPage(
        tester,
        const DriverProfilePage(),
        locale: const Locale('ar'),
        size: const Size(320, 1000),
        scale: 1.6,
        profileRepository: _FakeProfileRepository(
          initial: _profile(vehiclePlate: 'ABC-1234'),
        ),
      );
      await tester.pumpAndSettle();
      final plate = tester.widget<EditableText>(
        find.descendant(
          of: find.byKey(const ValueKey('driver-profile-vehicle-plate')),
          matching: find.byType(EditableText),
        ),
      );
      expect(plate.textDirection, TextDirection.ltr);
      expect(find.text('الملف التشغيلي للسائق'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('wide English layout supports text scale and semantics', (
      tester,
    ) async {
      await _pumpPage(
        tester,
        const DriverProfilePage(),
        size: const Size(1440, 1000),
        scale: 1.3,
        profileRepository: _FakeProfileRepository(initial: _profile()),
      );
      await tester.pumpAndSettle();
      expect(find.bySemanticsLabel(RegExp('Accepting new jobs')), findsWidgets);
      expect(find.bySemanticsLabel(RegExp('Save profile')), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}

DriverOperationalProfile _profile({
  String status = 'ACTIVE',
  String availability = 'AVAILABLE',
  bool acceptingNewJobs = true,
  int activeDeliveryCount = 0,
  String city = 'Nablus',
  String area = 'Rafidia',
  String? vehicleLabel = 'White hatchback',
  String? vehiclePlate = 'ABC-1234',
  String? capacityNotes = 'Small and medium boxes',
}) {
  return DriverOperationalProfile.fromJson({
    'status': status,
    'availability': availability,
    'acceptingNewJobs': acceptingNewJobs,
    'activeDeliveryCount': activeDeliveryCount,
    'maxActiveDeliveries': 3,
    'canAcceptMore': acceptingNewJobs && activeDeliveryCount < 3,
    'city': city,
    'area': area,
    'transportationType': 'CAR',
    'vehicleLabel': vehicleLabel,
    'vehiclePlate': vehiclePlate,
    'capacityNotes': capacityNotes,
    'updatedAt': '2026-08-02T08:00:00.000Z',
  });
}

UpdateDriverOperationalProfileRequest _updateRequest({String city = 'Nablus'}) {
  return UpdateDriverOperationalProfileRequest(
    city: city,
    area: 'Rafidia',
    transportationType: DriverTransportationType.car,
    vehicleLabel: 'White hatchback',
    vehiclePlate: 'ABC-1234',
    capacityNotes: 'Small and medium boxes',
  );
}

class _FakeProfileRepository extends DriverProfileRepository {
  _FakeProfileRepository({
    required this.initial,
    this.fetchError,
    this.profileUpdateError,
    this.availabilityError,
    this.profileUpdateCompleter,
    this.availabilityCompleter,
  }) : super(DriverProfileApi(Dio()));

  DriverOperationalProfile initial;
  Object? fetchError;
  Object? profileUpdateError;
  Object? availabilityError;
  Completer<DriverOperationalProfile>? profileUpdateCompleter;
  Completer<DriverOperationalProfile>? availabilityCompleter;
  int fetchCalls = 0;
  int updateCalls = 0;
  int availabilityCalls = 0;

  @override
  Future<DriverOperationalProfile> fetchProfile() async {
    fetchCalls += 1;
    if (fetchError case final error?) throw error;
    return initial;
  }

  @override
  Future<DriverOperationalProfile> updateProfile(
    UpdateDriverOperationalProfileRequest request,
  ) async {
    updateCalls += 1;
    if (profileUpdateError case final error?) throw error;
    if (profileUpdateCompleter case final completer?) {
      return completer.future;
    }
    final json = _profileJson(initial);
    json['city'] = request.city.trim();
    json['area'] = request.area.trim();
    json['transportationType'] = driverTransportationTypeApiValue(
      request.transportationType,
    );
    json['vehicleLabel'] = request.vehicleLabel?.trim();
    json['vehiclePlate'] = request.vehiclePlate?.trim();
    json['capacityNotes'] = request.capacityNotes?.trim();
    json['updatedAt'] = '2026-08-02T09:00:00.000Z';
    initial = DriverOperationalProfile.fromJson(json);
    return initial;
  }

  @override
  Future<DriverOperationalProfile> updateAvailability(
    bool acceptingNewJobs,
  ) async {
    availabilityCalls += 1;
    if (availabilityError case final error?) throw error;
    if (availabilityCompleter case final completer?) {
      return completer.future;
    }
    final json = _profileJson(initial);
    json['acceptingNewJobs'] = acceptingNewJobs;
    json['availability'] = initial.activeDeliveryCount! > 0
        ? 'ON_DELIVERY'
        : acceptingNewJobs
        ? 'AVAILABLE'
        : 'OFFLINE';
    initial = DriverOperationalProfile.fromJson(json);
    return initial;
  }
}

Map<String, dynamic> _profileJson(DriverOperationalProfile profile) => {
  'status': profile.rawStatus,
  'availability': profile.rawAvailability,
  'acceptingNewJobs': profile.acceptingNewJobs,
  'activeDeliveryCount': profile.activeDeliveryCount,
  'maxActiveDeliveries': profile.maxActiveDeliveries,
  'canAcceptMore': profile.canAcceptMore,
  'city': profile.city,
  'area': profile.area,
  'transportationType': profile.rawTransportationType,
  'vehicleLabel': profile.vehicleLabel,
  'vehiclePlate': profile.vehiclePlate,
  'capacityNotes': profile.capacityNotes,
  'updatedAt': profile.updatedAt?.toIso8601String(),
};

class _FakeDeliveriesRepository extends DriverDeliveriesRepository {
  _FakeDeliveriesRepository({DriverDeliveriesListResult? available})
    : available = available ?? _listResult(),
      super(DriverDeliveriesApi(Dio()));

  DriverDeliveriesListResult available;
  int availableCalls = 0;
  int activeCalls = 0;

  @override
  Future<DriverDeliveriesListResult> fetchAvailableDeliveries({
    DriverAvailableJobsFilter? filter,
    String? cursor,
    int limit = 20,
  }) async {
    availableCalls += 1;
    return available;
  }

  @override
  Future<DriverDeliveriesListResult> fetchActiveDeliveries() async {
    activeCalls += 1;
    return _listResult();
  }
}

DriverDeliveriesListResult _listResult({
  bool acceptingNewJobs = true,
  bool canBrowse = true,
  bool includeDelivery = false,
}) {
  return DriverDeliveriesListResult(
    deliveries: includeDelivery
        ? [
            DriverDelivery.fromJson({
              'id': 'delivery-stale',
              'reservationId': 'reservation-stale',
              'status': 'WAITING_FOR_DRIVER',
              'requestedAt': '2026-08-02T08:00:00.000Z',
              'material': {
                'id': 'material-stale',
                'title': 'Stale available job',
                'quantityRequested': 1,
                'unit': 'piece',
              },
              'supplier': {'displayName': 'Supplier'},
              'pickupLocation': {'city': 'Nablus'},
              'dropoffLocation': {'city': 'Hebron'},
            }),
          ]
        : const [],
    meta: DriverDeliveriesListMeta(
      activeDeliveryCount: 0,
      maxActiveDeliveries: 3,
      canAcceptMore: acceptingNewJobs,
      canBrowseAvailableJobs: canBrowse,
      status: DriverProfileStatus.active,
      availability: acceptingNewJobs
          ? DriverOperationalAvailability.available
          : DriverOperationalAvailability.offline,
      acceptingNewJobs: acceptingNewJobs,
      nearbyAvailableCount: includeDelivery ? 1 : 0,
      totalAvailableCount: includeDelivery ? 1 : 0,
    ),
  );
}

ProviderContainer _profileContainer(
  _FakeProfileRepository profileRepository, {
  _FakeDeliveriesRepository? deliveriesRepository,
}) {
  return ProviderContainer(
    overrides: [
      driverProfileRepositoryProvider.overrideWithValue(profileRepository),
      if (deliveriesRepository != null)
        driverDeliveriesRepositoryProvider.overrideWithValue(
          deliveriesRepository,
        ),
    ],
  );
}

Future<void> _pumpPage(
  WidgetTester tester,
  Widget page, {
  required _FakeProfileRepository profileRepository,
  _FakeDeliveriesRepository? deliveriesRepository,
  Locale locale = const Locale('en'),
  Size size = const Size(800, 1000),
  double scale = 1,
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    ProviderScope(
      key: UniqueKey(),
      overrides: [
        driverProfileRepositoryProvider.overrideWithValue(profileRepository),
        if (deliveriesRepository != null)
          driverDeliveriesRepositoryProvider.overrideWithValue(
            deliveriesRepository,
          ),
      ],
      child: MaterialApp(
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: Scaffold(body: page),
      ),
    ),
  );
}

Future<void> _pumpRouter(
  WidgetTester tester,
  GoRouter router, {
  required _FakeProfileRepository profileRepository,
  Size size = const Size(800, 1000),
  double scale = 1,
  bool includeAuth = false,
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        driverProfileRepositoryProvider.overrideWithValue(profileRepository),
        if (includeAuth) ...[
          authControllerProvider.overrideWith(_TestAuthController.new),
          myNotificationUnreadCountProvider.overrideWith(
            _ZeroUnreadCountNotifier.new,
          ),
          supplierNotificationsUnreadCountProvider.overrideWith(
            _ZeroSupplierUnreadCountNotifier.new,
          ),
        ],
      ],
      child: MaterialApp.router(
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        routerConfig: router,
      ),
    ),
  );
}

class _TestAuthController extends AuthController {
  @override
  AuthState build() => AuthState(
    user: User(
      id: 'driver-1',
      displayName: 'Driver User',
      email: 'driver@example.com',
      accountStatus: 'ACTIVE',
      roles: const ['DRIVER'],
      activeRole: 'DRIVER',
      createdAt: DateTime(2026),
    ),
    accessToken: 'test-token',
    hasBootstrapped: true,
  );
}

class _ZeroUnreadCountNotifier extends NotificationUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}

class _ZeroSupplierUnreadCountNotifier
    extends SupplierNotificationsUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}
