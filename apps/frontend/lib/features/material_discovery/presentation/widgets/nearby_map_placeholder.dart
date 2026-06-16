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
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: materialMapSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: materialBorderStrong),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.resolve(context),
            style: AppTextStyles.title(
              context,
            ).copyWith(color: materialTextPrimary),
            textAlign: TextAlign.start,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            subtitle.resolve(context),
            style: AppTextStyles.subtitle(
              context,
            ).copyWith(color: materialTextSecondary),
            textAlign: TextAlign.start,
          ),
          const SizedBox(height: AppSpacing.md),
          Container(
            height: 240,
            decoration: BoxDecoration(
              borderRadius: AppRadius.lgAll,
              gradient: const LinearGradient(
                begin: AlignmentDirectional.topStart,
                end: AlignmentDirectional.bottomEnd,
                colors: [materialSectionBackground, materialCardSurfaceAlt],
              ),
              border: Border.all(color: materialBorderStrong),
            ),
            child: Stack(
              children: [
                Positioned.fill(
                  child: CustomPaint(painter: _MapGridPainter()),
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
                          color: materialMint.withValues(alpha: 0.12),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: materialMint.withValues(alpha: 0.24),
                          ),
                        ),
                        child: const Icon(
                          Icons.location_searching_rounded,
                          color: materialMint,
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
                        ).copyWith(color: materialTextPrimary),
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
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.22),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: materialBorderStrong),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(
          context,
        ).copyWith(color: materialTextPrimary, fontSize: 12),
        textAlign: TextAlign.start,
      ),
    );
  }
}

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = materialMapGrid
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
