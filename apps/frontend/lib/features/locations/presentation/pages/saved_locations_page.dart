import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/location/current_location_service.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../../profile/presentation/widgets/profile_family_page_widgets.dart';
import '../../application/saved_locations_providers.dart';
import '../../data/forward_geocode_result.dart';
import '../../data/reverse_geocode_result.dart';
import '../../data/saved_location.dart';
import '../l10n/saved_locations_l10n.dart';

const _palestineFallbackCenter = LatLng(31.9522, 35.2332);
const _nablusFallbackCenter = LatLng(32.2211, 35.2544);

class _SavedLocationFormPrefill {
  const _SavedLocationFormPrefill({
    this.country,
    this.city,
    this.area,
    this.addressLine,
    this.latitude,
    this.longitude,
  });

  final String? country;
  final String? city;
  final String? area;
  final String? addressLine;
  final double? latitude;
  final double? longitude;
}

class SavedLocationsPage extends ConsumerStatefulWidget {
  const SavedLocationsPage({super.key});

  @override
  ConsumerState<SavedLocationsPage> createState() => _SavedLocationsPageState();
}

class _SavedLocationsPageState extends ConsumerState<SavedLocationsPage> {
  String? _busyLocationId;
  bool _capturingCurrentLocation = false;

  Future<void> _openCreateDialog({_SavedLocationFormPrefill? prefill}) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => _SavedLocationFormDialog(prefill: prefill),
    );

    if (!mounted || saved != true) {
      return;
    }

    showInfoSnackBar(context, SavedLocationsL10n.of(context).created);
  }

  Future<void> _openEditDialog(SavedLocation location) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => _SavedLocationFormDialog(location: location),
    );

    if (!mounted || saved != true) {
      return;
    }

    showInfoSnackBar(context, SavedLocationsL10n.of(context).updated);
  }

  Future<void> _setDefault(SavedLocation location) async {
    if (location.isDefault || _busyLocationId != null) {
      return;
    }

    setState(() => _busyLocationId = 'default:${location.id}');

    try {
      await ref
          .read(savedLocationsControllerProvider.notifier)
          .setDefault(location.id);

      if (!mounted) {
        return;
      }

      showInfoSnackBar(context, SavedLocationsL10n.of(context).defaultUpdated);
    } on ApiException catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } catch (_) {
      if (mounted) {
        showErrorSnackBar(
          context,
          SavedLocationsL10n.of(context).updateDefaultFailed,
        );
      }
    } finally {
      if (mounted) {
        setState(() => _busyLocationId = null);
      }
    }
  }

  Future<void> _deleteLocation(SavedLocation location) async {
    if (_busyLocationId != null) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => _DeleteSavedLocationDialog(location: location),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() => _busyLocationId = 'delete:${location.id}');

    try {
      await ref
          .read(savedLocationsControllerProvider.notifier)
          .delete(location.id);

      if (!mounted) {
        return;
      }

      showInfoSnackBar(context, SavedLocationsL10n.of(context).deleted);
    } on ApiException catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } catch (_) {
      if (mounted) {
        showErrorSnackBar(
          context,
          SavedLocationsL10n.of(context).deleteFailed,
        );
      }
    } finally {
      if (mounted) {
        setState(() => _busyLocationId = null);
      }
    }
  }

  String _currentLocationErrorMessage(CurrentLocationFailure failure) {
    final l10n = SavedLocationsL10n.of(context);
    return switch (failure) {
      CurrentLocationFailure.serviceDisabled => l10n.locationServicesDisabled,
      CurrentLocationFailure.permissionDenied => l10n.locationPermissionDenied,
      CurrentLocationFailure.permissionDeniedForever =>
        l10n.locationPermissionDeniedForever,
      CurrentLocationFailure.timeout => l10n.locationTimeout,
      CurrentLocationFailure.unsupported => l10n.locationUnsupported,
      CurrentLocationFailure.unavailable => l10n.locationUnavailable,
    };
  }

  Future<void> _useCurrentLocation() async {
    if (_capturingCurrentLocation) {
      return;
    }

    setState(() => _capturingCurrentLocation = true);
    final l10n = SavedLocationsL10n.of(context);

    try {
      final capture = await ref
          .read(currentLocationServiceProvider)
          .captureCurrentLocation();

      if (!mounted) {
        return;
      }

      String? country;
      String? city;
      String? area;
      String? addressLine;
      var reverseFailed = false;

      try {
        final reverse = await ref
            .read(savedLocationsApiProvider)
            .reverseGeocode(
              latitude: capture.latitude,
              longitude: capture.longitude,
            );
        country = reverse.country;
        city = reverse.city;
        area = reverse.area;
        addressLine = reverse.addressLine;
      } catch (_) {
        reverseFailed = true;
      }

      if (!mounted) {
        return;
      }

      if (reverseFailed) {
        showInfoSnackBar(context, l10n.reverseGeocodePartialFailure);
      }

      await _openCreateDialog(
        prefill: _SavedLocationFormPrefill(
          country: country,
          city: city,
          area: area,
          addressLine: addressLine,
          latitude: capture.latitude,
          longitude: capture.longitude,
        ),
      );
    } on CurrentLocationException catch (error) {
      if (mounted) {
        showInfoSnackBar(context, _currentLocationErrorMessage(error.failure));
      }
    } catch (_) {
      if (mounted) {
        showInfoSnackBar(context, l10n.locationGenericFailure);
      }
    } finally {
      if (mounted) {
        setState(() => _capturingCurrentLocation = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = SavedLocationsL10n.of(context);
    final locationsAsync = ref.watch(savedLocationsProvider);
    final width = MediaQuery.sizeOf(context).width;
    final isWide = width >= profileFamilyWideBreakpoint;

    return ProfileFamilyPageScaffold(
      title: l10n.pageTitle,
      backTooltip: l10n.back,
      backFallbackRoute: profileRoute,
      headerAction: isWide
          ? _AddLocationHeaderAction(
              label: l10n.addNewLocation,
              tooltip: l10n.addNewLocation,
              onPressed: () => _openCreateDialog(),
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.pageSubtitle,
            textAlign: TextAlign.center,
            style: AppTextStyles.body(context).copyWith(
              color: AppThemeColors.of(context).textSecondary,
              height: 1.45,
            ),
          ),
          if (!isWide) ...[
            const SizedBox(height: AppSpacing.md),
            Semantics(
              button: true,
              label: l10n.addNewLocation,
              child: OutlinedButton.icon(
                onPressed: () => _openCreateDialog(),
                icon: const Icon(Icons.add_rounded, size: 18),
                label: Text(l10n.addNewLocation),
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          const _PrivacyNotice(),
          const SizedBox(height: AppSpacing.lg),
          locationsAsync.when(
            data: (locations) => _SavedLocationsLayout(
              locations: locations,
              busyLocationId: _busyLocationId,
              capturingCurrentLocation: _capturingCurrentLocation,
              onCreate: () => _openCreateDialog(),
              onUseCurrentLocation: _useCurrentLocation,
              onEdit: _openEditDialog,
              onDelete: _deleteLocation,
              onSetDefault: _setDefault,
            ),
            loading: () => const _SavedLocationsLoading(),
            error: (error, _) => _SavedLocationsError(
              message: userFriendlyErrorMessage(error),
              onRetry: () => ref.invalidate(savedLocationsProvider),
            ),
          ),
        ],
      ),
    );
  }
}

class _AddLocationHeaderAction extends StatelessWidget {
  const _AddLocationHeaderAction({
    required this.label,
    required this.tooltip,
    required this.onPressed,
  });

  final String label;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 48),
      child: Semantics(
        button: true,
        label: tooltip,
        child: OutlinedButton.icon(
          onPressed: onPressed,
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsetsDirectional.symmetric(horizontal: 14),
          ),
          icon: const Icon(Icons.add_rounded, size: 18),
          label: Text(label),
        ),
      ),
    );
  }
}

