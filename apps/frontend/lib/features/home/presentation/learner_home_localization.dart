import '../../../l10n/app_localizations.dart';
import '../domain/learner_home_models.dart';

typedef LearnerHomeSectionCopy = ({
  String title,
  String subtitle,
  String empty,
});

LearnerHomeSectionCopy learnerHomeSectionCopy(
  LearnerHomeSectionKey key,
  AppLocalizations l10n,
) => switch (key) {
  LearnerHomeSectionKey.suggestedMaterials => (
    title: l10n.sectionSuggestedMaterialsTitle,
    subtitle: l10n.sectionSuggestedMaterialsSubtitle,
    empty: l10n.sectionSuggestedMaterialsEmpty,
  ),
  LearnerHomeSectionKey.materialsForSavedProjects => (
    title: l10n.sectionSavedProjectMaterialsTitle,
    subtitle: l10n.sectionSavedProjectMaterialsSubtitle,
    empty: l10n.sectionSavedProjectMaterialsEmpty,
  ),
  LearnerHomeSectionKey.suggestedProjects => (
    title: l10n.sectionSuggestedProjectsTitle,
    subtitle: l10n.sectionSuggestedProjectsSubtitle,
    empty: l10n.sectionSuggestedProjectsEmpty,
  ),
  LearnerHomeSectionKey.continueProjects => (
    title: l10n.sectionContinueProjectsTitle,
    subtitle: l10n.sectionContinueProjectsSubtitle,
    empty: l10n.sectionContinueProjectsEmpty,
  ),
  LearnerHomeSectionKey.savedProjects => (
    title: l10n.sectionSavedProjectsTitle,
    subtitle: l10n.sectionSavedProjectsSubtitle,
    empty: l10n.sectionSavedProjectsEmpty,
  ),
  LearnerHomeSectionKey.freeMaterialsNearYou => (
    title: l10n.sectionFreeMaterialsTitle,
    subtitle: l10n.sectionFreeMaterialsSubtitle,
    empty: l10n.sectionFreeMaterialsEmpty,
  ),
  LearnerHomeSectionKey.popularProjects => (
    title: l10n.sectionPopularProjectsTitle,
    subtitle: l10n.sectionPopularProjectsSubtitle,
    empty: l10n.sectionPopularProjectsEmpty,
  ),
};

String? localizedLearnerHomeReason(
  LearnerHomeItem item,
  AppLocalizations l10n,
) {
  if (item.reasonDetails.isEmpty) {
    if (l10n.localeName == 'en' && item.reasons.isNotEmpty) {
      return item.reasons.first;
    }
    return item.reasons.isEmpty ? null : l10n.reasonRecommended;
  }

  final detail = item.reasonDetails.first;
  String value(String key) => detail.params[key]?.toString().trim() ?? '';
  int integer(String key) => int.tryParse(value(key)) ?? 0;
  return switch (detail.code) {
    'SIMILAR_TO_RESERVED_MATERIALS' => l10n.reasonSimilarReserved,
    'MATCHES_RECENT_ACTIVITY' => l10n.reasonRecentActivity,
    'RELATED_TO_SAVED_PROJECTS' => l10n.reasonSavedProjects,
    'BASED_ON_LIKED_PROJECTS' => l10n.reasonLikedProjects,
    'RELATED_TO_FOLLOWED_PROJECTS' => l10n.reasonFollowedProjects,
    'RELATED_TO_MATERIAL_ACTIVITY' => l10n.reasonMaterialActivity,
    'AVAILABLE_NEAR_SAVED_LOCATION' => l10n.reasonNearLocation,
    'FREE_MATERIAL' => l10n.reasonFreeMaterial,
    'FREE_NEAR_SAVED_LOCATION' => l10n.reasonFreeNearLocation,
    'DELIVERY_AVAILABLE' => l10n.reasonDeliveryAvailable,
    'POPULAR_MATERIAL' => l10n.reasonPopularMaterial,
    'RECENTLY_ADDED' => l10n.reasonRecentlyAdded,
    'MATCHES_INTEREST' => l10n.reasonMatchesInterest(value('interest')),
    'BUILDING_PROJECT_CATEGORY' => l10n.reasonBuildingCategory(
      value('category'),
    ),
    'COMPONENTS_READY' => l10n.reasonComponentsReady(
      integer('ready'),
      integer('total'),
    ),
    _ => l10n.reasonRecommended,
  };
}
