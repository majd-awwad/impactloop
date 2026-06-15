import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_decorations.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/widgets/impact_loop_logo.dart';

enum AuthEntryBrandingVariant { login, register }

class AuthEntryBrandingPanel extends StatelessWidget {
  const AuthEntryBrandingPanel({
    super.key,
    required this.variant,
    this.compact = false,
    this.minimal = false,
  });

  final AuthEntryBrandingVariant variant;
  final bool compact;
  final bool minimal;

  static const _features = [
    (Icons.search_rounded, 'Find usable parts'),
    (Icons.inventory_2_outlined, 'Share surplus materials'),
    (Icons.eco_outlined, 'Build with less waste'),
  ];

  String get _headlineMiddle => switch (variant) {
        AuthEntryBrandingVariant.login => 'Reuse',
        AuthEntryBrandingVariant.register => 'Share',
      };

  String get _description => switch (variant) {
        AuthEntryBrandingVariant.login =>
          'Sign in to pick up where your materials, projects, and community activity left off.',
        AuthEntryBrandingVariant.register =>
          'Create one account to source components, list surplus materials, or do both in one streamlined flow.',
      };

  String get _spotlightLabel => switch (variant) {
        AuthEntryBrandingVariant.login => 'Return to your workspace',
        AuthEntryBrandingVariant.register => 'Start your ImpactLoop profile',
      };

  @override
  Widget build(BuildContext context) {
    final padding = minimal
        ? AppSpacing.md
        : compact
        ? AppSpacing.lg
        : AppSpacing.xl;

    return Container(
      padding: EdgeInsets.all(padding),
      decoration: BoxDecoration(
        gradient: AuthDarkDecorations.brandingGradient,
        borderRadius: compact ? AppRadius.lgAll : AppRadius.xlAll,
        border: Border.all(color: AuthDarkColors.border),
        boxShadow: [
          BoxShadow(
            color: AuthDarkColors.blobPrimary.withValues(alpha: 0.08),
            blurRadius: compact ? 14 : 22,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Stack(
        children: [
          ...AuthDarkDecorations.backgroundBlobs(compact: compact),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ImpactLoopLogo(compact: compact, showWordmark: !minimal),
              SizedBox(
                height: minimal
                    ? AppSpacing.sm
                    : compact
                    ? AppSpacing.md
                    : AppSpacing.xl,
              ),
              if (!minimal) ...[
                _Eyebrow(label: _spotlightLabel),
                const SizedBox(height: AppSpacing.md),
              ],
              _Headline(
                middle: _headlineMiddle,
                compact: compact,
                minimal: minimal,
              ),
              SizedBox(height: minimal ? AppSpacing.sm : AppSpacing.md),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: Text(
                  _description,
                  maxLines: minimal ? 2 : null,
                  overflow: minimal ? TextOverflow.ellipsis : TextOverflow.visible,
                  style: compact
                      ? AuthDarkTextStyles.body(context).copyWith(
                          color: AuthDarkColors.textPrimary.withValues(alpha: 0.82),
                        )
                      : AuthDarkTextStyles.brandingSubtitle(context).copyWith(
                          color: AuthDarkColors.textPrimary.withValues(alpha: 0.82),
                        ),
                ),
              ),
              if (minimal) ...[
                const SizedBox(height: AppSpacing.md),
                _FeatureChip(
                  icon: _features.first.$1,
                  label: _features.first.$2,
                  compact: true,
                ),
              ] else ...[
                const SizedBox(height: AppSpacing.lg),
                if (compact)
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        for (final feature in _features) ...[
                          _FeatureChip(icon: feature.$1, label: feature.$2),
                          const SizedBox(width: AppSpacing.sm),
                        ],
                      ],
                    ),
                  )
                else
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      for (final feature in _features)
                        _FeatureChip(icon: feature.$1, label: feature.$2),
                    ],
                  ),
                const SizedBox(height: AppSpacing.lg),
                if (compact)
                  const _CompactSignalCard()
                else ...[
                  const _SignalStage(),
                  const SizedBox(height: AppSpacing.lg),
                  _MissionStrip(variant: variant),
                ],
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _Eyebrow extends StatelessWidget {
  const _Eyebrow({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: AuthDarkColors.chipUnselected,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: AuthDarkColors.border),
      ),
      child: Text(
        label,
        style: AuthDarkTextStyles.label(context).copyWith(
          color: AuthDarkColors.accent,
        ),
      ),
    );
  }
}

class _Headline extends StatelessWidget {
  const _Headline({
    required this.middle,
    this.compact = false,
    this.minimal = false,
  });

  final String middle;
  final bool compact;
  final bool minimal;

  @override
  Widget build(BuildContext context) {
    return RichText(
      text: TextSpan(
        style: AuthDarkTextStyles.brandingHeadline(context).copyWith(
          fontSize: minimal ? 24 : compact ? 28 : 42,
          height: 1.08,
          letterSpacing: minimal ? -0.8 : compact ? -1.0 : -1.2,
        ),
        children: [
          const TextSpan(text: 'Learn. '),
          TextSpan(
            text: '$middle. ',
            style: const TextStyle(color: AuthDarkColors.accent),
          ),
          const TextSpan(text: 'Build.'),
        ],
      ),
    );
  }
}

class _FeatureChip extends StatelessWidget {
  const _FeatureChip({
    required this.icon,
    required this.label,
    this.compact = false,
  });

