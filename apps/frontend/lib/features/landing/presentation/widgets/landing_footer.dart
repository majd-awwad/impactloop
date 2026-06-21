import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/landing_colors.dart';

class LandingFooter extends StatelessWidget {
  const LandingFooter({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.eco, size: 16, color: colors.primary),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              'Sustainable choices. Stronger communities. Smarter projects.',
              textAlign: TextAlign.center,
              style: AuthDarkTextStyles.body(
                context,
              ).copyWith(color: colors.textMuted),
            ),
          ),
        ],
      ),
    );
  }
}
