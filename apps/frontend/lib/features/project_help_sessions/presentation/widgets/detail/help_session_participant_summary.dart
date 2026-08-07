import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../../../shared/widgets/user_avatar.dart';

class HelpSessionParticipantSummary extends StatelessWidget {
  const HelpSessionParticipantSummary({
    super.key,
    required this.displayName,
    required this.subtitle,
    this.profileImageUrl,
  });

  final String displayName;
  final String subtitle;
  final String? profileImageUrl;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Row(
      children: [
        UserAvatar(
          profileImageUrl: profileImageUrl,
          displayName: displayName,
          radius: 18,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                displayName,
                style: AppTextStyles.label(context).copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                subtitle,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
