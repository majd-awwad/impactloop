import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/l10n/driver_profile_ui_labels.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../data/models/driver_operational_profile.dart';
import 'driver_asset_image.dart';

Future<bool> confirmDriverAvailabilityPreference(
  BuildContext context,
  bool acceptingNewJobs,
) async {
  if (acceptingNewJobs) return true;
  final l10n = context.l10n;
  return await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(l10n.driverPauseNewJobsConfirmationTitle),
          content: Text(l10n.driverPauseNewJobsConfirmationBody),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: Text(l10n.driverCancelAction),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text(l10n.driverPauseNewJobsAction),
            ),
          ],
        ),
      ) ??
      false;
}

class DriverAvailabilitySummaryCard extends StatelessWidget {
  const DriverAvailabilitySummaryCard({
    super.key,
    required this.profile,
    required this.isMutating,
    required this.isUpdatingAvailability,
    required this.onPreferenceChanged,
    this.compact = false,
    this.heroAssetPath,
  });

  final DriverOperationalProfile profile;
  final bool isMutating;
  final bool isUpdatingAvailability;
  final ValueChanged<bool>? onPreferenceChanged;
  final bool compact;
  final String? heroAssetPath;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final accepting = profile.acceptingNewJobs == true;
    final enabled = profile.isAdministrativelyActive && !isMutating;
    final activeCount = profile.activeDeliveryCount;
    final maxActive = profile.maxActiveDeliveries;
    return Semantics(
      container: true,
      label: l10n.driverDashboardAvailabilityTitle,
      child: Container(
        padding: EdgeInsetsDirectional.all(
          compact ? AppSpacing.md : AppSpacing.lg,
        ),
        decoration: BoxDecoration(
          color: palette.cardSurface,
          borderRadius: AppRadius.lgAll,
          border: Border.all(color: palette.borderStrong),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              l10n.driverDashboardAvailabilityTitle,
                              style: AppTextStyles.title(
                                context,
                              ).copyWith(color: palette.textPrimary),
                            ),
                          ),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (isUpdatingAvailability)
                                const Padding(
                                  padding: EdgeInsetsDirectional.only(
                                    end: AppSpacing.sm,
                                  ),
                                  child: SizedBox.square(
                                    dimension: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  ),
                                ),
                              Switch.adaptive(
                                key: const ValueKey(
                                  'driver-accepting-new-jobs-switch',
                                ),
                                value: accepting,
                                onChanged: enabled && !isUpdatingAvailability
                                    ? onPreferenceChanged
                                    : null,
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        accepting
                            ? l10n.driverAcceptingJobsOnExplicit
                            : l10n.driverAcceptingJobsOffExplicit,
                        style: AppTextStyles.body(context).copyWith(
                          color: accepting
                              ? palette.textPrimary
                              : palette.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                if (heroAssetPath != null) ...[
                  const SizedBox(width: AppSpacing.sm),
                  DriverAssetImage(
                    assetPath: heroAssetPath!,
                    height: compact ? 100 : 120,
                    width: compact ? 100 : 120,
                  ),
                ],
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                _CompactBadge(
                  icon: profile.isAdministrativelyActive
                      ? Icons.verified_user_outlined
                      : Icons.admin_panel_settings_outlined,
                  label: driverProfileStatusLabel(l10n, profile.status),
                  tone: _profileTone(profile.status),
                ),
                _CompactBadge(
                  icon: _availabilityIcon(profile.availability),
                  label: driverAvailabilityLabel(l10n, profile.availability),
                  tone: _availabilityTone(profile.availability),
                ),
                if (activeCount != null)
                  _CompactBadge(
                    icon: Icons.local_shipping_outlined,
                    label:
                        '$activeCount${maxActive == null ? '' : '/$maxActive'}',
                    tone: AppStatusTone.info,
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.info_outline_rounded,
                  size: 16,
                  color: palette.textMuted,
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    driverAvailabilityExplanation(l10n, profile),
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textSecondary, fontSize: 12),
                  ),
                ),
              ],
            ),
            if (!profile.isAdministrativelyActive) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                driverProfileStatusExplanation(l10n, profile.status),
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CompactBadge extends StatelessWidget {
  const _CompactBadge({
    required this.icon,
    required this.label,
    required this.tone,
  });

  final IconData icon;
  final String label;
  final AppStatusTone tone;

  @override
  Widget build(BuildContext context) {
    final style = AppStatusStyle.of(context, tone);
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 3,
      ),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: style.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: style.foreground),
          const SizedBox(width: 4),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: style.foreground,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

AppStatusTone _profileTone(DriverProfileStatus status) => switch (status) {
  DriverProfileStatus.active => AppStatusTone.success,
  DriverProfileStatus.inactive => AppStatusTone.warning,
  DriverProfileStatus.suspended => AppStatusTone.danger,
  DriverProfileStatus.unknown => AppStatusTone.neutral,
};

AppStatusTone _availabilityTone(DriverOperationalAvailability state) =>
    switch (state) {
      DriverOperationalAvailability.available => AppStatusTone.success,
      DriverOperationalAvailability.offline => AppStatusTone.neutral,
      DriverOperationalAvailability.onDelivery => AppStatusTone.info,
      DriverOperationalAvailability.unknown => AppStatusTone.warning,
    };

IconData _availabilityIcon(DriverOperationalAvailability state) =>
    switch (state) {
      DriverOperationalAvailability.available => Icons.work_outline_rounded,
      DriverOperationalAvailability.offline => Icons.pause_circle_outline,
      DriverOperationalAvailability.onDelivery => Icons.local_shipping_outlined,
      DriverOperationalAvailability.unknown => Icons.help_outline_rounded,
    };
