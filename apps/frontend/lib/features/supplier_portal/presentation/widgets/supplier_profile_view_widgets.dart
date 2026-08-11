import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../../../shared/utils/profile_avatar_url.dart';
import '../../../../shared/widgets/app_section_card.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/supplier_verification_status_presentation.dart';
import '../../data/models/supplier_profile_location.dart';
import '../../data/models/supplier_profile.dart';
import '../theme/supplier_theme_extension.dart';
import 'supplier_pickup_map.dart';

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

  final SupplierProfileManagement profile;
  final VoidCallback onEdit;
  final VoidCallback? onChangeAvatar;
  final VoidCallback? onChangeCover;
  final bool isUploadingAvatar;
  final bool isUploadingCover;

  @override
  Widget build(BuildContext context) {
    final identity = profile.identity;
    final location = profile.pickupLocation;
    final colors = context.supplierColors;
    final title =
        _value(identity?.publicName) ?? context.s.supplierFallbackName;
    final coverUrl = _mediaUrl(identity?.coverImageUrl);
    final avatarUrl = _avatarMediaUrl(identity?.avatarImageUrl);
    final locationLabel = [
      _value(location?.city),
      _value(location?.area),
    ].whereType<String>().join(', ');
    final width = MediaQuery.sizeOf(context).width;
    final isMobile = width < 600;
    final coverHeight = isMobile ? 146.0 : 182.0;
    final avatarSize = isMobile ? 82.0 : 98.0;

    Widget identityContent({required bool compact}) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                title,
                style: context.supplierTitle().copyWith(
                  fontSize: isMobile ? 21 : 23,
                  fontWeight: FontWeight.w800,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (!compact) ...[
              const SizedBox(width: AppSpacing.md),
              Tooltip(
                message: context.s.editProfile,
                child: Semantics(
                  button: true,
                  label: context.s.editSupplierProfile,
                  child: OutlinedButton.icon(
                    onPressed: onEdit,
                    icon: const Icon(Icons.edit_outlined, size: 17),
                    label: Text(context.s.editProfile),
                    style: _compactButtonStyle(context),
                  ),
                ),
              ),
            ],
          ],
        ),
        if (locationLabel.isNotEmpty) ...[
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(
                Icons.location_on_outlined,
                size: 16,
                color: colors.textSecondary,
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  locationLabel,
                  style: context.supplierBody(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          children: [
            if (_value(identity?.supplierType) != null)
              _SoftChip(
                icon: Icons.storefront_outlined,
                label: context.s.supplierTypeLabel(identity!.supplierType),
              ),
            _StatusBadge(status: profile.verification.status),
          ],
        ),
        if (_value(identity?.description) != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            identity!.description!.trim(),
            style: context.supplierBody(),
            maxLines: compact ? 3 : 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
        if (compact) ...[
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: Tooltip(
              message: context.s.editProfile,
              child: Semantics(
                button: true,
                label: context.s.editSupplierProfile,
                child: OutlinedButton.icon(
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_outlined, size: 17),
                  label: Text(context.s.editProfile),
                  style: _compactButtonStyle(context),
                ),
              ),
            ),
          ),
        ],
      ],
    );

    return AppSectionCard(
      padding: EdgeInsets.zero,
      borderRadius: BorderRadius.circular(18),
      emphasized: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: coverHeight,
            child: Stack(
              fit: StackFit.expand,
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(18),
                  ),
                  child: coverUrl == null
                      ? ColoredBox(
                          color: colors.isDark
                              ? colors.background
                              : Colors.black,
                        )
                      : Image.network(
                          coverUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => ColoredBox(
                            color: colors.isDark
                                ? colors.background
                                : Colors.black,
                          ),
                        ),
                ),
                if (onChangeCover != null)
                  PositionedDirectional(
                    top: 14,
                    end: 14,
                    child: _ImageEditButton(
                      label: context.s.editCover,
                      icon: Icons.photo_camera_outlined,
                      onPressed: onChangeCover!,
                      isLoading: isUploadingCover,
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsetsDirectional.fromSTEB(
              isMobile ? AppSpacing.md : AppSpacing.lg,
              28,
              isMobile ? AppSpacing.md : AppSpacing.lg,
              AppSpacing.md,
            ),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxWidth < 560;
                final avatar = Semantics(
                  button: onChangeAvatar != null,
                  label: context.s.editProfilePhoto,
                  child: GestureDetector(
                    onTap: isUploadingAvatar ? null : onChangeAvatar,
                    child: _Avatar(
                      url: avatarUrl,
                      title: title,
                      size: avatarSize,
                      isLoading: isUploadingAvatar,
                      onEdit: onChangeAvatar,
                    ),
                  ),
                );

                if (compact) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Transform.translate(
                        offset: Offset(0, -avatarSize / 2 - 28),
                        child: Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: avatar,
                        ),
                      ),
                      Transform.translate(
                        offset: Offset(0, -avatarSize / 2 - 12),
                        child: identityContent(compact: true),
                      ),
                    ],
                  );
                }

                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Transform.translate(
                      offset: Offset(0, -avatarSize / 2 - 28),
                      child: avatar,
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Transform.translate(
                        offset: const Offset(0, -14),
                        child: identityContent(compact: false),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class ProfileDetailsSection extends StatelessWidget {
  const ProfileDetailsSection({
    super.key,
    required this.profile,
    required this.onEdit,
    this.onVerificationAction,
  });

  final SupplierProfileManagement profile;
  final VoidCallback onEdit;
  final VoidCallback? onVerificationAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _CompletionCard(completion: profile.completion, onEdit: onEdit),
        const SizedBox(height: AppSpacing.lg),
        LayoutBuilder(
          builder: (context, constraints) {
            final twoColumns = constraints.maxWidth >= 940;
            final identity = _IdentityCard(profile: profile);
            final availability = _AvailabilityCard(profile: profile);
            final location = _LocationCard(profile: profile);

            if (!twoColumns) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  identity,
                  const SizedBox(height: AppSpacing.md),
                  availability,
                  const SizedBox(height: AppSpacing.md),
                  location,
                ],
              );
            }

            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 43,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      identity,
                      const SizedBox(height: AppSpacing.md),
                      availability,
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(flex: 57, child: location),
              ],
            );
          },
        ),
        const SizedBox(height: AppSpacing.md),
        _VerificationCard(
          verification: profile.verification,
          onAction: onVerificationAction,
        ),
      ],
    );
  }
}

