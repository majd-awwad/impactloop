import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../widgets/dark_auth_form_card.dart';
import '../widgets/dark_auth_shell.dart';
import '../widgets/dark_login_form.dart';

class DarkLoginWebView extends StatelessWidget {
  const DarkLoginWebView({super.key});

  @override
  Widget build(BuildContext context) {
    return DarkAuthShell(
      layout: DarkAuthShellLayout.webSplit,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const DarkAuthHeader(
            title: 'Welcome back',
            subtitle: 'Sign in to continue your learning journey.',
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

class DarkLoginMobileView extends StatelessWidget {
  const DarkLoginMobileView({super.key});

  @override
  Widget build(BuildContext context) {
    return DarkAuthShell(
      layout: DarkAuthShellLayout.mobile,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const DarkAuthHeader(
            title: 'Welcome back',
            subtitle: 'Sign in to continue your learning journey.',
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
