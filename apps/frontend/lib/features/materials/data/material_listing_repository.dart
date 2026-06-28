import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'categories_api.dart';
import 'category_requests_api.dart';
import 'material_listing_policy_api.dart';
import 'material_price_check_api.dart';
import 'material_types_api.dart';
import 'models/category.dart';
import 'models/category_request.dart';
import 'models/material_draft_image.dart';
import 'models/material_listing_policy.dart';
import 'models/material_price_check_request.dart';
import 'models/material_price_check_result.dart';
import 'models/material_type.dart';
import 'models/price_rule_request.dart';
import 'models/price_rule_request_draft.dart';
import 'price_rule_requests_api.dart';
import 'material_upload_api.dart';

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

class MaterialListingRepository {
  const MaterialListingRepository({
    required CategoriesApi categoriesApi,
    required MaterialTypesApi materialTypesApi,
    required MaterialListingPolicyApi listingPolicyApi,
    required MaterialPriceCheckApi priceCheckApi,
    required PriceRuleRequestsApi priceRuleRequestsApi,
    required CategoryRequestsApi categoryRequestsApi,
    required MaterialUploadApi materialUploadApi,
  }) : _categoriesApi = categoriesApi,
       _materialTypesApi = materialTypesApi,
       _listingPolicyApi = listingPolicyApi,
       _priceCheckApi = priceCheckApi,
       _priceRuleRequestsApi = priceRuleRequestsApi,
       _categoryRequestsApi = categoryRequestsApi,
       _materialUploadApi = materialUploadApi;

  final CategoriesApi _categoriesApi;
  final MaterialTypesApi _materialTypesApi;
  final MaterialListingPolicyApi _listingPolicyApi;
  final MaterialPriceCheckApi _priceCheckApi;
  final PriceRuleRequestsApi _priceRuleRequestsApi;
  final CategoryRequestsApi _categoryRequestsApi;
  final MaterialUploadApi _materialUploadApi;

  Future<List<MaterialCategory>> fetchMaterialCategories() {
    return _categoriesApi.fetchMaterialCategories();
  }

  Future<List<MaterialCategory>> fetchDiscoveryMaterialCategories() {
    return _categoriesApi.fetchMaterialCategories(discoveryOnly: true);
  }

  Future<MaterialTypeSearchResult> searchMaterialTypes({
    String? categoryId,
    String? query,
  }) {
    return _materialTypesApi.searchMaterialTypes(
      categoryId: categoryId,
      query: query,
    );
  }

  Future<MaterialListingPolicy> fetchListingPolicy() {
    return _listingPolicyApi.fetchListingPolicy();
  }

  Future<MaterialPriceCheckResult> checkPrice(
    MaterialPriceCheckRequest request,
  ) {
    return _priceCheckApi.checkPrice(request);
  }

  Future<PriceRuleRequestResult> createPriceRuleRequest(
    CreatePriceRuleRequest request,
  ) {
    return _priceRuleRequestsApi.createRequest(request);
  }

  Future<CreateCategoryRequestResult> createCategoryRequest(
    CreateCategoryRequestPayload payload,
  ) {
    return _categoryRequestsApi.createRequest(payload);
  }

  Future<List<CategoryRequestListItem>> fetchCategoryRequests() {
    return _categoryRequestsApi.listRequests();
  }

  Future<CategoryRequestDraftResponse> fetchCategoryRequestDraft(String id) {
    return _categoryRequestsApi.fetchDraft(id);
  }

  Future<PriceRuleRequestDraftResponse> fetchPriceRuleRequestDraft(String id) {
    return _priceRuleRequestsApi.fetchDraft(id);
  }

  Future<List<UploadedMaterialImage>> uploadMaterialImages(
    List<MaterialDraftImage> pendingImages,
  ) {
    return _materialUploadApi.uploadMaterialImages(pendingImages);
  }
}
