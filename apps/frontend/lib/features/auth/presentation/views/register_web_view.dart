import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../widgets/auth_form_card.dart';
import '../widgets/auth_header.dart';
import '../widgets/auth_shell.dart';
import '../widgets/register_form.dart';
import 'register_footer.dart';

class RegisterWebView extends StatelessWidget {
  const RegisterWebView({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      layout: AuthShellLayout.webSplit,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AuthHeader(
            title: 'Create your account',
            subtitle: 'Join ImpactLoop to learn, reuse, and build.',
          ),
          const SizedBox(height: AppSpacing.lg),
          AuthFormCard(
            footer: const RegisterFooter(),
            child: const RegisterForm(),
          ),
        ],
      ),
    );
  }
}
