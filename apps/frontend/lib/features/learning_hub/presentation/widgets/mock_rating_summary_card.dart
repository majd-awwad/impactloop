import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../data/learning_hub_mock_data.dart';
import '../../domain/models/learning_project.dart';

class MockRatingSummaryCard extends StatelessWidget {
  const MockRatingSummaryCard({
    super.key,
    required this.project,
    required this.breakdown,
  });

  final LearningProject project;
  final List<RatingBreakdown> breakdown;

  @override
  Widget build(BuildContext context) {
    final highestCount = breakdown.fold<int>(
      1,
      (max, item) => item.count > max ? item.count : max,
    );

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: learningCardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: learningBorderSubtle),
        boxShadow: const [
          BoxShadow(
            color: learningCardShadow,
            blurRadius: 24,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 760;

          final summary = Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    project.ratingValue.toStringAsFixed(1),
                    style: AppTextStyles.brandingTitle(
                      context,
                    ).copyWith(color: learningLime),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    children: List.generate(
                      5,
                      (index) => Icon(
                        index < 4
                            ? Icons.star_rounded
                            : Icons.star_border_rounded,
                        color: learningLime,
                        size: 20,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: AppSpacing.lg),
              Text(
                '${project.ratingCount}\n${project.ratingLabel.resolve(context)}',
                style: AppTextStyles.mobileHeroSubtitle(
                  context,
                ).copyWith(color: learningTextSecondary),
                textAlign: TextAlign.start,
              ),
            ],
          );

          final bars = Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: breakdown.map((item) {
              final ratio = item.count / highestCount;
              return Padding(
                padding: const EdgeInsetsDirectional.only(
                  bottom: AppSpacing.sm,
                ),
                child: Row(
                  children: [
                    SizedBox(
                      width: 24,
                      child: Text(
                        '${item.stars}',
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: learningTextSecondary),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: AppRadius.pillAll,
                        child: LinearProgressIndicator(
                          value: ratio,
                          minHeight: 8,
                          backgroundColor: Colors.white.withValues(
                            alpha: 0.14,
                          ),
                          valueColor: const AlwaysStoppedAnimation<Color>(
                            learningLime,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          );

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                const LocalizedText(
                  en: 'Learner rating',
                  ar: 'تقييم المتعلمين',
                ).resolve(context),
                style: AppTextStyles.brandingHeadline(
                  context,
                ).copyWith(fontSize: 26, color: learningTextPrimary),
              ),
              const SizedBox(height: AppSpacing.lg),
              compact
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        summary,
                        const SizedBox(height: AppSpacing.lg),
                        bars,
                      ],
                    )
                  : Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: bars),
                        const SizedBox(width: AppSpacing.lg),
                        summary,
                      ],
                    ),
            ],
          );
        },
      ),
    );
  }
}
