import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../domain/models/learning_project.dart';
import '../theme/learning_ui_palette.dart';

class ProjectBuildActionsPanel extends StatefulWidget {
  const ProjectBuildActionsPanel({super.key, required this.project});

  final LearningProject project;

  @override
  State<ProjectBuildActionsPanel> createState() =>
      _ProjectBuildActionsPanelState();
}

class _ProjectBuildActionsPanelState extends State<ProjectBuildActionsPanel> {
  bool _hasStarted = false;
  late final Map<int, _BuildComponentStatus> _componentStatuses;

  @override
  void initState() {
    super.initState();
    _componentStatuses = {
      for (var index = 0; index < widget.project.components.length; index++)
        index: _BuildComponentStatus.missing,
    };
  }

  @override
  void didUpdateWidget(covariant ProjectBuildActionsPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.project.id != widget.project.id ||
        oldWidget.project.components.length !=
            widget.project.components.length) {
      _componentStatuses
        ..clear()
        ..addEntries(
          List.generate(
            widget.project.components.length,
            (index) => MapEntry(index, _BuildComponentStatus.missing),
          ),
        );
      _hasStarted = false;
    }
  }

  void _startBuild() {
    setState(() {
      _hasStarted = true;
    });
  }

  void _setStatus(int index, _BuildComponentStatus status) {
    setState(() {
      _componentStatuses[index] = status;
    });
  }

  void _findMaterials(BuildContext context, String query) {
    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      context.go('/materials');
      return;
    }

    context.go(
      Uri(path: '/materials', queryParameters: {'q': trimmed}).toString(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final summary = _BuildChecklistSummary.fromStatuses(
      _componentStatuses.values,
    );

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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 760;
              final copy = _BuildPanelHeader(
                project: widget.project,
                summary: summary,
                hasStarted: _hasStarted,
              );
              final actions = _BuildPanelActions(
                hasStarted: _hasStarted,
                hasComponents: widget.project.components.isNotEmpty,
                onStartBuild: _startBuild,
                onBrowseMaterials: () => context.go('/materials'),
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
            },
          ),
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Padding(
              padding: const EdgeInsetsDirectional.only(top: AppSpacing.lg),
              child: _hasStarted
                  ? _BuildChecklist(
                      components: widget.project.components,
                      statuses: _componentStatuses,
                      onStatusChanged: _setStatus,
                      onFindMaterials: _findMaterials,
                    )
                  : const SizedBox.shrink(),
            ),
            crossFadeState: _hasStarted
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 180),
          ),
        ],
      ),
    );
  }
}

class _BuildPanelHeader extends StatelessWidget {
  const _BuildPanelHeader({
    required this.project,
    required this.summary,
    required this.hasStarted,
  });

  final LearningProject project;
  final _BuildChecklistSummary summary;
  final bool hasStarted;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.construction_rounded, color: palette.lime),
        const SizedBox(height: AppSpacing.md),
        Text(
          LocalizedText(
            en: hasStarted ? 'Build checklist' : 'Plan this build',
            ar: hasStarted ? 'قائمة البناء' : 'خطط لبناء هذا المشروع',
          ).resolve(context),
          style: AppTextStyles.title(
            context,
          ).copyWith(color: palette.textPrimary),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          LocalizedText(
            en: hasStarted
                ? 'Track each required component manually, then search materials for anything still missing.'
                : 'Start a build checklist from the required components. You can mark what is ready, missing, reserved, already owned, or covered by an alternative.',
            ar: hasStarted
                ? 'تتبع كل مكون مطلوب يدوياً، ثم ابحث في المواد عن أي شيء ما زال ناقصاً.'
                : 'ابدأ قائمة بناء من المكونات المطلوبة. يمكنك تحديد الجاهز أو الناقص أو المحجوز أو المملوك مسبقاً أو البديل.',
          ).resolve(context),
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
              label: LocalizedText(
                en: '${project.components.length} components',
                ar: '${project.components.length} مكونات',
              ),
            ),
            _BuildMetricChip(
              icon: Icons.format_list_numbered_rounded,
              label: LocalizedText(
                en: '${project.steps.length} steps',
                ar: '${project.steps.length} خطوات',
              ),
            ),
            if (project.links.isNotEmpty)
              _BuildMetricChip(
                icon: Icons.link_rounded,
                label: LocalizedText(
                  en: '${project.links.length} links',
                  ar: '${project.links.length} روابط',
                ),
              ),
            if (hasStarted)
              _BuildMetricChip(
                icon: Icons.task_alt_rounded,
                label: LocalizedText(
                  en: '${summary.readyCount}/${summary.total} ready',
                  ar: '${summary.readyCount}/${summary.total} جاهز',
                ),
                accent: true,
              ),
          ],
        ),
      ],
    );
  }
}

