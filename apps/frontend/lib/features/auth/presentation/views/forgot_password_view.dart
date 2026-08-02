import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../l10n/l10n.dart';
import '../widgets/auth_entry_branding_panel.dart';
import '../widgets/auth_form_card.dart';
import '../widgets/auth_header.dart';
import '../widgets/auth_shell.dart';
import '../widgets/forgot_password_form.dart';

class ForgotPasswordView extends StatelessWidget {
  const ForgotPasswordView({super.key, this.initialEmail});

  final String? initialEmail;

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      brandingVariant: AuthEntryBrandingVariant.login,
      showSignIn: false,
      showCreateAccount: true,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthHeader(
            title: context.l10n.resetYourPassword,
            subtitle: context.l10n.forgotPasswordSubtitle,
          ),
          const SizedBox(height: AppSpacing.lg),
          AuthFormCard(child: ForgotPasswordForm(initialEmail: initialEmail)),
        ],
      ),
    );
  }
}
