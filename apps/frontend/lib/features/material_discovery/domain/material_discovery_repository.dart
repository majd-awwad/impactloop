import 'mock_material.dart';

abstract class MaterialDiscoveryRepository {
  Future<List<MockMaterial>> getMaterials();

  Future<MockMaterial?> getMaterialById(String id);
}
