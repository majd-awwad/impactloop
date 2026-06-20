import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';

class HomeActionCard extends StatelessWidget {
  const HomeActionCard({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    required this.onPressed,
    this.enabled = true,
    this.badge,
  });

  final IconData icon;
  final String title;
  final String description;
  final VoidCallback? onPressed;
  final bool enabled;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final foreground = enabled ? palette.textPrimary : palette.textMuted;
    final accent = enabled ? palette.mint : palette.textMuted;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: AppRadius.lgAll,
        child: Container(
          constraints: const BoxConstraints(minHeight: 172),
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: enabled ? palette.cardSurface : palette.mutedSurface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(
              color: enabled ? palette.borderStrong : palette.borderSubtle,
            ),
            boxShadow: [
              BoxShadow(
                color: palette.cardShadow,
                blurRadius: 20,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: enabled ? 0.16 : 0.1),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: accent.withValues(alpha: enabled ? 0.42 : 0.22),
                      ),
                    ),
                    child: Icon(icon, color: accent, size: 22),
                  ),
                  if (badge != null)
                    Expanded(
                      child: Align(
                        alignment: AlignmentDirectional.centerEnd,
                        child: Container(
                          margin: const EdgeInsetsDirectional.only(
                            start: AppSpacing.sm,
                          ),
                          padding: const EdgeInsetsDirectional.symmetric(
                            horizontal: AppSpacing.sm,
                            vertical: AppSpacing.xs,
                          ),
                          decoration: BoxDecoration(
                            color: palette.cardSurfaceAlt,
                            borderRadius: AppRadius.pillAll,
                            border: Border.all(color: palette.borderSubtle),
                          ),
                          child: Text(
                            badge!,
                            style: AppTextStyles.label(context).copyWith(
                              color: accent,
                              fontSize: 12,
                              letterSpacing: 0,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    )
                  else
                    const Spacer(),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                title,
                style: AppTextStyles.title(
                  context,
                ).copyWith(color: foreground, letterSpacing: 0),
                textAlign: TextAlign.start,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                description,
                style: AppTextStyles.body(context).copyWith(
                  color: enabled ? palette.textSecondary : palette.textMuted,
                  height: 1.45,
                  letterSpacing: 0,
                ),
                textAlign: TextAlign.start,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
