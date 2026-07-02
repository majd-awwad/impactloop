import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../app/theme/app_theme_colors.dart';
import 'material_condition_badge.dart';
import 'material_price_badge.dart';
import 'material_status_badge.dart';
import 'materials_ui_palette.dart';

enum AppMaterialCardVariant { standard, compact }

class AppMaterialCard extends StatelessWidget {
  const AppMaterialCard({
    super.key,
    required this.title,
    required this.description,
    required this.category,
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
    required this.gradientColors,
    this.imageUrl,
    this.ratingLabel,
    this.showPopularBadge = false,
    this.onTap,
    this.trailing,
    this.variant = AppMaterialCardVariant.standard,
    this.fallbackIcon = Icons.inventory_2_outlined,
    this.mediaHeightOverride,
  });

  final String title;
  final String description;
  final String category;
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
  final List<Color> gradientColors;
  final String? imageUrl;
  final String? ratingLabel;
  final bool showPopularBadge;
  final VoidCallback? onTap;
  final Widget? trailing;
  final AppMaterialCardVariant variant;
  final IconData fallbackIcon;
  final double? mediaHeightOverride;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : 320.0;

        return SizedBox(
          height: ImpactMaterialGridCard.heightForWidth(width, variant: variant),
          child: ImpactMaterialGridCard(
            title: title,
            description: description,
            category: category,
            conditionLabel: conditionLabel,
            conditionTone: conditionTone,
            statusLabel: statusLabel,
            statusTone: statusTone,
            quantityLabel: quantityLabel,
            priceLabel: priceLabel,
            locationLabel: locationLabel,
            availabilityLabel: availabilityLabel,
            deliveryAvailable: deliveryAvailable,
            isFree: isFree,
            gradientColors: gradientColors,
            imageUrl: imageUrl,
            ratingLabel: ratingLabel,
            showPopularBadge: showPopularBadge,
            onTap: onTap,
            trailing: trailing,
            variant: variant,
            fallbackIcon: fallbackIcon,
            mediaHeightOverride: mediaHeightOverride,
          ),
        );
      },
    );
  }
}

class ImpactMaterialGridCard extends StatefulWidget {
  const ImpactMaterialGridCard({
    super.key,
    required this.title,
    required this.description,
    required this.category,
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
    required this.gradientColors,
    this.imageUrl,
    this.ratingLabel,
    this.showPopularBadge = false,
    this.onTap,
    this.trailing,
    this.variant = AppMaterialCardVariant.standard,
    this.fallbackIcon = Icons.inventory_2_outlined,
    this.mediaHeightOverride,
  });

  final String title;
  final String description;
  final String category;
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
  final List<Color> gradientColors;
  final String? imageUrl;
  final String? ratingLabel;
  final bool showPopularBadge;
  final VoidCallback? onTap;
  final Widget? trailing;
  final AppMaterialCardVariant variant;
  final IconData fallbackIcon;
  final double? mediaHeightOverride;

  static double heightForWidth(
    double width, {
    AppMaterialCardVariant variant = AppMaterialCardVariant.standard,
  }) {
    final imageHeight = width * 0.75;
    final compact = variant == AppMaterialCardVariant.compact || width < 260;
    final contentHeight = compact ? 178.0 : 190.0;
    return imageHeight + contentHeight;
  }

  @override
  State<ImpactMaterialGridCard> createState() => _ImpactMaterialGridCardState();
}

class ImpactMaterialCompactCard extends StatelessWidget {
  const ImpactMaterialCompactCard({
    super.key,
    required this.title,
    required this.description,
    required this.category,
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
    required this.gradientColors,
    this.imageUrl,
    this.ratingLabel,
    this.showPopularBadge = false,
    this.onTap,
    this.trailing,
    this.fallbackIcon = Icons.inventory_2_outlined,
  });

  final String title;
  final String description;
  final String category;
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
  final List<Color> gradientColors;
  final String? imageUrl;
  final String? ratingLabel;
  final bool showPopularBadge;
  final VoidCallback? onTap;
  final Widget? trailing;
  final IconData fallbackIcon;

