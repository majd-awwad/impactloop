import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/utils/content_text_direction.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/app_material_card.dart';
import '../../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/ai_chat_controller.dart';
import '../../domain/ai_helpers.dart';
import '../../domain/ai_models.dart';
import '../l10n/ai_l10n.dart';
import '../../../../core/config/api_config.dart';

class AiContentBlockView extends ConsumerWidget {
  const AiContentBlockView({
    super.key,
    required this.block,
    required this.messageBlocks,
    required this.blockIndex,
    this.locale = 'ar',
    this.onConfirmAction,
    this.onCancelAction,
    this.pendingActionBusyId,
    this.actionErrorMessage,
    this.authoringProjectUpdatedAt,
    this.authoringDraftSnapshot,
  });

  final AiContentBlock block;
  final List<AiContentBlock> messageBlocks;
  final int blockIndex;
  final String locale;
  final VoidCallback? onConfirmAction;
  final VoidCallback? onCancelAction;
  final String? pendingActionBusyId;
  final String? actionErrorMessage;
  final DateTime? authoringProjectUpdatedAt;
  final AuthoringDraftSnapshot? authoringDraftSnapshot;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(aiAssistantControllerProvider.notifier);
    final onQuickReply =
        block.type == 'text' && block.purpose == 'clarification'
        ? (String reply) => controller.sendMessage(text: reply, locale: locale)
        : null;

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: switch (block.type) {
        'text' => _AiTextBlock(block: block, onQuickReply: onQuickReply),
        'error' => _AiErrorBlock(block: block),
        'material_results' => _AiMaterialResultsBlock(
          items: block.materialItems,
        ),
        'material_details' =>
          block.materialItem == null
              ? const SizedBox.shrink()
              : _AiMaterialDetailsBlock(item: block.materialItem!),
        'project_results' => _AiProjectResultsBlock(items: block.projectItems),
        'project_details' =>
          block.projectItem == null
              ? const SizedBox.shrink()
              : _AiProjectDetailsBlock(item: block.projectItem!),
        'component_list' => _AiComponentListBlock(
          projectId: block.projectId,
          items: block.componentItems,
        ),
        'build_checklist' => _AiBuildChecklistBlock(
          buildId: block.buildId,
          projectId: block.projectId,
          readyCount: block.readyCount,
          totalRequired: block.totalRequired,
          items: block.checklistItems,
        ),
        'build_step_guide' => _AiBuildStepGuideBlock(block: block),
        'component_matches' => _AiComponentMatchesBlock(
          buildId: block.buildId,
          groups: block.matchGroups,
        ),
        'project_budget_estimate' =>
          block.budgetEstimate == null
              ? const SizedBox.shrink()
              : _AiProjectBudgetEstimateBlock(estimate: block.budgetEstimate!),
        'comparison' => _AiComparisonBlock(
          subject: block.comparisonSubject,
          items: block.comparisonItems,
        ),
        'recommendations' => _AiRecommendationsBlock(
          recommendationType: block.recommendationType,
          items: block.recommendationItems,
        ),
        'action_confirmation' => _AiActionConfirmationBlock(
          block: block,
          uiState: resolveActionConfirmationUiState(
            block: block,
            messageBlocks: messageBlocks,
            blockIndex: blockIndex,
            pendingActionBusyId: pendingActionBusyId,
            actionErrorMessage: actionErrorMessage,
          ),
          onConfirm: onConfirmAction,
          onCancel: onCancelAction,
        ),
        'action_result' => _AiActionResultBlock(block: block),
        'external_sources' => _AiExternalSourcesBlock(
          items: block.externalSources,
        ),
        'project_authoring_clarification' =>
          _AiProjectAuthoringClarificationCard(
            block: block,
            locale: locale,
            projectUpdatedAt: authoringProjectUpdatedAt,
          ),
        'project_authoring_proposal' => Consumer(
          builder: (context, ref, _) {
            ref.watch(aiAssistantControllerProvider);
            final controller = ref.read(aiAssistantControllerProvider.notifier);
            final hasSequential = controller.hasActiveSequentialAuthoring;
            if (hasSequential) {
              return const SizedBox.shrink();
            }
            if (controller.hasLegacyAuthoringWithoutSession) {
              return _AiSequentialAuthoringStageCard(
                block: block,
                draftSnapshot: authoringDraftSnapshot,
              );
            }
            return _AiProjectAuthoringProposalCard(
              block: block,
              projectUpdatedAt: authoringProjectUpdatedAt,
              draftSnapshot: authoringDraftSnapshot,
            );
          },
        ),
        'project_authoring_session' => Consumer(
          builder: (context, ref, _) {
            ref.watch(aiAssistantControllerProvider);
            return _AiSequentialAuthoringStageCard(
              block: block,
              draftSnapshot: authoringDraftSnapshot,
            );
          },
        ),
        'project_authoring_turn' =>
          messageBlocks.any((item) => item.type == 'project_authoring_session')
              ? const SizedBox.shrink()
              : _AiSequentialAuthoringStageCard(
                  block: block,
                  draftSnapshot: authoringDraftSnapshot,
                ),
        'project_authoring_review_state' => const SizedBox.shrink(),
        'project_authoring_proposal_diff' =>
          _AiProjectAuthoringProposalDiffCard(block: block),
        _ => const SizedBox.shrink(),
      },
    );
  }
}

class _AiTextBlock extends StatelessWidget {
  const _AiTextBlock({required this.block, this.onQuickReply});

  final AiContentBlock block;
  final ValueChanged<String>? onQuickReply;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final purpose = block.purpose ?? 'answer';
    final text = block.text ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (purpose == 'safety')
          Padding(
            padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
            child: Text(
              AiL10n.purposeLabel(context, purpose),
              style: AppTextStyles.label(
                context,
              ).copyWith(color: palette.mint, fontWeight: FontWeight.w600),
            ),
          ),
        Text(
          text,
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textPrimary, height: 1.45),
          textAlign: TextAlign.start,
        ),
        if (purpose == 'clarification' && onQuickReply != null)
          _AiReservationClarificationControls(
            prompt: text,
            onSubmit: onQuickReply!,
          ),
      ],
    );
  }
}

class _AiReservationClarificationControls extends StatefulWidget {
  const _AiReservationClarificationControls({
    required this.prompt,
    required this.onSubmit,
  });

  final String prompt;
  final ValueChanged<String> onSubmit;

  @override
  State<_AiReservationClarificationControls> createState() =>
      _AiReservationClarificationControlsState();
}

class _AiReservationClarificationControlsState
    extends State<_AiReservationClarificationControls> {
  int _quantity = 1;
  DateTime? _pickupDate;
  TimeOfDay? _startTime;
  TimeOfDay? _endTime;

  bool get _isQuantityStep =>
      widget.prompt.contains('كمية') ||
      widget.prompt.toLowerCase().contains('quantity');

  bool get _isFulfillmentStep =>
      widget.prompt.contains('استلام ولا توصيل') ||
      widget.prompt.toLowerCase().contains('pickup or delivery');

  bool get _isPickupDateStep =>
      widget.prompt.contains('تاريخ الاستلام') ||
      widget.prompt.contains('pickup date');

  bool get _isPickupTimeStep =>
      widget.prompt.contains('وقت بداية ونهاية') ||
      widget.prompt.toLowerCase().contains('pickup start and end');

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      firstDate: now,
      lastDate: now.add(const Duration(days: 30)),
      initialDate: _pickupDate ?? now.add(const Duration(days: 2)),
    );
    if (picked != null) {
      setState(() => _pickupDate = picked);
      widget.onSubmit(
        '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}',
      );
    }
  }

  Future<void> _pickTime({required bool isStart}) async {
    final picked = await showTimePicker(
      context: context,
      initialTime:
          (isStart ? _startTime : _endTime) ??
          const TimeOfDay(hour: 16, minute: 0),
    );
    if (picked == null) {
      return;
    }
    setState(() {
      if (isStart) {
        _startTime = picked;
      } else {
        _endTime = picked;
      }
    });
    if (_startTime != null && _endTime != null) {
      final start =
          '${_startTime!.hour.toString().padLeft(2, '0')}:${_startTime!.minute.toString().padLeft(2, '0')}';
      final end =
          '${_endTime!.hour.toString().padLeft(2, '0')}:${_endTime!.minute.toString().padLeft(2, '0')}';
      widget.onSubmit('start:$start end $end');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isQuantityStep) {
      return Padding(
        padding: const EdgeInsetsDirectional.only(top: AppSpacing.sm),
        child: Row(
          children: [
            IconButton(
              onPressed: _quantity > 1
                  ? () => setState(() => _quantity -= 1)
                  : null,
              icon: const Icon(Icons.remove_circle_outline),
            ),
            Text('$_quantity', style: AppTextStyles.label(context)),
            IconButton(
              onPressed: _quantity < 10
                  ? () => setState(() => _quantity += 1)
                  : null,
              icon: const Icon(Icons.add_circle_outline),
            ),
            const SizedBox(width: AppSpacing.sm),
            FilledButton(
              onPressed: () => widget.onSubmit('$_quantity'),
              child: Text(
                LocalizedText(en: 'Continue', ar: 'متابعة').resolve(context),
              ),
            ),
          ],
        ),
      );
    }

    if (_isFulfillmentStep) {
      return Padding(
        padding: const EdgeInsetsDirectional.only(top: AppSpacing.sm),
        child: Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            OutlinedButton(
              onPressed: () => widget.onSubmit('استلام'),
              child: Text(
                LocalizedText(
                  en: 'Pickup from supplier',
                  ar: 'استلام من المورد',
                ).resolve(context),
              ),
            ),
            OutlinedButton(
              onPressed: () => widget.onSubmit('توصيل'),
              child: Text(
                LocalizedText(en: 'Delivery', ar: 'توصيل').resolve(context),
              ),
            ),
          ],
        ),
      );
    }

    if (_isPickupDateStep) {
      return Padding(
        padding: const EdgeInsetsDirectional.only(top: AppSpacing.sm),
        child: OutlinedButton.icon(
          onPressed: _pickDate,
          icon: const Icon(Icons.calendar_today_outlined),
          label: Text(
            LocalizedText(
              en: 'Choose pickup date',
              ar: 'اختيار تاريخ الاستلام',
            ).resolve(context),
          ),
        ),
      );
    }

    if (_isPickupTimeStep) {
      return Padding(
        padding: const EdgeInsetsDirectional.only(top: AppSpacing.sm),
        child: Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            OutlinedButton(
              onPressed: () => _pickTime(isStart: true),
              child: Text(
                LocalizedText(
                  en: 'Start time',
                  ar: 'وقت البداية',
                ).resolve(context),
              ),
            ),
            OutlinedButton(
              onPressed: () => _pickTime(isStart: false),
              child: Text(
                LocalizedText(
                  en: 'End time',
                  ar: 'وقت النهاية',
                ).resolve(context),
              ),
            ),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }
}

class _AiErrorBlock extends StatelessWidget {
  const _AiErrorBlock({required this.block});

