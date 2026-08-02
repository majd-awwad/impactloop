import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/l10n/driver_profile_ui_labels.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../data/models/driver_operational_profile.dart';

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
  });

  final DriverOperationalProfile profile;
  final bool isMutating;
  final bool isUpdatingAvailability;
  final ValueChanged<bool>? onPreferenceChanged;
  final bool compact;

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
            Text(
              l10n.driverDashboardAvailabilityTitle,
              style: AppTextStyles.title(context),
            ),
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                _StatusWithIcon(
                  icon: profile.isAdministrativelyActive
                      ? Icons.verified_user_outlined
                      : Icons.admin_panel_settings_outlined,
                  label:
                      '${l10n.driverAdministrativeProfileStatus}: ${driverProfileStatusLabel(l10n, profile.status)}',
                  tone: _profileTone(profile.status),
                ),
                _StatusWithIcon(
                  icon: _availabilityIcon(profile.availability),
                  label:
                      '${l10n.driverOperationalState}: ${driverAvailabilityLabel(l10n, profile.availability)}',
                  tone: _availabilityTone(profile.availability),
                ),
                if (activeCount != null)
                  _StatusWithIcon(
                    icon: Icons.local_shipping_outlined,
                    label:
                        '${l10n.driverActiveDeliveryCountLabel}: $activeCount${maxActive == null ? '' : '/$maxActive'}',
                    tone: AppStatusTone.info,
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.info_outline_rounded,
                  color: palette.textSecondary,
                  semanticLabel: l10n.driverSystemManagedState,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.driverSystemManagedState,
                        style: AppTextStyles.label(context),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        driverAvailabilityExplanation(l10n, profile),
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: palette.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Semantics(
              toggled: accepting,
              enabled: enabled,
              label: l10n.driverAcceptingNewJobs,
              child: SwitchListTile.adaptive(
                key: const ValueKey('driver-accepting-new-jobs-switch'),
                contentPadding: EdgeInsets.zero,
                value: accepting,
                onChanged: enabled ? onPreferenceChanged : null,
                title: Text(l10n.driverAcceptingNewJobs),
                subtitle: Text(
                  accepting
                      ? l10n.driverAcceptingNewJobsOn
                      : l10n.driverAcceptingNewJobsOff,
                ),
                secondary: isUpdatingAvailability
                    ? const SizedBox.square(
                        dimension: 22,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        accepting
                            ? Icons.notifications_active_outlined
                            : Icons.notifications_paused_outlined,
                      ),
              ),
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

class _StatusWithIcon extends StatelessWidget {
  const _StatusWithIcon({
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
    final availableWidth =
        MediaQuery.sizeOf(context).width - (AppSpacing.md * 4);
    final maxWidth = availableWidth.clamp(160.0, 420.0);
    return Semantics(
      label: label,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Container(
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: style.background,
            borderRadius: AppRadius.pillAll,
            border: Border.all(color: style.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: style.foreground),
              const SizedBox(width: AppSpacing.xs),
              Flexible(
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: style.foreground,
                    fontWeight: FontWeight.w700,
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
