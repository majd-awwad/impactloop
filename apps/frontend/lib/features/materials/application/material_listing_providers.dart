import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/material_listing_repository.dart';
import '../data/models/category_request.dart';
import '../data/models/material_draft_image.dart';
import '../data/models/material_listing_policy.dart';
import '../data/models/material_price_check_request.dart';
import '../data/models/material_price_check_result.dart';
import '../data/models/material_type.dart';
import '../data/models/price_rule_request.dart';

final materialCategoriesProvider = FutureProvider((ref) {
  return ref.watch(materialListingRepositoryProvider).fetchMaterialCategories();
});

final materialListingPolicyProvider = FutureProvider<MaterialListingPolicy>((ref) {
  return ref.watch(materialListingRepositoryProvider).fetchListingPolicy();
});

final categoryRequestsProvider = FutureProvider((ref) {
  return ref.watch(materialListingRepositoryProvider).fetchCategoryRequests();
});

final materialTypesSearchProvider = FutureProvider.family<
    MaterialTypeSearchResult,
    MaterialTypesSearchQuery>((ref, query) {
  return ref.watch(materialListingRepositoryProvider).searchMaterialTypes(
        categoryId: query.categoryId,
        query: query.search,
      );
});

class MaterialTypesSearchQuery {
  const MaterialTypesSearchQuery({this.categoryId, this.search});

  final String? categoryId;
  final String? search;

  @override
  bool operator ==(Object other) {
    return other is MaterialTypesSearchQuery &&
        other.categoryId == categoryId &&
        other.search == search;
  }

  @override
  int get hashCode => Object.hash(categoryId, search);
}

Future<MaterialPriceCheckResult> checkMaterialPrice(
  WidgetRef ref,
  MaterialPriceCheckRequest request,
) {
  return ref.read(materialListingRepositoryProvider).checkPrice(request);
}

Future<PriceRuleRequestResult> submitPriceReview(
  WidgetRef ref,
  CreatePriceRuleRequest request,
) {
  return ref.read(materialListingRepositoryProvider).createPriceRuleRequest(request);
}

Future<CreateCategoryRequestResult> submitCategoryRequest(
  WidgetRef ref,
  CreateCategoryRequestPayload payload,
) {
  return ref.read(materialListingRepositoryProvider).createCategoryRequest(payload);
}

Future<CategoryRequestDraftResponse> loadCategoryRequestDraft(
  WidgetRef ref,
  String id,
) {
  return ref.read(materialListingRepositoryProvider).fetchCategoryRequestDraft(id);
}

Future<List<UploadedMaterialImage>> uploadMaterialImages(
  WidgetRef ref,
  List<MaterialDraftImage> pendingImages,
) {
  return ref
      .read(materialListingRepositoryProvider)
      .uploadMaterialImages(pendingImages);
}
