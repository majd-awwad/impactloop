import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../data/learning_hub_mock_data.dart';
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
    final hasMore = widget.steps.length > _collapsedVisibleCount;
    final visibleSteps = _expanded
        ? widget.steps
        : widget.steps.take(_collapsedVisibleCount).toList();

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
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: palette.darkSurfaceSoft,
                  borderRadius: AppRadius.pillAll,
                ),
                child: Icon(Icons.check_circle_outline, color: palette.lime),
              ),
              const Spacer(),
              Text(
                const LocalizedText(
                  en: 'Implementation steps',
                  ar: 'خطوات التنفيذ',
                ).resolve(context),
                style: AppTextStyles.display(
                  context,
                ).copyWith(color: palette.textPrimary),
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
                style: AppTextStyles.title(context).copyWith(
                  fontWeight: FontWeight.w500,
                  color: palette.textPrimary,
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
                  color: palette.darkSurfaceSoft,
                  borderRadius: AppRadius.pillAll,
                  border: Border.all(color: palette.borderSubtle),
                ),
                child: Text(
                  '$index',
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: palette.textSecondary),
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
