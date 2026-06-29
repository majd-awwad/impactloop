import 'discovery_material.dart';

class MaterialDiscoveryPagination {
  const MaterialDiscoveryPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory MaterialDiscoveryPagination.fromJson(Map<String, dynamic>? json) {
    if (json == null || json.isEmpty) {
      return const MaterialDiscoveryPagination(
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      );
    }

    final page = _intFromDynamic(json['page']) ?? 1;
    final limit = _intFromDynamic(json['limit']) ?? 20;
    final total = _intFromDynamic(json['total']) ?? 0;
    final totalPages =
        _intFromDynamic(json['totalPages']) ??
        (total == 0 ? 0 : ((total + limit - 1) / limit).ceil());

    return MaterialDiscoveryPagination(
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages,
    );
  }

  bool get hasMore => page < totalPages;
}

class MaterialDiscoveryResult {
  const MaterialDiscoveryResult({
    required this.items,
    required this.pagination,
  });

  final List<DiscoveryMaterial> items;
  final MaterialDiscoveryPagination pagination;
}

int? _intFromDynamic(Object? value) {
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
