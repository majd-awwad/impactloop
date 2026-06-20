import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../widgets/auth_entry_branding_panel.dart';
import '../widgets/auth_form_header.dart';
import '../widgets/dark_auth_form_card.dart';
import '../widgets/dark_auth_shell.dart';
import '../widgets/unified_register_form.dart';

class UnifiedRegisterView extends StatelessWidget {
  const UnifiedRegisterView({super.key});

  @override
  Widget build(BuildContext context) {
    return DarkAuthShell(
      brandingVariant: AuthEntryBrandingVariant.register,
      showSignIn: true,
      showCreateAccount: false,
      formMaxWidth: AppSpacing.authContentMaxWidth,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AuthFormHeader(
            title: 'Create your account',
            subtitle:
                'Tell us how you want to use ImpactLoop and set up your profile in one step.',
          ),
          const SizedBox(height: AppSpacing.lg),
          DarkAuthFormCard(
            footer: _RegisterFooter(),
            child: const UnifiedRegisterForm(),
          ),
        ],
      ),
    );
  }
}

class _RegisterFooter extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: AppSpacing.xs,
      children: [
        Text(
          'Already have an account?',
          style: AuthDarkTextStyles.body(context),
        ),
        TextButton(
          onPressed: () => context.go('/login'),
          child: Text('Sign in', style: AuthDarkTextStyles.link(context)),
        ),
      ],
    );
  }
}
