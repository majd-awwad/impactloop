import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../widgets/auth_entry_branding_panel.dart';
import '../widgets/auth_form_card.dart';
import '../widgets/auth_header.dart';
import '../widgets/auth_shell.dart';
import '../widgets/unified_register_form.dart';
import 'register_footer.dart';

class UnifiedRegisterView extends StatelessWidget {
  const UnifiedRegisterView({super.key});

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
          const AuthHeader(
            title: 'Create your account',
            subtitle:
                'Tell us how you want to use ImpactLoop and set up your profile in one step.',
          ),
          const SizedBox(height: AppSpacing.lg),
          const AuthFormCard(
            footer: RegisterFooter(),
            child: UnifiedRegisterForm(),
          ),
        ],
      ),
    );
  }
}
