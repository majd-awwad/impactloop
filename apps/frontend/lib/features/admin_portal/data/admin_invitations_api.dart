import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import 'models/admin_invitations_models.dart';

class AdminInvitationsApi {
  const AdminInvitationsApi(this._client);

  final Dio _client;

  Future<List<AdminInvitationItem>> fetchInvitations() async {
    try {
      final response =
          await _client.get<Map<String, dynamic>>('/api/admin/invitations');
      final body = response.data;

      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Request failed',
        );
      }

      final data = body['data'];
      if (data is! List) {
        return const [];
      }

      return data
          .whereType<Map<String, dynamic>>()
          .map(AdminInvitationItem.fromJson)
          .toList(growable: false);
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<AdminInvitationCreateResult> createInvitation(
    AdminInvitationCreateRequest request,
  ) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/admin/invitations',
        data: request.toJson(),
      ),
      AdminInvitationCreateResult.fromJson,
    );
  }

  Future<AdminInvitationCreateResult> resendInvitation(String id) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>('/api/admin/invitations/$id/resend'),
      AdminInvitationCreateResult.fromJson,
    );
  }

  Future<AdminInvitationItem> revokeInvitation(String id) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>('/api/admin/invitations/$id/revoke'),
      AdminInvitationItem.fromJson,
    );
  }
}
