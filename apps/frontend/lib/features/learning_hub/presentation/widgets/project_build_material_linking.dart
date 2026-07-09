import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../domain/models/project_build.dart';
import '../../../../shared/models/localized_text.dart';
import '../theme/learning_ui_palette.dart';

String buildChecklistMaterialDetailUri({
  required String materialId,
  required String projectId,
  required String buildItemId,
  String? componentName,
}) {
  final returnTo = Uri.encodeComponent('/learning/$projectId/build');

  return Uri(
    path: '/materials/$materialId',
    queryParameters: {
      'projectId': projectId,
      'buildItemId': buildItemId,
      'returnTo': returnTo,
      if (componentName != null && componentName.trim().isNotEmpty)
        'componentName': componentName.trim(),
    },
  ).toString();
}

class ProjectBuildMaterialCandidatesSheet extends StatefulWidget {
  const ProjectBuildMaterialCandidatesSheet({
    super.key,
    required this.projectId,
    required this.item,
    required this.onLoadCandidates,
    required this.onLinkMaterial,
  });

  final String projectId;
  final ProjectBuildItem item;
  final Future<BuildMaterialCandidatesResult> Function() onLoadCandidates;
  final Future<ProjectBuild> Function(String materialId) onLinkMaterial;

  static Future<ProjectBuild?> show(
    BuildContext context, {
    required String projectId,
    required ProjectBuildItem item,
    required Future<BuildMaterialCandidatesResult> Function() onLoadCandidates,
    required Future<ProjectBuild> Function(String materialId) onLinkMaterial,
  }) {
    return showModalBottomSheet<ProjectBuild>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (context) => ProjectBuildMaterialCandidatesSheet(
        projectId: projectId,
        item: item,
        onLoadCandidates: onLoadCandidates,
        onLinkMaterial: onLinkMaterial,
      ),
    );
  }

  @override
  State<ProjectBuildMaterialCandidatesSheet> createState() =>
      _ProjectBuildMaterialCandidatesSheetState();
}

