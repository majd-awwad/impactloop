import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../domain/learner_home_models.dart';

class HomeContinueProjectCard extends StatelessWidget {
  const HomeContinueProjectCard({super.key, required this.item});

  final LearnerHomeContinueProjectRecommendation item;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push('/learning/${item.projectId}/build'),
        borderRadius: AppRadius.lgAll,
        child: Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: palette.panelSurface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: palette.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.projectTitle,
                style: AppTextStyles.title(context).copyWith(
                  color: palette.textPrimary,
                ),
              ),
              if (item.shortDescription.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  item.shortDescription,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.sm),
              LinearProgressIndicator(
                value: item.totalCount == 0 ? 0 : item.progressPercent / 100,
                backgroundColor: palette.borderSubtle,
                color: palette.mint,
                minHeight: 8,
                borderRadius: AppRadius.pillAll,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                item.reasons.isNotEmpty
                    ? item.reasons.first
                    : '${item.readyCount} of ${item.totalCount} components ready',
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