class SupplierProfileLoadingSkeleton extends StatelessWidget {
  const SupplierProfileLoadingSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final compact = width < 600;
    return SingleChildScrollView(
      padding: context.supplierDecorations.pagePadding(compact: compact),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SkeletonCard(height: compact ? 310 : 390),
          const SizedBox(height: AppSpacing.lg),
          _SkeletonCard(height: 100),
          const SizedBox(height: AppSpacing.lg),
          LayoutBuilder(
            builder: (context, constraints) => constraints.maxWidth >= 940
                ? Row(
                    children: [
                      const Expanded(child: _SkeletonCard(height: 300)),
                      const SizedBox(width: AppSpacing.md),
                      const Expanded(child: _SkeletonCard(height: 420)),
                    ],
                  )
                : const Column(
                    children: [
                      _SkeletonCard(height: 300),
                      SizedBox(height: AppSpacing.md),
                      _SkeletonCard(height: 420),
                    ],
                  ),
          ),
          const SizedBox(height: AppSpacing.md),
          const _SkeletonCard(height: 220),
        ],
      ),
    );
  }
}

class _CompletionCard extends StatelessWidget {
  const _CompletionCard({required this.completion, required this.onEdit});

  final SupplierProfileManagementCompletion completion;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final percentage = completion.percentage.clamp(0, 100);
    final incomplete = percentage < 100;
    final missing = completion.missingFields
        .map((field) => _completionLabel(context, field))
        .whereType<String>()
        .toList(growable: false);

