enum SupplierCategoryDemandLevel {
  high,
  moderate,
  emerging,
  unknown;

  static SupplierCategoryDemandLevel parse(String? raw) {
    switch (raw) {
      case 'HIGH':
        return SupplierCategoryDemandLevel.high;
      case 'MODERATE':
        return SupplierCategoryDemandLevel.moderate;
      case 'EMERGING':
        return SupplierCategoryDemandLevel.emerging;
      default:
        return SupplierCategoryDemandLevel.unknown;
    }
  }

  String get apiValue => switch (this) {
    SupplierCategoryDemandLevel.high => 'HIGH',
    SupplierCategoryDemandLevel.moderate => 'MODERATE',
    SupplierCategoryDemandLevel.emerging => 'EMERGING',
    SupplierCategoryDemandLevel.unknown => 'UNKNOWN',
  };
}

enum SupplierCategoryDemandReason {
  strongReservationActivity,
  balancedEngagement,
  likeEngagement,
  viewEngagement,
  limitedRecentActivity,
  unknown;

  static SupplierCategoryDemandReason parse(String? raw) {
    switch (raw) {
      case 'STRONG_RESERVATION_ACTIVITY':
        return SupplierCategoryDemandReason.strongReservationActivity;
      case 'BALANCED_ENGAGEMENT':
        return SupplierCategoryDemandReason.balancedEngagement;
      case 'LIKE_ENGAGEMENT':
        return SupplierCategoryDemandReason.likeEngagement;
      case 'VIEW_ENGAGEMENT':
        return SupplierCategoryDemandReason.viewEngagement;
      case 'LIMITED_RECENT_ACTIVITY':
        return SupplierCategoryDemandReason.limitedRecentActivity;
      default:
        return SupplierCategoryDemandReason.unknown;
    }
  }

  String get apiValue => switch (this) {
    SupplierCategoryDemandReason.strongReservationActivity =>
      'STRONG_RESERVATION_ACTIVITY',
    SupplierCategoryDemandReason.balancedEngagement => 'BALANCED_ENGAGEMENT',
    SupplierCategoryDemandReason.likeEngagement => 'LIKE_ENGAGEMENT',
    SupplierCategoryDemandReason.viewEngagement => 'VIEW_ENGAGEMENT',
    SupplierCategoryDemandReason.limitedRecentActivity =>
      'LIMITED_RECENT_ACTIVITY',
    SupplierCategoryDemandReason.unknown => 'UNKNOWN',
  };
}

enum SupplierCategoryDemandEmptyReason {
  noRecentActivity,
  noActiveCategories,
  none;

  static SupplierCategoryDemandEmptyReason parse(String? raw) {
    switch (raw) {
      case 'NO_RECENT_ACTIVITY':
        return SupplierCategoryDemandEmptyReason.noRecentActivity;
      case 'NO_ACTIVE_CATEGORIES':
        return SupplierCategoryDemandEmptyReason.noActiveCategories;
      default:
        return SupplierCategoryDemandEmptyReason.none;
    }
  }
}

class SupplierCategoryDemandPeriod {
  const SupplierCategoryDemandPeriod({
    required this.days,
    required this.from,
    required this.to,
  });

  final int days;
  final String from;
  final String to;

  factory SupplierCategoryDemandPeriod.fromJson(Map<String, dynamic> json) {
    return SupplierCategoryDemandPeriod(
      days: (json['days'] as num?)?.toInt() ?? 30,
      from: json['from'] as String? ?? '',
      to: json['to'] as String? ?? '',
    );
  }
}

class SupplierCategoryDemandSignals {
  const SupplierCategoryDemandSignals({
    required this.views,
    required this.likes,
    required this.reservations,
  });

  final int views;
  final int likes;
  final int reservations;

  factory SupplierCategoryDemandSignals.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const SupplierCategoryDemandSignals(
        views: 0,
        likes: 0,
        reservations: 0,
      );
    }
    return SupplierCategoryDemandSignals(
      views: (json['views'] as num?)?.toInt() ?? 0,
      likes: (json['likes'] as num?)?.toInt() ?? 0,
      reservations: (json['reservations'] as num?)?.toInt() ?? 0,
    );
  }
}

