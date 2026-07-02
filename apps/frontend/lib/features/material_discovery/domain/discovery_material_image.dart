class DiscoveryMaterialImage {
  const DiscoveryMaterialImage({
    required this.id,
    required this.url,
    this.isCover = false,
    this.isPrimary = false,
    this.sortOrder = 0,
  });

  final String id;
  final String url;
  final bool isCover;
  final bool isPrimary;
  final int sortOrder;
}
