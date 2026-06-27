enum SupplierActionNotificationGroup { reviewUpdate, reservationAlert }

enum SupplierActionNotificationKind {
  categoryApproved,
  categorySuggestion,
  categoryRejected,
  categoryPending,
  categoryCompleted,
  priceApproved,
  priceRejected,
  pricePending,
  priceCompleted,
  reservationPending,
}

enum SupplierActionNotificationStatus { pending, approved, rejected }

enum SupplierActionNotificationActionType {
  continueListing,
  editListing,
  editPrice,
  reviewRequest,
}

enum SupplierNotificationFilter { all, actionNeeded, reservations, completed }

extension SupplierNotificationFilterLabels on SupplierNotificationFilter {
  String get label {
    switch (this) {
      case SupplierNotificationFilter.all:
        return 'All';
      case SupplierNotificationFilter.actionNeeded:
        return 'Action needed';
      case SupplierNotificationFilter.reservations:
        return 'Reservations';
      case SupplierNotificationFilter.completed:
        return 'Completed';
    }
  }
}

class SupplierNotificationsSummary {
  const SupplierNotificationsSummary({
    required this.totalCount,
    required this.actionNeededCount,
    required this.reviewCount,
    required this.reservationCount,
    required this.completedCount,
  });

  final int totalCount;
  final int actionNeededCount;
  final int reviewCount;
  final int reservationCount;
  final int completedCount;

  factory SupplierNotificationsSummary.fromJson(Map<String, dynamic> json) {
    return SupplierNotificationsSummary(
      totalCount: json['totalCount'] as int? ?? 0,
      actionNeededCount: json['actionNeededCount'] as int? ?? 0,
      reviewCount: json['reviewCount'] as int? ?? 0,
      reservationCount: json['reservationCount'] as int? ?? 0,
      completedCount: json['completedCount'] as int? ?? 0,
    );
  }
}

class SupplierNotificationsResult {
  const SupplierNotificationsResult({
    required this.notifications,
    required this.summary,
  });

  final List<SupplierActionNotification> notifications;
  final SupplierNotificationsSummary summary;
}

class SupplierActionNotification {
  const SupplierActionNotification({
    required this.id,
    required this.group,
    required this.kind,
    required this.title,
    required this.body,
    required this.status,
    required this.createdAt,
    required this.actionNeeded,
    required this.isCompleted,
    this.actionLabel,
    this.actionType,
    this.categoryRequestId,
    this.priceRuleRequestId,
    this.reservationId,
    this.publishedMaterialId,
    this.approvedCategoryId,
    this.approvedCategoryName,
    this.maxAllowedUnitPriceNis,
    this.unit,
    this.supplierRequestedUnitPriceNis,
  });

  final String id;
  final SupplierActionNotificationGroup group;
  final SupplierActionNotificationKind kind;
  final String title;
  final String body;
  final SupplierActionNotificationStatus status;
  final DateTime createdAt;
  final bool actionNeeded;
  final bool isCompleted;
  final String? actionLabel;
  final SupplierActionNotificationActionType? actionType;
  final String? categoryRequestId;
  final String? priceRuleRequestId;
  final String? reservationId;
  final String? publishedMaterialId;
  final String? approvedCategoryId;
  final String? approvedCategoryName;
  final double? maxAllowedUnitPriceNis;
  final String? unit;
  final double? supplierRequestedUnitPriceNis;

  factory SupplierActionNotification.fromJson(Map<String, dynamic> json) {
    return SupplierActionNotification(
      id: json['id'] as String? ?? '',
      group: _parseGroup(json['group'] as String?),
      kind: _parseKind(json['kind'] as String?),
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      status: _parseStatus(json['status'] as String?),
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      actionNeeded: json['actionNeeded'] == true,
      isCompleted: json['isCompleted'] == true,
      actionLabel: json['actionLabel'] as String?,
      actionType: _parseActionType(json['actionType'] as String?),
      categoryRequestId: json['categoryRequestId'] as String?,
      priceRuleRequestId: json['priceRuleRequestId'] as String?,
      reservationId: json['reservationId'] as String?,
      publishedMaterialId: json['publishedMaterialId'] as String?,
      approvedCategoryId: json['approvedCategoryId'] as String?,
      approvedCategoryName: json['approvedCategoryName'] as String?,
      maxAllowedUnitPriceNis: (json['maxAllowedUnitPriceNis'] as num?)
          ?.toDouble(),
      unit: json['unit'] as String?,
      supplierRequestedUnitPriceNis:
          (json['supplierRequestedUnitPriceNis'] as num?)?.toDouble(),
    );
  }

  static SupplierActionNotificationGroup _parseGroup(String? value) {
    return switch (value) {
      'RESERVATION_ALERT' => SupplierActionNotificationGroup.reservationAlert,
      _ => SupplierActionNotificationGroup.reviewUpdate,
    };
  }

  static SupplierActionNotificationKind _parseKind(String? value) {
    return switch (value) {
      'CATEGORY_SUGGESTION' =>
        SupplierActionNotificationKind.categorySuggestion,
      'CATEGORY_REJECTED' => SupplierActionNotificationKind.categoryRejected,
      'CATEGORY_PENDING' => SupplierActionNotificationKind.categoryPending,
      'CATEGORY_COMPLETED' => SupplierActionNotificationKind.categoryCompleted,
      'PRICE_APPROVED' => SupplierActionNotificationKind.priceApproved,
      'PRICE_REJECTED' => SupplierActionNotificationKind.priceRejected,
      'PRICE_PENDING' => SupplierActionNotificationKind.pricePending,
      'PRICE_COMPLETED' => SupplierActionNotificationKind.priceCompleted,
      'RESERVATION_PENDING' =>
        SupplierActionNotificationKind.reservationPending,
      _ => SupplierActionNotificationKind.categoryApproved,
    };
  }

  static SupplierActionNotificationStatus _parseStatus(String? value) {
    return switch (value) {
      'APPROVED' => SupplierActionNotificationStatus.approved,
      'REJECTED' => SupplierActionNotificationStatus.rejected,
      _ => SupplierActionNotificationStatus.pending,
    };
  }

  static SupplierActionNotificationActionType? _parseActionType(String? value) {
    return switch (value) {
      'CONTINUE_LISTING' =>
        SupplierActionNotificationActionType.continueListing,
      'EDIT_LISTING' => SupplierActionNotificationActionType.editListing,
      'EDIT_PRICE' => SupplierActionNotificationActionType.editPrice,
      'REVIEW_REQUEST' => SupplierActionNotificationActionType.reviewRequest,
      _ => null,
    };
  }
}

bool matchesSupplierNotificationFilter(
  SupplierActionNotification notification,
  SupplierNotificationFilter filter,
) {
  switch (filter) {
    case SupplierNotificationFilter.all:
      return true;
    case SupplierNotificationFilter.actionNeeded:
      return notification.actionNeeded;
    case SupplierNotificationFilter.reservations:
      return notification.group ==
          SupplierActionNotificationGroup.reservationAlert;
    case SupplierNotificationFilter.completed:
      return notification.isCompleted;
  }
}
