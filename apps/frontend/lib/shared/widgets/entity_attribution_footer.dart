import 'package:flutter/material.dart';

import '../../app/theme/app_spacing.dart';
import 'materials/materials_ui_palette.dart';
import 'supplier/supplier_identity_widgets.dart';

/// The canonical compact identity band used at the bottom of discovery cards.
class EntityAttributionFooter extends StatelessWidget {
  const EntityAttributionFooter({
    super.key,
    required this.displayName,
    this.avatarUrl,
    this.isVerified = false,
    this.compact = false,
    this.onTap,
    this.semanticsLabel,
  });

  final String displayName;
  final String? avatarUrl;
  final bool isVerified;
  final bool compact;
  final VoidCallback? onTap;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final horizontalPadding = compact
        ? AppSpacing.sm + AppSpacing.xs
        : AppSpacing.md;
    final avatarRadius = compact ? 13.0 : 14.0;

    return Material(
      key: const ValueKey('entity-attribution-footer'),
      color: palette.cardSurfaceAlt,
      child: InkWell(
        onTap: onTap,
        child: Semantics(
          button: onTap != null,
          label: semanticsLabel,
          child: Container(
            constraints: const BoxConstraints(minHeight: 44),
            padding: EdgeInsetsDirectional.fromSTEB(
              horizontalPadding,
              AppSpacing.sm,
              horizontalPadding,
              AppSpacing.sm,
            ),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: palette.borderSubtle)),
            ),
            child: Row(
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
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(
                                color: palette.textPrimary,
                                fontSize: compact ? 12 : 13,
                                fontWeight: FontWeight.w700,
                                height: 1.1,
                              ),
                        ),
                      ),
                      if (isVerified) ...[
                        const SizedBox(width: AppSpacing.xs),
                        Icon(
                          Icons.verified_rounded,
                          size: compact ? 14 : 16,
                          color: palette.mint,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