  final AiContentBlock block;

  @override
  Widget build(BuildContext context) {
    final looksLikeTimeout = (block.message ?? '').toLowerCase().contains(
      'timed out',
    );
    final message = block.code != null
        ? AiL10n.errorMessageForCode(context, block.code)
        : looksLikeTimeout
        ? AiL10n.chatAssistantTimeout.resolve(context)
        : AiL10n.genericFailure.resolve(context);

    return Text(
      message,
      style: AppTextStyles.body(
        context,
      ).copyWith(color: materialWarning, height: 1.45),
      textAlign: TextAlign.start,
    );
  }
}

class _AiMaterialResultsBlock extends StatelessWidget {
  const _AiMaterialResultsBlock({required this.items});

  final List<AiMaterialCardItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }

    return _AiBlockSection(
      title: AiL10n.materialsSection.resolve(context),
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.sm),
            _AiMaterialCompactCard(item: items[i]),
          ],
        ],
      ),
    );
  }
}

class _AiMaterialDetailsBlock extends StatelessWidget {
  const _AiMaterialDetailsBlock({required this.item});

  final AiMaterialCardItem item;

  @override
  Widget build(BuildContext context) {
    return _AiBlockSection(
      title: AiL10n.materialDetailsSection.resolve(context),
      child: _AiMaterialCompactCard(item: item),
    );
  }
}

class _AiMaterialCompactCard extends StatelessWidget {
  const _AiMaterialCompactCard({required this.item});

  final AiMaterialCardItem item;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final isFree = _isFreePrice(item.priceLabel);
    final resolvedThumbnailUrl = ApiConfig.resolveApiAssetUrl(
      item.thumbnailUrl ?? '',
    );
    final card = ImpactMaterialCompactCard(
      title: item.title,
      description: item.categoryLabel ?? '',
      category: item.categoryLabel ?? '',
      conditionLabel: item.condition ?? '',
      conditionTone: _conditionTone(item.condition),
      statusLabel: AiL10n.availableLabel.resolve(context),
      statusTone: MaterialStatusBadgeTone.available,
      quantityLabel: item.quantityLabel ?? '',
      priceLabel: item.priceLabel,
      locationLabel: _locationLabel(item),
      availabilityLabel: _availabilityLabel(context, item),
      deliveryAvailable: item.deliveryAllowed == true,
      isFree: isFree,
      gradientColors: [palette.fallbackStart, palette.fallbackEnd],
      imageUrl: resolvedThumbnailUrl,
      onTap: item.materialId.isEmpty
          ? null
          : () => context.push('/materials/${item.materialId}'),
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 280) {
          return card;
        }

        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SizedBox(width: 280, child: card),
        );
      },
    );
  }
}

class _AiProjectResultsBlock extends StatelessWidget {
  const _AiProjectResultsBlock({required this.items});

  final List<AiProjectCardItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }

    return _AiBlockSection(
      title: AiL10n.projectsSection.resolve(context),
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.sm),
            _AiProjectCompactCard(item: items[i]),
          ],
        ],
      ),
    );
  }
}

class _AiProjectDetailsBlock extends StatelessWidget {
  const _AiProjectDetailsBlock({required this.item});

  final AiProjectCardItem item;

  @override
  Widget build(BuildContext context) {
    return _AiBlockSection(
      title: AiL10n.projectDetailsSection.resolve(context),
      child: _AiProjectCompactCard(item: item, showSummary: true),
    );
  }
}

class _AiProjectCompactCard extends StatelessWidget {
  const _AiProjectCompactCard({required this.item, this.showSummary = false});

  final AiProjectCardItem item;
  final bool showSummary;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final hasImage =
        item.thumbnailUrl != null && item.thumbnailUrl!.trim().isNotEmpty;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: AppRadius.lgAll,
        onTap: item.projectId.isEmpty
            ? null
            : () => context.push('/learning/${item.projectId}'),
        child: Container(
          decoration: BoxDecoration(
            color: palette.cardSurface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: palette.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClipRRect(
                borderRadius: const BorderRadiusDirectional.only(
                  topStart: Radius.circular(AppRadius.lg),
                  topEnd: Radius.circular(AppRadius.lg),
                ),
                child: SizedBox(
                  height: 96,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: AlignmentDirectional.topStart,
                            end: AlignmentDirectional.bottomEnd,
                            colors: [
                              colors.primary.withValues(alpha: 0.72),
                              palette.fallbackEnd,
                            ],
                          ),
                        ),
                      ),
                      if (hasImage)
                        Image.network(
                          item.thumbnailUrl!.trim(),
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) =>
                              const SizedBox.shrink(),
                        ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: AppTextStyles.label(
                        context,
                      ).copyWith(color: palette.textPrimary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (showSummary && (item.summary?.isNotEmpty ?? false)) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        item.summary!,
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: palette.textSecondary, height: 1.4),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    if (_projectMetaLabels(item).isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.xs,
                        runSpacing: AppSpacing.xs,
                        children: [
                          for (final label in _projectMetaLabels(item))
                            _AiMetaChip(label: label),
                        ],
                      ),
                    ],
                    if (item.readinessPercent != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        item.matchExplanation?.trim().isNotEmpty == true
                            ? item.matchExplanation!.trim()
                            : '${item.title} — ${item.readinessPercent}%',
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: palette.textSecondary, height: 1.4),
                      ),
                      if (item.matchedComponents.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          AiL10n.matchedComponentsLabel.resolve(context),
                          style: AppTextStyles.label(context).copyWith(
                            color: palette.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Wrap(
                          spacing: AppSpacing.xs,
                          runSpacing: AppSpacing.xs,
                          children: [
                            for (final component in item.matchedComponents)
                              _AiMetaChip(label: component),
                          ],
                        ),
                      ],
                      if (item.missingComponents.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          AiL10n.missingComponentsLabel.resolve(context),
                          style: AppTextStyles.label(context).copyWith(
                            color: palette.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Wrap(
                          spacing: AppSpacing.xs,
                          runSpacing: AppSpacing.xs,
                          children: [
                            for (final component in item.missingComponents)
                              _AiMetaChip(label: component),
                          ],
                        ),
                      ],
                      const SizedBox(height: AppSpacing.sm),
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: Text(
                          AiL10n.viewProject.resolve(context),
                          style: AppTextStyles.label(
                            context,
                          ).copyWith(color: colors.primary),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AiComponentListBlock extends StatelessWidget {
  const _AiComponentListBlock({required this.projectId, required this.items});

  final String? projectId;
  final List<AiComponentListItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }

    final palette = MaterialsUiPalette.of(context);

    return _AiBlockSection(
      title: AiL10n.componentsSection.resolve(context),
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++)
            Padding(
              padding: EdgeInsetsDirectional.only(
                bottom: i == items.length - 1 ? 0 : AppSpacing.xs,
              ),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: palette.mutedSurface.withValues(alpha: 0.5),
                  borderRadius: AppRadius.mdAll,
                  border: Border.all(color: palette.borderSubtle),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            items[i].name,
                            style: AppTextStyles.label(context).copyWith(
                              color: palette.textPrimary,
                              fontSize: 13,
                            ),
                          ),
                          if (items[i].categoryLabel?.isNotEmpty ?? false)
                            Text(
                              items[i].categoryLabel!,
                              style: AppTextStyles.body(context).copyWith(
                                color: palette.textMuted,
                                fontSize: 12,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      _quantityLabel(items[i]),
                      style: AppTextStyles.body(context).copyWith(
                        color: palette.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (projectId != null && projectId!.isNotEmpty)
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: TextButton(
                onPressed: () => context.push('/learning/$projectId'),
                child: Text(AiL10n.viewProject.resolve(context)),
              ),
            ),
        ],
      ),
    );
  }
}

class _AiBuildStepGuideBlock extends StatelessWidget {
  const _AiBuildStepGuideBlock({required this.block});

  final AiContentBlock block;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final stepNumber = block.stepNumber;
    final totalSteps = block.totalSteps;
    final title = block.guideTitle;
    final description = block.guideDescription;

    if (title == null || title.isEmpty) {
      return const SizedBox.shrink();
    }

    final header = stepNumber != null && totalSteps != null
        ? AiL10n.currentStepOfTotal(
            context,
            stepNumber: stepNumber,
            total: totalSteps,
          )
        : null;
    final progressLabel =
        block.progressPercent != null &&
            block.completedSteps != null &&
            totalSteps != null
        ? AiL10n.completedStepsProgress(
            context,
            completed: block.completedSteps!,
            total: totalSteps,
            percent: block.progressPercent!,
          )
        : null;

    return _AiBlockSection(
      title: title,
      subtitle: header,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (progressLabel != null) ...[
            Text(
              progressLabel,
              style: AppTextStyles.label(
                context,
              ).copyWith(color: palette.textMuted),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          if (description != null && description.isNotEmpty)
            Text(
              description,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textPrimary, height: 1.45),
            ),
        ],
      ),
    );
  }
}

class _AiBuildChecklistBlock extends StatelessWidget {
  const _AiBuildChecklistBlock({
    required this.buildId,
    required this.projectId,
    required this.readyCount,
    required this.totalRequired,
    required this.items,
  });

  final String? buildId;
  final String? projectId;
  final int? readyCount;
  final int? totalRequired;
  final List<AiBuildChecklistItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }

    final palette = MaterialsUiPalette.of(context);
    final progressLabel = readyCount != null && totalRequired != null
        ? AiL10n.checklistProgress(context, readyCount!, totalRequired!)
        : null;

    return _AiBlockSection(
      title: AiL10n.buildChecklistSection.resolve(context),
      subtitle: progressLabel,
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++)
            Padding(
              padding: EdgeInsetsDirectional.only(
                bottom: i == items.length - 1 ? 0 : AppSpacing.xs,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    _checklistIcon(items[i].status),
                    size: 18,
                    color: _checklistColor(palette, items[i].status),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          items[i].name,
                          style: AppTextStyles.body(context).copyWith(
                            color: palette.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          items[i].readinessLabel,
                          style: AppTextStyles.body(
                            context,
                          ).copyWith(color: palette.textMuted, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          if (buildId != null &&
              projectId != null &&
              buildId!.isNotEmpty &&
              projectId!.isNotEmpty)
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: TextButton(
                onPressed: () => context.push('/learning/$projectId/build'),
                child: Text(AiL10n.viewBuild.resolve(context)),
              ),
            ),
        ],
      ),
    );
  }
}

class _AiProjectBudgetEstimateBlock extends StatelessWidget {
  const _AiProjectBudgetEstimateBlock({required this.estimate});

  final AiProjectBudgetEstimate estimate;

  String _formatMoney(BuildContext context, double value) {
    if (value == 0) {
      return Directionality.of(context) == TextDirection.rtl ? '0 ₪' : '0 NIS';
    }
    return '${value.toStringAsFixed(value == value.roundToDouble() ? 0 : 2)} ₪';
  }

