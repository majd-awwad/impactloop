import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/material_discovery/data/api_material_discovery_repository.dart';
import 'package:frontend/features/material_discovery/domain/material_discovery_query.dart';

void main() {
  test('buildQueryParameters sends discovery filters to the API', () {
    final params = ApiMaterialDiscoveryRepository.buildQueryParameters(
      const MaterialDiscoveryQuery(
        q: 'wood panels',
        categoryId: 'cat-wood',
        condition: 'GOOD',
        priceType: 'FREE',
        deliveryAvailable: true,
        pickupAllowed: true,
        city: 'Nablus',
        area: 'Industrial',
        sort: 'nearest',
        latitude: 31.9,
        longitude: 35.2,
        page: 2,
        limit: 10,
      ),
    );

    expect(params['q'], 'wood panels');
    expect(params['categoryId'], 'cat-wood');
    expect(params['condition'], 'GOOD');
    expect(params['priceType'], 'FREE');
    expect(params['deliveryAvailable'], true);
    expect(params['pickupAllowed'], true);
    expect(params['city'], 'Nablus');
    expect(params['area'], 'Industrial');
    expect(params['sort'], 'nearest');
    expect(params['latitude'], 31.9);
    expect(params['longitude'], 35.2);
    expect(params['page'], 2);
    expect(params['limit'], 10);
    expect(params['status'], 'AVAILABLE');
  });

  test('fetchMaterials parses pagination metadata', () async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          handler.resolve(
            Response<Map<String, dynamic>>(
              requestOptions: options,
              data: {
                'success': true,
                'message': 'ok',
                'data': {
                  'items': [
                    {
                      'id': 'mat-1',
                      'title': 'Panel A',
                      'description': 'Wood',
                      'status': 'AVAILABLE',
                      'quantity': 2,
                      'availableQuantity': 2,
                      'unit': 'sheet',
                      'condition': 'GOOD',
                      'isFree': true,
                      'deliveryAvailable': false,
                      'pickupAllowed': true,
                      'viewsCount': 12,
                      'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
                    },
                  ],
                  'pagination': {
                    'page': 1,
                    'limit': 20,
                    'total': 42,
                    'totalPages': 3,
                  },
                },
              },
            ),
          );
        },
      ),
    );

    final repository = ApiMaterialDiscoveryRepository(dio);
    final result = await repository.fetchMaterials(
      const MaterialDiscoveryQuery(),
    );

    expect(result.items, hasLength(1));
    expect(result.items.first.viewsCount, 12);
    expect(result.items.first.isPopular, isTrue);
    expect(result.pagination.page, 1);
    expect(result.pagination.total, 42);
    expect(result.pagination.totalPages, 3);
    expect(result.pagination.hasMore, isTrue);
  });

  test('load more query uses the next page number', () {
    final pageTwo = ApiMaterialDiscoveryRepository.buildQueryParameters(
      const MaterialDiscoveryQuery(page: 2),
    );

    expect(pageTwo['page'], 2);
  });

  test('buildQueryParameters sends savedLocationId for nearest sort', () {
    final params = ApiMaterialDiscoveryRepository.buildQueryParameters(
      const MaterialDiscoveryQuery(sort: 'nearest', savedLocationId: 'loc-1'),
    );

    expect(params['sort'], 'nearest');
    expect(params['savedLocationId'], 'loc-1');
    expect(params.containsKey('latitude'), isFalse);
    expect(params.containsKey('longitude'), isFalse);
  });

  test(
    'buildQueryParameters does not send nearest without a location source',
    () {
      final params = ApiMaterialDiscoveryRepository.buildQueryParameters(
        const MaterialDiscoveryQuery(sort: 'nearest', page: 2),
      );

      expect(params['page'], 2);
      expect(params['sort'], 'newest');
      expect(params.containsKey('savedLocationId'), isFalse);
      expect(params.containsKey('latitude'), isFalse);
      expect(params.containsKey('longitude'), isFalse);
    },
  );
}
