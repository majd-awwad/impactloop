import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../core/config/api_config.dart';
import '../../../../../shared/widgets/app_network_image.dart';
import '../../../application/smart_build_plan_material_images.dart';
import '../../theme/learning_ui_palette.dart';

class SmartBuildPlanMaterialThumbnail extends ConsumerWidget {
  const SmartBuildPlanMaterialThumbnail({
    super.key,
    required this.materialId,
    this.imageUrl,
    this.size = 72,
  });

  final String materialId;
  final String? imageUrl;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = LearningUiPalette.of(context);
    final directUrl = _normalizeUrl(imageUrl);
    final fetchedUrl = directUrl == null
        ? ref
              .watch(smartBuildPlanMaterialImageProvider(materialId))
              .maybeWhen(
                data: (value) => _normalizeUrl(value),
                orElse: () => null,
              )
        : null;
    final resolvedUrl = directUrl ?? fetchedUrl;

    return ClipRRect(
      borderRadius: AppRadius.mdAll,
      child: Container(
        width: size,
        height: size,
        color: palette.mutedChip,
        child: resolvedUrl == null
            ? Icon(
                Icons.inventory_2_outlined,
                color: palette.textSecondary,
                size: size * 0.38,
              )
            : AppNetworkImage(
                url: resolvedUrl,
                fit: BoxFit.cover,
                cacheWidth: (size * MediaQuery.devicePixelRatioOf(context))
                    .round(),
                loadingBuilder: (context, child, progress) {
                  if (progress == null) {
                    return child;
                  }
                  return Center(
                    child: SizedBox.square(
                      dimension: size * 0.28,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: palette.textSecondary,
                      ),
                    ),
                  );
                },
                errorBuilder: (_, _, _) => Icon(
                  Icons.broken_image_outlined,
                  color: palette.textSecondary,
                  size: size * 0.38,
                ),
              ),
      ),
    );
  }

  String? _normalizeUrl(String? value) {
    final trimmed = value?.trim();
    if (trimmed == null || trimmed.isEmpty) {
      return null;
    }
    return ApiConfig.resolveApiAssetUrl(trimmed);
  }
}
