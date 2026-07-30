import 'discovery_material.dart';
import 'material_engagement.dart';
import 'material_discovery_query.dart';
import 'material_discovery_result.dart';

abstract class MaterialDiscoveryRepository {
  Future<MaterialDiscoveryResult> fetchMaterials(MaterialDiscoveryQuery query);

  Future<DiscoveryMaterial?> getMaterialById(
    String id, {
    String? recommendationImpressionId,
  });

  Future<MaterialEngagement> likeMaterial(
    String id, {
    String? recommendationImpressionId,
  });

  Future<MaterialEngagement> unlikeMaterial(
    String id, {
    String? recommendationImpressionId,
  });

  Future<PublicSupplier?> fetchPublicSupplier(String supplierProfileId);

  Future<MaterialDiscoveryResult> fetchSupplierMaterials(
    String supplierProfileId,
    MaterialDiscoveryQuery query,
  );

  Future<SupplierFollowStatus> followSupplier(String supplierProfileId);

<<<<<<< Updated upstream
=======
  Future<MaterialEngagement> likeMaterial(String id);

  Future<MaterialEngagement> unlikeMaterial(String id);

  Future<PublicSupplier?> fetchPublicSupplier(String supplierProfileId);

  Future<MaterialDiscoveryResult> fetchSupplierMaterials(
    String supplierProfileId,
    MaterialDiscoveryQuery query,
  );

  Future<SupplierFollowStatus> followSupplier(String supplierProfileId);

>>>>>>> Stashed changes
  Future<SupplierFollowStatus> unfollowSupplier(String supplierProfileId);
}
