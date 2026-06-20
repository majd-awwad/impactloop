import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
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
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: materialCardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: materialBorderStrong),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: materialCardSurfaceAlt,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: materialBorderSubtle),
            ),
            child: Icon(icon, color: materialMint, size: 22),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: materialTextPrimary, letterSpacing: 0),
            textAlign: TextAlign.start,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            description,
            style: AppTextStyles.body(context).copyWith(
              color: materialTextSecondary,
              height: 1.45,
              letterSpacing: 0,
            ),
            textAlign: TextAlign.start,
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.md),
            OutlinedButton(
              onPressed: onAction,
              style: OutlinedButton.styleFrom(
                foregroundColor: materialMint,
                side: const BorderSide(color: materialBorderStrong),
                shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
              ),
              child: Text(actionLabel!),
            ),
          ],
        ],
      ),
    );
  }
}
