import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../widgets/auth_entry_branding_panel.dart';
import '../widgets/auth_form_card.dart';
import '../widgets/auth_header.dart';
import '../widgets/auth_shell.dart';
import '../views/register_footer.dart';

/// Deprecated fallback for old multi-page registration URLs.
class DeprecatedOnboardingPage extends StatefulWidget {
  const DeprecatedOnboardingPage({super.key});

  @override
  State<DeprecatedOnboardingPage> createState() =>
      _DeprecatedOnboardingPageState();
}

class _DeprecatedOnboardingPageState extends State<DeprecatedOnboardingPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.go('/register');
      }
    });
  }

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
            title: 'Registration has moved',
            subtitle:
                'ImpactLoop now completes sign-up in one place. Redirecting you to the registration wizard…',
          ),
          const SizedBox(height: AppSpacing.lg),
          const AuthFormCard(
            footer: RegisterFooter(),
            child: Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
                child: CircularProgressIndicator(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
