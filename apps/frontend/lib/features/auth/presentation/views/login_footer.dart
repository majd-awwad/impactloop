import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_link_button.dart';

class LoginFooter extends StatelessWidget {
  const LoginFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: AppSpacing.xs,
      children: [
        Text('New to ImpactLoop?', style: AppTextStyles.body(context)),
        UnconstrainedBox(
          constrainedAxis: Axis.horizontal,
          child: AppLinkButton(
            label: 'Create account',
            alignment: Alignment.center,
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Register screen coming soon.')),
              );
            },
          ),
        ),
      ],
    );
  }
}
