import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/config/api_config.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_section_card.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../domain/discovery_material.dart';
import '../../../../shared/widgets/supplier/supplier_identity_widgets.dart';

class PublicSupplierProfileHeader extends StatelessWidget {
  const PublicSupplierProfileHeader({
    super.key,
    required this.supplier,
    required this.isUpdatingFollow,
    required this.onToggleFollow,
  });

  final PublicSupplier supplier;
  final bool isUpdatingFollow;
  final VoidCallback onToggleFollow;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final coverUrl = supplier.coverImageUrl?.trim();
    final resolvedCover = coverUrl == null || coverUrl.isEmpty
        ? null
        : ApiConfig.resolveMediaUrl(coverUrl);
    final location = [
      supplier.city,
      supplier.area,
    ].whereType<String>().where((value) => value.trim().isNotEmpty).join(', ');
    final typeLabel = DiscoveryMaterial.supplierTypeLabelFor(
      supplier.supplierType,
    )?.resolve(context);

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: ColoredBox(
        color: palette.cardSurface,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: 200,
              width: double.infinity,
              child: resolvedCover == null
                  ? _PublicSupplierCoverFallback()
                  : Image.network(
                      resolvedCover,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) =>
                          const _PublicSupplierCoverFallback(),
                    ),
            ),
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(20, 0, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Transform.translate(
                        offset: const Offset(0, -36),
                        child: SupplierIdentityAvatar(
                          displayName: supplier.displayName,
                          avatarUrl: supplier.avatarUrl,
                          radius: 40,
                          borderColor: palette.cardSurface,
                          borderWidth: 4,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsetsDirectional.only(bottom: 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                supplier.displayName,
                                style: AppTextStyles.title(context).copyWith(
                                  color: palette.textPrimary,
                                  fontSize: 24,
                                  fontWeight: FontWeight.w800,
                                  height: 1.15,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (location.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Icon(
                                      Icons.location_on_outlined,
                                      size: 16,
                                      color: palette.textMuted,
                                    ),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Text(
                                        location,
                                        style: AppTextStyles.body(
                                          context,
                                        ).copyWith(color: palette.textSecondary),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (typeLabel != null)
                        _PublicSupplierHeaderChip(
                          label: typeLabel,
                          icon: Icons.storefront_outlined,
                        ),
                      if (supplier.isVerified)
                        _PublicSupplierHeaderChip(
                          label: const LocalizedText(
                            en: 'Verified supplier',
                            ar: 'مورد موثّق',
                          ).resolve(context),
                          icon: Icons.verified_rounded,
                        ),
                    ],
                  ),
                  if (supplier.description != null &&
                      supplier.description!.trim().isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      supplier.description!.trim(),
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textPrimary, height: 1.45),
                    ),
                  ],
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: isUpdatingFollow ? null : onToggleFollow,
                    style: AppStatusButtonStyle.filled(
                      context,
                      AppStatusTone.primary,
                    ).copyWith(
                      minimumSize: const WidgetStatePropertyAll(
                        Size.fromHeight(44),
                      ),
                    ),
                    child: isUpdatingFollow
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(
                            supplier.isFollowedByViewer
                                ? const LocalizedText(
                                    en: 'Following',
                                    ar: 'متابَع',
                                  ).resolve(context)
                                : const LocalizedText(
                                    en: 'Follow',
                                    ar: 'متابعة',
                                  ).resolve(context),
                          ),
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

class _PublicSupplierCoverFallback extends StatelessWidget {
  const _PublicSupplierCoverFallback();

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            palette.mint.withValues(alpha: 0.85),
            palette.mint.withValues(alpha: 0.45),
            palette.mint.withValues(alpha: 0.2),
          ],
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
        ),
      ),
    );
  }
}

