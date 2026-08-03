import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';

/// Bundled driver portal illustration paths under [assets/driver/].
abstract final class DriverAssetPaths {
  static const readyVan = 'assets/driver/driver_ready_van.png';
  static const sidebarRoute = 'assets/driver/driver_sidebar_route.png';
  static const emptyDeliveries = 'assets/driver/driver_empty_deliveries.png';
  static const locationMap = 'assets/driver/driver_location_map.png';
}

/// Driver illustration with graceful fallback when an asset is missing.
class DriverAssetImage extends StatelessWidget {
  const DriverAssetImage({
    super.key,
    required this.assetPath,
    this.height,
    this.width,
    this.fallbackIcon = Icons.image_not_supported_outlined,
    this.excludeFromSemantics = true,
    this.semanticLabel,
  });

  final String assetPath;
  final double? height;
  final double? width;
  final IconData fallbackIcon;
  final bool excludeFromSemantics;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final fallbackSize = (height ?? width ?? 96).clamp(32, 160).toDouble();

    Widget image = Image.asset(
      assetPath,
      height: height,
      width: width,
      fit: BoxFit.contain,
      excludeFromSemantics: excludeFromSemantics,
      semanticLabel: semanticLabel,
      errorBuilder: (context, error, stackTrace) {
        return _FallbackIcon(
          icon: fallbackIcon,
          size: fallbackSize,
          color: palette.textMuted,
        );
      },
    );

    if (height != null || width != null) {
      image = SizedBox(
        height: height,
        width: width,
        child: Center(child: image),
      );
    }

    return image;
  }
}

class _FallbackIcon extends StatelessWidget {
  const _FallbackIcon({
    required this.icon,
    required this.size,
    required this.color,
  });

  final IconData icon;
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Icon(icon, size: size, color: color),
    );
  }
}
