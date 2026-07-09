import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
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
    this.viewsCount = 0,
    this.likesCount = 0,
    this.isLiked = false,
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
  final int viewsCount;
  final int likesCount;
  final bool isLiked;
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
            viewsCount: viewsCount,
            likesCount: likesCount,
            isLiked: isLiked,
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
    this.viewsCount = 0,
    this.likesCount = 0,
    this.isLiked = false,
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
  final int viewsCount;
  final int likesCount;
  final bool isLiked;
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
    this.viewsCount = 0,
    this.likesCount = 0,
    this.isLiked = false,
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
  final int viewsCount;
  final int likesCount;
  final bool isLiked;
  final bool showPopularBadge;
  final VoidCallback? onTap;
  final Widget? trailing;
  final IconData fallbackIcon;

  static const height = 136.0;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;

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
                border: Border.all(color: palette.borderSubtle),
                boxShadow: [
                  BoxShadow(
                    color: palette.cardShadow.withValues(alpha: 0.08),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
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
                        AppSpacing.md,
                        AppSpacing.sm + AppSpacing.xs,
                        AppSpacing.sm + AppSpacing.xs,
                        AppSpacing.sm + AppSpacing.xs,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: textTheme.titleMedium?.copyWith(
                              color: palette.textPrimary,
                              fontWeight: FontWeight.w600,
                              height: 1.18,
                            ),
                            textAlign: TextAlign.start,
                            maxLines: title.runes.length > 34 ? 2 : 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '$category · $conditionLabel',
                            style: textTheme.labelMedium?.copyWith(
                              color: palette.textSecondary,
                              fontWeight: FontWeight.w500,
                              height: 1.2,
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
                              _CompactEngagementBadge(
                                viewsCount: viewsCount,
                                likesCount: likesCount,
                                isLiked: isLiked,
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
    return MaterialPriceBadge(label: label, isFree: isFree, dense: true);
  }
}

class _CompactLocationLine extends StatelessWidget {
  const _CompactLocationLine({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;

    return Row(
      children: [
        Icon(Icons.location_on_outlined, size: 14, color: palette.textMuted),
        const SizedBox(width: 5),
        Expanded(
          child: Text(
            label,
            style: textTheme.labelMedium?.copyWith(
              color: palette.textSecondary,
              fontWeight: FontWeight.w500,
              height: 1.2,
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
    final textTheme = Theme.of(context).textTheme;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'View',
          style: textTheme.labelSmall?.copyWith(
            color: color,
            fontWeight: FontWeight.w800,
            height: 1,
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
        ? palette.mint.withValues(alpha: 0.46)
        : palette.borderSubtle;

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
                  alpha: _hovered ? 0.18 : 0.08,
                ),
                blurRadius: _hovered ? 24 : 18,
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
                      viewsCount: widget.viewsCount,
                      likesCount: widget.likesCount,
                      isLiked: widget.isLiked,
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
    required this.viewsCount,
    required this.likesCount,
    required this.isLiked,
  });

  final String category;
  final String priceLabel;
  final bool isFree;
  final String? imageUrl;
  final List<Color> gradientColors;
  final IconData fallbackIcon;
  final bool hovered;
  final int viewsCount;
  final int likesCount;
  final bool isLiked;

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
              child: _EngagementCountBadge(
                viewsCount: widget.viewsCount,
                likesCount: widget.likesCount,
                isLiked: widget.isLiked,
                isDark: isDark,
              ),
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
    final textTheme = Theme.of(context).textTheme;
    final padding = compact ? AppSpacing.sm + AppSpacing.xs : AppSpacing.md;

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
            style: textTheme.titleMedium?.copyWith(
              color: palette.textPrimary,
              fontSize: compact ? 15 : null,
              fontWeight: FontWeight.w700,
              height: 1.16,
            ),
            textAlign: TextAlign.start,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '$category - $conditionLabel',
            style: textTheme.labelMedium?.copyWith(
              color: palette.textSecondary,
              fontSize: compact ? 11.5 : 12.5,
              fontWeight: FontWeight.w600,
              height: 1.2,
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
                style: textTheme.labelMedium?.copyWith(
                  color: palette.mint,
                  fontSize: compact ? 12 : 13,
                  fontWeight: FontWeight.w800,
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
    final textTheme = Theme.of(context).textTheme;

    return Row(
      children: [
        Icon(icon, size: compact ? 14 : 15, color: palette.textMuted),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Text(
            label,
            style: textTheme.labelMedium?.copyWith(
              color: palette.textSecondary,
              fontSize: compact ? 11.5 : 12.5,
              fontWeight: FontWeight.w600,
              height: 1.2,
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
    final textTheme = Theme.of(context).textTheme;

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
        style: textTheme.labelSmall?.copyWith(
          color: palette.textPrimary,
          fontWeight: FontWeight.w800,
          height: 1.1,
        ),
        textAlign: TextAlign.start,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

class _EngagementCountBadge extends StatelessWidget {
  const _EngagementCountBadge({
    required this.viewsCount,
    required this.likesCount,
    required this.isLiked,
    required this.isDark,
  });

  final int viewsCount;
  final int likesCount;
  final bool isLiked;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    final foreground = isLiked ? palette.mint : palette.textMuted;

    return Tooltip(
      message: isLiked ? 'Liked by you' : 'Material likes',
      child: Container(
        constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
        padding: const EdgeInsetsDirectional.symmetric(horizontal: 8),
        decoration: BoxDecoration(
          color: palette.cardSurface.withValues(alpha: isDark ? 0.68 : 0.84),
          borderRadius: AppRadius.pillAll,
          border: Border.all(color: palette.borderSubtle),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (viewsCount > 0) ...[
              Icon(Icons.visibility_outlined, color: palette.textMuted, size: 16),
              const SizedBox(width: 4),
              Text(
                '$viewsCount',
                style: textTheme.labelSmall?.copyWith(
                  color: palette.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  height: 1,
                ),
              ),
              const SizedBox(width: 8),
            ],
            Icon(
              isLiked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
              color: foreground,
              size: 17,
            ),
            if (likesCount > 0) ...[
              const SizedBox(width: 4),
              Text(
                '$likesCount',
                style: textTheme.labelSmall?.copyWith(
                  color: foreground,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  height: 1,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CompactEngagementBadge extends StatelessWidget {
  const _CompactEngagementBadge({
    required this.viewsCount,
    required this.likesCount,
    required this.isLiked,
  });

  final int viewsCount;
  final int likesCount;
  final bool isLiked;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    final foreground = isLiked ? palette.mint : palette.textMuted;

    return Tooltip(
      message: isLiked ? 'Liked by you' : 'Material likes',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (viewsCount > 0) ...[
            Icon(Icons.visibility_outlined, color: palette.textMuted, size: 14),
            const SizedBox(width: 3),
            Text(
              '$viewsCount',
              style: textTheme.labelSmall?.copyWith(
                color: palette.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                height: 1,
              ),
            ),
            const SizedBox(width: 6),
          ],
          Icon(
            isLiked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
            color: foreground,
            size: 14,
          ),
          if (likesCount > 0) ...[
            const SizedBox(width: 3),
            Text(
              '$likesCount',
              style: textTheme.labelSmall?.copyWith(
                color: foreground,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                height: 1,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
