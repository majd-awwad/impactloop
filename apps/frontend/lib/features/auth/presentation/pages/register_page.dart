import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../views/unified_register_views.dart';

class RegisterPage extends StatelessWidget {
  const RegisterPage({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final useWebLayout =
            constraints.maxWidth >= AppSpacing.authLayoutBreakpoint;

        if (useWebLayout) {
          return const UnifiedRegisterWebView();
        }

        return const UnifiedRegisterMobileView();
      },
    );
  }
}
