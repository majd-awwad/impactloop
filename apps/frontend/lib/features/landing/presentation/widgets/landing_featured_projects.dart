import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../l10n/l10n.dart';
import '../../../learning_hub/presentation/widgets/learning_project_card.dart';
import '../../../learning_hub/presentation/widgets/learning_project_card_layout.dart';
import '../../application/landing_public_providers.dart';
import '../../domain/landing_public_content.dart';
import 'landing_async_section.dart';

class LandingFeaturedProjects extends ConsumerWidget {
  const LandingFeaturedProjects({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final content = ref.watch(landingPublicContentProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LandingSectionHeader(
          title: context.l10n.landingFeaturedProjectsTitle,
          actionLabel: context.l10n.browseAll,
          onAction: () => context.go('/learning'),
        ),
        const SizedBox(height: AppSpacing.md),
        LandingAsyncBody<LandingPublicContent>(
          value: content,
          isEmpty: (data) => !data.hasProjects,
          emptyLabel: context.l10n.landingFeaturedProjectsEmpty,
          onRetry: () => ref.invalidate(landingPublicContentProvider),
          builder: (data) {
            return LayoutBuilder(
              builder: (context, constraints) {
                final width = constraints.maxWidth;
                if (LearningProjectCardLayout.useCompactList(width)) {
                  return Column(
                    children: [
                      for (var i = 0; i < data.projects.length; i++) ...[
                        if (i > 0) const SizedBox(height: AppSpacing.sm),
                        LearningProjectCompactCard(project: data.projects[i]),
                      ],
                    ],
                  );
                }

                final columns = LearningProjectCardLayout.columnsForWidth(
                  width,
                );
                final itemWidth = LearningProjectCardLayout.itemWidthForGrid(
                  gridWidth: width,
                  columns: columns,
                );

                return Wrap(
                  spacing: AppSpacing.md,
                  runSpacing: AppSpacing.md,
                  children: data.projects
                      .map(
                        (project) => SizedBox(
                          width: itemWidth,
                          child: LearningProjectCard(project: project),
                        ),
                      )
                      .toList(growable: false),
                );
              },
            );
          },
        ),
      ],
    );
  }
}
