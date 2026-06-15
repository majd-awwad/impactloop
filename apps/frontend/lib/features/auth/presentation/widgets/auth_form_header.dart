import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';

class AuthFormHeader extends StatelessWidget {
  const AuthFormHeader({
    super.key,
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: AuthDarkTextStyles.display(context)),
        const SizedBox(height: AppSpacing.sm),
        Text(subtitle, style: AuthDarkTextStyles.subtitle(context)),
      ],
    );
  }
}
