import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../core/format/localized_formatters.dart';
import '../../../../../l10n/l10n.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/app_section_card.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../application/learning_hub_providers.dart';
import '../../../application/project_build_refresh.dart';
import '../../../application/smart_build_plan_material_requests.dart';
import '../../../domain/models/smart_build_plan.dart';
import '../../l10n/smart_build_plan_l10n.dart';
import '../../theme/learning_ui_palette.dart';
import 'smart_build_plan_colored_icon.dart';
import 'smart_build_plan_item_groups.dart';
import 'smart_build_plan_recommended_card.dart';

class SmartBuildPlanRecommendedSection extends StatelessWidget {
  const SmartBuildPlanRecommendedSection({
    super.key,
    required this.projectId,
    required this.items,
  });

  final String projectId;
  final List<SmartBuildPlanItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const SizedBox.shrink();
    }

    final palette = LearningUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          SmartBuildPlanL10n.recommendedMaterials(items.length).resolve(context),
          style: AppTextStyles.title(context).copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          SmartBuildPlanL10n.reserveSectionHelper.resolve(context),
          style: AppTextStyles.label(context).copyWith(
            color: palette.textSecondary,
            height: 1.35,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        for (final item in items) ...[
          SmartBuildPlanRecommendedCard(
            projectId: projectId,
            item: item,
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

class SmartBuildPlanSidebarSections extends StatelessWidget {
  const SmartBuildPlanSidebarSections({
    super.key,
    required this.projectId,
    required this.buildId,
    required this.groups,
    required this.onRefresh,
    this.compact = false,
  });

  final String projectId;
  final String buildId;
  final SmartBuildPlanItemGroups groups;
  final Future<void> Function() onRefresh;
  final bool compact;

  Future<void> _openBuildPage(BuildContext context) async {
    await context.push('/learning/$projectId/build');
    if (context.mounted) {
      await onRefresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (groups.inProgress.isNotEmpty) ...[
          SmartBuildPlanAccordionSection(
            title: SmartBuildPlanL10n.inProgressSection(groups.inProgress.length)
                .resolve(context),
            icon: Icons.schedule_rounded,
            iconColors: SmartBuildPlanIconColors.blue,
            initiallyExpanded: !compact,
            child: _SidebarItemList(
              items: groups.inProgress,
              compact: compact,
              subtitleBuilder: (_) =>
                  SmartBuildPlanL10n.inProgressCompact.resolve(context),
              actionLabel: SmartBuildPlanL10n.viewBuildItem.resolve(context),
              onAction: () => _openBuildPage(context),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
        ],
        if (groups.alreadySatisfied.isNotEmpty) ...[
          SmartBuildPlanAlreadyCoveredSection(
            items: groups.alreadySatisfied,
            compact: compact,
          ),
          const SizedBox(height: AppSpacing.xs),
        ],
        if (groups.attention.isNotEmpty) ...[
          SmartBuildPlanAccordionSection(
            title: SmartBuildPlanL10n.needsAttentionSection(groups.attention.length)
                .resolve(context),
            icon: Icons.warning_amber_rounded,
            iconColors: SmartBuildPlanIconColors.orange,
            tone: AppStatusTone.warning,
            initiallyExpanded: true,
            child: _SidebarItemList(
              items: groups.attention,
              compact: compact,
              subtitleBuilder: (_) =>
                  SmartBuildPlanL10n.attentionBody.resolve(context),
              actionLabel: SmartBuildPlanL10n.viewBuildItem.resolve(context),
              onAction: () => _openBuildPage(context),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
        ],
        if (groups.uncovered.isNotEmpty)
          SmartBuildPlanMissingSection(
            projectId: projectId,
            buildId: buildId,
            items: groups.uncovered,
            compact: compact,
            onRequestCreated: onRefresh,
          ),
      ],
    );
  }
}

class SmartBuildPlanAccordionSection extends StatefulWidget {
  const SmartBuildPlanAccordionSection({
    super.key,
    required this.title,
    required this.child,
    this.icon,
    this.iconColors,
    this.initiallyExpanded = false,
    this.tone,
  });

  final String title;
  final Widget child;
  final IconData? icon;
  final SmartBuildPlanIconColors? iconColors;
  final bool initiallyExpanded;
  final AppStatusTone? tone;

  @override
  State<SmartBuildPlanAccordionSection> createState() =>
      _SmartBuildPlanAccordionSectionState();
}

class _SmartBuildPlanAccordionSectionState
    extends State<SmartBuildPlanAccordionSection> {
  late bool _expanded;

  @override
  void initState() {
    super.initState();
    _expanded = widget.initiallyExpanded;
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final toneStyle = widget.tone == null
        ? null
        : AppStatusStyle.of(context, widget.tone!);
    final isWarning = widget.tone == AppStatusTone.warning;

    return Container(
      decoration: BoxDecoration(
        color: isWarning
            ? toneStyle!.background.withValues(alpha: 0.22)
            : palette.cardSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(
          color: isWarning ? toneStyle!.border.withValues(alpha: 0.45) : palette.borderSubtle,
        ),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: AppRadius.mdAll,
            child: Padding(
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.sm,
                vertical: AppSpacing.sm,
              ),
              child: Row(
                children: [
                  if (widget.icon != null) ...[
                    SmartBuildPlanColoredIcon(
                      icon: widget.icon!,
                      colors: widget.iconColors ?? SmartBuildPlanIconColors.blue,
                      size: 18,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                  ],
                  Expanded(
                    child: Text(
                      widget.title,
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Icon(
                    _expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    size: 18,
                    color: palette.textSecondary,
                  ),
                ],
              ),
            ),
          ),
          if (_expanded) ...[
            Divider(height: 1, color: palette.borderSubtle),
            Padding(
              padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
              child: widget.child,
            ),
          ],
        ],
      ),
    );
  }
}

class _SidebarItemList extends StatelessWidget {
  const _SidebarItemList({
    required this.items,
    required this.subtitleBuilder,
    required this.compact,
    this.actionLabel,
    this.onAction,
  });

  final List<SmartBuildPlanItem> items;
  final String Function(SmartBuildPlanItem item) subtitleBuilder;
  final bool compact;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final formatters = LocalizedFormatters(context.l10n);

    return Column(
      children: [
        for (var index = 0; index < items.length; index++) ...[
          if (index > 0) const SizedBox(height: AppSpacing.xs),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      items[index].componentName,
                      maxLines: compact ? 2 : 3,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    if (!compact) ...[
                      const SizedBox(height: 2),
                      Text(
                        formatters.quantity(
                          items[index].requiredQuantity,
                          items[index].requiredUnit,
                        ),
                        style: AppTextStyles.label(context).copyWith(
                          color: palette.textSecondary,
                          fontSize: 11,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitleBuilder(items[index]),
                        style: AppTextStyles.label(context).copyWith(
                          color: palette.textSecondary,
                          height: 1.3,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (compact)
                Text(
                  formatters.quantity(
                    items[index].requiredQuantity,
                    items[index].requiredUnit,
                  ),
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                    fontSize: 11,
                  ),
                ),
              if (actionLabel != null && onAction != null && !compact)
                TextButton(
                  onPressed: onAction,
                  style: TextButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                  ),
                  child: Text(actionLabel!),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class SmartBuildPlanAlreadyCoveredSection extends StatefulWidget {
  const SmartBuildPlanAlreadyCoveredSection({
    super.key,
    required this.items,
    this.compact = false,
  });

  final List<SmartBuildPlanItem> items;
  final bool compact;

  @override
  State<SmartBuildPlanAlreadyCoveredSection> createState() =>
      _SmartBuildPlanAlreadyCoveredSectionState();
}

class _SmartBuildPlanAlreadyCoveredSectionState
    extends State<SmartBuildPlanAlreadyCoveredSection> {
  static const _visibleLimit = 3;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final visibleItems = _expanded
        ? widget.items
        : widget.items.take(_visibleLimit).toList(growable: false);
    final hiddenCount = widget.items.length - visibleItems.length;

    return SmartBuildPlanAccordionSection(
      title: SmartBuildPlanL10n.alreadyCoveredSection(widget.items.length)
          .resolve(context),
      icon: Icons.check_circle_outline_rounded,
      iconColors: SmartBuildPlanIconColors.green,
      initiallyExpanded: widget.items.isNotEmpty && widget.items.length <= 2,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SidebarItemList(
            items: visibleItems,
            compact: widget.compact,
            subtitleBuilder: (item) => _satisfiedSubtitle(item).resolve(context),
          ),
          if (hiddenCount > 0 || _expanded)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton(
                onPressed: () => setState(() => _expanded = !_expanded),
                style: TextButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                ),
                child: Text(
                  _expanded
                      ? SmartBuildPlanL10n.showLessMissing.resolve(context)
                      : SmartBuildPlanL10n.showAllCovered(widget.items.length)
                          .resolve(context),
                ),
              ),
            ),
        ],
      ),
    );
  }

  LocalizedText _satisfiedSubtitle(SmartBuildPlanItem item) {
    final state = item.acquisitionState?.toLowerCase();
    if (state == 'acquired' || state == 'purchased') {
      return SmartBuildPlanL10n.alreadyAcquired;
    }
    return SmartBuildPlanL10n.alreadyOwned;
  }
}

class SmartBuildPlanMissingSection extends ConsumerStatefulWidget {
  const SmartBuildPlanMissingSection({
    super.key,
    required this.projectId,
    required this.buildId,
    required this.items,
    this.initiallyCollapsed = false,
    this.showHeader = true,
    this.compact = false,
    this.onRequestCreated,
  });

  final String projectId;
  final String buildId;
  final List<SmartBuildPlanItem> items;
  final bool initiallyCollapsed;
  final bool showHeader;
  final bool compact;
  final Future<void> Function()? onRequestCreated;

  @override
  ConsumerState<SmartBuildPlanMissingSection> createState() =>
      _SmartBuildPlanMissingSectionState();
}

class _SmartBuildPlanMissingSectionState
    extends ConsumerState<SmartBuildPlanMissingSection> {
  static const _visibleLimit = 5;
  bool _expanded = false;
  late bool _collapsed;

  @override
  void initState() {
    super.initState();
    _collapsed = widget.initiallyCollapsed;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) {
      return const SizedBox.shrink();
    }

    final palette = LearningUiPalette.of(context);
    final formatters = LocalizedFormatters(context.l10n);
    final openRequests = ref
        .watch(openMaterialRequestsByBuildItemProvider(widget.buildId))
        .maybeWhen(data: (value) => value, orElse: () => const <String, String>{});

    if (_collapsed) {
      return Align(
        alignment: AlignmentDirectional.centerStart,
        child: TextButton(
          onPressed: () => setState(() => _collapsed = false),
          child: Text(
            SmartBuildPlanL10n.viewMissingComponents(widget.items.length)
                .resolve(context),
          ),
        ),
      );
    }

    final visibleItems = _expanded
        ? widget.items
        : widget.items.take(_visibleLimit).toList(growable: false);
    final hiddenCount = widget.items.length - visibleItems.length;

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.showHeader)
          Text(
            SmartBuildPlanL10n.stillMissingSubtext.resolve(context),
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
              height: 1.35,
              fontSize: 11,
            ),
          ),
        if (widget.showHeader) const SizedBox(height: AppSpacing.xs),
        for (var index = 0; index < visibleItems.length; index++) ...[
          if (index > 0) const SizedBox(height: AppSpacing.xs),
          _UncoveredItemRow(
            item: visibleItems[index],
            formatters: formatters,
            compact: widget.compact,
            openRequestId: openRequests[visibleItems[index].buildItemId],
            onRequestMaterial: () => _requestMaterial(visibleItems[index]),
            onViewRequest: (requestId) =>
                context.push('/learner/material-requests/$requestId'),
          ),
        ],
        if (hiddenCount > 0 || _expanded) ...[
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton(
              key: const ValueKey('smart-build-plan-show-all-missing'),
              onPressed: () => setState(() => _expanded = !_expanded),
              style: TextButton.styleFrom(
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
              ),
              child: Text(
                _expanded
                    ? SmartBuildPlanL10n.showLessMissing.resolve(context)
                    : SmartBuildPlanL10n.showAllMissing(widget.items.length)
                        .resolve(context),
              ),
            ),
          ),
        ],
      ],
    );

    if (!widget.showHeader) {
      return content;
    }

    return SmartBuildPlanAccordionSection(
      title: SmartBuildPlanL10n.stillMissingSection(widget.items.length)
          .resolve(context),
      icon: Icons.search_off_outlined,
      iconColors: SmartBuildPlanIconColors.orange,
      tone: AppStatusTone.warning,
      initiallyExpanded: true,
      child: content,
    );
  }

  Future<void> _requestMaterial(SmartBuildPlanItem item) async {
    final build = await ref.read(projectBuildProvider(widget.projectId).future);
    if (!mounted) {
      return;
    }

    final buildItem = build?.items
        .where((candidate) => candidate.id == item.buildItemId)
        .firstOrNull;
    final categoryId = buildItem?.component.categoryId?.trim();

    final params = <String, String>{
      'q': item.componentName,
      'projectId': widget.projectId,
      'buildId': widget.buildId,
      'buildItemId': item.buildItemId,
      if (categoryId != null && categoryId.isNotEmpty) 'categoryId': categoryId,
    };

    await context.push(
      Uri(
        path: '/learner/material-requests/new',
        queryParameters: params,
      ).toString(),
    );

    if (!mounted) {
      return;
    }

    ref.invalidate(openMaterialRequestsByBuildItemProvider(widget.buildId));
    ref.refreshSmartBuildPlan(widget.projectId);
    await widget.onRequestCreated?.call();
  }
}

class _UncoveredItemRow extends StatelessWidget {
  const _UncoveredItemRow({
    required this.item,
    required this.formatters,
    required this.compact,
    required this.openRequestId,
    required this.onRequestMaterial,
    required this.onViewRequest,
  });

  final SmartBuildPlanItem item;
  final LocalizedFormatters formatters;
  final bool compact;
  final String? openRequestId;
  final VoidCallback onRequestMaterial;
  final ValueChanged<String> onViewRequest;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final quantityLabel =
        '${SmartBuildPlanL10n.requiredQuantity.resolve(context)}: ${formatters.quantity(item.requiredQuantity, item.requiredUnit)}';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                item.componentName,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textPrimary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            if (compact)
              Text(
                formatters.quantity(item.requiredQuantity, item.requiredUnit),
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                  fontSize: 11,
                ),
              ),
          ],
        ),
        if (!compact) ...[
          const SizedBox(height: 2),
          Text(
            quantityLabel,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
              fontSize: 11,
            ),
          ),
        ],
        const SizedBox(height: 2),
        Text(
          SmartBuildPlanL10n.notCurrentlyAvailableOnPlatform.resolve(context),
          style: AppTextStyles.label(context).copyWith(
            color: palette.textSecondary,
            height: 1.3,
            fontSize: 11,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        if (openRequestId != null) ...[
          Text(
            SmartBuildPlanL10n.requestActive.resolve(context),
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton(
              onPressed: () => onViewRequest(openRequestId!),
              style: TextButton.styleFrom(
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
              ),
              child: Text(SmartBuildPlanL10n.viewRequest.resolve(context)),
            ),
          ),
        ] else
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: OutlinedButton(
              onPressed: onRequestMaterial,
              style: OutlinedButton.styleFrom(
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
              ),
              child: Text(SmartBuildPlanL10n.requestThisMaterial.resolve(context)),
            ),
          ),
      ],
    );
  }
}

