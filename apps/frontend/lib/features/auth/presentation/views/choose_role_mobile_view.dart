import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../widgets/auth_form_card.dart';
import '../widgets/auth_header.dart';
import '../widgets/auth_shell.dart';
import '../widgets/choose_role_form.dart';
import 'choose_role_footer.dart';

class ChooseRoleMobileView extends StatelessWidget {
  const ChooseRoleMobileView({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      layout: AuthShellLayout.mobile,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AuthHeader(
            title: 'How do you want to use ImpactLoop?',
            subtitle:
                'Choose your starting path. You can always add another role later.',
          ),
          const SizedBox(height: AppSpacing.lg),
          AuthFormCard(
            footer: const ChooseRoleFooter(),
            child: const ChooseRoleForm(),
          ),
        ],
      ),
    );
  }
}
