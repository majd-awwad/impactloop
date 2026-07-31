import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../l10n/l10n.dart';
import '../theme/supplier_theme_extension.dart';
import 'supplier_dark_form_field.dart';
import 'supplier_location_input_mode.dart';
import 'supplier_pickup_map.dart';
import 'supplier_reverse_geocode_state.dart';
import 'supplier_type_selector.dart';

const supplierWorkingDayValues = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

class SupplierProfileForm extends StatelessWidget {
  const SupplierProfileForm({
    super.key,
    required this.formKey,
    required this.publicNameController,
    required this.descriptionController,
    required this.countryController,
    required this.cityController,
    required this.areaController,
    required this.addressLineController,
    required this.supplierType,
    required this.visibility,
    required this.isApproximate,
    required this.organizationNameController,
    required this.contactPersonController,
    required this.workingFromController,
    required this.workingToController,
    required this.selectedWorkingDays,
    required this.useSeparateBusinessLocation,
    required this.businessCountryController,
    required this.businessCityController,
    required this.businessAreaController,
    required this.businessAddressLineController,
    required this.onSupplierTypeChanged,
    required this.onVisibilityChanged,
    required this.onApproximateChanged,
    required this.onSeparateBusinessLocationChanged,
    required this.onWorkingDaysChanged,
    required this.onFieldChanged,
    required this.onCountryChanged,
    required this.locationInputMode,
    required this.locationCapturedThisSession,
    required this.reverseGeocodeState,
    required this.onPickupAddressFieldChanged,
    required this.onLocationInputModeChanged,
    required this.onPinMoved,
    this.locationStatusMessage,
    this.latitude,
    this.longitude,
    this.locationButtonState = SupplierLocationButtonState.idle,
    this.onUseCurrentLocation,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController publicNameController;
  final TextEditingController descriptionController;
  final TextEditingController countryController;
  final TextEditingController cityController;
  final TextEditingController areaController;
  final TextEditingController addressLineController;
  final String supplierType;
  final String visibility;
  final bool isApproximate;
  final TextEditingController organizationNameController;
  final TextEditingController contactPersonController;
  final TextEditingController workingFromController;
  final TextEditingController workingToController;
  final List<String> selectedWorkingDays;
  final bool useSeparateBusinessLocation;
  final TextEditingController businessCountryController;
  final TextEditingController businessCityController;
  final TextEditingController businessAreaController;
  final TextEditingController businessAddressLineController;
  final ValueChanged<String> onSupplierTypeChanged;
  final ValueChanged<String> onVisibilityChanged;
  final ValueChanged<bool> onApproximateChanged;
  final ValueChanged<bool> onSeparateBusinessLocationChanged;
  final ValueChanged<List<String>> onWorkingDaysChanged;
  final VoidCallback onFieldChanged;
  final VoidCallback onCountryChanged;
  final SupplierLocationInputMode locationInputMode;
  final bool locationCapturedThisSession;
  final SupplierReverseGeocodeState reverseGeocodeState;
  final String? locationStatusMessage;
  final VoidCallback onPickupAddressFieldChanged;
  final ValueChanged<SupplierLocationInputMode> onLocationInputModeChanged;
  final ValueChanged<LatLng> onPinMoved;
  final double? latitude;
  final double? longitude;
  final SupplierLocationButtonState locationButtonState;
  final VoidCallback? onUseCurrentLocation;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final isCompact = MediaQuery.sizeOf(context).width < 680;
    final showOrganization = isOrganizationSupplierType(supplierType);
    final usingCurrentLocation =
        locationInputMode == SupplierLocationInputMode.currentLocation;
    final hasCoordinates = latitude != null && longitude != null;
    final hasFreshCapture = usingCurrentLocation && locationCapturedThisSession;
    final hasSelectedLocation =
        hasCoordinates &&
        (hasFreshCapture ||
            !usingCurrentLocation ||
            locationButtonState == SupplierLocationButtonState.captured);
    final validVisibility = const {
      'PUBLIC',
      'ORDER_ONLY',
      'PRIVATE',
    }.contains(visibility);

    String? requiredValidator(String? value) {
      return value == null || value.trim().isEmpty ? l.required : null;
    }

    String? cityValidator(String? value) {
      if (hasFreshCapture && hasCoordinates) {
        return null;
      }
      if (!usingCurrentLocation && (value == null || value.trim().isEmpty)) {
        return l.required;
      }
      return null;
    }

    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SupplierFormSection(
            title: context.l10n.supplierPublicProfileSection,
            subtitle: l.publicDetailsSubtitle,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SupplierDarkTextField(
                  controller: publicNameController,
                  label: l.publicName,
                  hint: l.publicNameHint,
                  validator: requiredValidator,
                  onChanged: (_) => onFieldChanged(),
                ),
                const _CompactFieldGap(),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: SizedBox(
                    width: isCompact ? double.infinity : 480,
                    child: SupplierTypeSelector(
                      value: supplierType,
                      onChanged: (value) {
                        onSupplierTypeChanged(value);
                        onFieldChanged();
                      },
                    ),
                  ),
                ),
                const _CompactFieldGap(),
                SupplierDarkTextArea(
                  controller: descriptionController,
                  label: l.aboutMaterials,
                  hint: l.aboutMaterialsHint,
                  minLines: 3,
                  maxLines: 4,
                  onChanged: (_) => onFieldChanged(),
                ),
              ],
            ),
          ),
          const SupplierSectionGap(),
          _SupplierFormSection(
            title: context.l10n.supplierPickupLocationAndPrivacy,
            subtitle: l.locationPrivacySubtitle,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Semantics(
                  container: true,
                  label: l.locationModeLabel,
                  child: Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: SizedBox(
                      key: const ValueKey('location-mode-width'),
                      width: isCompact ? double.infinity : 480,
                      child: SegmentedButton<SupplierLocationInputMode>(
                        segments: [
                          ButtonSegment(
                            value: SupplierLocationInputMode.currentLocation,
                            label: _ModeSegmentLabel(
                              label: l.useCurrentLocation,
                              isLoading:
                                  locationButtonState ==
                                  SupplierLocationButtonState.loading,
                            ),
                            icon: const Icon(
                              Icons.my_location_outlined,
                              size: 18,
                            ),
                          ),
                          ButtonSegment(
                            value: SupplierLocationInputMode.manual,
                            label: Text(l.enterManually),
                            icon: const Icon(
                              Icons.edit_location_alt_outlined,
                              size: 18,
                            ),
                          ),
                        ],
                        selected: {locationInputMode},
                        showSelectedIcon: false,
                        style: SegmentedButton.styleFrom(
                          foregroundColor: context.supplierColors.textPrimary,
                          selectedForegroundColor:
                              context.supplierColors.accent,
                          selectedBackgroundColor: context.supplierColors.accent
                              .withValues(alpha: 0.14),
                          backgroundColor:
                              context.supplierColors.chipUnselected,
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.sm,
                            vertical: AppSpacing.sm,
                          ),
                          side: BorderSide(
                            color: context.supplierColors.border.withValues(
                              alpha: 0.55,
                            ),
                          ),
                        ),
                        onSelectionChanged: (selection) {
                          onLocationInputModeChanged(selection.first);
                        },
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                if (usingCurrentLocation &&
                    locationButtonState == SupplierLocationButtonState.loading)
                  _LocationProgress(
                    message: locationStatusMessage ?? l.gettingLocation,
                  )
                else if (usingCurrentLocation && hasSelectedLocation)
                  _LocationConfirmation(
                    title: l.locationSelected,
                    summary: _locationSummary(
                      cityController,
                      areaController,
                      addressLineController,
                    ),
                    message: locationStatusMessage,
                  )
                else if (!usingCurrentLocation)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.md),
                    child: Text(
                      l.manualLocationInstructions,
                      style: context.supplierBody(),
                    ),
                  ),
                _ResponsiveFieldRow(
                  children: [
                    SupplierDarkTextField(
                      controller: countryController,
                      label: hasFreshCapture
                          ? l.countryOptionalLabel
                          : l.country,
                      hint: hasFreshCapture ? l.optional : l.country,
                      onChanged: (_) => onCountryChanged(),
                    ),
                    SupplierDarkTextField(
                      controller: cityController,
                      label: hasFreshCapture ? l.cityOptionalLabel : l.city,
                      hint: hasFreshCapture ? l.optional : l.city,
                      validator: cityValidator,
                      onChanged: (_) => onPickupAddressFieldChanged(),
                    ),
                  ],
                ),
                const SupplierFieldGap(),
                _ResponsiveFieldRow(
                  children: [
                    SupplierDarkTextField(
                      controller: areaController,
                      label: hasFreshCapture ? l.areaOptionalLabel : l.area,
                      hint: hasFreshCapture
                          ? l.optionalNeighborhoodOrDistrict
                          : l.areaHint,
                      onChanged: (_) => onPickupAddressFieldChanged(),
                    ),
                    SupplierDarkTextField(
                      controller: addressLineController,
                      label: hasFreshCapture
                          ? l.addressLineOptionalLabel
                          : l.addressLine,
                      hint: hasFreshCapture
                          ? l.optionalStreetOrBuilding
                          : l.addressHint,
                      onChanged: (_) => onPickupAddressFieldChanged(),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                SupplierPickupMap(
                  latitude: latitude,
                  longitude: longitude,
                  fallbackCity: cityController.text,
                  fallbackArea: areaController.text,
                  fallbackCountry: countryController.text,
                  visibility: validVisibility ? visibility : null,
                  showLocationSummary: false,
                  isEditable: true,
                  showLocationButton: false,
                  locationButtonState: locationButtonState,
                  compact: true,
                  showCoordinatesAsLabel: false,
                  allowPinPlacement: !usingCurrentLocation,
                  onPinMoved: onPinMoved,
                ),
                const SizedBox(height: AppSpacing.lg),
                _CompactSubsection(
                  title: l.locationPrivacy,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _ResponsiveFieldRow(
                        children: [
                          SupplierDarkDropdownField<String>(
                            label: l.locationVisibility,
                            hint: l.chooseVisibility,
                            value: validVisibility ? visibility : null,
                            items: [
                              DropdownMenuItem(
                                value: 'PUBLIC',
                                child: Text(l.visibilityPublic),
                              ),
                              DropdownMenuItem(
                                value: 'ORDER_ONLY',
                                child: Text(l.visibilityOrderOnly),
                              ),
                              DropdownMenuItem(
                                value: 'PRIVATE',
                                child: Text(l.visibilityPrivate),
                              ),
                            ],
                            onChanged: (value) {
                              if (value != null) {
                                onVisibilityChanged(value);
                                onFieldChanged();
                              }
                            },
                          ),
                          SupplierDarkSwitchTile(
                            title: l.showApproximate,
                            subtitle: l.showApproximateSubtitle,
                            value: isApproximate,
                            onChanged: visibility == 'PUBLIC'
                                ? (value) {
                                    onApproximateChanged(value);
                                    onFieldChanged();
                                  }
                                : null,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      _PrivacyExplanation(
                        visibility: visibility,
                        isApproximate: isApproximate,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (showOrganization) ...[
            const SupplierSectionGap(),
            _SupplierFormSection(
              title: context.l10n.supplierOrganizationAvailabilitySection,
              subtitle: l.organizationSubtitle,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _LightSubsectionHeading(title: l.organizationDetails),
                  _ResponsiveFieldRow(
                    children: [
                      SupplierDarkTextField(
                        controller: organizationNameController,
                        label: l.organizationName,
                        hint: l.organizationNameHint,
                        validator: requiredValidator,
                        onChanged: (_) => onFieldChanged(),
                      ),
                      SupplierDarkTextField(
                        controller: contactPersonController,
                        label: l.contactPerson,
                        hint: l.contactPersonHint,
                        onChanged: (_) => onFieldChanged(),
                      ),
                    ],
                  ),
                  if (_sameText(
                    organizationNameController.text,
                    publicNameController.text,
                  )) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      context.l10n.supplierOrganizationNameHelp,
                      style: context.supplierBody(),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.lg),
                  _LightSubsectionHeading(
                    title: l.workingAvailability,
                  ),
                  SupplierFormLabel(label: l.workingDays),
                  const SizedBox(height: AppSpacing.sm),
                  _WorkingDaySelector(
                    selectedDays: selectedWorkingDays,
                    onChanged: onWorkingDaysChanged,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _ResponsiveFieldRow(
                    children: [
                      _TimePickerField(
                        controller: workingFromController,
                        label: l.openFrom,
                        onChanged: onFieldChanged,
                        validator: (value) => _timeValidator(value, l),
                      ),
                      _TimePickerField(
                        controller: workingToController,
                        label: l.openUntil,
                        onChanged: onFieldChanged,
                        validator: (value) => _endTimeValidator(
                          value,
                          workingFromController.text,
                          l,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    context.l10n.supplierAvailabilityInformationalHelp,
                    style: context.supplierBody(),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _LightSubsectionHeading(
                    title: context.l10n.supplierSeparateOrganizationAddress,
                  ),
                  SupplierDarkSwitchTile(
                    title: l.separateBusinessLocation,
                    subtitle: l.separateBusinessLocationSubtitle,
                    value: useSeparateBusinessLocation,
                    onChanged: (value) {
                      onSeparateBusinessLocationChanged(value);
                      onFieldChanged();
                    },
                  ),
                  if (useSeparateBusinessLocation) ...[
                    const SupplierFieldGap(),
                    _ResponsiveFieldRow(
                      children: [
                        SupplierDarkTextField(
                          controller: businessCountryController,
                          label: l.businessCountry,
                          validator: requiredValidator,
                          onChanged: (_) => onFieldChanged(),
                        ),
                        SupplierDarkTextField(
                          controller: businessCityController,
                          label: l.businessCity,
                          validator: requiredValidator,
                          onChanged: (_) => onFieldChanged(),
                        ),
                      ],
                    ),
                    const SupplierFieldGap(),
                    _ResponsiveFieldRow(
                      children: [
                        SupplierDarkTextField(
                          controller: businessAreaController,
                          label: l.businessArea,
                          onChanged: (_) => onFieldChanged(),
                        ),
                        SupplierDarkTextField(
                          controller: businessAddressLineController,
                          label: l.businessAddressLine,
                          onChanged: (_) => onFieldChanged(),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SupplierFormSection extends StatelessWidget {
  const _SupplierFormSection({
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.border.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: context.supplierSectionTitle()),
          const SizedBox(height: AppSpacing.xs),
          Text(subtitle, style: context.supplierBody()),
          const SizedBox(height: AppSpacing.lg),
          child,
        ],
      ),
    );
  }
}

class _CompactSubsection extends StatelessWidget {
  const _CompactSubsection({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceSolid.withValues(alpha: 0.42),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.border.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: context.supplierLabel()),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}

class _LightSubsectionHeading extends StatelessWidget {
  const _LightSubsectionHeading({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: context.supplierLabel().copyWith(
                color: colors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Divider(
              color: colors.border.withValues(alpha: 0.35),
              height: 1,
            ),
          ),
        ],
      ),
    );
  }
}

class _CompactFieldGap extends StatelessWidget {
  const _CompactFieldGap();

  @override
  Widget build(BuildContext context) => const SizedBox(height: AppSpacing.sm);
}

class _ModeSegmentLabel extends StatelessWidget {
  const _ModeSegmentLabel({required this.label, required this.isLoading});

  final String label;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    if (!isLoading) {
      return Text(label, overflow: TextOverflow.ellipsis);
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(
          width: 14,
          height: 14,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        const SizedBox(width: AppSpacing.xs),
        Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
      ],
    );
  }
}

class _LocationProgress extends StatelessWidget {
  const _LocationProgress({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label: message,
      child: Row(
        children: [
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Text(message, style: context.supplierBody())),
        ],
      ),
    );
  }
}

class _LocationConfirmation extends StatelessWidget {
  const _LocationConfirmation({
    required this.title,
    required this.summary,
    this.message,
  });

  final String title;
  final String? summary;
  final String? message;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final details = [
      if (summary != null && summary!.isNotEmpty) summary!,
      if (message != null && message!.isNotEmpty) message!,
    ].join(' ');
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.accentSoft.withValues(alpha: 0.12),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.accent.withValues(alpha: 0.3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.check_circle_outline, color: colors.accent, size: 18),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              details.isEmpty ? title : '$title · $details',
              style: context.supplierBody().copyWith(color: colors.accent),
            ),
          ),
        ],
      ),
    );
  }
}

class _PrivacyExplanation extends StatelessWidget {
  const _PrivacyExplanation({
    required this.visibility,
    required this.isApproximate,
  });

  final String visibility;
  final bool isApproximate;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final copy = switch (visibility) {
      'PUBLIC' when isApproximate => context.l10n.supplierVisibilityPublicApproximate,
      'PUBLIC' => context.l10n.supplierVisibilityPublicExact,
      'ORDER_ONLY' => context.l10n.supplierVisibilityOrderOnly,
      'PRIVATE' => context.l10n.supplierVisibilityPrivate,
      _ => context.l10n.supplierVisibilityUnavailable,
    };
    return Semantics(
      label: copy,
      child: Text(copy, style: context.supplierBody()),
    );
  }
}

class _WorkingDaySelector extends StatelessWidget {
  const _WorkingDaySelector({
    required this.selectedDays,
    required this.onChanged,
  });

  final List<String> selectedDays;
  final ValueChanged<List<String>> onChanged;

  String _label(BuildContext context, String value) {
    final l10n = context.l10n;
    return switch (value) {
      'SUNDAY' => l10n.supplierDaySun,
      'MONDAY' => l10n.supplierDayMon,
      'TUESDAY' => l10n.supplierDayTue,
      'WEDNESDAY' => l10n.supplierDayWed,
      'THURSDAY' => l10n.supplierDayThu,
      'FRIDAY' => l10n.supplierDayFri,
      'SATURDAY' => l10n.supplierDaySat,
      _ => '',
    };
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: context.s.workingDays,
      child: Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.sm,
        children: [
          for (final day in supplierWorkingDayValues)
            Semantics(
              selected: selectedDays.contains(day),
              button: true,
              label: _label(context, day),
              child: Builder(
                builder: (context) {
                  final selected = selectedDays.contains(day);
                  final colors = context.supplierColors;
                  return FilterChip(
                    key: ValueKey('working-day-$day'),
                    label: Text(_label(context, day)),
                    selected: selected,
                    showCheckmark: false,
                    selectedColor: colors.accent.withValues(alpha: 0.14),
                    backgroundColor: colors.surfaceSolid.withValues(
                      alpha: 0.45,
                    ),
                    side: BorderSide(
                      color: selected
                          ? colors.accent.withValues(alpha: 0.62)
                          : colors.border.withValues(alpha: 0.45),
                    ),
                    labelStyle: context.supplierChip().copyWith(
                      color: selected ? colors.accent : colors.textSecondary,
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.xs,
                      vertical: 2,
                    ),
                    onSelected: (isSelected) {
                      final next = [...selectedDays];
                      if (isSelected) {
                        if (!next.contains(day)) next.add(day);
                      } else {
                        next.remove(day);
                      }
                      next.sort(
                        (a, b) => supplierWorkingDayValues
                            .indexOf(a)
                            .compareTo(supplierWorkingDayValues.indexOf(b)),
                      );
                      onChanged(next);
                    },
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _TimePickerField extends StatelessWidget {
  const _TimePickerField({
    required this.controller,
    required this.label,
    required this.onChanged,
    required this.validator,
  });

  final TextEditingController controller;
  final String label;
  final VoidCallback onChanged;
  final String? Function(String?) validator;

  TimeOfDay? _parse(String value) {
    final parts = value.split(':');
    if (parts.length != 2) return null;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null || hour > 23 || minute > 59) {
      return null;
    }
    return TimeOfDay(hour: hour, minute: minute);
  }

  @override
  Widget build(BuildContext context) {
    return FormField<String>(
      validator: validator,
      builder: (state) {
        final parsed = _parse(controller.text);
        final chooseTime = context.l10n.supplierChooseTime;
        final display =
            parsed?.format(context) ??
            (controller.text.trim().isEmpty ? chooseTime : controller.text);
        final decoration = context.supplierDecorations
            .formFieldDecoration(hint: chooseTime)
            .copyWith(errorText: state.errorText);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SupplierFormLabel(label: label),
            const SizedBox(height: AppSpacing.sm),
            Semantics(
              button: true,
              label: label,
              child: InkWell(
                borderRadius: AppRadius.mdAll,
                onTap: () async {
                  final picked = await showTimePicker(
                    context: context,
                    initialTime: parsed ?? const TimeOfDay(hour: 9, minute: 0),
                    helpText: label,
                  );
                  if (picked == null) return;
                  controller.text =
                      '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
                  state.didChange(controller.text);
                  onChanged();
                },
                child: InputDecorator(
                  decoration: decoration,
                  isEmpty: parsed == null && controller.text.trim().isEmpty,
                  child: Text(
                    display,
                    style: context.supplierBody().copyWith(
                      color: parsed == null && controller.text.trim().isEmpty
                          ? context.supplierColors.textMuted
                          : context.supplierColors.textPrimary,
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ResponsiveFieldRow extends StatelessWidget {
  const _ResponsiveFieldRow({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.sizeOf(context).width >= 680;
    if (!isWide) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var index = 0; index < children.length; index++) ...[
            children[index],
            if (index != children.length - 1) const SupplierFieldGap(),
          ],
        ],
      );
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var index = 0; index < children.length; index++) ...[
          Expanded(child: children[index]),
          if (index != children.length - 1)
            const SizedBox(width: AppSpacing.md),
        ],
      ],
    );
  }
}

String? _timeValidator(String? value, SupplierL10n l) {
  if (value == null || value.trim().isEmpty) return null;
  final parts = value.split(':');
  final hour = parts.length == 2 ? int.tryParse(parts[0]) : null;
  final minute = parts.length == 2 ? int.tryParse(parts[1]) : null;
  if (hour == null || minute == null || hour > 23 || minute > 59) {
    return l.chooseValidTime;
  }
  return null;
}

String? _endTimeValidator(String? value, String startValue, SupplierL10n l) {
  final ownError = _timeValidator(value, l);
  if (ownError != null) return ownError;
  if (value == null || value.trim().isEmpty || startValue.trim().isEmpty) {
    return null;
  }
  final start = _timeMinutes(startValue);
  final end = _timeMinutes(value);
  if (start == null || end == null || end <= start) {
    return l.endTimeMustBeAfterStart;
  }
  return null;
}

int? _timeMinutes(String value) {
  final parts = value.split(':');
  if (parts.length != 2) return null;
  final hour = int.tryParse(parts[0]);
  final minute = int.tryParse(parts[1]);
  if (hour == null || minute == null || hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

bool _sameText(String first, String second) =>
    first.trim().isNotEmpty &&
    first.trim().toLowerCase() == second.trim().toLowerCase();

String? _locationSummary(
  TextEditingController city,
  TextEditingController area,
  TextEditingController address,
) {
  final parts = [
    if (area.text.trim().isNotEmpty) area.text.trim(),
    if (city.text.trim().isNotEmpty) city.text.trim(),
    if (address.text.trim().isNotEmpty) address.text.trim(),
  ];
  return parts.isEmpty ? null : parts.join(', ');
}
