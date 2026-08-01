import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'models/supplier_my_materials_models.dart';
import 'models/supplier_related_projects.dart';
import 'supplier_my_materials_api.dart';

final supplierMyMaterialsApiProvider = Provider<SupplierMyMaterialsApi>((ref) {
  return SupplierMyMaterialsApi(ref.watch(apiClientProvider));
});

final supplierMyMaterialsRepositoryProvider =
    Provider<SupplierMyMaterialsRepository>((ref) {
      return SupplierMyMaterialsRepository(
        ref.watch(supplierMyMaterialsApiProvider),
      );
    });

class SupplierMyMaterialsRepository {
  const SupplierMyMaterialsRepository(this._api);

  final SupplierMyMaterialsApi _api;

  Future<SupplierMyMaterialsListResult> listMaterials(
    SupplierMyMaterialsQuery query,
  ) {
    return _api.listMaterials(query);
  }

  Future<SupplierMyMaterial> getMaterial(String materialId) {
    return _api.getMaterial(materialId);
  }

  Future<SupplierRelatedProjectsResult> getRelatedProjects(
    String materialId, {
    int limit = 6,
  }) {
    return _api.getRelatedProjects(materialId, limit: limit);
  }

  Future<SupplierMyMaterial> updateMaterial(
    String materialId,
    UpdateSupplierMyMaterialRequest request,
  ) {
    return _api.updateMaterial(materialId, request);
  }

  Future<void> deleteMaterial(String materialId) {
    return _api.deleteMaterial(materialId);
  }

  Future<SupplierMyMaterial> markMaterialUnavailable(String materialId) {
    return _api.markMaterialUnavailable(materialId);
  }

  Future<SupplierMyMaterial> restoreMaterialAvailable(String materialId) {
    return _api.restoreMaterialAvailable(materialId);
  }
}
