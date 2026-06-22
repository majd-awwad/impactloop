import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../materials/data/models/create_material_request.dart';
import '../../materials/data/models/created_material.dart';
import 'supplier_materials_api.dart';

final supplierMaterialsApiProvider = Provider<SupplierMaterialsApi>((ref) {
  return SupplierMaterialsApi(ref.watch(apiClientProvider));
});

final supplierMaterialsRepositoryProvider =
    Provider<SupplierMaterialsRepository>((ref) {
      return SupplierMaterialsRepository(
        ref.watch(supplierMaterialsApiProvider),
      );
    });

class SupplierMaterialsRepository {
  const SupplierMaterialsRepository(this._api);

  final SupplierMaterialsApi _api;

  Future<CreatedMaterial> createMaterial(CreateMaterialRequest request) {
    return _api.createMaterial(request);
  }
}
