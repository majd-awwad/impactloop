import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';

class MaterialsHeroSection extends StatelessWidget {
  const MaterialsHeroSection({
    super.key,
    required this.title,
    required this.subtitle,
    required this.stats,
  });

  final LocalizedText title;
  final LocalizedText subtitle;
  final Map<LocalizedText, String> stats;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: AppRadius.xlAll,
        gradient: const LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: [materialHeroStart, materialHeroMid, materialHeroEnd],
        ),
        border: Border.all(color: materialBorderStrong),
      ),
      child: Stack(
        children: [
          PositionedDirectional(
            top: -48,
            start: -18,
            child: _HeroOrb(
              size: 132,
              color: materialHeroGlow,
            ),
          ),
          PositionedDirectional(
            top: -70,
            end: 18,
            child: _HeroOrb(
              size: 180,
              color: materialMint.withValues(alpha: 0.06),
            ),
          ),
          PositionedDirectional(
            bottom: -52,
            end: 120,
            child: _HeroOrb(
              size: 156,
              color: materialInfo.withValues(alpha: 0.05),
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: const [
                    _HeroActionButton(icon: Icons.tune_rounded),
                    Spacer(),
                    _HeroActionButton(
                      icon: Icons.arrow_outward_rounded,
                      accent: true,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xl),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 760),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title.resolve(context),
                        style: AppTextStyles.brandingHeadline(context).copyWith(
                          color: materialTextPrimary,
                          fontWeight: FontWeight.w800,
                          fontSize: 40,
                        ),
                        textAlign: TextAlign.start,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        subtitle.resolve(context),
                        style: AppTextStyles.brandingSubtitle(context).copyWith(
                          color: materialTextSecondary,
                        ),
                        textAlign: TextAlign.start,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                Wrap(
                  spacing: AppSpacing.md,
                  runSpacing: AppSpacing.md,
                  children: stats.entries.map((entry) {
                    return _HeroStat(
                      label: entry.key.resolve(context),
                      value: entry.value,
                    );
                  }).toList(),
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
  const _HeroStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.md,
      ),
      decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.04),
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: materialBorderStrong),
          ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: AppTextStyles.brandingHeadline(
              context,
            ).copyWith(color: materialMint, fontWeight: FontWeight.w800),
            textAlign: TextAlign.start,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            label,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: materialTextSecondary),
            textAlign: TextAlign.start,
          ),
        ],
      ),
    );
  }
}

class _HeroActionButton extends StatelessWidget {
  const _HeroActionButton({required this.icon, this.accent = false});

  final IconData icon;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: accent
            ? materialMint.withValues(alpha: 0.16)
            : materialPanelSurface.withValues(alpha: 0.82),
        shape: BoxShape.circle,
        border: Border.all(
          color: accent
              ? materialMint.withValues(alpha: 0.4)
              : materialBorderSubtle,
        ),
      ),
      child: IconButton(
        onPressed: () {},
        icon: Icon(
          icon,
          color: accent ? materialCtaForeground : materialTextPrimary,
        ),
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
