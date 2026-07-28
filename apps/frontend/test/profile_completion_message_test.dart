import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/profile/presentation/widgets/learner_profile_hub_widgets.dart';

void main() {
  test('complete supported profile has no targeted prompt', () {
    expect(resolveLearnerProfilePrompt(_user()), isNull);
  });

  test('missing profile returns setup prompt', () {
    final prompt = resolveLearnerProfilePrompt(_user(profile: null));

    expect(prompt?.kind, LearnerProfilePromptKind.setup);
  });

  test('missing interests take prompt priority', () {
    final prompt = resolveLearnerProfilePrompt(
      _user(
        profile: const LearnerProfile(
          learnerType: '',
          skillLevel: '',
          interests: [],
        ),
      ),
    );

    expect(prompt?.kind, LearnerProfilePromptKind.interests);
  });

  test('missing learner type and level share one details prompt', () {
    final prompt = resolveLearnerProfilePrompt(
      _user(
        profile: const LearnerProfile(
          learnerType: ' ',
          skillLevel: '',
          interests: ['robotics'],
        ),
      ),
    );

    expect(prompt?.kind, LearnerProfilePromptKind.learningDetails);
    expect(prompt?.missingLearnerType, isTrue);
    expect(prompt?.missingSkillLevel, isTrue);
  });

  test('missing optional bio does not return a prompt', () {
    expect(
      resolveLearnerProfilePrompt(
        _user(
          profile: const LearnerProfile(
            learnerType: 'University student',
            skillLevel: 'Beginner',
            interests: ['robotics'],
          ),
        ),
      ),
      isNull,
    );
  });

  test('account notice prioritizes email before phone', () {
    final notice = resolveAccountVerificationNotice(
      _user(emailVerified: false, phone: null, phoneVerified: false),
    );

    expect(notice?.kind, AccountVerificationNoticeKind.emailUnverified);
  });

  test('account notice then targets a missing phone', () {
    final notice = resolveAccountVerificationNotice(
      _user(phone: null, phoneVerified: false),
    );

    expect(notice?.kind, AccountVerificationNoticeKind.phoneMissing);
  });

  test('fully verified account has no account notice', () {
    expect(resolveAccountVerificationNotice(_user()), isNull);
  });
}

User _user({
  LearnerProfile? profile = const LearnerProfile(
    learnerType: 'University student',
    skillLevel: 'Beginner',
    interests: ['robotics'],
    bio: 'A short bio.',
  ),
  String? phone = '+970 599 000 000',
  bool emailVerified = true,
  bool phoneVerified = true,
}) {
  return User(
    id: 'learner-1',
    displayName: 'Learner',
    email: 'learner@example.com',
    accountStatus: 'ACTIVE',
    roles: const ['LEARNER'],
    learnerProfile: profile,
    phone: phone,
    emailVerifiedAt: emailVerified ? DateTime.utc(2026, 1, 2) : null,
    phoneVerifiedAt: phoneVerified ? DateTime.utc(2026, 1, 2) : null,
    createdAt: DateTime.utc(2026),
  );
}
