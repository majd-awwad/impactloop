import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../data/models/supplier_profile.dart';
import '../theme/supplier_theme_extension.dart';
import 'profile_completion_card.dart';
import 'profile_material_preview_card.dart';
import 'materials/supplier_materials_grid.dart';
import 'supplier_location_privacy_card.dart';
import 'supplier_pickup_map.dart';
import 'supplier_verification_badge.dart';

class SupplierProfileHeader extends StatelessWidget {
  const SupplierProfileHeader({
    super.key,
    required this.profile,
    required this.onEdit,
    this.onChangeAvatar,
    this.onChangeCover,
    this.isUploadingAvatar = false,
    this.isUploadingCover = false,
  });

  final SupplierProfileResponse profile;
  final VoidCallback onEdit;
  final VoidCallback? onChangeAvatar;
  final VoidCallback? onChangeCover;
  final bool isUploadingAvatar;
  final bool isUploadingCover;

  @override
  Widget build(BuildContext context) {
    final supplier = profile.supplier;
    final colors = context.supplierColors;
    final title = (supplier?.publicName ?? '').trim().isNotEmpty
        ? supplier!.publicName
        : profile.user.displayName;
    final coverUrl = supplier?.coverImageUrl;
    final avatarUrl = supplier?.avatarImageUrl ?? profile.user.profileImageUrl;
    final resolvedCover = (coverUrl != null && coverUrl.trim().isNotEmpty)
        ? ApiConfig.resolveMediaUrl(coverUrl)
        : null;
    final resolvedAvatar = (avatarUrl != null && avatarUrl.trim().isNotEmpty)
        ? ApiConfig.resolveMediaUrl(avatarUrl)
        : null;
    final pickup = supplier?.defaultPickupLocation;
    final city = (pickup?.city ?? '').trim();
    final area = (pickup?.area ?? '').trim();
    final location = [
      if (city.isNotEmpty) city,
      if (area.isNotEmpty) area,
    ].join(', ');

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: ColoredBox(
        color: colors.surface,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: 200,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  resolvedCover == null
                      ? _coverGradient(colors)
                      : Image.network(
                          resolvedCover,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => _coverGradient(colors),
                        ),
                  if (onChangeCover != null)
                    Positioned(
                      top: 12,
                      right: 12,
                      child: _ImageActionButton(
                        icon: Icons.photo_camera_outlined,
                        label: 'Cover',
                        isLoading: isUploadingCover,
                        onPressed: onChangeCover!,
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Transform.translate(
                        offset: const Offset(0, -36),
                        child: GestureDetector(
                          onTap: isUploadingAvatar ? null : onChangeAvatar,
                          child: Stack(
                            clipBehavior: Clip.none,
                            children: [
                              Container(
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(color: colors.surface, width: 4),
                                ),
                                child: CircleAvatar(
                                  radius: 40,
                                  backgroundColor:
                                      colors.accent.withValues(alpha: 0.12),
                                  foregroundImage: resolvedAvatar == null
                                      ? null
                                      : NetworkImage(resolvedAvatar),
                                  child: resolvedAvatar == null
                                      ? Text(
                                          title.isNotEmpty
                                              ? title.characters.first.toUpperCase()
                                              : 'S',
                                          style: TextStyle(
                                            fontSize: 28,
                                            fontWeight: FontWeight.w800,
                                            color: colors.accent,
                                          ),
                                        )
                                      : isUploadingAvatar
                                          ? const SizedBox(
                                              width: 24,
                                              height: 24,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 2,
                                              ),
                                            )
                                          : null,
                                ),
                              ),
                              if (onChangeAvatar != null && !isUploadingAvatar)
                                Positioned(
                                  right: 0,
                                  bottom: 0,
                                  child: Container(
                                    width: 28,
                                    height: 28,
                                    decoration: BoxDecoration(
                                      color: colors.accent,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: colors.surface,
                                        width: 2,
                                      ),
                                    ),
                                    child: const Icon(
                                      Icons.camera_alt,
                                      size: 14,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                title,
                                style: context.supplierTitle().copyWith(
                                      fontSize: 24,
                                      fontWeight: FontWeight.w800,
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
                                      color: colors.textMuted,
                                    ),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Text(
                                        location,
                                        style: context.supplierBody(),
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
                      if ((supplier?.supplierType ?? '').trim().isNotEmpty)
                        _HeaderChip(
                          label: supplier!.supplierType.replaceAll('_', ' '),
                          icon: Icons.storefront_outlined,
                        ),
                      SupplierVerificationBadge(
                        status: supplier?.verificationStatus ?? 'UNVERIFIED',
                      ),
                    ],
                  ),
                  if ((supplier?.description ?? '').trim().isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      supplier!.description!,
                      style: context.supplierBody(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: onEdit,
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: Text(context.s.editSupplierProfile),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(44),
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

  Widget _coverGradient(SupplierUiPalette colors) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            colors.accent.withValues(alpha: 0.85),
            colors.accentMuted.withValues(alpha: 0.45),
            colors.accentSoft.withValues(alpha: 0.25),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
    );
  }
}

class _HeaderChip extends StatelessWidget {
  const _HeaderChip({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.accentSoft.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: colors.accent),
          const SizedBox(width: 6),
          Text(
            label,
            style: context.supplierChip().copyWith(color: colors.accent),
          ),
        ],
      ),
    );
  }
}

class _ImageActionButton extends StatelessWidget {
  const _ImageActionButton({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.45),
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: isLoading ? null : onPressed,
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isLoading)
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              else
                Icon(icon, size: 14, color: Colors.white),
              const SizedBox(width: 6),
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class SupplierProfileStatsBar extends StatelessWidget {
  const SupplierProfileStatsBar({
    super.key,
    required this.stats,
    required this.isWide,
    this.onFollowersTap,
  });

  final SupplierProfileStats stats;
  final bool isWide;
  final VoidCallback? onFollowersTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final items = [
      _StatItem(
        Icons.inventory_2_outlined,
        'Materials',
        stats.materialsCount,
        const Color(0xFF475569),
        const Color(0xFFF1F5F9),
      ),
      _StatItem(
        Icons.people_outline,
        'Followers',
        stats.followersCount,
        const Color(0xFF1D4ED8),
        const Color(0xFFEFF6FF),
        onTap: stats.followersCount > 0 ? onFollowersTap : null,
      ),
      _StatItem(
        Icons.visibility_outlined,
        'Views',
        stats.totalViews,
        const Color(0xFF0284C7),
        const Color(0xFFE0F2FE),
      ),
      _StatItem(
        Icons.favorite_border,
        'Likes',
        stats.totalLikes,
        const Color(0xFFDB2777),
        const Color(0xFFFCE7F3),
      ),
      _StatItem(
        Icons.check_circle_outline,
        'Available',
        stats.availableMaterialsCount,
        const Color(0xFF16A34A),
        const Color(0xFFDCFCE7),
      ),
      _StatItem(
        Icons.recycling_outlined,
        'Reused',
        stats.reusedMaterialsCount,
        const Color(0xFF0F766E),
        const Color(0xFFCCFBF1),
      ),
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: colors.cardShadow.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final crossCount = isWide ? 6 : 3;
          final itemWidth = (constraints.maxWidth - (crossCount - 1) * 8) / crossCount;
          return Wrap(
            spacing: 8,
            runSpacing: 12,
            children: items
                .map(
                  (item) => SizedBox(
                    width: itemWidth,
                    child: _StatCell(item: item),
                  ),
                )
                .toList(),
          );
        },
      ),
    );
  }
}

class _StatItem {
  const _StatItem(
    this.icon,
    this.label,
    this.value,
    this.accent,
    this.background, {
    this.onTap,
  });

  final IconData icon;
  final String label;
  final int value;
  final Color accent;
  final Color background;
  final VoidCallback? onTap;
}

class _StatCell extends StatelessWidget {
  const _StatCell({required this.item});

  final _StatItem item;

  @override
  Widget build(BuildContext context) {
    final cell = Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
      decoration: BoxDecoration(
        color: item.background.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: item.accent.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          Icon(item.icon, size: 18, color: item.accent),
          const SizedBox(height: 6),
          Text(
            '${item.value}',
            style: context.supplierTitle().copyWith(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: item.accent,
                ),
          ),
          const SizedBox(height: 2),
          Text(
            item.label,
            style: context.supplierBody().copyWith(
                  fontSize: 11,
                  color: context.supplierColors.textMuted,
                ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );

    if (item.onTap == null) {
      return cell;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: item.onTap,
        borderRadius: BorderRadius.circular(12),
        child: cell,
      ),
    );
  }
}

class ProfileViewBody extends StatelessWidget {
  const ProfileViewBody({
    super.key,
    required this.profile,
    required this.onViewAllMaterials,
    required this.onAddMaterial,
  });

  final SupplierProfileResponse profile;
  final VoidCallback onViewAllMaterials;
  final VoidCallback onAddMaterial;

  @override
  Widget build(BuildContext context) {
    final previewMaterials = profile.materialsPreview.take(4).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SectionCard(
          title: 'Latest materials',
          actionLabel: 'View all',
          onAction: onViewAllMaterials,
          child: previewMaterials.isEmpty
              ? _EmptyHint(
                  message: 'No materials added yet.',
                  actionLabel: 'Add material',
                  onAction: onAddMaterial,
                )
              : ProfileMaterialGrid(materials: previewMaterials),
        ),
        const SizedBox(height: AppSpacing.md),
        Align(
          alignment: Alignment.centerRight,
          child: OutlinedButton(
            onPressed: onViewAllMaterials,
            child: const Text('View all materials'),
          ),
        ),
      ],
    );
  }
}

class SupplierProfileTabBar extends StatelessWidget {
  const SupplierProfileTabBar({
    super.key,
    required this.selectedIndex,
    required this.onSelected,
  });

