import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../theme/learning_ui_palette.dart';

class BuildMaterialStatusBadge extends StatelessWidget {
  const BuildMaterialStatusBadge({
    super.key,
    required this.label,
    required this.icon,
    required this.tone,
  });

  final String label;
  final IconData icon;
  final AppStatusTone tone;

  @override
  Widget build(BuildContext context) {
    final style = AppStatusStyle.of(context, tone);
    final palette = LearningUiPalette.of(context);
    final isReservedOutline =
        tone == AppStatusTone.primary && icon == Icons.bookmark_rounded;

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: isReservedOutline ? palette.cardSurface : style.background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(
          color: isReservedOutline
              ? style.foreground.withValues(alpha: 0.45)
              : style.border,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: style.foreground),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.label(context).copyWith(
                color: style.foreground,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                height: 1.1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
