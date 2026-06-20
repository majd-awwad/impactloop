import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../widgets/auth_form_card.dart';
import '../widgets/auth_header.dart';
import '../widgets/auth_shell.dart';
import '../widgets/complete_learner_profile_form.dart';

class CompleteLearnerProfileMobileView extends StatelessWidget {
  const CompleteLearnerProfileMobileView({
    super.key,
    required this.showSupplierNextHint,
  });

  final bool showSupplierNextHint;

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      layout: AuthShellLayout.mobile,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AuthHeader(
            title: 'Complete your learner profile',
            subtitle:
                'Help us personalize projects and material recommendations.',
          ),
          const SizedBox(height: AppSpacing.lg),
          AuthFormCard(
            child: CompleteLearnerProfileForm(
              showSupplierNextHint: showSupplierNextHint,
            ),
          ),
        ],
      ),
    );
  }
}
