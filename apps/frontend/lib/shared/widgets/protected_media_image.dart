import 'dart:typed_data';

import 'package:dio/dio.dart';
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
      _load();
    }
  }

  Future<void> _load() async {
    final trimmed = widget.url.trim();
    if (trimmed.isEmpty) {
      return;
    }

    try {
      final response = await ref.read(apiClientProvider).get<List<int>>(
        trimmed,
        options: Options(
          responseType: ResponseType.bytes,
          headers: {'Accept': '*/*'},
        ),
      );
      final data = response.data;
      if (!mounted || data == null) {
        return;
      }
      setState(() => _bytes = Uint8List.fromList(data));
    } catch (_) {
      if (mounted) {
        setState(() => _bytes = null);
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
    if (_bytes == null) {
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
      errorBuilder: (_, _, _) =>
          errorBuilder?.call(context) ??
          SizedBox(
            width: width,
            height: height,
            child: const ColoredBox(color: Colors.black12),
          ),
    );
  }
}
