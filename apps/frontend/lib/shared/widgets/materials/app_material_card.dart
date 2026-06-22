import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
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
  final VoidCallback? onTap;
  final Widget? trailing;
  final AppMaterialCardVariant variant;
  final IconData fallbackIcon;
  final double? mediaHeightOverride;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final compact = variant == AppMaterialCardVariant.compact;
    final hasImage = imageUrl != null && imageUrl!.trim().isNotEmpty;
    final borderRadius = compact ? AppRadius.lgAll : AppRadius.xlAll;
    final mediaHeight =
        mediaHeightOverride ?? _defaultMediaHeight(compact, hasImage);
    final contentPadding = compact ? AppSpacing.md : AppSpacing.lg;
    final cardHeight = compact
        ? materialCompactCardHeight
        : materialStandardCardHeight;
    final descriptionText = Text(
      description,
      style: AppTextStyles.body(context).copyWith(
        color: palette.textSecondary,
        height: compact ? 1.45 : 1.55,
      ),
      textAlign: TextAlign.start,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
    );

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: borderRadius,
        child: SizedBox(
          height: cardHeight,
          child: Container(
            decoration: BoxDecoration(
              color: palette.cardSurface,
              borderRadius: borderRadius,
              border: Border.all(color: palette.borderStrong),
              boxShadow: [
                BoxShadow(
                  color: palette.cardShadow,
                  blurRadius: 28,
                  offset: Offset(0, 12),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _MaterialMedia(
                  category: category,
                  statusLabel: statusLabel,
                  statusTone: statusTone,
                  imageUrl: imageUrl,
                  hasImage: hasImage,
                  gradientColors: gradientColors,
                  fallbackIcon: fallbackIcon,
                  height: mediaHeight,
                  compact: compact,
                ),
                Expanded(
                  child: Padding(
                    padding: EdgeInsetsDirectional.all(contentPadding),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _CardHeader(
                          title: title,
                          ratingLabel: ratingLabel,
                          trailing: trailing,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        compact
                            ? SizedBox(height: 48, child: descriptionText)
                            : descriptionText,
                        const Spacer(),
                        _CardChipRow(
                          minHeight: compact ? 42 : 46,
                          children: [
                            MaterialConditionBadge(
                              label: conditionLabel,
                              tone: conditionTone,
                            ),
                            MaterialStatusBadge(
                              label: statusLabel,
                              tone: statusTone,
                            ),
                            MaterialPriceBadge(
                              label: priceLabel,
                              isFree: isFree,
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _CardChipRow(
                          minHeight: compact ? 42 : 46,
                          spacing: AppSpacing.sm,
                          children: [
                            _MetaLine(
                              icon: Icons.straighten_rounded,
                              label: quantityLabel,
                              maxLabelWidth: compact ? 92 : 180,
                            ),
                            _MetaLine(
                              icon: Icons.location_on_outlined,
                              label: locationLabel,
                              maxLabelWidth: compact ? 132 : 180,
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _CardChipRow(
                          minHeight: compact ? 42 : 46,
                          spacing: AppSpacing.sm,
                          children: [
                            _MetaLine(
                              icon: deliveryAvailable
                                  ? Icons.local_shipping_outlined
                                  : Icons.storefront_outlined,
                              label: availabilityLabel,
                              maxLabelWidth: compact ? 132 : 180,
                            ),
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
    );
  }

  static double _defaultMediaHeight(bool compact, bool hasImage) {
    if (compact) {
      return hasImage ? 154 : 128;
    }

    return hasImage ? 212 : 160;
  }
}

class _MaterialMedia extends StatelessWidget {
  const _MaterialMedia({
    required this.category,
    required this.statusLabel,
    required this.statusTone,
    required this.imageUrl,
    required this.hasImage,
    required this.gradientColors,
    required this.fallbackIcon,
    required this.height,
    required this.compact,
  });

  final String category;
  final String statusLabel;
  final MaterialStatusBadgeTone statusTone;
  final String? imageUrl;
  final bool hasImage;
  final List<Color> gradientColors;
  final IconData fallbackIcon;
  final double height;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final topRadius = compact ? AppRadius.lg : AppRadius.xl;
    final mediaGradientColors = hasImage
        ? gradientColors
        : [palette.fallbackStart, palette.fallbackMid, palette.fallbackEnd];
    final overlayColor = hasImage
        ? palette.overlayDark.withValues(alpha: isDark ? 0.72 : 0.34)
        : palette.overlayDark.withValues(alpha: isDark ? 0.08 : 0.02);

    return SizedBox(
      height: height,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadiusDirectional.only(
            topStart: Radius.circular(topRadius),
            topEnd: Radius.circular(topRadius),
          ),
          gradient: LinearGradient(
            begin: AlignmentDirectional.topStart,
            end: AlignmentDirectional.bottomEnd,
            colors: mediaGradientColors,
          ),
        ),
        child: ClipRRect(
          borderRadius: BorderRadiusDirectional.only(
            topStart: Radius.circular(topRadius),
            topEnd: Radius.circular(topRadius),
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (hasImage)
                Image.network(
                  imageUrl!.trim(),
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) =>
                      const SizedBox.shrink(),
                ),
              DecoratedBox(decoration: BoxDecoration(color: overlayColor)),
              Padding(
                padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Align(
                            alignment: AlignmentDirectional.centerStart,
                            child: ConstrainedBox(
                              constraints: BoxConstraints(
                                maxWidth: compact ? 140 : 190,
                              ),
                              child: _MediaTagChip(label: category),
                            ),
                          ),
                        ),
                        const Spacer(),
                        const SizedBox(width: AppSpacing.sm),
                        Flexible(
                          child: Align(
                            alignment: AlignmentDirectional.centerEnd,
                            child: MaterialStatusBadge(
                              label: statusLabel,
                              tone: statusTone,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    if (!hasImage)
                      Align(
                        alignment: AlignmentDirectional.bottomStart,
                        child: Container(
                          width: compact ? 60 : 72,
                          height: compact ? 60 : 72,
                          decoration: BoxDecoration(
                            color: isDark
                                ? palette.cardSurfaceAlt.withValues(alpha: 0.78)
                                : palette.cardSurfaceAlt,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isDark
                                  ? palette.borderStrong.withValues(alpha: 0.82)
                                  : palette.borderSubtle,
                            ),
                          ),
                          child: Icon(
                            fallbackIcon,
                            color: palette.mint,
                            size: compact ? 30 : 36,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MediaTagChip extends StatelessWidget {
  const _MediaTagChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: materialBadgeHorizontalPadding,
        vertical: materialBadgeVerticalPadding,
      ),
      decoration: BoxDecoration(
        color: isDark
            ? palette.panelSurface.withValues(alpha: 0.82)
            : palette.cardSurface.withValues(alpha: 0.86),
        borderRadius: AppRadius.pillAll,
        border: Border.all(
          color: isDark
              ? palette.borderStrong.withValues(alpha: 0.7)
              : palette.borderSubtle,
        ),
      ),
      child: Text(
        label,
        style: AppTextStyles.badgeLabel(context).copyWith(
          color: palette.textPrimary,
          fontSize: materialBadgeFontSize,
          fontWeight: FontWeight.w700,
          height: 1.1,
        ),
        textAlign: TextAlign.start,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

class _CardHeader extends StatelessWidget {
  const _CardHeader({
    required this.title,
    required this.ratingLabel,
    required this.trailing,
  });

  final String title;
  final String? ratingLabel;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final titleBlock = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 52,
          child: Text(
            title,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary, height: 1.2),
            textAlign: TextAlign.start,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );

    final rightSide = Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      crossAxisAlignment: WrapCrossAlignment.center,
      alignment: WrapAlignment.end,
      children: [
        if (ratingLabel case final ratingText?)
          Container(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: palette.mutedSurface,
              borderRadius: AppRadius.pillAll,
              border: Border.all(color: palette.borderStrong),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.star_rounded, color: materialLime, size: 16),
                const SizedBox(width: AppSpacing.xs),
                Text(
                  ratingText,
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textPrimary,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.start,
                ),
              ],
            ),
          ),
        ...?switch (trailing) {
          final trailingWidget? => [trailingWidget],
          null => null,
        },
      ],
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 300;

        if (!wide) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              titleBlock,
              const SizedBox(height: AppSpacing.sm),
              rightSide,
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: titleBlock),
            const SizedBox(width: AppSpacing.md),
            Flexible(child: rightSide),
          ],
        );
      },
    );
  }
}

class _CardChipRow extends StatelessWidget {
  const _CardChipRow({
    required this.children,
    required this.minHeight,
    this.spacing = AppSpacing.sm,
  });

  final List<Widget> children;
  final double minHeight;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints(minHeight: minHeight),
      child: Align(
        alignment: AlignmentDirectional.topStart,
        child: Wrap(
          spacing: spacing,
          runSpacing: AppSpacing.sm,
          children: children,
        ),
      ),
    );
  }
}

class _MetaLine extends StatelessWidget {
  const _MetaLine({
    required this.icon,
    required this.label,
    required this.maxLabelWidth,
  });

  final IconData icon;
  final String label;
  final double maxLabelWidth;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: materialMetaChipHorizontalPadding,
        vertical: materialMetaChipVerticalPadding,
      ),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: palette.mint),
          const SizedBox(width: AppSpacing.xs),
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxLabelWidth),
            child: Text(
              label,
              style: AppTextStyles.label(context).copyWith(
                color: palette.textSecondary,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                height: 1.15,
              ),
              textAlign: TextAlign.start,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}
