import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../learner_builds/application/learner_builds_providers.dart';
import '../../../learner_builds/presentation/l10n/learner_builds_l10n.dart';
import '../../application/learning_hub_providers.dart';
import '../../domain/models/learning_project.dart';
import '../../domain/models/project_build.dart';
import '../l10n/learning_hub_coverage_l10n.dart';
import '../theme/learning_ui_palette.dart';

class ProjectBuildActionsPanel extends ConsumerStatefulWidget {
  const ProjectBuildActionsPanel({
    super.key,
    required this.project,
    this.recommendationImpressionId,
  });

  final LearningProject project;
  final String? recommendationImpressionId;

  @override
  ConsumerState<ProjectBuildActionsPanel> createState() =>
      _ProjectBuildActionsPanelState();
}

class _ProjectBuildActionsPanelState
    extends ConsumerState<ProjectBuildActionsPanel> {
  bool _isStarting = false;
  bool _isLifecycleBusy = false;

  Future<void> _startOrContinueBuild({required bool hasBuild}) async {
    final projectId = widget.project.id;
    final destination = '/learning/$projectId/build';

    if (hasBuild) {
      context.go(destination, extra: widget.recommendationImpressionId);
      return;
    }

    final authState = ref.read(authControllerProvider);
    if (authState.status != AuthStatus.authenticated) {
      context.go('/login?from=${Uri.encodeQueryComponent(destination)}');
      return;
    }

    if (authState.user?.hasRole('LEARNER') != true) {
      showInfoSnackBar(context, 'Use a learner account to start builds.');
      return;
    }

    setState(() => _isStarting = true);
    try {
      await ref
          .read(learningHubRepositoryProvider)
          .startBuild(
            projectId,
            recommendationImpressionId: widget.recommendationImpressionId,
          );
      ref.invalidate(projectBuildProvider(projectId));
      if (mounted) {
        context.go(destination, extra: widget.recommendationImpressionId);
      }
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _isStarting = false);
      }
    }
  }

  Future<void> _resumeBuild(ProjectBuild build) async {
    setState(() => _isLifecycleBusy = true);
    try {
      await resumeLearnerBuild(ref, build.id);
      if (mounted) {
        context.go('/learning/${build.projectId}/build');
      }
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _isLifecycleBusy = false);
      }
    }
  }

  Future<void> _buildAgain(ProjectBuild build) async {
    setState(() => _isLifecycleBusy = true);
    try {
      await buildProjectAgain(ref, build.projectId);
      if (mounted) {
        context.go('/learning/${build.projectId}/build');
      }
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _isLifecycleBusy = false);
      }
    }
  }

  void _browseMaterials() {
    context.go('/materials');
  }

  void _openBuild(ProjectBuild build) {
    context.go('/learning/${build.projectId}/build');
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final authState = ref.watch(authControllerProvider);
    final canFetchBuild =
        authState.status == AuthStatus.authenticated &&
        authState.user?.hasRole('LEARNER') == true;
    final buildAsync = canFetchBuild
        ? ref.watch(projectBuildProvider(widget.project.id))
        : const AsyncValue.data(null);
    final componentCount = widget.project.requiredComponents.isNotEmpty
        ? widget.project.requiredComponents.length
        : widget.project.components.length;
    final isBusy = _isStarting || _isLifecycleBusy;

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: buildAsync.when(
        loading: () => _BuildPanelContent(
          project: widget.project,
          componentCount: componentCount,
          isBusy: true,
          hasBuild: false,
          onStartOrContinue: null,
          onBrowseMaterials: _browseMaterials,
        ),
        error: (error, stackTrace) => _BuildPanelContent(
          project: widget.project,
          componentCount: componentCount,
          isBusy: isBusy,
          hasBuild: false,
          statusText: 'Checklist status is unavailable right now.',
          onStartOrContinue: componentCount == 0
              ? null
              : () => _startOrContinueBuild(hasBuild: false),
          onBrowseMaterials: _browseMaterials,
        ),
        data: (build) {
          final personal = widget.project.personalBuildReadiness;
          final l10n = LearningHubCoverageL10n.of(context);
          final readyCount = personal?.readyComponents ?? build?.progress.ready;
          final totalRequired =
              personal?.totalRequiredComponents ?? build?.progress.total;
          final statusText = build == null
              ? null
              : personal != null && personal.isInProgress
              ? l10n.personalReadinessSummary(personal)
              : totalRequired == null
              ? null
              : '$readyCount of $totalRequired ready in your build';

          final primaryLabel = build == null
              ? 'Start build'
              : switch (build.status) {
                  ProjectBuildStatus.paused =>
                    LearnerBuildsL10n.resumeBuild.resolve(context),
                  ProjectBuildStatus.completed =>
                    LearnerBuildsL10n.viewCompleted.resolve(context),
                  ProjectBuildStatus.archived =>
                    LearnerBuildsL10n.viewCompleted.resolve(context),
                  ProjectBuildStatus.inProgress => 'Continue checklist',
                };

          VoidCallback? onPrimary;
          if (!isBusy && componentCount > 0) {
            onPrimary = build == null
                ? () => _startOrContinueBuild(hasBuild: false)
                : switch (build.status) {
                    ProjectBuildStatus.paused => () => _resumeBuild(build),
                    ProjectBuildStatus.completed => () => _openBuild(build),
                    ProjectBuildStatus.archived => () => _openBuild(build),
                    ProjectBuildStatus.inProgress =>
                      () => _startOrContinueBuild(hasBuild: true),
                  };
          }

          final showBuildAgain = build != null &&
              (build.status == ProjectBuildStatus.completed ||
                  build.status == ProjectBuildStatus.archived);
          final buildForAgain = build;

          return _BuildPanelContent(
            project: widget.project,
            componentCount: componentCount,
            isBusy: isBusy,
            hasBuild: build != null,
            readyCount: readyCount,
            statusText: statusText,
            primaryLabel: primaryLabel,
            onStartOrContinue: onPrimary,
            onBrowseMaterials: _browseMaterials,
            secondaryLabel: showBuildAgain
                ? LearnerBuildsL10n.buildAgain.resolve(context)
                : null,
            onSecondary: showBuildAgain && buildForAgain != null
                ? () => _buildAgain(buildForAgain)
                : null,
          );
        },
      ),
    );
  }
}

