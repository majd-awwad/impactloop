import '../../material_discovery/domain/discovery_material.dart';
import '../../learning_hub/domain/models/learning_project.dart';

class LearnerHomeProfileCompletion {
  const LearnerHomeProfileCompletion({
    required this.hasInterests,
    required this.hasSavedLocation,
    required this.hasSavedProjects,
    required this.hasActivity,
  });

  final bool hasInterests;
  final bool hasSavedLocation;
  final bool hasSavedProjects;
  final bool hasActivity;

  factory LearnerHomeProfileCompletion.fromJson(Map<String, dynamic>? json) {
    return LearnerHomeProfileCompletion(
      hasInterests: json?['hasInterests'] == true,
      hasSavedLocation: json?['hasSavedLocation'] == true,
      hasSavedProjects: json?['hasSavedProjects'] == true,
      hasActivity: json?['hasActivity'] == true,
    );
  }
}

enum LearnerHomeSectionKey {
  suggestedMaterials('suggested_materials'),
  materialsForSavedProjects('materials_for_saved_projects'),
  suggestedProjects('suggested_projects'),
  continueProjects('continue_projects'),
  savedProjects('saved_projects'),
  freeMaterialsNearYou('free_materials_near_you'),
  popularProjects('popular_projects');

  const LearnerHomeSectionKey(this.apiValue);

  final String apiValue;

  static LearnerHomeSectionKey? fromApiValue(String? value) {
    if (value == null) {
      return null;
    }

    for (final key in LearnerHomeSectionKey.values) {
      if (key.apiValue == value) {
        return key;
      }
    }

    return null;
  }
}

sealed class LearnerHomeItem {
  const LearnerHomeItem({
    required this.score,
    required this.reasons,
  });

  final int score;
  final List<String> reasons;
}

class LearnerHomeMaterialRecommendation extends LearnerHomeItem {
  const LearnerHomeMaterialRecommendation({
    required super.score,
    required super.reasons,
    required this.material,
  });

  final DiscoveryMaterial material;
}

class LearnerHomeProjectRecommendation extends LearnerHomeItem {
  const LearnerHomeProjectRecommendation({
    required super.score,
    required super.reasons,
    required this.project,
  });

  final LearningProject project;
}

class LearnerHomeContinueProjectRecommendation extends LearnerHomeItem {
  const LearnerHomeContinueProjectRecommendation({
    required super.score,
    required super.reasons,
    required this.projectId,
    required this.projectTitle,
    required this.shortDescription,
    required this.coverImageUrl,
    required this.progressPercent,
    required this.readyCount,
    required this.totalCount,
  });

  final String projectId;
  final String projectTitle;
  final String shortDescription;
  final String? coverImageUrl;
  final int progressPercent;
  final int readyCount;
  final int totalCount;
}

class LearnerHomeSection {
  const LearnerHomeSection({
    required this.key,
    required this.title,
    required this.emptyState,
    required this.items,
  });

  final LearnerHomeSectionKey key;
  final String title;
  final String emptyState;
  final List<LearnerHomeItem> items;
}

class LearnerHomeSectionDetails {
  const LearnerHomeSectionDetails({
    required this.key,
    required this.title,
    required this.subtitle,
    required this.emptyState,
    required this.items,
    this.nextCursor,
    this.nextOffset,
    this.hasMore = false,
  });

  final LearnerHomeSectionKey key;
  final String title;
  final String subtitle;
  final String emptyState;
  final List<LearnerHomeItem> items;
  final String? nextCursor;
  final int? nextOffset;
  final bool hasMore;
}

class LearnerHomeFeed {
  const LearnerHomeFeed({
    required this.profileCompletion,
    required this.sections,
  });

  final LearnerHomeProfileCompletion profileCompletion;
  final List<LearnerHomeSection> sections;

  LearnerHomeSection? section(LearnerHomeSectionKey key) {
    for (final section in sections) {
      if (section.key == key) {
        return section;
      }
    }

    return null;
  }
}
