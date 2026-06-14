import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../views/register_mobile_view.dart';
import '../views/register_web_view.dart';

class RegisterPage extends StatelessWidget {
  const RegisterPage({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final useWebLayout =
            constraints.maxWidth >= AppSpacing.authLayoutBreakpoint;

        if (useWebLayout) {
          return const RegisterWebView();
        }

        return const RegisterMobileView();
      },
    );
  }
}
