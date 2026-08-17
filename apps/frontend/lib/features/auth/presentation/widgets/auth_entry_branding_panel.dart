import 'package:flutter/material.dart';

import '../../../../l10n/l10n.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/widgets/impact_loop_logo.dart';
import 'auth_ui_palette.dart';

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

  List<(IconData, String)> _features(AppLocalizations l10n) => [
    (Icons.search_rounded, l10n.authFindUsableParts),
    (Icons.inventory_2_outlined, l10n.landingFeatureShareTitle),
    (Icons.eco_outlined, l10n.landingFeatureBuildTitle),
  ];

  String _headlineMiddle(AppLocalizations l10n) => switch (variant) {
    AuthEntryBrandingVariant.login => l10n.authReuseLabel,
    AuthEntryBrandingVariant.register => l10n.authShareLabel,
  };

  String _description(AppLocalizations l10n) => switch (variant) {
    AuthEntryBrandingVariant.login => l10n.authEntryLoginDescription,
    AuthEntryBrandingVariant.register => l10n.authEntryRegisterDescription,
  };

  String _spotlightLabel(AppLocalizations l10n) => switch (variant) {
    AuthEntryBrandingVariant.login => l10n.authEntryLoginEyebrow,
    AuthEntryBrandingVariant.register => l10n.authEntryRegisterEyebrow,
  };

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final onPanel = _panelTextColor(context);
    final onPanelMuted = _panelMutedColor(context);
    final accent = _panelAccentColor(context);
    final features = _features(l10n);
    final padding = minimal
        ? AppSpacing.md
        : compact
        ? AppSpacing.lg
        : AppSpacing.xl;

    return Container(
      padding: EdgeInsets.all(padding),
      decoration: BoxDecoration(
        gradient: _panelGradient(context),
        borderRadius: compact ? AppRadius.lgAll : AppRadius.xlAll,
        border: Border.all(color: _panelBorderColor(context)),
        boxShadow: [
          BoxShadow(
            color: colors.primary.withValues(alpha: isDark ? 0.18 : 0.12),
            blurRadius: compact ? 14 : 22,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Stack(
        children: [
          ..._panelBlobs(colors: colors, compact: compact, isDark: isDark),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ImpactLoopLogo(
                compact: compact,
                showWordmark: !minimal,
                iconColor: accent,
                iconSurfaceColor: isDark
                    ? colors.primarySoft
                    : colors.surface.withValues(alpha: 0.9),
                borderColor: _panelBorderColor(context),
                textColor: onPanel,
              ),
              SizedBox(
                height: minimal
                    ? AppSpacing.sm
                    : compact
                    ? AppSpacing.md
                    : AppSpacing.xl,
              ),
              if (!minimal) ...[
                _Eyebrow(label: _spotlightLabel(l10n)),
                const SizedBox(height: AppSpacing.md),
              ],
              _Headline(
                middle: _headlineMiddle(l10n),
                compact: compact,
                minimal: minimal,
              ),
              SizedBox(height: minimal ? AppSpacing.sm : AppSpacing.md),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 520),
                child: Text(
                  _description(l10n),
                  maxLines: minimal ? 2 : null,
                  overflow: minimal
                      ? TextOverflow.ellipsis
                      : TextOverflow.visible,
                  style: compact
                      ? _bodyStyle(context, color: onPanelMuted)
                      : _brandingSubtitleStyle(context, color: onPanelMuted),
                ),
              ),
              if (minimal) ...[
                const SizedBox(height: AppSpacing.md),
                _FeatureChip(
                  icon: features.first.$1,
                  label: features.first.$2,
                  compact: true,
                  textColor: onPanel,
                  accentColor: accent,
                ),
              ] else ...[
                const SizedBox(height: AppSpacing.lg),
                if (compact)
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        for (final feature in features) ...[
                          _FeatureChip(
                            icon: feature.$1,
                            label: feature.$2,
                            textColor: onPanel,
                            accentColor: accent,
                          ),
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
                      for (final feature in features)
                        _FeatureChip(
                          icon: feature.$1,
                          label: feature.$2,
                          textColor: onPanel,
                          accentColor: accent,
                        ),
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
        color: _panelSurfaceColor(context),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: _panelBorderColor(context)),
      ),
      child: Text(
        label,
        style: _labelStyle(context, color: _panelAccentColor(context)),
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
    final onPanel = _panelTextColor(context);
    final highlight = _panelHighlightColor(context);

    return RichText(
      text: TextSpan(
        style: _brandingHeadlineStyle(context, color: onPanel).copyWith(
          fontSize: minimal
              ? 24
              : compact
              ? 28
              : 42,
          height: 1.08,
          letterSpacing: minimal
              ? -0.8
              : compact
              ? -1.0
              : -1.2,
        ),
        children: [
          TextSpan(text: '${context.l10n.authLearnLabel}. '),
          TextSpan(
            text: '$middle. ',
            style: TextStyle(color: highlight),
          ),
          TextSpan(text: '${context.l10n.authBuildLabel}.'),
        ],
      ),
    );
  }
}

class _FeatureChip extends StatelessWidget {
  const _FeatureChip({
    required this.icon,
    required this.label,
    required this.textColor,
    required this.accentColor,
    this.compact = false,
  });

  final IconData icon;
  final String label;
  final Color textColor;
  final Color accentColor;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? AppSpacing.sm : AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: _panelSurfaceColor(context),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: _panelBorderColor(context)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: accentColor),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              softWrap: false,
              overflow: TextOverflow.ellipsis,
              style: _chipStyle(context, color: textColor),
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
    final colors = AuthUiPalette.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: _panelSurfaceColor(context),
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: _panelBorderColor(context)),
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
                  children: [
                    _SignalMetric(
                      label: context.l10n.materialsReused,
                      value: '12.5k+',
                      highlight: true,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _SignalMetric(
                      label: context.l10n.authProjectsLaunchedLabel,
                      value: '840+',
                    ),
                  ],
                )
              else
                Row(
                  children: [
                    Expanded(
                      child: _SignalMetric(
                        label: context.l10n.materialsReused,
                        value: '12.5k+',
                        highlight: true,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: _SignalMetric(
                        label: context.l10n.authProjectsLaunchedLabel,
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
                  color: _panelSurfaceColor(context, elevated: true),
                  borderRadius: AppRadius.lgAll,
                  border: Border.all(color: _panelBorderColor(context)),
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
                          context.l10n.authLiveImpactTrend,
                          style: _labelStyle(
                            context,
                            color: _panelMutedColor(context),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.sm,
                            vertical: AppSpacing.xs,
                          ),
                          decoration: BoxDecoration(
                            color: _panelSoftAccentColor(context),
                            borderRadius: AppRadius.pillAll,
                          ),
                          child: Text(
                            context.l10n.authPlus18ThisMonth,
                            style: _labelStyle(
                              context,
                              color: _panelAccentColor(context),
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
                              color: _panelBorderColor(
                                context,
                              ).withValues(alpha: 0.7),
                            ),
                          ),
                          Positioned.fill(
                            child: Padding(
                              padding: const EdgeInsets.only(
                                bottom: AppSpacing.sm,
                              ),
                              child: CustomPaint(
                                painter: _SignalLinePainter(colors: colors),
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
        color: _panelSurfaceColor(context),
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: _panelBorderColor(context)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final stack = constraints.maxWidth < 360;

          if (stack) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SignalMetric(
                  label: context.l10n.materialsReused,
                  value: '12.5k+',
                  highlight: true,
                ),
                const SizedBox(height: AppSpacing.sm),
                _TrendPill(label: context.l10n.authPlus18Month),
              ],
            );
          }

          return Row(
            children: [
              Expanded(
                child: _SignalMetric(
                  label: context.l10n.materialsReused,
                  value: '12.5k+',
                  highlight: true,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              _TrendPill(label: context.l10n.authPlus18Month),
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
        color: _panelSoftAccentColor(context),
        borderRadius: AppRadius.pillAll,
      ),
      child: Text(
        label,
        style: _labelStyle(context, color: _panelAccentColor(context)),
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
          style: _labelStyle(context, color: _panelMutedColor(context)),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          value,
          style: _titleStyle(context).copyWith(
            fontSize: 24,
            color: highlight
                ? _panelAccentColor(context)
                : _panelTextColor(context),
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
      AuthEntryBrandingVariant.login => context.l10n.authEntryLoginMission,
      AuthEntryBrandingVariant.register =>
        context.l10n.authEntryRegisterMission,
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: _panelSoftAccentColor(context),
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: _panelBorderColor(context)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.eco, color: _panelAccentColor(context), size: 20),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: _bodyStyle(
                context,
                color: _panelTextColor(context).withValues(alpha: 0.9),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SignalLinePainter extends CustomPainter {
  const _SignalLinePainter({required this.colors});

  final AuthUiPalette colors;

  @override
  void paint(Canvas canvas, Size size) {
    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          colors.accentMint.withValues(alpha: 0.34),
          colors.accentMint.withValues(alpha: 0.02),
        ],
      ).createShader(Offset.zero & size);

    final strokePaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [colors.primary, colors.accentMint, colors.accentAmber],
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

List<Widget> _panelBlobs({
  required AuthUiPalette colors,
  required bool compact,
  required bool isDark,
}) {
  final size = compact ? 96.0 : 180.0;

  return [
    Positioned(
      top: compact ? -30 : -60,
      right: compact ? -20 : -40,
      child: _Blob(
        size: size,
        color: colors.accentMint.withValues(alpha: isDark ? 0.1 : 0.14),
      ),
    ),
    Positioned(
      bottom: compact ? 40 : 80,
      left: compact ? -40 : -80,
      child: _Blob(
        size: size * 0.85,
        color: colors.accentAmber.withValues(alpha: isDark ? 0.08 : 0.12),
      ),
    ),
    Positioned(
      top: compact ? 100 : 180,
      left: compact ? 40 : 80,
      child: _Blob(
        size: size * 0.55,
        color: colors.primary.withValues(alpha: isDark ? 0.1 : 0.14),
      ),
    ),
  ];
}

Color _panelTextColor(BuildContext context) {
  final colors = AuthUiPalette.of(context);
  return colors.textPrimary;
}

Color _panelMutedColor(BuildContext context) {
  final colors = AuthUiPalette.of(context);
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return isDark
      ? colors.textPrimary.withValues(alpha: 0.74)
      : colors.textSecondary;
}

LinearGradient _panelGradient(BuildContext context) {
  final colors = AuthUiPalette.of(context);
  final isDark = Theme.of(context).brightness == Brightness.dark;

  if (isDark) {
    return LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [colors.panelDark2, colors.panelDark, colors.background],
    );
  }

  return LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [colors.surface, colors.surfaceElevated, colors.primarySoft],
  );
}

Color _panelSurfaceColor(BuildContext context, {bool elevated = false}) {
  final colors = AuthUiPalette.of(context);
  final isDark = Theme.of(context).brightness == Brightness.dark;

  if (isDark) {
    return colors.surface.withValues(alpha: elevated ? 0.24 : 0.18);
  }

  return (elevated ? colors.surface : colors.surfaceElevated).withValues(
    alpha: elevated ? 0.92 : 0.82,
  );
}

Color _panelSoftAccentColor(BuildContext context) {
  final colors = AuthUiPalette.of(context);
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return isDark
      ? colors.primarySoft
      : colors.primarySoft.withValues(alpha: 0.92);
}

Color _panelBorderColor(BuildContext context) {
  final colors = AuthUiPalette.of(context);
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return isDark
      ? colors.borderStrong.withValues(alpha: 0.7)
      : colors.borderStrong;
}

Color _panelAccentColor(BuildContext context) {
  final colors = AuthUiPalette.of(context);
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return isDark ? colors.accentMint : colors.primary;
}

Color _panelHighlightColor(BuildContext context) {
  final colors = AuthUiPalette.of(context);
  final isDark = Theme.of(context).brightness == Brightness.dark;
  return isDark ? colors.accentMint : colors.accentAmber;
}

TextStyle _brandingHeadlineStyle(BuildContext context, {required Color color}) {
  return TextStyle(
    fontSize: 36,
    fontWeight: FontWeight.w800,
    height: 1.15,
    color: color,
    letterSpacing: 0,
  );
}

TextStyle _brandingSubtitleStyle(BuildContext context, {required Color color}) {
  return TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    height: 1.55,
    color: color,
  );
}

TextStyle _titleStyle(BuildContext context) {
  return TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w700,
    height: 1.25,
    color: _panelTextColor(context),
  );
}

TextStyle _bodyStyle(BuildContext context, {required Color color}) {
  return TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    height: 1.45,
    color: color,
  );
}

TextStyle _labelStyle(BuildContext context, {required Color color}) {
  return TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color);
}

TextStyle _chipStyle(BuildContext context, {required Color color}) {
  return TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color);
}

class _Blob extends StatelessWidget {
  const _Blob({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, color: color),
    );
  }
}
