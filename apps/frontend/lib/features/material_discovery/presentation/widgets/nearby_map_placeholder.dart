import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';

class NearbyMapPlaceholder extends StatelessWidget {
  const NearbyMapPlaceholder({
    super.key,
    required this.title,
    required this.subtitle,
  });

  final LocalizedText title;
  final LocalizedText subtitle;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.resolve(context),
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
            textAlign: TextAlign.start,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            subtitle.resolve(context),
            style: AppTextStyles.subtitle(
              context,
            ).copyWith(color: palette.textSecondary),
            textAlign: TextAlign.start,
          ),
          const SizedBox(height: AppSpacing.md),
          Container(
            height: 240,
            decoration: BoxDecoration(
              borderRadius: AppRadius.lgAll,
              gradient: LinearGradient(
                begin: AlignmentDirectional.topStart,
                end: AlignmentDirectional.bottomEnd,
                colors: [palette.cardSurfaceAlt, palette.mutedSurface],
              ),
              border: Border.all(color: palette.borderStrong),
            ),
            child: Stack(
              children: [
                Positioned.fill(
                  child: CustomPaint(
                    painter: _MapGridPainter(
                      color: palette.borderSubtle.withValues(alpha: 0.72),
                    ),
                  ),
                ),
                Align(
                  alignment: AlignmentDirectional.center,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: palette.mint.withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: palette.mint.withValues(alpha: 0.24),
                          ),
                        ),
                        child: Icon(
                          Icons.location_searching_rounded,
                          color: palette.mint,
                          size: 32,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        LocalizedText(
                          en: 'Nearby discovery map placeholder',
                          ar: 'عنصر خريطة المواد القريبة',
                        ).resolve(context),
                        style: AppTextStyles.title(
                          context,
                        ).copyWith(color: palette.textPrimary),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
                PositionedDirectional(
                  top: 18,
                  start: 18,
                  child: _MapChip(
                    label: LocalizedText(
                      en: 'Radius: 5 km',
                      ar: 'النطاق: 5 كم',
                    ).resolve(context),
                  ),
                ),
                PositionedDirectional(
                  bottom: 18,
                  end: 18,
                  child: _MapChip(
                    label: LocalizedText(
                      en: 'Public coordinates hidden',
                      ar: 'الإحداثيات العامة مخفية',
                    ).resolve(context),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MapChip extends StatelessWidget {
  const _MapChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.cardSurface.withValues(alpha: 0.86),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(
          context,
        ).copyWith(color: palette.textPrimary, fontSize: 12),
        textAlign: TextAlign.start,
      ),
    );
  }
}

class _MapGridPainter extends CustomPainter {
  const _MapGridPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    const step = 28.0;

    for (double x = 0; x <= size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }

    for (double y = 0; y <= size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
