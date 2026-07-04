import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/locations/data/saved_location.dart';
import 'package:frontend/features/locations/data/saved_locations_api.dart';

void main() {
  test('fetchSavedLocations parses private exact fields', () async {
    final api = SavedLocationsApi(
      _dioWithHandler((options) {
        expect(options.method, 'GET');
        expect(options.path, '/api/locations/saved');

        return {
          'success': true,
          'data': [
            {
              'id': 'saved-1',
              'label': 'Home',
              'country': 'Palestine',
              'city': 'Nablus',
              'area': 'Rafidia',
              'addressLine': 'Building 10',
              'latitude': 32.2211,
              'longitude': 35.2544,
              'isDefault': true,
            },
          ],
        };
      }),
    );

    final locations = await api.fetchSavedLocations();

    expect(locations, hasLength(1));
    expect(locations.first.label, 'Home');
    expect(locations.first.addressLine, 'Building 10');
    expect(locations.first.latitude, 32.2211);
    expect(locations.first.longitude, 35.2544);
    expect(locations.first.isDefault, isTrue);
  });

  test('createSavedLocation sends optional precise fields privately', () async {
    late Map<String, dynamic> sentBody;
    final api = SavedLocationsApi(
      _dioWithHandler((options) {
        expect(options.method, 'POST');
        expect(options.path, '/api/locations/saved');
        sentBody = Map<String, dynamic>.from(options.data as Map);

        return {
          'success': true,
          'data': {'id': 'saved-1', ...sentBody},
        };
      }),
    );

    final created = await api.createSavedLocation(
      const SavedLocationPayload(
        label: 'Campus',
        city: 'Nablus',
        area: 'New Campus',
        addressLine: 'Engineering gate',
        latitude: 32.227,
        longitude: 35.222,
        isDefault: true,
      ),
    );

    expect(sentBody['label'], 'Campus');
    expect(sentBody['city'], 'Nablus');
    expect(sentBody['addressLine'], 'Engineering gate');
    expect(sentBody['latitude'], 32.227);
    expect(sentBody['longitude'], 35.222);
    expect(sentBody['isDefault'], isTrue);
    expect(created.id, 'saved-1');
  });

  test(
    'setDefaultSavedLocation and deleteSavedLocation use existing CRUD API',
    () async {
      final calls = <String>[];
      final api = SavedLocationsApi(
        _dioWithHandler((options) {
          calls.add('${options.method} ${options.path}');

          if (options.method == 'PATCH') {
            expect(options.data, {'isDefault': true});
            return {
              'success': true,
              'data': {
                'id': 'saved-2',
                'label': 'Workshop',
                'city': 'Hebron',
                'isDefault': true,
              },
            };
          }

          return {
            'success': true,
            'data': {'id': 'saved-2', 'deleted': true},
          };
        }),
      );

      await api.setDefaultSavedLocation('saved-2');
      await api.deleteSavedLocation('saved-2');

      expect(calls, const [
        'PATCH /api/locations/saved/saved-2',
        'DELETE /api/locations/saved/saved-2',
      ]);
    },
  );

  test(
    'reverseGeocode resolves selected map point into readable fields',
    () async {
      late Map<String, dynamic> sentBody;
      final api = SavedLocationsApi(
        _dioWithHandler((options) {
          expect(options.method, 'POST');
          expect(options.path, '/api/locations/reverse-geocode');
          sentBody = Map<String, dynamic>.from(options.data as Map);

          return {
            'success': true,
            'data': {
              'country': 'Palestine',
              'city': 'Nablus',
              'area': 'Awarta',
              'addressLine': 'Main Street',
              'displayName': 'Main Street, Awarta, Nablus',
              'provider': 'nominatim',
            },
          };
        }),
      );

      final result = await api.reverseGeocode(
        latitude: 32.16,
        longitude: 35.28,
      );

      expect(sentBody['latitude'], 32.16);
      expect(sentBody['longitude'], 35.28);
      expect(result.country, 'Palestine');
      expect(result.city, 'Nablus');
      expect(result.area, 'Awarta');
      expect(result.addressLine, 'Main Street');
    },
  );

  test(
    'forwardGeocode resolves typed address into private coordinates',
    () async {
      late Map<String, dynamic> sentBody;
      final api = SavedLocationsApi(
        _dioWithHandler((options) {
          expect(options.method, 'POST');
          expect(options.path, '/api/locations/geocode');
          sentBody = Map<String, dynamic>.from(options.data as Map);

          return {
            'success': true,
            'data': {
              'latitude': 32.16,
              'longitude': 35.28,
              'country': 'Palestine',
              'city': 'Nablus',
              'area': 'Awarta',
              'addressLine': 'Main Street',
              'displayName': 'Main Street, Awarta, Nablus',
              'provider': 'nominatim',
            },
          };
        }),
      );

      final result = await api.forwardGeocode(
        city: 'Nablus',
        area: 'Awarta',
        addressLine: 'Main Street',
      );

      expect(sentBody['country'], 'Palestine');
      expect(sentBody['city'], 'Nablus');
      expect(sentBody['area'], 'Awarta');
      expect(sentBody['addressLine'], 'Main Street');
      expect(result.latitude, 32.16);
      expect(result.longitude, 35.28);
      expect(result.city, 'Nablus');
    },
  );
}

Dio _dioWithHandler(Map<String, dynamic> Function(RequestOptions) handler) {
  final dio = Dio();
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, requestHandler) {
        requestHandler.resolve(
          Response<Map<String, dynamic>>(
            requestOptions: options,
            statusCode: 200,
            data: handler(options),
          ),
        );
      },
    ),
  );
  return dio;
}
