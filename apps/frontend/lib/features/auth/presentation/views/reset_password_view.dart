import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../widgets/auth_entry_branding_panel.dart';
import '../widgets/auth_form_card.dart';
import '../widgets/auth_header.dart';
import '../widgets/auth_shell.dart';
import '../widgets/reset_password_form.dart';

class ResetPasswordView extends StatelessWidget {
  const ResetPasswordView({super.key, required this.token});

  final String? token;

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      brandingVariant: AuthEntryBrandingVariant.login,
      showSignIn: false,
      showCreateAccount: false,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AuthHeader(
            title: 'Create a new password',
            subtitle:
                'Choose a new password for your account. The reset link can only be used once.',
          ),
          const SizedBox(height: AppSpacing.lg),
          AuthFormCard(child: ResetPasswordForm(token: token)),
        ],
      ),
    );
  }
}