class SupplierCategoryDemandItem {
  const SupplierCategoryDemandItem({
    required this.categoryId,
    required this.categoryNameEn,
    required this.categoryNameAr,
    required this.demandLevel,
    required this.score,
    required this.signals,
    required this.primaryReason,
  });

  final String categoryId;
  final String categoryNameEn;
  final String categoryNameAr;
  final SupplierCategoryDemandLevel demandLevel;
  final int score;
  final SupplierCategoryDemandSignals signals;
  final SupplierCategoryDemandReason primaryReason;

  String localizedName(String languageCode) {
    final preferAr = languageCode.toLowerCase().startsWith('ar');
    final primary = preferAr ? categoryNameAr.trim() : categoryNameEn.trim();
    if (primary.isNotEmpty) return primary;
    final fallback = preferAr ? categoryNameEn.trim() : categoryNameAr.trim();
    return fallback.isNotEmpty ? fallback : categoryId;
  }

  factory SupplierCategoryDemandItem.fromJson(Map<String, dynamic> json) {
    return SupplierCategoryDemandItem(
      categoryId: json['categoryId'] as String? ?? '',
      categoryNameEn: json['categoryNameEn'] as String? ?? '',
      categoryNameAr: json['categoryNameAr'] as String? ?? '',
      demandLevel: SupplierCategoryDemandLevel.parse(
        json['demandLevel'] as String?,
      ),
      score: (json['score'] as num?)?.toInt() ?? 0,
      signals: SupplierCategoryDemandSignals.fromJson(
        json['signals'] as Map<String, dynamic>?,
      ),
      primaryReason: SupplierCategoryDemandReason.parse(
        json['primaryReason'] as String?,
      ),
    );
  }
}

class SupplierCategoryDemandResult {
  const SupplierCategoryDemandResult({
    required this.period,
    required this.methodologyVersion,
    required this.source,
    required this.summaryTopCategoryIds,
    required this.items,
    required this.emptyStateReason,
  });

  final SupplierCategoryDemandPeriod period;
  final String methodologyVersion;
  final String source;
  final List<String> summaryTopCategoryIds;
  final List<SupplierCategoryDemandItem> items;
  final SupplierCategoryDemandEmptyReason emptyStateReason;

  List<SupplierCategoryDemandItem> get summaryCategories {
    final byId = {for (final item in items) item.categoryId: item};
    final ordered = <SupplierCategoryDemandItem>[];
    for (final id in summaryTopCategoryIds) {
      final item = byId[id];
      if (item != null) ordered.add(item);
      if (ordered.length >= 3) break;
    }
    if (ordered.isNotEmpty) return ordered;
    return items.take(3).toList(growable: false);
  }

  factory SupplierCategoryDemandResult.fromJson(Map<String, dynamic> json) {
    final methodology = json['methodology'];
    final methodologyMap = methodology is Map<String, dynamic>
        ? methodology
        : const <String, dynamic>{};
    final itemsJson = json['items'];
    final summaryJson = json['summaryTopCategoryIds'];

    return SupplierCategoryDemandResult(
      period: SupplierCategoryDemandPeriod.fromJson(
        json['period'] is Map<String, dynamic>
            ? json['period'] as Map<String, dynamic>
            : const <String, dynamic>{},
      ),
      methodologyVersion:
          methodologyMap['version'] as String? ?? 'category-demand-v1',
      source:
          methodologyMap['source'] as String? ?? 'PLATFORM_LEARNER_ACTIVITY',
      summaryTopCategoryIds: summaryJson is List
          ? summaryJson.whereType<String>().toList(growable: false)
          : const [],
      items: itemsJson is List
          ? itemsJson
                .whereType<Map<String, dynamic>>()
                .map(SupplierCategoryDemandItem.fromJson)
                .toList(growable: false)
          : const [],
      emptyStateReason: SupplierCategoryDemandEmptyReason.parse(
        json['emptyStateReason'] as String?,
      ),
    );
  }
}