class _SavedLocationsLayout extends StatelessWidget {
  const _SavedLocationsLayout({
    required this.locations,
    required this.busyLocationId,
    required this.capturingCurrentLocation,
    required this.onCreate,
    required this.onUseCurrentLocation,
    required this.onEdit,
    required this.onDelete,
    required this.onSetDefault,
  });

  final List<SavedLocation> locations;
  final String? busyLocationId;
  final bool capturingCurrentLocation;
  final VoidCallback onCreate;
  final VoidCallback onUseCurrentLocation;
  final ValueChanged<SavedLocation> onEdit;
  final ValueChanged<SavedLocation> onDelete;
  final ValueChanged<SavedLocation> onSetDefault;

  @override
  Widget build(BuildContext context) {
    final isWide =
        MediaQuery.sizeOf(context).width >= profileFamilyWideBreakpoint;

    final mainColumn = _SavedLocationsMainColumn(
      locations: locations,
      busyLocationId: busyLocationId,
      capturingCurrentLocation: capturingCurrentLocation,
      onCreate: onCreate,
      onUseCurrentLocation: onUseCurrentLocation,
      onEdit: onEdit,
      onDelete: onDelete,
      onSetDefault: onSetDefault,
    );

    if (!isWide) {
      return mainColumn;
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(flex: 7, child: mainColumn),
        const SizedBox(width: AppSpacing.lg),
        const Expanded(flex: 3, child: _SavedLocationsSidePanel()),
      ],
    );
  }
}

class _SavedLocationsMainColumn extends StatelessWidget {
  const _SavedLocationsMainColumn({
    required this.locations,
    required this.busyLocationId,
    required this.capturingCurrentLocation,
    required this.onCreate,
    required this.onUseCurrentLocation,
    required this.onEdit,
    required this.onDelete,
    required this.onSetDefault,
  });

  final List<SavedLocation> locations;
  final String? busyLocationId;
  final bool capturingCurrentLocation;
  final VoidCallback onCreate;
  final VoidCallback onUseCurrentLocation;
  final ValueChanged<SavedLocation> onEdit;
  final ValueChanged<SavedLocation> onDelete;
  final ValueChanged<SavedLocation> onSetDefault;

