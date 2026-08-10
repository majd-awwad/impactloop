import 'package:flutter/material.dart';

import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import 'learner_discovery_layout.dart';

/// Compact page header shared by Materials Discovery and Learning Hub.
class LearnerPageHeader extends StatelessWidget {
  const LearnerPageHeader({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final String title;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact =
            LearnerDiscoveryLayout.isMobile(constraints.maxWidth);
        final titleSize = compact ? 22.0 : 26.0;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  size: compact ? 24 : 28,
                  color: LearnerDiscoveryStyle.primary(context),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    title,
                    style: AppTextStyles.title(context).copyWith(
                      color: LearnerDiscoveryStyle.textPrimary(context),
                      fontWeight: FontWeight.w800,
                      fontSize: titleSize,
                      height: 1.2,
                      letterSpacing: 0,
                    ),
                    textAlign: TextAlign.start,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              subtitle,
              style: AppTextStyles.body(context).copyWith(
                color: LearnerDiscoveryStyle.textSecondary(context),
                fontSize: compact ? 13 : 14,
                height: 1.4,
              ),
              textAlign: TextAlign.start,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        );
      },
    );
  }
}
