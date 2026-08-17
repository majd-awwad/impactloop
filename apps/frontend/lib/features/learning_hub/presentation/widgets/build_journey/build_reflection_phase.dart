import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../application/learning_session_providers.dart';
import '../../../domain/models/project_build.dart';
import '../../l10n/project_build_page_l10n.dart';
import '../../theme/learning_ui_palette.dart';
import '../final_learning_check_section.dart';

class BuildReflectionPhase extends ConsumerWidget {
  const BuildReflectionPhase({
    super.key,
    required this.projectId,
    required this.buildRecord,
    required this.onContinue,
    required this.onOpenFinalCheck,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final VoidCallback onContinue;
  final VoidCallback onOpenFinalCheck;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = LearningUiPalette.of(context);
    final languageCode = Localizations.localeOf(context).languageCode;
    final session = ref
        .watch(buildLearningSessionProvider(projectId))
        .asData
        ?.value
        .session;
    final summary = session?.learningSummary;
    final understood = summary?.understoodConcepts ?? const [];
    final review = summary?.reviewConcepts ?? const [];
    final hasLearning = understood.isNotEmpty || review.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          ProjectBuildPageL10n.quickReview.resolve(context),
          style: AppTextStyles.title(
            context,
          ).copyWith(fontWeight: FontWeight.w800, fontSize: 22),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          ProjectBuildPageL10n.reviewBeforeFinish.resolve(context),
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary, height: 1.35),
        ),
        if (hasLearning) ...[
          const SizedBox(height: AppSpacing.md),
          if (understood.isNotEmpty)
            Text(
              ProjectBuildPageL10n.masteredConceptsCount(
                understood.length,
              ).resolve(context),
              style: AppTextStyles.body(
                context,
              ).copyWith(fontWeight: FontWeight.w700),
            ),
          for (final concept in understood)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                '✓ ${concept.labelFor(languageCode)}',
                style: AppTextStyles.body(context).copyWith(fontSize: 14),
              ),
            ),
          if (review.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              ProjectBuildPageL10n.reviewConceptsCount(
                review.length,
              ).resolve(context),
              style: AppTextStyles.body(
                context,
              ).copyWith(fontWeight: FontWeight.w700),
            ),
            for (final concept in review)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  '○ ${concept.labelFor(languageCode)}',
                  style: AppTextStyles.body(context).copyWith(fontSize: 14),
                ),
              ),
          ],
        ],
        const SizedBox(height: AppSpacing.md),
        FinalLearningCheckSection(
          projectId: projectId,
          buildRecord: buildRecord,
          onOpenCheck: onOpenFinalCheck,
        ),
        const SizedBox(height: AppSpacing.md),
        SizedBox(
          height: 48,
          child: FilledButton(
            onPressed: onContinue,
            child: Text(ProjectBuildPageL10n.continueLabel.resolve(context)),
          ),
        ),
        TextButton(
          onPressed: onContinue,
          child: Text(ProjectBuildPageL10n.skipForNow.resolve(context)),
        ),
      ],
    );
  }
}
