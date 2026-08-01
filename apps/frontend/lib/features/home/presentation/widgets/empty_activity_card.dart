import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';

class EmptyActivityCard extends StatelessWidget {
  const EmptyActivityCard({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String description;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: palette.cardSurfaceAlt,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: palette.borderSubtle),
            ),
            child: Icon(icon, color: palette.mint, size: 22),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary, letterSpacing: 0),
            textAlign: TextAlign.start,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            description,
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
              height: 1.45,
              letterSpacing: 0,
            ),
            textAlign: TextAlign.start,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.md),
            OutlinedButton(
              onPressed: onAction,
              style: AppStatusButtonStyle.outlined(
                context,
                AppStatusTone.neutral,
              ),
              child: Text(actionLabel!),
            ),
          ],
        ],
      ),
    );
  }
}