    if (!incomplete) {
      return AppSectionCard(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        child: Row(
          children: [
            Icon(
              Icons.check_circle_outline,
              color: context.supplierColors.accent,
              size: 22,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    context.s.essentialsCompleteTitle,
                    style: context.supplierLabel().copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    context.s.essentialsComplete(
                      completion.completedCount,
                      completion.totalCount,
                    ),
                    style: context.supplierBody(),
                  ),
                ],
              ),
            ),
            Text(
              '$percentage%',
              style: context.supplierLabel().copyWith(
                color: context.supplierColors.accent,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      );
    }

    return AppSectionCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  context.s.profileCompletion,
                  style: context.supplierSectionTitle(),
                ),
              ),
              if (incomplete)
                Tooltip(
                  message: context.s.editProfile,
                  child: Semantics(
                    button: true,
                    label: context.s.editProfileCompletionDetails,
                    child: OutlinedButton.icon(
                      onPressed: onEdit,
                      icon: const Icon(Icons.edit_outlined, size: 16),
                      label: Text(context.s.editProfile),
                      style: _compactButtonStyle(context),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            context.s.essentialsComplete(
              completion.completedCount,
              completion.totalCount,
            ),
            style: context.supplierBody(),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: Semantics(
                  label: context.s.profileCompletionPercent(percentage),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      minHeight: 9,
                      value: percentage / 100,
                      backgroundColor: context.supplierColors.chipUnselected,
                      color: context.supplierColors.accent,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                '$percentage%',
                style: context.supplierLabel().copyWith(
                  color: context.supplierColors.accent,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          if (missing.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              context.s.missingFields(missing.join(', ')),
              style: context.supplierBody().copyWith(
                color: context.supplierColors.textMuted,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _IdentityCard extends StatelessWidget {
  const _IdentityCard({required this.profile});

  final SupplierProfileManagement profile;

  @override
  Widget build(BuildContext context) {
    final identity = profile.identity;
    final organization = profile.organization;
    final organizationName = _value(organization?.organizationName);
    final contactPerson = _value(organization?.contactPersonName);
    return _ProfileCard(
      title: context.s.businessIdentity,
      icon: Icons.business_outlined,
      child: identity == null
          ? _EmptyState(message: context.s.profileIntroNoProfile)
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _InfoRow(
                  icon: Icons.storefront_outlined,
                  label: context.s.publicName,
                  value: identity.publicName,
                ),
                _InfoRow(
                  icon: Icons.category_outlined,
                  label: context.s.supplierType,
                  value: _value(identity.supplierType) == null
                      ? null
                      : context.s.supplierTypeLabel(identity.supplierType),
                ),
                if (_value(identity.description) != null)
                  _DescriptionBlock(description: identity.description!),
                if (organizationName != null &&
                    _normalizeForComparison(organizationName) !=
                        _normalizeForComparison(identity.publicName))
                  _InfoRow(
                    icon: Icons.apartment_outlined,
                    label: context.s.organizationName,
                    value: organizationName,
                  ),
                if (contactPerson != null)
                  _InfoRow(
                    icon: Icons.person_outline,
                    label: context.s.contactPerson,
                    value: contactPerson,
                  ),
              ],
            ),
    );
  }
}

class _AvailabilityCard extends StatelessWidget {
  const _AvailabilityCard({required this.profile});

  final SupplierProfileManagement profile;

  @override
  Widget build(BuildContext context) {
    final organization = profile.organization;
    final dayPresentation = _workingDaysPresentation(
      context,
      organization?.workingDays,
    );
    final hours = organization?.workingHours;
    final hoursLabel = _hoursLabel(hours);
    final hasSchedule =
        dayPresentation.range != null ||
        dayPresentation.chips.isNotEmpty ||
        hoursLabel != null;

    return _ProfileCard(
      title: context.s.workingAvailability,
      icon: Icons.schedule_outlined,
      child: !hasSchedule
          ? _EmptyState(
              message: context.s.workingAvailabilityMissing,
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (dayPresentation.range != null ||
                    dayPresentation.chips.isNotEmpty) ...[
                  _RowLabel(
                    icon: Icons.calendar_month_outlined,
                    label: context.s.workingDays,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  if (dayPresentation.range != null)
                    Text(dayPresentation.range!, style: context.supplierBody())
                  else
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      children: dayPresentation.chips
                          .map((day) => _DayChip(label: day))
                          .toList(growable: false),
                    ),
                ],
                if (hoursLabel != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  _InfoRow(
                    icon: Icons.schedule_outlined,
                    label: context.s.workingHours,
                    value: hoursLabel,
                  ),
                ],
              ],
            ),
    );
  }
}

class _LocationCard extends StatelessWidget {
  const _LocationCard({required this.profile});

  final SupplierProfileManagement profile;

  @override
  Widget build(BuildContext context) {
    final location = profile.pickupLocation;
    final cityArea = [
      _value(location?.city),
      _value(location?.area),
    ].whereType<String>().join(', ');
    final hasCoordinates = location?.hasCoordinates == true;

    return _ProfileCard(
      title: context.s.pickupLocationAndPrivacy,
      icon: Icons.location_on_outlined,
      child: location == null
          ? _EmptyState(message: context.s.pickupAreaNotSet)
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _InfoRow(
                  icon: Icons.location_city_outlined,
                  label: context.s.cityArea,
                  value: cityArea,
                ),
                _InfoRow(
                  icon: Icons.place_outlined,
                  label: context.s.pickupAddress,
                  value: location.addressLine,
                ),
                if (_value(location.country) != null)
                  _InfoRow(
                    icon: Icons.public_outlined,
                    label: context.s.country,
                    value: location.country,
                  ),
                const SizedBox(height: AppSpacing.sm),
                _PrivacyBlock(location: location),
                const SizedBox(height: AppSpacing.md),
                Semantics(
                  label: context.s.pickupLocationMap,
                  child: SupplierPickupMap(
                    latitude: location.latitude,
                    longitude: location.longitude,
                    compact: true,
                    showPanelChrome: false,
                  ),
                ),
                if (hasCoordinates) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    context.s.savedPickupLocation,
                    style: context.supplierBody().copyWith(
                      color: context.supplierColors.textSecondary,
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}

class _PrivacyBlock extends StatelessWidget {
  const _PrivacyBlock({required this.location});

  final SupplierProfileLocation location;

  @override
  Widget build(BuildContext context) {
    final meaning = _privacyMeaning(
      context,
      location.visibility,
      location.isApproximate,
    );
    final colors = context.supplierColors;
    final known = _normalizeVisibility(location.visibility) != null;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: context.supplierDecorations.profileSectionPanel,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.shield_outlined,
            color: known ? colors.blueAccent : colors.textSecondary,
            size: 19,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  meaning.title,
                  style: context.supplierLabel().copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  meaning.explanation,
                  style: context.supplierBody().copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _VerificationCard extends StatelessWidget {
  const _VerificationCard({required this.verification, this.onAction});

  final SupplierProfileManagementVerification verification;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final status = verification.status.trim().toUpperCase();
    final showAdminNote =
        (status == 'CHANGES_REQUESTED' || status == 'REJECTED') &&
        _value(verification.adminNote) != null;
    final actionLabel = status == 'UNVERIFIED'
        ? context.s.submitForReview
        : context.s.resubmit;

    return AppSectionCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      emphasized: true,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final narrow = constraints.maxWidth < 560;
          final details = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.verified_user_outlined,
                    size: 19,
                    color: context.supplierColors.textSecondary,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    context.s.verification,
                    style: context.supplierSectionTitle(),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              if (status != 'APPROVED') ...[
                _StatusBadge(status: status),
                const SizedBox(height: AppSpacing.sm),
              ],
              Text(
                _verificationMessage(context, status),
                style: context.supplierLabel().copyWith(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              if (status == 'APPROVED')
                Text(
                  context.s.thanksVerificationCommunity,
                  style: context.supplierBody(),
                ),
              if (verification.reviewedAt != null)
                _VerificationDate(
                  label: context.s.reviewedDate,
                  date: verification.reviewedAt!,
                ),
              if (status == 'PENDING' && verification.submittedAt != null)
                _VerificationDate(
                  label: context.s.submittedDate,
                  date: verification.submittedAt!,
                ),
              if (showAdminNote) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  context.s.verificationAdminNoteLabel,
                  style: context.supplierLabel().copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  verification.adminNote!.trim(),
                  style: context.supplierBody(),
                ),
              ],
              if (onAction != null &&
                  (status == 'UNVERIFIED' ||
                      status == 'CHANGES_REQUESTED' ||
                      status == 'REJECTED')) ...[
                const SizedBox(height: AppSpacing.md),
                OutlinedButton.icon(
                  onPressed: onAction,
                  icon: const Icon(Icons.arrow_forward_outlined, size: 17),
                  label: Text(actionLabel),
                  style: _compactButtonStyle(context),
                ),
              ],
            ],
          );

          final illustration = Container(
            width: narrow ? 64 : 92,
            height: narrow ? 64 : 92,
            decoration: BoxDecoration(
              color: context.supplierColors.accentSoft.withValues(alpha: 0.18),
              shape: BoxShape.circle,
            ),
            child: Icon(
              status == 'APPROVED'
                  ? Icons.verified_user_outlined
                  : Icons.shield_outlined,
              size: narrow ? 34 : 46,
              color: context.supplierColors.accent,
            ),
          );

          if (narrow) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                illustration,
                const SizedBox(height: AppSpacing.md),
                details,
              ],
            );
          }

          return Row(
            children: [
              Expanded(child: details),
              const SizedBox(width: AppSpacing.xl),
              illustration,
            ],
          );
        },
      ),
    );
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({
    required this.title,
    required this.icon,
    required this.child,
  });

  final String title;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AppSectionCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: context.supplierColors.accent),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(title, style: context.supplierSectionTitle()),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    final normalized = _value(value);
    if (normalized == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: context.supplierColors.textSecondary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: context.supplierBody().copyWith(
                    fontSize: 12,
                    color: context.supplierColors.textSecondary,
                  ),
                ),
                Text(
                  normalized,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
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

class _RowLabel extends StatelessWidget {
  const _RowLabel({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, size: 18, color: context.supplierColors.textSecondary),
      const SizedBox(width: AppSpacing.sm),
      Text(label, style: context.supplierLabel()),
    ],
  );
}

class _DescriptionBlock extends StatelessWidget {
  const _DescriptionBlock({required this.description});

  final String description;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.s.description,
            style: context.supplierBody().copyWith(
              fontSize: 12,
              color: context.supplierColors.textSecondary,
            ),
          ),
          const SizedBox(height: 3),
          Text(description.trim(), style: context.supplierBody()),
        ],
      ),
    );
  }
}

