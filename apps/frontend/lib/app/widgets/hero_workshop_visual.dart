import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/auth_dark_text_styles.dart';
import '../theme/landing_colors.dart';

/// Hero workshop photo with premium impact overlays.
class HeroWorkshopVisual extends StatelessWidget {
  const HeroWorkshopVisual({super.key});

  static const _heroImageAsset = 'assets/images/landing/hero_workshop.png';

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ClipRRect(
      borderRadius: AppRadius.xlAll,
      child: AspectRatio(
        aspectRatio: 4 / 5,
        child: Stack(
          fit: StackFit.expand,
          children: [
            _BackgroundImage(),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: isDark
                      ? [
                          colors.background.withValues(alpha: 0.22),
                          colors.background.withValues(alpha: 0.12),
                          colors.background.withValues(alpha: 0.72),
                        ]
                      : [
                          colors.background.withValues(alpha: 0.08),
                          colors.backgroundAlt.withValues(alpha: 0.12),
                          colors.primary.withValues(alpha: 0.18),
                        ],
                  stops: const [0.0, 0.35, 1.0],
                ),
              ),
            ),
            const Positioned(
              top: AppSpacing.lg,
              right: AppSpacing.lg,
              child: _ImpactBadge(),
            ),
            Positioned(
              left: AppSpacing.lg,
              right: AppSpacing.lg,
              bottom: AppSpacing.lg,
              child: _ImpactCard(),
            ),
          ],
        ),
      ),
    );
  }
}

class _BackgroundImage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return Image.asset(
      HeroWorkshopVisual._heroImageAsset,
      fit: BoxFit.cover,
      errorBuilder: (context, error, stackTrace) {
        return DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [colors.backgroundAlt, colors.background],
            ),
          ),
          child: Stack(
            children: [
              const Positioned.fill(child: _AbstractWorkshopPattern()),
            ],
          ),
        );
      },
    );
  }
}

class _ImpactBadge extends StatelessWidget {
  const _ImpactBadge();

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.surfaceElevated.withValues(alpha: 0.92),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: colors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.auto_awesome, size: 16, color: colors.accentAmber),
          const SizedBox(width: AppSpacing.xs),
          Text(
            'Impact first',
            style: AuthDarkTextStyles.body(
              context,
            ).copyWith(color: colors.textPrimary, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _ImpactCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.xl,
        AppSpacing.lg,
        AppSpacing.lg,
      ),
      decoration: BoxDecoration(
        color: colors.surfaceGlass,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: colors.borderStrong),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: colors.primarySoft,
                  borderRadius: AppRadius.mdAll,
                ),
                child: Icon(
                  Icons.eco_rounded,
                  color: colors.accentMint,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Make an impact',
                      style: AuthDarkTextStyles.title(
                        context,
                      ).copyWith(color: colors.textPrimary, fontSize: 22),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Every successful reuse turns overlooked materials into '
                      'projects, prototypes, and practical learning.',
                      style: AuthDarkTextStyles.body(
                        context,
                      ).copyWith(color: colors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          LayoutBuilder(
            builder: (context, constraints) {
              final stacked = constraints.maxWidth < 360;

              if (stacked) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _PrimaryMetric(maxWidth: constraints.maxWidth),
                    const SizedBox(height: AppSpacing.md),
                    const _ImpactTrendCard(),
                  ],
                );
              }

              return Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    flex: 6,
                    child: _PrimaryMetric(maxWidth: constraints.maxWidth),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  const Expanded(flex: 4, child: _ImpactTrendCard()),
                ],
              );
            },
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: const [
              _MiniStatPill(label: 'Learners', value: '1.8k'),
              _MiniStatPill(label: 'Suppliers', value: '320'),
              _MiniStatPill(label: 'Saved kg', value: '46t'),
            ],
          ),
        ],
      ),
    );
  }
}

class _PrimaryMetric extends StatelessWidget {
  const _PrimaryMetric({required this.maxWidth});

  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Materials reused',
          style: AuthDarkTextStyles.label(
            context,
          ).copyWith(color: colors.textMuted),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          '12,584+',
          style: AuthDarkTextStyles.display(context).copyWith(
            color: colors.textPrimary,
            fontSize: maxWidth < 360 ? 34 : 42,
            height: 1.0,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        const _ImpactBar(),
      ],
    );
  }
}

