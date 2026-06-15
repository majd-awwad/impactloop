import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../widgets/dark_auth_form_card.dart';
import '../widgets/dark_auth_shell.dart';
import '../widgets/unified_register_form.dart';

class UnifiedRegisterWebView extends StatelessWidget {
  const UnifiedRegisterWebView({super.key});

  @override
  Widget build(BuildContext context) {
    return DarkAuthShell(
      layout: DarkAuthShellLayout.webSplit,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const DarkAuthHeader(
            title: 'Create your account',
            subtitle: 'Join ImpactLoop to learn, reuse, and build.',
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

class UnifiedRegisterMobileView extends StatelessWidget {
  const UnifiedRegisterMobileView({super.key});

  @override
  Widget build(BuildContext context) {
    return DarkAuthShell(
      layout: DarkAuthShellLayout.mobile,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const DarkAuthHeader(
            title: 'Create your account',
            subtitle: 'Join ImpactLoop to learn, reuse, and build.',
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
        Text('Already have an account?', style: AuthDarkTextStyles.body(context)),
        TextButton(
          onPressed: () => context.go('/login'),
          child: Text('Sign in', style: AuthDarkTextStyles.link(context)),
        ),
      ],
    );
  }
}