class _ProjectBuildMaterialCandidatesSheetState
    extends State<ProjectBuildMaterialCandidatesSheet> {
  BuildMaterialCandidatesResult? _result;
  Object? _error;
  bool _isLoading = true;
  String? _linkingMaterialId;

  @override
  void initState() {
    super.initState();
    _loadCandidates();
  }

  Future<void> _loadCandidates() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await widget.onLoadCandidates();
      if (!mounted) return;
      setState(() {
        _result = result;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _isLoading = false;
      });
    }
  }

  Future<void> _linkMaterial(BuildMaterialCandidate candidate) async {
    setState(() => _linkingMaterialId = candidate.id);
    try {
      final build = await widget.onLinkMaterial(candidate.id);
      if (!mounted) return;
      Navigator.of(context).pop(build);
    } catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, error);
    } finally {
      if (mounted) {
        setState(() => _linkingMaterialId = null);
      }
    }
  }

  void _browseAllMaterials() {
    final query = widget.item.component.name.en.trim();
    final uri = Uri(
      path: '/materials',
      queryParameters: query.isEmpty ? null : {'q': query},
    );
    Navigator.of(context).pop();
    context.go(uri.toString());
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    final componentName = widget.item.component.name.resolve(context);

    return DraggableScrollableSheet(
      initialChildSize: 0.72,
      minChildSize: 0.45,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: palette.pageBackground,
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(AppRadius.lg),
            ),
            border: Border.all(color: palette.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.sm),
              Center(
                child: Container(
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color: palette.borderSubtle,
                    borderRadius: AppRadius.pillAll,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.sm,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Possible options',
                      style: textTheme.titleLarge?.copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Platform materials that may work for "$componentName". '
                      'These are suggestions, not perfect matches.',
                      style: textTheme.bodyMedium?.copyWith(
                        color: palette.textSecondary,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: _isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : _error != null
                    ? _CandidatesErrorState(
                        onRetry: _loadCandidates,
                        onBrowseAll: _browseAllMaterials,
                      )
                    : ListView(
                        controller: scrollController,
                        padding: const EdgeInsetsDirectional.fromSTEB(
                          AppSpacing.lg,
                          0,
                          AppSpacing.lg,
                          AppSpacing.xl,
                        ),
                        children: [
                          if ((_result?.items ?? []).isEmpty)
                            _CandidatesEmptyState(
                              componentName: componentName,
                              onBrowseAll: _browseAllMaterials,
                            )
                          else
                            ..._result!.items.map(
                              (candidate) => Padding(
                                padding: const EdgeInsetsDirectional.only(
                                  bottom: AppSpacing.md,
                                ),
                                child: _CandidateCard(
                                  candidate: candidate,
                                  isLinking: _linkingMaterialId == candidate.id,
                                  onLink: () => _linkMaterial(candidate),
                                  onView: () {
                                    Navigator.of(context).pop();
                                    context.go(
                                      buildChecklistMaterialDetailUri(
                                        materialId: candidate.id,
                                        projectId: widget.projectId,
                                        buildItemId: widget.item.id,
                                        componentName: componentName,
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ),
                        ],
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class ProjectBuildLinkedMaterialPanel extends StatelessWidget {
  const ProjectBuildLinkedMaterialPanel({
    super.key,
    required this.material,
    this.linkedReservation,
    required this.isReadyForBuild,
    required this.readinessLabel,
    required this.isBusy,
    required this.onViewMaterial,
    this.onReserveMaterial,
    required this.onUnlink,
  });

  final LinkedMaterialSummary material;
  final LinkedReservationSummary? linkedReservation;
  final bool isReadyForBuild;
  final String readinessLabel;
  final bool isBusy;
  final VoidCallback onViewMaterial;
  final VoidCallback? onReserveMaterial;
  final VoidCallback onUnlink;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final textTheme = Theme.of(context).textTheme;
    final borderColor = isReadyForBuild
        ? palette.lime.withValues(alpha: 0.42)
        : palette.borderSubtle;

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: borderColor, width: 1.4),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.link_rounded,
                size: 18,
                color: isReadyForBuild ? palette.lime : palette.textSecondary,
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(
                'Linked option',
                style: textTheme.labelLarge?.copyWith(
                  color: palette.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            material.title,
            style: textTheme.titleMedium?.copyWith(
              color: palette.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${material.supplierName} · ${material.locationLabel} · ${material.priceLabel}',
            style: textTheme.bodyMedium?.copyWith(
              color: palette.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              if (material.pickupAllowed)
                const _InfoChip(
                  icon: Icons.storefront_outlined,
                  label: 'Pickup',
                ),
              if (material.deliveryAllowed)
                const _InfoChip(
                  icon: Icons.local_shipping_outlined,
                  label: 'Delivery',
                ),
              _InfoChip(
                icon: Icons.inventory_2_outlined,
                label: _formatCondition(material.condition),
              ),
            ],
          ),
          if (material.availabilityWarning != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              material.availabilityWarning!,
              style: textTheme.bodyMedium?.copyWith(
                color: colors.warningText,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          if (linkedReservation != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              linkedReservation!.statusLabel,
              style: textTheme.bodyMedium?.copyWith(
                color: linkedReservation!.needsAction
                    ? colors.warningText
                    : palette.textSecondary,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Text(
            isReadyForBuild
                ? readinessLabel
                : 'Material selected — not ready yet. Reserve or acquire this material before using it in your build.',
            style: textTheme.bodyMedium?.copyWith(
              color: isReadyForBuild ? palette.lime : palette.textSecondary,
              height: 1.45,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              if (linkedReservation == null && onReserveMaterial != null)
                FilledButton.icon(
                  onPressed: isBusy ? null : onReserveMaterial,
                  icon: const Icon(Icons.event_available_outlined),
                  label: const Text('Reserve this material'),
                ),
              OutlinedButton.icon(
                onPressed: isBusy ? null : onViewMaterial,
                icon: const Icon(Icons.open_in_new_rounded),
                label: const Text('View material'),
              ),
              TextButton.icon(
                onPressed: isBusy ? null : onUnlink,
                icon: const Icon(Icons.link_off_rounded),
                label: const Text('Unlink'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _formatCondition(String raw) {
    return switch (raw) {
      'NEW' => 'New',
      'LIKE_NEW' => 'Like new',
      'GOOD' => 'Good',
      'USED' => 'Used',
      'NEEDS_REPAIR' => 'Needs repair',
      _ => raw,
    };
  }
}

class _CandidateCard extends StatelessWidget {
  const _CandidateCard({
    required this.candidate,
    required this.isLinking,
    required this.onLink,
    required this.onView,
  });

  final BuildMaterialCandidate candidate;
  final bool isLinking;
  final VoidCallback onLink;
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _CandidateThumbnail(imageUrl: candidate.imageUrl),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      candidate.title,
                      style: textTheme.titleMedium?.copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '${candidate.supplierName} · ${candidate.locationLabel}',
                      style: textTheme.bodyMedium?.copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '${candidate.priceLabel} · ${_formatCondition(candidate.condition)}',
                      style: textTheme.labelMedium?.copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (candidate.matchHints.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: candidate.matchHints
                  .map(
                    (hint) => Chip(
                      label: Text(hint),
                      visualDensity: VisualDensity.compact,
                      backgroundColor: palette.cardSurfaceAlt,
                      side: BorderSide(color: palette.borderSubtle),
                    ),
                  )
                  .toList(growable: false),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              FilledButton.icon(
                onPressed: isLinking ? null : onLink,
                icon: isLinking
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.link_rounded),
                label: const Text('Link to component'),
              ),
              OutlinedButton(
                onPressed: isLinking ? null : onView,
                child: const Text('View material'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _formatCondition(String raw) {
    return ProjectBuildLinkedMaterialPanel._formatCondition(raw);
  }
}

class _CandidateThumbnail extends StatelessWidget {
  const _CandidateThumbnail({this.imageUrl});

  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return ClipRRect(
      borderRadius: AppRadius.mdAll,
      child: Container(
        width: 72,
        height: 72,
        color: palette.mutedChip,
        child: imageUrl == null
            ? Icon(Icons.inventory_2_outlined, color: palette.textSecondary)
            : Image.network(
                imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Icon(
                  Icons.broken_image_outlined,
                  color: palette.textSecondary,
                ),
              ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.mutedChip,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: palette.textSecondary),
          const SizedBox(width: 4),
          Text(
            label,
            style: textTheme.labelSmall?.copyWith(
              color: palette.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _CandidatesEmptyState extends StatelessWidget {
  const _CandidatesEmptyState({
    required this.componentName,
    required this.onBrowseAll,
  });

  final String componentName;
  final VoidCallback onBrowseAll;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        children: [
          Icon(
            Icons.search_off_rounded,
            size: 40,
            color: palette.textSecondary,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'No available platform materials found for this component yet.',
            textAlign: TextAlign.center,
            style: textTheme.bodyMedium?.copyWith(
              color: palette.textSecondary,
              height: 1.45,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton.icon(
            onPressed: onBrowseAll,
            icon: const Icon(Icons.travel_explore_rounded),
            label: Text('Browse all materials for "$componentName"'),
          ),
        ],
      ),
    );
  }
}

class _CandidatesErrorState extends StatelessWidget {
  const _CandidatesErrorState({
    required this.onRetry,
    required this.onBrowseAll,
  });

  final VoidCallback onRetry;
  final VoidCallback onBrowseAll;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined, size: 40),
            const SizedBox(height: AppSpacing.md),
            const Text('Could not load material options right now.'),
            const SizedBox(height: AppSpacing.lg),
            FilledButton(onPressed: onRetry, child: const Text('Try again')),
            TextButton(
              onPressed: onBrowseAll,
              child: const Text('Browse all materials'),
            ),
          ],
        ),
      ),
    );
  }
}
