import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/learning_hub_providers.dart';
import '../../domain/models/learning_project.dart';
import '../theme/learning_ui_palette.dart';

class ProjectBuildActionsPanel extends ConsumerStatefulWidget {
  const ProjectBuildActionsPanel({super.key, required this.project});

  final LearningProject project;

  @override
  ConsumerState<ProjectBuildActionsPanel> createState() =>
      _ProjectBuildActionsPanelState();
}

class _ProjectBuildActionsPanelState
    extends ConsumerState<ProjectBuildActionsPanel> {
  bool _isStarting = false;

  Future<void> _startOrContinueBuild({required bool hasBuild}) async {
    final projectId = widget.project.id;
    final destination = '/learning/$projectId/build';

    if (hasBuild) {
      context.go(destination);
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
      await ref.read(learningHubRepositoryProvider).startBuild(projectId);
      ref.invalidate(projectBuildProvider(projectId));
      if (mounted) {
        context.go(destination);
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

  void _browseMaterials() {
    context.go('/materials');
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

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
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
          isBusy: _isStarting,
          hasBuild: false,
          statusText: 'Checklist status is unavailable right now.',
          onStartOrContinue: componentCount == 0
              ? null
              : () => _startOrContinueBuild(hasBuild: false),
          onBrowseMaterials: _browseMaterials,
        ),
        data: (build) => _BuildPanelContent(
          project: widget.project,
          componentCount: componentCount,
          isBusy: _isStarting,
          hasBuild: build != null,
          readyCount: build?.progress.ready,
          statusText: build == null
              ? null
              : '${build.progress.ready}/${build.progress.total} ready for build',
          onStartOrContinue: componentCount == 0 || _isStarting
              ? null
              : () => _startOrContinueBuild(hasBuild: build != null),
          onBrowseMaterials: _browseMaterials,
        ),
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
  });

  final LearningProject project;
  final int componentCount;
  final bool isBusy;
  final bool hasBuild;
  final int? readyCount;
  final String? statusText;
  final VoidCallback? onStartOrContinue;
  final VoidCallback onBrowseMaterials;

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
      onStartOrContinue: onStartOrContinue,
      onBrowseMaterials: onBrowseMaterials,
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.construction_rounded, color: palette.lime),
        const SizedBox(height: AppSpacing.md),
        Text(
          hasBuild ? 'Build checklist' : 'Plan this build',
          style: AppTextStyles.title(
            context,
          ).copyWith(color: palette.textPrimary),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          hasBuild
              ? 'Continue your saved manual checklist for this project.'
              : 'Start a saved checklist from the required components. You can mark items as available, missing, alternative, already owned, or reserved.',
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary, height: 1.45),
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
    required this.onStartOrContinue,
    required this.onBrowseMaterials,
  });

  final bool isBusy;
  final bool hasBuild;
  final VoidCallback? onStartOrContinue;
  final VoidCallback onBrowseMaterials;

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
          label: Text(hasBuild ? 'Continue checklist' : 'Start build'),
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

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: accent
            ? palette.lime.withValues(alpha: 0.16)
            : palette.cardSurfaceAlt,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: accent ? palette.limeSoft : palette.lime),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: accent ? palette.limeSoft : palette.textPrimary),
          ),
        ],
      ),
    );
  }
}
