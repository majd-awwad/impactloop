import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import '../application/supplier_portal_session.dart';
import 'models/supplier_category_demand.dart';

class SupplierCategoryDemandApi {
  const SupplierCategoryDemandApi(this._client);

  final Dio _client;

  Future<SupplierCategoryDemandResult> fetchCategoryDemand({int limit = 8}) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/supplier/insights/category-demand',
        queryParameters: {'limit': limit},
      ),
      SupplierCategoryDemandResult.fromJson,
    );
  }
}

final supplierCategoryDemandApiProvider = Provider<SupplierCategoryDemandApi>((
  ref,
) {
  return SupplierCategoryDemandApi(ref.watch(apiClientProvider));
});

final supplierCategoryDemandProvider =
    FutureProvider<SupplierCategoryDemandResult>((ref) {
      watchSupplierPortalSessionFromRef(ref);
      return ref.watch(supplierCategoryDemandApiProvider).fetchCategoryDemand();
    });
