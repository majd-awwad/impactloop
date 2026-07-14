import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../../../shared/widgets/materials/material_price_badge.dart';
import '../../../../../shared/widgets/materials/material_status_badge.dart';
import '../../theme/supplier_theme_extension.dart';
import '../material_engagement_chip.dart';

const supplierMaterialCardHeight = 440.0;

class SupplierMaterialCard extends StatefulWidget {
  const SupplierMaterialCard({
    super.key,
    required this.title,
    required this.description,
    required this.categoryLabel,
    required this.conditionLabel,
    required this.conditionTone,
    required this.statusLabel,
    required this.statusTone,
    required this.quantityLabel,
    required this.priceLabel,
    required this.locationLabel,
    required this.availabilityLabel,
    required this.deliveryAvailable,
    required this.isFree,
    this.imageUrl,
    this.viewsCount,
    this.likesCount,
    this.compactBadgeLabels = const [],
    this.createdAtLabel,
    this.onTap,
    this.actions,
  });

  final String title;
  final String description;
  final String categoryLabel;
  final String conditionLabel;
  final MaterialConditionBadgeTone conditionTone;
  final String statusLabel;
  final MaterialStatusBadgeTone statusTone;
  final String quantityLabel;
  final String priceLabel;
  final String locationLabel;
  final String availabilityLabel;
  final bool deliveryAvailable;
  final bool isFree;
  final String? imageUrl;
  final int? viewsCount;
  final int? likesCount;
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
    final hasImage = widget.imageUrl != null && widget.imageUrl!.trim().isNotEmpty;
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final actionCount = widget.actions?.length ?? 0;
    final cardHeight = compact && actionCount > 2
        ? supplierMaterialCardHeight + 100
        : supplierMaterialCardHeight;

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOutCubic,
        transform: Matrix4.translationValues(0, _hovered ? -2 : 0, 0),
        decoration: BoxDecoration(
          borderRadius: AppRadius.lgAll,
          boxShadow: [
            BoxShadow(
              color: colors.cardShadow.withValues(
                alpha: _hovered ? 0.14 : 0.08,
              ),
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
              height: cardHeight,
              decoration: BoxDecoration(
                color: colors.surfaceSolid,
                borderRadius: AppRadius.lgAll,
                border: Border.all(color: colors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(AppRadius.lg),
                    ),
                    child: SizedBox(
                      height: 160,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          AnimatedScale(
                            scale: _hovered ? 1.04 : 1,
                            duration: const Duration(milliseconds: 220),
                            curve: Curves.easeOutCubic,
                            child: hasImage
                                ? Image.network(
                                    widget.imageUrl!,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, _, _) =>
                                        _Placeholder(colors: colors),
                                  )
                                : _Placeholder(colors: colors),
                          ),
                          Positioned(
                            left: 8,
                            bottom: 8,
                            child: Row(
                              children: [
                                MaterialEngagementChip(
                                  icon: Icons.visibility_outlined,
                                  count: widget.viewsCount ?? 0,
                                  tone: MaterialEngagementChipTone.views,
                                ),
                                const SizedBox(width: 6),
                                MaterialEngagementChip(
                                  icon: Icons.favorite_border,
                                  count: widget.likesCount ?? 0,
                                  tone: MaterialEngagementChipTone.likes,
                                ),
                              ],
                            ),
                          ),
                          if (widget.compactBadgeLabels.isNotEmpty)
                            Positioned(
                              top: 8,
                              right: 8,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  for (final label in widget.compactBadgeLabels)
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 4),
                                      child: _CompactBadge(label: label),
                                    ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.categoryLabel,
                            style: textTheme.labelSmall?.copyWith(
                              color: colors.accent,
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            widget.title,
                            style: textTheme.titleMedium?.copyWith(
                              color: colors.textPrimary,
                              fontWeight: FontWeight.w700,
                              height: 1.2,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Wrap(
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
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            widget.quantityLabel,
                            style: textTheme.bodyMedium?.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.locationLabel,
                            style: textTheme.bodySmall?.copyWith(
                              color: colors.textMuted,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.availabilityLabel,
                            style: textTheme.bodySmall?.copyWith(
                              color: colors.textMuted,
                            ),
                          ),
                          const Spacer(),
                          if (widget.createdAtLabel != null ||
                              (widget.viewsCount ?? 0) > 0)
                            Text(
                              [
                                if (widget.createdAtLabel != null)
                                  widget.createdAtLabel,
                                if ((widget.viewsCount ?? 0) > 0)
                                  '${widget.viewsCount} views',
                              ].join(' · '),
                              style: textTheme.labelSmall?.copyWith(
                                color: colors.textMuted,
                              ),
                            ),
                          if (widget.actions != null &&
                              widget.actions!.isNotEmpty) ...[
                            const SizedBox(height: AppSpacing.sm),
                            _CardActions(
                              actions: widget.actions!,
                              compact: compact,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CompactBadge extends StatelessWidget {
  const _CompactBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: colors.surfaceSolid.withValues(alpha: 0.86),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: colors.border),
      ),
      child: Text(
        label,
        style: textTheme.labelSmall?.copyWith(
          color: colors.textPrimary,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _CardActions extends StatelessWidget {
  const _CardActions({
    required this.actions,
    required this.compact,
  });

  final List<Widget> actions;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < actions.length; i++) ...[
            if (i > 0) const SizedBox(height: AppSpacing.xs),
            actions[i],
          ],
        ],
      );
    }

    if (actions.length <= 2) {
      return Row(
        children: [
          for (var i = 0; i < actions.length; i++) ...[
            if (i > 0) const SizedBox(width: AppSpacing.sm),
            Expanded(child: actions[i]),
          ],
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: actions[0]),
            const SizedBox(width: AppSpacing.sm),
            Expanded(child: actions[1]),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        actions[2],
      ],
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({required this.colors});

  final SupplierUiPalette colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: colors.chipUnselected,
      child: Center(
        child: Icon(
          Icons.image_outlined,
          size: 40,
          color: colors.textMuted,
        ),
      ),
    );
  }
}
