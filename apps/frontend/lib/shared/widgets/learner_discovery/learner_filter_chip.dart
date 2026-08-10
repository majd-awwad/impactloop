import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import 'learner_discovery_layout.dart';

enum LearnerFilterChipStyle {
  /// Soft pale-green selected state (default for filters/categories).
  soft,

  /// Solid primary fill with on-primary text (mobile "All" style).
  solid,
}

/// Shared filter/category chip used across Materials and Learning Hub.
class LearnerFilterChip extends StatelessWidget {
  const LearnerFilterChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onSelected,
    this.icon,
    this.style = LearnerFilterChipStyle.soft,
    this.dense = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onSelected;
  final IconData? icon;
  final LearnerFilterChipStyle style;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final primary = LearnerDiscoveryStyle.primary(context);
    final soft = LearnerDiscoveryStyle.primarySoft(context);
    final isSolid = style == LearnerFilterChipStyle.solid && selected;

    final Color background;
    final Color border;
    final Color foreground;

    if (isSolid) {
      background = primary;
      border = primary;
      foreground = LearnerDiscoveryStyle.textOnPrimary(context);
    } else if (selected) {
      background = soft;
      border = primary.withValues(alpha: 0.45);
      foreground = primary;
    } else {
      background = LearnerDiscoveryStyle.cardSurface(context);
      border = LearnerDiscoveryStyle.border(context);
      foreground = LearnerDiscoveryStyle.textSecondary(context);
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onSelected,
        borderRadius: AppRadius.pillAll,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOut,
          constraints: BoxConstraints(
            minHeight: dense
                ? 34
                : LearnerDiscoveryLayout.chipMinHeight,
          ),
          padding: EdgeInsetsDirectional.symmetric(
            horizontal: dense ? AppSpacing.sm + 2 : AppSpacing.md,
            vertical: dense ? 6 : AppSpacing.xs + 2,
          ),
          decoration: BoxDecoration(
            color: background,
            borderRadius: AppRadius.pillAll,
            border: Border.all(color: border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: dense ? 15 : 16, color: foreground),
                const SizedBox(width: 6),
              ],
              Flexible(
                child: Text(
                  label,
                  style: AppTextStyles.label(context).copyWith(
                    color: foreground,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                    fontSize: dense ? 12.5 : 13,
                    letterSpacing: 0,
                  ),
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
}

/// Outlined filter action button ("Filters" / "تصفية").
class LearnerFilterActionButton extends StatelessWidget {
  const LearnerFilterActionButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.active = false,
    this.icon = Icons.tune_rounded,
  });

  final String label;
  final VoidCallback onPressed;
  final bool active;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final primary = LearnerDiscoveryStyle.primary(context);
    final foreground = active
        ? primary
        : LearnerDiscoveryStyle.textPrimary(context);
    final border = active
        ? primary.withValues(alpha: 0.55)
        : LearnerDiscoveryStyle.border(context);
    final background = active
        ? LearnerDiscoveryStyle.primarySoft(context)
        : LearnerDiscoveryStyle.cardSurface(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: AppRadius.lgAll,
        child: Container(
          constraints: const BoxConstraints(
            minHeight: LearnerDiscoveryLayout.filterControlHeight,
          ),
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: background,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: foreground),
              const SizedBox(width: AppSpacing.xs),
              Text(
                label,
                style: AppTextStyles.label(context).copyWith(
                  color: foreground,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
