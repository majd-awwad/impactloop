import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/app_material_card.dart';
import '../../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/ai_chat_controller.dart';
import '../../domain/ai_helpers.dart';
import '../../domain/ai_models.dart';
import '../l10n/ai_l10n.dart';

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
  });

  final AiContentBlock block;
  final List<AiContentBlock> messageBlocks;
  final int blockIndex;
  final String locale;
  final VoidCallback? onConfirmAction;
  final VoidCallback? onCancelAction;
  final String? pendingActionBusyId;
  final String? actionErrorMessage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(aiAssistantControllerProvider.notifier);
    final onQuickReply = block.type == 'text' && block.purpose == 'clarification'
        ? (String reply) => controller.sendMessage(text: reply, locale: locale)
        : null;

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: switch (block.type) {
        'text' => _AiTextBlock(
            block: block,
            onQuickReply: onQuickReply,
          ),
        'error' => _AiErrorBlock(block: block),
        'material_results' => _AiMaterialResultsBlock(items: block.materialItems),
        'material_details' => block.materialItem == null
            ? const SizedBox.shrink()
            : _AiMaterialDetailsBlock(item: block.materialItem!),
        'project_results' => _AiProjectResultsBlock(items: block.projectItems),
        'project_details' => block.projectItem == null
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
        'component_matches' => _AiComponentMatchesBlock(
            buildId: block.buildId,
            groups: block.matchGroups,
          ),
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
        'external_sources' => _AiExternalSourcesBlock(items: block.externalSources),
        _ => const SizedBox.shrink(),
      },
    );
  }
}

class _AiTextBlock extends StatelessWidget {
  const _AiTextBlock({
    required this.block,
    this.onQuickReply,
  });

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
              style: AppTextStyles.label(context).copyWith(
                color: palette.mint,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        Text(
          text,
          style: AppTextStyles.body(context).copyWith(
            color: palette.textPrimary,
            height: 1.45,
          ),
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
      widget.prompt.contains('كمية') || widget.prompt.toLowerCase().contains('quantity');

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
      initialTime: (isStart ? _startTime : _endTime) ?? const TimeOfDay(hour: 16, minute: 0),
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
              onPressed: _quantity > 1 ? () => setState(() => _quantity -= 1) : null,
              icon: const Icon(Icons.remove_circle_outline),
            ),
            Text('$_quantity', style: AppTextStyles.label(context)),
            IconButton(
              onPressed: _quantity < 10 ? () => setState(() => _quantity += 1) : null,
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
            LocalizedText(en: 'Choose pickup date', ar: 'اختيار تاريخ الاستلام')
                .resolve(context),
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
                LocalizedText(en: 'Start time', ar: 'وقت البداية').resolve(context),
              ),
            ),
            OutlinedButton(
              onPressed: () => _pickTime(isStart: false),
              child: Text(
                LocalizedText(en: 'End time', ar: 'وقت النهاية').resolve(context),
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
    return Text(
      block.message ?? AiL10n.genericFailure.resolve(context),
      style: AppTextStyles.body(context).copyWith(
        color: materialWarning,
        height: 1.45,
      ),
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

    return ImpactMaterialCompactCard(
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
      gradientColors: [
        palette.fallbackStart,
        palette.fallbackEnd,
      ],
      imageUrl: item.thumbnailUrl,
      onTap: item.materialId.isEmpty
          ? null
          : () => context.push('/materials/${item.materialId}'),
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
  const _AiProjectCompactCard({
    required this.item,
    this.showSummary = false,
  });

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
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textPrimary,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (showSummary && (item.summary?.isNotEmpty ?? false)) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        item.summary!,
                        style: AppTextStyles.body(context).copyWith(
                          color: palette.textSecondary,
                          height: 1.4,
                        ),
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
  const _AiComponentListBlock({
    required this.projectId,
    required this.items,
  });

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
        ? AiL10n.checklistProgress(
            context,
            readyCount!,
            totalRequired!,
          )
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
                          style: AppTextStyles.body(context).copyWith(
                            color: palette.textMuted,
                            fontSize: 12,
                          ),
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
                onPressed: () =>
                    context.push('/learning/$projectId/build'),
                child: Text(AiL10n.viewBuild.resolve(context)),
              ),
            ),
        ],
      ),
    );
  }
}

class _AiComponentMatchesBlock extends StatelessWidget {
  const _AiComponentMatchesBlock({
    required this.buildId,
    required this.groups,
  });

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
  const _AiComparisonBlock({
    required this.subject,
    required this.items,
  });

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
                    style: AppTextStyles.body(context).copyWith(
                      color: palette.textSecondary,
                    ),
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
      title: block.actionTitle ?? AiL10n.actionConfirmationSection.resolve(context),
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
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textPrimary,
                  height: 1.4,
                ),
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
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textMuted,
                ),
                textAlign: TextAlign.start,
              ),
            ],
            if (uiState.errorMessage != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                uiState.errorMessage!,
                style: AppTextStyles.body(context).copyWith(
                  color: materialWarning,
                  height: 1.35,
                ),
                textAlign: TextAlign.start,
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: isDisabled ? null : onCancel,
                    child: Text(
                      block.cancelLabel ??
                          AiL10n.cancelAction.resolve(context),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: FilledButton(
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
                          ),
                  ),
                ),
              ],
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
                    style: AppTextStyles.body(context).copyWith(
                      color: palette.textPrimary,
                      height: 1.4,
                    ),
                  ),
                if (block.actionTarget != null)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(
                      top: AppSpacing.xs,
                    ),
                    child: Text(
                      block.actionTarget!.title,
                      style: AppTextStyles.body(context).copyWith(
                        color: palette.textMuted,
                        fontSize: 12,
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
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++)
            Padding(
              padding: EdgeInsetsDirectional.only(
                bottom: i == items.length - 1 ? 0 : AppSpacing.sm,
              ),
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
                        style: AppTextStyles.link(context).copyWith(
                          fontSize: 13,
                        ),
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
          style: AppTextStyles.label(context).copyWith(
            color: palette.textPrimary,
            fontSize: 13,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            subtitle!,
            style: AppTextStyles.body(context).copyWith(
              color: palette.textMuted,
              fontSize: 12,
            ),
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
    if (item.difficulty?.isNotEmpty ?? false) item.difficulty!,
    if (item.estimatedTimeLabel?.isNotEmpty ?? false) item.estimatedTimeLabel!,
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
  if (uri == null) {
    return;
  }

  if (await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}
