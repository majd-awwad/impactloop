import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_color_tokens.dart';
import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../application/learning_hub_providers.dart';
import '../../domain/models/learning_project.dart';
import '../../domain/models/project_build.dart';
import '../theme/learning_ui_palette.dart';
import '../widgets/project_build_material_linking.dart';

class LearningProjectBuildPage extends ConsumerStatefulWidget {
  const LearningProjectBuildPage({super.key, required this.projectId});

  final String projectId;

  @override
  ConsumerState<LearningProjectBuildPage> createState() =>
      _LearningProjectBuildPageState();
}

class _LearningProjectBuildPageState
    extends ConsumerState<LearningProjectBuildPage> {
  ProjectBuild? _buildOverride;
  bool _isStarting = false;
  final Set<String> _updatingItemIds = <String>{};

  Future<void> _startBuild() async {
    setState(() => _isStarting = true);
    try {
      final build = await ref
          .read(learningHubRepositoryProvider)
          .startBuild(widget.projectId);
      setState(() => _buildOverride = build);
      ref.invalidate(projectBuildProvider(widget.projectId));
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

  Future<void> _updateItem(
    ProjectBuildItem item, {
    required ProjectBuildItemStatus status,
    String? learnerNote,
    bool updateLearnerNote = false,
  }) async {
    setState(() => _updatingItemIds.add(item.id));
    try {
      final build = await ref
          .read(learningHubRepositoryProvider)
          .updateBuildItem(
            widget.projectId,
            item.id,
            status: status,
            learnerNote: updateLearnerNote ? learnerNote : item.learnerNote,
          );
      setState(() => _buildOverride = build);
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _updatingItemIds.remove(item.id));
      }
    }
  }

  Future<void> _editNote(ProjectBuildItem item) async {
    final controller = TextEditingController(text: item.learnerNote ?? '');
    final note = await showDialog<String?>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Checklist note'),
        content: TextField(
          controller: controller,
          maxLines: 4,
          maxLength: 1000,
          decoration: const InputDecoration(
            labelText: 'Optional note',
            hintText: 'Example: ask supplier for this size',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(context).pop(controller.text.trim());
            },
            child: const Text('Save note'),
          ),
        ],
      ),
    );
    controller.dispose();

    if (!mounted) {
      return;
    }

    if (note == null) {
      return;
    }

    final normalizedNote = note.trim().isEmpty ? null : note.trim();
    if (normalizedNote == item.learnerNote) {
      return;
    }

    await _updateItem(
      item,
      status: item.status,
      learnerNote: normalizedNote,
      updateLearnerNote: true,
    );
  }

  void _findMaterials(ProjectBuildItem item) {
    final query = item.component.name.resolve(context).trim();
    context.go(
      Uri(
        path: '/materials',
        queryParameters: query.isEmpty ? null : {'q': query},
      ).toString(),
    );
  }

  Future<void> _showMaterialCandidates(ProjectBuildItem item) async {
    final repository = ref.read(learningHubRepositoryProvider);
    final build = await ProjectBuildMaterialCandidatesSheet.show(
      context,
      projectId: widget.projectId,
      item: item,
      onLoadCandidates: () =>
          repository.fetchMaterialCandidates(widget.projectId, item.id),
      onLinkMaterial: (materialId) => repository.linkMaterial(
        widget.projectId,
        item.id,
        materialId: materialId,
      ),
    );

    if (!mounted || build == null) {
      return;
    }

    setState(() => _buildOverride = build);
    ref.invalidate(projectBuildProvider(widget.projectId));
  }

  Future<void> _unlinkMaterial(ProjectBuildItem item) async {
    setState(() => _updatingItemIds.add(item.id));
    try {
      final build = await ref
          .read(learningHubRepositoryProvider)
          .unlinkMaterial(widget.projectId, item.id);
      setState(() => _buildOverride = build);
      ref.invalidate(projectBuildProvider(widget.projectId));
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _updatingItemIds.remove(item.id));
      }
    }
  }

  void _viewLinkedMaterial(ProjectBuildItem item) {
    final materialId = item.linkedMaterial?.id;
    if (materialId == null) {
      return;
    }

    context.go(
      buildChecklistMaterialDetailUri(
        materialId: materialId,
        projectId: widget.projectId,
        buildItemId: item.id,
        componentName: item.component.name.en,
      ),
    );
  }

  void _reserveLinkedMaterial(ProjectBuildItem item) {
    final materialId = item.linkedMaterial?.id;
    if (materialId == null) {
      return;
    }

    context.go(
      buildChecklistMaterialDetailUri(
        materialId: materialId,
        projectId: widget.projectId,
        buildItemId: item.id,
        componentName: item.component.name.en,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final buildAsync = ref.watch(projectBuildProvider(widget.projectId));

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(homeRoute: '/home'),
            Expanded(
              child: buildAsync.when(
                loading: () => _buildOverride == null
                    ? const Center(child: CircularProgressIndicator())
                    : _BuildContent(
                        projectId: widget.projectId,
                        buildRecord: _buildOverride!,
                        updatingItemIds: _updatingItemIds,
                        onStatusChanged: _updateItem,
                        onEditNote: _editNote,
                        onFindMaterials: _findMaterials,
                        onShowMaterialCandidates: _showMaterialCandidates,
                        onUnlinkMaterial: _unlinkMaterial,
                        onViewLinkedMaterial: _viewLinkedMaterial,
                        onReserveLinkedMaterial: _reserveLinkedMaterial,
                      ),
                error: (error, stackTrace) => _BuildStatePanel(
                  icon: Icons.cloud_off_outlined,
                  title: 'Unable to load checklist',
                  subtitle:
                      'Check that the backend is running, then try again.',
                  actionLabel: 'Try again',
                  onAction: () =>
                      ref.invalidate(projectBuildProvider(widget.projectId)),
                ),
                data: (serverBuild) {
                  final build = _buildOverride ?? serverBuild;
                  if (build == null) {
                    return _BuildStatePanel(
                      icon: Icons.playlist_add_check_rounded,
                      title: 'Start this build',
                      subtitle:
                          'Create a saved manual checklist from this project’s required components.',
                      actionLabel: _isStarting ? 'Starting...' : 'Start build',
                      onAction: _isStarting ? null : _startBuild,
                    );
                  }

                  return _BuildContent(
                    projectId: widget.projectId,
                    buildRecord: build,
                    updatingItemIds: _updatingItemIds,
                    onStatusChanged: _updateItem,
                    onEditNote: _editNote,
                    onFindMaterials: _findMaterials,
                    onShowMaterialCandidates: _showMaterialCandidates,
                    onUnlinkMaterial: _unlinkMaterial,
                    onViewLinkedMaterial: _viewLinkedMaterial,
                    onReserveLinkedMaterial: _reserveLinkedMaterial,
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BuildContent extends StatelessWidget {
  const _BuildContent({
    required this.projectId,
    required this.buildRecord,
    required this.updatingItemIds,
    required this.onStatusChanged,
    required this.onEditNote,
    required this.onFindMaterials,
    required this.onShowMaterialCandidates,
    required this.onUnlinkMaterial,
    required this.onViewLinkedMaterial,
    required this.onReserveLinkedMaterial,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final Set<String> updatingItemIds;
  final Future<void> Function(
    ProjectBuildItem item, {
    required ProjectBuildItemStatus status,
    String? learnerNote,
  })
  onStatusChanged;
  final ValueChanged<ProjectBuildItem> onEditNote;
  final ValueChanged<ProjectBuildItem> onFindMaterials;
  final ValueChanged<ProjectBuildItem> onShowMaterialCandidates;
  final ValueChanged<ProjectBuildItem> onUnlinkMaterial;
  final ValueChanged<ProjectBuildItem> onViewLinkedMaterial;
  final ValueChanged<ProjectBuildItem> onReserveLinkedMaterial;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _BuildHeader(buildRecord: buildRecord),
              const SizedBox(height: AppSpacing.lg),
              if (buildRecord.items.isEmpty)
                _EmptyChecklistCard(palette: palette)
              else
                ...List.generate(buildRecord.items.length, (index) {
                  final item = buildRecord.items[index];
                  return Padding(
                    padding: EdgeInsetsDirectional.only(
                      bottom: index == buildRecord.items.length - 1
                          ? 0
                          : AppSpacing.md,
                    ),
                    child: _BuildItemCard(
                      index: index,
                      item: item,
                      isUpdating: updatingItemIds.contains(item.id),
                      onStatusChanged: (status) =>
                          onStatusChanged(item, status: status),
                      onEditNote: () => onEditNote(item),
                      onFindMaterials: () => onFindMaterials(item),
                      onShowMaterialCandidates: () =>
                          onShowMaterialCandidates(item),
                      onUnlinkMaterial: () => onUnlinkMaterial(item),
                      onViewLinkedMaterial: () => onViewLinkedMaterial(item),
                      onReserveLinkedMaterial: () => onReserveLinkedMaterial(item),
                    ),
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }
}

class _BuildHeader extends StatelessWidget {
  const _BuildHeader({required this.buildRecord});

  final ProjectBuild buildRecord;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final progress = buildRecord.progress.percent.clamp(0, 100) / 100;

    return Container(
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            buildRecord.project.title,
            style: AppTextStyles.display(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          if (buildRecord.project.shortDescription.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              buildRecord.project.shortDescription,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary, height: 1.45),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          ClipRRect(
            borderRadius: AppRadius.pillAll,
            child: LinearProgressIndicator(
              minHeight: 10,
              value: progress,
              backgroundColor: palette.mutedChip,
              valueColor: AlwaysStoppedAnimation<Color>(palette.lime),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '${buildRecord.progress.ready}/${buildRecord.progress.total} ready for build',
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _BuildItemCard extends StatelessWidget {
  const _BuildItemCard({
    required this.index,
    required this.item,
    required this.isUpdating,
    required this.onStatusChanged,
    required this.onEditNote,
    required this.onFindMaterials,
    required this.onShowMaterialCandidates,
    required this.onUnlinkMaterial,
    required this.onViewLinkedMaterial,
    required this.onReserveLinkedMaterial,
  });

  final int index;
  final ProjectBuildItem item;
  final bool isUpdating;
  final ValueChanged<ProjectBuildItemStatus> onStatusChanged;
  final VoidCallback onEditNote;
  final VoidCallback onFindMaterials;
  final VoidCallback onShowMaterialCandidates;
  final VoidCallback onUnlinkMaterial;
  final VoidCallback onViewLinkedMaterial;
  final VoidCallback onReserveLinkedMaterial;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final statusMeta = _BuildStatusMeta.fromStatus(item.status);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: statusMeta.borderColor(palette)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: statusMeta.backgroundColor(palette),
                child: Text(
                  '${index + 1}',
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: statusMeta.foregroundColor(palette)),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.component.name.resolve(context),
                      style: AppTextStyles.subtitle(
                        context,
                      ).copyWith(color: palette.textPrimary),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '${_formatQuantity(item.component.quantity)} ${item.component.unit} · ${item.component.materialType}',
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary),
                    ),
                    if (item.component.notes != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        item.component.notes!,
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: palette.textSecondary),
                      ),
                    ],
                  ],
                ),
              ),
              if (isUpdating)
                const SizedBox.square(
                  dimension: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else
                _BuildStatusChip(status: item.status),
            ],
          ),
          if (!item.isReadyForBuild) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              item.readinessLabel,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary, height: 1.35),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: ProjectBuildItemStatus.values
                .map((status) {
                  final selected = status == item.status;
                  final meta = _BuildStatusMeta.fromStatus(status);

                  return ChoiceChip(
                    selected: selected,
                    label: Text(meta.label),
                    avatar: Icon(
                      meta.icon,
                      size: 18,
                      color: selected
                          ? meta.foregroundColor(palette)
                          : palette.textSecondary,
                    ),
                    onSelected: isUpdating
                        ? null
                        : (_) => onStatusChanged(status),
                    selectedColor: meta.backgroundColor(palette),
                    backgroundColor: palette.mutedChip,
                    side: BorderSide(
                      color: selected
                          ? meta.borderColor(palette)
                          : palette.borderSubtle,
                    ),
                    labelStyle: AppTextStyles.label(context).copyWith(
                      color: selected
                          ? meta.foregroundColor(palette)
                          : palette.textSecondary,
                    ),
                  );
                })
                .toList(growable: false),
          ),
          if (item.learnerNote != null) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              width: double.infinity,
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: palette.cardSurfaceAlt,
                borderRadius: AppRadius.mdAll,
                border: Border.all(color: palette.borderSubtle),
              ),
              child: Text(
                item.learnerNote!,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
            ),
          ],
          if (item.linkedMaterial != null) ...[
            const SizedBox(height: AppSpacing.md),
            ProjectBuildLinkedMaterialPanel(
              material: item.linkedMaterial!,
              linkedReservation: item.linkedReservation,
              isReadyForBuild: item.isReadyForBuild,
              readinessLabel: item.readinessLabel,
              isBusy: isUpdating,
              onViewMaterial: onViewLinkedMaterial,
              onReserveMaterial: item.linkedReservation == null
                  ? onReserveLinkedMaterial
                  : null,
              onUnlink: onUnlinkMaterial,
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              FilledButton.tonalIcon(
                onPressed: isUpdating ? null : onShowMaterialCandidates,
                icon: const Icon(Icons.playlist_add_check_circle_outlined),
                label: Text(
                  item.linkedMaterial == null
                      ? 'Browse matching materials'
                      : 'Change material option',
                ),
              ),
              OutlinedButton.icon(
                onPressed: isUpdating ? null : onFindMaterials,
                icon: const Icon(Icons.travel_explore_rounded),
                label: const Text('Browse all materials'),
              ),
              TextButton.icon(
                onPressed: isUpdating ? null : onEditNote,
                icon: const Icon(Icons.edit_note_rounded),
                label: Text(
                  item.learnerNote == null ? 'Add note' : 'Edit note',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatQuantity(double value) {
    if (value == value.roundToDouble()) {
      return value.toInt().toString();
    }

    return value.toStringAsFixed(2);
  }
}

class _BuildStatusChip extends StatelessWidget {
  const _BuildStatusChip({required this.status});

  final ProjectBuildItemStatus status;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final meta = _BuildStatusMeta.fromStatus(status);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: meta.backgroundColor(palette),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: meta.borderColor(palette)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(meta.icon, size: 16, color: meta.foregroundColor(palette)),
          const SizedBox(width: AppSpacing.xs),
          Text(
            meta.label,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: meta.foregroundColor(palette)),
          ),
        ],
      ),
    );
  }
}

class _BuildStatusMeta {
  const _BuildStatusMeta({
    required this.label,
    required this.icon,
    required this.colorRole,
  });

  final String label;
  final IconData icon;
  final _BuildStatusColorRole colorRole;

  Color backgroundColor(LearningUiPalette palette) {
    return switch (colorRole) {
      _BuildStatusColorRole.ready => palette.lime.withValues(alpha: 0.18),
      _BuildStatusColorRole.warning => Colors.amber.withValues(alpha: 0.18),
      _BuildStatusColorRole.info => Colors.blue.withValues(alpha: 0.12),
      _BuildStatusColorRole.neutral => palette.mutedChip,
    };
  }

  Color borderColor(LearningUiPalette palette) {
    return switch (colorRole) {
      _BuildStatusColorRole.ready => AppColorTokens.forest.withValues(
        alpha: 0.45,
      ),
      _BuildStatusColorRole.warning => Colors.amber.shade700.withValues(
        alpha: 0.55,
      ),
      _BuildStatusColorRole.info => AppColorTokens.blue.withValues(alpha: 0.45),
      _BuildStatusColorRole.neutral => palette.borderSubtle,
    };
  }

  Color foregroundColor(LearningUiPalette palette) {
    return switch (colorRole) {
      _BuildStatusColorRole.ready => AppColorTokens.forest,
      _BuildStatusColorRole.warning => Colors.amber.shade900,
      _BuildStatusColorRole.info => AppColorTokens.blue,
      _BuildStatusColorRole.neutral => palette.textPrimary,
    };
  }

  static _BuildStatusMeta fromStatus(ProjectBuildItemStatus status) {
    return switch (status) {
      ProjectBuildItemStatus.available => const _BuildStatusMeta(
        label: 'Available',
        icon: Icons.inventory_2_outlined,
        colorRole: _BuildStatusColorRole.ready,
      ),
      ProjectBuildItemStatus.missing => const _BuildStatusMeta(
        label: 'Missing',
        icon: Icons.search_off_rounded,
        colorRole: _BuildStatusColorRole.warning,
      ),
      ProjectBuildItemStatus.alternative => const _BuildStatusMeta(
        label: 'Alternative',
        icon: Icons.swap_horiz_rounded,
        colorRole: _BuildStatusColorRole.ready,
      ),
      ProjectBuildItemStatus.alreadyOwned => const _BuildStatusMeta(
        label: 'Already owned',
        icon: Icons.home_repair_service_outlined,
        colorRole: _BuildStatusColorRole.ready,
      ),
      ProjectBuildItemStatus.reserved => const _BuildStatusMeta(
        label: 'Reserved',
        icon: Icons.lock_clock_rounded,
        colorRole: _BuildStatusColorRole.info,
      ),
    };
  }
}

enum _BuildStatusColorRole { ready, warning, info, neutral }

class _EmptyChecklistCard extends StatelessWidget {
  const _EmptyChecklistCard({required this.palette});

  final LearningUiPalette palette;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Text(
        'This project does not list required components yet.',
        style: AppTextStyles.body(
          context,
        ).copyWith(color: palette.textSecondary),
      ),
    );
  }
}

class _BuildStatePanel extends StatelessWidget {
  const _BuildStatePanel({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Center(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 520),
          padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
          decoration: BoxDecoration(
            color: palette.cardSurface,
            borderRadius: AppRadius.xlAll,
            border: Border.all(color: palette.borderSubtle),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 44, color: palette.lime),
              const SizedBox(height: AppSpacing.md),
              Text(
                title,
                textAlign: TextAlign.center,
                style: AppTextStyles.title(
                  context,
                ).copyWith(color: palette.textPrimary),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary, height: 1.45),
              ),
              const SizedBox(height: AppSpacing.lg),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  FilledButton(onPressed: onAction, child: Text(actionLabel)),
                  OutlinedButton(
                    onPressed: () => context.popOrGo('/learning'),
                    child: const Text('Back to Learning Hub'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
