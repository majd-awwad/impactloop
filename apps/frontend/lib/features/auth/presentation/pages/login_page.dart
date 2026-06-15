import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../views/dark_login_views.dart';

class LoginPage extends StatelessWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final useWebLayout =
            constraints.maxWidth >= AppSpacing.authLayoutBreakpoint;

        if (useWebLayout) {
          return const DarkLoginWebView();
        }

        return const DarkLoginMobileView();
      },
    );
  }
}
