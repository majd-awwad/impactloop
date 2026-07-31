import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../l10n/l10n.dart';
import '../widgets/auth_form_card.dart';
import '../widgets/auth_header.dart';
import '../widgets/auth_shell.dart';
import '../widgets/complete_supplier_profile_form.dart';

class CompleteSupplierProfileMobileView extends StatelessWidget {
  const CompleteSupplierProfileMobileView({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return AuthShell(
      layout: AuthShellLayout.mobile,
      formContent: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AuthHeader(
            title: l10n.completeSupplierProfileTitle,
            subtitle: l10n.completeSupplierProfileSubtitle,
          ),
          const SizedBox(height: AppSpacing.lg),
          const AuthFormCard(child: CompleteSupplierProfileForm()),
        ],
      ),
    );
  }
}
