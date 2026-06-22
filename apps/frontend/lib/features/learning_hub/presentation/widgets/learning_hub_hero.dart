import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../data/learning_hub_mock_data.dart';
import '../../domain/models/learning_project.dart';
import 'learning_hub_text.dart';

class LearningHubHero extends StatelessWidget {
  const LearningHubHero({
    super.key,
    required this.title,
    required this.subtitle,
    required this.stats,
  });

  final LocalizedText title;
  final LocalizedText subtitle;
  final Map<LocalizedText, int> stats;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final messenger = ScaffoldMessenger.of(context);

    return Container(
      constraints: const BoxConstraints(minHeight: 332),
      decoration: BoxDecoration(
        borderRadius: AppRadius.xlAll,
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: [palette.heroStart, palette.heroAccent, palette.heroEnd],
        ),
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Stack(
        children: [
          PositionedDirectional(
            top: -56,
            start: -28,
            child: _HeroOrb(
              size: 140,
              color: palette.cardSurface.withValues(alpha: 0.05),
            ),
          ),
          PositionedDirectional(
            top: -80,
            end: -16,
            child: _HeroOrb(
              size: 200,
              color: palette.lime.withValues(alpha: 0.08),
            ),
          ),
          PositionedDirectional(
            bottom: -70,
            end: 160,
            child: _HeroOrb(
              size: 180,
              color: palette.cardSurface.withValues(alpha: 0.04),
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.lg,
              AppSpacing.xl,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    _HeroActionButton(
                      icon: Icons.search_rounded,
                      onPressed: () {
                        messenger.showSnackBar(
                          SnackBar(
                            content: Text(
                              const LocalizedText(
                                en: 'Search is a visual placeholder for now.',
                                ar: 'البحث عنصر بصري تجريبي حالياً.',
                              ).resolve(context),
                            ),
                          ),
                        );
                      },
                    ),
                    const Spacer(),
                    _HeroActionButton(
                      icon: Icons.arrow_forward_rounded,
                      onPressed: () {
                        messenger.showSnackBar(
                          SnackBar(
                            content: Text(
                              const LocalizedText(
                                en: 'Header action is a visual placeholder for now.',
                                ar: 'زر العنوان عنصر بصري تجريبي حالياً.',
                              ).resolve(context),
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xl),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      title.resolve(context),
                      style: AppTextStyles.brandingHeadline(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w800,
                        fontSize: 40,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 760),
                      child: Text(
                        subtitle.resolve(context),
                        style: AppTextStyles.brandingSubtitle(
                          context,
                        ).copyWith(color: palette.textSecondary),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    Wrap(
                      alignment: WrapAlignment.center,
                      spacing: AppSpacing.xl,
                      runSpacing: AppSpacing.md,
                      children: stats.entries.map((entry) {
                        return _HeroStat(
                          value: entry.value.toString(),
                          label: entry.key.resolve(context),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: AppTextStyles.brandingHeadline(
            context,
          ).copyWith(color: palette.lime, fontWeight: FontWeight.w800),
        ),
        Text(
          label,
          style: AppTextStyles.mobileHeroSubtitle(
            context,
          ).copyWith(color: palette.textSecondary),
        ),
      ],
    );
  }
}

class _HeroActionButton extends StatelessWidget {
  const _HeroActionButton({required this.icon, required this.onPressed});

  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      decoration: BoxDecoration(
        color: palette.cardSurface.withValues(alpha: 0.08),
        shape: BoxShape.circle,
        border: Border.all(color: palette.cardSurface.withValues(alpha: 0.08)),
      ),
      child: IconButton(
        onPressed: onPressed,
        icon: Icon(icon, color: palette.textPrimary),
      ),
    );
  }
}

class _HeroOrb extends StatelessWidget {
  const _HeroOrb({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}
