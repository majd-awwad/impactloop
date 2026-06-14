import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../views/complete_supplier_profile_mobile_view.dart';
import '../views/complete_supplier_profile_web_view.dart';

class CompleteSupplierProfilePage extends StatelessWidget {
  const CompleteSupplierProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final useWebLayout =
            constraints.maxWidth >= AppSpacing.authLayoutBreakpoint;

        if (useWebLayout) {
          return const CompleteSupplierProfileWebView();
        }

        return const CompleteSupplierProfileMobileView();
      },
    );
  }
}