class _BuildPanelActions extends StatelessWidget {
  const _BuildPanelActions({
    required this.hasStarted,
    required this.hasComponents,
    required this.onStartBuild,
    required this.onBrowseMaterials,
  });

  final bool hasStarted;
  final bool hasComponents;
  final VoidCallback onStartBuild;
  final VoidCallback onBrowseMaterials;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        FilledButton.icon(
          onPressed: hasComponents && !hasStarted ? onStartBuild : null,
          icon: const Icon(Icons.playlist_add_check_rounded),
          label: Text(
            LocalizedText(
              en: hasStarted ? 'Checklist started' : 'Start build',
              ar: hasStarted ? 'بدأت القائمة' : 'بدء البناء',
            ).resolve(context),
          ),
        ),
        OutlinedButton.icon(
          onPressed: onBrowseMaterials,
          icon: const Icon(Icons.search_rounded),
          label: Text(
            const LocalizedText(
              en: 'Browse materials',
              ar: 'تصفح المواد',
            ).resolve(context),
          ),
        ),
      ],
    );
  }
}

class _BuildChecklist extends StatelessWidget {
  const _BuildChecklist({
    required this.components,
    required this.statuses,
    required this.onStatusChanged,
    required this.onFindMaterials,
  });

  final List<LocalizedText> components;
  final Map<int, _BuildComponentStatus> statuses;
  final void Function(int index, _BuildComponentStatus status) onStatusChanged;
  final void Function(BuildContext context, String query) onFindMaterials;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    if (components.isEmpty) {
      return Container(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: palette.cardSurfaceAlt,
          borderRadius: AppRadius.lgAll,
          border: Border.all(color: palette.borderSubtle),
        ),
        child: Text(
          const LocalizedText(
            en: 'This project does not list required components yet.',
            ar: 'لا يحتوي هذا المشروع على مكونات مطلوبة بعد.',
          ).resolve(context),
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          const LocalizedText(
            en: 'Required component checklist',
            ar: 'قائمة المكونات المطلوبة',
          ).resolve(context),
          style: AppTextStyles.title(
            context,
          ).copyWith(color: palette.textPrimary),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          const LocalizedText(
            en: 'Status is local to this screen for now. Use Find materials to search the marketplace for each component.',
            ar: 'الحالة محلية في هذه الشاشة حالياً. استخدم البحث عن المواد للعثور على كل مكون في السوق.',
          ).resolve(context),
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary, height: 1.4),
        ),
        const SizedBox(height: AppSpacing.md),
        ...List.generate(components.length, (index) {
          final component = components[index];
          return Padding(
            padding: EdgeInsetsDirectional.only(
              bottom: index == components.length - 1 ? 0 : AppSpacing.md,
            ),
            child: _BuildChecklistItem(
              index: index,
              component: component,
              status: statuses[index] ?? _BuildComponentStatus.missing,
              onStatusChanged: (status) => onStatusChanged(index, status),
              onFindMaterials: () =>
                  onFindMaterials(context, component.resolve(context)),
            ),
          );
        }),
      ],
    );
  }
}

class _BuildChecklistItem extends StatelessWidget {
  const _BuildChecklistItem({
    required this.index,
    required this.component,
    required this.status,
    required this.onStatusChanged,
    required this.onFindMaterials,
  });

  final int index;
  final LocalizedText component;
  final _BuildComponentStatus status;
  final ValueChanged<_BuildComponentStatus> onStatusChanged;
  final VoidCallback onFindMaterials;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final statusMeta = _BuildStatusMeta.fromStatus(status);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: statusMeta.borderColor(palette)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 620;
              final leading = Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: statusMeta.backgroundColor(palette),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: statusMeta.borderColor(palette)),
                ),
                child: Text(
                  '${index + 1}',
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: statusMeta.foregroundColor(palette)),
                ),
              );
              final title = Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    component.resolve(context),
                    style: AppTextStyles.subtitle(
                      context,
                    ).copyWith(color: palette.textPrimary),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  _BuildStatusChip(status: status),
                ],
              );
              final button = OutlinedButton.icon(
                onPressed: onFindMaterials,
                icon: const Icon(Icons.search_rounded, size: 18),
                label: Text(
                  const LocalizedText(
                    en: 'Find materials',
                    ar: 'البحث عن مواد',
                  ).resolve(context),
                ),
              );

              if (compact) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        leading,
                        const SizedBox(width: AppSpacing.md),
                        Expanded(child: title),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    button,
                  ],
                );
              }

              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  leading,
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: title),
                  const SizedBox(width: AppSpacing.sm),
                  button,
                ],
              );
            },
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: _BuildComponentStatus.values
                .map((option) {
                  final selected = option == status;
                  final meta = _BuildStatusMeta.fromStatus(option);

                  return ChoiceChip(
                    selected: selected,
                    label: Text(meta.label.resolve(context)),
                    avatar: Icon(
                      meta.icon,
                      size: 18,
                      color: selected
                          ? meta.foregroundColor(palette)
                          : palette.textSecondary,
                    ),
                    onSelected: (_) => onStatusChanged(option),
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
        ],
      ),
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
  final LocalizedText label;
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
            label.resolve(context),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: accent ? palette.limeSoft : palette.textPrimary),
          ),
        ],
      ),
    );
  }
}

