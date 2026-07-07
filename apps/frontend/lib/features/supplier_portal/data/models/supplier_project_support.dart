class SupplierLatestSupportedProject {
  const SupplierLatestSupportedProject({
    required this.projectId,
    required this.title,
    this.categoryName,
    required this.completedAt,
  });

  final String projectId;
  final String title;
  final String? categoryName;
  final DateTime completedAt;

  factory SupplierLatestSupportedProject.fromJson(Map<String, dynamic> json) {
    return SupplierLatestSupportedProject(
      projectId: json['projectId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      categoryName: json['categoryName'] as String?,
      completedAt:
          DateTime.tryParse(json['completedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

class SupplierProjectSupport {
  const SupplierProjectSupport({
    required this.projectsSupported,
    required this.projectComponentsSupported,
    required this.learnerBuildsHelped,
    required this.completedLinkedReservations,
    required this.latestSupportedProjects,
  });

  final int projectsSupported;
  final int projectComponentsSupported;
  final int learnerBuildsHelped;
  final int completedLinkedReservations;
  final List<SupplierLatestSupportedProject> latestSupportedProjects;

  bool get hasImpact =>
      projectsSupported > 0 ||
      projectComponentsSupported > 0 ||
      learnerBuildsHelped > 0;

  factory SupplierProjectSupport.fromJson(Map<String, dynamic> json) {
    final latest = json['latestSupportedProjects'];

    return SupplierProjectSupport(
      projectsSupported: json['projectsSupported'] as int? ?? 0,
      projectComponentsSupported:
          json['projectComponentsSupported'] as int? ?? 0,
      learnerBuildsHelped: json['learnerBuildsHelped'] as int? ?? 0,
      completedLinkedReservations:
          json['completedLinkedReservations'] as int? ?? 0,
      latestSupportedProjects: latest is List
          ? latest
                .whereType<Map>()
                .map(
                  (item) => SupplierLatestSupportedProject.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
    );
  }

  factory SupplierProjectSupport.empty() {
    return const SupplierProjectSupport(
      projectsSupported: 0,
      projectComponentsSupported: 0,
      learnerBuildsHelped: 0,
      completedLinkedReservations: 0,
      latestSupportedProjects: [],
    );
  }
}
