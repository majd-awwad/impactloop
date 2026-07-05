import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/locations/application/saved_locations_providers.dart';
import 'package:frontend/features/locations/data/forward_geocode_result.dart';
import 'package:frontend/features/locations/data/saved_location.dart';
import 'package:frontend/features/locations/data/saved_locations_api.dart';
import 'package:frontend/features/locations/presentation/pages/saved_locations_page.dart';

void main() {
  testWidgets('saved locations page renders empty state', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 820));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          savedLocationsProvider.overrideWith((ref) async => const []),
        ],
        child: const MaterialApp(home: SavedLocationsPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Saved locations'), findsOneWidget);
    expect(find.text('No saved locations yet'), findsOneWidget);
    expect(find.text('Add location'), findsOneWidget);
    expect(find.textContaining('private location'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('saved locations page shows private exact details', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(900, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
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
            ],
          ),
        ],
        child: const MaterialApp(home: SavedLocationsPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Default'), findsOneWidget);
    expect(find.text('Private exact details'), findsOneWidget);
    expect(find.text('Address: Building 10'), findsOneWidget);
    expect(find.text('Coordinates: 32.221122, 35.254455'), findsOneWidget);
    expect(find.text('Set default'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('create dialog validates required fields and submits payload', (
    tester,
  ) async {
    final api = _RecordingSavedLocationsApi();

    await tester.binding.setSurfaceSize(const Size(420, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          savedLocationsApiProvider.overrideWithValue(api),
          savedLocationsProvider.overrideWith((ref) async => const []),
        ],
        child: const MaterialApp(home: SavedLocationsPage()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Add location'));
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

    await tester.binding.setSurfaceSize(const Size(420, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          savedLocationsApiProvider.overrideWithValue(api),
          savedLocationsProvider.overrideWith((ref) async => const []),
        ],
        child: const MaterialApp(home: SavedLocationsPage()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Add location'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextFormField).at(0), 'Home');
    await tester.enterText(find.byType(TextFormField).at(1), 'Nablus');
    await tester.enterText(find.byType(TextFormField).at(2), 'Awarta');
    await tester.enterText(find.byType(TextFormField).at(3), 'Main Street');

    await tester.ensureVisible(find.text('Find typed address'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Find typed address'));
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

  testWidgets('edit cancel does not submit update', (tester) async {
    final api = _RecordingSavedLocationsApi();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          savedLocationsApiProvider.overrideWithValue(api),
          savedLocationsProvider.overrideWith(
            (ref) async => const [
              SavedLocation(id: 'saved-1', label: 'Home', city: 'Nablus'),
            ],
          ),
        ],
        child: const MaterialApp(home: SavedLocationsPage()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Edit'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, 'Updated');
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();

    expect(api.updatedPayload, isNull);
    expect(tester.takeException(), isNull);
  });
}

class _RecordingSavedLocationsApi extends SavedLocationsApi {
  _RecordingSavedLocationsApi() : super(Dio());

  SavedLocationPayload? createdPayload;
  SavedLocationPayload? updatedPayload;
  String? forwardGeocodeCity;
  String? forwardGeocodeArea;
  String? forwardGeocodeAddressLine;

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
}
