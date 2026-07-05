class MaterialEngagement {
  const MaterialEngagement({
    required this.materialId,
    required this.likesCount,
    required this.isLiked,
  });

  final String materialId;
  final int likesCount;
  final bool isLiked;

  factory MaterialEngagement.fromJson(Map<String, dynamic> json) {
    return MaterialEngagement(
      materialId: _stringOrFallback(json['materialId']),
      likesCount: _intFromDynamic(json['likesCount']) ?? 0,
      isLiked: json['isLiked'] == true,
    );
  }

  static String _stringOrFallback(Object? value) {
    final normalized = value?.toString().trim();
    return normalized == null || normalized.isEmpty ? '' : normalized;
  }

  static int? _intFromDynamic(Object? value) {
    if (value == null) {
      return null;
    }

    if (value is int) {
      return value;
    }

    if (value is num) {
      return value.toInt();
    }

    return int.tryParse(value.toString());
  }
}
