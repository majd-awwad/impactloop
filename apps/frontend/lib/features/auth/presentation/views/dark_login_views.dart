import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../widgets/auth_entry_branding_panel.dart';
import '../widgets/auth_form_header.dart';
import '../widgets/dark_auth_form_card.dart';
import '../widgets/dark_auth_shell.dart';
import '../widgets/dark_login_form.dart';

class DarkLoginView extends StatelessWidget {
  const DarkLoginView({super.key});

  @override
  Widget build(BuildContext context) {
    return DarkAuthShell(
      brandingVariant: AuthEntryBrandingVariant.login,
      showSignIn: false,
      showCreateAccount: true,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AuthFormHeader(
            title: 'Welcome back',
            subtitle:
                'Sign in to continue discovering materials and building with less waste.',
          ),
          const SizedBox(height: AppSpacing.lg),
          DarkAuthFormCard(
            footer: _LoginFooter(),
            child: const DarkLoginForm(),
          ),
        ],
      ),
    );
  }
}

class _LoginFooter extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: AppSpacing.xs,
      children: [
        Text('New to ImpactLoop?', style: AuthDarkTextStyles.body(context)),
        TextButton(
          onPressed: () => context.go('/register'),
          child: Text('Create account', style: AuthDarkTextStyles.link(context)),
        ),
      ],
    );
  }
}
