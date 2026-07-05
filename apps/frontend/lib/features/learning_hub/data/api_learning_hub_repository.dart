import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import '../../materials/data/categories_api.dart';
import '../../materials/data/models/category.dart';
import '../domain/learning_project_repository.dart';
import '../domain/learning_projects_result.dart';
import '../domain/models/learning_project.dart';
import 'learning_hub_api_mapper.dart';

class ApiLearningHubRepository implements LearningProjectRepository {
  const ApiLearningHubRepository({
    required Dio client,
    required CategoriesApi categoriesApi,
  }) : _client = client,
       _categoriesApi = categoriesApi;

  final Dio _client;
  final CategoriesApi _categoriesApi;

  static const _basePath = '/api/learning-projects';

  @override
  Future<LearningProjectsResult> fetchProjects(
    LearningProjectsQuery query,
  ) async {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        _basePath,
        queryParameters: {
          'page': query.page,
          'limit': query.limit,
          if (query.q != null && query.q!.trim().isNotEmpty) 'q': query.q,
          if (query.categoryId != null && query.categoryId!.trim().isNotEmpty)
            'categoryId': query.categoryId,
          if (query.difficulty != null && query.difficulty!.trim().isNotEmpty)
            'difficulty': query.difficulty,
          if (query.tag != null && query.tag!.trim().isNotEmpty)
            'tag': query.tag,
        },
      ),
      (json) {
        final itemsJson = json['items'];
        final paginationJson = json['pagination'];
        final items = itemsJson is List
            ? itemsJson
                  .whereType<Map>()
                  .map(
                    (item) => LearningHubApiMapper.fromListItemJson(
                      Map<String, dynamic>.from(item),
                    ),
                  )
                  .toList(growable: false)
            : const <LearningProject>[];

        final pagination = paginationJson is Map
            ? Map<String, dynamic>.from(paginationJson)
            : const <String, dynamic>{};

        final page = _intFromDynamic(pagination['page']) ?? query.page;
        final limit = _intFromDynamic(pagination['limit']) ?? query.limit;
        final total = _intFromDynamic(pagination['total']) ?? items.length;
        final totalPages =
            _intFromDynamic(pagination['totalPages']) ??
            (total == 0 ? 0 : ((total + limit - 1) / limit).ceil());

        return LearningProjectsResult(
          items: items,
          page: page,
          limit: limit,
          total: total,
          totalPages: totalPages,
        );
      },
    );
  }

  @override
  Future<LearningProject?> fetchProjectById(String id) async {
    try {
      return await unwrapApiResponse(
        _client.get<Map<String, dynamic>>('$_basePath/$id'),
        LearningHubApiMapper.fromDetailJson,
      );
    } on ApiException catch (error) {
      if (error.statusCode == 404 || error.code == 'NOT_FOUND') {
        return null;
      }

      rethrow;
    }
  }

  @override
  Future<List<MaterialCategory>> fetchProjectCategories() {
    return _categoriesApi.fetchProjectCategories();
  }

  @override
  Future<void> submitProjectForReview({
    required String title,
    required String shortDescription,
    required String description,
    required String categoryId,
    required String difficulty,
    int? estimatedDurationMinutes,
    List<Map<String, dynamic>>? requiredComponents,
    List<Map<String, dynamic>>? steps,
    List<Map<String, dynamic>>? links,
  }) async {
    final data = <String, dynamic>{
      'title': title,
      'shortDescription': shortDescription,
      'description': description,
      'categoryId': categoryId,
      'difficulty': difficulty,
      if (requiredComponents != null && requiredComponents.isNotEmpty)
        'requiredComponents': requiredComponents,
      if (steps != null && steps.isNotEmpty) 'steps': steps,
      if (links != null && links.isNotEmpty) 'links': links,
    };

    if (estimatedDurationMinutes != null) {
      data['estimatedDurationMinutes'] = estimatedDurationMinutes;
    }

    await unwrapApiResponse(
      _client.post<Map<String, dynamic>>('$_basePath/submit', data: data),
      (json) => json,
    );
  }

  static int? _intFromDynamic(Object? value) {
    if (value is int) {
      return value;
    }

    if (value is num) {
      return value.toInt();
    }

    if (value is String) {
      return int.tryParse(value);
    }

    return null;
  }
}
