class ProjectHelpSessionProjectOptionCreator {
  const ProjectHelpSessionProjectOptionCreator({
    required this.id,
    required this.displayName,
    this.avatarUrl,
  });

  final String id;
  final String displayName;
  final String? avatarUrl;

  factory ProjectHelpSessionProjectOptionCreator.fromJson(
    Map<String, dynamic> json,
  ) => ProjectHelpSessionProjectOptionCreator(
    id: json['id']?.toString() ?? '',
    displayName: json['displayName']?.toString() ?? '',
    avatarUrl: json['avatarUrl']?.toString(),
  );
}

class ProjectHelpSessionProjectOption {
  const ProjectHelpSessionProjectOption({
    required this.buildId,
    required this.projectId,
    required this.title,
    required this.creator,
    this.coverImageUrl,
    this.difficulty,
    this.estimatedDurationMinutes,
  });

  final String buildId;
  final String projectId;
  final String title;
  final String? coverImageUrl;
  final String? difficulty;
  final int? estimatedDurationMinutes;
  final ProjectHelpSessionProjectOptionCreator creator;

  factory ProjectHelpSessionProjectOption.fromJson(Map<String, dynamic> json) {
    final project =
        (json['project'] as Map?)?.cast<String, dynamic>() ?? const {};
    return ProjectHelpSessionProjectOption(
      buildId: json['buildId']?.toString() ?? '',
      projectId: project['id']?.toString() ?? '',
      title: project['title']?.toString() ?? '',
      coverImageUrl: project['coverImageUrl']?.toString(),
      difficulty: project['difficulty']?.toString(),
      estimatedDurationMinutes: (project['estimatedDurationMinutes'] as num?)
          ?.toInt(),
      creator: ProjectHelpSessionProjectOptionCreator.fromJson(
        (project['creator'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
  }
}

class ProjectHelpSessionProjectOptionsResult {
  const ProjectHelpSessionProjectOptionsResult({
    required this.items,
    required this.page,
    required this.total,
    required this.totalPages,
  });

  final List<ProjectHelpSessionProjectOption> items;
  final int page;
  final int total;
  final int totalPages;

  factory ProjectHelpSessionProjectOptionsResult.fromJson(
    Map<String, dynamic> json,
  ) {
    final pagination =
        (json['pagination'] as Map?)?.cast<String, dynamic>() ?? const {};
    return ProjectHelpSessionProjectOptionsResult(
      items:
          (json['items'] as List?)
              ?.whereType<Map>()
              .map(
                (item) => ProjectHelpSessionProjectOption.fromJson(
                  item.cast<String, dynamic>(),
                ),
              )
              .toList(growable: false) ??
          const [],
      page: (pagination['page'] as num?)?.toInt() ?? 1,
      total: (pagination['total'] as num?)?.toInt() ?? 0,
      totalPages: (pagination['totalPages'] as num?)?.toInt() ?? 1,
    );
  }
}

class ProjectHelpSessionAvailability {
  const ProjectHelpSessionAvailability({
    required this.available,
    this.reason,
    this.allowedDurations = const [],
    this.weeklyLimit,
    this.authorDisplayName,
    this.authorProfileImageUrl,
  });

  final bool available;
  final String? reason;
  final List<int> allowedDurations;
  final int? weeklyLimit;
  final String? authorDisplayName;
  final String? authorProfileImageUrl;

  factory ProjectHelpSessionAvailability.fromJson(Map<String, dynamic> json) {
    final durations = json['allowedDurations'];
    return ProjectHelpSessionAvailability(
      available: json['available'] == true,
      reason: json['reason']?.toString(),
      allowedDurations: durations is List
          ? durations.map((value) => (value as num).toInt()).toList()
          : const [],
      weeklyLimit: (json['weeklyLimit'] as num?)?.toInt(),
      authorDisplayName: json['authorDisplayName']?.toString(),
      authorProfileImageUrl: json['authorProfileImageUrl']?.toString(),
    );
  }
}

enum ProjectHelpSessionStatus {
  pending,
  alternativeProposed,
  zoomPending,
  schedulingFailed,
  scheduled,
  declined,
  cancelled,
  completed;

  static ProjectHelpSessionStatus? fromApi(String? value) {
    return switch (value) {
      'PENDING' => ProjectHelpSessionStatus.pending,
      'ALTERNATIVE_PROPOSED' => ProjectHelpSessionStatus.alternativeProposed,
      'ZOOM_PENDING' => ProjectHelpSessionStatus.zoomPending,
      'SCHEDULING_FAILED' => ProjectHelpSessionStatus.schedulingFailed,
      'SCHEDULED' => ProjectHelpSessionStatus.scheduled,
      'DECLINED' => ProjectHelpSessionStatus.declined,
      'CANCELLED' => ProjectHelpSessionStatus.cancelled,
      'COMPLETED' => ProjectHelpSessionStatus.completed,
      _ => null,
    };
  }

  String get apiValue => switch (this) {
    ProjectHelpSessionStatus.pending => 'PENDING',
    ProjectHelpSessionStatus.alternativeProposed => 'ALTERNATIVE_PROPOSED',
    ProjectHelpSessionStatus.zoomPending => 'ZOOM_PENDING',
    ProjectHelpSessionStatus.schedulingFailed => 'SCHEDULING_FAILED',
    ProjectHelpSessionStatus.scheduled => 'SCHEDULED',
    ProjectHelpSessionStatus.declined => 'DECLINED',
    ProjectHelpSessionStatus.cancelled => 'CANCELLED',
    ProjectHelpSessionStatus.completed => 'COMPLETED',
  };

  bool get isActive => switch (this) {
    ProjectHelpSessionStatus.pending ||
    ProjectHelpSessionStatus.alternativeProposed ||
    ProjectHelpSessionStatus.zoomPending ||
    ProjectHelpSessionStatus.schedulingFailed ||
    ProjectHelpSessionStatus.scheduled => true,
    _ => false,
  };
}

enum ProjectHelpSessionTimeOptionType { learnerProposed, authorAlternative }

enum ProjectHelpSessionCancelledByRole { learner, author }

ProjectHelpSessionCancelledByRole? projectHelpSessionCancelledByRoleFromApi(
  String? value,
) {
  return switch (value) {
    'LEARNER' => ProjectHelpSessionCancelledByRole.learner,
    'AUTHOR' => ProjectHelpSessionCancelledByRole.author,
    _ => null,
  };
}

class ProjectHelpSessionUserSummary {
  const ProjectHelpSessionUserSummary({
    required this.id,
    required this.displayName,
    this.profileImageUrl,
  });

  final String id;
  final String displayName;
  final String? profileImageUrl;

  factory ProjectHelpSessionUserSummary.fromJson(Map<String, dynamic> json) {
    return ProjectHelpSessionUserSummary(
      id: json['id']?.toString() ?? '',
      displayName: json['displayName']?.toString() ?? '',
      profileImageUrl: json['profileImageUrl']?.toString(),
    );
  }
}

class ProjectHelpSessionTimeOption {
  const ProjectHelpSessionTimeOption({
    required this.id,
    required this.type,
    required this.startsAt,
    required this.proposedBy,
  });

  final String id;
  final ProjectHelpSessionTimeOptionType type;
  final DateTime startsAt;
  final ProjectHelpSessionUserSummary proposedBy;

  factory ProjectHelpSessionTimeOption.fromJson(Map<String, dynamic> json) {
    final typeValue = json['type']?.toString();
    return ProjectHelpSessionTimeOption(
      id: json['id']?.toString() ?? '',
      type: typeValue == 'AUTHOR_ALTERNATIVE'
          ? ProjectHelpSessionTimeOptionType.authorAlternative
          : ProjectHelpSessionTimeOptionType.learnerProposed,
      startsAt:
          _parseDate(json['startsAt']) ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      proposedBy: ProjectHelpSessionUserSummary.fromJson(
        (json['proposedBy'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
  }
}

class ProjectHelpSessionLearnerAllowedActions {
  const ProjectHelpSessionLearnerAllowedActions({
    required this.canAcceptAlternative,
    required this.canRejectAlternative,
    required this.canCancel,
    required this.canJoin,
    this.canReportNoShow = false,
  });

  final bool canAcceptAlternative;
  final bool canRejectAlternative;
  final bool canCancel;
  final bool canJoin;
  final bool canReportNoShow;

  factory ProjectHelpSessionLearnerAllowedActions.fromJson(
    Map<String, dynamic> json,
  ) {
    return ProjectHelpSessionLearnerAllowedActions(
      canAcceptAlternative: json['canAcceptAlternative'] == true,
      canRejectAlternative: json['canRejectAlternative'] == true,
      canCancel: json['canCancel'] == true,
      canJoin: json['canJoin'] == true,
      canReportNoShow: json['canReportNoShow'] == true,
    );
  }

  static const empty = ProjectHelpSessionLearnerAllowedActions(
    canAcceptAlternative: false,
    canRejectAlternative: false,
    canCancel: false,
    canJoin: false,
    canReportNoShow: false,
  );
}

class ProjectHelpSessionAuthorAllowedActions {
  const ProjectHelpSessionAuthorAllowedActions({
    required this.canAcceptOption,
    required this.canProposeAlternative,
    required this.canDecline,
    required this.canCancel,
    required this.canJoin,
    this.canReportNoShow = false,
    required this.canRetryZoom,
    required this.canComplete,
  });

  final bool canAcceptOption;
  final bool canProposeAlternative;
  final bool canDecline;
  final bool canCancel;
  final bool canJoin;
  final bool canReportNoShow;
  final bool canRetryZoom;
  final bool canComplete;

  factory ProjectHelpSessionAuthorAllowedActions.fromJson(
    Map<String, dynamic> json,
  ) {
    return ProjectHelpSessionAuthorAllowedActions(
      canAcceptOption: json['canAcceptOption'] == true,
      canProposeAlternative: json['canProposeAlternative'] == true,
      canDecline: json['canDecline'] == true,
      canCancel: json['canCancel'] == true,
      canJoin: json['canJoin'] == true,
      canReportNoShow: json['canReportNoShow'] == true,
      canRetryZoom: json['canRetryZoom'] == true,
      canComplete: json['canComplete'] == true,
    );
  }

  static const empty = ProjectHelpSessionAuthorAllowedActions(
    canAcceptOption: false,
    canProposeAlternative: false,
    canDecline: false,
    canCancel: false,
    canJoin: false,
    canReportNoShow: false,
    canRetryZoom: false,
    canComplete: false,
  );
}

class ProjectHelpSessionSettings {
  const ProjectHelpSessionSettings({
    required this.projectId,
    required this.isEnabled,
    required this.allow15Minutes,
    required this.allow30Minutes,
    required this.weeklyLimit,
  });

  final String projectId;
  final bool isEnabled;
  final bool allow15Minutes;
  final bool allow30Minutes;
  final int weeklyLimit;

  factory ProjectHelpSessionSettings.fromJson(Map<String, dynamic> json) {
    return ProjectHelpSessionSettings(
      projectId: json['projectId']?.toString() ?? '',
      isEnabled: json['isEnabled'] == true,
      allow15Minutes: json['allow15Minutes'] == true,
      allow30Minutes: json['allow30Minutes'] == true,
      weeklyLimit: (json['weeklyLimit'] as num?)?.toInt() ?? 3,
    );
  }

  Map<String, dynamic> toJson() => {
    'isEnabled': isEnabled,
    'allow15Minutes': allow15Minutes,
    'allow30Minutes': allow30Minutes,
    'weeklyLimit': weeklyLimit,
  };

  ProjectHelpSessionSettings copyWith({
    bool? isEnabled,
    bool? allow15Minutes,
    bool? allow30Minutes,
    int? weeklyLimit,
  }) {
    return ProjectHelpSessionSettings(
      projectId: projectId,
      isEnabled: isEnabled ?? this.isEnabled,
      allow15Minutes: allow15Minutes ?? this.allow15Minutes,
      allow30Minutes: allow30Minutes ?? this.allow30Minutes,
      weeklyLimit: weeklyLimit ?? this.weeklyLimit,
    );
  }
}

class ProjectHelpSessionProjectSummary {
  const ProjectHelpSessionProjectSummary({
    required this.id,
    required this.title,
    this.coverImageUrl,
  });

  final String id;
  final String title;
  final String? coverImageUrl;

  factory ProjectHelpSessionProjectSummary.fromJson(Map<String, dynamic> json) {
    return ProjectHelpSessionProjectSummary(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      coverImageUrl: json['coverImageUrl']?.toString(),
    );
  }
}

class ProjectHelpSessionBuildSummary {
  const ProjectHelpSessionBuildSummary({
    required this.id,
    required this.attemptNumber,
  });

  final String id;
  final int attemptNumber;

  factory ProjectHelpSessionBuildSummary.fromJson(Map<String, dynamic> json) {
    return ProjectHelpSessionBuildSummary(
      id: json['id']?.toString() ?? '',
      attemptNumber: (json['attemptNumber'] as num?)?.toInt() ?? 1,
    );
  }
}

class ProjectHelpSessionStepSummary {
  const ProjectHelpSessionStepSummary({
    required this.id,
    required this.title,
    required this.stepNumber,
  });

  final String id;
  final String title;
  final int stepNumber;

  factory ProjectHelpSessionStepSummary.fromJson(Map<String, dynamic> json) {
    return ProjectHelpSessionStepSummary(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      stepNumber: (json['stepNumber'] as num?)?.toInt() ?? 0,
    );
  }
}

class ProjectHelpSession {
  const ProjectHelpSession({
    required this.id,
    required this.status,
    required this.project,
    required this.build,
    required this.learner,
    required this.author,
    required this.problemDescription,
    required this.durationMinutes,
    required this.learnerTimeZone,
    required this.timeOptions,
    required this.learnerAllowedActions,
    required this.authorAllowedActions,
    required this.createdAt,
    required this.updatedAt,
    this.projectStep,
    this.selectedTimeOptionId,
    this.selectedStartsAt,
    this.alternativeProposedAt,
    this.confirmedAt,
    this.declinedReason,
    this.declinedAt,
    this.cancelledById,
    this.cancelledByRole,
    this.cancellationReason,
    this.cancelledAt,
    this.completedAt,
    this.scheduledEndsAt,
    this.completionAvailableAt,
    this.autoFinalizeAt,
    this.autoFinalizationBlocked = false,
    required this.meetingReady,
    this.provider,
    this.joinAvailableAt,
    this.joinClosesAt,
    this.noShowReportedAt,
    this.zoomFailureState,
  });

  final String id;
  final ProjectHelpSessionStatus status;
  final ProjectHelpSessionProjectSummary project;
  final ProjectHelpSessionBuildSummary build;
  final ProjectHelpSessionUserSummary learner;
  final ProjectHelpSessionUserSummary author;
  final ProjectHelpSessionStepSummary? projectStep;
  final String problemDescription;
  final int durationMinutes;
  final String learnerTimeZone;
  final List<ProjectHelpSessionTimeOption> timeOptions;
  final String? selectedTimeOptionId;
  final DateTime? selectedStartsAt;
  final ProjectHelpSessionLearnerAllowedActions learnerAllowedActions;
  final ProjectHelpSessionAuthorAllowedActions authorAllowedActions;

  /// Learner detail pages use this alias.
  ProjectHelpSessionLearnerAllowedActions get allowedActions =>
      learnerAllowedActions;
  final DateTime? alternativeProposedAt;
  final DateTime? confirmedAt;
  final String? declinedReason;
  final DateTime? declinedAt;
  final String? cancelledById;
  final ProjectHelpSessionCancelledByRole? cancelledByRole;
  final String? cancellationReason;
  final DateTime? cancelledAt;
  final DateTime? completedAt;
  final DateTime? scheduledEndsAt;
  final DateTime? completionAvailableAt;
  final DateTime? autoFinalizeAt;
  final bool autoFinalizationBlocked;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool meetingReady;
  final String? provider;
  final DateTime? joinAvailableAt;
  final DateTime? joinClosesAt;
  final DateTime? noShowReportedAt;
  final String? zoomFailureState;

  factory ProjectHelpSession.fromJson(Map<String, dynamic> json) {
    final status =
        ProjectHelpSessionStatus.fromApi(json['status']?.toString()) ??
        ProjectHelpSessionStatus.pending;
    final options = json['timeOptions'];
    return ProjectHelpSession(
      id: json['id']?.toString() ?? '',
      status: status,
      project: ProjectHelpSessionProjectSummary.fromJson(
        (json['project'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
      build: ProjectHelpSessionBuildSummary.fromJson(
        (json['build'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
      learner: ProjectHelpSessionUserSummary.fromJson(
        (json['learner'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
      author: ProjectHelpSessionUserSummary.fromJson(
        (json['author'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
      projectStep: json['projectStep'] is Map
          ? ProjectHelpSessionStepSummary.fromJson(
              (json['projectStep'] as Map).cast<String, dynamic>(),
            )
          : null,
      problemDescription: json['problemDescription']?.toString() ?? '',
      durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 15,
      learnerTimeZone: json['learnerTimeZone']?.toString() ?? 'UTC',
      timeOptions: options is List
          ? options
                .whereType<Map>()
                .map(
                  (item) => ProjectHelpSessionTimeOption.fromJson(
                    item.cast<String, dynamic>(),
                  ),
                )
                .toList()
          : const [],
      selectedTimeOptionId: json['selectedTimeOptionId']?.toString(),
      selectedStartsAt: _parseDate(json['selectedStartsAt']),
      learnerAllowedActions: _parseLearnerAllowedActions(
        json['allowedActions'],
      ),
      authorAllowedActions: _parseAuthorAllowedActions(json['allowedActions']),
      alternativeProposedAt: _parseDate(json['alternativeProposedAt']),
      confirmedAt: _parseDate(json['confirmedAt']),
      declinedReason: json['declinedReason']?.toString(),
      declinedAt: _parseDate(json['declinedAt']),
      cancelledById: json['cancelledById']?.toString(),
      cancelledByRole: projectHelpSessionCancelledByRoleFromApi(
        json['cancelledByRole']?.toString(),
      ),
      cancellationReason: json['cancellationReason']?.toString(),
      cancelledAt: _parseDate(json['cancelledAt']),
      completedAt: _parseDate(json['completedAt']),
      scheduledEndsAt: _parseDate(json['scheduledEndsAt']),
      completionAvailableAt: _parseDate(json['completionAvailableAt']),
      autoFinalizeAt: _parseDate(json['autoFinalizeAt']),
      autoFinalizationBlocked: json['autoFinalizationBlocked'] == true,
      createdAt:
          _parseDate(json['createdAt']) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      updatedAt:
          _parseDate(json['updatedAt']) ??
          DateTime.fromMillisecondsSinceEpoch(0),
      meetingReady: json['meetingReady'] == true,
      provider: json['provider']?.toString(),
      joinAvailableAt: _parseDate(json['joinAvailableAt']),
      joinClosesAt: _parseDate(json['joinClosesAt']),
      noShowReportedAt: _parseDate(json['noShowReportedAt']),
      zoomFailureState: json['zoomFailureState']?.toString(),
    );
  }
}

ProjectHelpSessionLearnerAllowedActions effectiveLearnerAllowedActions(
  ProjectHelpSession session,
) {
  if (session.status == ProjectHelpSessionStatus.alternativeProposed &&
      !session.learnerAllowedActions.canAcceptAlternative) {
    return const ProjectHelpSessionLearnerAllowedActions(
      canAcceptAlternative: true,
      canRejectAlternative: true,
      canCancel: true,
      canJoin: false,
      canReportNoShow: false,
    );
  }
  return session.learnerAllowedActions;
}

ProjectHelpSessionAuthorAllowedActions effectiveAuthorAllowedActions(
  ProjectHelpSession session,
) {
  if (session.status == ProjectHelpSessionStatus.pending &&
      !session.authorAllowedActions.canAcceptOption) {
    final hasAuthorAlternative = session.timeOptions.any(
      (item) => item.type == ProjectHelpSessionTimeOptionType.authorAlternative,
    );
    return ProjectHelpSessionAuthorAllowedActions(
      canAcceptOption: true,
      canProposeAlternative: !hasAuthorAlternative,
      canDecline: true,
      canCancel: session.authorAllowedActions.canCancel,
      canJoin: session.authorAllowedActions.canJoin,
      canReportNoShow: session.authorAllowedActions.canReportNoShow,
      canRetryZoom: session.authorAllowedActions.canRetryZoom,
      canComplete: session.authorAllowedActions.canComplete,
    );
  }
  return session.authorAllowedActions;
}

class ProjectHelpSessionListResult {
  const ProjectHelpSessionListResult({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final List<ProjectHelpSession> items;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory ProjectHelpSessionListResult.fromJson(Map<String, dynamic> json) {
    final items = json['items'];
    final pagination =
        (json['pagination'] as Map?)?.cast<String, dynamic>() ?? const {};
    return ProjectHelpSessionListResult(
      items: items is List
          ? items
                .whereType<Map>()
                .map(
                  (item) =>
                      ProjectHelpSession.fromJson(item.cast<String, dynamic>()),
                )
                .toList()
          : const [],
      page: (pagination['page'] as num?)?.toInt() ?? 1,
      limit: (pagination['limit'] as num?)?.toInt() ?? 20,
      total: (pagination['total'] as num?)?.toInt() ?? 0,
      totalPages: (pagination['totalPages'] as num?)?.toInt() ?? 1,
    );
  }
}

class ProjectHelpSessionJoinResult {
  const ProjectHelpSessionJoinResult({
    required this.joinUrl,
    required this.startsAt,
    required this.durationMinutes,
  });

  final String joinUrl;
  final DateTime startsAt;
  final int durationMinutes;

  factory ProjectHelpSessionJoinResult.fromJson(Map<String, dynamic> json) {
    return ProjectHelpSessionJoinResult(
      joinUrl: json['joinUrl']?.toString() ?? '',
      startsAt: DateTime.parse(json['startsAt']?.toString() ?? ''),
      durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 15,
    );
  }
}

class CreateProjectHelpSessionRequestPayload {
  const CreateProjectHelpSessionRequestPayload({
    required this.problemDescription,
    required this.durationMinutes,
    required this.learnerTimeZone,
    required this.proposedTimes,
    this.projectStepId,
  });

  final String problemDescription;
  final int durationMinutes;
  final String learnerTimeZone;
  final List<DateTime> proposedTimes;
  final String? projectStepId;

  Map<String, dynamic> toJson() {
    final sorted = [...proposedTimes]..sort((a, b) => a.compareTo(b));
    return {
      'problemDescription': problemDescription,
      if (projectStepId != null) 'projectStepId': projectStepId,
      'durationMinutes': durationMinutes,
      'learnerTimeZone': learnerTimeZone,
      'proposedTimes': sorted
          .map((time) => time.toUtc().toIso8601String())
          .toList(),
    };
  }
}

class ProjectHelpSessionNotebookHandoff {
  const ProjectHelpSessionNotebookHandoff({
    required this.buildId,
    required this.pageId,
  });

  final String buildId;
  final String pageId;

  factory ProjectHelpSessionNotebookHandoff.fromJson(
    Map<String, dynamic> json,
  ) {
    return ProjectHelpSessionNotebookHandoff(
      buildId: json['buildId']?.toString() ?? '',
      pageId: json['pageId']?.toString() ?? '',
    );
  }
}

ProjectHelpSessionLearnerAllowedActions _parseLearnerAllowedActions(
  Object? raw,
) {
  if (raw is! Map) {
    return ProjectHelpSessionLearnerAllowedActions.empty;
  }
  final json = raw.cast<String, dynamic>();
  if (json.containsKey('canAcceptOption')) {
    return ProjectHelpSessionLearnerAllowedActions.empty;
  }
  return ProjectHelpSessionLearnerAllowedActions.fromJson(json);
}

ProjectHelpSessionAuthorAllowedActions _parseAuthorAllowedActions(Object? raw) {
  if (raw is! Map) {
    return ProjectHelpSessionAuthorAllowedActions.empty;
  }
  final json = raw.cast<String, dynamic>();
  if (!json.containsKey('canAcceptOption')) {
    return ProjectHelpSessionAuthorAllowedActions.empty;
  }
  return ProjectHelpSessionAuthorAllowedActions.fromJson(json);
}

DateTime? _parseDate(Object? value) {
  if (value == null) {
    return null;
  }
  final text = value.toString().trim();
  if (text.isEmpty) {
    return null;
  }
  return DateTime.tryParse(text);
}
