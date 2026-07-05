import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../domain/models/learning_project.dart';
import '../theme/learning_ui_palette.dart';

class ProjectBuildActionsPanel extends StatelessWidget {
  const ProjectBuildActionsPanel({super.key, required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

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
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 760;
          final copy = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.construction_rounded, color: palette.lime),
              const SizedBox(height: AppSpacing.md),
              Text(
                const LocalizedText(
                  en: 'Plan this build',
                  ar: 'خطط لبناء هذا المشروع',
                ).resolve(context),
                style: AppTextStyles.title(
                  context,
                ).copyWith(color: palette.textPrimary),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                const LocalizedText(
                  en: 'Use the component list to prepare materials. Saved projects, project likes, reviews, and a build checklist are the next Learning Hub workflow.',
                  ar: 'استخدم قائمة المكونات لتجهيز المواد. حفظ المشاريع، الإعجابات، المراجعات، وقائمة البناء هي مسار العمل القادم في مركز التعلم.',
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
                ],
              ),
            ],
          );
          final actions = Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              FilledButton.icon(
                onPressed: () => context.go('/materials'),
                icon: const Icon(Icons.search_rounded),
                label: Text(
                  const LocalizedText(
                    en: 'Browse materials',
                    ar: 'تصفح المواد',
                  ).resolve(context),
                ),
              ),
              OutlinedButton.icon(
                onPressed: null,
                icon: const Icon(Icons.checklist_rounded),
                label: Text(
                  const LocalizedText(
                    en: 'Checklist coming next',
                    ar: 'قائمة البناء قريباً',
                  ).resolve(context),
                ),
              ),
            ],
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
    );
  }
}

class _BuildMetricChip extends StatelessWidget {
  const _BuildMetricChip({required this.icon, required this.label});

  final IconData icon;
  final LocalizedText label;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: palette.lime),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label.resolve(context),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
        ],
      ),
    );
  }
}
