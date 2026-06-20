import 'discovery_material.dart';

abstract class MaterialDiscoveryRepository {
  Future<List<DiscoveryMaterial>> getMaterials();

  Future<DiscoveryMaterial?> getMaterialById(String id);
}
