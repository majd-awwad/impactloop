enum ProjectMaterialCoverageLevel { full, most, some, none, unknown }

enum ComponentPublicAvailabilityStatus {
  available,
  partial,
  missing,
  unknown,
}

class ProjectMaterialCoverageSummary {
  const ProjectMaterialCoverageSummary({
    required this.totalRequiredComponents,
    required this.availableComponents,
    required this.partialComponents,
    required this.missingComponents,
    required this.unknownComponents,
    required this.availabilityRatio,
    required this.coverageLevel,
  });

  factory ProjectMaterialCoverageSummary.fromJson(Map<String, dynamic> json) {
    return ProjectMaterialCoverageSummary(
      totalRequiredComponents:
          _int(json['totalRequiredComponents']) ?? 0,
      availableComponents: _int(json['availableComponents']) ?? 0,
      partialComponents: _int(json['partialComponents']) ?? 0,
      missingComponents: _int(json['missingComponents']) ?? 0,
      unknownComponents: _int(json['unknownComponents']) ?? 0,
      availabilityRatio: _double(json['availabilityRatio']) ?? 0,
      coverageLevel: _coverageLevel(json['coverageLevel']),
    );
  }

  final int totalRequiredComponents;
  final int availableComponents;
  final int partialComponents;
  final int missingComponents;
  final int unknownComponents;
  final double availabilityRatio;
  final ProjectMaterialCoverageLevel coverageLevel;
}

class ProjectPersonalBuildReadiness {
  const ProjectPersonalBuildReadiness({
    required this.buildId,
    required this.buildStatus,
    required this.readyComponents,
    required this.totalRequiredComponents,
    required this.needsMaterialComponents,
    required this.readinessRatio,
  });

  factory ProjectPersonalBuildReadiness.fromJson(Map<String, dynamic> json) {
    return ProjectPersonalBuildReadiness(
      buildId: json['buildId'] as String? ?? '',
      buildStatus: json['buildStatus'] as String? ?? 'IN_PROGRESS',
      readyComponents: _int(json['readyComponents']) ?? 0,
      totalRequiredComponents: _int(json['totalRequiredComponents']) ?? 0,
      needsMaterialComponents: _int(json['needsMaterialComponents']) ?? 0,
      readinessRatio: _double(json['readinessRatio']) ?? 0,
    );
  }

  final String buildId;
  final String buildStatus;
  final int readyComponents;
  final int totalRequiredComponents;
  final int needsMaterialComponents;
  final double readinessRatio;

  bool get isInProgress => buildStatus == 'IN_PROGRESS';
}

class ProjectComponentCoverageItem {
  const ProjectComponentCoverageItem({
    required this.componentId,
    required this.componentName,
    required this.availabilityStatus,
  });

  factory ProjectComponentCoverageItem.fromJson(Map<String, dynamic> json) {
    return ProjectComponentCoverageItem(
      componentId: json['componentId'] as String? ?? '',
      componentName: json['componentName'] as String? ?? '',
      availabilityStatus: _availabilityStatus(json['publicAvailabilityStatus']) ??
          _availabilityStatus(json['availabilityStatus']),
    );
  }

  final String componentId;
  final String componentName;
  final ComponentPublicAvailabilityStatus? availabilityStatus;
}

ProjectMaterialCoverageLevel _coverageLevel(Object? raw) {
  switch ((raw as String?)?.toUpperCase()) {
    case 'FULL':
    case 'ALL':
      return ProjectMaterialCoverageLevel.full;
    case 'MOST':
      return ProjectMaterialCoverageLevel.most;
    case 'SOME':
      return ProjectMaterialCoverageLevel.some;
    case 'UNKNOWN':
      return ProjectMaterialCoverageLevel.unknown;
    case 'NONE':
    default:
      return ProjectMaterialCoverageLevel.none;
  }
}

ComponentPublicAvailabilityStatus? _availabilityStatus(Object? raw) {
  switch ((raw as String?)?.toUpperCase()) {
    case 'AVAILABLE':
      return ComponentPublicAvailabilityStatus.available;
    case 'PARTIAL':
      return ComponentPublicAvailabilityStatus.partial;
    case 'MISSING':
      return ComponentPublicAvailabilityStatus.missing;
    case 'UNKNOWN':
      return ComponentPublicAvailabilityStatus.unknown;
    default:
      return null;
  }
}

int? _int(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  return null;
}

double? _double(Object? value) {
  if (value is double) {
    return value;
  }
  if (value is num) {
    return value.toDouble();
  }
  return null;
}
