import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/network/api_client.dart';
import 'package:frontend/features/learning_hub/data/api_learning_hub_repository.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/material_discovery/data/material_discovery_api_mapper.dart';
import 'package:frontend/features/material_discovery/data/api_material_discovery_repository.dart';
import 'package:frontend/features/reservations/data/models/create_reservation_request.dart';
import 'package:frontend/features/reservations/data/reservations_api.dart';
import 'package:frontend/features/materials/data/categories_api.dart';
import 'package:frontend/features/home/data/learner_home_item_mapper.dart';
import 'package:frontend/features/home/domain/learner_home_models.dart';

void main() {
  test(
    'normalizes optional impression headers without creating blank headers',
    () {
      expect(recommendationHeaders('  impression-1  '), {
        'X-Recommendation-Impression-Id': 'impression-1',
      });
      expect(recommendationHeaders(null), isNull);
      expect(recommendationHeaders('   '), isNull);
    },
  );

  test('keeps the nested material impression id in Learner Home mapping', () {
    final item = LearnerHomeItemMapper.fromJson({
      'type': 'material',
      'score': 7,
      'reasons': ['Useful for your project'],
      'material': {
        'id': 'material-1',
        'title': 'Material',
        'description': 'Material',
        'status': 'AVAILABLE',
        'quantity': 1,
        'unit': 'piece',
        'condition': 'GOOD',
        'isFree': true,
        'deliveryAvailable': false,
        'recommendationImpressionId': 'impression-material-1',
        'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
      },
    });

    expect(
      (item as LearnerHomeMaterialRecommendation)
          .material
          .recommendationImpressionId,
      'impression-material-1',
    );
  });

  test('keeps the nested project impression id in Learner Home mapping', () {
    final item = LearnerHomeItemMapper.fromJson({
      'type': 'project',
      'score': 8,
      'reasons': ['Matches your interests'],
      'project': {
        'id': 'project-1',
        'title': 'Project',
        'shortDescription': 'Project',
        'recommendationImpressionId': 'impression-project-1',
        'category': {'nameEn': 'Energy', 'nameAr': 'طاقة'},
        'difficulty': 'BEGINNER',
      },
    });

    expect(
      (item as LearnerHomeProjectRecommendation)
          .project
          .recommendationImpressionId,
      'impression-project-1',
    );
  });

  test(
    'material view and engagement actions carry only their item context',
    () async {
      final requests = <RequestOptions>[];
      final dio = _testClient(requests);
      final repository = ApiMaterialDiscoveryRepository(dio);

      await repository.getMaterialById(
        'material-a',
        recommendationImpressionId: 'impression-material-1',
      );
      await repository.likeMaterial('material-b');
      await repository.unlikeMaterial(
        'material-a',
        recommendationImpressionId: 'impression-material-1',
      );

      expect(requests.map(_impressionHeader), [
        'impression-material-1',
        null,
        'impression-material-1',
      ]);
    },
  );

  test(
    'a normal detail response replaces recommendation data without leaking it',
    () async {
      final recommended = MaterialDiscoveryApiMapper.fromJson({
        'id': 'material-a',
        'title': 'Recommended material',
        'description': 'Recommendation payload',
        'status': 'AVAILABLE',
        'quantity': 1,
        'unit': 'piece',
        'condition': 'GOOD',
        'isFree': true,
        'deliveryAvailable': false,
        'recommendationImpressionId': 'impression-a',
        'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
      });
      final ordinary = MaterialDiscoveryApiMapper.fromJson({
        'id': recommended.id,
        'title': 'Ordinary detail response',
        'description': 'Normal detail payload',
        'status': 'AVAILABLE',
        'quantity': 1,
        'unit': 'piece',
        'condition': 'GOOD',
        'isFree': true,
        'deliveryAvailable': false,
        'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
      });
      final requests = <RequestOptions>[];
      final repository = ApiMaterialDiscoveryRepository(_testClient(requests));

      expect(recommended.recommendationImpressionId, 'impression-a');
      expect(ordinary.recommendationImpressionId, isNull);
      await repository.likeMaterial(ordinary.id);

      expect(_impressionHeader(requests.single), isNull);
    },
  );

  test('concurrent requests keep impression headers isolated', () async {
    final requests = <RequestOptions>[];
    final repository = ApiMaterialDiscoveryRepository(_testClient(requests));

    await Future.wait([
      repository.likeMaterial(
        'material-a',
        recommendationImpressionId: 'impression-a',
      ),
      repository.likeMaterial('material-b'),
      repository.likeMaterial(
        'material-c',
        recommendationImpressionId: 'impression-c',
      ),
    ]);

    expect(requests.map(_impressionHeader), [
      'impression-a',
      null,
      'impression-c',
    ]);
  });

  test(
    'request-specific headers preserve existing transport headers',
    () async {
      final requests = <RequestOptions>[];
      final defaults = <String, dynamic>{
        'Accept': 'application/json',
        'Authorization': 'Bearer test-token',
        'X-Request-Id': 'request-1',
        'X-Platform': 'web',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idempotency-1',
      };
      final repository = ApiMaterialDiscoveryRepository(
        _testClient(requests, baseHeaders: defaults),
      );

      await repository.likeMaterial(
        'material-a',
        recommendationImpressionId: 'impression-a',
      );

      expect(_impressionHeader(requests.single), 'impression-a');
      expect(requests.single.headers['Accept'], 'application/json');
      expect(requests.single.headers['Authorization'], 'Bearer test-token');
      expect(requests.single.headers['X-Request-Id'], 'request-1');
      expect(requests.single.headers['X-Platform'], 'web');
      expect(requests.single.headers['Content-Type'], 'application/json');
      expect(requests.single.headers['Idempotency-Key'], 'idempotency-1');
      expect(defaults['X-Request-Id'], 'request-1');
    },
  );

  test(
    'reservation creation preserves its body and carries item context',
    () async {
      final requests = <RequestOptions>[];
      final dio = _testClient(requests);
      final request = const CreateReservationRequest(
        materialId: 'material-1',
        quantityRequested: 2,
        fulfillmentMethod: 'PICKUP',
        message: 'Please hold these for my project.',
      );

      await ReservationsApi(dio).createReservation(
        request,
        recommendationImpressionId: 'impression-material-1',
      );

      expect(requests.single.data, request.toJson());
      expect(_impressionHeader(requests.single), 'impression-material-1');
    },
  );

  test(
    'project like and build progress carry the originating project context',
    () async {
      final requests = <RequestOptions>[];
      final dio = _testClient(requests);
      final repository = ApiLearningHubRepository(
        client: dio,
        categoriesApi: CategoriesApi(dio),
      );

      await repository.likeProject(
        'project-a',
        recommendationImpressionId: 'impression-project-1',
      );
      await repository.updateBuildItem(
        'project-a',
        'item-1',
        status: ProjectBuildItemStatus.available,
        recommendationImpressionId: 'impression-project-1',
      );
      await repository.saveProject('project-b');

      expect(requests.map(_impressionHeader), [
        'impression-project-1',
        'impression-project-1',
        null,
      ]);
      expect(requests[1].data, {'status': 'AVAILABLE', 'learnerNote': null});
      expect(requests[0].path, '/api/learning-projects/project-a/like');
      expect(
        requests[1].path,
        '/api/learning-projects/project-a/builds/me/items/item-1',
      );
      expect(requests[2].path, '/api/learning-projects/project-b/save');
      expect(
        requests.every(
          (request) => !request.headers.containsKey('X-Recommendation-Surface'),
        ),
        isTrue,
      );
    },
  );
}