class _ImpactTrendCard extends StatelessWidget {
  const _ImpactTrendCard();

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Monthly lift',
            style: AuthDarkTextStyles.label(
              context,
            ).copyWith(color: colors.textMuted),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '+18%',
            style: AuthDarkTextStyles.title(
              context,
            ).copyWith(fontSize: 28, color: colors.accentMint),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Momentum from workshop and campus reuse activity.',
            style: AuthDarkTextStyles.body(
              context,
            ).copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _ImpactBar extends StatelessWidget {
  const _ImpactBar();

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.border),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            constraints.maxWidth < 220
                ? Text(
                    'Reuse trend',
                    style: AuthDarkTextStyles.label(
                      context,
                    ).copyWith(color: colors.accentMint),
                  )
                : Row(
                    children: [
                      Text(
                        'Reuse trend',
                        style: AuthDarkTextStyles.label(
                          context,
                        ).copyWith(color: colors.textMuted),
                      ),
                      const Spacer(),
                      Flexible(
                        child: Text(
                          'Steady growth',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.end,
                          style: AuthDarkTextStyles.label(
                            context,
                          ).copyWith(color: colors.accentMint),
                        ),
                      ),
                    ],
                  ),
            const SizedBox(height: AppSpacing.sm),
            const Expanded(child: _ImpactTrendLine()),
          ],
        ),
      ),
    );
  }
}

class _ImpactTrendLine extends StatelessWidget {
  const _ImpactTrendLine();

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return Stack(
      alignment: Alignment.centerLeft,
      children: [
        Container(
          height: 6,
          decoration: BoxDecoration(
            color: colors.border.withValues(alpha: 0.55),
            borderRadius: AppRadius.pillAll,
          ),
        ),
        FractionallySizedBox(
          widthFactor: 0.84,
          child: Container(
            height: 6,
            decoration: BoxDecoration(
              borderRadius: AppRadius.pillAll,
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [
                  colors.accentMint.withValues(alpha: 0.45),
                  colors.accentMint,
                ],
              ),
            ),
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: const [
            _TrendDot(active: true),
            _TrendDot(active: true),
            _TrendDot(active: true),
            _TrendDot(active: true),
            _TrendDot(active: true),
            _TrendDot(active: false),
          ],
        ),
      ],
    );
  }
}

class _TrendDot extends StatelessWidget {
  const _TrendDot({required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return Container(
      width: active ? 10 : 8,
      height: active ? 10 : 8,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: active
            ? colors.accentMint
            : colors.textMuted.withValues(alpha: 0.45),
        border: Border.all(
          color: active
              ? colors.textPrimary.withValues(alpha: 0.2)
              : Colors.transparent,
        ),
      ),
    );
  }
}

class _MiniStatPill extends StatelessWidget {
  const _MiniStatPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: colors.border),
      ),
      child: RichText(
        text: TextSpan(
          style: AuthDarkTextStyles.body(
            context,
          ).copyWith(color: colors.textSecondary),
          children: [
            TextSpan(
              text: '$value ',
              style: AuthDarkTextStyles.body(context).copyWith(
                color: colors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            TextSpan(text: label),
          ],
        ),
      ),
    );
  }
}

class _AbstractWorkshopPattern extends StatelessWidget {
  const _AbstractWorkshopPattern();

  @override
  Widget build(BuildContext context) {
    final colors = LandingColors.of(context);

    return Stack(
      children: [
        Positioned(
          top: 60,
          left: 48,
          child: Container(
            width: 110,
            height: 110,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: colors.accentMint.withValues(alpha: 0.16),
            ),
          ),
        ),
        Positioned(
          top: 130,
          right: 36,
          child: Container(
            width: 160,
            height: 160,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: colors.primary.withValues(alpha: 0.18),
            ),
          ),
        ),
        Positioned(
          left: 36,
          right: 36,
          bottom: 120,
          child: Container(
            height: 1,
            color: colors.borderStrong.withValues(alpha: 0.28),
          ),
        ),
      ],
    );
  }
}