class _DayChip extends StatelessWidget {
  const _DayChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: 10,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        color: colors.backgroundElevated,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.border.withValues(alpha: 0.7)),
      ),
      child: Text(
        label,
        style: context.supplierChip().copyWith(color: colors.textSecondary),
      ),
    );
  }
}

class _SoftChip extends StatelessWidget {
  const _SoftChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: 10,
        vertical: 6,
      ),
      decoration: BoxDecoration(
        color: colors.backgroundElevated,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.border.withValues(alpha: 0.7)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: colors.textSecondary),
          const SizedBox(width: 5),
          Text(
            label,
            style: context.supplierChip().copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) => AppStatusBadge(
    label: _verificationLabel(context, status),
    tone: supplierVerificationStatusTone(
      status == 'APPROVED' ? 'VERIFIED' : status,
    ),
  );
}

class _VerificationDate extends StatelessWidget {
  const _VerificationDate({required this.label, required this.date});

  final String label;
  final DateTime date;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: AppSpacing.sm),
    child: _InfoRow(
      icon: Icons.event_outlined,
      label: label,
      value: _formatDate(date),
    ),
  );
}

class _ImageEditButton extends StatelessWidget {
  const _ImageEditButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    required this.isLoading,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final bool isLoading;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label,
    child: OutlinedButton.icon(
      onPressed: isLoading ? null : onPressed,
      icon: isLoading
          ? const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Colors.white,
              ),
            )
          : Icon(icon, size: 16),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: Colors.white,
        side: BorderSide(color: Colors.white.withValues(alpha: 0.75)),
        backgroundColor: Colors.black.withValues(alpha: 0.38),
        minimumSize: const Size(0, 40),
        padding: const EdgeInsetsDirectional.symmetric(horizontal: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      ),
    ),
  );
}

