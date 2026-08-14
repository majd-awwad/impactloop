import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../core/format/localized_formatters.dart';
import '../../../../../l10n/l10n.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/app_feedback.dart';
import '../../../../../shared/widgets/app_section_card.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../application/learning_hub_providers.dart';
import '../../../application/project_build_refresh.dart';
import '../../../domain/models/smart_build_plan.dart';
import '../../l10n/smart_build_plan_l10n.dart';
import '../../theme/learning_ui_palette.dart';
import '../project_build_material_linking.dart';
import 'smart_build_plan_reason_tags.dart';

class SmartBuildPlanItemCard extends ConsumerStatefulWidget {
  const SmartBuildPlanItemCard({
    super.key,
    required this.projectId,
    required this.item,
  });

  final String projectId;
  final SmartBuildPlanItem item;

  @override
  ConsumerState<SmartBuildPlanItemCard> createState() =>
      _SmartBuildPlanItemCardState();
}

class _SmartBuildPlanItemCardState extends ConsumerState<SmartBuildPlanItemCard> {
  bool _isLinking = false;

  Future<void> _openMaterial({required bool linkBeforeNavigate}) async {
    final candidate = widget.item.candidate;
    if (candidate == null) {
      return;
    }

    if (linkBeforeNavigate) {
      setState(() => _isLinking = true);
      try {
        await ref.read(learningHubRepositoryProvider).linkMaterial(
          widget.projectId,
          widget.item.buildItemId,
          materialId: candidate.materialId,
        );
        ref.refreshLinkedProjectBuild(widget.projectId);
        ref.refreshSmartBuildPlan(widget.projectId);
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
    }

    if (!mounted) {
      return;
    }

    await context.push(
      smartBuildPlanMaterialDetailUri(
        materialId: candidate.materialId,
        projectId: widget.projectId,
        buildItemId: widget.item.buildItemId,
        componentName: widget.item.componentName,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final formatters = LocalizedFormatters(context.l10n);
    final tone = SmartBuildPlanL10n.plannerStateTone(widget.item.plannerState);

    return AppSectionCard(
      tone: tone,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.item.componentName,
                      style: AppTextStyles.title(context).copyWith(
                        color: palette.textPrimary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '${SmartBuildPlanL10n.requiredQuantity.resolve(context)}: ${formatters.quantity(widget.item.requiredQuantity, widget.item.requiredUnit)}',
                      style: AppTextStyles.body(context).copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              AppStatusBadge(
                label: SmartBuildPlanL10n.plannerStateLabel(widget.item.plannerState)
                    .resolve(context),
                tone: tone,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          _Body(
            projectId: widget.projectId,
            item: widget.item,
            formatters: formatters,
            isLinking: _isLinking,
            onViewMaterial: () => _openMaterial(linkBeforeNavigate: false),
            onReserveMaterial: () => _openMaterial(linkBeforeNavigate: true),
          ),
        ],
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    required this.projectId,
    required this.item,
    required this.formatters,
    required this.isLinking,
    required this.onViewMaterial,
    required this.onReserveMaterial,
  });

  final String projectId;
  final SmartBuildPlanItem item;
  final LocalizedFormatters formatters;
  final bool isLinking;
  final VoidCallback onViewMaterial;
  final VoidCallback onReserveMaterial;

  @override
  Widget build(BuildContext context) {
    return switch (item.plannerState) {
      SmartBuildPlannerState.alreadySatisfied => Text(
        SmartBuildPlanL10n.alreadySatisfiedBody.resolve(context),
      ),
      SmartBuildPlannerState.inProgress => Text(
        SmartBuildPlanL10n.inProgressBody.resolve(context),
      ),
      SmartBuildPlannerState.attention => _AttentionBody(
        projectId: projectId,
      ),
      SmartBuildPlannerState.uncovered => _UncoveredBody(item: item),
      SmartBuildPlannerState.planned => _PlannedBody(
        item: item,
        formatters: formatters,
        isLinking: isLinking,
        onViewMaterial: onViewMaterial,
        onReserveMaterial: onReserveMaterial,
      ),
    };
  }
}

class _AttentionBody extends StatelessWidget {
  const _AttentionBody({required this.projectId});

  final String projectId;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          SmartBuildPlanL10n.attentionBody.resolve(context),
        ),
        const SizedBox(height: AppSpacing.md),
        OutlinedButton(
          onPressed: () => context.push('/learning/$projectId/build'),
          child: Text(SmartBuildPlanL10n.viewBuildItem.resolve(context)),
        ),
      ],
    );
  }
}

class _UncoveredBody extends StatelessWidget {
  const _UncoveredBody({required this.item});

  final SmartBuildPlanItem item;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final reason = item.uncoveredReason;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          SmartBuildPlanL10n.uncoveredBody.resolve(context),
          style: AppTextStyles.body(context).copyWith(color: palette.textSecondary),
        ),
        if (reason != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            SmartBuildPlanL10n.uncoveredReason(reason).resolve(context),
            style: AppTextStyles.label(context).copyWith(color: palette.textSecondary),
          ),
        ],
      ],
    );
  }
}

class _PlannedBody extends StatelessWidget {
  const _PlannedBody({
    required this.item,
    required this.formatters,
    required this.isLinking,
    required this.onViewMaterial,
    required this.onReserveMaterial,
  });

  final SmartBuildPlanItem item;
  final LocalizedFormatters formatters;
  final bool isLinking;
  final VoidCallback onViewMaterial;
  final VoidCallback onReserveMaterial;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final candidate = item.candidate;
    if (candidate == null) {
      return Text(SmartBuildPlanL10n.uncoveredBody.resolve(context));
    }

    final priceLabel = candidate.priceKnown
        ? (candidate.isFree
            ? SmartBuildPlanL10n.reasonTag(SmartBuildReasonTag.free)
                .resolve(context)
            : formatters.nis(candidate.lineSubtotal ?? 0, decimalDigits: 2))
        : SmartBuildPlanL10n.priceUnknown.resolve(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          candidate.title,
          style: AppTextStyles.body(context).copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          children: [
            AppStatusBadge(
              label: SmartBuildPlanL10n.matchTypeLabel(candidate.matchType)
                  .resolve(context),
              tone: AppStatusTone.primary,
            ),
            Text(
              '${SmartBuildPlanL10n.availableQuantity.resolve(context)}: ${formatters.quantity(candidate.availableQuantity, candidate.unit)}',
              style: AppTextStyles.label(context).copyWith(
                color: palette.textSecondary,
              ),
            ),
            if (candidate.city.isNotEmpty)
              Text(
                candidate.city,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                ),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          priceLabel,
          style: AppTextStyles.title(context).copyWith(color: palette.textPrimary),
        ),
        if (item.reasonTags.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          SmartBuildPlanReasonTags(
            tags: item.reasonTags,
            matchType: candidate.matchType,
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            OutlinedButton(
              onPressed: isLinking ? null : onViewMaterial,
              child: Text(SmartBuildPlanL10n.viewMaterial.resolve(context)),
            ),
            FilledButton(
              onPressed: isLinking ? null : onReserveMaterial,
              child: isLinking
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(SmartBuildPlanL10n.reserveMaterial.resolve(context)),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          SmartBuildPlanL10n.reserveHelper.resolve(context),
          style: AppTextStyles.label(context).copyWith(
            color: palette.textSecondary,
            height: 1.4,
          ),
        ),
      ],
    );
  }
}
