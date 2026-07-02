class AdminDashboardResponse {
  const AdminDashboardResponse({
    required this.summary,
    required this.pendingActions,
    required this.impact,
    required this.materialsByCategory,
    required this.reservationStatusBreakdown,
    required this.recentInvitations,
    required this.supplierVerificationPendingCount,
    required this.supplierVerificationPreview,
    required this.recentActivity,
  });

  final AdminDashboardSummary summary;
  final AdminPendingActions pendingActions;
  final AdminImpactSnapshot impact;
  final List<AdminCategoryCount> materialsByCategory;
  final List<AdminStatusCount> reservationStatusBreakdown;
  final List<AdminInvitationPreview> recentInvitations;
  final int supplierVerificationPendingCount;
  final List<AdminSupplierVerificationPreview> supplierVerificationPreview;
  final List<AdminActivityPreview> recentActivity;

  factory AdminDashboardResponse.fromJson(Map<String, dynamic> json) {
    return AdminDashboardResponse(
      summary: AdminDashboardSummary.fromJson(
        json['summary'] as Map<String, dynamic>? ?? const {},
      ),
      pendingActions: AdminPendingActions.fromJson(
        json['pendingActions'] as Map<String, dynamic>? ?? const {},
      ),
      impact: AdminImpactSnapshot.fromJson(
        json['impact'] as Map<String, dynamic>? ?? const {},
      ),
      materialsByCategory:
          (json['materialsByCategory'] as List<dynamic>? ?? const [])
              .whereType<Map>()
              .map((item) => AdminCategoryCount.fromJson(
                    Map<String, dynamic>.from(item),
                  ))
              .toList(),
      reservationStatusBreakdown:
          (json['reservationStatusBreakdown'] as List<dynamic>? ?? const [])
              .whereType<Map>()
              .map((item) => AdminStatusCount.fromJson(
                    Map<String, dynamic>.from(item),
                  ))
              .toList(),
      recentInvitations:
          (json['recentInvitations'] as List<dynamic>? ?? const [])
              .whereType<Map>()
              .map((item) => AdminInvitationPreview.fromJson(
                    Map<String, dynamic>.from(item),
                  ))
              .toList(),
      supplierVerificationPendingCount:
          (json['supplierVerificationPendingCount'] as num?)?.toInt() ??
              (json['pendingActions']?['supplierVerifications'] as num?)?.toInt() ??
              0,
      supplierVerificationPreview:
          (json['supplierVerificationPreview'] as List<dynamic>? ?? const [])
              .whereType<Map>()
              .map((item) => AdminSupplierVerificationPreview.fromJson(
                    Map<String, dynamic>.from(item),
                  ))
              .toList(),
      recentActivity:
          (json['recentActivity'] as List<dynamic>? ?? const [])
              .whereType<Map>()
              .map((item) => AdminActivityPreview.fromJson(
                    Map<String, dynamic>.from(item),
                  ))
              .toList(),
    );
  }
}

class AdminDashboardSummary {
  const AdminDashboardSummary({
    required this.totalUsers,
    required this.totalSuppliers,
    required this.totalMaterials,
    required this.availableMaterials,
    required this.pendingApprovals,
    required this.activeInvitations,
    required this.completedReuse,
    required this.activeDrivers,
  });

  final int totalUsers;
  final int totalSuppliers;
  final int totalMaterials;
  final int availableMaterials;
  final int pendingApprovals;
  final int activeInvitations;
  final int completedReuse;
  final int activeDrivers;

