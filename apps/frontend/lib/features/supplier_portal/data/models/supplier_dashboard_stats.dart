class SupplierMaterialStats {
  const SupplierMaterialStats({
    required this.total,
    required this.available,
    required this.pendingReservation,
    required this.reserved,
    required this.reused,
    required this.unavailable,
  });

  final int total;
  final int available;
  final int pendingReservation;
  final int reserved;
  final int reused;
  final int unavailable;

  factory SupplierMaterialStats.fromJson(Map<String, dynamic> json) {
    return SupplierMaterialStats(
      total: json['total'] as int? ?? 0,
      available: json['available'] as int? ?? 0,
      pendingReservation: json['pendingReservation'] as int? ?? 0,
      reserved: json['reserved'] as int? ?? 0,
      reused: json['reused'] as int? ?? 0,
      unavailable: json['unavailable'] as int? ?? 0,
    );
  }
}

class SupplierReservationStats {
  const SupplierReservationStats({
    required this.pending,
    required this.accepted,
    required this.completed,
    required this.rejected,
    required this.cancelled,
    required this.expired,
  });

  final int pending;
  final int accepted;
  final int completed;
  final int rejected;
  final int cancelled;
  final int expired;

  factory SupplierReservationStats.fromJson(Map<String, dynamic> json) {
    return SupplierReservationStats(
      pending: json['pending'] as int? ?? 0,
      accepted: json['accepted'] as int? ?? 0,
      completed: json['completed'] as int? ?? 0,
      rejected: json['rejected'] as int? ?? 0,
      cancelled: json['cancelled'] as int? ?? 0,
      expired: json['expired'] as int? ?? 0,
    );
  }
}

class SupplierImpactStats {
  const SupplierImpactStats({
    required this.reusedMaterials,
    required this.reusedQuantity,
  });

  final int reusedMaterials;
  final double reusedQuantity;

  factory SupplierImpactStats.fromJson(Map<String, dynamic> json) {
    return SupplierImpactStats(
      reusedMaterials: json['reusedMaterials'] as int? ?? 0,
      reusedQuantity: (json['reusedQuantity'] as num?)?.toDouble() ?? 0,
    );
  }
}

class SupplierReviewStats {
  const SupplierReviewStats({
    required this.averageRating,
    required this.totalReviews,
  });

  final double averageRating;
  final int totalReviews;

  factory SupplierReviewStats.fromJson(Map<String, dynamic> json) {
    return SupplierReviewStats(
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0,
      totalReviews: json['totalReviews'] as int? ?? 0,
    );
  }
}

class SupplierNotificationStats {
  const SupplierNotificationStats({required this.unread});

  final int unread;

  factory SupplierNotificationStats.fromJson(Map<String, dynamic> json) {
    return SupplierNotificationStats(unread: json['unread'] as int? ?? 0);
  }
}

class SupplierDashboardStats {
  const SupplierDashboardStats({
    required this.materials,
    required this.reservations,
    required this.impact,
    required this.reviews,
    required this.notifications,
  });

  final SupplierMaterialStats materials;
  final SupplierReservationStats reservations;
  final SupplierImpactStats impact;
  final SupplierReviewStats reviews;
  final SupplierNotificationStats notifications;

  factory SupplierDashboardStats.fromJson(Map<String, dynamic> json) {
    return SupplierDashboardStats(
      materials: SupplierMaterialStats.fromJson(
        json['materials'] as Map<String, dynamic>? ?? const {},
      ),
      reservations: SupplierReservationStats.fromJson(
        json['reservations'] as Map<String, dynamic>? ?? const {},
      ),
      impact: SupplierImpactStats.fromJson(
        json['impact'] as Map<String, dynamic>? ?? const {},
      ),
      reviews: SupplierReviewStats.fromJson(
        json['reviews'] as Map<String, dynamic>? ?? const {},
      ),
      notifications: SupplierNotificationStats.fromJson(
        json['notifications'] as Map<String, dynamic>? ?? const {},
      ),
    );
  }
}
