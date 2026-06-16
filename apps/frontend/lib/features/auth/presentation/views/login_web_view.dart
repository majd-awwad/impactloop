import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../widgets/auth_form_card.dart';
import '../widgets/auth_header.dart';
import '../widgets/auth_shell.dart';
import '../widgets/login_form.dart';
import 'login_footer.dart';

class LoginWebView extends StatelessWidget {
  const LoginWebView({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      layout: AuthShellLayout.webSplit,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AuthHeader(
            title: 'Welcome back',
            subtitle: 'Sign in to continue your learning journey.',
          ),
          const SizedBox(height: AppSpacing.lg),
          AuthFormCard(footer: const LoginFooter(), child: const LoginForm()),
        ],
      ),
    );
  }
}
