import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/models/supplier_material_request.dart';
import '../data/supplier_material_requests_api.dart';
import 'supplier_portal_session.dart';

final supplierMaterialRequestsApiProvider =
    Provider<SupplierMaterialRequestsApi>((ref) {
      return SupplierMaterialRequestsApi(ref.watch(apiClientProvider));
    });

class SupplierMaterialRequestsQuery {
  const SupplierMaterialRequestsQuery({
    this.categoryId,
    this.city,
    this.unansweredByMe = false,
    this.page = 1,
  });

  final String? categoryId;
  final String? city;
  final bool unansweredByMe;
  final int page;

  bool get hasActiveFilters =>
      categoryId != null ||
      (city?.trim().isNotEmpty ?? false) ||
      unansweredByMe;

  SupplierMaterialRequestsQuery copyWith({
    String? categoryId,
    bool clearCategoryId = false,
    String? city,
    bool clearCity = false,
    bool? unansweredByMe,
    int? page,
  }) {
    return SupplierMaterialRequestsQuery(
      categoryId: clearCategoryId ? null : categoryId ?? this.categoryId,
      city: clearCity ? null : city ?? this.city,
      unansweredByMe: unansweredByMe ?? this.unansweredByMe,
      page: page ?? this.page,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is SupplierMaterialRequestsQuery &&
        other.categoryId == categoryId &&
        other.city == city &&
        other.unansweredByMe == unansweredByMe &&
        other.page == page;
  }

  @override
  int get hashCode => Object.hash(categoryId, city, unansweredByMe, page);
}

class SupplierMaterialRequestsQueryNotifier
    extends Notifier<SupplierMaterialRequestsQuery> {
  @override
  SupplierMaterialRequestsQuery build() =>
      const SupplierMaterialRequestsQuery();

  void setCategory(String? categoryId) {
    state = state.copyWith(
      categoryId: categoryId,
      clearCategoryId: categoryId == null,
      page: 1,
    );
  }

  void setCity(String? city) {
    state = state.copyWith(city: city, clearCity: city == null, page: 1);
  }

  void setUnansweredByMe(bool value) {
    state = state.copyWith(unansweredByMe: value, page: 1);
  }

  void reset() => state = const SupplierMaterialRequestsQuery();
}

final supplierMaterialRequestsQueryProvider = NotifierProvider<
  SupplierMaterialRequestsQueryNotifier,
  SupplierMaterialRequestsQuery
>(SupplierMaterialRequestsQueryNotifier.new);

final supplierMaterialRequestsFeedProvider = FutureProvider.autoDispose<
  SupplierMaterialRequestListResult
>((ref) async {
  watchSupplierPortalSessionFromRef(ref);
  final query = ref.watch(supplierMaterialRequestsQueryProvider);
  return ref
      .read(supplierMaterialRequestsApiProvider)
      .fetchFeed(
        categoryId: query.categoryId,
        city: query.city,
        unansweredByMe: query.unansweredByMe ? true : null,
        page: query.page,
        limit: 20,
      );
});

/// Compact unanswered count for the supplier dashboard insights tile.
final supplierUnansweredMaterialRequestsCountProvider =
    FutureProvider.autoDispose<int>((ref) async {
      watchSupplierPortalSessionFromRef(ref);
      final result = await ref
          .read(supplierMaterialRequestsApiProvider)
          .fetchFeed(unansweredByMe: true, page: 1, limit: 1);
      return result.total;
    });

final supplierMaterialRequestDetailProvider = FutureProvider.autoDispose
    .family<SupplierMaterialRequest, String>((ref, id) async {
      watchSupplierPortalSessionFromRef(ref);
      return ref.read(supplierMaterialRequestsApiProvider).fetchRequest(id);
    });

final supplierMaterialRequestCandidatesProvider = FutureProvider.autoDispose
    .family<SupplierMaterialRequestCandidatesResult, String>((
      ref,
      id,
    ) async {
      watchSupplierPortalSessionFromRef(ref);
      return ref
          .read(supplierMaterialRequestsApiProvider)
          .fetchCandidateMaterials(id);
    });

void invalidateSupplierMaterialRequests(WidgetRef ref) {
  ref.invalidate(supplierMaterialRequestsFeedProvider);
  ref.invalidate(supplierUnansweredMaterialRequestsCountProvider);
}

Future<SupplierMaterialRequest> suggestSupplierMaterialForRequest(
  WidgetRef ref,
  String requestId, {
  required String materialId,
  bool confirmWeakMatch = false,
}) async {
  final updated = await ref
      .read(supplierMaterialRequestsApiProvider)
      .suggestMaterial(
        requestId,
        materialId: materialId,
        confirmWeakMatch: confirmWeakMatch,
      );
  ref.invalidate(supplierMaterialRequestDetailProvider(requestId));
  ref.invalidate(supplierMaterialRequestCandidatesProvider(requestId));
  invalidateSupplierMaterialRequests(ref);
  return updated;
}
