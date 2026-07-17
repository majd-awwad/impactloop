import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/models/supplier_profile.dart';
import '../theme/supplier_theme_extension.dart';
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
    final title = identity?.publicName.trim() ?? '';
    final resolvedCover = _mediaUrl(identity?.coverImageUrl);
    final resolvedAvatar = _mediaUrl(identity?.avatarImageUrl);
    final locationLabel = [
      if ((location?.city ?? '').trim().isNotEmpty) location!.city,
      if ((location?.area ?? '').trim().isNotEmpty) location!.area!,
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
                        label: context.s.coverPhoto,
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
                                  border: Border.all(
                                    color: colors.surface,
                                    width: 4,
                                  ),
                                ),
                                child: CircleAvatar(
                                  radius: 40,
                                  backgroundColor: colors.accent.withValues(
                                    alpha: 0.12,
                                  ),
                                  foregroundImage: resolvedAvatar == null
                                      ? null
                                      : NetworkImage(resolvedAvatar),
                                  child: resolvedAvatar == null
                                      ? Text(
                                          title.isNotEmpty
                                              ? title.characters.first
                                                    .toUpperCase()
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
                                title.isEmpty
                                    ? context.s.supplierFallbackName
                                    : title,
                                style: context.supplierTitle().copyWith(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w800,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (locationLabel.isNotEmpty) ...[
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
                                        locationLabel,
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
                      if ((identity?.supplierType ?? '').trim().isNotEmpty)
                        _HeaderChip(
                          label: context.s.supplierTypeLabel(
                            identity!.supplierType,
                          ),
                          icon: Icons.storefront_outlined,
                        ),
                      SupplierVerificationBadge(
                        status: _presentationVerificationStatus(
                          profile.verification.status,
                        ),
                      ),
                    ],
                  ),
                  if ((identity?.description ?? '').trim().isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      identity!.description!,
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
                    style:
                        AppStatusButtonStyle.filled(
                          context,
                          AppStatusTone.primary,
                        ).copyWith(
                          minimumSize: const WidgetStatePropertyAll(
                            Size.fromHeight(44),
                          ),
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

class ProfileDetailsSection extends StatelessWidget {
  const ProfileDetailsSection({
    super.key,
    required this.profile,
    this.onVerificationAction,
  });

  final SupplierProfileManagement profile;
  final VoidCallback? onVerificationAction;

  @override
  Widget build(BuildContext context) {
    final identity = profile.identity;
    final location = profile.pickupLocation;
    final organization = profile.organization;
    final hours = organization?.workingHours;
    final hoursLabel = [
      hours?['from'] ?? hours?['start'],
      hours?['to'] ?? hours?['end'],
    ].whereType<String>().where((value) => value.trim().isNotEmpty).join(' – ');
    final pickupArea = [
      location?.city,
      location?.area,
    ].whereType<String>().where((value) => value.trim().isNotEmpty).join(', ');
    final pickupSummary = [
      location?.addressLine,
      location?.country,
    ].whereType<String>().where((value) => value.trim().isNotEmpty).join(', ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ManagementCompletionCard(completion: profile.completion),
        const SizedBox(height: AppSpacing.lg),
        _SectionCard(
          title: context.s.supplierProfileLabel,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _DetailRow(
                icon: Icons.storefront_outlined,
                label: context.s.publicName,
                value: _valueOrDash(identity?.publicName),
              ),
              _DetailRow(
                icon: Icons.category_outlined,
                label: context.s.supplierType,
                value: identity == null || identity.supplierType.isEmpty
                    ? '—'
                    : context.s.supplierTypeLabel(identity.supplierType),
              ),
              _DetailRow(
                icon: Icons.info_outline,
                label: context.s.description,
                value: _valueOrDash(identity?.description),
              ),
              const SizedBox(height: AppSpacing.sm),
              SupplierVerificationBadge(
                status: _presentationVerificationStatus(
                  profile.verification.status,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _SectionCard(
          title: context.s.pickupLocation,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _DetailRow(
                icon: Icons.location_city_outlined,
                label: '${context.s.city} / ${context.s.area}',
                value: pickupArea.isEmpty
                    ? context.s.pickupAreaNotSet
                    : pickupArea,
              ),
              _DetailRow(
                icon: Icons.location_on_outlined,
                label: context.s.pickupCountryCity,
                value: pickupSummary.isEmpty
                    ? context.s.pickupAreaNotSet
                    : pickupSummary,
              ),
              _DetailRow(
                icon: Icons.calendar_today_outlined,
                label: context.s.workingDays,
                value: organization?.workingDays?.isNotEmpty == true
                    ? organization!.workingDays!.join(', ')
                    : '—',
              ),
              _DetailRow(
                icon: Icons.schedule_outlined,
                label: '${context.s.openFrom} / ${context.s.openUntil}',
                value: hoursLabel.isEmpty ? '—' : hoursLabel,
              ),
              if (location?.latitude != null &&
                  location?.longitude != null) ...[
                const SizedBox(height: AppSpacing.sm),
                SizedBox(
                  height: 180,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: SupplierPickupMap(
                      latitude: location!.latitude,
                      longitude: location.longitude,
                      fallbackCity: location.city,
                      fallbackArea: location.area,
                      fallbackCountry: location.country,
                      visibility: location.visibility,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _SectionCard(
          title: context.s.locationPrivacy,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _DetailRow(
                icon: Icons.visibility_outlined,
                label: context.s.locationVisibility,
                value: _visibilityLabel(context, location?.visibility),
              ),
              const SizedBox(height: AppSpacing.sm),
              SupplierLocationPrivacyCard(visibility: location?.visibility),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _SectionCard(
          title: context.s.verification,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SupplierVerificationBadge(
                status: _presentationVerificationStatus(
                  profile.verification.status,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              if ((profile.verification.adminNote ?? '').trim().isNotEmpty)
                _DetailRow(
                  icon: Icons.feedback_outlined,
                  label: context.s.verificationAdminNoteLabel,
                  value: profile.verification.adminNote!,
                ),
              if (profile.verification.reviewedAt != null)
                _DetailRow(
                  icon: Icons.event_outlined,
                  label: context.s.dateLabel,
                  value: _formatDate(profile.verification.reviewedAt),
                ),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  if (onVerificationAction != null)
                    OutlinedButton.icon(
                      onPressed: onVerificationAction,
                      icon: const Icon(Icons.open_in_new_outlined, size: 16),
                      label: Text(context.s.verification),
                    ),
                  if (onVerificationAction == null &&
                      (profile.verification.canSubmit ||
                          profile.verification.canResubmit))
                    _ReadOnlyFlag(label: context.s.verificationReadOnlyNote),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ManagementCompletionCard extends StatelessWidget {
  const _ManagementCompletionCard({required this.completion});

  final SupplierProfileManagementCompletion completion;

  @override
  Widget build(BuildContext context) {
    final total = completion.totalCount;
    final percentage = completion.percentage.clamp(0, 100).toDouble();
    final knownMissing = completion.missingFields
        .map((key) => _completionLabel(context, key))
        .whereType<String>()
        .toList(growable: false);

    return _SectionCard(
      title: context.s.profileCompletion,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.s.essentialsComplete(completion.completedCount, total),
            style: context.supplierLabel(),
          ),
          const SizedBox(height: AppSpacing.sm),
          LinearProgressIndicator(value: percentage / 100),
          if (knownMissing.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              knownMissing.join(', '),
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

class _ReadOnlyFlag extends StatelessWidget {
  const _ReadOnlyFlag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: context.supplierBody().copyWith(
        color: context.supplierColors.textMuted,
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

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
          Text(title, style: context.supplierSectionTitle()),
          const SizedBox(height: AppSpacing.sm),
          child,
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
                Text(value, style: context.supplierLabel()),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

String? _mediaUrl(String? value) {
  if (value == null || value.trim().isEmpty) return null;
  return ApiConfig.resolveMediaUrl(value);
}

String _presentationVerificationStatus(String status) {
  return status.trim().toUpperCase() == 'APPROVED' ? 'VERIFIED' : status;
}

String _visibilityLabel(BuildContext context, String? value) {
  if (value == null || value.trim().isEmpty) return '—';
  final normalized = value.trim().toUpperCase();
  return switch (normalized) {
    'PUBLIC' => context.s.visibilityPublic,
    'ORDER_ONLY' => context.s.visibilityOrderOnly,
    'PRIVATE' => context.s.visibilityPrivate,
    _ => context.s.locationVisibility,
  };
}

String? _completionLabel(BuildContext context, String key) {
  return switch (key.trim().toUpperCase()) {
    'PUBLIC_NAME' => context.s.publicName,
    'SUPPLIER_TYPE' => context.s.supplierType,
    'DESCRIPTION' => context.s.description,
    'PICKUP_LOCATION' => context.s.pickupCountryCity,
    'LOCATION_VISIBILITY' => context.s.locationVisibility,
    _ => null,
  };
}

String _valueOrDash(String? value) {
  final trimmed = value?.trim() ?? '';
  return trimmed.isEmpty ? '—' : trimmed;
}

String _formatDate(DateTime? value) {
  if (value == null) return '—';
  final month = value.month.toString().padLeft(2, '0');
  final day = value.day.toString().padLeft(2, '0');
  return '${value.year}-$month-$day';
}
