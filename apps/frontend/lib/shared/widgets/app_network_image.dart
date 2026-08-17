import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/config/api_config.dart';

/// Loads a public backend/CDN image after resolving relative API asset paths.
class AppNetworkImage extends StatelessWidget {
  const AppNetworkImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.cacheWidth,
    this.cacheHeight,
    this.filterQuality,
    this.loadingBuilder,
    this.errorBuilder,
  });

  final String? url;
  final BoxFit fit;
  final double? width;
  final double? height;
  final int? cacheWidth;
  final int? cacheHeight;
  final FilterQuality? filterQuality;
  final ImageLoadingBuilder? loadingBuilder;
  final ImageErrorWidgetBuilder? errorBuilder;

  @override
  Widget build(BuildContext context) {
    final resolved = ApiConfig.resolveApiAssetUrl(url);
    if (resolved == null) {
      return errorBuilder?.call(context, 'Missing image URL', StackTrace.empty) ??
          const SizedBox.shrink();
    }

    return Image.network(
      resolved,
      fit: fit,
      width: width,
      height: height,
      cacheWidth: cacheWidth,
      cacheHeight: cacheHeight,
      filterQuality: filterQuality ?? FilterQuality.low,
      loadingBuilder: loadingBuilder,
      errorBuilder: (context, error, stackTrace) {
        if (kDebugMode) {
          debugPrint('Image failed: $resolved\n$error');
        }
        return errorBuilder?.call(context, error, stackTrace) ??
            const SizedBox.shrink();
      },
    );
  }
}