  factory AdminDashboardSummary.fromJson(Map<String, dynamic> json) {
    return AdminDashboardSummary(
      totalUsers: (json['totalUsers'] as num?)?.toInt() ?? 0,
      totalSuppliers: (json['totalSuppliers'] as num?)?.toInt() ?? 0,
      totalMaterials: (json['totalMaterials'] as num?)?.toInt() ?? 0,
      availableMaterials: (json['availableMaterials'] as num?)?.toInt() ?? 0,
      pendingApprovals: (json['pendingApprovals'] as num?)?.toInt() ?? 0,
      activeInvitations: (json['activeInvitations'] as num?)?.toInt() ?? 0,
      completedReuse: (json['completedReuse'] as num?)?.toInt() ?? 0,
      activeDrivers: (json['activeDrivers'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminPendingActions {
  const AdminPendingActions({
    required this.supplierVerifications,
    required this.categoryRequests,
    required this.priceRequests,
    required this.reports,
  });

  final int supplierVerifications;
  final int categoryRequests;
  final int priceRequests;
  final int reports;

  factory AdminPendingActions.fromJson(Map<String, dynamic> json) {
    return AdminPendingActions(
      supplierVerifications: (json['supplierVerifications'] as num?)?.toInt() ?? 0,
      categoryRequests: (json['categoryRequests'] as num?)?.toInt() ?? 0,
      priceRequests: (json['priceRequests'] as num?)?.toInt() ?? 0,
      reports: (json['reports'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminImpactSnapshot {
  const AdminImpactSnapshot({
    required this.reusedMaterials,
    required this.completedReservations,
    required this.learnersBenefited,
    required this.suppliersContributed,
    required this.topCategory,
    required this.reuseByMonth,
    required this.estimatedCo2Kg,
    required this.estimatedCo2Label,
    required this.estimatedCo2Method,
    required this.reuseCompletionRate,
    required this.co2ReuseProgress,
  });

  final int reusedMaterials;
  final int completedReservations;
  final int learnersBenefited;
  final int suppliersContributed;
  final AdminTopCategory? topCategory;
  final List<AdminMonthCount> reuseByMonth;
  final double estimatedCo2Kg;
  final String estimatedCo2Label;
  final String estimatedCo2Method;
  final double reuseCompletionRate;
  final double co2ReuseProgress;

  factory AdminImpactSnapshot.fromJson(Map<String, dynamic> json) {
    final rawTop = json['topCategory'];
    return AdminImpactSnapshot(
      reusedMaterials: (json['reusedMaterials'] as num?)?.toInt() ?? 0,
      completedReservations: (json['completedReservations'] as num?)?.toInt() ?? 0,
      learnersBenefited: (json['learnersBenefited'] as num?)?.toInt() ?? 0,
      suppliersContributed: (json['suppliersContributed'] as num?)?.toInt() ?? 0,
      topCategory: rawTop is Map<String, dynamic>
          ? AdminTopCategory.fromJson(rawTop)
          : null,
      reuseByMonth: (json['reuseByMonth'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map((item) => AdminMonthCount.fromJson(
                Map<String, dynamic>.from(item),
              ))
          .toList(),
      estimatedCo2Kg: (json['estimatedCo2Kg'] as num?)?.toDouble() ?? 0,
      estimatedCo2Label:
          json['estimatedCo2Label'] as String? ?? '0 kg CO₂e',
      estimatedCo2Method: json['estimatedCo2Method'] as String? ?? '',
      reuseCompletionRate:
          (json['reuseCompletionRate'] as num?)?.toDouble() ?? 0,
      co2ReuseProgress:
          (json['co2ReuseProgress'] as num?)?.toDouble() ?? 0,
    );
  }
}

class AdminTopCategory {
  const AdminTopCategory({
    required this.id,
    required this.nameEn,
    required this.nameAr,
    required this.reusedCount,
  });

  final String id;
  final String nameEn;
  final String nameAr;
  final int reusedCount;

  factory AdminTopCategory.fromJson(Map<String, dynamic> json) {
    return AdminTopCategory(
      id: json['id'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
      reusedCount: (json['reusedCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminMonthCount {
  const AdminMonthCount({required this.month, required this.count});

  final String month; // YYYY-MM
  final int count;

  factory AdminMonthCount.fromJson(Map<String, dynamic> json) {
    return AdminMonthCount(
      month: json['month'] as String? ?? '',
      count: (json['count'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminCategoryCount {
  const AdminCategoryCount({
    required this.id,
    required this.nameEn,
    required this.nameAr,
    required this.count,
  });

  final String id;
  final String nameEn;
  final String nameAr;
  final int count;

  factory AdminCategoryCount.fromJson(Map<String, dynamic> json) {
    return AdminCategoryCount(
      id: json['id'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
      count: (json['count'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminStatusCount {
  const AdminStatusCount({required this.status, required this.count});

  final String status;
  final int count;

  factory AdminStatusCount.fromJson(Map<String, dynamic> json) {
    return AdminStatusCount(
      status: (json['status'] as String? ?? '').toUpperCase(),
      count: (json['count'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminInvitationPreview {
  const AdminInvitationPreview({
    required this.id,
    required this.targetEmail,
    required this.targetRole,
    required this.status,
    required this.expiresAt,
    required this.createdAt,
  });

  final String id;
  final String? targetEmail;
  final String targetRole;
  final String status;
  final String expiresAt;
  final String createdAt;

  factory AdminInvitationPreview.fromJson(Map<String, dynamic> json) {
    return AdminInvitationPreview(
      id: json['id'] as String? ?? '',
      targetEmail: json['targetEmail'] as String?,
      targetRole: (json['targetRole'] as String? ?? '').toUpperCase(),
      status: (json['status'] as String? ?? '').toUpperCase(),
      expiresAt: json['expiresAt'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

class AdminSupplierVerificationPreview {
  const AdminSupplierVerificationPreview({
    required this.supplierProfileId,
    required this.ownerName,
    required this.organizationName,
    required this.supplierType,
    required this.verificationStatus,
    required this.submittedAt,
  });

  final String supplierProfileId;
  final String ownerName;
  final String organizationName;
  final String supplierType;
  final String verificationStatus;
  final String? submittedAt;

  factory AdminSupplierVerificationPreview.fromJson(Map<String, dynamic> json) {
    return AdminSupplierVerificationPreview(
      supplierProfileId: json['supplierProfileId'] as String? ?? '',
      ownerName: json['ownerName'] as String? ?? '',
      organizationName: json['organizationName'] as String? ?? '',
      supplierType: json['supplierType'] as String? ?? '',
      verificationStatus:
          (json['verificationStatus'] as String? ?? '').toUpperCase(),
      submittedAt: json['submittedAt'] as String?,
    );
  }
}

class AdminActivityPreview {
  const AdminActivityPreview({
    required this.id,
    required this.action,
    required this.actionLabel,
    required this.actorName,
    required this.actorEmail,
    required this.targetLabel,
    required this.createdAt,
  });

  final String id;
  final String action;
  final String actionLabel;
  final String actorName;
  final String actorEmail;
  final String targetLabel;
  final String createdAt;

  factory AdminActivityPreview.fromJson(Map<String, dynamic> json) {
    return AdminActivityPreview(
      id: json['id'] as String? ?? '',
      action: json['action'] as String? ?? '',
      actionLabel: json['actionLabel'] as String? ?? '',
      actorName: json['actorName'] as String? ?? '',
      actorEmail: json['actorEmail'] as String? ?? '',
      targetLabel: json['targetLabel'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