  static const height = 136.0;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Semantics(
      button: onTap != null,
      label: '$title, $category, $conditionLabel, $locationLabel, '
          '$priceLabel, $statusLabel',
      child: SizedBox(
        height: height,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: AppRadius.lgAll,
            child: Ink(
            decoration: BoxDecoration(
              color: palette.cardSurface,
              borderRadius: AppRadius.lgAll,
              border: Border.all(color: palette.borderStrong),
              boxShadow: [
                BoxShadow(
                  color: palette.cardShadow.withValues(alpha: 0.10),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _CompactCardMedia(
                    imageUrl: imageUrl,
                    gradientColors: gradientColors,
                    fallbackIcon: fallbackIcon,
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsetsDirectional.fromSTEB(
                        15,
                        12,
                        12,
                        12,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: AppTextStyles.title(context).copyWith(
                              color: palette.textPrimary,
                              fontSize: 15.5,
                              fontWeight: FontWeight.w600,
                              height: 1.12,
                              letterSpacing: 0,
                            ),
                            textAlign: TextAlign.start,
                            maxLines: title.runes.length > 34 ? 2 : 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '$category · $conditionLabel',
                            style: AppTextStyles.label(context).copyWith(
                              color: palette.textSecondary,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              height: 1.16,
                              letterSpacing: 0,
                            ),
                            textAlign: TextAlign.start,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 5),
                          _CompactLocationLine(
                            label: locationLabel.isNotEmpty
                                ? locationLabel
                                : quantityLabel,
                          ),
                          const Spacer(),
                          Row(
                            children: [
                              Flexible(
                                child: Align(
                                  alignment:
                                      AlignmentDirectional.centerStart,
                                  child: _CompactPriceBadge(
                                    label: priceLabel,
                                    isFree: isFree,
                                  ),
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              _CompactViewAffordance(color: palette.mint),
                            ],
                          ),
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

class _CompactCardMedia extends StatefulWidget {
  const _CompactCardMedia({
    required this.imageUrl,
    required this.gradientColors,
    required this.fallbackIcon,
  });

  final String? imageUrl;
  final List<Color> gradientColors;
  final IconData fallbackIcon;

  @override
  State<_CompactCardMedia> createState() => _CompactCardMediaState();
}

class _CompactCardMediaState extends State<_CompactCardMedia> {
  bool _imageFailed = false;

  @override
  void didUpdateWidget(covariant _CompactCardMedia oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.imageUrl != widget.imageUrl) {
      _imageFailed = false;
    }
  }

  bool get _showNetworkImage {
    final imageUrl = widget.imageUrl?.trim();
    return imageUrl != null && imageUrl.isNotEmpty && !_imageFailed;
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ClipRRect(
      borderRadius: const BorderRadiusDirectional.only(
        topStart: Radius.circular(AppRadius.lg),
        bottomStart: Radius.circular(AppRadius.lg),
      ),
      child: SizedBox(
        width: 110,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: AlignmentDirectional.topStart,
              end: AlignmentDirectional.bottomEnd,
              colors: _showNetworkImage
                  ? widget.gradientColors
                  : [
                      palette.fallbackStart,
                      palette.fallbackMid,
                      palette.fallbackEnd,
                    ],
            ),
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (_showNetworkImage)
                Image.network(
                  widget.imageUrl!.trim(),
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted && !_imageFailed) {
                        setState(() => _imageFailed = true);
                      }
                    });
                    return const SizedBox.shrink();
                  },
                )
              else
                Center(
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: palette.cardSurface.withValues(
                        alpha: isDark ? 0.72 : 0.86,
                      ),
                      borderRadius: AppRadius.mdAll,
                      border: Border.all(color: palette.borderSubtle),
                    ),
                    child: Icon(
                      widget.fallbackIcon,
                      color: palette.mint,
                      size: 22,
                    ),
                  ),
                ),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: palette.overlayDark.withValues(
                    alpha: _showNetworkImage ? 0.12 : 0.03,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CompactPriceBadge extends StatelessWidget {
  const _CompactPriceBadge({required this.label, required this.isFree});

  final String label;
  final bool isFree;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = AppThemeColors.of(context);
    final background = isFree
        ? (isDark ? materialPriceFreeBackground : colors.successSoft)
        : (isDark ? materialPricePaidBackground : colors.cardSurfaceAlt);
    final border = isFree
        ? (isDark ? materialPriceFreeBorder : colors.borderStrong)
        : (isDark ? materialPricePaidBorder : colors.borderSubtle);
    final foreground = isFree
        ? (isDark ? materialPriceFreeForeground : colors.success)
        : (isDark ? materialPricePaidForeground : colors.textSecondary);

    return Container(
      constraints: const BoxConstraints(minHeight: 22),
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: 7,
        vertical: 3,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: border),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: foreground,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          height: 1,
          letterSpacing: 0,
        ),
        textAlign: TextAlign.start,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

class _CompactLocationLine extends StatelessWidget {
  const _CompactLocationLine({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Row(
      children: [
        Icon(Icons.location_on_outlined, size: 14, color: palette.textMuted),
        const SizedBox(width: 5),
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w500,
              height: 1.16,
              letterSpacing: 0,
            ),
            textAlign: TextAlign.start,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

class _CompactViewAffordance extends StatelessWidget {
  const _CompactViewAffordance({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'View',
          style: AppTextStyles.label(context).copyWith(
            color: color,
            fontSize: 11.5,
            fontWeight: FontWeight.w800,
            height: 1,
            letterSpacing: 0,
          ),
        ),
        const SizedBox(width: 2),
        Icon(Icons.arrow_forward_rounded, color: color, size: 14),
      ],
    );
  }
}

class _ImpactMaterialGridCardState extends State<ImpactMaterialGridCard> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final compact = widget.variant == AppMaterialCardVariant.compact;
    final borderColor = _hovered
        ? palette.mint.withValues(alpha: 0.58)
        : palette.borderStrong;

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: AnimatedSlide(
        duration: const Duration(milliseconds: 160),
        curve: Curves.easeOutCubic,
        offset: _hovered ? const Offset(0, -0.012) : Offset.zero,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOutCubic,
          decoration: BoxDecoration(
            color: palette.cardSurface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: borderColor),
            boxShadow: [
              BoxShadow(
                color: palette.cardShadow.withValues(
                  alpha: _hovered ? 0.24 : 0.14,
                ),
                blurRadius: _hovered ? 24 : 16,
                offset: Offset(0, _hovered ? 12 : 8),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: widget.onTap,
              borderRadius: AppRadius.lgAll,
              child: ClipRRect(
                borderRadius: AppRadius.lgAll,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _GridCardMedia(
                      category: widget.category,
                      priceLabel: widget.priceLabel,
                      isFree: widget.isFree,
                      imageUrl: widget.imageUrl,
                      gradientColors: widget.gradientColors,
                      fallbackIcon: widget.fallbackIcon,
                      hovered: _hovered,
                    ),
                    Expanded(
                      child: _GridCardContent(
                        title: widget.title,
                        category: widget.category,
                        conditionLabel: widget.conditionLabel,
                        statusLabel: widget.statusLabel,
                        statusTone: widget.statusTone,
                        quantityLabel: widget.quantityLabel,
                        locationLabel: widget.locationLabel,
                        availabilityLabel: widget.availabilityLabel,
                        deliveryAvailable: widget.deliveryAvailable,
                        compact: compact,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _GridCardMedia extends StatefulWidget {
  const _GridCardMedia({
    required this.category,
    required this.priceLabel,
    required this.isFree,
    required this.imageUrl,
    required this.gradientColors,
    required this.fallbackIcon,
    required this.hovered,
  });

  final String category;
  final String priceLabel;
  final bool isFree;
  final String? imageUrl;
  final List<Color> gradientColors;
  final IconData fallbackIcon;
  final bool hovered;

  @override
  State<_GridCardMedia> createState() => _GridCardMediaState();
}

class _GridCardMediaState extends State<_GridCardMedia> {
  bool _imageFailed = false;

  @override
  void didUpdateWidget(covariant _GridCardMedia oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.imageUrl != widget.imageUrl) {
      _imageFailed = false;
    }
  }

  bool get _showNetworkImage {
    final imageUrl = widget.imageUrl?.trim();
    return imageUrl != null && imageUrl.isNotEmpty && !_imageFailed;
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AspectRatio(
      aspectRatio: 4 / 3,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: AlignmentDirectional.topStart,
            end: AlignmentDirectional.bottomEnd,
            colors: _showNetworkImage
                ? widget.gradientColors
                : [
                    palette.fallbackStart,
                    palette.fallbackMid,
                    palette.fallbackEnd,
                  ],
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (_showNetworkImage)
              AnimatedScale(
                scale: widget.hovered ? 1.04 : 1,
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                child: Image.network(
                  widget.imageUrl!.trim(),
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted && !_imageFailed) {
                        setState(() => _imageFailed = true);
                      }
                    });
                    return const SizedBox.shrink();
                  },
                ),
              )
            else
              Center(
                child: Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                    color: palette.cardSurface.withValues(
                      alpha: isDark ? 0.72 : 0.86,
                    ),
                    borderRadius: AppRadius.lgAll,
                    border: Border.all(color: palette.borderSubtle),
                  ),
                  child: Icon(widget.fallbackIcon, color: palette.mint, size: 30),
                ),
              ),
            DecoratedBox(
              decoration: BoxDecoration(
                color: palette.overlayDark.withValues(
                  alpha: _showNetworkImage ? 0.16 : 0.04,
                ),
              ),
            ),
            PositionedDirectional(
              top: AppSpacing.sm,
              start: AppSpacing.sm,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 150),
                child: _OverlayChip(label: widget.category),
              ),
            ),
            PositionedDirectional(
              top: AppSpacing.sm,
              end: AppSpacing.sm,
              child: _DisabledSaveButton(isDark: isDark),
            ),
            PositionedDirectional(
              end: AppSpacing.sm,
              bottom: AppSpacing.sm,
              child: MaterialPriceBadge(
                label: widget.priceLabel,
                isFree: widget.isFree,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GridCardContent extends StatelessWidget {
  const _GridCardContent({
    required this.title,
    required this.category,
    required this.conditionLabel,
    required this.statusLabel,
    required this.statusTone,
    required this.quantityLabel,
    required this.locationLabel,
    required this.availabilityLabel,
    required this.deliveryAvailable,
    required this.compact,
  });

  final String title;
  final String category;
  final String conditionLabel;
  final String statusLabel;
  final MaterialStatusBadgeTone statusTone;
  final String quantityLabel;
  final String locationLabel;
  final String availabilityLabel;
  final bool deliveryAvailable;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final padding = compact ? AppSpacing.sm : AppSpacing.md;

    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(
        padding,
        AppSpacing.sm,
        padding,
        compact ? AppSpacing.sm : AppSpacing.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTextStyles.title(context).copyWith(
              color: palette.textPrimary,
              fontSize: compact ? 15 : 16.5,
              height: 1.16,
              letterSpacing: 0,
            ),
            textAlign: TextAlign.start,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '$category + $conditionLabel',
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
              fontSize: compact ? 11.5 : 12.5,
              fontWeight: FontWeight.w600,
              height: 1.2,
              letterSpacing: 0,
            ),
            textAlign: TextAlign.start,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.sm),
          _PlainMetaLine(
            icon: Icons.location_on_outlined,
            label: locationLabel,
            compact: compact,
          ),
          const SizedBox(height: AppSpacing.xs),
          _PlainMetaLine(
            icon: deliveryAvailable
                ? Icons.local_shipping_outlined
                : Icons.storefront_outlined,
            label: '$quantityLabel - $availabilityLabel',
            compact: compact,
          ),
          const Spacer(),
          Row(
            children: [
              Flexible(
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: AlignmentDirectional.centerStart,
                    child: MaterialStatusBadge(
                      label: statusLabel,
                      tone: statusTone,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                'Details',
                style: AppTextStyles.label(context).copyWith(
                  color: palette.mint,
                  fontSize: compact ? 12 : 13,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0,
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Icon(
                Icons.arrow_forward_rounded,
                color: palette.mint,
                size: compact ? 16 : 18,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PlainMetaLine extends StatelessWidget {
  const _PlainMetaLine({
    required this.icon,
    required this.label,
    required this.compact,
  });

  final IconData icon;
  final String label;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Row(
      children: [
        Icon(icon, size: compact ? 14 : 15, color: palette.textMuted),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
              fontSize: compact ? 11.5 : 12.5,
              fontWeight: FontWeight.w600,
              height: 1.2,
              letterSpacing: 0,
            ),
            textAlign: TextAlign.start,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

class _OverlayChip extends StatelessWidget {
  const _OverlayChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.cardSurface.withValues(alpha: isDark ? 0.78 : 0.88),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: palette.textPrimary,
          fontSize: 11.5,
          fontWeight: FontWeight.w800,
          height: 1.1,
          letterSpacing: 0,
        ),
        textAlign: TextAlign.start,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

class _DisabledSaveButton extends StatelessWidget {
  const _DisabledSaveButton({required this.isDark});

  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Tooltip(
      message: 'Save is not available yet',
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: palette.cardSurface.withValues(alpha: isDark ? 0.68 : 0.84),
          shape: BoxShape.circle,
          border: Border.all(color: palette.borderSubtle),
        ),
        child: Icon(
          Icons.favorite_border_rounded,
          color: palette.textMuted,
          size: 18,
        ),
      ),
    );
  }
}