  @override
  Widget build(BuildContext context) {
    final l10n = SavedLocationsL10n.of(context);
    final colors = AppThemeColors.of(context);

    if (locations.isEmpty) {
      return _EmptySavedLocations(
        onCreate: onCreate,
        onUseCurrentLocation: onUseCurrentLocation,
        capturingCurrentLocation: capturingCurrentLocation,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                l10n.mySavedLocations,
                style: AppTextStyles.title(context).copyWith(
                  color: colors.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            Semantics(
              label: l10n.locationCountLabel(locations.length),
              child: Container(
                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                padding: const EdgeInsetsDirectional.symmetric(horizontal: 8),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Color.lerp(
                    colors.cardSurface,
                    colors.primarySoft,
                    0.7,
                  ),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Color.lerp(
                      colors.borderSubtle,
                      colors.primary,
                      0.28,
                    )!,
                  ),
                ),
                child: Text(
                  l10n.locationCount(locations.length),
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.primary,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                    letterSpacing: 0,
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        for (final location in locations) ...[
          _SavedLocationCard(
            location: location,
            busyLocationId: busyLocationId,
            onEdit: () => onEdit(location),
            onDelete: () => onDelete(location),
            onSetDefault: () => onSetDefault(location),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        const SizedBox(height: AppSpacing.md),
        _CurrentLocationCta(
          capturing: capturingCurrentLocation,
          onPressed: onUseCurrentLocation,
        ),
      ],
    );
  }
}

class _SavedLocationsSidePanel extends StatelessWidget {
  const _SavedLocationsSidePanel();

  @override
  Widget build(BuildContext context) {
    final l10n = SavedLocationsL10n.of(context);
    final colors = AppThemeColors.of(context);

    return ProfileFamilySurface(
      tone: ProfileFamilyTone.neutral,
      showShadow: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: ProfileFamilyIconContainer(
              icon: Icons.map_outlined,
              tone: ProfileFamilyTone.mint,
              size: 56,
              iconSize: 28,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            l10n.sidePanelTitle,
            style: AppTextStyles.title(context).copyWith(
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _SideInfoRow(
            icon: Icons.home_outlined,
            title: l10n.sideFasterAccessTitle,
            body: l10n.sideFasterAccessBody,
            tone: ProfileFamilyTone.mint,
          ),
          const SizedBox(height: AppSpacing.md),
          _SideInfoRow(
            icon: Icons.shield_outlined,
            title: l10n.sidePrivacyFirstTitle,
            body: l10n.sidePrivacyFirstBody,
            tone: ProfileFamilyTone.primary,
          ),
          const SizedBox(height: AppSpacing.md),
          _SideInfoRow(
            icon: Icons.tune_rounded,
            title: l10n.sideFullControlTitle,
            body: l10n.sideFullControlBody,
            tone: ProfileFamilyTone.blue,
          ),
        ],
      ),
    );
  }
}

class _SideInfoRow extends StatelessWidget {
  const _SideInfoRow({
    required this.icon,
    required this.title,
    required this.body,
    required this.tone,
  });

  final IconData icon;
  final String title;
  final String body;
  final ProfileFamilyTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ProfileFamilyIconContainer(icon: icon, tone: tone, size: 36, iconSize: 18),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTextStyles.label(context).copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                body,
                style: AppTextStyles.body(context).copyWith(
                  color: colors.textSecondary,
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CurrentLocationCta extends StatelessWidget {
  const _CurrentLocationCta({
    required this.capturing,
    required this.onPressed,
  });

  final bool capturing;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final l10n = SavedLocationsL10n.of(context);
    final colors = AppThemeColors.of(context);
    final mint = ProfileFamilyToneStyle.of(context, ProfileFamilyTone.mint);
    final isWide =
        MediaQuery.sizeOf(context).width >= profileFamilyWideBreakpoint;

    final details = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ProfileFamilyIconContainer(
          icon: Icons.my_location_rounded,
          tone: ProfileFamilyTone.mint,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.useCurrentLocation,
                style: AppTextStyles.title(context).copyWith(
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                capturing
                    ? l10n.useCurrentLocationLoading
                    : l10n.useCurrentLocationDescription,
                style: AppTextStyles.body(context).copyWith(
                  color: colors.textSecondary,
                  fontSize: 13,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ],
    );

    final action = Semantics(
      button: true,
      enabled: !capturing,
      label: capturing
          ? l10n.useCurrentLocationLoading
          : l10n.useCurrentLocation,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: OutlinedButton.icon(
          onPressed: capturing ? null : onPressed,
          icon: capturing
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.gps_fixed_rounded, size: 18),
          label: Text(
            capturing
                ? l10n.useCurrentLocationLoading
                : l10n.useCurrentLocation,
          ),
        ),
      ),
    );

    return Semantics(
      container: true,
      label: l10n.useCurrentLocation,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: Color.lerp(colors.cardSurface, mint.surface, 0.55),
          borderRadius: AppRadius.xlAll,
          border: Border.all(color: mint.border, width: 1.4),
        ),
        child: isWide
            ? Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(child: details),
                  const SizedBox(width: AppSpacing.md),
                  action,
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  details,
                  const SizedBox(height: AppSpacing.md),
                  action,
                ],
              ),
      ),
    );
  }
}

class _SavedLocationCard extends StatelessWidget {
  const _SavedLocationCard({
    required this.location,
    required this.busyLocationId,
    required this.onEdit,
    required this.onDelete,
    required this.onSetDefault,
  });

  final SavedLocation location;
  final String? busyLocationId;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onSetDefault;

  bool get _isDeleting => busyLocationId == 'delete:${location.id}';

  bool get _isSettingDefault => busyLocationId == 'default:${location.id}';

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = SavedLocationsL10n.of(context);
    final isWide =
        MediaQuery.sizeOf(context).width >= profileFamilyWideBreakpoint;
    final summary = _locationSummary(location);
    final coords = _coordinatesText(location);
    final iconTone = _iconToneForLabel(location.label);
    final icon = _iconForLabel(location.label);

