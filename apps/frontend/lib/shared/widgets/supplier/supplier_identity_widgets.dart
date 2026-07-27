import 'package:flutter/material.dart';

import '../../../app/theme/app_spacing.dart';
import '../../../core/config/api_config.dart';
import '../materials/materials_ui_palette.dart';

String supplierIdentityInitial(String displayName) {
  final trimmed = displayName.trim();
  if (trimmed.isEmpty) {
    return 'S';
  }

  return trimmed.characters.first.toUpperCase();
}

class SupplierIdentityAvatar extends StatelessWidget {
  const SupplierIdentityAvatar({
    super.key,
    required this.displayName,
    this.avatarUrl,
    this.radius = 14,
    this.borderColor,
    this.borderWidth = 0,
  });

  final String displayName;
  final String? avatarUrl;
  final double radius;
  final Color? borderColor;
  final double borderWidth;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final resolvedAvatar = avatarUrl?.trim();
    final hasImage = resolvedAvatar != null && resolvedAvatar.isNotEmpty;

    final avatar = CircleAvatar(
      radius: radius,
      backgroundColor: palette.mint.withValues(alpha: 0.14),
      foregroundImage: hasImage
          ? NetworkImage(ApiConfig.resolveMediaUrl(resolvedAvatar!))
          : null,
      child: hasImage
          ? null
          : Text(
              supplierIdentityInitial(displayName),
              style: TextStyle(
                fontSize: radius * 0.72,
                fontWeight: FontWeight.w800,
                color: palette.mint,
                height: 1,
              ),
            ),
    );

    if (borderWidth <= 0) {
      return avatar;
    }

    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: borderColor ?? palette.cardSurface,
          width: borderWidth,
        ),
      ),
      child: avatar,
    );
  }
}

class SupplierAttributionRow extends StatelessWidget {
  const SupplierAttributionRow({
    super.key,
    required this.displayName,
    this.avatarUrl,
    this.isVerified = false,
    this.compact = false,
    this.onTap,
    this.showChevron = true,
  });

  final String displayName;
  final String? avatarUrl;
  final bool isVerified;
  final bool compact;
  final VoidCallback? onTap;
  final bool showChevron;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    final avatarRadius = compact ? 13.0 : 14.0;

    final row = Row(
      children: [
        SupplierIdentityAvatar(
          displayName: displayName,
          avatarUrl: avatarUrl,
          radius: avatarRadius,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Row(
            children: [
              Flexible(
                child: Text(
                  displayName,
                  style: textTheme.labelMedium?.copyWith(
                    color: palette.textPrimary,
                    fontSize: compact ? 12 : 13,
                    fontWeight: FontWeight.w700,
                    height: 1.1,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (isVerified) ...[
                const SizedBox(width: 4),
                Icon(
                  Icons.verified_rounded,
                  size: compact ? 14 : 16,
                  color: palette.mint,
                ),
              ],
            ],
          ),
        ),
        if (onTap != null && showChevron)
          Icon(
            Icons.chevron_right_rounded,
            size: compact ? 16 : 18,
            color: palette.textMuted,
          ),
      ],
    );

    if (onTap == null) {
      return row;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: row,
      ),
    );
  }
}
