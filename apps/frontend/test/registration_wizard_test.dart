import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/data/models/register_request.dart';
import 'package:frontend/features/auth/data/models/registration_draft.dart';
import 'package:frontend/features/auth/presentation/models/registration_intent.dart';
import 'package:frontend/features/auth/presentation/models/registration_wizard_step.dart';
import 'package:frontend/features/profile/data/models/learner_interest_options.dart';

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
    test('taxonomy fallback includes core learner interests', () {
      final labels = fallbackLearnerInterestOptions.labelByKey;

      expect(labels.keys, contains('electronics'));
      expect(labels.keys, contains('arduino'));
      expect(labels.keys, contains('robotics'));
      expect(labels.keys, contains('fabric_textiles'));
      expect(labels.keys, contains('home_diy'));
      expect(labels['audio_media'], 'Audio & Media');
    });

    test('maps learner profile fields into the public request payload', () {
      const interests = ['arduino', 'robotics'];
      final request = RegisterRequest.fromDraft(
        RegistrationDraft(
          displayName: 'Test User',
          email: 'test@example.com',
          password: 'TestPassword123!',
          intent: RegistrationIntent.learner,
          onboardingInterests: interests,
          learnerProfile: const LearnerProfileDraft(
            learnerType: 'Self learner',
            skillLevel: 'Beginner',
            interests: interests,
            bio: 'Building practical electronics skills.',
          ),
        ),
      );

      final learnerJson =
          request.toJson()['learnerProfile'] as Map<String, dynamic>;
      expect(learnerJson['learnerType'], 'Self learner');
      expect(learnerJson['skillLevel'], 'Beginner');
      expect(learnerJson['interests'], interests);
      expect(learnerJson['bio'], 'Building practical electronics skills.');

      final minimalPayload = RegisterRequest.fromDraft(
        const RegistrationDraft(
          displayName: 'Minimal Learner',
          email: 'minimal@example.com',
          password: 'TestPassword123!',
          intent: RegistrationIntent.learner,
          learnerProfile: LearnerProfileDraft(
            learnerType: 'Self learner',
            skillLevel: 'Beginner',
          ),
        ),
      ).toJson();
      final minimalLearnerJson =
          minimalPayload['learnerProfile'] as Map<String, dynamic>;
      expect(minimalLearnerJson.containsKey('interests'), isFalse);
      expect(minimalLearnerJson.containsKey('bio'), isFalse);
    });

    test('normalizes legacy labels and custom interests for display', () {
      final keys = normalizeSelectedInterestKeys([
        'Art & crafts',
        'Solar energy',
        'custom:cnc_machining',
      ]);

      expect(keys, contains('custom:art_crafts'));
      expect(keys, contains('custom:solar_energy'));
      expect(keys, contains('custom:cnc_machining'));
      expect(learnerInterestLabel('custom:solar_energy'), 'Solar Energy');
    });
  });
}
