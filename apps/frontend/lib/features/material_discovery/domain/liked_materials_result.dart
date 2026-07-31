import 'discovery_material.dart';
import 'material_discovery_result.dart';

class LikedMaterialItem {
  const LikedMaterialItem({required this.likedAt, required this.material});

  final DateTime likedAt;
  final DiscoveryMaterial material;
}

class LikedMaterialsResult {
  const LikedMaterialsResult({required this.items, required this.pagination});

  final List<LikedMaterialItem> items;
  final MaterialDiscoveryPagination pagination;

  factory LikedMaterialsResult.fromJson(
    Map<String, dynamic> json, {
    required DiscoveryMaterial Function(Map<String, dynamic>) parseMaterial,
  }) {
    final rawItems = json['items'];
    final rawPagination = json['pagination'];
    if (rawItems is! List || rawPagination is! Map) {
      throw const FormatException('Invalid liked materials response');
    }

    final items = rawItems
        .map((rawItem) {
          if (rawItem is! Map) {
            throw const FormatException('Invalid liked material item');
          }
          final item = Map<String, dynamic>.from(rawItem);
          final likedAt = item['likedAt'];
          final material = item['material'];
          if (likedAt is! String || material is! Map) {
            throw const FormatException('Invalid liked material item');
          }

          return LikedMaterialItem(
            likedAt: DateTime.parse(likedAt).toUtc(),
            material: parseMaterial(Map<String, dynamic>.from(material)),
          );
        })
        .toList(growable: false);

    return LikedMaterialsResult(
      items: List<LikedMaterialItem>.unmodifiable(items),
      pagination: MaterialDiscoveryPagination.fromJson(
        Map<String, dynamic>.from(rawPagination),
      ),
    );
  }
}