  String _statusLabel(BuildContext context, String status) {
    return switch (status) {
      'SELECTED' => AiL10n.budgetStatusSelected.resolve(context),
      'NO_AVAILABLE_MATCH' => AiL10n.budgetStatusNoMatch.resolve(context),
      'INSUFFICIENT_QUANTITY' => AiL10n.budgetStatusInsufficient.resolve(
        context,
      ),
      'PRICE_UNAVAILABLE' => AiL10n.budgetStatusUnpriced.resolve(context),
      'UNSUPPORTED_CURRENCY' => AiL10n.budgetStatusUnsupportedCurrency.resolve(
        context,
      ),
      'UNIT_ASSUMPTION_REQUIRED' => AiL10n.budgetStatusUnitAssumption.resolve(
        context,
      ),
      _ => status,
    };
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    final statusLabel = switch (estimate.estimateStatus) {
      'COMPLETE' => AiL10n.budgetEstimateComplete.resolve(context),
      'ZERO_COST_AVAILABLE_MATERIALS' => AiL10n.budgetEstimateZeroCost.resolve(
        context,
      ),
      _ => AiL10n.budgetEstimatePartial.resolve(context),
    };

    return _AiBlockSection(
      title: AiL10n.budgetEstimateSection.resolve(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              gradient: LinearGradient(
                colors: [palette.fallbackStart, palette.fallbackEnd],
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  statusLabel,
                  style: AppTextStyles.label(context).copyWith(fontSize: 13),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  AiL10n.budgetEstimatedSubtotal.resolve(context),
                  style: AppTextStyles.body(context).copyWith(
                    fontSize: 12,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  _formatMoney(context, estimate.estimatedSubtotalNis),
                  style: AppTextStyles.title(context).copyWith(fontSize: 22),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  AiL10n.budgetCoverageSummary
                      .resolve(context)
                      .replaceAll(
                        '{priced}',
                        '${estimate.pricedComponentCount}',
                      )
                      .replaceAll(
                        '{total}',
                        '${estimate.requiredComponentCount}',
                      ),
                  style: AppTextStyles.body(context).copyWith(fontSize: 12),
                ),
              ],
            ),
          ),
          if (estimate.quantityAssumptionWarning?.isNotEmpty == true) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              estimate.quantityAssumptionWarning!,
              style: AppTextStyles.body(context).copyWith(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Text(
            estimate.deliveryExcludedNotice,
            style: AppTextStyles.body(context).copyWith(
              fontSize: 12,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          for (var i = 0; i < estimate.components.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.md),
            Text(
              estimate.components[i].componentName,
              style: AppTextStyles.label(context).copyWith(fontSize: 13),
            ),
            const SizedBox(height: AppSpacing.xs),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (estimate
                              .components[i]
                              .selectedMaterialTitle
                              ?.isNotEmpty ==
                          true)
                        Text(
                          estimate.components[i].selectedMaterialTitle!,
                          style: AppTextStyles.body(
                            context,
                          ).copyWith(fontSize: 13),
                        )
                      else
                        Text(
                          _statusLabel(context, estimate.components[i].status),
                          style: AppTextStyles.body(context).copyWith(
                            fontSize: 13,
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      if (estimate.components[i].assumptionNote?.isNotEmpty ==
                          true)
                        Padding(
                          padding: const EdgeInsets.only(top: AppSpacing.xs),
                          child: Text(
                            estimate.components[i].assumptionNote!,
                            style: AppTextStyles.body(context).copyWith(
                              fontSize: 11,
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                      if (estimate.components[i].alternativesCount > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: AppSpacing.xs),
                          child: Text(
                            AiL10n.budgetAlternativesCount
                                .resolve(context)
                                .replaceAll(
                                  '{count}',
                                  '${estimate.components[i].alternativesCount}',
                                ),
                            style: AppTextStyles.body(context).copyWith(
                              fontSize: 11,
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Column(
                  crossAxisAlignment: isRtl
                      ? CrossAxisAlignment.start
                      : CrossAxisAlignment.end,
                  children: [
                    Text(
                      estimate.components[i].effectiveComponentCost == null
                          ? _statusLabel(context, estimate.components[i].status)
                          : _formatMoney(
                              context,
                              estimate.components[i].effectiveComponentCost!,
                            ),
                      style: AppTextStyles.label(
                        context,
                      ).copyWith(fontSize: 13),
                    ),
                    if (estimate.components[i].selectedMaterialId?.isNotEmpty ==
                        true)
                      TextButton(
                        onPressed: () => context.push(
                          '/materials/${estimate.components[i].selectedMaterialId}',
                        ),
                        child: Text(AiL10n.viewMaterial.resolve(context)),
                      ),
                  ],
                ),
              ],
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton(
              onPressed: estimate.projectId.isEmpty
                  ? null
                  : () => context.push(
                      '/learning/projects/${estimate.projectId}',
                    ),
              child: Text(AiL10n.viewProject.resolve(context)),
            ),
          ),
        ],
      ),
    );
  }
}

class _AiComponentMatchesBlock extends StatelessWidget {
  const _AiComponentMatchesBlock({required this.buildId, required this.groups});

  final String? buildId;
  final List<AiComponentMatchGroup> groups;

  @override
  Widget build(BuildContext context) {
    if (groups.isEmpty) {
      return const SizedBox.shrink();
    }

    return _AiBlockSection(
      title: AiL10n.componentMatchesSection.resolve(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < groups.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.md),
            Text(
              groups[i].componentName,
              style: AppTextStyles.label(context).copyWith(fontSize: 13),
            ),
            const SizedBox(height: AppSpacing.xs),
            if (groups[i].materials.isEmpty)
              Text(
                AiL10n.componentMatchesNoListing.resolve(context),
                style: AppTextStyles.body(context).copyWith(
                  fontSize: 12,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              )
            else
              for (var j = 0; j < groups[i].materials.length; j++) ...[
                if (j > 0) const SizedBox(height: AppSpacing.xs),
                _AiMaterialCompactCard(item: groups[i].materials[j]),
              ],
          ],
        ],
      ),
    );
  }
}

class _AiComparisonBlock extends StatelessWidget {
  const _AiComparisonBlock({required this.subject, required this.items});

  final String? subject;
  final List<AiComparisonItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.length < 2) {
      return const SizedBox.shrink();
    }

    final palette = MaterialsUiPalette.of(context);
    final title = subject == 'PROJECT'
        ? AiL10n.projectComparisonSection.resolve(context)
        : AiL10n.materialComparisonSection.resolve(context);

    return _AiBlockSection(
      title: title,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final useRow = constraints.maxWidth >= 360 && items.length == 2;

          if (useRow) {
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < items.length; i++) ...[
                  if (i > 0) const SizedBox(width: AppSpacing.sm),
                  Expanded(child: _comparisonCard(context, palette, items[i])),
                ],
              ],
            );
          }

