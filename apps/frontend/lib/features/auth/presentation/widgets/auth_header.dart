import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import 'auth_ui_palette.dart';

class AuthHeader extends StatelessWidget {
  const AuthHeader({super.key, required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.w800,
            height: 1.16,
            color: colors.textPrimary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          subtitle,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w400,
            height: 1.5,
            color: colors.textSecondary,
          ),
        ),
      ],
    );
  }
}
