import 'package:dio/dio.dart';

import '../../../core/auth/auth_interceptor.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import 'models/material_draft_image.dart';

class MaterialUploadApi {
  const MaterialUploadApi(this._client);

  final Dio _client;

  Future<List<UploadedMaterialImage>> uploadMaterialImages(
    List<MaterialDraftImage> pendingImages,
  ) async {
    if (pendingImages.isEmpty) {
      return const [];
    }

    try {
      final formData = FormData.fromMap({
        'images': [
          for (final image in pendingImages)
            MultipartFile.fromBytes(
              image.bytes!,
              filename: image.fileName,
              contentType: DioMediaType.parse(image.mimeType),
            ),
        ],
      });

      final response = await _client.post<Map<String, dynamic>>(
        '/api/uploads/material-images',
        data: formData,
        options: Options(
          contentType: 'multipart/form-data',
          sendTimeout: const Duration(seconds: 60),
          receiveTimeout: const Duration(seconds: 60),
          extra: const {AuthInterceptor.skipAuthRefreshExtraKey: true},
        ),
      );

      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Image upload failed',
          statusCode: response.statusCode,
        );
      }

      final data = body['data'];
      if (data is! Map) {
        throw const ApiException(message: 'Unexpected upload response format');
      }

      final images = data['images'];
      if (images is! List) {
        throw const ApiException(message: 'Unexpected upload response format');
      }

      return images
          .whereType<Map>()
          .map(
            (item) =>
                UploadedMaterialImage.fromJson(Map<String, dynamic>.from(item)),
          )
          .where((image) => image.url.isNotEmpty)
          .toList();
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
