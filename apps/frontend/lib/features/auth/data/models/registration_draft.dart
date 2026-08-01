import '../../presentation/models/registration_intent.dart';

class LearnerProfileDraft {
  const LearnerProfileDraft({
    required this.learnerType,
    required this.skillLevel,
    this.interests = const [],
    this.bio,
  });

  final String learnerType;
  final String skillLevel;
  final List<String> interests;
  final String? bio;

  LearnerProfileDraft copyWith({
    String? learnerType,
    String? skillLevel,
    List<String>? interests,
    String? bio,
  }) {
    return LearnerProfileDraft(
      learnerType: learnerType ?? this.learnerType,
      skillLevel: skillLevel ?? this.skillLevel,
      interests: interests ?? this.interests,
      bio: bio ?? this.bio,
    );
  }
}

class SupplierProfileDraft {
  const SupplierProfileDraft({
    required this.supplierType,
    required this.publicName,
    this.description,
    required this.pickupArea,
  });

  final String supplierType;
  final String publicName;
  final String? description;
  final String pickupArea;

  SupplierProfileDraft copyWith({
    String? supplierType,
    String? publicName,
    String? description,
    String? pickupArea,
  }) {
    return SupplierProfileDraft(
      supplierType: supplierType ?? this.supplierType,
      publicName: publicName ?? this.publicName,
      description: description ?? this.description,
      pickupArea: pickupArea ?? this.pickupArea,
    );
  }
}

class RegistrationDraft {
  const RegistrationDraft({
    this.displayName,
    this.email,
    this.phone,
    this.password,
    this.intent,
    this.onboardingInterests = const [],
    this.onboardingGoals = const [],
    this.onboardingCity,
    this.onboardingArea,
    this.learnerProfile,
    this.supplierProfile,
  });

  final String? displayName;
  final String? email;
  final String? phone;
  final String? password;
  final RegistrationIntent? intent;
  final List<String> onboardingInterests;
  final List<String> onboardingGoals;
  final String? onboardingCity;
  final String? onboardingArea;
  final LearnerProfileDraft? learnerProfile;
  final SupplierProfileDraft? supplierProfile;

  bool get hasBasicInfo =>
      displayName != null &&
      displayName!.trim().isNotEmpty &&
      email != null &&
      email!.trim().isNotEmpty &&
      password != null &&
      password!.isNotEmpty;

  RegistrationDraft copyWith({
    String? displayName,
    String? email,
    String? phone,
    String? password,
    RegistrationIntent? intent,
    List<String>? onboardingInterests,
    List<String>? onboardingGoals,
    String? onboardingCity,
    String? onboardingArea,
    LearnerProfileDraft? learnerProfile,
    SupplierProfileDraft? supplierProfile,
    bool clearPhone = false,
    bool clearLearnerProfile = false,
    bool clearSupplierProfile = false,
    bool clearOnboardingCity = false,
    bool clearOnboardingArea = false,
  }) {
    return RegistrationDraft(
      displayName: displayName ?? this.displayName,
      email: email ?? this.email,
      phone: clearPhone ? null : phone ?? this.phone,
      password: password ?? this.password,
      intent: intent ?? this.intent,
      onboardingInterests: onboardingInterests ?? this.onboardingInterests,
      onboardingGoals: onboardingGoals ?? this.onboardingGoals,
      onboardingCity: clearOnboardingCity
          ? null
          : onboardingCity ?? this.onboardingCity,
      onboardingArea: clearOnboardingArea
          ? null
          : onboardingArea ?? this.onboardingArea,
      learnerProfile: clearLearnerProfile
          ? null
          : learnerProfile ?? this.learnerProfile,
      supplierProfile: clearSupplierProfile
          ? null
          : supplierProfile ?? this.supplierProfile,
    );
  }
}

List<String> parseInterestsInput(String? raw) {
  if (raw == null || raw.trim().isEmpty) {
    return const [];
  }

  return raw
      .split(',')
      .map((value) => value.trim())
      .where((value) => value.isNotEmpty)
      .toList();
}
