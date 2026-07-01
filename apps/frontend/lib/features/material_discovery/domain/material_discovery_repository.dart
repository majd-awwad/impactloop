import 'discovery_material.dart';
import 'material_discovery_query.dart';
import 'material_discovery_result.dart';

abstract class MaterialDiscoveryRepository {
  Future<MaterialDiscoveryResult> fetchMaterials(
    MaterialDiscoveryQuery query,
  );

  Future<DiscoveryMaterial?> getMaterialById(String id);
}
