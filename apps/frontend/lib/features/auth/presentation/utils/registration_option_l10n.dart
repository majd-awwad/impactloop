import 'package:flutter/widgets.dart';

import '../../../../l10n/app_localizations.dart';
import '../../../profile/presentation/l10n/learner_profile_l10n.dart';

String localizedRegistrationGoal(AppLocalizations l10n, String goal) {
  return switch (goal) {
    'Build projects' => l10n.registerGoalBuildProjects,
    'Find components' => l10n.registerGoalFindComponents,
    'Learn new skills' => l10n.registerGoalLearnNewSkills,
    'Repair something' => l10n.registerGoalRepairSomething,
    'Reuse materials' => l10n.registerGoalReuseMaterials,
    'Save money' => l10n.registerGoalSaveMoney,
    'Explore project ideas' => l10n.registerGoalExploreProjectIdeas,
    'Help my community' => l10n.registerGoalHelpMyCommunity,
    'Share surplus materials' => l10n.registerGoalShareSurplusMaterials,
    'Reduce waste' => l10n.registerGoalReduceWaste,
    'Clear storage space' => l10n.registerGoalClearStorageSpace,
    'Support learners' => l10n.registerGoalSupportLearners,
    'Find people who can reuse items' => l10n.registerGoalFindPeopleWhoCanReuse,
    'Manage pickup requests' => l10n.registerGoalManagePickupRequests,
    'Track material impact' => l10n.registerGoalTrackMaterialImpact,
    'List materials faster' => l10n.registerGoalListMaterialsFaster,
    _ => goal,
  };
}

String localizedLearnerType(AppLocalizations l10n, String learnerType) {
  return switch (learnerType) {
    'University student' => l10n.registerLearnerTypeUniversity,
    'School student' => l10n.registerLearnerTypeSchool,
    'Self learner' => l10n.registerLearnerTypeSelf,
    'Maker / hobbyist' => l10n.registerLearnerTypeMaker,
    _ => learnerType,
  };
}

String localizedLearnerTypeDescription(
  AppLocalizations l10n,
  String learnerType,
) {
  return switch (learnerType) {
    'University student' => l10n.registerLearnerTypeUniversityDescription,
    'School student' => l10n.registerLearnerTypeSchoolDescription,
    'Self learner' => l10n.registerLearnerTypeSelfDescription,
    'Maker / hobbyist' => l10n.registerLearnerTypeMakerDescription,
    _ => l10n.registerLearnerTypeFallbackDescription,
  };
}

String localizedSkillLevel(AppLocalizations l10n, String skillLevel) {
  return switch (skillLevel) {
    'Beginner' => l10n.registerSkillBeginner,
    'Intermediate' => l10n.registerSkillIntermediate,
    'Advanced' => l10n.registerSkillAdvanced,
    'Expert' => l10n.registerSkillExpert,
    _ => skillLevel,
  };
}

String localizedSkillLevelDescription(
  AppLocalizations l10n,
  String skillLevel,
) {
  return switch (skillLevel) {
    'Beginner' => l10n.registerSkillBeginnerDescription,
    'Intermediate' => l10n.registerSkillIntermediateDescription,
    'Advanced' => l10n.registerSkillAdvancedDescription,
    'Expert' => l10n.registerSkillExpertDescription,
    _ => l10n.registerSkillFallbackDescription,
  };
}

String localizedInterestLabel(
  BuildContext context,
  String key, {
  String? fallbackLabel,
}) {
  final profileL10n = LearnerProfileL10n.of(context);
  if (profileL10n.hasLocalizedInterestLabel(key)) {
    return profileL10n.interestLabel(key);
  }
  return fallbackLabel ?? key;
}
