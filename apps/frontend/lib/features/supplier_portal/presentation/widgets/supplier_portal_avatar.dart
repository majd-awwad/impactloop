import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../controllers/supplier_avatar_providers.dart';
import '../theme/supplier_theme_extension.dart';

class SupplierPortalAvatar extends ConsumerWidget {
  const SupplierPortalAvatar({
    super.key,
    required this.displayName,
    this.size = 40,
    this.fontSize,
  });

  final String displayName;
  final double size;
  final double? fontSize;

  String get _initial {
    final trimmed = displayName.trim();
    return trimmed.isEmpty ? 'S' : trimmed.characters.first.toUpperCase();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;
    final avatarUrl = ref.watch(supplierDisplayAvatarUrlProvider);
    final resolvedFontSize = fontSize ?? (size * 0.38);

    if (avatarUrl != null) {
      return Container(
        width: size,
        height: size,
        decoration: decorations.avatarCircle,
        clipBehavior: Clip.antiAlias,
        child: Image.network(
          avatarUrl,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => _initials(colors, resolvedFontSize),
        ),
      );
    }

    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: decorations.avatarCircle,
      child: _initials(colors, resolvedFontSize),
    );
  }

  Widget _initials(SupplierUiPalette colors, double resolvedFontSize) {
    return Text(
      _initial,
      style: TextStyle(
        color: colors.accent,
        fontWeight: FontWeight.w700,
        fontSize: resolvedFontSize,
      ),
    );
  }
}