  final int selectedIndex;
  final ValueChanged<int> onSelected;

  static const _tabs = ['Overview', 'Followers', 'Detail'];

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Container(
        width: double.infinity,
        clipBehavior: Clip.none,
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: colors.backgroundElevated,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: colors.border.withValues(alpha: 0.35)),
        ),
        child: Row(
          children: List.generate(_tabs.length, (index) {
            final selected = index == selectedIndex;
            return Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: Material(
                  color: selected ? colors.surface : Colors.transparent,
                  elevation: selected ? 1 : 0,
                  shadowColor: colors.cardShadow.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: () => onSelected(index),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Text(
                        _tabs[index],
                        textAlign: TextAlign.center,
                        style: context.supplierLabel().copyWith(
                              color:
                                  selected ? colors.accent : colors.textMuted,
                              fontWeight: selected
                                  ? FontWeight.w700
                                  : FontWeight.w500,
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

class ProfileOverviewTab extends StatelessWidget {
  const ProfileOverviewTab({
    super.key,
    required this.profile,
    required this.onViewAllMaterials,
    required this.onAddMaterial,
  });

  final SupplierProfileResponse profile;
  final VoidCallback onViewAllMaterials;
  final VoidCallback onAddMaterial;

  @override
  Widget build(BuildContext context) {
    return ProfileViewBody(
      profile: profile,
      onViewAllMaterials: onViewAllMaterials,
      onAddMaterial: onAddMaterial,
    );
  }
}

class ProfileFollowersTab extends StatelessWidget {
  const ProfileFollowersTab({
    super.key,
    required this.followersCount,
    required this.followers,
    this.onViewAll,
  });

  final int followersCount;
  final List<SupplierFollowerPreviewItem> followers;
  final VoidCallback? onViewAll;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Followers ($followersCount)',
      actionLabel: followersCount > 0 ? 'View all' : null,
      onAction: onViewAll,
      child: followers.isEmpty
          ? Text(
              'No followers yet.',
              style: context.supplierBody().copyWith(
                    color: context.supplierColors.textMuted,
                  ),
            )
          : Column(
              children: [
                for (final follower in followers) _FollowerRow(follower: follower),
              ],
            ),
    );
  }
}

class ProfileDetailsSection extends StatelessWidget {
  const ProfileDetailsSection({super.key, required this.profile});

  final SupplierProfileResponse profile;

  String _displayValue(String? value) {
    final trimmed = value?.trim() ?? '';
    return trimmed.isEmpty ? 'Not provided yet.' : trimmed;
  }

  String _formatReviewedAt(DateTime? reviewedAt) {
    if (reviewedAt == null || reviewedAt.millisecondsSinceEpoch <= 0) {
      return 'Not provided yet.';
    }

    final month = reviewedAt.month.toString().padLeft(2, '0');
    final day = reviewedAt.day.toString().padLeft(2, '0');
    return '${reviewedAt.year}-$month-$day';
  }

  @override
  Widget build(BuildContext context) {
    final supplier = profile.supplier;
    final location = supplier?.defaultPickupLocation;
    final organization = supplier?.organizationProfile;
    final workingHours = organization?.workingHours;
    final hoursLabel = [
      if (workingHours?['from'] != null) workingHours!['from'],
      if (workingHours?['to'] != null) workingHours!['to'],
    ].join(' – ');
    final pickupArea = [
      location?.city,
      location?.area,
    ].whereType<String>().where((value) => value.trim().isNotEmpty).join(', ');
    final pickupSummary = [
      if ((location?.addressLine ?? '').trim().isNotEmpty) location!.addressLine,
      if ((location?.country ?? '').trim().isNotEmpty) location?.country,
    ].whereType<String>().where((value) => value.trim().isNotEmpty).join(', ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ProfileCompletionCard(profile: profile),
        const SizedBox(height: AppSpacing.lg),
        _SectionCard(
          title: 'Supplier information',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _DetailRow(
                icon: Icons.storefront_outlined,
                label: 'Public supplier name',
                value: _displayValue(supplier?.publicName),
              ),
              _DetailRow(
                icon: Icons.category_outlined,
                label: 'Supplier type',
                value: _displayValue(
                  supplier?.supplierType.replaceAll('_', ' '),
                ),
              ),
              _DetailRow(
                icon: Icons.info_outline,
                label: 'About',
                value: _displayValue(supplier?.description),
              ),
              const SizedBox(height: AppSpacing.sm),
              SupplierVerificationBadge(
                status: supplier?.verificationStatus ?? 'UNVERIFIED',
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _SectionCard(
          title: 'Pickup information',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _DetailRow(
                icon: Icons.location_city_outlined,
                label: 'City / area',
                value: pickupArea.isEmpty
                    ? 'Not provided yet.'
                    : pickupArea,
              ),
              _DetailRow(
                icon: Icons.location_on_outlined,
                label: 'Pickup location summary',
                value: pickupSummary.isEmpty
                    ? 'Not provided yet.'
                    : pickupSummary,
              ),
              _DetailRow(
                icon: Icons.notes_outlined,
                label: 'Pickup notes',
                value: 'Not provided yet.',
              ),
              _DetailRow(
                icon: Icons.local_shipping_outlined,
                label: 'Pickup & delivery',
                value: 'Not provided yet.',
              ),
              _DetailRow(
                icon: Icons.calendar_today_outlined,
                label: 'Working days',
                value: (organization?.workingDays ?? []).isEmpty
                    ? 'Not provided yet.'
                    : organization!.workingDays!.join(', '),
              ),
              _DetailRow(
                icon: Icons.schedule_outlined,
                label: 'Working hours',
                value: hoursLabel.isEmpty ? 'Not provided yet.' : hoursLabel,
              ),
              if (location?.latitude != null && location?.longitude != null) ...[
                const SizedBox(height: AppSpacing.sm),
                SizedBox(
                  height: 180,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: SupplierPickupMap(
                      latitude: location?.latitude,
                      longitude: location?.longitude,
                      fallbackCity: location?.city,
                      fallbackArea: location?.area,
                      fallbackCountry: location?.country,
                      visibility: location?.visibility,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _SectionCard(
          title: 'Privacy / visibility',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _DetailRow(
                icon: Icons.visibility_outlined,
                label: 'Location privacy status',
                value: _displayValue(
                  location?.visibility?.replaceAll('_', ' '),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              SupplierLocationPrivacyCard(visibility: location?.visibility),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _SectionCard(
          title: 'Verification',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SupplierVerificationBadge(
                status: supplier?.verificationStatus ?? 'UNVERIFIED',
              ),
              const SizedBox(height: AppSpacing.sm),
              _DetailRow(
                icon: Icons.feedback_outlined,
                label: 'Admin note',
                value: _displayValue(supplier?.verificationAdminNote),
              ),
              _DetailRow(
                icon: Icons.event_outlined,
                label: 'Reviewed date',
                value: _formatReviewedAt(supplier?.verificationReviewedAt),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class ProfileMaterialGrid extends StatelessWidget {
  const ProfileMaterialGrid({
    super.key,
    required this.materials,
  });

  final List<SupplierMaterialPreviewItem> materials;

  @override
  Widget build(BuildContext context) {
    return SupplierMaterialsGrid(
      itemCount: materials.length,
      itemBuilder: (context, index) => ProfileMaterialPreviewCard(
        material: materials[index],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.child,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final Widget child;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: colors.cardShadow.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(title, style: context.supplierSectionTitle()),
              ),
              if (actionLabel != null && onAction != null)
                TextButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          child,
        ],
      ),
    );
  }
}

class _FollowerRow extends StatelessWidget {
  const _FollowerRow({required this.follower});

  final SupplierFollowerPreviewItem follower;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final name = follower.displayName.trim().isNotEmpty
        ? follower.displayName
        : follower.email;
    final resolved = (follower.profileImageUrl != null &&
            follower.profileImageUrl!.trim().isNotEmpty)
        ? ApiConfig.resolveMediaUrl(follower.profileImageUrl!)
        : null;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: colors.accent.withValues(alpha: 0.12),
            foregroundImage: resolved == null ? null : NetworkImage(resolved),
            child: resolved == null
                ? Text(
                    name.characters.first.toUpperCase(),
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: colors.accent,
                      fontSize: 12,
                    ),
                  )
                : null,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              name,
              style: context.supplierLabel(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: colors.accent),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: context.supplierBody().copyWith(
                        fontSize: 12,
                        color: colors.textMuted,
                      ),
                ),
                Text(
                  value.isEmpty ? 'Not provided yet.' : value,
                  style: context.supplierLabel(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyHint extends StatelessWidget {
  const _EmptyHint({
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          message,
          style: context.supplierBody().copyWith(color: colors.textMuted),
        ),
        const SizedBox(height: 8),
        TextButton(onPressed: onAction, child: Text(actionLabel)),
      ],
    );
  }
}
