import '../domain/material_discovery_repository.dart';
import '../domain/mock_material.dart';
import 'mock_materials.dart';

class MockMaterialDiscoveryRepository implements MaterialDiscoveryRepository {
  const MockMaterialDiscoveryRepository();

  @override
  Future<List<MockMaterial>> getMaterials() async {
    return mockMaterials;
  }

  @override
  Future<MockMaterial?> getMaterialById(String id) async {
    return mockMaterialById(id);
  }
}
