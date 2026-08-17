import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../domain/models/project_build.dart';
import '../../l10n/learning_project_build_l10n.dart';
import '../../theme/learning_ui_palette.dart';

class BuildProjectMaterialsHeader extends StatelessWidget {
  const BuildProjectMaterialsHeader({
    super.key,
    required this.ready,
    required this.total,
    required this.percent,
  });

  final int ready;
  final int total;
  final int percent;

  factory BuildProjectMaterialsHeader.fromBuild(ProjectBuild build) {
    return BuildProjectMaterialsHeader(
      ready: build.progress.ready,
      total: build.progress.total,
      percent: build.progress.percent.clamp(0, 100),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final allReady = total > 0 && ready >= total;
    final progress = total == 0 ? 0.0 : (percent / 100).clamp(0.0, 1.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    LearningProjectBuildL10n.materialsSectionTitle.resolve(
                      context,
                    ),
                    style: AppTextStyles.title(context).copyWith(
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w800,
                      fontSize: AppTextStyles.isCompact(context) ? 22 : 24,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    total == 0
                        ? LearningProjectBuildL10n.noRequiredComponents.resolve(
                            context,
                          )
                        : LearningProjectBuildL10n.readyCountShort(
                            ready: ready,
                            total: total,
                          ).resolve(context),
                    style: AppTextStyles.body(context).copyWith(
                      color: allReady ? palette.lime : palette.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: palette.limeSoft,
                borderRadius: AppRadius.mdAll,
              ),
              child: Icon(Icons.eco_rounded, color: palette.lime, size: 20),
            ),
          ],
        ),
        if (total > 0) ...[
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Text(
                '$ready/$total',
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textSecondary, fontSize: 12),
              ),
              const Spacer(),
              Text(
                '$percent%',
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textSecondary, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          ClipRRect(
            borderRadius: AppRadius.pillAll,
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: palette.mutedChip,
              color: palette.lime,
            ),
          ),
        ],
        if (allReady) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            LearningProjectBuildL10n.allMaterialsReady.resolve(context),
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
              height: 1.35,
              fontSize: 13,
            ),
          ),
        ],
      ],
    );
  }
}