class _PublicSupplierHeaderChip extends StatelessWidget {
  const _PublicSupplierHeaderChip({
    required this.label,
    required this.icon,
  });

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.mint.withValues(alpha: 0.1),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: palette.mint),
          const SizedBox(width: 6),
          Text(
            label,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class PublicSupplierStatsBar extends StatelessWidget {
  const PublicSupplierStatsBar({
    super.key,
    required this.materialsCount,
    required this.followersCount,
    required this.isWide,
  });

  final int materialsCount;
  final int followersCount;
  final bool isWide;

  @override
  Widget build(BuildContext context) {
    final items = [
      _PublicSupplierStatItem(
        icon: Icons.inventory_2_outlined,
        label: const LocalizedText(en: 'Materials', ar: 'المواد'),
        value: materialsCount,
        tone: AppStatusTone.neutral,
      ),
      _PublicSupplierStatItem(
        icon: Icons.people_outline,
        label: const LocalizedText(en: 'Followers', ar: 'المتابعون'),
        value: followersCount,
        tone: AppStatusTone.info,
      ),
    ];

    return AppSectionCard(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: 12,
        vertical: 16,
      ),
      borderRadius: AppRadius.lgAll,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final crossCount = isWide ? items.length : 2;
          final itemWidth =
              (constraints.maxWidth - (crossCount - 1) * 8) / crossCount;

          return Wrap(
            spacing: 8,
            runSpacing: 12,
            children: items
                .map(
                  (item) => SizedBox(
                    width: itemWidth,
                    child: _PublicSupplierStatCell(item: item),
                  ),
                )
                .toList(growable: false),
          );
        },
      ),
    );
  }
}

class _PublicSupplierStatItem {
  const _PublicSupplierStatItem({
    required this.icon,
    required this.label,
    required this.value,
    required this.tone,
  });

  final IconData icon;
  final LocalizedText label;
  final int value;
  final AppStatusTone tone;
}

class _PublicSupplierStatCell extends StatelessWidget {
  const _PublicSupplierStatCell({required this.item});

  final _PublicSupplierStatItem item;

  @override
  Widget build(BuildContext context) {
    final statusStyle = AppStatusStyle.of(context, item.tone);
    final palette = MaterialsUiPalette.of(context);

    return AppSectionCard(
      padding: const EdgeInsetsDirectional.symmetric(horizontal: 8, vertical: 12),
      borderRadius: AppRadius.mdAll,
      tone: item.tone,
      child: Column(
        children: [
          Icon(item.icon, size: 18, color: statusStyle.foreground),
          const SizedBox(height: 6),
          Text(
            '${item.value}',
            style: AppTextStyles.title(context).copyWith(
              color: statusStyle.foreground,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            item.label.resolve(context),
            textAlign: TextAlign.center,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ],
      ),
    );
  }
}

class PublicSupplierTabBar extends StatelessWidget {
  const PublicSupplierTabBar({
    super.key,
    required this.selectedIndex,
    required this.onSelected,
  });

  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final tabs = [
      const LocalizedText(en: 'Overview', ar: 'نظرة عامة'),
      const LocalizedText(en: 'Materials', ar: 'المواد'),
    ];

    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(vertical: 6),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsetsDirectional.all(4),
        decoration: BoxDecoration(
          color: palette.cardSurfaceAlt,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: palette.borderSubtle),
        ),
        child: Row(
          children: List.generate(tabs.length, (index) {
            final selected = index == selectedIndex;

            return Expanded(
              child: Padding(
                padding: const EdgeInsetsDirectional.symmetric(horizontal: 2),
                child: Material(
                  color: selected ? palette.cardSurface : Colors.transparent,
                  elevation: selected ? 1 : 0,
                  shadowColor: palette.cardShadow.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                  child: InkWell(
                    key: ValueKey('public-supplier-tab-$index'),
                    borderRadius: BorderRadius.circular(10),
                    onTap: () => onSelected(index),
                    child: Padding(
                      padding: const EdgeInsetsDirectional.symmetric(
                        vertical: 12,
                      ),
                      child: Text(
                        tabs[index].resolve(context),
                        textAlign: TextAlign.center,
                        style: AppTextStyles.label(context).copyWith(
                          color: selected ? palette.mint : palette.textMuted,
                          fontWeight:
                              selected ? FontWeight.w700 : FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}
