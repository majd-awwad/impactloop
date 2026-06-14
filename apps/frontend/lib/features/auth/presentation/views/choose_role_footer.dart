import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_link_button.dart';

class ChooseRoleFooter extends StatelessWidget {
  const ChooseRoleFooter({super.key});

  @override
  Widget build(BuildContext context) {
    final bodyStyle = AppTextStyles.body(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text('Need to go back?', style: bodyStyle, textAlign: TextAlign.center),
        const SizedBox(height: AppSpacing.xs),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            UnconstrainedBox(
              constrainedAxis: Axis.horizontal,
              child: AppLinkButton(
                label: 'Register',
                alignment: Alignment.center,
                onPressed: () => context.go('/register'),
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Text('or', style: bodyStyle),
            const SizedBox(width: AppSpacing.xs),
            UnconstrainedBox(
              constrainedAxis: Axis.horizontal,
              child: AppLinkButton(
                label: 'Sign in',
                alignment: Alignment.center,
                onPressed: () => context.go('/login'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
