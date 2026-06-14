import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../views/choose_role_mobile_view.dart';
import '../views/choose_role_web_view.dart';

class ChooseRolePage extends StatelessWidget {
  const ChooseRolePage({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final useWebLayout =
            constraints.maxWidth >= AppSpacing.authLayoutBreakpoint;

        if (useWebLayout) {
          return const ChooseRoleWebView();
        }

        return const ChooseRoleMobileView();
      },
    );
  }
}