    return Semantics(
      container: true,
      label: l10n.locationCardSemantics(
        label: location.label,
        summary: summary,
        isDefault: location.isDefault,
      ),
      child: ProfileFamilySurface(
        tone: location.isDefault
            ? ProfileFamilyTone.mint
            : ProfileFamilyTone.neutral,
        showShadow: false,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ProfileFamilyIconContainer(icon: icon, tone: iconTone),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.xs,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      ProfileFamilyDirectionalText(
                        location.label,
                        style: AppTextStyles.title(context).copyWith(
                          color: colors.textPrimary,
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0,
                        ),
                      ),
                      if (location.isDefault) const _DefaultBadge(),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  ProfileFamilyDirectionalText(
                    summary,
                    style: AppTextStyles.body(context).copyWith(
                      color: colors.textSecondary,
                      fontSize: 13,
                      height: 1.35,
                    ),
                  ),
                  if (coords != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Directionality(
                      textDirection: TextDirection.ltr,
                      child: Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: Text(
                          coords,
                          style: AppTextStyles.label(context).copyWith(
                            color: colors.textMuted,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            if (_isDeleting || _isSettingDefault)
              const Padding(
                padding: EdgeInsetsDirectional.only(top: 8),
                child: SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            else if (isWide)
              _DesktopLocationActions(
                isDefault: location.isDefault,
                onEdit: onEdit,
                onSetDefault: onSetDefault,
                onDelete: onDelete,
              )
            else
              _MobileLocationActions(
                isDefault: location.isDefault,
                onEdit: onEdit,
                onSetDefault: onSetDefault,
                onDelete: onDelete,
              ),
          ],
        ),
      ),
    );
  }

  static String _locationSummary(SavedLocation location) {
    final address = location.addressLine?.trim();
    if (address != null && address.isNotEmpty) {
      return address;
    }
    return [
      location.city,
      if (location.area != null && location.area!.trim().isNotEmpty)
        location.area!,
      location.country,
    ].join(' - ');
  }

  static String? _coordinatesText(SavedLocation location) {
    if (location.latitude == null || location.longitude == null) {
      return null;
    }
    return '${location.latitude!.toStringAsFixed(6)}, '
        '${location.longitude!.toStringAsFixed(6)}';
  }

  static IconData _iconForLabel(String label) {
    final normalized = label.trim().toLowerCase();
    if (normalized.contains('home') ||
        normalized.contains('منزل') ||
        normalized.contains('بيت')) {
      return Icons.home_outlined;
    }
    if (normalized.contains('work') ||
        normalized.contains('office') ||
        normalized.contains('عمل') ||
        normalized.contains('مكتب')) {
      return Icons.work_outline_rounded;
    }
    if (normalized.contains('friend') ||
        normalized.contains('صديق') ||
        normalized.contains('person')) {
      return Icons.person_outline_rounded;
    }
    return Icons.location_on_outlined;
  }

  static ProfileFamilyTone _iconToneForLabel(String label) {
    final normalized = label.trim().toLowerCase();
    if (normalized.contains('home') ||
        normalized.contains('منزل') ||
        normalized.contains('بيت')) {
      return ProfileFamilyTone.mint;
    }
    if (normalized.contains('work') ||
        normalized.contains('office') ||
        normalized.contains('عمل') ||
        normalized.contains('مكتب')) {
      return ProfileFamilyTone.blue;
    }
    if (normalized.contains('friend') ||
        normalized.contains('صديق') ||
        normalized.contains('person')) {
      return ProfileFamilyTone.amber;
    }
    return ProfileFamilyTone.primary;
  }
}

class _DesktopLocationActions extends StatelessWidget {
  const _DesktopLocationActions({
    required this.isDefault,
    required this.onEdit,
    required this.onSetDefault,
    required this.onDelete,
  });

  final bool isDefault;
  final VoidCallback onEdit;
  final VoidCallback onSetDefault;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final l10n = SavedLocationsL10n.of(context);
    final colors = AppThemeColors.of(context);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          tooltip: l10n.editLocationAction,
          onPressed: onEdit,
          icon: Icon(Icons.edit_outlined, color: colors.textSecondary),
        ),
        if (!isDefault)
          IconButton(
            tooltip: l10n.setAsDefault,
            onPressed: onSetDefault,
            icon: Icon(Icons.star_outline_rounded, color: colors.primary),
          ),
        IconButton(
          tooltip: l10n.deleteLocationAction,
          onPressed: onDelete,
          icon: Icon(Icons.delete_outline, color: colors.danger),
        ),
      ],
    );
  }
}

class _MobileLocationActions extends StatelessWidget {
  const _MobileLocationActions({
    required this.isDefault,
    required this.onEdit,
    required this.onSetDefault,
    required this.onDelete,
  });

  final bool isDefault;
  final VoidCallback onEdit;
  final VoidCallback onSetDefault;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return _LocationOverflowMenu(
      isDefault: isDefault,
      onEdit: onEdit,
      onSetDefault: onSetDefault,
      onDelete: onDelete,
    );
  }
}

class _LocationOverflowMenu extends StatelessWidget {
  const _LocationOverflowMenu({
    required this.isDefault,
    required this.onEdit,
    required this.onSetDefault,
    required this.onDelete,
  });

  final bool isDefault;
  final VoidCallback onEdit;
  final VoidCallback onSetDefault;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final l10n = SavedLocationsL10n.of(context);
    final colors = AppThemeColors.of(context);

    return PopupMenuButton<_LocationMenuAction>(
      tooltip: l10n.edit,
      icon: Icon(Icons.more_vert_rounded, color: colors.textSecondary),
      onSelected: (action) {
        switch (action) {
          case _LocationMenuAction.edit:
            onEdit();
          case _LocationMenuAction.setDefault:
            onSetDefault();
          case _LocationMenuAction.delete:
            onDelete();
        }
      },
      itemBuilder: (context) => [
        PopupMenuItem(
          value: _LocationMenuAction.edit,
          child: ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.edit_outlined),
            title: Text(l10n.editLocationAction),
          ),
        ),
        if (!isDefault)
          PopupMenuItem(
            value: _LocationMenuAction.setDefault,
            child: ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.star_outline_rounded),
              title: Text(l10n.setAsDefault),
            ),
          ),
        PopupMenuItem(
          value: _LocationMenuAction.delete,
          child: ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.delete_outline, color: colors.danger),
            title: Text(
              l10n.deleteLocationAction,
              style: TextStyle(color: colors.danger),
            ),
          ),
        ),
      ],
    );
  }
}

enum _LocationMenuAction { edit, setDefault, delete }

class _SavedLocationFormDialog extends ConsumerStatefulWidget {
  const _SavedLocationFormDialog({this.location, this.prefill});

  final SavedLocation? location;
  final _SavedLocationFormPrefill? prefill;

  @override
  ConsumerState<_SavedLocationFormDialog> createState() =>
      _SavedLocationFormDialogState();
}

