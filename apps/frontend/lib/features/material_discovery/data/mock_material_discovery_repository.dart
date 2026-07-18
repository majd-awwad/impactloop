import '../domain/discovery_material.dart';
import '../domain/material_engagement.dart';
import '../domain/material_discovery_query.dart';
import '../domain/material_discovery_repository.dart';
import '../domain/material_discovery_result.dart';
import 'mock_materials.dart';

class MockMaterialDiscoveryRepository implements MaterialDiscoveryRepository {
  const MockMaterialDiscoveryRepository();

  @override
  Future<MaterialDiscoveryResult> fetchMaterials(
    MaterialDiscoveryQuery query,
  ) async {
    final filtered = mockMaterials
        .where((material) {
          final q = query.q?.trim().toLowerCase();
          if (q != null && q.isNotEmpty) {
            final haystack = [
              material.title.en,
              material.description.en,
              material.category.en,
              material.locationLabel.en,
            ].join(' ').toLowerCase();
            if (!haystack.contains(q)) {
              return false;
            }
          }

          if (query.priceType == 'FREE' && !material.isFree) {
            return false;
          }

          if (query.priceType == 'PAID' && material.isFree) {
            return false;
          }

          if (query.deliveryAvailable == true && !material.deliveryAvailable) {
            return false;
          }

          if (query.pickupAllowed == true && !material.pickupAllowed) {
            return false;
          }

          return true;
        })
        .toList(growable: false);

    if (query.sort == 'popular') {
      filtered.sort((a, b) => b.viewsCount.compareTo(a.viewsCount));
    }

    final start = (query.page - 1) * query.limit;
    final pageItems = filtered
        .skip(start)
        .take(query.limit)
        .toList(growable: false);
    final total = filtered.length;
    final totalPages = total == 0
        ? 0
        : ((total + query.limit - 1) / query.limit).ceil();

    return MaterialDiscoveryResult(
      items: pageItems,
      pagination: MaterialDiscoveryPagination(
        page: query.page,
        limit: query.limit,
        total: total,
        totalPages: totalPages,
      ),
    );
  }

  @override
  Future<DiscoveryMaterial?> getMaterialById(
    String id, {
    String? recommendationImpressionId,
  }) async {
    return mockMaterialById(id);
  }

  @override
  Future<MaterialEngagement> likeMaterial(
    String id, {
    String? recommendationImpressionId,
  }) async {
    final material = mockMaterialById(id);

    return MaterialEngagement(
      materialId: id,
      likesCount: (material?.likesCount ?? 0) + 1,
      isLiked: true,
    );
  }

  @override
  Future<MaterialEngagement> unlikeMaterial(
    String id, {
    String? recommendationImpressionId,
  }) async {
    final material = mockMaterialById(id);

    return MaterialEngagement(
      materialId: id,
      likesCount: material?.likesCount ?? 0,
      isLiked: false,
    );
  }
}