  final IconData icon;
  final String label;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? AppSpacing.sm : AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: AuthDarkColors.chipUnselected,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: AuthDarkColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: AuthDarkColors.accent),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            overflow: TextOverflow.ellipsis,
            style: AuthDarkTextStyles.chip(context).copyWith(
              color: AuthDarkColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _SignalStage extends StatelessWidget {
  const _SignalStage();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.86),
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: AuthDarkColors.border),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final stackMetrics = constraints.maxWidth < 500;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (stackMetrics)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    _SignalMetric(
                      label: 'Materials reused',
                      value: '12.5k+',
                      highlight: true,
                    ),
                    SizedBox(height: AppSpacing.md),
                    _SignalMetric(
                      label: 'Projects launched',
                      value: '840+',
                    ),
                  ],
                )
              else
                Row(
                  children: const [
                    Expanded(
                      child: _SignalMetric(
                        label: 'Materials reused',
                        value: '12.5k+',
                        highlight: true,
                      ),
                    ),
                    SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: _SignalMetric(
                        label: 'Projects launched',
                        value: '840+',
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: AppSpacing.lg),
              Container(
                height: 150,
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.md,
                  AppSpacing.md,
                  AppSpacing.md,
                ),
                decoration: BoxDecoration(
                  color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.94),
                  borderRadius: AppRadius.lgAll,
                  border: Border.all(color: AuthDarkColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      alignment: WrapAlignment.spaceBetween,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          'Live impact trend',
                          style: AuthDarkTextStyles.label(context),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.sm,
                            vertical: AppSpacing.xs,
                          ),
                          decoration: BoxDecoration(
                            color: AuthDarkColors.accentSoft,
                            borderRadius: AppRadius.pillAll,
                          ),
                          child: Text(
                            '+18% this month',
                            style: AuthDarkTextStyles.label(context).copyWith(
                              color: AuthDarkColors.accent,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Expanded(
                      child: Stack(
                        children: [
                          Positioned(
                            left: 0,
                            right: 0,
                            bottom: 12,
                            child: Container(
                              height: 2,
                              color: AuthDarkColors.border,
                            ),
                          ),
                          Positioned.fill(
                            child: Padding(
                              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                              child: CustomPaint(
                                painter: _SignalLinePainter(),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _CompactSignalCard extends StatelessWidget {
  const _CompactSignalCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.88),
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: AuthDarkColors.border),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final stack = constraints.maxWidth < 360;

          if (stack) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SignalMetric(
                  label: 'Materials reused',
                  value: '12.5k+',
                  highlight: true,
                ),
                const SizedBox(height: AppSpacing.sm),
                _TrendPill(label: '+18% month'),
              ],
            );
          }

          return Row(
            children: [
              const Expanded(
                child: _SignalMetric(
                  label: 'Materials reused',
                  value: '12.5k+',
                  highlight: true,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              _TrendPill(label: '+18% month'),
            ],
          );
        },
      ),
    );
  }
}

class _TrendPill extends StatelessWidget {
  const _TrendPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: AuthDarkColors.accentSoft,
        borderRadius: AppRadius.pillAll,
      ),
      child: Text(
        label,
        style: AuthDarkTextStyles.label(context).copyWith(
          color: AuthDarkColors.accent,
        ),
      ),
    );
  }
}

class _SignalMetric extends StatelessWidget {
  const _SignalMetric({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: AuthDarkTextStyles.label(context),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          value,
          style: AuthDarkTextStyles.title(context).copyWith(
            fontSize: 24,
            color: highlight
                ? AuthDarkColors.accent
                : AuthDarkColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

class _MissionStrip extends StatelessWidget {
  const _MissionStrip({required this.variant});

  final AuthEntryBrandingVariant variant;

  @override
  Widget build(BuildContext context) {
    final message = switch (variant) {
      AuthEntryBrandingVariant.login =>
        'Pick up your materials, project ideas, and reuse activity with a clearer, faster workspace.',
      AuthEntryBrandingVariant.register =>
        'Join students, suppliers, and makers turning overlooked materials into practical opportunities.',
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AuthDarkColors.accentSoft.withValues(alpha: 0.9),
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: AuthDarkColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.eco, color: AuthDarkColors.accent, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: AuthDarkTextStyles.body(context).copyWith(
                color: AuthDarkColors.textPrimary.withValues(alpha: 0.9),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SignalLinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          AuthDarkColors.accent.withValues(alpha: 0.34),
          AuthDarkColors.accent.withValues(alpha: 0.02),
        ],
      ).createShader(Offset.zero & size);

    final strokePaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [
          AuthDarkColors.accentMuted,
          AuthDarkColors.accent,
          AuthDarkColors.textPrimary,
        ],
      ).createShader(Offset.zero & size)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    final path = Path()
      ..moveTo(0, size.height * 0.88)
      ..cubicTo(
        size.width * 0.16,
        size.height * 0.72,
        size.width * 0.28,
        size.height * 0.82,
        size.width * 0.42,
        size.height * 0.56,
      )
      ..cubicTo(
        size.width * 0.58,
        size.height * 0.3,
        size.width * 0.72,
        size.height * 0.42,
        size.width,
        size.height * 0.08,
      );

    final fillPath = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();

    canvas.drawPath(fillPath, fillPaint);
    canvas.drawPath(path, strokePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
