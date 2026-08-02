import 'liked_materials_result.dart';
import 'material_engagement.dart';

abstract class LikedMaterialsRepository {
  Future<LikedMaterialsResult> fetchLikedMaterials({
    required int page,
    int limit = 20,
  });

  Future<MaterialEngagement> unlikeMaterial(
    String id, {
    String? recommendationImpressionId,
  });
}