class _BuildPanelContent extends StatelessWidget {
  const _BuildPanelContent({
    required this.project,
    required this.componentCount,
    required this.isBusy,
    required this.hasBuild,
    required this.onStartOrContinue,
    required this.onBrowseMaterials,
    this.readyCount,
    this.statusText,
    this.primaryLabel = 'Start build',
    this.secondaryLabel,
    this.onSecondary,
  });

  final LearningProject project;
  final int componentCount;
  final bool isBusy;
  final bool hasBuild;
  final int? readyCount;
  final String? statusText;
  final String primaryLabel;
  final VoidCallback? onStartOrContinue;
  final VoidCallback onBrowseMaterials;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 760;
    final copy = _BuildPanelCopy(
      project: project,
      componentCount: componentCount,
      hasBuild: hasBuild,
      readyCount: readyCount,
      statusText: statusText,
    );
    final actions = _BuildPanelActions(
      isBusy: isBusy,
      hasBuild: hasBuild,
      primaryLabel: primaryLabel,
      onStartOrContinue: onStartOrContinue,
      onBrowseMaterials: onBrowseMaterials,
      secondaryLabel: secondaryLabel,
      onSecondary: onSecondary,
    );

    if (compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          copy,
          const SizedBox(height: AppSpacing.lg),
          actions,
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(child: copy),
        const SizedBox(width: AppSpacing.xl),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: actions,
        ),
      ],
    );
  }
}

class _BuildPanelCopy extends StatelessWidget {
  const _BuildPanelCopy({
    required this.project,
    required this.componentCount,
    required this.hasBuild,
    this.readyCount,
    this.statusText,
  });

  final LearningProject project;
  final int componentCount;
  final bool hasBuild;
  final int? readyCount;
  final String? statusText;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.construction_rounded, color: palette.lime),
        const SizedBox(height: AppSpacing.md),
        Text(
          hasBuild ? 'Build checklist' : 'Plan this build',
          style: textTheme.titleLarge?.copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          hasBuild
              ? 'Continue your saved manual checklist for this project.'
              : 'Start a saved checklist from the required components. You can mark items as available, missing, alternative, already owned, or reserved.',
          style: textTheme.bodyMedium?.copyWith(
            color: palette.textSecondary,
            height: 1.45,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            _BuildMetricChip(
              icon: Icons.inventory_2_outlined,
              label: '$componentCount components',
            ),
            _BuildMetricChip(
              icon: Icons.format_list_numbered_rounded,
              label: '${project.steps.length} steps',
            ),
            if (statusText != null)
              _BuildMetricChip(
                icon: Icons.task_alt_rounded,
                label: statusText!,
                accent: readyCount != null && readyCount! > 0,
              ),
          ],
        ),
      ],
    );
  }
}

class _BuildPanelActions extends StatelessWidget {
  const _BuildPanelActions({
    required this.isBusy,
    required this.hasBuild,
    required this.primaryLabel,
    required this.onStartOrContinue,
    required this.onBrowseMaterials,
    this.secondaryLabel,
    this.onSecondary,
  });

  final bool isBusy;
  final bool hasBuild;
  final String primaryLabel;
  final VoidCallback? onStartOrContinue;
  final VoidCallback onBrowseMaterials;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        FilledButton.icon(
          onPressed: isBusy ? null : onStartOrContinue,
          icon: isBusy
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.playlist_add_check_rounded),
          label: Text(primaryLabel),
        ),
        if (secondaryLabel != null && onSecondary != null)
          OutlinedButton.icon(
            onPressed: isBusy ? null : onSecondary,
            icon: const Icon(Icons.replay_rounded),
            label: Text(secondaryLabel!),
          ),
        OutlinedButton.icon(
          onPressed: onBrowseMaterials,
          icon: const Icon(Icons.search_rounded),
          label: const Text('Browse materials'),
        ),
      ],
    );
  }
}

class _BuildMetricChip extends StatelessWidget {
  const _BuildMetricChip({
    required this.icon,
    required this.label,
    this.accent = false,
  });

  final IconData icon;
  final String label;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: accent ? palette.limeSoft : palette.cardSurfaceAlt,
        borderRadius: AppRadius.pillAll,
        border: Border.all(
          color: accent
              ? palette.lime.withValues(alpha: 0.34)
              : palette.borderSubtle,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: palette.lime),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            style: textTheme.labelMedium?.copyWith(
              color: accent ? palette.lime : palette.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
