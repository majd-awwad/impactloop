import 'registration_intent.dart';

enum RegistrationWizardStep {
  account,
  interests,
  goals,
  location,
  learnerBasics,
  supplierBasics,
  verification,
  review,
}

extension RegistrationWizardStepLabels on RegistrationWizardStep {
  String get title => switch (this) {
    RegistrationWizardStep.account => 'Account',
    RegistrationWizardStep.interests => 'Interests',
    RegistrationWizardStep.goals => 'Goals',
    RegistrationWizardStep.location => 'Location',
    RegistrationWizardStep.learnerBasics => 'Learner profile',
    RegistrationWizardStep.supplierBasics => 'Supplier profile',
    RegistrationWizardStep.verification => 'Verification',
    RegistrationWizardStep.review => 'Review',
  };

  String get subtitle => switch (this) {
    RegistrationWizardStep.account =>
      'Choose your account type and create your sign-in details.',
    RegistrationWizardStep.interests =>
      'Pick broad topics you care about so suggestions fit your needs.',
    RegistrationWizardStep.goals =>
      'Choose the outcomes that match this account type.',
    RegistrationWizardStep.location =>
      'Set the general city and area needed for this flow.',
    RegistrationWizardStep.learnerBasics =>
      'Tell us a little about your learning background.',
    RegistrationWizardStep.supplierBasics =>
      'Set up the supplier identity shown on material listings.',
    RegistrationWizardStep.verification =>
      'Upload organization proof when this supplier type requires it.',
    RegistrationWizardStep.review =>
      'Review the details for this account type before creating it.',
  };
}

List<RegistrationWizardStep> registrationWizardSteps({
  required RegistrationIntent intent,
  required bool needsVerification,
}) {
  final steps = <RegistrationWizardStep>[RegistrationWizardStep.account];

  if (intent == RegistrationIntent.learner ||
      intent == RegistrationIntent.both) {
    steps.add(RegistrationWizardStep.interests);
  }

  steps.add(RegistrationWizardStep.goals);
  steps.add(RegistrationWizardStep.location);

  if (intent == RegistrationIntent.learner ||
      intent == RegistrationIntent.both) {
    steps.add(RegistrationWizardStep.learnerBasics);
  }

  if (intent == RegistrationIntent.supplier ||
      intent == RegistrationIntent.both) {
    steps.add(RegistrationWizardStep.supplierBasics);
    if (needsVerification) {
      steps.add(RegistrationWizardStep.verification);
    }
  }

  steps.add(RegistrationWizardStep.review);
  return steps;
}

RegistrationIntent? registrationIntentFromQuery(String? raw) {
  return switch (raw?.trim().toLowerCase()) {
    'learner' => RegistrationIntent.learner,
    'supplier' => RegistrationIntent.supplier,
    'both' => RegistrationIntent.both,
    _ => null,
  };
}
