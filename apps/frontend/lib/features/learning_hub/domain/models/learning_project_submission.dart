import '../../../../shared/models/localized_text.dart';
import 'learning_project_draft_component.dart';

enum LearningProjectSubmissionStatus {
  draft('DRAFT'),
  pendingReview('PENDING_REVIEW'),
  published('PUBLISHED'),
  changesRequested('CHANGES_REQUESTED'),
  rejected('REJECTED'),
  hidden('HIDDEN'),
  archived('ARCHIVED');

  const LearningProjectSubmissionStatus(this.apiValue);

  final String apiValue;

  static LearningProjectSubmissionStatus fromApiValue(String value) {
    return switch (value.trim().toUpperCase()) {
      'DRAFT' => draft,
      'PUBLISHED' => published,
      'CHANGES_REQUESTED' => changesRequested,
      'REJECTED' => rejected,
      'HIDDEN' => hidden,
      'ARCHIVED' => archived,
      _ => pendingReview,
    };
  }

  String label() {
    return switch (this) {
      draft => 'Draft',
      pendingReview => 'Pending review',
      published => 'Published',
      changesRequested => 'Changes requested',
      rejected => 'Rejected',
      hidden => 'Hidden',
      archived => 'Archived',
    };
  }
}

class LearningProjectSubmissionActions {
  const LearningProjectSubmissionActions({
    required this.canView,
    required this.canEdit,
    required this.canResubmit,
    required this.canViewPublic,
  });

  final bool canView;
  final bool canEdit;
  final bool canResubmit;
  final bool canViewPublic;

  factory LearningProjectSubmissionActions.fromJson(Object? raw) {
    final json = raw is Map ? Map<String, dynamic>.from(raw) : const {};
    return LearningProjectSubmissionActions(
      canView: json['canView'] != false,
      canEdit: json['canEdit'] == true,
      canResubmit: json['canResubmit'] == true,
      canViewPublic: json['canViewPublic'] == true,
    );
  }
}

class LearningProjectSubmission {
  const LearningProjectSubmission({
    required this.id,
    required this.title,
    required this.shortDescription,
    required this.status,
    required this.category,
    required this.difficulty,
    required this.availableActions,
    this.description,
    this.estimatedDurationMinutes,
    this.coverImageUrl,
    this.submittedAt,
    this.reviewedAt,
    this.createdAt,
    this.updatedAt,
    this.reviewNote,
    this.changesRequestedReason,
    this.rejectionReason,
    this.publicProjectPath,
    this.requiredComponents = const [],
    this.steps = const [],
    this.links = const [],
  });

  final String id;
  final String title;
  final String shortDescription;
  final String? description;
  final LearningProjectSubmissionStatus status;
  final LocalizedText category;
  final String difficulty;
  final int? estimatedDurationMinutes;
  final String? coverImageUrl;
  final DateTime? submittedAt;
  final DateTime? reviewedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final String? reviewNote;
  final String? changesRequestedReason;
  final String? rejectionReason;
  final String? publicProjectPath;
  final LearningProjectSubmissionActions availableActions;
  final List<LearningProjectSubmissionComponent> requiredComponents;
  final List<LearningProjectSubmissionStep> steps;
  final List<LearningProjectSubmissionLink> links;

  String? get activeFeedback {
    if (status == LearningProjectSubmissionStatus.changesRequested) {
      return changesRequestedReason ?? reviewNote;
    }
    if (status == LearningProjectSubmissionStatus.rejected) {
      return rejectionReason ?? reviewNote;
    }
    return reviewNote;
  }

  String get statusDatePrefix {
    return switch (status) {
      LearningProjectSubmissionStatus.pendingReview => 'Submitted',
      LearningProjectSubmissionStatus.changesRequested => 'Reviewed',
      LearningProjectSubmissionStatus.rejected => 'Reviewed',
      LearningProjectSubmissionStatus.published => 'Published',
      _ => 'Updated',
    };
  }

  DateTime? get statusDate {
    return switch (status) {
      LearningProjectSubmissionStatus.pendingReview => submittedAt,
      LearningProjectSubmissionStatus.changesRequested =>
        reviewedAt ?? submittedAt,
      LearningProjectSubmissionStatus.rejected => reviewedAt ?? submittedAt,
      LearningProjectSubmissionStatus.published => reviewedAt ?? submittedAt,
      _ => reviewedAt ?? submittedAt ?? updatedAt,
    };
  }
}

class LearningProjectSubmissionComponent {
  const LearningProjectSubmissionComponent({
    required this.id,
    required this.name,
    required this.quantity,
    required this.unit,
    required this.role,
    required this.isRequired,
    required this.canBeSubstituted,
    this.materialCategoryId,
    this.materialType,
    this.searchKeywords = const [],
    this.notes,
  });

  final String id;
  final String name;
  final double quantity;
  final String unit;
  final LearningProjectComponentRole role;
  final bool isRequired;
  final bool canBeSubstituted;
  final String? materialCategoryId;
  final String? materialType;
  final List<String> searchKeywords;
  final String? notes;

  LearningProjectDraftComponent toDraftComponent() {
    return LearningProjectDraftComponent(
      name: name,
      quantity: quantity,
      unit: unit,
      role: role,
      materialCategoryId: materialCategoryId,
      materialTypeHint: materialType ?? '',
      keywords: searchKeywords,
      canBeSubstituted: canBeSubstituted,
      notes: notes ?? '',
      showAdvanced:
          materialCategoryId != null ||
          (materialType?.trim().isNotEmpty ?? false) ||
          searchKeywords.isNotEmpty ||
          canBeSubstituted ||
          (notes?.trim().isNotEmpty ?? false),
    );
  }
}

class LearningProjectSubmissionStep {
  const LearningProjectSubmissionStep({
    required this.title,
    required this.description,
    this.id,
    this.stepNumber,
  });

  final String? id;
  final int? stepNumber;
  final String title;
  final String description;
}

class LearningProjectSubmissionLink {
  const LearningProjectSubmissionLink({required this.url, this.id, this.title});

  final String? id;
  final String url;
  final String? title;
}

class LearningProjectSubmissionsResult {
  const LearningProjectSubmissionsResult({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final List<LearningProjectSubmission> items;
  final int page;
  final int limit;
  final int total;
  final int totalPages;
}

class LearningProjectAuthoringSession {
  const LearningProjectAuthoringSession({
    required this.learningProjectId,
    required this.conversationId,
    required this.status,
    required this.mode,
    required this.title,
    required this.updatedAt,
  });

  final String learningProjectId;
  final String conversationId;
  final String status;
  final String mode;
  final String title;
  final DateTime updatedAt;

  bool get isTrustedDraftAuthoring =>
      status == 'DRAFT' && mode == 'PROJECT_AUTHORING';
}

class LearningProjectSubmissionsQuery {
  const LearningProjectSubmissionsQuery({
    this.page = 1,
    this.limit = 20,
    this.status,
  });

  final int page;
  final int limit;
  final LearningProjectSubmissionStatus? status;

  @override
  bool operator ==(Object other) {
    return other is LearningProjectSubmissionsQuery &&
        other.page == page &&
        other.limit == limit &&
        other.status == status;
  }

  @override
  int get hashCode => Object.hash(page, limit, status);
}
