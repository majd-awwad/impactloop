import 'dart:math';

import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/learner_material_request.dart';

String generateLearnerMaterialRequestIdempotencyKey() {
  const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  final random = Random.secure();
  final suffix = List.generate(
    24,
    (_) => chars[random.nextInt(chars.length)],
  ).join();
  return 'lmr-${DateTime.now().microsecondsSinceEpoch}-$suffix';
}

class CreateLearnerMaterialRequestPayload {
  const CreateLearnerMaterialRequestPayload({
    required this.requestedItemName,
    required this.categoryId,
    this.description,
    required this.quantity,
    required this.unit,
    this.alternativesAllowed = true,
    this.sourceSavedLocationId,
    this.locationCountry,
    this.locationCity,
    this.locationArea,
    this.neededBy,
    this.projectId,
    this.projectBuildId,
    this.projectBuildItemId,
  });

  final String requestedItemName;
  final String categoryId;
  final String? description;
  final double quantity;
  final String unit;
  final bool alternativesAllowed;
  final String? sourceSavedLocationId;
  final String? locationCountry;
  final String? locationCity;
  final String? locationArea;
  final DateTime? neededBy;
  final String? projectId;
  final String? projectBuildId;
  final String? projectBuildItemId;

  Map<String, dynamic> toJson() {
    return {
      'requestedItemName': requestedItemName,
      'categoryId': categoryId,
      if (description != null && description!.trim().isNotEmpty)
        'description': description!.trim(),
      'quantity': quantity,
      'unit': unit,
      'alternativesAllowed': alternativesAllowed,
      if (sourceSavedLocationId != null && sourceSavedLocationId!.isNotEmpty)
        'sourceSavedLocationId': sourceSavedLocationId,
      if (locationCountry != null && locationCountry!.trim().isNotEmpty)
        'locationCountry': locationCountry!.trim(),
      if (locationCity != null && locationCity!.trim().isNotEmpty)
        'locationCity': locationCity!.trim(),
      if (locationArea != null && locationArea!.trim().isNotEmpty)
        'locationArea': locationArea!.trim(),
      if (neededBy != null) 'neededBy': neededBy!.toUtc().toIso8601String(),
      if (projectId != null && projectId!.isNotEmpty) 'projectId': projectId,
      if (projectBuildId != null && projectBuildId!.isNotEmpty)
        'projectBuildId': projectBuildId,
      if (projectBuildItemId != null && projectBuildItemId!.isNotEmpty)
        'projectBuildItemId': projectBuildItemId,
    };
  }
}

class UpdateLearnerMaterialRequestPayload {
  const UpdateLearnerMaterialRequestPayload({
    this.description,
    this.alternativesAllowed,
    this.sourceSavedLocationId,
    this.locationCountry,
    this.locationCity,
    this.locationArea,
    this.neededBy,
    this.clearNeededBy = false,
  });

  final String? description;
  final bool? alternativesAllowed;
  final String? sourceSavedLocationId;
  final String? locationCountry;
  final String? locationCity;
  final String? locationArea;
  final DateTime? neededBy;
  final bool clearNeededBy;

  Map<String, dynamic> toJson() {
    return {
      if (description != null) 'description': description,
      if (alternativesAllowed != null)
        'alternativesAllowed': alternativesAllowed,
      if (sourceSavedLocationId != null)
        'sourceSavedLocationId': sourceSavedLocationId,
      if (locationCountry != null) 'locationCountry': locationCountry,
      if (locationCity != null) 'locationCity': locationCity,
      if (locationArea != null) 'locationArea': locationArea,
      if (clearNeededBy) 'neededBy': null,
      if (!clearNeededBy && neededBy != null)
        'neededBy': neededBy!.toUtc().toIso8601String(),
    };
  }
}

class LearnerMaterialRequestsApi {
  const LearnerMaterialRequestsApi(this._client);

  final Dio _client;

  static const _basePath = '/api/learner/material-requests';

  Future<LearnerMaterialRequest> createRequest(
    CreateLearnerMaterialRequestPayload payload, {
    required String idempotencyKey,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        _basePath,
        data: payload.toJson(),
        options: Options(headers: {'Idempotency-Key': idempotencyKey}),
      ),
      LearnerMaterialRequest.fromJson,
    );
  }

  Future<LearnerMaterialRequestListResult> fetchRequests({
    String? status,
    int page = 1,
    int limit = 10,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        _basePath,
        queryParameters: {
          if (status != null) 'status': status,
          'page': page,
          'limit': limit,
        },
      ),
      LearnerMaterialRequestListResult.fromJson,
    );
  }

  Future<LearnerMaterialRequest> fetchRequest(String id) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('$_basePath/$id'),
      LearnerMaterialRequest.fromJson,
    );
  }

  Future<LearnerMaterialRequest> updateRequest(
    String id,
    UpdateLearnerMaterialRequestPayload payload,
  ) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '$_basePath/$id',
        data: payload.toJson(),
      ),
      LearnerMaterialRequest.fromJson,
    );
  }

  Future<LearnerMaterialRequest> cancelRequest(String id) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>('$_basePath/$id/cancel'),
      LearnerMaterialRequest.fromJson,
    );
  }

  Future<LearnerMaterialRequest> fulfillRequest(String id) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>('$_basePath/$id/fulfill'),
      LearnerMaterialRequest.fromJson,
    );
  }

  Future<LearnerMaterialRequest> duplicateRequest(String id) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>('$_basePath/$id/duplicate'),
      LearnerMaterialRequest.fromJson,
    );
  }

  Future<LearnerMaterialRequest> dismissMatch(String matchId) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_basePath/matches/$matchId/dismiss',
      ),
      LearnerMaterialRequest.fromJson,
    );
  }
}
