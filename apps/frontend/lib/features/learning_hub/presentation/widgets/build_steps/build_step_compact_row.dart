import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/utils/content_text_direction.dart';
import '../../../domain/models/project_build.dart';
import '../../theme/learning_ui_palette.dart';
import 'build_step_number_badge.dart';
import 'build_step_status_chip.dart';

class BuildStepCompactRow extends StatefulWidget {
  const BuildStepCompactRow({
    super.key,
    required this.step,
    this.compact = true,
    this.footer,
  });

  final ProjectBuildStepView step;
  final bool compact;
  final Widget? footer;

  @override
  State<BuildStepCompactRow> createState() => _BuildStepCompactRowState();
}

class _BuildStepCompactRowState extends State<BuildStepCompactRow> {
  bool _expanded = false;

  bool get _canExpand {
    return widget.step.description.trim().isNotEmpty || widget.footer != null;
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final isCompleted = widget.step.state == ProjectBuildStepState.completed;
    final padding = widget.compact ? AppSpacing.sm + 2 : AppSpacing.sm + 4;

    final row = ConstrainedBox(
      constraints: BoxConstraints(minHeight: widget.compact ? 56 : 64),
      child: Padding(
        padding: EdgeInsetsDirectional.symmetric(
          horizontal: padding,
          vertical: AppSpacing.sm,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                BuildStepNumberBadge(
                  number: widget.step.stepNumber,
                  emphasized: isCompleted,
                  size: widget.compact ? 28 : 32,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: ContentDirectionalText(
                    widget.step.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.subtitle(context).copyWith(
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w600,
                      fontSize: widget.compact ? 15 : 16,
                      height: 1.25,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                BuildStepStatusChip(state: widget.step.state),
              ],
            ),
            if (_expanded) ...[
              if (widget.step.description.trim().isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                ContentDirectionalText(
                  widget.step.description.trim(),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                    fontSize: widget.compact ? 13 : 14,
                    height: 1.35,
                  ),
                ),
              ],
              if (widget.footer != null) widget.footer!,
            ],
          ],
        ),
      ),
    );

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: isCompleted
            ? palette.limeSoft.withValues(alpha: 0.35)
            : palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: _canExpand
          ? Material(
              type: MaterialType.transparency,
              child: InkWell(
                onTap: () => setState(() => _expanded = !_expanded),
                borderRadius: AppRadius.lgAll,
                child: row,
              ),
            )
          : row,
    );
  }
}
