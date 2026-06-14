import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_link_button.dart';

class RegisterFooter extends StatelessWidget {
  const RegisterFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: AppSpacing.xs,
      children: [
        Text('Already have an account?', style: AppTextStyles.body(context)),
        UnconstrainedBox(
          constrainedAxis: Axis.horizontal,
          child: AppLinkButton(
            label: 'Sign in',
            alignment: Alignment.center,
            onPressed: () => context.go('/login'),
          ),
        ),
      ],
    );
  }
}
