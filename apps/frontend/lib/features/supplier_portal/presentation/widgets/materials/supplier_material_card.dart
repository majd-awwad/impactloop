import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../../../shared/widgets/materials/material_price_badge.dart';
import '../../../../../shared/widgets/materials/material_status_badge.dart';
import '../../theme/supplier_theme_extension.dart';

const supplierMaterialCardHeight = 476.0;
const _imageHeight = 184.0;
const _footerHeight = 60.0;

class SupplierMaterialCard extends StatefulWidget {
  const SupplierMaterialCard({
    super.key,
    required this.title,
    required this.categoryLabel,
    required this.conditionLabel,
    required this.conditionTone,
    required this.statusLabel,
    required this.statusTone,
    required this.quantityLabel,
    required this.priceLabel,
    required this.locationLabel,
    required this.availabilityLabel,
    required this.isFree,
    this.imageUrl,
    this.engagementLabel,
    this.compactBadgeLabels = const [],
    this.createdAtLabel,
    this.onTap,
    this.actions,
  });

  final String title;
  final String categoryLabel;
  final String conditionLabel;
  final MaterialConditionBadgeTone conditionTone;
  final String statusLabel;
  final MaterialStatusBadgeTone statusTone;
  final String quantityLabel;
  final String priceLabel;
  final String locationLabel;
  final String availabilityLabel;
  final bool isFree;
  final String? imageUrl;
  final String? engagementLabel;
  final List<String> compactBadgeLabels;
  final String? createdAtLabel;
  final VoidCallback? onTap;
  final List<Widget>? actions;

  @override
  State<SupplierMaterialCard> createState() => _SupplierMaterialCardState();
}

class _SupplierMaterialCardState extends State<SupplierMaterialCard> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final textTheme = Theme.of(context).textTheme;
    final hasImage = widget.imageUrl?.trim().isNotEmpty ?? false;

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        transform: Matrix4.translationValues(0, _hovered ? -2 : 0, 0),
        decoration: BoxDecoration(
          borderRadius: AppRadius.lgAll,
          boxShadow: [
            BoxShadow(
              color: colors.cardShadow.withValues(alpha: _hovered ? .14 : .08),
              blurRadius: _hovered ? 20 : 16,
              offset: Offset(0, _hovered ? 10 : 6),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: widget.onTap,
            borderRadius: AppRadius.lgAll,
            child: Ink(
              height: supplierMaterialCardHeight,
              decoration: BoxDecoration(
                color: colors.surfaceSolid,
                borderRadius: AppRadius.lgAll,
                border: Border.all(color: colors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _ImageSection(
                    hasImage: hasImage,
                    imageUrl: widget.imageUrl,
                    hovered: _hovered,
                    badges: widget.compactBadgeLabels,
                    colors: colors,
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsetsDirectional.fromSTEB(
                        AppSpacing.md,
                        AppSpacing.sm + 2,
                        AppSpacing.md,
                        AppSpacing.sm,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.categoryLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: textTheme.labelSmall?.copyWith(
                              color: colors.textMuted,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Tooltip(
                            message: widget.title,
                            child: SizedBox(
                              height: 42,
                              child: Text(
                                widget.title,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: textTheme.titleMedium?.copyWith(
                                  color: colors.textPrimary,
                                  fontWeight: FontWeight.w800,
                                  height: 1.2,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          SizedBox(
                            height: 44,
                            child: Wrap(
                              spacing: AppSpacing.xs,
                              runSpacing: AppSpacing.xs,
                              children: [
                                MaterialStatusBadge(
                                  label: widget.statusLabel,
                                  tone: widget.statusTone,
                                ),
                                MaterialConditionBadge(
                                  label: widget.conditionLabel,
                                  tone: widget.conditionTone,
                                ),
                                MaterialPriceBadge(
                                  label: widget.priceLabel,
                                  isFree: widget.isFree,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            widget.quantityLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: textTheme.bodyMedium?.copyWith(
                              color: colors.textSecondary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 5),
                          _MetadataLine(
                            icon: Icons.location_on_outlined,
                            label: widget.locationLabel,
                          ),
                          const SizedBox(height: 3),
                          _MetadataLine(
                            icon: Icons.local_shipping_outlined,
                            label: widget.availabilityLabel,
                          ),
                          const Spacer(),
                          Text(
                            [
                              if (widget.createdAtLabel?.isNotEmpty ?? false)
                                widget.createdAtLabel!,
                              if (widget.engagementLabel?.isNotEmpty ?? false)
                                widget.engagementLabel!,
                            ].join(' · '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: textTheme.labelSmall?.copyWith(
                              color: colors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (widget.actions?.isNotEmpty ?? false)
                    _CardFooter(actions: widget.actions!),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ImageSection extends StatelessWidget {
  const _ImageSection({
    required this.hasImage,
    required this.imageUrl,
    required this.hovered,
    required this.badges,
    required this.colors,
  });

  final bool hasImage;
  final String? imageUrl;
  final bool hovered;
  final List<String> badges;
  final SupplierUiPalette colors;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      child: SizedBox(
        height: _imageHeight,
        child: Stack(
          fit: StackFit.expand,
          children: [
            AnimatedScale(
              scale: hovered ? 1.04 : 1,
              duration: const Duration(milliseconds: 220),
              child: hasImage
                  ? Image.network(
                      imageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => _Placeholder(colors: colors),
                    )
                  : _Placeholder(colors: colors),
            ),
            if (badges.isNotEmpty)
              PositionedDirectional(
                top: AppSpacing.sm,
                end: AppSpacing.sm,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    for (final badge in badges)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: _CompactBadge(label: badge),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _MetadataLine extends StatelessWidget {
  const _MetadataLine({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Row(
      children: [
        Icon(icon, size: 15, color: colors.textMuted),
        const SizedBox(width: 5),
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: colors.textMuted,
            ),
          ),
        ),
      ],
    );
  }
}

class _CompactBadge extends StatelessWidget {
  const _CompactBadge({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: colors.surfaceSolid.withValues(alpha: .9),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: colors.border),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: colors.textPrimary,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _CardFooter extends StatelessWidget {
  const _CardFooter({required this.actions});
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: _footerHeight,
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: context.supplierColors.border)),
      ),
      child: Row(
        children: [
          Expanded(child: actions.first),
          for (final action in actions.skip(1)) ...[
            const SizedBox(width: AppSpacing.xs),
            action,
          ],
        ],
      ),
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({required this.colors});
  final SupplierUiPalette colors;

  @override
  Widget build(BuildContext context) => Container(
        color: colors.chipUnselected,
        child: Center(
          child: Icon(Icons.image_outlined, size: 40, color: colors.textMuted),
        ),
      );
}
