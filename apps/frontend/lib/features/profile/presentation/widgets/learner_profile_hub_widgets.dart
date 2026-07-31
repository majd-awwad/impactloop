import '../../../auth/data/models/user.dart';

enum LearnerProfilePromptKind { setup, interests, learningDetails }

class LearnerProfilePromptState {
  const LearnerProfilePromptState({
    required this.kind,
    this.missingLearnerType = false,
    this.missingSkillLevel = false,
  });

  final LearnerProfilePromptKind kind;
  final bool missingLearnerType;
  final bool missingSkillLevel;
}

LearnerProfilePromptState? resolveLearnerProfilePrompt(User user) {
  final profile = user.learnerProfile;
  if (profile == null) {
    return const LearnerProfilePromptState(
      kind: LearnerProfilePromptKind.setup,
    );
  }

  final interests = profile.interests
      .map((value) => value.trim())
      .where((value) => value.isNotEmpty);
  if (interests.isEmpty) {
    return const LearnerProfilePromptState(
      kind: LearnerProfilePromptKind.interests,
    );
  }

  final missingLearnerType = profile.learnerType.trim().isEmpty;
  final missingSkillLevel = profile.skillLevel.trim().isEmpty;
  if (missingLearnerType || missingSkillLevel) {
    return LearnerProfilePromptState(
      kind: LearnerProfilePromptKind.learningDetails,
      missingLearnerType: missingLearnerType,
      missingSkillLevel: missingSkillLevel,
    );
  }

  return null;
}

enum AccountVerificationNoticeKind {
  emailUnverified,
  phoneMissing,
  phoneUnverified,
}

class AccountVerificationNoticeState {
  const AccountVerificationNoticeState(this.kind);

  final AccountVerificationNoticeKind kind;
}

AccountVerificationNoticeState? resolveAccountVerificationNotice(User user) {
  if (user.emailVerifiedAt == null) {
    return const AccountVerificationNoticeState(
      AccountVerificationNoticeKind.emailUnverified,
    );
  }

  final phone = user.phone?.trim() ?? '';
  if (phone.isEmpty) {
    return const AccountVerificationNoticeState(
      AccountVerificationNoticeKind.phoneMissing,
    );
  }

  if (user.phoneVerifiedAt == null) {
    return const AccountVerificationNoticeState(
      AccountVerificationNoticeKind.phoneUnverified,
    );
  }

  return null;
}

class LearnerProfileCompletionAction {
  const LearnerProfileCompletionAction({
    required this.step,
    required this.route,
  });

  final String step;
  final String route;
}

LearnerProfileCompletionAction? resolveLearnerProfileCompletionAction(
  List<String> missingSteps,
) {
  if (missingSteps.isEmpty) {
    return null;
  }

  final step = missingSteps.first;
  final route = switch (step) {
    'display_name' || 'phone' => '/profile/edit',
    'learning_basics' || 'interests' || 'bio' => '/profile/learner/edit',
    'saved_location' => '/profile/locations',
    _ => null,
  };

  return route == null
      ? null
      : LearnerProfileCompletionAction(step: step, route: route);
}
