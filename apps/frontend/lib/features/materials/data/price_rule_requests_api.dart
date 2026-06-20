import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/price_rule_request.dart';
import 'models/price_rule_request_draft.dart';

class PriceRuleRequestsApi {
  const PriceRuleRequestsApi(this._client);

  final Dio _client;

  Future<PriceRuleRequestResult> createRequest(
    CreatePriceRuleRequest request,
  ) async {
    try {
      return await unwrapApiResponse(
        _client.post<Map<String, dynamic>>(
          '/api/price-rule-requests',
          data: request.toJson(),
        ),
        PriceRuleRequestResult.fromJson,
      );
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<PriceRuleRequestDraftResponse> fetchDraft(String id) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/supplier/price-rule-requests/$id/draft',
      ),
      PriceRuleRequestDraftResponse.fromJson,
    );
  }
}
