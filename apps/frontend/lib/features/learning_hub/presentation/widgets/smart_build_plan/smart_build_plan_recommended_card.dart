import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../core/format/localized_formatters.dart';
import '../../../../../l10n/l10n.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/app_feedback.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../application/learning_hub_providers.dart';
import '../../../application/project_build_refresh.dart';
import '../../../domain/models/project_build.dart';
import '../../../domain/project_build_acquisition_state.dart';
import '../../../domain/models/smart_build_plan.dart';
import '../../l10n/smart_build_plan_l10n.dart';
import '../../theme/learning_ui_palette.dart';
import '../project_build_material_linking.dart';
import 'smart_build_plan_material_thumbnail.dart';
import 'smart_build_plan_reason_tags.dart';

class SmartBuildPlanRecommendedCard extends ConsumerStatefulWidget {
  const SmartBuildPlanRecommendedCard({
    super.key,
    required this.projectId,
    required this.item,
  });

  final String projectId;
  final SmartBuildPlanItem item;

  @override
  ConsumerState<SmartBuildPlanRecommendedCard> createState() =>
      _SmartBuildPlanRecommendedCardState();
}

class _SmartBuildPlanRecommendedCardState
    extends ConsumerState<SmartBuildPlanRecommendedCard> {
  bool _isLinking = false;

  Future<void> _viewMaterial() async {
    final candidate = widget.item.candidate;
    if (candidate == null || !mounted) {
      return;
    }

    await context.push(
      smartBuildPlanBrowseMaterialUri(
        materialId: candidate.materialId,
        projectId: widget.projectId,
      ),
    );
  }

  Future<void> _reserveMaterial() async {
    final candidate = widget.item.candidate;
    if (candidate == null) {
      return;
    }

    setState(() => _isLinking = true);
    try {
      await ref
          .read(learningHubRepositoryProvider)
          .linkMaterial(
            widget.projectId,
            widget.item.buildItemId,
            materialId: candidate.materialId,
          );
      ref.refreshLinkedProjectBuild(widget.projectId);
    } catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
      return;
    } finally {
      if (mounted) {
        setState(() => _isLinking = false);
      }
    }

    if (!mounted) {
      return;
    }

    await context.push(
      smartBuildPlanReserveMaterialUri(
        materialId: candidate.materialId,
        projectId: widget.projectId,
        buildItemId: widget.item.buildItemId,
        componentName: widget.item.componentName,
      ),
    );

    if (!mounted) {
      return;
    }

    await _rollbackReserveLinkIfNeeded(candidate.materialId);
  }

  Future<void> _rollbackReserveLinkIfNeeded(String materialId) async {
    final build = await ref.read(projectBuildProvider(widget.projectId).future);
    if (build == null || !mounted) {
      return;
    }

    final item = _findBuildItem(build, widget.item.buildItemId);
    if (item == null) {
      return;
    }

    final linkedMaterialId = item.linkedMaterial?.id;
    final hasActiveReservation =
        ProjectBuildAcquisitionState.hasActiveLinkedReservation(item);

    if (linkedMaterialId == materialId && !hasActiveReservation) {
      try {
        await ref
            .read(learningHubRepositoryProvider)
            .unlinkMaterial(widget.projectId, widget.item.buildItemId);
      } catch (error) {
        if (mounted) {
          showErrorSnackBar(context, error);
        }
        return;
      }
    }

    ref.refreshLinkedProjectBuild(widget.projectId);
    ref.refreshSmartBuildPlan(widget.projectId);
  }

  ProjectBuildItem? _findBuildItem(ProjectBuild build, String buildItemId) {
    for (final item in build.items) {
      if (item.id == buildItemId) {
        return item;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final formatters = LocalizedFormatters(context.l10n);
    final candidate = widget.item.candidate;
    if (candidate == null) {
      return const SizedBox.shrink();
    }

    final priceLabel = candidate.priceKnown
        ? (candidate.isFree
              ? SmartBuildPlanL10n.reasonTag(
                  SmartBuildReasonTag.free,
                ).resolve(context)
              : formatters.nis(candidate.lineSubtotal ?? 0, decimalDigits: 2))
        : SmartBuildPlanL10n.priceUnknown.resolve(context);

    final availabilityParts = <String>[
      '${formatters.quantity(candidate.availableQuantity, candidate.unit)} ${SmartBuildPlanL10n.availableQuantity.resolve(context).toLowerCase()}',
      if (candidate.city.isNotEmpty) candidate.city,
    ];

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final useWide = constraints.maxWidth >= 560;
          final thumbnail = SmartBuildPlanMaterialThumbnail(
            materialId: candidate.materialId,
            imageUrl: candidate.imageUrl,
            size: useWide ? 72 : 64,
          );

          final details = Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _CompactField(
                label: SmartBuildPlanL10n.requiredComponentLabel.resolve(
                  context,
                ),
                value: widget.item.componentName,
                trailing:
                    '${SmartBuildPlanL10n.requiredQuantity.resolve(context)}: ${formatters.quantity(widget.item.requiredQuantity, widget.item.requiredUnit)}',
              ),
              const SizedBox(height: AppSpacing.xs),
              _CompactField(
                label: SmartBuildPlanL10n.recommendedMaterialLabel.resolve(
                  context,
                ),
                value: candidate.title,
                emphasized: true,
              ),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  AppStatusBadge(
                    label: SmartBuildPlanL10n.matchTypeLabel(
                      candidate.matchType,
                    ).resolve(context),
                    tone: AppStatusTone.primary,
                  ),
                  Text(
                    availabilityParts.join(' • '),
                    style: AppTextStyles.label(
                      context,
                    ).copyWith(color: palette.textSecondary),
                  ),
                ],
              ),
              if (widget.item.reasonTags.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xs),
                SmartBuildPlanReasonTags(
                  tags: widget.item.reasonTags,
                  matchType: candidate.matchType,
                ),
              ],
            ],
          );

          final actions = Column(
            crossAxisAlignment: useWide
                ? CrossAxisAlignment.end
                : CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                priceLabel,
                textAlign: useWide ? TextAlign.end : TextAlign.start,
                style: AppTextStyles.title(context).copyWith(
                  color: palette.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 18,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              FilledButton.icon(
                onPressed: _isLinking ? null : _reserveMaterial,
                style: FilledButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                ),
                icon: _isLinking
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.shopping_cart_outlined, size: 18),
                label: Text(
                  SmartBuildPlanL10n.reserveMaterial.resolve(context),
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              OutlinedButton.icon(
                onPressed: _isLinking ? null : _viewMaterial,
                style: OutlinedButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                ),
                icon: const Icon(Icons.visibility_outlined, size: 18),
                label: Text(SmartBuildPlanL10n.viewMaterial.resolve(context)),
              ),
            ],
          );

          if (!useWide) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    thumbnail,
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(child: details),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                actions,
              ],
            );
          }

          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              thumbnail,
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: details),
              const SizedBox(width: AppSpacing.md),
              SizedBox(width: 148, child: actions),
            ],
          );
        },
      ),
    );
  }
}

class _CompactField extends StatelessWidget {
  const _CompactField({
    required this.label,
    required this.value,
    this.trailing,
    this.emphasized = false,
  });

  final String label;
  final String value;
  final String? trailing;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textSecondary, fontSize: 11),
        ),
        const SizedBox(height: 1),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                value,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style:
                    (emphasized
                            ? AppTextStyles.body(context)
                            : AppTextStyles.label(context))
                        .copyWith(
                          color: palette.textPrimary,
                          fontWeight: emphasized
                              ? FontWeight.w600
                              : FontWeight.w500,
                        ),
              ),
            ),
            if (trailing != null) ...[
              const SizedBox(width: AppSpacing.xs),
              Text(
                trailing!,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textSecondary, fontSize: 11),
              ),
            ],
          ],
        ),
      ],
    );
  }
}
