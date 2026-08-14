import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_section_card.dart';
import '../../application/learning_hub_providers.dart';
import '../../application/project_build_refresh.dart';
import '../../domain/models/smart_build_plan.dart';
import '../l10n/smart_build_plan_l10n.dart';
import '../theme/learning_ui_palette.dart';
import '../widgets/smart_build_plan/smart_build_plan_advisory_strip.dart';
import '../widgets/smart_build_plan/smart_build_plan_item_groups.dart';
import '../widgets/smart_build_plan/smart_build_plan_page_header.dart';
import '../widgets/smart_build_plan/smart_build_plan_workspace_layout.dart';
import '../widgets/smart_build_plan/smart_build_plan_selector.dart';
import '../widgets/smart_build_plan/smart_build_plan_selection.dart';
import '../widgets/smart_build_plan/smart_build_plan_summary_section.dart';

class SmartBuildPlanPage extends ConsumerStatefulWidget {
  const SmartBuildPlanPage({super.key, required this.projectId});

  final String projectId;

  @override
  ConsumerState<SmartBuildPlanPage> createState() => _SmartBuildPlanPageState();
}

class _SmartBuildPlanPageState extends ConsumerState<SmartBuildPlanPage> {
  SmartBuildPlanSelection? _preferredSelection;

  void _invalidatePlanData() {
    ref.refreshLinkedProjectBuild(widget.projectId);
    ref.refreshSmartBuildPlan(widget.projectId);
  }

  Future<void> _refresh() async {
    _invalidatePlanData();
    await ref.read(smartBuildPlanProvider(widget.projectId).future);
  }

  void _onPlanSelected(SmartBuildPlan plan) {
    setState(() {
      _preferredSelection = selectionFromPlan(plan);
    });
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final planAsync = ref.watch(smartBuildPlanProvider(widget.projectId));
    final projectAsync = ref.watch(learningProjectProvider(widget.projectId));
    final projectTitle = projectAsync.maybeWhen(
      data: (project) => project?.title.resolve(context),
      orElse: () => null,
    );

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: planAsync.when(
        loading: () => Column(
          children: [
            SmartBuildPlanPageHeader(
              projectTitle: projectTitle,
              generatedAt: DateTime.now(),
              isRefreshing: false,
              onBack: () => context.popOrGo('/learning/${widget.projectId}/build'),
              onRefresh: _refresh,
            ),
            const Expanded(child: Center(child: CircularProgressIndicator())),
          ],
        ),
        error: (error, stackTrace) => Column(
          children: [
            SmartBuildPlanPageHeader(
              projectTitle: projectTitle,
              generatedAt: DateTime.now(),
              isRefreshing: false,
              onBack: () => context.popOrGo('/learning/${widget.projectId}/build'),
              onRefresh: _refresh,
            ),
            Expanded(
              child: _ErrorState(
                message: error is ApiException ? error.message : error.toString(),
                onRetry: _refresh,
              ),
            ),
          ],
        ),
        data: (result) {
          final selectedIndex = resolveSelectedPlanIndex(
            plans: result.plans,
            preferred: _preferredSelection,
          );
          final selectedPlan = result.plans.isEmpty
              ? null
              : result.plans[selectedIndex.clamp(0, result.plans.length - 1)];
          final groups = selectedPlan == null
              ? const SmartBuildPlanItemGroups(
                  planned: [],
                  inProgress: [],
                  alreadySatisfied: [],
                  attention: [],
                  uncovered: [],
                )
              : SmartBuildPlanItemGroups.fromItems(selectedPlan.items);

          return Column(
            children: [
              SmartBuildPlanPageHeader(
                projectTitle: projectTitle,
                generatedAt: result.generatedAt,
                isRefreshing: planAsync.isLoading,
                onBack: () => context.popOrGo('/learning/${widget.projectId}/build'),
                onRefresh: _refresh,
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _refresh,
                  child: ListView(
                    padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                    children: [
                      Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 1200),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const SmartBuildPlanAdvisoryStrip(),
                              const SizedBox(height: AppSpacing.md),
                              SmartBuildPlanSummarySection(summary: result.summary),
                              const SizedBox(height: AppSpacing.md),
                              if (!result.hasOptimizableItems &&
                                  result.summary.optimizable == 0)
                                _NoOptimizableState(onBack: () {
                                  context.popOrGo('/learning/${widget.projectId}/build');
                                })
                              else if (result.plans.isEmpty)
                                _NoOptimizableState(onBack: () {
                                  context.popOrGo('/learning/${widget.projectId}/build');
                                })
                              else if (selectedPlan != null) ...[
                                SmartBuildPlanSelector(
                                  plans: result.plans,
                                  selectedIndex: selectedIndex,
                                  onSelected: (index) {
                                    _onPlanSelected(result.plans[index]);
                                  },
                                ),
                                const SizedBox(height: AppSpacing.md),
                                SmartBuildPlanWorkspaceLayout(
                                  projectId: widget.projectId,
                                  buildId: result.buildId,
                                  selectedPlan: selectedPlan,
                                  groups: groups,
                                  onRefresh: _refresh,
                                  onBack: () {
                                    context.popOrGo('/learning/${widget.projectId}/build');
                                  },
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Center(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded, size: 44, color: palette.lime),
            const SizedBox(height: AppSpacing.md),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTextStyles.body(context).copyWith(
                color: palette.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            FilledButton(
              onPressed: onRetry,
              child: Text(SmartBuildPlanL10n.retry.resolve(context)),
            ),
          ],
        ),
      ),
    );
  }
}

class _NoOptimizableState extends StatelessWidget {
  const _NoOptimizableState({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return AppSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            SmartBuildPlanL10n.noOptimizableTitle.resolve(context),
            style: AppTextStyles.title(context).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            SmartBuildPlanL10n.noOptimizableBody.resolve(context),
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
              height: 1.45,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton(
            onPressed: onBack,
            child: Text(SmartBuildPlanL10n.backToBuild.resolve(context)),
          ),
        ],
      ),
    );
  }
}
