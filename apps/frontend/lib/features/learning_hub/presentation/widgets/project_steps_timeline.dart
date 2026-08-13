import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../presentation/theme/learning_ui_palette.dart';
import '../../domain/models/learning_project.dart';

class ProjectStepsTimeline extends StatefulWidget {
  const ProjectStepsTimeline({super.key, required this.steps});

  final List<ProjectStep> steps;

  @override
  State<ProjectStepsTimeline> createState() => _ProjectStepsTimelineState();
}

class _ProjectStepsTimelineState extends State<ProjectStepsTimeline> {
  static const int _collapsedVisibleCount = 3;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    final hasMore = widget.steps.length > _collapsedVisibleCount;
    final visibleSteps = _expanded
        ? widget.steps
        : widget.steps.take(_collapsedVisibleCount).toList();

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.check_circle_outline, color: palette.lime, size: 22),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  const LocalizedText(
                    en: 'Implementation steps',
                    ar: 'خطوات التنفيذ',
                  ).resolve(context),
                  style: textTheme.titleLarge?.copyWith(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.start,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          for (var index = 0; index < visibleSteps.length; index++)
            _TimelineItem(
              index: index + 1,
              title: visibleSteps[index].title.resolve(context),
              isLast: index == visibleSteps.length - 1,
            ),
          if (hasMore) ...[
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton.icon(
              onPressed: () => setState(() => _expanded = !_expanded),
              style: AppStatusButtonStyle.outlined(
                context,
                AppStatusTone.neutral,
              ),
              icon: Icon(
                _expanded
                    ? Icons.keyboard_arrow_up_rounded
                    : Icons.keyboard_arrow_down_rounded,
              ),
              label: Text(
                _expanded
                    ? const LocalizedText(
                        en: 'Show fewer steps',
                        ar: 'عرض خطوات أقل',
                      ).resolve(context)
                    : LocalizedText(
                        en: 'Show all steps (${widget.steps.length})',
                        ar: 'عرض كل الخطوات (${widget.steps.length})',
                      ).resolve(context),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _TimelineItem extends StatelessWidget {
  const _TimelineItem({
    required this.index,
    required this.title,
    required this.isLast,
  });

  final int index;
  final String title;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: EdgeInsetsDirectional.only(bottom: isLast ? 0 : AppSpacing.sm),
      child: Container(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        decoration: BoxDecoration(
          color: palette.cardSurface,
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: palette.borderSubtle),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: palette.limeSoft,
                borderRadius: AppRadius.pillAll,
                border: Border.all(color: palette.lime.withValues(alpha: 0.28)),
              ),
              child: Text(
                '$index',
                style: textTheme.labelMedium?.copyWith(
                  color: palette.lime,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                title,
                style: textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: palette.textPrimary,
                  height: 1.3,
                ),
                textAlign: TextAlign.start,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