class _SavedLocationFormDialogState
    extends ConsumerState<_SavedLocationFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _labelController;
  late final TextEditingController _countryController;
  late final TextEditingController _cityController;
  late final TextEditingController _areaController;
  late final TextEditingController _addressController;
  late final TextEditingController _latitudeController;
  late final TextEditingController _longitudeController;

  bool _isDefault = false;
  bool _isSubmitting = false;
  bool _isReverseGeocoding = false;
  bool _isForwardGeocoding = false;
  String? _formError;
  String? _labelError;
  String? _cityError;
  String? _latitudeError;
  String? _longitudeError;

  bool get _isEditing => widget.location != null;

  @override
  void initState() {
    super.initState();
    final location = widget.location;
    final prefill = widget.prefill;
    _labelController = TextEditingController(text: location?.label ?? '');
    _countryController = TextEditingController(
      text: location?.country ?? prefill?.country ?? 'Palestine',
    );
    _cityController = TextEditingController(
      text: location?.city ?? prefill?.city ?? '',
    );
    _areaController = TextEditingController(
      text: location?.area ?? prefill?.area ?? '',
    );
    _addressController = TextEditingController(
      text: location?.addressLine ?? prefill?.addressLine ?? '',
    );
    _latitudeController = TextEditingController(
      text: location?.latitude?.toString() ??
          prefill?.latitude?.toStringAsFixed(6) ??
          '',
    );
    _longitudeController = TextEditingController(
      text: location?.longitude?.toString() ??
          prefill?.longitude?.toStringAsFixed(6) ??
          '',
    );
    _isDefault = location?.isDefault ?? false;
  }

  @override
  void dispose() {
    _labelController.dispose();
    _countryController.dispose();
    _cityController.dispose();
    _areaController.dispose();
    _addressController.dispose();
    _latitudeController.dispose();
    _longitudeController.dispose();
    super.dispose();
  }

  void _clearServerErrors() {
    if (_formError == null &&
        _labelError == null &&
        _cityError == null &&
        _latitudeError == null &&
        _longitudeError == null) {
      return;
    }

    setState(() {
      _formError = null;
      _labelError = null;
      _cityError = null;
      _latitudeError = null;
      _longitudeError = null;
    });
  }

  Future<void> _setCoordinatesFromMap(LatLng point) async {
    setState(() {
      _latitudeController.text = point.latitude.toStringAsFixed(6);
      _longitudeController.text = point.longitude.toStringAsFixed(6);
      _latitudeError = null;
      _longitudeError = null;
      _formError = null;
      _isReverseGeocoding = true;
    });

    try {
      final result = await ref
          .read(savedLocationsApiProvider)
          .reverseGeocode(latitude: point.latitude, longitude: point.longitude);

      if (!mounted) {
        return;
      }

      _applyReverseGeocodeResult(result);
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _formError = SavedLocationsL10n.of(
          context,
        ).reverseLookupFailed(error.displayMessage);
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _formError = SavedLocationsL10n.of(
          context,
        ).reverseLookupFailedFallback;
      });
    } finally {
      if (mounted) {
        setState(() => _isReverseGeocoding = false);
      }
    }
  }

  Future<void> _setCoordinatesFromTypedAddress() async {
    if (_isForwardGeocoding || _isReverseGeocoding) {
      return;
    }

    final city = _cityController.text.trim();
    if (city.isEmpty) {
      setState(() {
        _cityError = SavedLocationsL10n.of(context).cityRequiredForLookup;
      });
      return;
    }

    setState(() {
      _formError = null;
      _cityError = null;
      _latitudeError = null;
      _longitudeError = null;
      _isForwardGeocoding = true;
    });

    try {
      final result = await ref
          .read(savedLocationsApiProvider)
          .forwardGeocode(
            country: _countryController.text.trim().isEmpty
                ? 'Palestine'
                : _countryController.text.trim(),
            city: city,
            area: _areaController.text,
            addressLine: _addressController.text,
          );

      if (!mounted) {
        return;
      }

      _applyForwardGeocodeResult(result);
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _formError = SavedLocationsL10n.of(
          context,
        ).forwardLookupFailed(error.displayMessage);
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _formError = SavedLocationsL10n.of(
          context,
        ).forwardLookupFailedFallback;
      });
    } finally {
      if (mounted) {
        setState(() => _isForwardGeocoding = false);
      }
    }
  }

  void _applyReverseGeocodeResult(ReverseGeocodeResult result) {
    setState(() {
      if (result.country != null) {
        _countryController.text = result.country!;
      }
      if (result.city != null) {
        _cityController.text = result.city!;
        _cityError = null;
      }
      if (result.area != null) {
        _areaController.text = result.area!;
      }
      if (result.addressLine != null) {
        _addressController.text = result.addressLine!;
      }
    });
  }

  void _applyForwardGeocodeResult(ForwardGeocodeResult result) {
    setState(() {
      _latitudeController.text = result.latitude.toStringAsFixed(6);
      _longitudeController.text = result.longitude.toStringAsFixed(6);
      _latitudeError = null;
      _longitudeError = null;

      if (result.country != null) {
        _countryController.text = result.country!;
      }
      if (result.city != null) {
        _cityController.text = result.city!;
        _cityError = null;
      }
      if (result.area != null) {
        _areaController.text = result.area!;
      }
      if (result.addressLine != null) {
        _addressController.text = result.addressLine!;
      }
    });
  }

  Future<void> _openMapPicker() async {
    final point = await showDialog<LatLng>(
      context: context,
      builder: (context) => _SavedLocationMapDialog(
        latitude: _parseOptionalCoordinate(_latitudeController.text),
        longitude: _parseOptionalCoordinate(_longitudeController.text),
        city: _cityController.text,
        area: _areaController.text,
        country: _countryController.text,
      ),
    );

    if (point == null || !mounted) {
      return;
    }

    await _setCoordinatesFromMap(point);
  }

  Future<void> _submit() async {
    _clearServerErrors();

    if (_isSubmitting || !(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    final latitude = _parseCoordinate(_latitudeController.text);
    final longitude = _parseCoordinate(_longitudeController.text);
    final payload = SavedLocationPayload(
      label: _labelController.text.trim(),
      country: _countryController.text.trim().isEmpty
          ? 'Palestine'
          : _countryController.text.trim(),
      city: _cityController.text.trim(),
      area: _areaController.text.trim(),
      addressLine: _addressController.text.trim(),
      latitude: latitude,
      longitude: longitude,
      isDefault: _isDefault,
    );

    setState(() => _isSubmitting = true);

    try {
      final controller = ref.read(savedLocationsControllerProvider.notifier);
      if (_isEditing) {
        await controller.update(widget.location!.id, payload);
      } else {
        await controller.create(payload);
      }

      if (!mounted) {
        return;
      }

      Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _labelError = firstFieldError(error, const ['label']);
        _cityError = firstFieldError(error, const ['city']);
        _latitudeError = firstFieldError(error, const ['latitude']);
        _longitudeError = firstFieldError(error, const ['longitude']);
        _formError =
            _labelError == null &&
                _cityError == null &&
                _latitudeError == null &&
                _longitudeError == null
            ? error.displayMessage
            : null;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        final l10n = SavedLocationsL10n.of(context);
        _formError = _isEditing ? l10n.updateFailed : l10n.createFailed;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = SavedLocationsL10n.of(context);
    return AppDialogShell(
      title: Text(_isEditing ? l10n.editLocation : l10n.addLocation),
      maxWidth: 520,
      onClose: () => Navigator.of(context).pop(),
      closeEnabled: !_isSubmitting,
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppTextField(
              controller: _labelController,
              label: l10n.label,
              hint: l10n.labelHint,
              textInputAction: TextInputAction.next,
              errorText: _labelError,
              validator: _required(l10n.labelRequired),
              onChanged: (_) => _clearServerErrors(),
            ),
            const AppFieldGap(),
            AppTextField(
              controller: _cityController,
              label: l10n.city,
              textInputAction: TextInputAction.next,
              errorText: _cityError,
              validator: _required(l10n.cityRequired),
              onChanged: (_) => _clearServerErrors(),
            ),
            const AppFieldGap(),
            AppTextField(
              controller: _areaController,
              label: l10n.area,
              hint: l10n.optional,
              textInputAction: TextInputAction.next,
              onChanged: (_) => _clearServerErrors(),
            ),
            const AppFieldGap(),
            AppTextField(
              controller: _addressController,
              label: l10n.exactAddress,
              hint: l10n.privateOptional,
              textInputAction: TextInputAction.next,
              onChanged: (_) => _clearServerErrors(),
            ),
            const AppFieldGap(),
            AppTextField(
              controller: _countryController,
              label: l10n.country,
              textInputAction: TextInputAction.next,
              validator: _required(l10n.countryRequired),
              onChanged: (_) => _clearServerErrors(),
            ),
            const AppFieldGap(),
            AppTextField(
              controller: _latitudeController,
              label: l10n.latitude,
              hint: l10n.optionalExactCoordinate,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
                signed: true,
              ),
              textInputAction: TextInputAction.next,
              errorText: _latitudeError,
              validator: (value) => _validateCoordinate(
                value,
                min: -90,
                max: 90,
                missingPairController: _longitudeController,
                missingPairMessage: l10n.longitudeRequired,
              ),
              onChanged: (_) {
                _clearServerErrors();
                setState(() {});
              },
            ),
            const AppFieldGap(),
            AppTextField(
              controller: _longitudeController,
              label: l10n.longitude,
              hint: l10n.optionalExactCoordinate,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
                signed: true,
              ),
              textInputAction: TextInputAction.done,
              errorText: _longitudeError,
              validator: (value) => _validateCoordinate(
                value,
                min: -180,
                max: 180,
                missingPairController: _latitudeController,
                missingPairMessage: l10n.latitudeRequired,
              ),
              onFieldSubmitted: (_) => _submit(),
              onChanged: (_) {
                _clearServerErrors();
                setState(() {});
              },
            ),
            const SizedBox(height: AppSpacing.md),
            _SavedLocationMapLauncher(
              latitude: _parseOptionalCoordinate(_latitudeController.text),
              longitude: _parseOptionalCoordinate(_longitudeController.text),
              isForwardGeocoding: _isForwardGeocoding,
              isReverseGeocoding: _isReverseGeocoding,
              onFindTypedAddress: _setCoordinatesFromTypedAddress,
              onPickMap: _openMapPicker,
            ),
            const SizedBox(height: AppSpacing.sm),
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _isDefault,
              onChanged: (value) {
                setState(() => _isDefault = value ?? false);
              },
              title: Text(l10n.useAsDefault),
              controlAffinity: ListTileControlAffinity.leading,
            ),
            if (_formError != null) ...[
              const SizedBox(height: AppSpacing.sm),
              AppInlineError(message: _formError!),
            ],
          ],
        ),
      ),
      footer: AppDialogFooter.form(
        primaryAction: FilledButton(
          onPressed: _isSubmitting ? null : _submit,
          style: AppStatusButtonStyle.filled(context, AppStatusTone.primary),
          child: _isSubmitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(_isEditing ? l10n.saveChanges : l10n.createLocation),
        ),
      ),
    );
  }

  String? Function(String?) _required(String message) {
    return (value) {
      if (value == null || value.trim().isEmpty) {
        return message;
      }
      return null;
    };
  }

  String? _validateCoordinate(
    String? value, {
    required double min,
    required double max,
    required TextEditingController missingPairController,
    required String missingPairMessage,
  }) {
    final normalized = value?.trim() ?? '';
    final pairValue = missingPairController.text.trim();

    if (normalized.isEmpty) {
      return pairValue.isEmpty ? null : missingPairMessage;
    }

    final parsed = double.tryParse(normalized);
    if (parsed == null) {
      return SavedLocationsL10n.of(context).invalidNumber;
    }
    if (parsed < min || parsed > max) {
      return SavedLocationsL10n.of(context).numberRange(
        min.toStringAsFixed(0),
        max.toStringAsFixed(0),
      );
    }

    return null;
  }

  double? _parseCoordinate(String value) {
    final normalized = value.trim();
    return normalized.isEmpty ? null : double.parse(normalized);
  }

  double? _parseOptionalCoordinate(String value) {
    return double.tryParse(value.trim());
  }
}

