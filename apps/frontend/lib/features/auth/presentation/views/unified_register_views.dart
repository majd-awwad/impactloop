import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../l10n/l10n.dart';
import '../models/registration_intent.dart';
import '../widgets/auth_entry_branding_panel.dart';
import '../widgets/auth_form_card.dart';
import '../widgets/auth_header.dart';
import '../widgets/auth_shell.dart';
import '../widgets/registration_wizard.dart';
import 'register_footer.dart';

class UnifiedRegisterView extends StatelessWidget {
  const UnifiedRegisterView({super.key, this.initialIntent});

  final RegistrationIntent? initialIntent;

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      brandingVariant: AuthEntryBrandingVariant.register,
      showSignIn: true,
      showCreateAccount: false,
      formMaxWidth: AppSpacing.authContentMaxWidth,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthHeader(
            title: context.l10n.createYourAccount,
            subtitle: context.l10n.registerSubtitle,
          ),
          const SizedBox(height: AppSpacing.lg),
          AuthFormCard(
            footer: const RegisterFooter(),
            child: RegistrationWizard(initialIntent: initialIntent),
          ),
        ],
      ),
    );
  }
}
