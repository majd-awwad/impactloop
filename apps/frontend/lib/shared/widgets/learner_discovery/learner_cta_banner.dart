import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import 'learner_discovery_layout.dart';

/// Compact create-project / discovery CTA banner.
class LearnerCtaBanner extends StatelessWidget {
  const LearnerCtaBanner({
    super.key,
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onAction,
    this.secondaryLabel,
    this.onSecondary,
    this.leading,
  });

  final String title;
  final String subtitle;
  final String actionLabel;
  final VoidCallback onAction;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact =
            LearnerDiscoveryLayout.isMobile(constraints.maxWidth) ||
            constraints.maxWidth < 720;

        final copy = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: AppTextStyles.title(context).copyWith(
                color: LearnerDiscoveryStyle.textPrimary(context),
                fontWeight: FontWeight.w800,
                fontSize: compact ? 14.5 : 18,
                height: 1.2,
              ),
              textAlign: TextAlign.start,
            ),
            SizedBox(height: compact ? 2 : AppSpacing.xs),
            Text(
              subtitle,
              style: AppTextStyles.body(context).copyWith(
                color: LearnerDiscoveryStyle.textSecondary(context),
                fontSize: compact ? 12 : 14,
                height: 1.3,
              ),
              textAlign: TextAlign.start,
              maxLines: compact ? 2 : 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        );

        final primaryButton = FilledButton.icon(
          onPressed: onAction,
          style: FilledButton.styleFrom(
            backgroundColor: LearnerDiscoveryStyle.primary(context),
            foregroundColor: LearnerDiscoveryStyle.textOnPrimary(context),
            minimumSize: Size(compact ? double.infinity : 0, 44),
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
          ),
          icon: const Icon(Icons.add_rounded, size: 20),
          label: Text(
            actionLabel,
            style: AppTextStyles.label(context).copyWith(
              color: LearnerDiscoveryStyle.textOnPrimary(context),
              fontWeight: FontWeight.w800,
            ),
          ),
        );

        final secondaryButton = secondaryLabel == null || onSecondary == null
            ? null
            : OutlinedButton.icon(
                onPressed: onSecondary,
                style: OutlinedButton.styleFrom(
                  foregroundColor:
                      LearnerDiscoveryStyle.textPrimary(context),
                  side: BorderSide(
                    color: LearnerDiscoveryStyle.border(context),
                  ),
                  minimumSize: Size(compact ? double.infinity : 0, 44),
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: AppRadius.lgAll,
                  ),
                ),
                icon: const Icon(Icons.assignment_outlined, size: 18),
                label: Text(secondaryLabel!),
              );

        final illustration = leading ??
            Icon(
              Icons.lightbulb_outline_rounded,
              size: compact ? 40 : 56,
              color: LearnerDiscoveryStyle.primary(context)
                  .withValues(alpha: 0.85),
            );

        if (compact) {
          final compactIllustration = leading ??
              Icon(
                Icons.lightbulb_outline_rounded,
                size: 28,
                color: LearnerDiscoveryStyle.primary(context)
                    .withValues(alpha: 0.85),
              );
          final compactPrimary = FilledButton.icon(
            onPressed: onAction,
            style: FilledButton.styleFrom(
              backgroundColor: LearnerDiscoveryStyle.primary(context),
              foregroundColor: LearnerDiscoveryStyle.textOnPrimary(context),
              minimumSize: const Size(0, 40),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.xs + 2,
              ),
              shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
            ),
            icon: const Icon(Icons.add_rounded, size: 18),
            label: Text(
              actionLabel,
              style: AppTextStyles.label(context).copyWith(
                color: LearnerDiscoveryStyle.textOnPrimary(context),
                fontWeight: FontWeight.w800,
              ),
            ),
          );
          final compactSecondary =
              secondaryLabel == null || onSecondary == null
                  ? null
                  : TextButton(
                      onPressed: onSecondary,
                      style: TextButton.styleFrom(
                        foregroundColor:
                            LearnerDiscoveryStyle.textPrimary(context),
                        minimumSize: const Size(0, 36),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        padding: const EdgeInsetsDirectional.symmetric(
                          horizontal: AppSpacing.sm,
                          vertical: AppSpacing.xs,
                        ),
                      ),
                      child: Text(secondaryLabel!),
                    );

          return Container(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm + 2,
            ),
            decoration:
                LearnerDiscoveryStyle.softPanelDecoration(context),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    compactIllustration,
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(child: copy),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(child: compactPrimary),
                    if (compactSecondary != null) ...[
                      const SizedBox(width: AppSpacing.xs),
                      compactSecondary,
                    ],
                  ],
                ),
              ],
            ),
          );
        }

        return Container(
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.md,
          ),
          decoration: LearnerDiscoveryStyle.softPanelDecoration(context),
          child: Row(
            children: [
              illustration,
              const SizedBox(width: AppSpacing.lg),
              Expanded(child: copy),
              const SizedBox(width: AppSpacing.lg),
              if (secondaryButton != null) ...[
                secondaryButton,
                const SizedBox(width: AppSpacing.sm),
              ],
              primaryButton,
            ],
          ),
        );
      },
    );
  }
}
