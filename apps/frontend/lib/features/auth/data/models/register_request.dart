import '../../presentation/models/registration_intent.dart';
import 'registration_draft.dart';

class RegisterRequest {
  const RegisterRequest({
    required this.displayName,
    required this.email,
    required this.password,
    this.phone,
    required this.roles,
    this.learnerProfile,
    this.supplierProfile,
  });

  final String displayName;
  final String email;
  final String password;
  final String? phone;
  final List<String> roles;
  final LearnerProfileDraft? learnerProfile;
  final SupplierProfileDraft? supplierProfile;

  factory RegisterRequest.fromFormValues({
    required RegistrationIntent intent,
    required String displayName,
    required String email,
    required String password,
    String? phone,
    LearnerProfileDraft? learnerProfile,
    SupplierProfileDraft? supplierProfile,
  }) {
    final roles = switch (intent) {
      RegistrationIntent.learner => const ['LEARNER'],
      RegistrationIntent.supplier => const ['SUPPLIER'],
      RegistrationIntent.both => const ['LEARNER', 'SUPPLIER'],
    };

    final needsLearnerProfile =
        intent == RegistrationIntent.learner ||
        intent == RegistrationIntent.both;
    final needsSupplierProfile =
        intent == RegistrationIntent.supplier ||
        intent == RegistrationIntent.both;

    if (needsLearnerProfile && learnerProfile == null) {
      throw StateError('Learner profile is required for this registration');
    }

    if (needsSupplierProfile && supplierProfile == null) {
      throw StateError('Supplier profile is required for this registration');
    }

    return RegisterRequest(
      displayName: displayName.trim(),
      email: email.trim(),
      password: password,
      phone: phone?.trim().isEmpty ?? true ? null : phone!.trim(),
      roles: roles,
      learnerProfile: needsLearnerProfile ? learnerProfile : null,
      supplierProfile: needsSupplierProfile ? supplierProfile : null,
    );
  }

  factory RegisterRequest.fromDraft(RegistrationDraft draft) {
    if (!draft.hasBasicInfo || draft.intent == null) {
      throw StateError('Registration draft is incomplete');
    }

    final roles = switch (draft.intent!) {
      RegistrationIntent.learner => const ['LEARNER'],
      RegistrationIntent.supplier => const ['SUPPLIER'],
      RegistrationIntent.both => const ['LEARNER', 'SUPPLIER'],
    };

    final needsLearnerProfile =
        draft.intent == RegistrationIntent.learner ||
        draft.intent == RegistrationIntent.both;
    final needsSupplierProfile =
        draft.intent == RegistrationIntent.supplier ||
        draft.intent == RegistrationIntent.both;

    if (needsLearnerProfile && draft.learnerProfile == null) {
      throw StateError('Learner profile is required for this registration');
    }

    if (needsSupplierProfile && draft.supplierProfile == null) {
      throw StateError('Supplier profile is required for this registration');
    }

    return RegisterRequest(
      displayName: draft.displayName!.trim(),
      email: draft.email!.trim(),
      password: draft.password!,
      phone: draft.phone?.trim().isEmpty ?? true ? null : draft.phone!.trim(),
      roles: roles,
      learnerProfile: needsLearnerProfile ? draft.learnerProfile : null,
      supplierProfile: needsSupplierProfile ? draft.supplierProfile : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'displayName': displayName,
      'email': email,
      'password': password,
      if (phone != null) 'phone': phone,
      'roles': roles,
      if (learnerProfile != null)
        'learnerProfile': {
          'learnerType': learnerProfile!.learnerType,
          'skillLevel': learnerProfile!.skillLevel,
          if (learnerProfile!.interests.isNotEmpty)
            'interests': learnerProfile!.interests,
          if (learnerProfile!.bio != null && learnerProfile!.bio!.isNotEmpty)
            'bio': learnerProfile!.bio,
        },
      if (supplierProfile != null)
        'supplierProfile': {
          'supplierType': supplierProfile!.supplierType,
          'publicName': supplierProfile!.publicName,
          if (supplierProfile!.description != null &&
              supplierProfile!.description!.isNotEmpty)
            'description': supplierProfile!.description,
          'pickupArea': supplierProfile!.pickupArea,
        },
    };
  }
}
