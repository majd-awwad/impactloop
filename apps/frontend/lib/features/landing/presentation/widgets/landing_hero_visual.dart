import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_decorations.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';

/// Hero workshop photo with a glass stats overlay.
class LandingHeroVisual extends StatelessWidget {
  const LandingHeroVisual({super.key});

  static const _heroImageAsset = '../../../../assets/images/landing/hero_workshop.png';

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.xlAll,
      child: Stack(
        children: [
          AspectRatio(
            aspectRatio: 4 / 3,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.asset(
                  _heroImageAsset,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            AuthDarkColors.surfaceSolid,
                            AuthDarkColors.backgroundElevated,
                          ],
                        ),
                        border: Border.all(color: AuthDarkColors.border),
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.image_not_supported_outlined,
                          color: AuthDarkColors.textMuted,
                          size: 48,
                        ),
                      ),
                    );
                  },
                ),
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        AuthDarkColors.background.withValues(alpha: 0.15),
                        AuthDarkColors.background.withValues(alpha: 0.72),
                      ],
                      stops: const [0.45, 0.72, 1.0],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            left: AppSpacing.md,
            right: AppSpacing.md,
            bottom: AppSpacing.md,
            child: AuthDarkDecorations.glassSurface(
              borderRadius: AppRadius.lgAll,
              padding: const EdgeInsets.all(AppSpacing.md),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final stacked = constraints.maxWidth < 340;

                  if (stacked) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _impactBlurbSection(context),
                        const SizedBox(height: AppSpacing.md),
                        _statsSection(context),
                      ],
                    );
                  }

                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: _impactBlurbSection(context)),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(child: _statsSection(context)),
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _impactBlurbSection(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AuthDarkColors.accentSoft,
            boxShadow: [
              BoxShadow(
                color: AuthDarkColors.accent.withValues(alpha: 0.25),
                blurRadius: 16,
              ),
            ],
          ),
          child: const Icon(
            Icons.eco,
            color: AuthDarkColors.accent,
            size: 22,
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Make an impact',
                style: AuthDarkTextStyles.title(context).copyWith(fontSize: 16),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Every reuse helps reduce waste and build a better tomorrow.',
                style: AuthDarkTextStyles.body(context),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _statsSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Materials reused',
          style: AuthDarkTextStyles.label(context),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          '12,584+',
          style: AuthDarkTextStyles.display(context).copyWith(
            fontSize: 28,
            color: AuthDarkColors.textPrimary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: Container(
                height: 28,
                decoration: BoxDecoration(
                  borderRadius: AppRadius.smAll,
                  gradient: LinearGradient(
                    colors: [
                      AuthDarkColors.accent.withValues(alpha: 0.15),
                      AuthDarkColors.accent.withValues(alpha: 0.65),
                    ],
                  ),
                ),
                child: CustomPaint(
                  painter: _SparklinePainter(),
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              '+18% this month',
              style: AuthDarkTextStyles.label(context).copyWith(
                color: AuthDarkColors.accent,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _SparklinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AuthDarkColors.textOnAccent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;

    final path = Path()
      ..moveTo(0, size.height * 0.75)
      ..lineTo(size.width * 0.2, size.height * 0.55)
      ..lineTo(size.width * 0.45, size.height * 0.62)
      ..lineTo(size.width * 0.65, size.height * 0.35)
      ..lineTo(size.width, size.height * 0.2);

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
