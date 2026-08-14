import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../domain/models/smart_build_plan.dart';
import '../../theme/learning_ui_palette.dart';
import 'smart_build_plan_item_groups.dart';
import 'smart_build_plan_plan_summary_card.dart';
import 'smart_build_plan_sections.dart';

class SmartBuildPlanWorkspaceLayout extends StatelessWidget {
  const SmartBuildPlanWorkspaceLayout({
    super.key,
    required this.projectId,
    required this.buildId,
    required this.selectedPlan,
    required this.groups,
    required this.onRefresh,
    required this.onBack,
  });

  final String projectId;
  final String buildId;
  final SmartBuildPlan selectedPlan;
  final SmartBuildPlanItemGroups groups;
  final Future<void> Function() onRefresh;
  final VoidCallback onBack;

  static const desktopBreakpoint = 900.0;
  static const sidebarWidth = 300.0;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    final mainColumn = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SmartBuildPlanPlanSummaryCard(plan: selectedPlan),
        const SizedBox(height: AppSpacing.md),
        if (!groups.hasRecommendations && groups.uncovered.isNotEmpty)
          SmartBuildPlanNoRecommendationsState(
            missingCount: groups.uncovered.length,
            missingItems: groups.uncovered,
            projectId: projectId,
            buildId: buildId,
            onRefresh: onRefresh,
            onBack: onBack,
          )
        else if (groups.hasRecommendations)
          SmartBuildPlanRecommendedSection(
            projectId: projectId,
            items: groups.planned,
          ),
      ],
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final useDesktopLayout = constraints.maxWidth >= desktopBreakpoint;
        final sidebar = SmartBuildPlanSidebarSections(
          projectId: projectId,
          buildId: buildId,
          groups: groups,
          compact: useDesktopLayout,
          onRefresh: onRefresh,
        );

        if (!useDesktopLayout) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              mainColumn,
              const SizedBox(height: AppSpacing.md),
              sidebar,
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: mainColumn),
            const SizedBox(width: AppSpacing.md),
            SizedBox(
              width: sidebarWidth,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: palette.pageBackground,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: sidebar,
              ),
            ),
          ],
        );
      },
    );
  }
}
