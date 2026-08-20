class AdminImpactAnalytics {
  const AdminImpactAnalytics({
    required this.verifiedImpact,
    required this.learningImpact,
    required this.reuseByCategory,
    required this.monthlyReuse,
    required this.environmentalEstimate,
  });

  final AdminVerifiedImpact verifiedImpact;
  final AdminLearningImpact learningImpact;
  final List<AdminReuseByCategory> reuseByCategory;
  final List<AdminMonthlyReuse> monthlyReuse;
  final AdminEnvironmentalEstimate environmentalEstimate;

  bool get hasLearningImpact =>
      learningImpact.componentsFulfilled > 0 ||
      learningImpact.buildsSupported > 0 ||
      learningImpact.projectsSupported > 0;

  factory AdminImpactAnalytics.fromJson(Map<String, dynamic> json) {
    return AdminImpactAnalytics(
      verifiedImpact: AdminVerifiedImpact.fromJson(
        json['verifiedImpact'] as Map<String, dynamic>? ?? const {},
      ),
      learningImpact: AdminLearningImpact.fromJson(
        json['learningImpact'] as Map<String, dynamic>? ?? const {},
      ),
      reuseByCategory: (json['reuseByCategory'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) =>
                AdminReuseByCategory.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      monthlyReuse: (json['monthlyReuse'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) =>
                AdminMonthlyReuse.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      environmentalEstimate: AdminEnvironmentalEstimate.fromJson(
        json['environmentalEstimate'] as Map<String, dynamic>? ?? const {},
      ),
    );
  }
}

class AdminVerifiedImpact {
  const AdminVerifiedImpact({
    required this.completedReuseEvents,
    required this.distinctMaterialsReused,
    required this.learnersBenefited,
    required this.suppliersContributed,
  });

  final int completedReuseEvents;
  final int distinctMaterialsReused;
  final int learnersBenefited;
  final int suppliersContributed;

  factory AdminVerifiedImpact.fromJson(Map<String, dynamic> json) {
    return AdminVerifiedImpact(
      completedReuseEvents:
          (json['completedReuseEvents'] as num?)?.toInt() ?? 0,
      distinctMaterialsReused:
          (json['distinctMaterialsReused'] as num?)?.toInt() ?? 0,
      learnersBenefited: (json['learnersBenefited'] as num?)?.toInt() ?? 0,
      suppliersContributed:
          (json['suppliersContributed'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminLearningImpact {
  const AdminLearningImpact({
    required this.componentsFulfilled,
    required this.buildsSupported,
    required this.projectsSupported,
  });

  final int componentsFulfilled;
  final int buildsSupported;
  final int projectsSupported;

  factory AdminLearningImpact.fromJson(Map<String, dynamic> json) {
    return AdminLearningImpact(
      componentsFulfilled: (json['componentsFulfilled'] as num?)?.toInt() ?? 0,
      buildsSupported: (json['buildsSupported'] as num?)?.toInt() ?? 0,
      projectsSupported: (json['projectsSupported'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminReuseByCategory {
  const AdminReuseByCategory({
    required this.nameEn,
    required this.nameAr,
    required this.completedReuseEvents,
  });

  final String nameEn;
  final String nameAr;
  final int completedReuseEvents;

  factory AdminReuseByCategory.fromJson(Map<String, dynamic> json) {
    return AdminReuseByCategory(
      nameEn: json['nameEn'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
      completedReuseEvents:
          (json['completedReuseEvents'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminMonthlyReuse {
  const AdminMonthlyReuse({
    required this.month,
    required this.completedReuseEvents,
  });

  final String month;
  final int completedReuseEvents;

  factory AdminMonthlyReuse.fromJson(Map<String, dynamic> json) {
    return AdminMonthlyReuse(
      month: json['month'] as String? ?? '',
      completedReuseEvents:
          (json['completedReuseEvents'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminEnvironmentalEstimate {
  const AdminEnvironmentalEstimate({
    required this.estimatedCo2eKg,
    required this.estimatedCo2eLabel,
    required this.isEstimate,
    required this.includedReuseEvents,
    required this.totalCompletedReuseEvents,
    required this.coveragePercent,
    required this.methodologyVersion,
    required this.unavailableReason,
  });

  final double? estimatedCo2eKg;
  final String? estimatedCo2eLabel;
  final bool isEstimate;
  final int includedReuseEvents;
  final int totalCompletedReuseEvents;
  final int coveragePercent;
  final String methodologyVersion;
  final String? unavailableReason;

  bool get isAvailable => estimatedCo2eKg != null && includedReuseEvents > 0;

  factory AdminEnvironmentalEstimate.fromJson(Map<String, dynamic> json) {
    return AdminEnvironmentalEstimate(
      estimatedCo2eKg: (json['estimatedCo2eKg'] as num?)?.toDouble(),
      estimatedCo2eLabel: json['estimatedCo2eLabel'] as String?,
      isEstimate: json['isEstimate'] as bool? ?? true,
      includedReuseEvents: (json['includedReuseEvents'] as num?)?.toInt() ?? 0,
      totalCompletedReuseEvents:
          (json['totalCompletedReuseEvents'] as num?)?.toInt() ?? 0,
      coveragePercent: (json['coveragePercent'] as num?)?.toInt() ?? 0,
      methodologyVersion: json['methodologyVersion'] as String? ?? '',
      unavailableReason: json['unavailableReason'] as String?,
    );
  }
}