class _Avatar extends StatelessWidget {
  const _Avatar({
    required this.url,
    required this.title,
    required this.size,
    required this.isLoading,
    required this.onEdit,
  });

  final String? url;
  final String title;
  final double size;
  final bool isLoading;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final content = url == null
        ? ColoredBox(
            color: colors.accentSoft,
            child: Center(
              child: Text(
                title.characters.first.toUpperCase(),
                style: TextStyle(
                  color: colors.accent,
                  fontSize: size * 0.3,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          )
        : Image.network(
            url!,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => ColoredBox(
              color: colors.accentSoft,
              child: Center(
                child: Text(
                  title.characters.first.toUpperCase(),
                  style: TextStyle(
                    color: colors.accent,
                    fontSize: size * 0.3,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          );

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: size,
          height: size,
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: colors.surfaceSolid,
            shape: BoxShape.circle,
            border: Border.all(color: colors.surfaceSolid, width: 2),
          ),
          child: ClipOval(child: content),
        ),
        if (onEdit != null)
          PositionedDirectional(
            bottom: 0,
            end: 0,
            child: Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: colors.accent,
                shape: BoxShape.circle,
                border: Border.all(color: colors.surfaceSolid, width: 2),
              ),
              child: isLoading
                  ? const Padding(
                      padding: EdgeInsets.all(7),
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(
                      Icons.camera_alt_outlined,
                      size: 15,
                      color: Colors.white,
                    ),
            ),
          ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Text(
    message,
    style: context.supplierBody().copyWith(
      color: context.supplierColors.textMuted,
    ),
  );
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) => AppSectionCard(
    height: height,
    child: DecoratedBox(
      decoration: BoxDecoration(
        color: context.supplierColors.chipUnselected.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(10),
      ),
    ),
  );
}

ButtonStyle _compactButtonStyle(BuildContext context) =>
    OutlinedButton.styleFrom(
      foregroundColor: context.supplierColors.accent,
      side: BorderSide(
        color: context.supplierColors.accent.withValues(alpha: 0.45),
      ),
      minimumSize: const Size(0, 40),
      padding: const EdgeInsetsDirectional.symmetric(horizontal: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    );

String? _value(String? value) {
  final trimmed = value?.trim() ?? '';
  return trimmed.isEmpty ? null : trimmed;
}

String _normalizeForComparison(String? value) {
  return (value ?? '').trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');
}

String? _mediaUrl(String? value) {
  final normalized = _value(value);
  return normalized == null ? null : ApiConfig.resolveMediaUrl(normalized);
}

String? _avatarMediaUrl(String? value) {
  final effective = effectiveProfileAvatarUrl(value);
  return effective == null ? null : ApiConfig.resolveMediaUrl(effective);
}

String? _hoursLabel(Map<String, String>? hours) {
  if (hours == null) return null;
  final from = _value(hours['from'] ?? hours['start']);
  final to = _value(hours['to'] ?? hours['end']);
  if (from == null && to == null) return null;
  if (from == null) return to;
  if (to == null) return from;
  return '$from–$to';
}

String? _dayLabel(BuildContext context, String value) {
  final label = context.s.profileDayLabel(value);
  return label == value.trim() ? _value(value) : label;
}

({String? range, List<String> chips}) _workingDaysPresentation(
  BuildContext context,
  List<String>? values,
) {
  final indexed = <int, String>{};
  for (final value in values ?? const <String>[]) {
    final index = _dayIndex(value);
    final label = _dayLabel(context, value);
    if (index != null && label != null) indexed[index] = label;
  }

  final orderedIndexes = indexed.keys.toList()..sort();
  if (orderedIndexes.length >= 2 &&
      orderedIndexes.last - orderedIndexes.first + 1 == orderedIndexes.length) {
    return (
      range: '${indexed[orderedIndexes.first]}–${indexed[orderedIndexes.last]}',
      chips: const <String>[],
    );
  }

  return (
    range: null,
    chips: orderedIndexes
        .map((index) => indexed[index]!)
        .toList(growable: false),
  );
}

int? _dayIndex(String value) {
  return switch (value.trim().toUpperCase().replaceAll(' ', '_')) {
    'SUNDAY' || 'SUN' => 0,
    'MONDAY' || 'MON' => 1,
    'TUESDAY' || 'TUE' || 'TUES' => 2,
    'WEDNESDAY' || 'WED' => 3,
    'THURSDAY' || 'THU' || 'THURS' => 4,
    'FRIDAY' || 'FRI' => 5,
    'SATURDAY' || 'SAT' => 6,
    _ => null,
  };
}

String _verificationLabel(BuildContext context, String value) =>
    context.s.profileVerificationBadgeLabel(value);

String _verificationMessage(BuildContext context, String value) =>
    context.s.profileVerificationMessage(value);

String? _completionLabel(BuildContext context, String value) {
  return switch (value.trim().toUpperCase()) {
    'PUBLIC_NAME' => context.s.publicName,
    'SUPPLIER_TYPE' => context.s.supplierType,
    'DESCRIPTION' => context.s.description,
    'PICKUP_LOCATION' => context.s.pickupLocationLabel,
    'LOCATION_VISIBILITY' => context.s.locationPrivacy,
    _ => null,
  };
}

({String title, String explanation}) _privacyMeaning(
  BuildContext context,
  String? visibility,
  bool approximate,
) => context.s.profilePrivacyMeaning(visibility, approximate);

String? _normalizeVisibility(String? value) {
  final normalized = value?.trim().toUpperCase();
  return switch (normalized) {
    'PUBLIC_APPROXIMATE' || 'PUBLIC' => 'PUBLIC',
    'ORDER_ONLY' => 'ORDER_ONLY',
    'PRIVATE' => 'PRIVATE',
    _ => null,
  };
}

String _formatDate(DateTime value) {
  final month = value.month.toString().padLeft(2, '0');
  final day = value.day.toString().padLeft(2, '0');
  return '${value.year}-$month-$day';
}
