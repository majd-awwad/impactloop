import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/api_config.dart';
import '../../core/network/api_client.dart';

/// Loads an image from an authenticated API route (Bearer token via Dio).
class AuthenticatedNetworkImage extends ConsumerStatefulWidget {
  const AuthenticatedNetworkImage({
    required this.url,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.errorBuilder,
    super.key,
  });

  final String url;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Widget Function(BuildContext context)? errorBuilder;

  @override
  ConsumerState<AuthenticatedNetworkImage> createState() =>
      _AuthenticatedNetworkImageState();
}

class _AuthenticatedNetworkImageState
    extends ConsumerState<AuthenticatedNetworkImage> {
  Uint8List? _bytes;
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant AuthenticatedNetworkImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      _bytes = null;
      _failed = false;
      _loading = true;
      _load();
    }
  }

  Future<void> _load() async {
    final trimmed = widget.url.trim();
    if (trimmed.isEmpty) {
      if (mounted) {
        setState(() {
          _loading = false;
          _failed = true;
        });
      }
      return;
    }

    try {
      final response = await ref.read(apiClientProvider).get<List<int>>(
        trimmed,
        options: Options(
          responseType: ResponseType.bytes,
          sendTimeout: const Duration(seconds: 60),
          receiveTimeout: const Duration(seconds: 60),
          headers: {'Accept': '*/*'},
        ),
      );
      final data = response.data;
      if (!mounted) {
        return;
      }
      if (data == null || data.isEmpty) {
        setState(() {
          _loading = false;
          _failed = true;
          _bytes = null;
        });
        return;
      }
      setState(() {
        _bytes = Uint8List.fromList(data);
        _loading = false;
        _failed = false;
      });
    } catch (error) {
      if (kDebugMode) {
        debugPrint('Image failed: $trimmed\n$error');
      }
      if (mounted) {
        setState(() {
          _bytes = null;
          _loading = false;
          _failed = true;
        });
      }
    }
  }

  Widget _buildError(BuildContext context) {
    if (widget.errorBuilder != null) {
      return widget.errorBuilder!(context);
    }

    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: const ColoredBox(color: Colors.black12),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _bytes == null) {
      return SizedBox(
        width: widget.width,
        height: widget.height,
        child: const Center(
          child: SizedBox.square(
            dimension: 22,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    if (_failed || _bytes == null) {
      return _buildError(context);
    }

    return Image.memory(
      _bytes!,
      width: widget.width,
      height: widget.height,
      fit: widget.fit,
      errorBuilder: (_, _, _) => _buildError(context),
    );
  }
}

/// Renders public `/uploads/*` media or authenticated `/api/*` media.
class ProtectedMediaImage extends ConsumerWidget {
  const ProtectedMediaImage({
    required this.url,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.errorBuilder,
    super.key,
  });

  final String url;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Widget Function(BuildContext context)? errorBuilder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final trimmed = url.trim();
    if (trimmed.isEmpty) {
      return errorBuilder?.call(context) ??
          SizedBox(
            width: width,
            height: height,
            child: const ColoredBox(color: Colors.black12),
          );
    }

    if (trimmed.startsWith('/api/')) {
      return AuthenticatedNetworkImage(
        url: trimmed,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: errorBuilder,
      );
    }

    return Image.network(
      ApiConfig.resolveMediaUrl(trimmed),
      width: width,
      height: height,
      fit: fit,
      errorBuilder: (context, error, stackTrace) {
        if (kDebugMode) {
          debugPrint(
            'Image failed: ${ApiConfig.resolveMediaUrl(trimmed)}\n$error',
          );
        }
        return errorBuilder?.call(context) ??
            SizedBox(
              width: width,
              height: height,
              child: const ColoredBox(color: Colors.black12),
            );
      },
    );
  }
}
