import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/locations/application/saved_locations_providers.dart';
import 'package:frontend/features/locations/data/reverse_geocode_result.dart';
import 'package:frontend/features/locations/data/saved_location.dart';
import 'package:frontend/features/locations/data/saved_locations_api.dart';
import 'package:frontend/features/locations/presentation/pages/saved_locations_page.dart';
import 'package:frontend/shared/location/current_location_service.dart';

/// Manual acceptance screenshots for PROFILE-02A.
///
/// Run:
/// `flutter test test/saved_locations_screenshot_test.dart --update-goldens`
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const seeded = [
    SavedLocation(
      id: '1',
      label: 'Home',
      city: 'Hebron',
      area: 'University District',
      addressLine: 'University District learner dropoff area',
      latitude: 31.5326,
      longitude: 35.0998,
      isDefault: true,
    ),
    SavedLocation(
      id: '2',
      label: 'Work',
      city: 'Ramallah',
      area: 'Al Tireh',
      addressLine: 'Office building entrance',
      latitude: 31.903,
      longitude: 35.204,
    ),
    SavedLocation(
      id: '3',
      label: 'Friend',
      city: 'Nablus',
      area: 'Rafidia',
      latitude: 32.2211,
      longitude: 35.2544,
    ),
  ];

  Future<void> capture({
    required WidgetTester tester,
    required String name,
    required Size size,
    required Locale locale,
    required List<SavedLocation> locations,
    ThemeMode themeMode = ThemeMode.light,
    bool openCurrentLocationDialog = false,
    CurrentLocationService? locationService,
    SavedLocationsApi? api,
  }) async {
    final fakeLocation = locationService ?? _ShotLocationService();
    final fakeApi = api ?? _ShotApi();

    await tester.binding.setSurfaceSize(size);
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          savedLocationsProvider.overrideWith((ref) async => locations),
          savedLocationsApiProvider.overrideWithValue(fakeApi),
          currentLocationServiceProvider.overrideWithValue(fakeLocation),
        ],
        child: MediaQuery(
          data: MediaQueryData(size: size),
          child: MaterialApp(
            theme: AppTheme.lightFor(locale.languageCode),
            darkTheme: AppTheme.darkFor(locale.languageCode),
            themeMode: themeMode,
            locale: locale,
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

    if (openCurrentLocationDialog) {
      final label = locale.languageCode == 'ar'
          ? 'استخدام موقعي الحالي'
          : 'Use my current location';
      final button = find.widgetWithText(OutlinedButton, label);
      await tester.ensureVisible(button.last);
      await tester.pump();
      await tester.tap(button.last);
      for (var i = 0; i < 40; i++) {
        await tester.pump(const Duration(milliseconds: 50));
        if (find.text('Create location').evaluate().isNotEmpty ||
            find.text('إنشاء موقع').evaluate().isNotEmpty ||
            find.textContaining('Getting your current location').evaluate().isNotEmpty ||
            find.textContaining('جارٍ الحصول').evaluate().isNotEmpty) {
          break;
        }
      }
      await tester.pump(const Duration(milliseconds: 100));
    }

    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('screenshots/saved_locations/$name.png'),
    );
  }

  testWidgets('en_web_1440', (tester) async {
    await capture(
      tester: tester,
      name: 'en_web_1440',
      size: const Size(1440, 900),
      locale: const Locale('en'),
      locations: seeded,
    );
  });

  testWidgets('ar_web_1440', (tester) async {
    await capture(
      tester: tester,
      name: 'ar_web_1440',
      size: const Size(1440, 900),
      locale: const Locale('ar'),
      locations: seeded,
    );
  });

  testWidgets('en_mobile_390', (tester) async {
    await capture(
      tester: tester,
      name: 'en_mobile_390',
      size: const Size(390, 844),
      locale: const Locale('en'),
      locations: seeded,
    );
  });

  testWidgets('ar_mobile_360', (tester) async {
    await capture(
      tester: tester,
      name: 'ar_mobile_360',
      size: const Size(360, 800),
      locale: const Locale('ar'),
      locations: seeded,
    );
  });

  testWidgets('dark_mobile_360', (tester) async {
    await capture(
      tester: tester,
      name: 'dark_mobile_360',
      size: const Size(360, 800),
      locale: const Locale('en'),
      themeMode: ThemeMode.dark,
      locations: seeded,
    );
  });

  testWidgets('empty_state', (tester) async {
    await capture(
      tester: tester,
      name: 'empty_state',
      size: const Size(390, 844),
      locale: const Locale('en'),
      locations: const [],
    );
  });

  testWidgets('current_location_loading', (tester) async {
    final completer = Completer<CurrentLocationCapture>();
    await capture(
      tester: tester,
      name: 'current_location_loading',
      size: const Size(390, 1100),
      locale: const Locale('en'),
      locations: const [],
      locationService: _ShotLocationService(pending: completer.future),
      openCurrentLocationDialog: true,
    );
    completer.complete(
      const CurrentLocationCapture(latitude: 1, longitude: 2),
    );
    await tester.pump();
  });

  testWidgets('add_dialog_prefilled', (tester) async {
    await capture(
      tester: tester,
      name: 'add_dialog_prefilled',
      size: const Size(390, 1100),
      locale: const Locale('en'),
      locations: const [],
      openCurrentLocationDialog: true,
    );
  });
}

class _ShotLocationService extends CurrentLocationService {
  _ShotLocationService({this.pending});

  final CurrentLocationCapture capture = const CurrentLocationCapture(
    latitude: 31.5326,
    longitude: 35.0998,
  );
  final Future<CurrentLocationCapture>? pending;

  @override
  Future<CurrentLocationCapture> captureCurrentLocation() {
    return pending ?? Future<CurrentLocationCapture>.value(capture);
  }
}

class _ShotApi extends SavedLocationsApi {
  _ShotApi() : super(Dio());

  @override
  Future<ReverseGeocodeResult> reverseGeocode({
    required double latitude,
    required double longitude,
  }) async {
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