class _SavedLocationMapLauncher extends StatelessWidget {
  const _SavedLocationMapLauncher({
    required this.latitude,
    required this.longitude,
    required this.isForwardGeocoding,
    required this.isReverseGeocoding,
    required this.onFindTypedAddress,
    required this.onPickMap,
  });

  final double? latitude;
  final double? longitude;
  final bool isForwardGeocoding;
  final bool isReverseGeocoding;
  final VoidCallback onFindTypedAddress;
  final VoidCallback onPickMap;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = SavedLocationsL10n.of(context);
    final hasCoordinates = latitude != null && longitude != null;
    final isLookingUp = isForwardGeocoding || isReverseGeocoding;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.map_outlined, color: colors.primary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.mapPoint,
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  isForwardGeocoding
                      ? l10n.findingTypedAddress
                      : isReverseGeocoding
                      ? l10n.lookingUpPoint
                      : hasCoordinates
                      ? '${latitude!.toStringAsFixed(6)}, ${longitude!.toStringAsFixed(6)}'
                      : l10n.mapHelp,
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.textSecondary,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.xs,
                  children: [
                    OutlinedButton.icon(
                      onPressed: isLookingUp ? null : onFindTypedAddress,
                      icon: const Icon(Icons.travel_explore_rounded, size: 18),
                      label: Text(l10n.findTypedAddress),
                    ),
                    OutlinedButton.icon(
                      onPressed: isLookingUp ? null : onPickMap,
                      icon: const Icon(
                        Icons.add_location_alt_outlined,
                        size: 18,
                      ),
                      label: Text(
                        hasCoordinates ? l10n.changeMapPoint : l10n.pickOnMap,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (isLookingUp)
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
        ],
      ),
    );
  }
}

