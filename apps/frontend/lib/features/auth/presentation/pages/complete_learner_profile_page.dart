import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../views/complete_learner_profile_mobile_view.dart';
import '../views/complete_learner_profile_web_view.dart';

class CompleteLearnerProfilePage extends StatelessWidget {
  const CompleteLearnerProfilePage({
    super.key,
    this.showSupplierNextHint = false,
  });

  final bool showSupplierNextHint;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final useWebLayout =
            constraints.maxWidth >= AppSpacing.authLayoutBreakpoint;

        if (useWebLayout) {
          return CompleteLearnerProfileWebView(
            showSupplierNextHint: showSupplierNextHint,
          );
        }

        return CompleteLearnerProfileMobileView(
          showSupplierNextHint: showSupplierNextHint,
        );
      },
    );
  }
}
