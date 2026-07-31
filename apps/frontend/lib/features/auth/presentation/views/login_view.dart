import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../l10n/l10n.dart';
import '../widgets/auth_entry_branding_panel.dart';
import '../widgets/auth_form_card.dart';
import '../widgets/auth_header.dart';
import '../widgets/auth_shell.dart';
import '../widgets/login_form.dart';
import 'login_footer.dart';

class LoginView extends StatelessWidget {
  const LoginView({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      brandingVariant: AuthEntryBrandingVariant.login,
      showSignIn: false,
      showCreateAccount: true,
      formStageTone: AuthFormStageTone.subtle,
      splitBrandingFlex: 10,
      splitFormFlex: 9,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthHeader(
            title: context.l10n.welcomeBack,
            subtitle: context.l10n.loginSubtitle,
          ),
          const SizedBox(height: AppSpacing.md),
          const AuthFormCard(footer: LoginFooter(), child: LoginForm()),
        ],
      ),
    );
  }
}
