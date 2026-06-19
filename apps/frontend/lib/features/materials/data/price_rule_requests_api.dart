import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/price_rule_request.dart';

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
}
