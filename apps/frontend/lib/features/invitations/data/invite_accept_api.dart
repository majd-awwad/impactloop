import 'package:dio/dio.dart';



import '../../../core/errors/api_exception.dart';

import '../../../core/network/api_response.dart' show mapDioException;

import 'models/invite_accept_models.dart';



class InviteAcceptApi {

  const InviteAcceptApi(this._client);



  final Dio _client;



  Future<InviteValidationResult> validateToken(String token) async {

    try {

      final response = await _client.get<Map<String, dynamic>>(

        '/api/invitations/validate',

        queryParameters: {'token': token},

      );

      final body = response.data;



      if (body == null || body['success'] != true) {

        throw ApiException(

          message: body?['message'] as String? ?? 'Validation failed',

        );

      }



      final data = body['data'];

      if (data is! Map<String, dynamic>) {

        return const InviteValidationResult(valid: false);

      }



      return InviteValidationResult.fromJson(data);

    } on DioException catch (error) {

      throw mapDioException(error);

    }

  }



  Future<InviteAcceptResult> acceptInvitation(InviteAcceptRequest request) async {

    try {

      final response = await _client.post<Map<String, dynamic>>(

        '/api/invitations/accept',

        data: request.toJson(),

      );

      final body = response.data;



      if (body == null || body['success'] != true) {

        final errorBody = body?['error'];

        throw ApiException(

          message: body?['message'] as String? ?? 'Accept failed',

          code: errorBody is Map<String, dynamic>

              ? errorBody['code'] as String?

              : null,

        );

      }



      final data = body['data'];

      if (data is! Map<String, dynamic>) {

        throw const ApiException(message: 'Unexpected accept response');

      }



      return InviteAcceptResult.fromJson(data);

    } on DioException catch (error) {

      throw mapDioException(error);

    }

  }

}