          return Column(
            children: [
              for (var i = 0; i < items.length; i++) ...[
                if (i > 0) const SizedBox(height: AppSpacing.sm),
                _comparisonCard(context, palette, items[i]),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _comparisonCard(
    BuildContext context,
    MaterialsUiPalette palette,
    AiComparisonItem item,
  ) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: palette.mutedSurface.withValues(alpha: 0.45),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.title,
            style: AppTextStyles.label(context).copyWith(fontSize: 13),
          ),
          const SizedBox(height: AppSpacing.xs),
          for (final fact in item.facts)
            Padding(
              padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '• ',
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textSecondary),
                  ),
                  Expanded(
                    child: Text(
                      fact,
                      style: AppTextStyles.body(context).copyWith(
                        color: palette.textSecondary,
                        fontSize: 13,
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _AiRecommendationsBlock extends StatelessWidget {
  const _AiRecommendationsBlock({
    required this.recommendationType,
    required this.items,
  });

  final String? recommendationType;
  final List<AiRecommendationItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }

    final title = switch (recommendationType) {
      'PROJECTS' => AiL10n.recommendedProjectsSection.resolve(context),
      'NEXT_ACTIONS' => AiL10n.recommendedActionsSection.resolve(context),
      _ => AiL10n.recommendedMaterialsSection.resolve(context),
    };

    final palette = MaterialsUiPalette.of(context);

    return _AiBlockSection(
      title: title,
      child: LayoutBuilder(
        builder: (context, constraints) {
          return Column(
            children: [
              for (var i = 0; i < items.length; i++)
                Padding(
                  padding: EdgeInsetsDirectional.only(
                    bottom: i == items.length - 1 ? 0 : AppSpacing.md,
                  ),
                  child: _AiRecommendationTile(
                    item: items[i],
                    maxWidth: constraints.maxWidth,
                    palette: palette,
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _AiRecommendationTile extends StatelessWidget {
  const _AiRecommendationTile({
    required this.item,
    required this.maxWidth,
    required this.palette,
  });

  final AiRecommendationItem item;
  final double maxWidth;
  final MaterialsUiPalette palette;

  @override
  Widget build(BuildContext context) {
    final reason = item.primaryReason;
    final reasonLabel = reason.isNotEmpty
        ? reason
        : AiL10n.recommendationReasonFallback.resolve(context);

    final materialCard = item.toMaterialCardItem();
    if (materialCard != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _AiMaterialCompactCard(item: materialCard),
          if (reasonLabel.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              reasonLabel,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.body(context).copyWith(
                color: palette.textSecondary,
                fontSize: 12,
                height: 1.35,
              ),
            ),
          ],
        ],
      );
    }

    final projectCard = item.toProjectCardItem();
    if (projectCard != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _AiProjectCompactCard(item: projectCard),
          if (reasonLabel.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              reasonLabel,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.body(context).copyWith(
                color: palette.textSecondary,
                fontSize: 12,
                height: 1.35,
              ),
            ),
          ],
        ],
      );
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: AppRadius.mdAll,
        onTap: () => _openRecommendation(context, item),
        child: Padding(
          padding: const EdgeInsetsDirectional.symmetric(
            vertical: AppSpacing.xs,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.title,
                style: AppTextStyles.label(context).copyWith(fontSize: 13),
              ),
              if (reasonLabel.isNotEmpty)
                Text(
                  reasonLabel,
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                    fontSize: 12,
                    height: 1.35,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AiActionConfirmationBlock extends StatelessWidget {
  const _AiActionConfirmationBlock({
    required this.block,
    required this.uiState,
    this.onConfirm,
    this.onCancel,
  });

  final AiContentBlock block;
  final AiActionConfirmationUiState uiState;
  final VoidCallback? onConfirm;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final isDisabled = uiState.isDisabled;
    final isBusy = uiState.isBusy;

    return _AiBlockSection(
      title:
          block.actionTitle ??
          AiL10n.actionConfirmationSection.resolve(context),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.warningSoft.withValues(alpha: 0.35),
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: colors.warningBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (block.actionSummary?.isNotEmpty ?? false)
              Text(
                block.actionSummary!,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textPrimary, height: 1.4),
                textAlign: TextAlign.start,
              ),
            if (block.actionTarget != null &&
                !(block.actionSummary?.contains('\n') ?? false)) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                block.actionTarget!.title,
                style: AppTextStyles.label(context).copyWith(fontSize: 13),
                textAlign: TextAlign.start,
              ),
            ],
            if (uiState.resolvedStatus == 'EXPIRED') ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                AiL10n.actionExpired.resolve(context),
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textMuted),
                textAlign: TextAlign.start,
              ),
            ],
            if (uiState.errorMessage != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                uiState.errorMessage!,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: materialWarning, height: 1.35),
                textAlign: TextAlign.start,
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            LayoutBuilder(
              builder: (context, constraints) {
                final stacked = constraints.maxWidth < 300;
                final cancelButton = OutlinedButton(
                  onPressed: isDisabled ? null : onCancel,
                  child: Text(
                    block.cancelLabel ?? AiL10n.cancelAction.resolve(context),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                  ),
                );
                final confirmButton = FilledButton(
                  onPressed: isDisabled ? null : onConfirm,
                  child: isBusy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(
                          block.confirmLabel ??
                              AiL10n.confirmAction.resolve(context),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                        ),
                );

                if (stacked) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      confirmButton,
                      const SizedBox(height: AppSpacing.sm),
                      cancelButton,
                    ],
                  );
                }

                return Row(
                  children: [
                    Expanded(child: cancelButton),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(child: confirmButton),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _AiActionResultBlock extends StatelessWidget {
  const _AiActionResultBlock({required this.block});

  final AiContentBlock block;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final statusColor = switch (block.actionStatus) {
      'EXECUTED' => palette.mint,
      'CANCELLED' => palette.textMuted,
      'FAILED' => materialWarning,
      _ => palette.textSecondary,
    };
    final statusIcon = switch (block.actionStatus) {
      'EXECUTED' => Icons.check_circle_outline_rounded,
      'CANCELLED' => Icons.cancel_outlined,
      'FAILED' => Icons.error_outline_rounded,
      _ => Icons.info_outline_rounded,
    };

    return _AiBlockSection(
      title: block.actionTitle ?? AiL10n.actionResultSection.resolve(context),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(statusIcon, color: statusColor, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (block.actionSummary?.isNotEmpty ?? false)
                  Text(
                    block.actionSummary!,
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textPrimary, height: 1.4),
                  ),
                if (block.actionTarget != null)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(
                      top: AppSpacing.xs,
                    ),
                    child: Text(
                      block.actionTarget!.title,
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textMuted, fontSize: 12),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AiExternalSourcesBlock extends StatelessWidget {
  const _AiExternalSourcesBlock({required this.items});

  final List<AiExternalSourceItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }

    final palette = MaterialsUiPalette.of(context);

    return _AiBlockSection(
      title: AiL10n.externalSourcesSection.resolve(context),
      subtitle: AiL10n.externalSourcesCaveat.resolve(context),
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++)
            Padding(
              padding: EdgeInsetsDirectional.only(
                bottom: i == items.length - 1 ? 0 : AppSpacing.sm,
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: AppRadius.mdAll,
                  onTap: () => _launchExternalUrl(items[i].url),
                  child: Padding(
                    padding: const EdgeInsetsDirectional.symmetric(
                      vertical: AppSpacing.xs,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          items[i].title,
                          style: AppTextStyles.link(
                            context,
                          ).copyWith(fontSize: 13),
                        ),
                        if (items[i].snippet?.isNotEmpty ?? false)
                          Text(
                            items[i].snippet!,
                            style: AppTextStyles.body(context).copyWith(
                              color: palette.textMuted,
                              fontSize: 12,
                              height: 1.35,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _AiBlockSection extends StatelessWidget {
  const _AiBlockSection({
    required this.title,
    required this.child,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textPrimary, fontSize: 13),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            subtitle!,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textMuted, fontSize: 12),
          ),
        ],
        const SizedBox(height: AppSpacing.sm),
        child,
      ],
    );
  }
}

class _AiMetaChip extends StatelessWidget {
  const _AiMetaChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.mutedSurface,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Text(
        label,
        style: AppTextStyles.body(context).copyWith(
          color: palette.textSecondary,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

MaterialConditionBadgeTone _conditionTone(String? condition) {
  final normalized = condition?.toLowerCase().trim() ?? '';
  if (normalized.contains('like') || normalized.contains('new')) {
    return MaterialConditionBadgeTone.likeNew;
  }
  if (normalized.contains('fair') || normalized.contains('worn')) {
    return MaterialConditionBadgeTone.fair;
  }
  if (normalized.contains('mixed')) {
    return MaterialConditionBadgeTone.mixed;
  }
  return MaterialConditionBadgeTone.good;
}

bool _isFreePrice(String priceLabel) {
  final normalized = priceLabel.toLowerCase().trim();
  return normalized == 'free' || normalized == 'مجاني';
}

String _locationLabel(AiMaterialCardItem item) {
  final location = item.locationLabel?.trim() ?? '';
  if (location.isEmpty) {
    return '';
  }
  if (item.distanceKm == null) {
    return location;
  }
  final distance = item.distanceKm!.toStringAsFixed(1);
  return '$location · $distance km';
}

String _availabilityLabel(BuildContext context, AiMaterialCardItem item) {
  final pickup = item.pickupAllowed == true;
  final delivery = item.deliveryAllowed == true;
  if (pickup && delivery) {
    return AiL10n.pickupAndDelivery.resolve(context);
  }
  if (delivery) {
    return AiL10n.deliveryOnly.resolve(context);
  }
  if (pickup) {
    return AiL10n.pickupOnly.resolve(context);
  }
  return AiL10n.availableLabel.resolve(context);
}

List<String> _projectMetaLabels(AiProjectCardItem item) {
  return [
    if (item.categoryLabel?.isNotEmpty ?? false) item.categoryLabel!,
    if (item.difficulty?.isNotEmpty ?? false) item.difficulty!,
    if (item.estimatedTimeLabel?.isNotEmpty ?? false) item.estimatedTimeLabel!,
    if (item.readinessPercent != null) '${item.readinessPercent}%',
    ...item.interestLabels.where((label) => label.trim().isNotEmpty),
  ];
}

String _quantityLabel(AiComponentListItem item) {
  final unit = item.unit?.trim();
  final quantity = item.quantity == item.quantity.roundToDouble()
      ? item.quantity.toInt().toString()
      : item.quantity.toString();
  if (unit != null && unit.isNotEmpty) {
    return '$quantity $unit';
  }
  return quantity;
}

IconData _checklistIcon(String status) {
  switch (status.toUpperCase()) {
    case 'READY':
    case 'LINKED':
    case 'COMPLETE':
      return Icons.check_circle_outline_rounded;
    case 'PARTIAL':
      return Icons.timelapse_rounded;
    default:
      return Icons.radio_button_unchecked_rounded;
  }
}

Color _checklistColor(MaterialsUiPalette palette, String status) {
  switch (status.toUpperCase()) {
    case 'READY':
    case 'LINKED':
    case 'COMPLETE':
      return palette.mint;
    case 'PARTIAL':
      return materialWarning;
    default:
      return palette.textMuted;
  }
}

class _AiProjectAuthoringClarificationCard extends ConsumerStatefulWidget {
  const _AiProjectAuthoringClarificationCard({
    required this.block,
    required this.locale,
    this.projectUpdatedAt,
  });

  final AiContentBlock block;
  final String locale;
  final DateTime? projectUpdatedAt;

  @override
  ConsumerState<_AiProjectAuthoringClarificationCard> createState() =>
      _AiProjectAuthoringClarificationCardState();
}

class _AiProjectAuthoringClarificationCardState
    extends ConsumerState<_AiProjectAuthoringClarificationCard> {
  final Set<String> _selectedOptions = <String>{};

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final chatState = ref.watch(aiAssistantControllerProvider);
    final controller = ref.read(aiAssistantControllerProvider.notifier);
    final canAnswer = chatState.canSend;
    final question = widget.block.authoringNextQuestion;
    final isReady = widget.block.authoringStatus == 'READY_FOR_PROPOSAL';
    final hasCurrentProposal = widget.projectUpdatedAt == null
        ? controller.findLatestAuthoringProposalState()?.proposal != null
        : controller.hasCurrentAuthoringProposal(
            projectUpdatedAt: widget.projectUpdatedAt!,
          );
    final hasSequential = controller.hasActiveSequentialAuthoring;
    final canGenerate =
        isReady &&
        !hasCurrentProposal &&
        chatState.canGenerateProposal &&
        !hasSequential;

    Future<void> submitAnswer(String answer) async {
      if (!canAnswer || answer.trim().isEmpty) {
        return;
      }
      await controller.sendMessage(text: answer.trim(), locale: widget.locale);
      if (mounted) {
        setState(() => _selectedOptions.clear());
      }
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if ((widget.block.authoringSummary ?? '').isNotEmpty) ...[
              Text(
                AiL10n.authoringWhatIUnderstand.resolve(context),
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                widget.block.authoringSummary!,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textPrimary, height: 1.45),
                textDirection: resolveContentTextDirection(
                  widget.block.authoringSummary!,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            if (widget.block.authoringKnownFacts.isNotEmpty) ...[
              for (final fact in widget.block.authoringKnownFacts)
                Padding(
                  padding: const EdgeInsetsDirectional.only(
                    bottom: AppSpacing.xs,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 2,
                        child: Text(
                          fact.label,
                          style: AppTextStyles.label(
                            context,
                          ).copyWith(color: palette.textSecondary),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        flex: 3,
                        child: Text(
                          fact.value,
                          style: AppTextStyles.body(
                            context,
                          ).copyWith(color: palette.textPrimary),
                          textDirection: resolveContentTextDirection(
                            fact.value,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: AppSpacing.sm),
            ],
            if (isReady) ...[
              Text(
                AiL10n.authoringReadyForProposal.resolve(context),
                style: AppTextStyles.subtitle(
                  context,
                ).copyWith(color: palette.heroMid),
                textDirection: resolveContentTextDirection(
                  AiL10n.authoringReadyForProposal.resolve(context),
                ),
              ),
              if (canGenerate || chatState.isGeneratingProposal) ...[
                const SizedBox(height: AppSpacing.sm),
                FilledButton(
                  onPressed: canGenerate
                      ? () => controller.generateProjectProposal()
                      : null,
                  child: chatState.isGeneratingProposal
                      ? Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Theme.of(context).colorScheme.onPrimary,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Text(
                              AiL10n.authoringGeneratingProposal.resolve(
                                context,
                              ),
                            ),
                          ],
                        )
                      : Text(AiL10n.authoringGenerateProposal.resolve(context)),
                ),
              ],
            ] else if (question != null && question.prompt.isNotEmpty) ...[
              Text(
                AiL10n.authoringCurrentQuestion.resolve(context),
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                question.prompt,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textPrimary, height: 1.45),
                textDirection: resolveContentTextDirection(question.prompt),
              ),
              const SizedBox(height: AppSpacing.sm),
              if (question.answerType == 'SINGLE_CHOICE')
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    for (final option in question.options)
                      ActionChip(
                        label: Text(option),
                        onPressed: canAnswer
                            ? () => submitAnswer(option)
                            : null,
                      ),
                  ],
                )
              else if (question.answerType == 'MULTI_CHOICE') ...[
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    for (final option in question.options)
                      FilterChip(
                        label: Text(option),
                        selected: _selectedOptions.contains(option),
                        onSelected: canAnswer
                            ? (selected) {
                                setState(() {
                                  if (selected) {
                                    _selectedOptions.add(option);
                                  } else {
                                    _selectedOptions.remove(option);
                                  }
                                });
                              }
                            : null,
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                FilledButton(
                  onPressed: canAnswer && _selectedOptions.isNotEmpty
                      ? () => submitAnswer(_selectedOptions.join(', '))
                      : null,
                  child: Text(
                    AiL10n.authoringConfirmSelection.resolve(context),
                  ),
                ),
              ],
            ],
            if (widget.block.authoringAssumptions.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                AiL10n.authoringAssumptions.resolve(context),
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              for (final assumption in widget.block.authoringAssumptions)
                Padding(
                  padding: const EdgeInsetsDirectional.only(
                    bottom: AppSpacing.xs,
                  ),
                  child: Text(
                    assumption,
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textPrimary),
                    textDirection: resolveContentTextDirection(assumption),
                  ),
                ),
            ],
            if (widget.block.authoringWarnings.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                AiL10n.authoringWarnings.resolve(context),
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              for (final warning in widget.block.authoringWarnings)
                Padding(
                  padding: const EdgeInsetsDirectional.only(
                    bottom: AppSpacing.xs,
                  ),
                  child: Text(
                    warning,
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textPrimary),
                    textDirection: resolveContentTextDirection(warning),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AiProjectAuthoringProposalCard extends ConsumerStatefulWidget {
  const _AiProjectAuthoringProposalCard({
    required this.block,
    this.projectUpdatedAt,
    this.draftSnapshot,
  });

  final AiContentBlock block;
  final DateTime? projectUpdatedAt;
  final AuthoringDraftSnapshot? draftSnapshot;

  @override
  ConsumerState<_AiProjectAuthoringProposalCard> createState() =>
      _AiProjectAuthoringProposalCardState();
}

class _AiProjectAuthoringProposalCardState
    extends ConsumerState<_AiProjectAuthoringProposalCard> {
  final Set<String> _expandedChangeTargets = <String>{};

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final controller = ref.read(aiAssistantControllerProvider.notifier);
    final chatState = ref.watch(aiAssistantControllerProvider);
    final project = widget.block.authoringProposalProject;
    if (project == null || project.title.isEmpty) {
      return const SizedBox.shrink();
    }

    final proposalId = widget.block.authoringProposalId;
    final latestProposal = controller
        .findLatestAuthoringProposalState()
        ?.proposal;
    final isLatestProposal =
        latestProposal != null &&
        latestProposal.authoringProposalId == proposalId;

    final isStale =
        widget.projectUpdatedAt != null &&
        widget.block.authoringProposalBaseUpdatedAt != null &&
        widget.block.authoringProposalBaseUpdatedAt !=
            widget.projectUpdatedAt!.toUtc().toIso8601String();

    final review = proposalId == null
        ? null
        : controller.findLatestReviewStateForProposal(proposalId);
    final reviewBusy =
        chatState.isSubmittingReview ||
        chatState.isRevisingProposal ||
        chatState.isPreparingApply;
    final controlsEnabled =
        isLatestProposal &&
        !isStale &&
        !(review?.isApplied ?? false) &&
        !reviewBusy;

    String formatDuration(int? minutes) {
      if (minutes == null || minutes <= 0) {
        return '—';
      }
      if (minutes < 60) {
        return '$minutes min';
      }
      final hours = minutes ~/ 60;
      final remainder = minutes % 60;
      if (remainder == 0) {
        return '$hours h';
      }
      return '$hours h $remainder min';
    }

    Widget sectionTitle(String label) {
      return Text(
        label,
        style: AppTextStyles.label(
          context,
        ).copyWith(color: palette.textSecondary, fontWeight: FontWeight.w600),
      );
    }

    String? latestRevisionComment(String target) {
      final requests = review?.revisionRequests ?? const [];
      for (var index = requests.length - 1; index >= 0; index -= 1) {
        final request = requests[index];
        if (request.target == target && request.status == 'OPEN') {
          return request.comment;
        }
      }
      return null;
    }

    String decisionForTarget(String target) {
      if (review == null) {
        return 'UNREVIEWED';
      }
      final fields = review.fieldDecisions;
      return switch (target) {
        'title' => fields.title,
        'shortDescription' => fields.shortDescription,
        'description' => fields.description,
        'difficulty' => fields.difficulty,
        'estimatedMinutes' => fields.estimatedMinutes,
        'components' => review.componentDecision,
        'steps' => review.stepDecision,
        _ => 'UNREVIEWED',
      };
    }

    bool isDiscussionDecision(String decision) =>
        decision == 'UNDER_DISCUSSION' ||
        decision == 'REVISION_REQUESTED' ||
        decision == 'NEEDS_REVISION';

    Widget decisionBadge(String decision) {
      final label = switch (decision) {
        'ACCEPT_PROPOSAL' => AiL10n.authoringReviewDecisionAccept,
        'KEEP_CURRENT' => AiL10n.authoringReviewDecisionKeep,
        'UNDER_DISCUSSION' => AiL10n.authoringReviewDecisionUnderDiscussion,
        'REVISION_REQUESTED' => AiL10n.authoringReviewDecisionRevisionRequested,
        'NEEDS_REVISION' => AiL10n.authoringReviewDecisionRevisionRequested,
        _ => AiL10n.authoringReviewDecisionUnreviewed,
      };
      final color = switch (decision) {
        'ACCEPT_PROPOSAL' => palette.mint,
        'KEEP_CURRENT' => palette.heroMid,
        'UNDER_DISCUSSION' => materialWarning,
        'REVISION_REQUESTED' => materialWarning,
        'NEEDS_REVISION' => materialWarning,
        _ => palette.textSecondary,
      };
      return Container(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: AppRadius.smAll,
        ),
        child: Text(
          label.resolve(context),
          style: AppTextStyles.label(
            context,
          ).copyWith(color: color, fontWeight: FontWeight.w600),
        ),
      );
    }

    Future<void> submitDecision(String target, String decision) async {
      if (proposalId == null || !controlsEnabled) {
        return;
      }
      setState(() => _expandedChangeTargets.remove(target));
      await controller.submitAuthoringReviewDecision(
        proposalId: proposalId,
        target: target,
        decision: decision,
      );
    }

    void startDiscussion(String target) {
      if (proposalId == null || review == null || !controlsEnabled) {
        return;
      }
      controller.selectDiscussionTarget(
        proposalId: proposalId,
        reviewStateId: review.reviewStateId,
        target: target,
      );
    }

    Widget reviewActionButtons({
      required String target,
      required String decision,
      required bool locked,
    }) {
      final showControls = !locked || _expandedChangeTargets.contains(target);
      if (!controlsEnabled || !showControls) {
        return const SizedBox.shrink();
      }

      return Padding(
        padding: const EdgeInsetsDirectional.only(top: AppSpacing.xs),
        child: Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            TextButton(
              onPressed: reviewBusy
                  ? null
                  : () => submitDecision(target, 'ACCEPT_PROPOSAL'),
              child: Text(
                AiL10n.authoringReviewAcceptProposal.resolve(context),
              ),
            ),
            TextButton(
              onPressed: reviewBusy
                  ? null
                  : () => submitDecision(target, 'KEEP_CURRENT'),
              child: Text(AiL10n.authoringReviewKeepCurrent.resolve(context)),
            ),
            TextButton(
              onPressed: reviewBusy ? null : () => startDiscussion(target),
              child: Text(AiL10n.authoringReviewDiscuss.resolve(context)),
            ),
          ],
        ),
      );
    }

    Widget reviewTargetStatusRow({
      required String target,
      required String decision,
      required bool locked,
    }) {
      return Wrap(
        spacing: AppSpacing.xs,
        runSpacing: AppSpacing.xs,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          decisionBadge(decision),
          if (locked) ...[
            Icon(Icons.lock_outline, size: 14, color: palette.textSecondary),
            Text(
              AiL10n.authoringReviewLocked.resolve(context),
              style: AppTextStyles.label(context).copyWith(
                color: palette.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          if (locked && !_expandedChangeTargets.contains(target))
            TextButton(
              onPressed: controlsEnabled
                  ? () => setState(() => _expandedChangeTargets.add(target))
                  : null,
              child: Text(
                AiL10n.authoringReviewChangeDecision.resolve(context),
              ),
            ),
        ],
      );
    }

    Widget reviewSection({
      required String target,
      required String label,
      required Widget content,
      String? currentValue,
    }) {
      final decision = decisionForTarget(target);
      final locked = review?.lockedTargets.contains(target) ?? false;
      final isActive = chatState.activeDiscussionTarget == target;
      final comment = latestRevisionComment(target);
      final showReviewControls =
          isLatestProposal && !(review?.isApplied ?? false);

      return Padding(
        padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.md),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: isActive
                ? palette.heroMid.withValues(alpha: 0.06)
                : Colors.transparent,
            borderRadius: AppRadius.mdAll,
            border: isActive
                ? Border.all(color: palette.heroMid, width: 1.5)
                : null,
          ),
          child: Padding(
            padding: isActive
                ? const EdgeInsetsDirectional.all(AppSpacing.sm)
                : EdgeInsets.zero,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: sectionTitle(label)),
                    if (showReviewControls)
                      reviewTargetStatusRow(
                        target: target,
                        decision: decision,
                        locked: locked,
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                content,
                if (decision == 'KEEP_CURRENT' &&
                    (currentValue ?? '').isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    '${AiL10n.authoringReviewCurrentDraft.resolve(context)}: $currentValue',
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                    textDirection: resolveContentTextDirection(currentValue!),
                  ),
                ],
                if (isDiscussionDecision(decision) &&
                    (comment ?? '').isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    '${AiL10n.authoringReviewYourRequest.resolve(context)}: $comment',
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textPrimary, height: 1.4),
                    textDirection: resolveContentTextDirection(comment!),
                  ),
                ],
                if (showReviewControls) ...[
                  reviewActionButtons(
                    target: target,
                    decision: decision,
                    locked: locked,
                  ),
                  if (isDiscussionDecision(decision))
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: TextButton(
                        onPressed: reviewBusy
                            ? null
                            : () => startDiscussion(target),
                        child: Text(
                          AiL10n.authoringReviewContinueDiscussion.resolve(
                            context,
                          ),
                        ),
                      ),
                    ),
                ],
              ],
            ),
          ),
        ),
      );
    }

    final version = widget.block.authoringProposalVersion ?? 1;
    final draft = widget.draftSnapshot;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    project.title,
                    style: AppTextStyles.subtitle(
                      context,
                    ).copyWith(color: palette.textPrimary),
                    textDirection: resolveContentTextDirection(project.title),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                if (version > 1)
                  Container(
                    margin: const EdgeInsetsDirectional.only(
                      end: AppSpacing.xs,
                    ),
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: palette.borderSubtle,
                      borderRadius: AppRadius.smAll,
                    ),
                    child: Text(
                      '${AiL10n.authoringProposalVersion.resolve(context)} $version',
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                Container(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                  decoration: BoxDecoration(
                    color: palette.heroMid.withValues(alpha: 0.12),
                    borderRadius: AppRadius.smAll,
                  ),
                  child: Text(
                    review?.isApplied ?? false
                        ? AiL10n.authoringReviewApplied.resolve(context)
                        : AiL10n.authoringProposalPreviewBadge.resolve(context),
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.heroMid,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.md,
              runSpacing: AppSpacing.xs,
              children: [
                Text(
                  '${AiL10n.authoringProposalDifficulty.resolve(context)}: ${project.difficulty}',
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textSecondary),
                ),
                Text(
                  '${AiL10n.authoringProposalEstimatedDuration.resolve(context)}: ${formatDuration(project.estimatedMinutes)}',
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textSecondary),
                ),
                if ((widget.block.authoringProposalCategoryDisplayName ?? '')
                    .isNotEmpty)
                  Text(
                    widget.block.authoringProposalCategoryDisplayName!,
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textSecondary),
                    textDirection: resolveContentTextDirection(
                      widget.block.authoringProposalCategoryDisplayName!,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              AiL10n.authoringProposalPreviewNotice.resolve(context),
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.heroMid, height: 1.4),
              textDirection: resolveContentTextDirection(
                AiL10n.authoringProposalPreviewNotice.resolve(context),
              ),
            ),
            if (isStale) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                AiL10n.authoringProposalStaleNotice.resolve(context),
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: materialWarning),
                textDirection: resolveContentTextDirection(
                  AiL10n.authoringProposalStaleNotice.resolve(context),
                ),
              ),
            ],
            if (isLatestProposal && review != null) ...[
              const SizedBox(height: AppSpacing.md),
              Builder(
                builder: (context) {
                  final progress = controller.computeAuthoringReviewProgress(
                    review,
                  );
                  final statusLabel = AiL10n.authoringReviewStatusLabel(
                    progress.status,
                  ).resolve(context);
                  return DecoratedBox(
                    decoration: BoxDecoration(
                      color: palette.borderSubtle.withValues(alpha: 0.45),
                      borderRadius: AppRadius.mdAll,
                      border: Border.all(color: palette.borderSubtle),
                    ),
                    child: Padding(
                      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            AiL10n.authoringReviewProgressSummary(
                              progress.resolved,
                              progress.total,
                              progress.needsDiscussion,
                            ).resolve(context),
                            style: AppTextStyles.body(context).copyWith(
                              color: palette.textPrimary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            statusLabel,
                            style: AppTextStyles.label(context).copyWith(
                              color: palette.heroMid,
                              fontWeight: FontWeight.w700,
                            ),
                            textDirection: resolveContentTextDirection(
                              statusLabel,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ],
            if (isLatestProposal && !(review?.isApplied ?? false)) ...[
              const SizedBox(height: AppSpacing.md),
              reviewSection(
                label: 'Title',
                target: 'title',
                currentValue: draft?.title,
                content: Text(
                  project.title,
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textPrimary,
                    height: 1.45,
                    fontWeight: FontWeight.w600,
                  ),
                  textDirection: resolveContentTextDirection(project.title),
                ),
              ),
              reviewSection(
                label: AiL10n.authoringProposalShortDescription.resolve(
                  context,
                ),
                target: 'shortDescription',
                currentValue: draft?.shortDescription,
                content: Text(
                  project.shortDescription,
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textPrimary, height: 1.45),
                  textDirection: resolveContentTextDirection(
                    project.shortDescription,
                  ),
                ),
              ),
              reviewSection(
                label: AiL10n.authoringProposalDescription.resolve(context),
                target: 'description',
                currentValue: draft?.description,
                content: Text(
                  project.description,
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textPrimary, height: 1.45),
                  textDirection: resolveContentTextDirection(
                    project.description,
                  ),
                ),
              ),
              reviewSection(
                label: AiL10n.authoringProposalDifficulty.resolve(context),
                target: 'difficulty',
                currentValue: draft?.difficulty,
                content: Text(
                  project.difficulty,
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textPrimary, height: 1.45),
                ),
              ),
              reviewSection(
                label: AiL10n.authoringProposalEstimatedDuration.resolve(
                  context,
                ),
                target: 'estimatedMinutes',
                currentValue: formatDuration(draft?.estimatedMinutes),
                content: Text(
                  formatDuration(project.estimatedMinutes),
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textPrimary, height: 1.45),
                ),
              ),
            ] else ...[
              const SizedBox(height: AppSpacing.md),
              sectionTitle(
                AiL10n.authoringProposalShortDescription.resolve(context),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                project.shortDescription,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textPrimary, height: 1.45),
                textDirection: resolveContentTextDirection(
                  project.shortDescription,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              sectionTitle(
                AiL10n.authoringProposalDescription.resolve(context),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                project.description,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textPrimary, height: 1.45),
                textDirection: resolveContentTextDirection(project.description),
              ),
            ],
            if (widget.block.authoringProposalComponents.isNotEmpty) ...[
              if (isLatestProposal && !(review?.isApplied ?? false))
                reviewSection(
                  label: AiL10n.authoringProposalRequiredComponents.resolve(
                    context,
                  ),
                  target: 'components',
                  content: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final component
                          in widget.block.authoringProposalComponents)
                        Padding(
                          padding: const EdgeInsetsDirectional.only(
                            bottom: AppSpacing.sm,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                component.componentName,
                                style: AppTextStyles.body(context).copyWith(
                                  color: palette.textPrimary,
                                  fontWeight: FontWeight.w600,
                                ),
                                textDirection: resolveContentTextDirection(
                                  component.componentName,
                                ),
                              ),
                              Text(
                                '${component.quantity.toString().replaceAll(RegExp(r'\.0$'), '')} ${component.unit} · ${component.isRequired ? AiL10n.authoringProposalRequired.resolve(context) : AiL10n.authoringProposalOptional.resolve(context)}${component.canBeSubstituted ? ' · ${AiL10n.authoringProposalSubstitutable.resolve(context)}' : ''}',
                                style: AppTextStyles.label(
                                  context,
                                ).copyWith(color: palette.textSecondary),
                              ),
                              if ((component.notes ?? '').isNotEmpty)
                                Text(
                                  component.notes!,
                                  style: AppTextStyles.body(
                                    context,
                                  ).copyWith(color: palette.textPrimary),
                                  textDirection: resolveContentTextDirection(
                                    component.notes!,
                                  ),
                                ),
                            ],
                          ),
                        ),
                    ],
                  ),
                )
              else ...[
                const SizedBox(height: AppSpacing.md),
                sectionTitle(
                  AiL10n.authoringProposalRequiredComponents.resolve(context),
                ),
                const SizedBox(height: AppSpacing.xs),
                for (final component
                    in widget.block.authoringProposalComponents)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(
                      bottom: AppSpacing.sm,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          component.componentName,
                          style: AppTextStyles.body(context).copyWith(
                            color: palette.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                          textDirection: resolveContentTextDirection(
                            component.componentName,
                          ),
                        ),
                        Text(
                          '${component.quantity.toString().replaceAll(RegExp(r'\.0$'), '')} ${component.unit} · ${component.isRequired ? AiL10n.authoringProposalRequired.resolve(context) : AiL10n.authoringProposalOptional.resolve(context)}${component.canBeSubstituted ? ' · ${AiL10n.authoringProposalSubstitutable.resolve(context)}' : ''}',
                          style: AppTextStyles.label(
                            context,
                          ).copyWith(color: palette.textSecondary),
                        ),
                        if ((component.notes ?? '').isNotEmpty)
                          Text(
                            component.notes!,
                            style: AppTextStyles.body(
                              context,
                            ).copyWith(color: palette.textPrimary),
                            textDirection: resolveContentTextDirection(
                              component.notes!,
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ],
            if (widget.block.authoringProposalSteps.isNotEmpty) ...[
              if (isLatestProposal && !(review?.isApplied ?? false))
                reviewSection(
                  label: AiL10n.authoringProposalSteps.resolve(context),
                  target: 'steps',
                  content: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (
                        var index = 0;
                        index < widget.block.authoringProposalSteps.length;
                        index += 1
                      )
                        Padding(
                          padding: const EdgeInsetsDirectional.only(
                            bottom: AppSpacing.sm,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${index + 1}. ${widget.block.authoringProposalSteps[index].title}',
                                style: AppTextStyles.body(context).copyWith(
                                  color: palette.textPrimary,
                                  fontWeight: FontWeight.w600,
                                ),
                                textDirection: resolveContentTextDirection(
                                  widget
                                      .block
                                      .authoringProposalSteps[index]
                                      .title,
                                ),
                              ),
                              Text(
                                widget
                                    .block
                                    .authoringProposalSteps[index]
                                    .description,
                                style: AppTextStyles.body(context).copyWith(
                                  color: palette.textPrimary,
                                  height: 1.45,
                                ),
                                textDirection: resolveContentTextDirection(
                                  widget
                                      .block
                                      .authoringProposalSteps[index]
                                      .description,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                )
              else ...[
                const SizedBox(height: AppSpacing.md),
                sectionTitle(AiL10n.authoringProposalSteps.resolve(context)),
                const SizedBox(height: AppSpacing.xs),
                for (
                  var index = 0;
                  index < widget.block.authoringProposalSteps.length;
                  index += 1
                )
                  Padding(
                    padding: const EdgeInsetsDirectional.only(
                      bottom: AppSpacing.sm,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${index + 1}. ${widget.block.authoringProposalSteps[index].title}',
                          style: AppTextStyles.body(context).copyWith(
                            color: palette.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                          textDirection: resolveContentTextDirection(
                            widget.block.authoringProposalSteps[index].title,
                          ),
                        ),
                        Text(
                          widget
                              .block
                              .authoringProposalSteps[index]
                              .description,
                          style: AppTextStyles.body(
                            context,
                          ).copyWith(color: palette.textPrimary, height: 1.45),
                          textDirection: resolveContentTextDirection(
                            widget
                                .block
                                .authoringProposalSteps[index]
                                .description,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ],
            if (widget.block.authoringProposalAssumptions.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              sectionTitle(AiL10n.authoringAssumptions.resolve(context)),
              const SizedBox(height: AppSpacing.xs),
              for (final assumption
                  in widget.block.authoringProposalAssumptions)
                Padding(
                  padding: const EdgeInsetsDirectional.only(
                    bottom: AppSpacing.xs,
                  ),
                  child: Text(
                    assumption,
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textPrimary),
                    textDirection: resolveContentTextDirection(assumption),
                  ),
                ),
            ],
            if (widget.block.authoringProposalWarnings.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              sectionTitle(AiL10n.authoringWarnings.resolve(context)),
              const SizedBox(height: AppSpacing.xs),
              for (final warning in widget.block.authoringProposalWarnings)
                Padding(
                  padding: const EdgeInsetsDirectional.only(
                    bottom: AppSpacing.xs,
                  ),
                  child: Text(
                    warning,
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textPrimary),
                    textDirection: resolveContentTextDirection(warning),
                  ),
                ),
            ],
            if (widget
                .block
                .authoringProposalSafetyConsiderations
                .isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              sectionTitle(AiL10n.authoringProposalSafety.resolve(context)),
              const SizedBox(height: AppSpacing.xs),
              for (final note
                  in widget.block.authoringProposalSafetyConsiderations)
                Padding(
                  padding: const EdgeInsetsDirectional.only(
                    bottom: AppSpacing.xs,
                  ),
                  child: Text(
                    note,
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textPrimary),
                    textDirection: resolveContentTextDirection(note),
                  ),
                ),
            ],
            if (isLatestProposal &&
                (review?.hasOpenRevisionRequests ?? false) &&
                controlsEnabled &&
                proposalId != null) ...[
              const SizedBox(height: AppSpacing.md),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: reviewBusy
                      ? null
                      : () => controller.reviseAuthoringProposal(
                          proposalId: proposalId,
                          reviewStateId: review!.reviewStateId,
                        ),
                  child: Text(
                    chatState.isRevisingProposal
                        ? AiL10n.authoringGeneratingProposal.resolve(context)
                        : AiL10n.authoringReviewGenerateRevised.resolve(
                            context,
                          ),
                  ),
                ),
              ),
            ],
            if (isLatestProposal &&
                (review?.isReadyToApply ?? false) &&
                controlsEnabled &&
                review != null) ...[
              const SizedBox(height: AppSpacing.md),
              Builder(
                builder: (context) {
                  final progress = controller.computeAuthoringReviewProgress(
                    review,
                  );
                  return DecoratedBox(
                    decoration: BoxDecoration(
                      color: palette.mint.withValues(alpha: 0.08),
                      borderRadius: AppRadius.mdAll,
                      border: Border.all(
                        color: palette.mint.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            AiL10n.authoringReviewCompleteSummary(
                              progress.resolved,
                              progress.total,
                            ).resolve(context),
                            style: AppTextStyles.body(context).copyWith(
                              color: palette.textPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                            textDirection: resolveContentTextDirection(
                              AiL10n.authoringReviewCompleteSummary(
                                progress.resolved,
                                progress.total,
                              ).resolve(context),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          FilledButton(
                            onPressed: reviewBusy
                                ? null
                                : () => controller
                                      .prepareApplyReviewedAuthoringProposal(
                                        reviewStateId: review.reviewStateId,
                                      ),
                            child: Text(
                              chatState.isPreparingApply
                                  ? AiL10n.loading.resolve(context)
                                  : AiL10n.authoringReviewApplyReviewed.resolve(
                                      context,
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AiProjectAuthoringProposalDiffCard extends StatelessWidget {
  const _AiProjectAuthoringProposalDiffCard({required this.block});

  final AiContentBlock block;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final diff = block.authoringProposalDiff;
    if (diff == null) {
      return const SizedBox.shrink();
    }

    Widget bulletList(String title, List<String> items) {
      if (items.isEmpty) {
        return const SizedBox.shrink();
      }
      return Padding(
        padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: AppTextStyles.label(context).copyWith(
                color: palette.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
            for (final item in items)
              Text(
                '• $item',
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textPrimary),
                textDirection: resolveContentTextDirection(item),
              ),
          ],
        ),
      );
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              AiL10n.authoringProposalUpdated.resolve(context),
              style: AppTextStyles.subtitle(
                context,
              ).copyWith(color: palette.textPrimary),
            ),
            if (diff.changedTargets.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                '${AiL10n.authoringDiffChangedTargets.resolve(context)}: ${diff.changedTargets.join(', ')}',
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            bulletList(
              AiL10n.authoringDiffAdded.resolve(context),
              diff.componentAdded,
            ),
            bulletList(
              AiL10n.authoringDiffRemoved.resolve(context),
              diff.componentRemoved,
            ),
            bulletList(
              AiL10n.authoringDiffUpdated.resolve(context),
              diff.componentUpdated,
            ),
            bulletList(
              AiL10n.authoringDiffAdded.resolve(context),
              diff.stepAdded,
            ),
            bulletList(
              AiL10n.authoringDiffRemoved.resolve(context),
              diff.stepRemoved,
            ),
            bulletList(
              AiL10n.authoringDiffUpdated.resolve(context),
              diff.stepUpdated,
            ),
          ],
        ),
      ),
    );
  }
}

class _AiSequentialAuthoringStageCard extends ConsumerStatefulWidget {
  const _AiSequentialAuthoringStageCard({
    required this.block,
    this.draftSnapshot,
  });

  final AiContentBlock block;
  final AuthoringDraftSnapshot? draftSnapshot;

  @override
  ConsumerState<_AiSequentialAuthoringStageCard> createState() =>
      _AiSequentialAuthoringStageCardState();
}

class _AiSequentialAuthoringStageCardState
    extends ConsumerState<_AiSequentialAuthoringStageCard> {
  bool _manualEntryMode = false;
  final _manualController = TextEditingController();
  String? _manualDifficulty;

  @override
  void dispose() {
    _manualController.dispose();
    super.dispose();
  }

  bool _supportsManualEntry(String stage) {
    return stage == 'TITLE' ||
        stage == 'SHORT_DESCRIPTION' ||
        stage == 'FULL_DESCRIPTION' ||
        stage == 'DIFFICULTY' ||
        stage == 'ESTIMATED_DURATION';
  }

  int? _manualLinesForStage(String stage) {
    return switch (stage) {
      'SHORT_DESCRIPTION' => 3,
      'FULL_DESCRIPTION' => 6,
      _ => 1,
    };
  }

  Object? _manualValueForStage(String stage) {
    if (stage == 'DIFFICULTY') {
      return _manualDifficulty;
    }
    if (stage == 'ESTIMATED_DURATION') {
      return int.tryParse(_manualController.text.trim());
    }
    final value = _manualController.text.trim();
    return value.isEmpty ? null : value;
  }

  Object? _componentFromTurnProposal(Map<String, dynamic> proposal) {
    final componentJson = proposal['component'];
    if (componentJson is Map) {
      return AiAuthoringProposalComponent.fromJson(
        Map<String, dynamic>.from(componentJson),
      );
    }
    return null;
  }

  Object? _stepFromTurnProposal(Map<String, dynamic> proposal) {
    final title = proposal['title'] as String?;
    final description = proposal['description'] as String?;
    if (title == null || title.isEmpty) {
      return null;
    }
    return AiAuthoringProposalStep(
      title: title,
      description: description ?? '',
    );
  }

  Widget _legacyTransitionBanner({
    required BuildContext context,
    required AiAssistantController controller,
    required bool busy,
    required MaterialsUiPalette palette,
  }) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              AiL10n.authoringSequentialLegacyTransitionBanner.resolve(context),
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textPrimary, height: 1.45),
            ),
            const SizedBox(height: AppSpacing.md),
            FilledButton(
              onPressed: busy
                  ? null
                  : () => controller.runSequentialAuthoringAction(
                      action: 'CONTINUE_GUIDED',
                    ),
              child: Text(
                AiL10n.authoringSequentialContinueGuided.resolve(context),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sequentialItemControls({
    required BuildContext context,
    required AiAssistantController controller,
    required AiAuthoringTurn turn,
    required bool busy,
    required bool isStepReview,
    required bool canGoBack,
    required VoidCallback? onAccept,
    Object? addManualValue,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FilledButton(
          onPressed: busy ? null : onAccept,
          child: Text(
            (isStepReview
                    ? AiL10n.authoringSequentialAcceptStep
                    : AiL10n.authoringSequentialAcceptComponent)
                .resolve(context),
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        OutlinedButton(
          onPressed: busy
              ? null
              : () => controller.runSequentialAuthoringAction(
                  action: 'REMOVE_ITEM',
                  turnId: turn.turnId,
                ),
          child: Text(AiL10n.authoringSequentialRemoveItem.resolve(context)),
        ),
        const SizedBox(height: AppSpacing.xs),
        OutlinedButton(
          onPressed: busy || addManualValue == null
              ? null
              : () => controller.runSequentialAuthoringAction(
                  action: 'ADD_ITEM',
                  turnId: turn.turnId,
                  manualValue: addManualValue,
                ),
          child: Text(AiL10n.authoringSequentialAddItem.resolve(context)),
        ),
        const SizedBox(height: AppSpacing.xs),
        OutlinedButton(
          onPressed: !canGoBack || busy
              ? null
              : () => controller.runSequentialAuthoringAction(
                  action: 'BACK_ITEM',
                  turnId: turn.turnId,
                ),
          child: Text(AiL10n.authoringSequentialBackItem.resolve(context)),
        ),
        if (isStepReview) ...[
          const SizedBox(height: AppSpacing.xs),
          OutlinedButton(
            onPressed: busy
                ? null
                : () => controller.runSequentialAuthoringAction(
                    action: 'EXPLAIN_STEP',
                    turnId: turn.turnId,
                  ),
            child: Text(AiL10n.authoringSequentialExplainStep.resolve(context)),
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final controller = ref.read(aiAssistantControllerProvider.notifier);
    final chatState = ref.watch(aiAssistantControllerProvider);
    final busy = chatState.isSubmittingReview || chatState.isGeneratingProposal;

    if (controller.hasLegacyAuthoringWithoutSession) {
      return _legacyTransitionBanner(
        context: context,
        controller: controller,
        busy: busy,
        palette: palette,
      );
    }

    final session = controller.findLatestAuthoringSession();
    final turn =
        widget.block.authoringTurn ?? controller.findCurrentAuthoringTurn();
    if (session == null) {
      return const SizedBox.shrink();
    }

    final stage = turn?.stage ?? session.stage;

    Widget progressRow(String label, bool done, bool active) {
      return Padding(
        padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
        child: Row(
          children: [
            Icon(
              done ? Icons.check_circle : Icons.circle_outlined,
              size: 16,
              color: done
                  ? palette.mint
                  : active
                  ? palette.heroMid
                  : palette.textSecondary,
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                label,
                style: AppTextStyles.label(context).copyWith(
                  color: active ? palette.textPrimary : palette.textSecondary,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      );
    }

    final accepted = session.acceptedStages.toSet();
    String proposalPreview() {
      final proposal = turn?.proposal ?? const {};
      if (proposal.containsKey('value')) {
        return '${proposal['value']}';
      }
      if (proposal.containsKey('components')) {
        final items = (proposal['components'] as List?) ?? const [];
        return '${items.length} components';
      }
      if (proposal.containsKey('steps')) {
        final items = (proposal['steps'] as List?) ?? const [];
        return '${items.length} steps';
      }
      if (proposal.containsKey('title')) {
        return '${proposal['title']}';
      }
      return '';
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              AiL10n.authoringSequentialProgressTitle.resolve(context),
              style: AppTextStyles.subtitle(
                context,
              ).copyWith(color: palette.textPrimary),
            ),
            const SizedBox(height: AppSpacing.sm),
            progressRow('Title', accepted.contains('TITLE'), stage == 'TITLE'),
            progressRow(
              'Descriptions',
              accepted.contains('SHORT_DESCRIPTION') &&
                  accepted.contains('FULL_DESCRIPTION'),
              stage == 'SHORT_DESCRIPTION' || stage == 'FULL_DESCRIPTION',
            ),
            progressRow(
              'Difficulty & duration',
              accepted.contains('DIFFICULTY') &&
                  accepted.contains('ESTIMATED_DURATION'),
              stage == 'DIFFICULTY' || stage == 'ESTIMATED_DURATION',
            ),
            progressRow(
              'Components',
              accepted.contains('COMPONENTS'),
              stage == 'COMPONENTS',
            ),
            progressRow(
              'Steps',
              accepted.contains('STEPS_OVERVIEW') ||
                  accepted.contains('STEP_REVIEW'),
              stage == 'STEPS_OVERVIEW' || stage == 'STEP_REVIEW',
            ),
            if (session.isStale) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                AiL10n.authoringProposalStaleNotice.resolve(context),
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: materialWarning),
              ),
              const SizedBox(height: AppSpacing.xs),
              OutlinedButton(
                onPressed: busy
                    ? null
                    : () => controller.runSequentialAuthoringAction(
                        action: 'REGENERATE_STALE',
                      ),
                child: Text(
                  AiL10n.authoringSequentialRegenerateStale.resolve(context),
                ),
              ),
            ],
            if (session.stage == 'OVERVIEW') ...[
              const SizedBox(height: AppSpacing.md),
              FilledButton(
                onPressed: busy
                    ? null
                    : () => controller.runSequentialAuthoringAction(
                        action: 'START',
                      ),
                child: busy
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Theme.of(context).colorScheme.onPrimary,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Text(
                            AiL10n.authoringSequentialStart.resolve(context),
                          ),
                        ],
                      )
                    : Text(AiL10n.authoringSequentialStart.resolve(context)),
              ),
            ] else if (turn != null && turn.isProposed) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                AiL10n.authoringSequentialStageLabel(stage).resolve(context),
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.heroMid, fontWeight: FontWeight.w700),
              ),
              if (session.isComponentOneByOne &&
                  stage == 'COMPONENTS' &&
                  !session.awaitingComponentsFinalSave &&
                  session.componentProgressTotal > 0) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  AiL10n.authoringSequentialComponentProgress(
                    session.componentProgressIndex,
                    session.componentProgressTotal,
                  ).resolve(context),
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              if ((session.isStepByStep || stage == 'STEP_REVIEW') &&
                  stage == 'STEP_REVIEW' &&
                  !session.awaitingStepsFinalSave &&
                  session.workingStepCount > 0) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  AiL10n.authoringSequentialStepProgress(
                    session.stepProgressIndex,
                    session.workingStepCount,
                  ).resolve(context),
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.xs),
              Text(
                proposalPreview(),
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
                textDirection: resolveContentTextDirection(proposalPreview()),
              ),
              if ((turn.explanation).isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  turn.explanation,
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textSecondary, height: 1.45),
                  textDirection: resolveContentTextDirection(turn.explanation),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              if (session.awaitingComponentsFinalSave &&
                  stage == 'COMPONENTS') ...[
                FilledButton(
                  onPressed: busy
                      ? null
                      : () => controller.runSequentialAuthoringAction(
                          action: 'FINALIZE_SECTION',
                          turnId: turn.turnId,
                        ),
                  child: Text(
                    AiL10n.authoringSequentialAcceptListAndSave.resolve(
                      context,
                    ),
                  ),
                ),
              ] else if (session.awaitingStepsFinalSave &&
                  stage == 'STEPS_OVERVIEW') ...[
                FilledButton(
                  onPressed: busy
                      ? null
                      : () => controller.runSequentialAuthoringAction(
                          action: 'FINALIZE_SECTION',
                          turnId: turn.turnId,
                        ),
                  child: Text(
                    AiL10n.authoringSequentialAcceptPlanAndSave.resolve(
                      context,
                    ),
                  ),
                ),
              ] else if (session.isComponentOneByOne &&
                  stage == 'COMPONENTS' &&
                  !session.awaitingComponentsFinalSave) ...[
                _sequentialItemControls(
                  context: context,
                  controller: controller,
                  turn: turn,
                  busy: busy,
                  isStepReview: false,
                  canGoBack: (session.currentComponentIndex ?? 0) > 0,
                  addManualValue: _componentFromTurnProposal(turn.proposal),
                  onAccept: () => controller.runSequentialAuthoringAction(
                    action: 'ACCEPT_TURN',
                    turnId: turn.turnId,
                  ),
                ),
              ] else if (stage == 'STEP_REVIEW' &&
                  session.isStepByStep &&
                  !session.awaitingStepsFinalSave) ...[
                _sequentialItemControls(
                  context: context,
                  controller: controller,
                  turn: turn,
                  busy: busy,
                  isStepReview: true,
                  canGoBack: (session.currentStepIndex ?? 0) > 0,
                  addManualValue: _stepFromTurnProposal(turn.proposal),
                  onAccept: () => controller.runSequentialAuthoringAction(
                    action: 'ACCEPT_TURN',
                    turnId: turn.turnId,
                  ),
                ),
              ] else ...[
                FilledButton(
                  onPressed: busy
                      ? null
                      : () => controller.runSequentialAuthoringAction(
                          action: 'ACCEPT_TURN',
                          turnId: turn.turnId,
                        ),
                  child: Text(
                    AiL10n.authoringSequentialAcceptAndSave.resolve(context),
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                OutlinedButton(
                  onPressed: busy
                      ? null
                      : () => controller.runSequentialAuthoringAction(
                          action: 'SUGGEST_ANOTHER',
                          turnId: turn.turnId,
                        ),
                  child: Text(
                    AiL10n.authoringSequentialSuggestAnother.resolve(context),
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                OutlinedButton(
                  onPressed: busy
                      ? null
                      : controller.selectSequentialDiscussionTarget,
                  child: Text(AiL10n.authoringReviewDiscuss.resolve(context)),
                ),
              ],
              if (_supportsManualEntry(stage)) ...[
                const SizedBox(height: AppSpacing.xs),
                if (!_manualEntryMode)
                  OutlinedButton(
                    onPressed: busy
                        ? null
                        : () => setState(() => _manualEntryMode = true),
                    child: Text(
                      AiL10n.authoringSequentialEnterOwnValue.resolve(context),
                    ),
                  )
                else ...[
                  if (stage == 'DIFFICULTY') ...[
                    DropdownButtonFormField<String>(
                      initialValue: _manualDifficulty,
                      decoration: InputDecoration(
                        labelText: AiL10n.authoringSequentialManualHint(
                          stage,
                        ).resolve(context),
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'BEGINNER',
                          child: Text('Beginner'),
                        ),
                        DropdownMenuItem(
                          value: 'INTERMEDIATE',
                          child: Text('Intermediate'),
                        ),
                        DropdownMenuItem(
                          value: 'ADVANCED',
                          child: Text('Advanced'),
                        ),
                      ],
                      onChanged: busy
                          ? null
                          : (value) =>
                                setState(() => _manualDifficulty = value),
                    ),
                  ] else
                    TextField(
                      controller: _manualController,
                      enabled: !busy,
                      maxLines: _manualLinesForStage(stage),
                      decoration: InputDecoration(
                        labelText: AiL10n.authoringSequentialManualHint(
                          stage,
                        ).resolve(context),
                      ),
                      textDirection: resolveContentTextDirection(
                        _manualController.text,
                      ),
                    ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    AiL10n.authoringSequentialManualPreview.resolve(context),
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    stage == 'DIFFICULTY'
                        ? (_manualDifficulty ?? '—')
                        : _manualController.text.trim().isEmpty
                        ? '—'
                        : _manualController.text.trim(),
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textPrimary),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  FilledButton(
                    onPressed: busy || _manualValueForStage(stage) == null
                        ? null
                        : () => controller.runSequentialAuthoringAction(
                            action: 'SAVE_MANUAL',
                            manualValue: _manualValueForStage(stage),
                          ),
                    child: Text(
                      AiL10n.authoringSequentialSaveManualValue.resolve(
                        context,
                      ),
                    ),
                  ),
                ],
              ],
              if (stage == 'COMPONENTS' &&
                  !session.isComponentOneByOne &&
                  !session.awaitingComponentsFinalSave) ...[
                const SizedBox(height: AppSpacing.xs),
                OutlinedButton(
                  onPressed: busy
                      ? null
                      : () => controller.runSequentialAuthoringAction(
                          action: 'CHOOSE_MODE',
                          mode: 'COMPONENTS_FULL_LIST',
                        ),
                  child: Text(
                    AiL10n.authoringSequentialReviewFullList.resolve(context),
                  ),
                ),
                OutlinedButton(
                  onPressed: busy
                      ? null
                      : () => controller.runSequentialAuthoringAction(
                          action: 'CHOOSE_MODE',
                          mode: 'COMPONENTS_ONE_BY_ONE',
                        ),
                  child: Text(
                    AiL10n.authoringSequentialReviewOneByOne.resolve(context),
                  ),
                ),
              ],
              if (stage == 'STEPS_OVERVIEW' &&
                  !session.awaitingStepsFinalSave) ...[
                const SizedBox(height: AppSpacing.xs),
                OutlinedButton(
                  onPressed: busy
                      ? null
                      : () => controller.runSequentialAuthoringAction(
                          action: 'CHOOSE_MODE',
                          mode: 'STEPS_FULL_PLAN',
                        ),
                  child: Text(
                    AiL10n.authoringSequentialReviewCompletePlan.resolve(
                      context,
                    ),
                  ),
                ),
                OutlinedButton(
                  onPressed: busy
                      ? null
                      : () => controller.runSequentialAuthoringAction(
                          action: 'CHOOSE_MODE',
                          mode: 'STEP_BY_STEP',
                        ),
                  child: Text(
                    AiL10n.authoringSequentialReviewStepByStep.resolve(context),
                  ),
                ),
              ],
            ] else if (session.stage == 'FINAL_REVIEW') ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                AiL10n.authoringSequentialFinalReview.resolve(context),
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              FilledButton(
                onPressed: busy
                    ? null
                    : () => controller.runSequentialAuthoringAction(
                        action: 'FINISH',
                      ),
                child: Text(AiL10n.authoringSequentialFinish.resolve(context)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

void _openRecommendation(BuildContext context, AiRecommendationItem item) {
  switch (item.itemType) {
    case 'MATERIAL':
      context.push('/materials/${item.itemId}');
    case 'PROJECT':
      context.push('/learning/${item.itemId}');
    case 'ACTION':
      break;
  }
}

Future<void> _launchExternalUrl(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https')) {
    return;
  }

  if (await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}