String? _impressionHeader(RequestOptions options) {
  return options.headers['X-Recommendation-Impression-Id'] as String?;
}

Dio _testClient(
  List<RequestOptions> requests, {
  Map<String, dynamic>? baseHeaders,
}) {
  final dio = Dio(BaseOptions(headers: baseHeaders));
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        requests.add(options);
        final data = switch (options.path) {
          '/api/materials/material-1' => {
            'id': 'material-1',
            'title': 'Material',
            'description': 'Material',
            'status': 'AVAILABLE',
            'quantity': 1,
            'unit': 'piece',
            'condition': 'GOOD',
            'isFree': true,
            'deliveryAvailable': false,
            'category': {'nameEn': 'Wood', 'nameAr': 'خشب'},
          },
          '/api/materials/material-1/like' => {
            'materialId': 'material-1',
            'likesCount': 1,
            'isLiked': options.method == 'POST',
          },
          '/api/reservations' => {
            'id': 'reservation-1',
            'status': 'PENDING',
            'material': {
              'id': 'material-1',
              'title': 'Material',
              'status': 'AVAILABLE',
              'quantity': 1,
              'unit': 'piece',
            },
            'quantityRequested': 2,
            'createdAt': '2026-07-18T00:00:00.000Z',
          },
          '/api/learning-projects/project-1/like' => {
            'projectId': 'project-1',
            'likesCount': 1,
            'isLiked': true,
          },
          '/api/learning-projects/project-1/save' => {
            'projectId': 'project-1',
            'isSaved': true,
          },
          _ => {
            'id': 'build-1',
            'projectId': 'project-1',
            'status': 'IN_PROGRESS',
            'project': {
              'id': 'project-1',
              'title': 'Project',
              'shortDescription': 'Project',
            },
            'progress': {'total': 1, 'ready': 1, 'percent': 100},
            'items': [],
          },
        };

        handler.resolve(
          Response<Map<String, dynamic>>(
            requestOptions: options,
            statusCode: 200,
            data: {'success': true, 'message': 'ok', 'data': data},
          ),
        );
      },
    ),
  );
  return dio;
}
