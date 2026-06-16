import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../data/models/supplier_profile.dart';
import '../../data/models/supplier_profile_location.dart';
import 'supplier_type_selector.dart';
import 'supplier_verification_badge.dart';

String supplierProfileHeading(String supplierType) {
  if (isOrganizationSupplierType(supplierType)) {
    return 'Organization profile';
  }
  if (supplierType == 'STUDENT_SUPPLIER') {
    return 'Student supplier';
  }
  return 'Supplier profile';
}

class SupplierProfileIdentityCard extends StatelessWidget {
  const SupplierProfileIdentityCard({
    super.key,
    required this.profile,
    required this.onEdit,
  });

  final SupplierProfileResponse profile;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final supplier = profile.supplier;
    final displayName = supplier?.publicName.isNotEmpty == true
        ? supplier!.publicName
        : profile.user.displayName;
    final location = supplier?.defaultPickupLocation;
    final profileImageUrl = profile.user.profileImageUrl;
    final isCompact = MediaQuery.sizeOf(context).width < 720;

    return Container(
      width: double.infinity,
      decoration: SupplierDecorations.profileGlassCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            height: 4,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AuthDarkColors.accent.withValues(alpha: 0.05),
                  AuthDarkColors.accent,
                  AuthDarkColors.accent.withValues(alpha: 0.05),
                ],
              ),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(24),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (isCompact)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _AvatarBlock(
                        displayName: displayName,
                        profileImageUrl: profileImageUrl,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      _IdentityDetails(
                        profile: profile,
                        displayName: displayName,
                        location: location,
                        supplier: supplier,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      _EditButton(onEdit: onEdit, compact: true),
                    ],
                  )
                else
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _AvatarBlock(
                        displayName: displayName,
                        profileImageUrl: profileImageUrl,
                      ),
                      const SizedBox(width: AppSpacing.lg),
                      Expanded(
                        child: _IdentityDetails(
                          profile: profile,
                          displayName: displayName,
                          location: location,
                          supplier: supplier,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      _EditButton(onEdit: onEdit, compact: false),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AvatarBlock extends StatelessWidget {
  const _AvatarBlock({
    required this.displayName,
    this.profileImageUrl,
  });

  final String displayName;
  final String? profileImageUrl;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 84,
          height: 84,
          decoration: SupplierDecorations.avatarCircle,
          clipBehavior: Clip.antiAlias,
          child: profileImageUrl != null && profileImageUrl!.isNotEmpty
              ? Image.network(
                  profileImageUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) =>
                      _InitialsAvatar(name: displayName),
                )
              : _InitialsAvatar(name: displayName),
        ),
        Positioned(
          right: -2,
          bottom: -2,
          child: Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AuthDarkColors.surfaceSolid,
              shape: BoxShape.circle,
              border: Border.all(color: AuthDarkColors.accent),
            ),
            child: const Icon(
              Icons.storefront_outlined,
              size: 14,
              color: AuthDarkColors.accent,
            ),
          ),
        ),
      ],
    );
  }
}

class _InitialsAvatar extends StatelessWidget {
  const _InitialsAvatar({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        name.characters.first.toUpperCase(),
        style: AuthDarkTextStyles.title(context).copyWith(
          color: AuthDarkColors.accent,
          fontSize: 28,
        ),
      ),
    );
  }
}

class _IdentityDetails extends StatelessWidget {
  const _IdentityDetails({
    required this.profile,
    required this.displayName,
    required this.location,
    required this.supplier,
  });

  final SupplierProfileResponse profile;
  final String displayName;
  final SupplierProfileLocation? location;
  final SupplierProfileDetails? supplier;

  @override
  Widget build(BuildContext context) {
    final details = supplier;
    final pickup = location;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          displayName,
          style: AuthDarkTextStyles.display(context).copyWith(fontSize: 28),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(profile.user.email, style: AuthDarkTextStyles.body(context)),
        if (details != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            supplierProfileHeading(details.supplierType),
            style: AuthDarkTextStyles.label(context).copyWith(
              color: AuthDarkColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              if (details.supplierType.isNotEmpty)
                _MetaChip(
                  icon: Icons.badge_outlined,
                  label: supplierTypeLabel(details.supplierType),
                ),
              SupplierVerificationBadge(status: details.verificationStatus),
              if (pickup != null)
                _MetaChip(
                  icon: Icons.location_on_outlined,
                  label: pickup.summary.isNotEmpty
                      ? pickup.summary
                      : '${pickup.city}, ${pickup.country}',
                ),
            ],
          ),
        ],
        if (details?.description?.isNotEmpty == true) ...[
          const SizedBox(height: AppSpacing.md),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: SupplierDecorations.profileSectionPanel,
            child: Text(
              details!.description!,
              style: AuthDarkTextStyles.body(context).copyWith(
                color: AuthDarkColors.textPrimary.withValues(alpha: 0.88),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: SupplierDecorations.badge(
        background: AuthDarkColors.accentSoft.withValues(alpha: 0.14),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AuthDarkColors.accent),
          const SizedBox(width: 6),
          Text(label, style: AuthDarkTextStyles.chip(context)),
        ],
      ),
    );
  }
}

class _EditButton extends StatelessWidget {
  const _EditButton({required this.onEdit, required this.compact});

  final VoidCallback onEdit;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final button = OutlinedButton.icon(
      onPressed: onEdit,
      icon: const Icon(Icons.edit_outlined, size: 18),
      label: const Text('Edit Profile'),
      style: OutlinedButton.styleFrom(
        foregroundColor: AuthDarkColors.textPrimary,
        backgroundColor: AuthDarkColors.surfaceSolid.withValues(alpha: 0.45),
        side: BorderSide(color: AuthDarkColors.border.withValues(alpha: 0.55)),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
      ),
    );

    if (compact) {
      return SizedBox(width: double.infinity, child: button);
    }

    return button;
  }
}
