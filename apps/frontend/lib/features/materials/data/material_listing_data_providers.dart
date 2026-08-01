import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'categories_api.dart';
import 'category_requests_api.dart';
import 'material_listing_policy_api.dart';
import 'material_listing_repository.dart';
import 'material_price_check_api.dart';
import 'material_types_api.dart';
import 'material_upload_api.dart';
import 'price_rule_requests_api.dart';

final categoriesApiProvider = Provider<CategoriesApi>((ref) {
  return CategoriesApi(ref.watch(apiClientProvider));
});

final materialTypesApiProvider = Provider<MaterialTypesApi>((ref) {
  return MaterialTypesApi(ref.watch(apiClientProvider));
});

final materialListingPolicyApiProvider = Provider<MaterialListingPolicyApi>((
  ref,
) {
  return MaterialListingPolicyApi(ref.watch(apiClientProvider));
});

final materialPriceCheckApiProvider = Provider<MaterialPriceCheckApi>((ref) {
  return MaterialPriceCheckApi(ref.watch(apiClientProvider));
});

final priceRuleRequestsApiProvider = Provider<PriceRuleRequestsApi>((ref) {
  return PriceRuleRequestsApi(ref.watch(apiClientProvider));
});

final categoryRequestsApiProvider = Provider<CategoryRequestsApi>((ref) {
  return CategoryRequestsApi(ref.watch(apiClientProvider));
});

final materialUploadApiProvider = Provider<MaterialUploadApi>((ref) {
  return MaterialUploadApi(ref.watch(apiClientProvider));
});

final materialListingRepositoryProvider = Provider<MaterialListingRepository>((
  ref,
) {
  return MaterialListingRepository(
    categoriesApi: ref.watch(categoriesApiProvider),
    materialTypesApi: ref.watch(materialTypesApiProvider),
    listingPolicyApi: ref.watch(materialListingPolicyApiProvider),
    priceCheckApi: ref.watch(materialPriceCheckApiProvider),
    priceRuleRequestsApi: ref.watch(priceRuleRequestsApiProvider),
    categoryRequestsApi: ref.watch(categoryRequestsApiProvider),
    materialUploadApi: ref.watch(materialUploadApiProvider),
  );
});
