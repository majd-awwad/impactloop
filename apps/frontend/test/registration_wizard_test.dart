import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/data/models/register_request.dart';
import 'package:frontend/features/auth/data/models/registration_draft.dart';
import 'package:frontend/features/auth/presentation/models/registration_intent.dart';
import 'package:frontend/features/auth/presentation/models/registration_wizard_step.dart';
import 'package:frontend/features/auth/presentation/utils/registration_onboarding_helpers.dart';

void main() {
  group('registrationWizardSteps', () {
    test('learner path stays inside register without legacy continuation', () {
      final steps = registrationWizardSteps(
        intent: RegistrationIntent.learner,
        needsVerification: false,
      );

      expect(steps, contains(RegistrationWizardStep.account));
      expect(steps, contains(RegistrationWizardStep.interests));
      expect(steps, contains(RegistrationWizardStep.learnerBasics));
      expect(steps, contains(RegistrationWizardStep.review));
      expect(steps, isNot(contains(RegistrationWizardStep.supplierBasics)));
      expect(steps, isNot(contains(RegistrationWizardStep.verification)));
    });

    test('do both path includes learner and supplier steps in one wizard', () {
      final steps = registrationWizardSteps(
        intent: RegistrationIntent.both,
        needsVerification: true,
      );

      expect(
        steps.indexOf(RegistrationWizardStep.learnerBasics),
        lessThan(steps.indexOf(RegistrationWizardStep.supplierBasics)),
      );
      expect(steps, contains(RegistrationWizardStep.verification));
      expect(steps.last, RegistrationWizardStep.review);
    });

    test('student and individual supplier paths skip verification', () {
      final steps = registrationWizardSteps(
        intent: RegistrationIntent.supplier,
        needsVerification: false,
      );

      expect(steps, isNot(contains(RegistrationWizardStep.verification)));
      expect(steps.last, RegistrationWizardStep.review);
      expect(steps, isNot(contains(RegistrationWizardStep.interests)));
    });

    test('organization supplier path includes verification before review', () {
      final steps = registrationWizardSteps(
        intent: RegistrationIntent.supplier,
        needsVerification: true,
      );

      expect(
        steps.indexOf(RegistrationWizardStep.verification),
        lessThan(steps.indexOf(RegistrationWizardStep.review)),
      );
    });
  });

  group('registration UX defaults', () {
    test('supplier goals do not include learner-only goals', () {
      final goals = registrationGoalOptionsForIntent(
        RegistrationIntent.supplier,
      );

      expect(goals, contains('Share surplus materials'));
      expect(goals, contains('Manage pickup requests'));
      expect(goals, isNot(contains('Build projects')));
      expect(goals, isNot(contains('Find components')));
    });

    test('learner interests cover general reuse and non-technical topics', () {
      expect(registrationInterestOptions, contains('Home improvement'));
      expect(registrationInterestOptions, contains('Fashion and textiles'));
      expect(registrationInterestOptions, contains('Community projects'));
      expect(registrationInterestOptions, contains('Electronics'));
    });

    test('student learners are suggested as student suppliers', () {
      expect(
        suggestedSupplierTypeForLearnerType('University student'),
        'Student supplier',
      );
      expect(
        suggestedSupplierTypeForLearnerType('School student'),
        'Student supplier',
      );
    });

    test('self learners and makers are suggested as individual suppliers', () {
      expect(
        suggestedSupplierTypeForLearnerType('Self learner'),
        'Individual supplier',
      );
      expect(
        suggestedSupplierTypeForLearnerType('Maker / hobbyist'),
        'Individual supplier',
      );
    });
  });

  group('registration payload mapping', () {
    test('maps onboarding interests to learnerProfile.interests', () {
      const interests = ['Arduino', 'Robotics'];
      final request = RegisterRequest.fromFormValues(
        intent: RegistrationIntent.learner,
        displayName: 'Learner User',
        email: 'learner@example.com',
        password: 'password123',
        learnerProfile: LearnerProfileDraft(
          learnerType: 'University student',
          skillLevel: 'Beginner',
          interests: interests,
        ),
      );

      final json = request.toJson();
      final learnerJson = json['learnerProfile'] as Map<String, dynamic>;
      expect(learnerJson['interests'], interests);
      expect(learnerJson.containsKey('bio'), isFalse);
    });

    test('maps onboarding city and area to supplier pickupArea', () {
      final pickupArea = formatPickupArea(city: 'Nablus', area: 'Rafidia');

      final request = RegisterRequest.fromFormValues(
        intent: RegistrationIntent.supplier,
        displayName: 'Supplier User',
        email: 'supplier@example.com',
        password: 'password123',
        supplierProfile: SupplierProfileDraft(
          supplierType: 'Workshop',
          publicName: 'Workshop Hub',
          pickupArea: pickupArea,
        ),
      );

      expect(request.supplierProfile?.pickupArea, 'Nablus, Rafidia');
      expect(
        request.toJson()['supplierProfile']['pickupArea'],
        'Nablus, Rafidia',
      );
    });

    test('does not send onboarding goals in register payload', () {
      final request = RegisterRequest.fromFormValues(
        intent: RegistrationIntent.learner,
        displayName: 'Learner User',
        email: 'learner@example.com',
        password: 'password123',
        learnerProfile: const LearnerProfileDraft(
          learnerType: 'University student',
          skillLevel: 'Beginner',
        ),
      );

      final json = request.toJson();
      expect(json.containsKey('onboardingGoals'), isFalse);
      expect(json.containsKey('onboardingInterests'), isFalse);
    });
  });

  group('registrationIntentFromQuery', () {
    test('parses supplier intent from register deep link', () {
      expect(
        registrationIntentFromQuery('supplier'),
        RegistrationIntent.supplier,
      );
    });
  });
}
