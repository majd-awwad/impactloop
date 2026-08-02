class LearnerProfileSummary {
  const LearnerProfileSummary({
    required this.profileCompletion,
    required this.journey,
    required this.continueProject,
  });

  final LearnerProfileCompletionSummary profileCompletion;
  final LearnerJourneySummary journey;
  final LearnerContinueProjectSummary? continueProject;

  factory LearnerProfileSummary.fromJson(Map<String, dynamic> json) {
    final completionJson = _requiredMap(json, 'profileCompletion');
    final journeyJson = _requiredMap(json, 'journey');
    final continueProjectJson = json['continueProject'];
    if (continueProjectJson != null && continueProjectJson is! Map) {
      throw const FormatException('Invalid continueProject in profile summary');
    }

    return LearnerProfileSummary(
      profileCompletion: LearnerProfileCompletionSummary.fromJson(
        completionJson,
      ),
      journey: LearnerJourneySummary.fromJson(journeyJson),
      continueProject: continueProjectJson == null
          ? null
          : LearnerContinueProjectSummary.fromJson(
              Map<String, dynamic>.from(continueProjectJson),
            ),
    );
  }
}

class LearnerProfileCompletionSummary {
  const LearnerProfileCompletionSummary({
    required this.completedSteps,
    required this.totalSteps,
    required this.percentage,
    required this.missingSteps,
  });

  final int completedSteps;
  final int totalSteps;
  final int percentage;
  final List<String> missingSteps;

  factory LearnerProfileCompletionSummary.fromJson(Map<String, dynamic> json) {
    final missingSteps = json['missingSteps'];
    if (missingSteps is! List || missingSteps.any((step) => step is! String)) {
      throw const FormatException('Invalid missingSteps in profile summary');
    }

    return LearnerProfileCompletionSummary(
      completedSteps: _requiredInt(json, 'completedSteps'),
      totalSteps: _requiredInt(json, 'totalSteps'),
      percentage: _requiredInt(json, 'percentage'),
      missingSteps: List<String>.unmodifiable(missingSteps.cast<String>()),
    );
  }
}

class LearnerJourneySummary {
  const LearnerJourneySummary({
    required this.activeReservationsCount,
    required this.completedReservationsCount,
    required this.likedMaterialsCount,
    required this.savedProjectsCount,
    required this.followedProjectsCount,
    required this.activeBuildsCount,
    required this.completedBuildsCount,
  });

  final int activeReservationsCount;
  final int completedReservationsCount;
  final int likedMaterialsCount;
  final int savedProjectsCount;
  final int followedProjectsCount;
  final int activeBuildsCount;
  final int completedBuildsCount;

  factory LearnerJourneySummary.fromJson(Map<String, dynamic> json) {
    return LearnerJourneySummary(
      activeReservationsCount: _requiredInt(json, 'activeReservationsCount'),
      completedReservationsCount: _requiredInt(
        json,
        'completedReservationsCount',
      ),
      likedMaterialsCount: _requiredInt(json, 'likedMaterialsCount'),
      savedProjectsCount: _requiredInt(json, 'savedProjectsCount'),
      followedProjectsCount: _requiredInt(json, 'followedProjectsCount'),
      activeBuildsCount: _requiredInt(json, 'activeBuildsCount'),
      completedBuildsCount: _requiredInt(json, 'completedBuildsCount'),
    );
  }
}

class LearnerContinueProjectSummary {
  const LearnerContinueProjectSummary({
    required this.projectId,
    required this.buildId,
    required this.title,
    required this.imageUrl,
    required this.lastActivityAt,
    required this.progress,
  });

  final String projectId;
  final String buildId;
  final String title;
  final String? imageUrl;
  final DateTime lastActivityAt;
  final LearnerBuildProgressSummary progress;

  factory LearnerContinueProjectSummary.fromJson(Map<String, dynamic> json) {
    final imageUrl = json['imageUrl'];
    if (imageUrl != null && imageUrl is! String) {
      throw const FormatException('Invalid imageUrl in profile summary');
    }

    return LearnerContinueProjectSummary(
      projectId: _requiredString(json, 'projectId'),
      buildId: _requiredString(json, 'buildId'),
      title: _requiredString(json, 'title'),
      imageUrl: imageUrl as String?,
      lastActivityAt: DateTime.parse(
        _requiredString(json, 'lastActivityAt'),
      ).toUtc(),
      progress: LearnerBuildProgressSummary.fromJson(
        _requiredMap(json, 'progress'),
      ),
    );
  }
}

class LearnerBuildProgressSummary {
  const LearnerBuildProgressSummary({
    required this.completedSteps,
    required this.totalSteps,
    required this.percentage,
  });

  final int completedSteps;
  final int totalSteps;
  final int percentage;

  factory LearnerBuildProgressSummary.fromJson(Map<String, dynamic> json) {
    return LearnerBuildProgressSummary(
      completedSteps: _requiredInt(json, 'completedSteps'),
      totalSteps: _requiredInt(json, 'totalSteps'),
      percentage: _requiredInt(json, 'percentage'),
    );
  }
}

Map<String, dynamic> _requiredMap(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! Map) {
    throw FormatException('Missing or invalid $key in profile summary');
  }
  return Map<String, dynamic>.from(value);
}

int _requiredInt(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! num || value.toInt() != value) {
    throw FormatException('Missing or invalid $key in profile summary');
  }
  return value.toInt();
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String) {
    throw FormatException('Missing or invalid $key in profile summary');
  }
  return value;
}
