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
    this.compact = false,
  });

  final IconData icon;
  final String title;
  final String description;
  final VoidCallback? onPressed;
  final bool enabled;
  final String? badge;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final foreground = enabled ? palette.textPrimary : palette.textMuted;
    final accent = enabled ? palette.mint : palette.textMuted;
    final shadow = enabled
        ? [
            BoxShadow(
              color: palette.cardShadow,
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ]
        : <BoxShadow>[];

    if (compact) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: AppRadius.lgAll,
          child: Container(
            width: double.infinity,
            height: double.infinity,
            padding: const EdgeInsetsDirectional.all(12),
            decoration: BoxDecoration(
              color: enabled
                  ? palette.cardSurface
                  : palette.mutedSurface.withValues(alpha: 0.66),
              borderRadius: AppRadius.lgAll,
              border: Border.all(
                color: enabled
                    ? palette.borderStrong
                    : palette.borderSubtle.withValues(alpha: 0.78),
              ),
              boxShadow: enabled
                  ? [
                      BoxShadow(
                        color: palette.cardShadow.withValues(alpha: 0.10),
                        blurRadius: 12,
                        offset: const Offset(0, 5),
                      ),
                    ]
                  : <BoxShadow>[],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: enabled ? 0.15 : 0.07),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: accent.withValues(
                            alpha: enabled ? 0.34 : 0.16,
                          ),
                        ),
                      ),
                      child: Icon(
                        icon,
                        color: accent.withValues(alpha: enabled ? 1 : 0.72),
                        size: 22,
                      ),
                    ),
                    const Spacer(),
                    if (badge != null)
                      Flexible(
                        child: Text(
                          badge!,
                          style: AppTextStyles.label(context).copyWith(
                            color: palette.textMuted,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0,
                          ),
                          textAlign: TextAlign.end,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      )
                    else
                      Icon(
                        Icons.arrow_forward_rounded,
                        color: accent.withValues(alpha: enabled ? 0.82 : 0.5),
                        size: 16,
                      ),
                  ],
                ),
                const Spacer(),
                Flexible(
                  child: Text(
                    title,
                    style: AppTextStyles.title(context).copyWith(
                      color: foreground,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      height: 1.12,
                      letterSpacing: 0,
                    ),
                    textAlign: TextAlign.start,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(height: 3),
                Flexible(
                  child: Text(
                    description,
                    style: AppTextStyles.label(context).copyWith(
                      color:
                          enabled ? palette.textSecondary : palette.textMuted,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                      height: 1.1,
                      letterSpacing: 0,
                    ),
                    textAlign: TextAlign.start,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: AppRadius.lgAll,
        child: Container(
          width: double.infinity,
          constraints: BoxConstraints(minHeight: enabled ? 156 : 148),
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: enabled
                ? palette.cardSurface
                : palette.mutedSurface.withValues(alpha: 0.66),
            borderRadius: AppRadius.lgAll,
            border: Border.all(
              color: enabled
                  ? palette.borderStrong
                  : palette.borderSubtle.withValues(alpha: 0.78),
            ),
            boxShadow: shadow,
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
                      color: accent.withValues(alpha: enabled ? 0.16 : 0.07),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: accent.withValues(alpha: enabled ? 0.42 : 0.16),
                      ),
                    ),
                    child: Icon(
                      icon,
                      color: accent.withValues(alpha: enabled ? 1 : 0.72),
                      size: 22,
                    ),
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
                            color: palette.cardSurfaceAlt.withValues(
                              alpha: enabled ? 1 : 0.68,
                            ),
                            borderRadius: AppRadius.pillAll,
                            border: Border.all(
                              color: palette.borderSubtle.withValues(
                                alpha: 0.78,
                              ),
                            ),
                          ),
                          child: Text(
                            badge!,
                            style: AppTextStyles.label(context).copyWith(
                              color: palette.textMuted,
                              fontSize: 11.5,
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
              const SizedBox(height: AppSpacing.md),
              Text(
                title,
                style: AppTextStyles.title(
                  context,
                ).copyWith(color: foreground, letterSpacing: 0),
                textAlign: TextAlign.start,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: AppSpacing.sm),
              Flexible(
                child: Text(
                  description,
                  style: AppTextStyles.body(context).copyWith(
                    color: enabled ? palette.textSecondary : palette.textMuted,
                    height: 1.3,
                    letterSpacing: 0,
                  ),
                  textAlign: TextAlign.start,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
