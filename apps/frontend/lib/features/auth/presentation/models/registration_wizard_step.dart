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
      'Choose how you want to use ImpactLoop and create your sign-in details.',
    RegistrationWizardStep.interests =>
      'Pick topics you care about so we can tailor your experience.',
    RegistrationWizardStep.goals =>
      'What do you want to get out of ImpactLoop?',
    RegistrationWizardStep.location =>
      'Where will you browse or share materials?',
    RegistrationWizardStep.learnerBasics =>
      'Tell us a little about your learning background.',
    RegistrationWizardStep.supplierBasics =>
      'Set up how others will see you as a supplier.',
    RegistrationWizardStep.verification =>
      'Upload proof of your organization for verification.',
    RegistrationWizardStep.review =>
      'Review your details, then create your account.',
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
