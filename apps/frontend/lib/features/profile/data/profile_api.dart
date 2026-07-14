import 'package:dio/dio.dart';

import '../../../core/auth/auth_interceptor.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import '../../auth/data/models/user.dart';
import 'models/learner_interest_options.dart';
import 'models/uploaded_profile_image.dart';

class ProfileApi {
  const ProfileApi(this._client);

  final Dio _client;

  static const _profileBasePath = '/api/profile';
  static const _uploadPath = '/api/uploads/profile-image';

  Future<User> updateProfile({
    String? displayName,
    String? phone,
    String? profileImageUrl,
    bool updatePhone = false,
    bool updateProfileImage = false,
  }) {
    final data = <String, dynamic>{};

    if (displayName != null) {
      data['displayName'] = displayName;
    }

    if (updatePhone) {
      data['phone'] = phone;
    }

    if (updateProfileImage) {
      data['profileImageUrl'] = profileImageUrl;
    }

    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(_profileBasePath, data: data),
      (json) {
        final userJson = json['user'];
        if (userJson is! Map<String, dynamic>) {
          throw const FormatException('Missing user in profile response');
        }
        return User.fromJson(userJson);
      },
    );
  }

  Future<LearnerInterestOptionsResponse> getLearnerInterestOptions() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('$_profileBasePath/learner/interests/options'),
      (json) => LearnerInterestOptionsResponse.fromJson(json),
    );
  }

  Future<User> updateLearnerProfile({
    required String learnerType,
    required String skillLevel,
    required List<String> interests,
    String? bio,
  }) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '$_profileBasePath/learner',
        data: {
          'learnerType': learnerType,
          'skillLevel': skillLevel,
          'interests': interests,
          'bio': ?bio,
        },
      ),
      (json) {
        final userJson = json['user'];
        if (userJson is! Map<String, dynamic>) {
          throw const FormatException('Missing user in profile response');
        }
        return User.fromJson(userJson);
      },
    );
  }

  Future<UploadedProfileImage> uploadProfileImage(PendingProfileImage image) {
    return _uploadProfileImage(image);
  }

  Future<UploadedProfileImage> _uploadProfileImage(
    PendingProfileImage image,
  ) async {
    try {
      final formData = FormData.fromMap({
        'image': MultipartFile.fromBytes(
          image.bytes,
          filename: image.fileName,
          contentType: DioMediaType.parse(image.mimeType),
        ),
      });

      final response = await _client.post<Map<String, dynamic>>(
        _uploadPath,
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

      final imageJson = data['image'];
      if (imageJson is! Map) {
        throw const ApiException(message: 'Unexpected upload response format');
      }

      return UploadedProfileImage.fromJson(
        Map<String, dynamic>.from(imageJson),
      );
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