class _SavedLocationMapDialog extends StatelessWidget {
  const _SavedLocationMapDialog({
    required this.latitude,
    required this.longitude,
    required this.city,
    required this.area,
    required this.country,
  });

  final double? latitude;
  final double? longitude;
  final String city;
  final String area;
  final String country;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = SavedLocationsL10n.of(context);

    return AppDialogShell(
      title: Text(
        l10n.pickExactPoint,
        style: AppTextStyles.title(
          context,
        ).copyWith(color: colors.textPrimary, fontSize: 22),
      ),
      maxWidth: 680,
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.mapPrivacyHelp,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.md),
          _SavedLocationMapPicker(
            latitude: latitude,
            longitude: longitude,
            city: city,
            area: area,
            country: country,
            isReverseGeocoding: false,
            onPointSelected: (point) => Navigator.of(context).pop(point),
          ),
        ],
      ),
    );
  }
}

class _SavedLocationMapPicker extends StatefulWidget {
  const _SavedLocationMapPicker({
    required this.latitude,
    required this.longitude,
    required this.city,
    required this.area,
    required this.country,
    required this.isReverseGeocoding,
    required this.onPointSelected,
  });

  final double? latitude;
  final double? longitude;
  final String city;
  final String area;
  final String country;
  final bool isReverseGeocoding;
  final ValueChanged<LatLng> onPointSelected;

  bool get hasCoordinates => latitude != null && longitude != null;

  @override
  State<_SavedLocationMapPicker> createState() =>
      _SavedLocationMapPickerState();
}

class _SavedLocationMapPickerState extends State<_SavedLocationMapPicker> {
  final MapController _mapController = MapController();

  LatLng get _fallbackCenter {
    final city = widget.city.trim().toLowerCase();
    return city == 'nablus' ? _nablusFallbackCenter : _palestineFallbackCenter;
  }

  LatLng get _center => widget.hasCoordinates
      ? LatLng(widget.latitude!, widget.longitude!)
      : _fallbackCenter;

  double get _zoom {
    if (widget.hasCoordinates) {
      return 15;
    }
    return widget.city.trim().toLowerCase() == 'nablus' ? 12 : 8;
  }

  String _summary(BuildContext context) {
    if (widget.hasCoordinates) {
      return '${widget.latitude!.toStringAsFixed(6)}, '
          '${widget.longitude!.toStringAsFixed(6)}';
    }

    final parts = [
      if (widget.city.trim().isNotEmpty) widget.city.trim(),
      if (widget.area.trim().isNotEmpty) widget.area.trim(),
      if (widget.country.trim().isNotEmpty) widget.country.trim(),
    ];
    return parts.isEmpty
        ? SavedLocationsL10n.of(context).tapMapToChoose
        : parts.join(' - ');
  }

