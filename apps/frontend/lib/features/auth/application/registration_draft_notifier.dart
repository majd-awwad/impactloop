import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../presentation/models/registration_intent.dart';
import '../data/models/register_request.dart';
import '../data/models/registration_draft.dart';

class RegistrationDraftNotifier extends Notifier<RegistrationDraft> {
  @override
  RegistrationDraft build() => const RegistrationDraft();

  void setBasicInfo({
    required String displayName,
    required String email,
    required String password,
    String? phone,
  }) {
    state = state.copyWith(
      displayName: displayName,
      email: email,
      password: password,
      phone: phone,
      clearPhone: phone == null || phone.trim().isEmpty,
    );
  }

  void setIntent(RegistrationIntent intent) {
    state = state.copyWith(
      intent: intent,
      clearLearnerProfile: intent == RegistrationIntent.supplier,
      clearSupplierProfile: intent == RegistrationIntent.learner,
    );
  }

  void setLearnerProfile(LearnerProfileDraft profile) {
    state = state.copyWith(learnerProfile: profile);
  }

  void setSupplierProfile(SupplierProfileDraft profile) {
    state = state.copyWith(supplierProfile: profile);
  }

  RegisterRequest? toRegisterRequest() {
    try {
      return RegisterRequest.fromDraft(state);
    } on StateError {
      return null;
    }
  }

  void clear() {
    state = const RegistrationDraft();
  }
}

final registrationDraftProvider =
    NotifierProvider<RegistrationDraftNotifier, RegistrationDraft>(
      RegistrationDraftNotifier.new,
    );
