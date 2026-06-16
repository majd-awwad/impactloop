import '../domain/material_discovery_repository.dart';
import '../domain/discovery_material.dart';
import 'mock_materials.dart';

class MockMaterialDiscoveryRepository implements MaterialDiscoveryRepository {
  const MockMaterialDiscoveryRepository();

  @override
  Future<List<DiscoveryMaterial>> getMaterials() async {
    return mockMaterials;
  }

  @override
  Future<DiscoveryMaterial?> getMaterialById(String id) async {
    return mockMaterialById(id);
  }
}
