import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/locations/application/saved_locations_providers.dart';
import 'package:frontend/features/locations/data/forward_geocode_result.dart';
import 'package:frontend/features/locations/data/reverse_geocode_result.dart';
import 'package:frontend/features/locations/data/saved_location.dart';
import 'package:frontend/features/locations/data/saved_locations_api.dart';
import 'package:frontend/features/locations/presentation/pages/saved_locations_page.dart';
import 'package:frontend/shared/location/current_location_service.dart';

void main() {
  Future<void> pumpPage(
    WidgetTester tester, {
    required List<Object> overrides,
    Size size = const Size(390, 820),
    Locale locale = const Locale('en'),
    ThemeMode themeMode = ThemeMode.light,
    double textScale = 1.0,
  }) async {
    await tester.binding.setSurfaceSize(size);
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: overrides.cast(),
        child: MediaQuery(
          data: MediaQueryData(
            size: size,
            textScaler: TextScaler.linear(textScale),
          ),
          child: MaterialApp(
            locale: locale,
            themeMode: themeMode,
            darkTheme: ThemeData.dark(useMaterial3: true),
            supportedLocales: const [Locale('en'), Locale('ar')],
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            home: const SavedLocationsPage(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> tapUseCurrentLocation(WidgetTester tester) async {
    final button = find.widgetWithText(OutlinedButton, 'Use my current location');
    await tester.ensureVisible(button.last);
    await tester.pump();
    await tester.tap(button.last);
    // Avoid pumpAndSettle while the button shows an indeterminate spinner.
    for (var i = 0; i < 40; i++) {
      await tester.pump(const Duration(milliseconds: 50));
      if (find.text('Create location').evaluate().isNotEmpty ||
          find.textContaining('permission').evaluate().isNotEmpty ||
          find.textContaining('turned off').evaluate().isNotEmpty ||
          find.textContaining('timed out').evaluate().isNotEmpty ||
          find.textContaining('permanently denied').evaluate().isNotEmpty ||
          find.textContaining('address lookup failed').evaluate().isNotEmpty) {
        break;
      }
    }
  }

  testWidgets('saved locations page renders empty state', (tester) async {
    await pumpPage(
      tester,
      size: const Size(390, 1100),
      overrides: [
        savedLocationsProvider.overrideWith((ref) async => const []),
        currentLocationServiceProvider.overrideWithValue(
          _FakeCurrentLocationService(),
        ),
      ],
    );

    expect(find.text('Saved locations'), findsOneWidget);
    expect(find.text('No saved locations yet'), findsOneWidget);
    expect(find.text('Add location'), findsOneWidget);
    expect(find.text('Use my current location'), findsWidgets);
    expect(find.textContaining('Addresses and coordinates'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Arabic empty state and actions are localized at 320px', (
    tester,
  ) async {
    await pumpPage(
      tester,
      size: const Size(320, 800),
      locale: const Locale('ar'),
      overrides: [
        savedLocationsProvider.overrideWith((ref) async => const []),
        currentLocationServiceProvider.overrideWithValue(
          _FakeCurrentLocationService(),
        ),
      ],
    );

    expect(find.text('المواقع المحفوظة'), findsOneWidget);
    expect(find.text('لا توجد مواقع محفوظة بعد'), findsOneWidget);
    expect(find.text('إضافة موقع'), findsOneWidget);
    expect(find.text('استخدام موقعي الحالي'), findsWidgets);
    expect(find.textContaining('خصوصية موقعك'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('المواقع المحفوظة'))),
      TextDirection.rtl,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('populated state shows cards, coords, and current-location CTA', (
    tester,
  ) async {
    await pumpPage(
      tester,
      size: const Size(900, 900),
      overrides: [
        savedLocationsProvider.overrideWith(
          (ref) async => const [
            SavedLocation(
              id: 'saved-1',
              label: 'Home',
              city: 'Nablus',
              area: 'Rafidia',
              addressLine: 'Building 10',
              latitude: 32.221122,
              longitude: 35.254455,
              isDefault: true,
            ),
            SavedLocation(
              id: 'saved-2',
              label: 'Work',
              city: 'Ramallah',
              area: 'Al Tireh',
              latitude: 31.9,
              longitude: 35.2,
            ),
          ],
        ),
        currentLocationServiceProvider.overrideWithValue(
          _FakeCurrentLocationService(),
        ),
      ],
    );

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Work'), findsOneWidget);
    expect(find.text('Default'), findsOneWidget);
    expect(find.text('Building 10'), findsOneWidget);
    expect(find.text('32.221122, 35.254455'), findsOneWidget);
    expect(find.text('My saved locations'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    expect(find.text('Use my current location'), findsWidgets);
    expect(find.text('Why save locations?'), findsOneWidget);
    expect(find.text('Private exact details'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('wide web shows side panel; mobile hides it', (tester) async {
    final overrides = [
      savedLocationsProvider.overrideWith(
        (ref) async => const [
          SavedLocation(id: '1', label: 'Home', city: 'Nablus', isDefault: true),
        ],
      ),
      currentLocationServiceProvider.overrideWithValue(
        _FakeCurrentLocationService(),
      ),
    ];

    await pumpPage(
      tester,
      size: const Size(1440, 900),
      overrides: overrides,
    );
    expect(find.text('Why save locations?'), findsOneWidget);
    expect(find.text('Faster access'), findsOneWidget);

    await pumpPage(
      tester,
      size: const Size(360, 800),
      overrides: overrides,
    );
    expect(find.text('Why save locations?'), findsNothing);
  });

  testWidgets('loading and error with retry', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final completer = Completer<List<SavedLocation>>();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          savedLocationsProvider.overrideWith((ref) => completer.future),
          currentLocationServiceProvider.overrideWithValue(
            _FakeCurrentLocationService(),
          ),
        ],
        child: const MaterialApp(home: SavedLocationsPage()),
      ),
    );
    await tester.pump();

    expect(find.text('Loading saved locations...'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsWidgets);

    completer.completeError(Exception('network'));
    await tester.pumpAndSettle();

    expect(find.text('Something went wrong. Please try again.'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('dark mode and long labels at 320px', (tester) async {
    await pumpPage(
      tester,
      size: const Size(320, 800),
      themeMode: ThemeMode.dark,
      overrides: [
        savedLocationsProvider.overrideWith(
          (ref) async => const [
            SavedLocation(
              id: '1',
              label: 'Very long saved location label for workshop campus gate',
              city: 'Hebron',
              area: 'University District with a long area name',
              addressLine:
                  'University District learner dropoff area near building twelve',
              latitude: 31.5326,
              longitude: 35.0998,
              isDefault: true,
            ),
          ],
        ),
        currentLocationServiceProvider.overrideWithValue(
          _FakeCurrentLocationService(),
        ),
      ],
    );

    expect(
      find.textContaining('Very long saved location label'),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.more_vert_rounded), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('edit opens dialog; cancel does not submit update', (
    tester,
  ) async {
    final api = _RecordingSavedLocationsApi();

    await pumpPage(
      tester,
      size: const Size(1440, 900),
      overrides: [
        savedLocationsApiProvider.overrideWithValue(api),
        savedLocationsProvider.overrideWith(
          (ref) async => const [
            SavedLocation(id: 'saved-1', label: 'Home', city: 'Nablus'),
          ],
        ),
        currentLocationServiceProvider.overrideWithValue(
          _FakeCurrentLocationService(),
        ),
      ],
    );

    await tester.tap(find.byTooltip('Edit location'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'Updated');
    await tester.tap(find.byTooltip('Close'));
    await tester.pumpAndSettle();

    expect(api.updatedPayload, isNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mobile overflow exposes set default and delete confirm', (
    tester,
  ) async {
    final api = _RecordingSavedLocationsApi();

    await pumpPage(
      tester,
      size: const Size(390, 844),
      overrides: [
        savedLocationsApiProvider.overrideWithValue(api),
        savedLocationsProvider.overrideWith(
          (ref) async => const [
            SavedLocation(
              id: 'saved-1',
              label: 'Home',
              city: 'Nablus',
              isDefault: true,
            ),
            SavedLocation(id: 'saved-2', label: 'Work', city: 'Ramallah'),
          ],
        ),
        currentLocationServiceProvider.overrideWithValue(
          _FakeCurrentLocationService(),
        ),
      ],
    );

    await tester.tap(find.byIcon(Icons.more_vert_rounded).last);
    await tester.pumpAndSettle();
    expect(find.text('Set as default'), findsOneWidget);
    expect(find.text('Delete location'), findsOneWidget);

    await tester.tap(find.text('Delete location'));
    await tester.pumpAndSettle();
    expect(find.text('Delete saved location?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(api.deletedId, isNull);
  });

  testWidgets('create dialog validates required fields and submits payload', (
    tester,
  ) async {
    final api = _RecordingSavedLocationsApi();

    await pumpPage(
      tester,
      size: const Size(420, 900),
      overrides: [
        savedLocationsApiProvider.overrideWithValue(api),
        savedLocationsProvider.overrideWith((ref) async => const []),
        currentLocationServiceProvider.overrideWithValue(
          _FakeCurrentLocationService(),
        ),
      ],
    );

    await tester.tap(find.text('Add location').first);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Create location'));
    await tester.pump();

    expect(find.text('Label is required'), findsOneWidget);
    expect(find.text('City is required'), findsOneWidget);

    await tester.enterText(find.byType(TextFormField).at(0), 'Campus');
    await tester.enterText(find.byType(TextFormField).at(1), 'Nablus');
    await tester.enterText(find.byType(TextFormField).at(2), 'New Campus');
    await tester.enterText(find.byType(TextFormField).at(3), 'Gate 2');
    await tester.enterText(find.byType(TextFormField).at(5), '32.2');
    await tester.enterText(find.byType(TextFormField).at(6), '35.2');
    await tester.tap(find.text('Create location'));
    await tester.pumpAndSettle();

    expect(api.createdPayload?.label, 'Campus');
    expect(api.createdPayload?.city, 'Nablus');
    expect(api.createdPayload?.area, 'New Campus');
    expect(api.createdPayload?.addressLine, 'Gate 2');
    expect(api.createdPayload?.latitude, 32.2);
    expect(api.createdPayload?.longitude, 35.2);
    expect(find.text('Saved location created.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('create dialog can find coordinates from typed address', (
    tester,
  ) async {
    final api = _RecordingSavedLocationsApi();

    await pumpPage(
      tester,
      size: const Size(420, 900),
      overrides: [
        savedLocationsApiProvider.overrideWithValue(api),
        savedLocationsProvider.overrideWith((ref) async => const []),
        currentLocationServiceProvider.overrideWithValue(
          _FakeCurrentLocationService(),
        ),
      ],
    );

    await tester.tap(find.text('Add location').first);
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), 'Home');
    await tester.enterText(find.byType(TextFormField).at(1), 'Nablus');
    await tester.enterText(find.byType(TextFormField).at(2), 'Awarta');
    await tester.enterText(find.byType(TextFormField).at(3), 'Main Street');

    final findAddressButton = find.widgetWithText(
      OutlinedButton,
      'Find typed address',
    );
    await tester.ensureVisible(findAddressButton);
    await tester.pumpAndSettle();
    tester.widget<OutlinedButton>(findAddressButton).onPressed!();
    await tester.pumpAndSettle();

    expect(api.forwardGeocodeCity, 'Nablus');
    expect(api.forwardGeocodeArea, 'Awarta');
    expect(api.forwardGeocodeAddressLine, 'Main Street');
    expect(find.widgetWithText(TextFormField, '32.160000'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, '35.280000'), findsOneWidget);

    await tester.tap(find.text('Create location'));
    await tester.pumpAndSettle();

    expect(api.createdPayload?.latitude, 32.16);
    expect(api.createdPayload?.longitude, 35.28);
    expect(tester.takeException(), isNull);
  });

  testWidgets('current location granted prefills add dialog with reverse data', (
    tester,
  ) async {
    final api = _RecordingSavedLocationsApi();
    final locationService = _FakeCurrentLocationService(
      capture: const CurrentLocationCapture(
        latitude: 31.5326,
        longitude: 35.0998,
      ),
    );

    await pumpPage(
      tester,
      size: const Size(390, 1100),
      overrides: [
        savedLocationsApiProvider.overrideWithValue(api),
        savedLocationsProvider.overrideWith((ref) async => const []),
        currentLocationServiceProvider.overrideWithValue(locationService),
      ],
    );

    await tapUseCurrentLocation(tester);

    expect(locationService.captureCalls, 1);
    expect(api.reverseLatitude, 31.5326);
    expect(api.reverseLongitude, 35.0998);
    expect(find.text('Create location'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, '31.532600'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, '35.099800'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Hebron'), findsOneWidget);
    expect(api.createdPayload, isNull);
  });

  testWidgets('current location reverse failure still prefills coordinates', (
    tester,
  ) async {
    final api = _RecordingSavedLocationsApi()..failReverse = true;
    final locationService = _FakeCurrentLocationService(
      capture: const CurrentLocationCapture(
        latitude: 32.1,
        longitude: 35.2,
      ),
    );

    await pumpPage(
      tester,
      size: const Size(390, 1100),
      overrides: [
        savedLocationsApiProvider.overrideWithValue(api),
        savedLocationsProvider.overrideWith((ref) async => const []),
        currentLocationServiceProvider.overrideWithValue(locationService),
      ],
    );

    await tapUseCurrentLocation(tester);

    expect(find.textContaining('address lookup failed'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, '32.100000'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, '35.200000'), findsOneWidget);
    expect(api.createdPayload, isNull);
  });

  testWidgets('current location permission denied shows localized error', (
    tester,
  ) async {
    await pumpPage(
      tester,
      size: const Size(390, 1100),
      overrides: [
        savedLocationsProvider.overrideWith((ref) async => const []),
        currentLocationServiceProvider.overrideWithValue(
          _FakeCurrentLocationService(
            failure: CurrentLocationFailure.permissionDenied,
          ),
        ),
      ],
    );

    await tapUseCurrentLocation(tester);

    expect(find.textContaining('permission was denied'), findsOneWidget);
    expect(find.text('Create location'), findsNothing);
  });

  testWidgets('current location permanently denied shows localized error', (
    tester,
  ) async {
    await pumpPage(
      tester,
      size: const Size(390, 1100),
      overrides: [
        savedLocationsProvider.overrideWith((ref) async => const []),
        currentLocationServiceProvider.overrideWithValue(
          _FakeCurrentLocationService(
            failure: CurrentLocationFailure.permissionDeniedForever,
          ),
        ),
      ],
    );

    await tapUseCurrentLocation(tester);

    expect(find.textContaining('permanently denied'), findsOneWidget);
  });

  testWidgets('current location service disabled shows localized error', (
    tester,
  ) async {
    await pumpPage(
      tester,
      size: const Size(390, 1100),
      overrides: [
        savedLocationsProvider.overrideWith((ref) async => const []),
        currentLocationServiceProvider.overrideWithValue(
          _FakeCurrentLocationService(
            failure: CurrentLocationFailure.serviceDisabled,
          ),
        ),
      ],
    );

    await tapUseCurrentLocation(tester);

    expect(find.textContaining('turned off'), findsOneWidget);
  });

  testWidgets('current location timeout shows localized error', (tester) async {
    await pumpPage(
      tester,
      size: const Size(390, 1100),
      overrides: [
        savedLocationsProvider.overrideWith((ref) async => const []),
        currentLocationServiceProvider.overrideWithValue(
          _FakeCurrentLocationService(failure: CurrentLocationFailure.timeout),
        ),
      ],
    );

    await tapUseCurrentLocation(tester);

    expect(find.textContaining('timed out'), findsOneWidget);
  });

  testWidgets('duplicate current-location taps do not start concurrent requests', (
    tester,
  ) async {
    final locationService = _FakeCurrentLocationService(
      capture: const CurrentLocationCapture(latitude: 1, longitude: 2),
      delay: const Duration(milliseconds: 400),
    );
    final api = _RecordingSavedLocationsApi();

    await pumpPage(
      tester,
      size: const Size(390, 1100),
      overrides: [
        savedLocationsApiProvider.overrideWithValue(api),
        savedLocationsProvider.overrideWith((ref) async => const []),
        currentLocationServiceProvider.overrideWithValue(locationService),
      ],
    );

    final button = find.widgetWithText(
      OutlinedButton,
      'Use my current location',
    );
    await tester.ensureVisible(button.last);
    await tester.pump();
    await tester.tap(button.last);
    await tester.pump();
    expect(locationService.captureCalls, 1);

    final busy = find.widgetWithText(
      OutlinedButton,
      'Getting your current location...',
    );
    expect(busy, findsOneWidget);
    await tester.tap(busy);
    await tester.pump(const Duration(milliseconds: 50));
    expect(locationService.captureCalls, 1);
    await tester.pump(const Duration(milliseconds: 500));
  });
}

class _FakeCurrentLocationService extends CurrentLocationService {
  _FakeCurrentLocationService({
    this.capture,
    this.failure,
    this.delay = Duration.zero,
  });

  final CurrentLocationCapture? capture;
  final CurrentLocationFailure? failure;
  final Duration delay;
  int captureCalls = 0;

  @override
  Future<CurrentLocationCapture> captureCurrentLocation() async {
    captureCalls += 1;
    if (delay > Duration.zero) {
      await Future<void>.delayed(delay);
    }
    if (failure != null) {
      throw CurrentLocationException(failure!);
    }
    return capture ??
        const CurrentLocationCapture(latitude: 31.5, longitude: 35.1);
  }
}

class _RecordingSavedLocationsApi extends SavedLocationsApi {
  _RecordingSavedLocationsApi() : super(Dio());

  SavedLocationPayload? createdPayload;
  SavedLocationPayload? updatedPayload;
  String? deletedId;
  String? forwardGeocodeCity;
  String? forwardGeocodeArea;
  String? forwardGeocodeAddressLine;
  double? reverseLatitude;
  double? reverseLongitude;
  bool failReverse = false;

  @override
  Future<SavedLocation> createSavedLocation(
    SavedLocationPayload payload,
  ) async {
    createdPayload = payload;
    return SavedLocation(
      id: 'created-1',
      label: payload.label,
      country: payload.country,
      city: payload.city,
      area: payload.area,
      addressLine: payload.addressLine,
      latitude: payload.latitude,
      longitude: payload.longitude,
      isDefault: payload.isDefault,
    );
  }

  @override
  Future<SavedLocation> updateSavedLocation(
    String id,
    SavedLocationPayload payload,
  ) async {
    updatedPayload = payload;
    return SavedLocation(id: id, label: payload.label, city: payload.city);
  }

  @override
  Future<void> deleteSavedLocation(String id) async {
    deletedId = id;
  }

  @override
  Future<SavedLocation> setDefaultSavedLocation(String id) async {
    return SavedLocation(id: id, label: 'Default', city: 'Nablus', isDefault: true);
  }

  @override
  Future<ForwardGeocodeResult> forwardGeocode({
    String country = 'Palestine',
    required String city,
    String? area,
    String? addressLine,
  }) async {
    forwardGeocodeCity = city;
    forwardGeocodeArea = area;
    forwardGeocodeAddressLine = addressLine;
    return const ForwardGeocodeResult(
      latitude: 32.16,
      longitude: 35.28,
      country: 'Palestine',
      city: 'Nablus',
      area: 'Awarta',
      addressLine: 'Main Street',
      displayName: 'Main Street, Awarta, Nablus',
      provider: 'nominatim',
    );
  }

  @override
  Future<ReverseGeocodeResult> reverseGeocode({
    required double latitude,
    required double longitude,
  }) async {
    reverseLatitude = latitude;
    reverseLongitude = longitude;
    if (failReverse) {
      throw Exception('reverse failed');
    }
    return const ReverseGeocodeResult(
      country: 'Palestine',
      city: 'Hebron',
      area: 'University District',
      addressLine: 'University District learner dropoff area',
      displayName: 'Hebron',
      provider: 'nominatim',
    );
  }
}
