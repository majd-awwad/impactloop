import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../learning_hub/data/learning_hub_mock_data.dart';
import '../../../learning_hub/domain/models/learning_project.dart';
import 'home_section_header.dart';

class LearningSpotlightSection extends StatelessWidget {
  const LearningSpotlightSection({super.key});

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final previewProjects = learningProjects.take(2).toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        HomeSectionHeader(
          title: 'Learning spotlight',
          subtitle:
              'Browse practical project ideas while the Learning Hub remains UI-only.',
          action: FilledButton.icon(
            onPressed: () => context.go('/learning'),
            style: FilledButton.styleFrom(
              backgroundColor: palette.mint,
              foregroundColor: palette.ctaForeground,
              shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
            ),
            icon: const Icon(Icons.school_outlined),
            label: const Text('Explore Learning Hub'),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 760;
            final itemWidth = wide
                ? (constraints.maxWidth - AppSpacing.md) / 2
                : constraints.maxWidth;

            return Wrap(
              spacing: AppSpacing.md,
              runSpacing: AppSpacing.md,
              children: previewProjects.map((project) {
                return SizedBox(
                  width: itemWidth,
                  child: _LearningPreviewCard(project: project),
                );
              }).toList(),
            );
          },
        ),
      ],
    );
  }
}

class _LearningPreviewCard extends StatelessWidget {
  const _LearningPreviewCard({required this.project});

  final LearningProject project;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.go('/learning/${project.id}'),
        borderRadius: AppRadius.lgAll,
        child: Container(
          constraints: const BoxConstraints(minHeight: 194),
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: palette.cardSurface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: palette.borderStrong),
            boxShadow: [
              BoxShadow(
                color: palette.cardShadow,
                blurRadius: 20,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: AlignmentDirectional.topStart,
                    end: AlignmentDirectional.bottomEnd,
                    colors: projectGradient(project),
                  ),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: palette.borderStrong),
                ),
                child: Icon(
                  project.heroIconData,
                  color: Colors.white,
                  size: 30,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Learning Hub preview',
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.mint,
                        fontSize: 12,
                        letterSpacing: 0,
                      ),
                      textAlign: TextAlign.start,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      project.title.resolve(context),
                      style: AppTextStyles.title(
                        context,
                      ).copyWith(color: palette.textPrimary, letterSpacing: 0),
                      textAlign: TextAlign.start,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      project.summary.resolve(context),
                      style: AppTextStyles.body(context).copyWith(
                        color: palette.textSecondary,
                        height: 1.45,
                        letterSpacing: 0,
                      ),
                      textAlign: TextAlign.start,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
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