class SmartBuildPlanNoRecommendationsState extends StatelessWidget {
  const SmartBuildPlanNoRecommendationsState({
    super.key,
    required this.missingCount,
    required this.projectId,
    required this.buildId,
    required this.onRefresh,
    required this.onBack,
    required this.missingItems,
  });

  final int missingCount;
  final String projectId;
  final String buildId;
  final Future<void> Function() onRefresh;
  final VoidCallback onBack;
  final List<SmartBuildPlanItem> missingItems;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return AppSectionCard(
      tone: AppStatusTone.warning,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            SmartBuildPlanL10n.noMaterialsAvailableTitle.resolve(context),
            style: AppTextStyles.title(context).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            SmartBuildPlanL10n.noMaterialsAvailableBody(missingCount).resolve(context),
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
              height: 1.45,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              FilledButton(
                onPressed: () => onRefresh(),
                child: Text(SmartBuildPlanL10n.refreshPlan.resolve(context)),
              ),
              OutlinedButton(
                onPressed: onBack,
                child: Text(SmartBuildPlanL10n.backToBuild.resolve(context)),
              ),
            ],
          ),
          if (missingItems.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            SmartBuildPlanMissingSection(
              projectId: projectId,
              buildId: buildId,
              items: missingItems,
              showHeader: false,
              initiallyCollapsed: true,
              onRequestCreated: onRefresh,
            ),
          ],
        ],
      ),
    );
  }
}
