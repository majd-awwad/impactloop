import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';

class MaterialReportsApi {
  const MaterialReportsApi(this._client);

  final Dio _client;

  Future<String> submitReport({
    required String materialId,
    required String reason,
    String? note,
  }) async {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/materials/$materialId/reports',
        data: {
          'reason': reason,
          if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        },
      ),
      (json) => json['message'] as String? ?? 'Report submitted. Admin will review this material.',
    );
  }
}

final materialReportsApiProvider = Provider<MaterialReportsApi>((ref) {
  return MaterialReportsApi(ref.watch(apiClientProvider));
});