class _BuildStatusChip extends StatelessWidget {
  const _BuildStatusChip({required this.status});

  final _BuildComponentStatus status;

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
            meta.label.resolve(context),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: meta.foregroundColor(palette)),
          ),
        ],
      ),
    );
  }
}

enum _BuildComponentStatus {
  available,
  missing,
  alternative,
  alreadyOwned,
  reserved,
}

class _BuildStatusMeta {
  const _BuildStatusMeta({
    required this.label,
    required this.icon,
    required this.colorRole,
  });

  final LocalizedText label;
  final IconData icon;
  final _BuildStatusColorRole colorRole;

  Color backgroundColor(LearningUiPalette palette) {
    return switch (colorRole) {
      _BuildStatusColorRole.ready => palette.lime.withValues(alpha: 0.16),
      _BuildStatusColorRole.warning => Colors.amber.withValues(alpha: 0.16),
      _BuildStatusColorRole.info => Colors.lightBlue.withValues(alpha: 0.14),
      _BuildStatusColorRole.neutral => palette.mutedChip,
    };
  }

  Color borderColor(LearningUiPalette palette) {
    return switch (colorRole) {
      _BuildStatusColorRole.ready => palette.lime.withValues(alpha: 0.72),
      _BuildStatusColorRole.warning => Colors.amber.withValues(alpha: 0.72),
      _BuildStatusColorRole.info => Colors.lightBlue.withValues(alpha: 0.58),
      _BuildStatusColorRole.neutral => palette.borderSubtle,
    };
  }

  Color foregroundColor(LearningUiPalette palette) {
    return switch (colorRole) {
      _BuildStatusColorRole.ready => palette.limeSoft,
      _BuildStatusColorRole.warning => Colors.amber.shade700,
      _BuildStatusColorRole.info => Colors.lightBlue.shade300,
      _BuildStatusColorRole.neutral => palette.textSecondary,
    };
  }

  static _BuildStatusMeta fromStatus(_BuildComponentStatus status) {
    return switch (status) {
      _BuildComponentStatus.available => const _BuildStatusMeta(
        label: LocalizedText(en: 'Available', ar: 'متوفر'),
        icon: Icons.inventory_2_outlined,
        colorRole: _BuildStatusColorRole.ready,
      ),
      _BuildComponentStatus.missing => const _BuildStatusMeta(
        label: LocalizedText(en: 'Missing', ar: 'ناقص'),
        icon: Icons.search_off_rounded,
        colorRole: _BuildStatusColorRole.warning,
      ),
      _BuildComponentStatus.alternative => const _BuildStatusMeta(
        label: LocalizedText(en: 'Alternative', ar: 'بديل'),
        icon: Icons.swap_horiz_rounded,
        colorRole: _BuildStatusColorRole.info,
      ),
      _BuildComponentStatus.alreadyOwned => const _BuildStatusMeta(
        label: LocalizedText(en: 'Already owned', ar: 'مملوك مسبقاً'),
        icon: Icons.home_repair_service_outlined,
        colorRole: _BuildStatusColorRole.ready,
      ),
      _BuildComponentStatus.reserved => const _BuildStatusMeta(
        label: LocalizedText(en: 'Reserved', ar: 'محجوز'),
        icon: Icons.lock_clock_rounded,
        colorRole: _BuildStatusColorRole.ready,
      ),
    };
  }
}

enum _BuildStatusColorRole { ready, warning, info, neutral }

class _BuildChecklistSummary {
  const _BuildChecklistSummary({required this.total, required this.readyCount});

  final int total;
  final int readyCount;

  static _BuildChecklistSummary fromStatuses(
    Iterable<_BuildComponentStatus> statuses,
  ) {
    final values = statuses.toList(growable: false);
    final readyCount = values.where((status) {
      return switch (status) {
        _BuildComponentStatus.available ||
        _BuildComponentStatus.alternative ||
        _BuildComponentStatus.alreadyOwned ||
        _BuildComponentStatus.reserved => true,
        _BuildComponentStatus.missing => false,
      };
    }).length;

    return _BuildChecklistSummary(total: values.length, readyCount: readyCount);
  }
}
