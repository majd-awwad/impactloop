import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../l10n/l10n.dart';
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
          AuthHeader(
            title: context.l10n.createNewPassword,
            subtitle: context.l10n.resetPasswordSubtitle,
          ),
          const SizedBox(height: AppSpacing.lg),
          AuthFormCard(child: ResetPasswordForm(token: token)),
        ],
      ),
    );
  }
}
