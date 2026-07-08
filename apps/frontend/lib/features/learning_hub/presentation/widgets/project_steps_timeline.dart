import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
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
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
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
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: palette.limeSoft,
                  borderRadius: AppRadius.pillAll,
                  border: Border.all(
                    color: palette.lime.withValues(alpha: 0.28),
                  ),
                ),
                child: Icon(Icons.check_circle_outline, color: palette.lime),
              ),
              const Spacer(),
              Text(
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
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
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

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsetsDirectional.only(
                top: AppSpacing.sm,
                bottom: AppSpacing.lg,
              ),
              child: Text(
                title,
                style: textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: palette.textPrimary,
                  height: 1.3,
                ),
                textAlign: TextAlign.start,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Column(
            children: [
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: palette.cardSurfaceAlt,
                  borderRadius: AppRadius.pillAll,
                  border: Border.all(color: palette.borderSubtle),
                ),
                child: Text(
                  '$index',
                  style: textTheme.labelMedium?.copyWith(
                    color: palette.textSecondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (!isLast)
                Container(width: 2, height: 48, color: palette.timelineLine),
            ],
          ),
        ],
      ),
    );
  }
}
