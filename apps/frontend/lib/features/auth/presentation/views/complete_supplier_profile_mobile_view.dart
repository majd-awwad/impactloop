import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../widgets/auth_form_card.dart';
import '../widgets/auth_header.dart';
import '../widgets/auth_shell.dart';
import '../widgets/complete_supplier_profile_form.dart';

class CompleteSupplierProfileMobileView extends StatelessWidget {
  const CompleteSupplierProfileMobileView({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      layout: AuthShellLayout.mobile,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AuthHeader(
            title: 'Complete your supplier profile',
            subtitle: 'Tell others what materials you share and where pickup works.',
          ),
          const SizedBox(height: AppSpacing.lg),
          const AuthFormCard(
            child: CompleteSupplierProfileForm(),
          ),
        ],
      ),
    );
  }
}
