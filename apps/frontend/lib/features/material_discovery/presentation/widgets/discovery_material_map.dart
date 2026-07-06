import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../domain/discovery_material.dart';

class DiscoveryMaterialMap extends StatelessWidget {
  const DiscoveryMaterialMap({
    super.key,
    required this.materials,
    this.onMaterialTap,
  });

  final List<DiscoveryMaterial> materials;
  final ValueChanged<DiscoveryMaterial>? onMaterialTap;

  @override
  Widget build(BuildContext context) {
    final pins = materials
        .where((material) => material.hasApproximatePin)
        .toList();
    if (pins.isEmpty) {
      return const SizedBox.shrink();
    }

    final palette = MaterialsUiPalette.of(context);
    final first = pins.first;
    final center = LatLng(
      first.approximateLatitude!,
      first.approximateLongitude!,
    );

    return Container(
      height: 280,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              AppSpacing.xs,
            ),
            child: Row(
              children: [
                Icon(Icons.map_outlined, color: palette.mint, size: 18),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    const LocalizedText(
                      en: 'Approximate material map',
                      ar: 'خريطة تقريبية للمواد',
                    ).resolve(context),
                    style: AppTextStyles.label(
                      context,
                    ).copyWith(color: palette.textPrimary),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: FlutterMap(
              options: MapOptions(
                initialCenter: center,
                initialZoom: pins.length == 1 ? 12 : 10,
                interactionOptions: const InteractionOptions(
                  flags:
                      InteractiveFlag.drag |
                      InteractiveFlag.pinchZoom |
                      InteractiveFlag.doubleTapZoom,
                ),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.impactloop.frontend',
                ),
                MarkerLayer(
                  markers: pins
                      .map((material) {
                        return Marker(
                          point: LatLng(
                            material.approximateLatitude!,
                            material.approximateLongitude!,
                          ),
                          width: 44,
                          height: 44,
                          child: Tooltip(
                            message: material.title.resolve(context),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(22),
                              onTap: onMaterialTap == null
                                  ? null
                                  : () => onMaterialTap!(material),
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  color: palette.mint,
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(
                                        alpha: 0.18,
                                      ),
                                      blurRadius: 8,
                                      offset: const Offset(0, 3),
                                    ),
                                  ],
                                ),
                                child: const Icon(
                                  Icons.inventory_2_outlined,
                                  color: Colors.white,
                                  size: 22,
                                ),
                              ),
                            ),
                          ),
                        );
                      })
                      .toList(growable: false),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