  @override
  void didUpdateWidget(covariant _SavedLocationMapPicker oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.latitude != widget.latitude ||
        oldWidget.longitude != widget.longitude ||
        oldWidget.city != widget.city) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _syncMapView());
    }
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  void _syncMapView() {
    if (!mounted) {
      return;
    }

    try {
      _mapController.move(_center, _zoom);
    } catch (_) {
      // The map can be between frames while the dialog is resizing.
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = SavedLocationsL10n.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.map_outlined, color: colors.primary, size: 20),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.pickExactPointOnMap,
                      style: AppTextStyles.label(context).copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      widget.isReverseGeocoding
                          ? l10n.lookingUpPoint
                          : _summary(context),
                      style: AppTextStyles.label(context).copyWith(
                        color: colors.textSecondary,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0,
                      ),
                    ),
                  ],
                ),
              ),
              if (widget.isReverseGeocoding)
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 220,
            child: ClipRRect(
              borderRadius: AppRadius.mdAll,
              child: FlutterMap(
                mapController: _mapController,
                options: MapOptions(
                  initialCenter: _center,
                  initialZoom: _zoom,
                  minZoom: 5,
                  maxZoom: 18,
                  onTap: (_, point) => widget.onPointSelected(point),
                  interactionOptions: const InteractionOptions(
                    flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
                  ),
                ),
                children: [
                  TileLayer(
                    urlTemplate:
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.impactloop.frontend',
                  ),
                  if (widget.hasCoordinates)
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: LatLng(widget.latitude!, widget.longitude!),
                          width: 42,
                          height: 42,
                          alignment: Alignment.topCenter,
                          child: _SavedLocationMarker(),
                        ),
                      ],
                    ),
                  RichAttributionWidget(
                    alignment: AttributionAlignment.bottomRight,
                    attributions: [
                      TextSourceAttribution(
                        'OpenStreetMap contributors',
                        onTap: () {},
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l10n.mapPrivacyHelp,
            style: AppTextStyles.label(context).copyWith(
              color: colors.textMuted,
              fontWeight: FontWeight.w600,
              letterSpacing: 0,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}

class _SavedLocationMarker extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: colors.cardSurface.withValues(alpha: 0.96),
            shape: BoxShape.circle,
            border: Border.all(color: colors.primary, width: 2),
            boxShadow: [
              BoxShadow(
                color: colors.primary.withValues(alpha: 0.22),
                blurRadius: 10,
              ),
            ],
          ),
          child: Icon(Icons.location_on, color: colors.primary, size: 21),
        ),
        Container(
          width: 4,
          height: 9,
          decoration: BoxDecoration(
            color: colors.primary,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
      ],
    );
  }
}

class _DeleteSavedLocationDialog extends StatelessWidget {
  const _DeleteSavedLocationDialog({required this.location});

  final SavedLocation location;

  @override
  Widget build(BuildContext context) {
    final l10n = SavedLocationsL10n.of(context);
    return AlertDialog(
      title: Text(l10n.deleteTitle),
      content: Text(
        location.isDefault
            ? l10n.deleteDefaultBody
            : l10n.deleteBody(location.label),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(l10n.cancel),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
          child: Text(l10n.delete),
        ),
      ],
    );
  }
}

class _PrivacyNotice extends StatelessWidget {
  const _PrivacyNotice();

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = SavedLocationsL10n.of(context);
    final mint = ProfileFamilyToneStyle.of(context, ProfileFamilyTone.mint);

    return Semantics(
      container: true,
      label: '${l10n.privacyTitle}. ${l10n.privacyBody}',
      child: Container(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: Color.lerp(colors.cardSurface, mint.surface, 0.72),
          borderRadius: AppRadius.xlAll,
          border: Border.all(color: mint.border),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ProfileFamilyIconContainer(
              icon: Icons.verified_user_outlined,
              tone: ProfileFamilyTone.mint,
              size: 40,
              iconSize: 20,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.privacyTitle,
                    style: AppTextStyles.label(context).copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.privacyBody,
                    style: AppTextStyles.body(context).copyWith(
                      color: colors.textSecondary,
                      fontSize: 13,
                      height: 1.4,
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

class _DefaultBadge extends StatelessWidget {
  const _DefaultBadge();

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = SavedLocationsL10n.of(context);

    return Semantics(
      label: l10n.defaultLabel,
      child: Container(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        decoration: BoxDecoration(
          color: colors.primarySoft,
          borderRadius: AppRadius.pillAll,
          border: Border.all(
            color: Color.lerp(colors.borderSubtle, colors.primary, 0.35)!,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.star_rounded, size: 14, color: colors.primary),
            const SizedBox(width: 4),
            Text(
              l10n.defaultLabel,
              style: AppTextStyles.label(context).copyWith(
                color: colors.primary,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 0,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptySavedLocations extends StatelessWidget {
  const _EmptySavedLocations({
    required this.onCreate,
    required this.onUseCurrentLocation,
    required this.capturingCurrentLocation,
  });

  final VoidCallback onCreate;
  final VoidCallback onUseCurrentLocation;
  final bool capturingCurrentLocation;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = SavedLocationsL10n.of(context);

    return ProfileFamilySurface(
      tone: ProfileFamilyTone.mint,
      showShadow: false,
      child: Column(
        children: [
          ProfileFamilyIconContainer(
            icon: Icons.add_location_alt_outlined,
            tone: ProfileFamilyTone.mint,
            size: 56,
            iconSize: 28,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            l10n.emptyTitle,
            style: AppTextStyles.title(context).copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w800,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.emptyBody,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: colors.textSecondary, height: 1.45),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.lg),
          AppPrimaryButton(label: l10n.addLocation, onPressed: onCreate),
          const SizedBox(height: AppSpacing.sm),
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: OutlinedButton.icon(
              onPressed: capturingCurrentLocation ? null : onUseCurrentLocation,
              icon: capturingCurrentLocation
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.gps_fixed_rounded, size: 18),
              label: Text(
                capturingCurrentLocation
                    ? l10n.useCurrentLocationLoading
                    : l10n.useCurrentLocation,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SavedLocationsLoading extends StatelessWidget {
  const _SavedLocationsLoading();

  @override
  Widget build(BuildContext context) {
    final l10n = SavedLocationsL10n.of(context);
    final colors = AppThemeColors.of(context);

    return ProfileFamilySurface(
      showShadow: false,
      child: Semantics(
        liveRegion: true,
        label: l10n.loadingLocations,
        child: Column(
          children: [
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              l10n.loadingLocations,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: colors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

class _SavedLocationsError extends StatelessWidget {
  const _SavedLocationsError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = SavedLocationsL10n.of(context);
    return ProfileFamilySurface(
      tone: ProfileFamilyTone.danger,
      showShadow: false,
      child: Column(
        children: [
          AppInlineError(message: message.isEmpty ? l10n.loadFailed : message),
          const SizedBox(height: AppSpacing.md),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: Text(l10n.retry),
          ),
        ],
      ),
    );
  }
}
