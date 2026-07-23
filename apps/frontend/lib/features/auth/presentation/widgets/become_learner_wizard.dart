import 'package:flutter/material.dart';

import 'auth_onboarding_shell.dart';
import '../models/learner_setup_mode.dart';
import 'registration_wizard.dart';

class BecomeLearnerPage extends StatelessWidget {
  const BecomeLearnerPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const AuthOnboardingShell(
      showSignIn: false,
      showCreateAccount: false,
      child: RegistrationWizard(mode: LearnerSetupMode.addToExistingAccount),
    );
  }
}
