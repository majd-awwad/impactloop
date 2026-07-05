import 'registration_draft.dart';

class BecomeLearnerRequest {
  const BecomeLearnerRequest({
    required this.learnerType,
    required this.skillLevel,
    this.interests = const [],
    this.bio,
  });

  final String learnerType;
  final String skillLevel;
  final List<String> interests;
  final String? bio;

  factory BecomeLearnerRequest.fromDraft(RegistrationDraft draft) {
    final profile = draft.learnerProfile;
    if (profile == null) {
      throw StateError('Learner profile is required');
    }

    final interests = draft.onboardingInterests.isNotEmpty
        ? draft.onboardingInterests
        : profile.interests;

    return BecomeLearnerRequest(
      learnerType: profile.learnerType,
      skillLevel: profile.skillLevel,
      interests: interests,
      bio: profile.bio,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'learnerType': learnerType,
      'skillLevel': skillLevel,
      if (interests.isNotEmpty) 'interests': interests,
      if (bio != null && bio!.trim().isNotEmpty) 'bio': bio!.trim(),
    };
  }
}
