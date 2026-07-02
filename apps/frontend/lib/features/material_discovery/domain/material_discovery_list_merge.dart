import 'discovery_material.dart';

List<DiscoveryMaterial> mergeDiscoveryMaterials({
  required bool reset,
  required List<DiscoveryMaterial> current,
  required List<DiscoveryMaterial> incoming,
}) {
  if (reset) {
    return List<DiscoveryMaterial>.from(incoming);
  }

  if (incoming.isEmpty) {
    return current;
  }

  final seen = current.map((material) => material.id).toSet();
  final merged = List<DiscoveryMaterial>.from(current);

  for (final material in incoming) {
    if (seen.add(material.id)) {
      merged.add(material);
    }
  }

  return merged;
}

bool shouldApplyDiscoveryFetchResult({
  required int requestGeneration,
  required int latestGeneration,
}) {
  return requestGeneration == latestGeneration;
}
