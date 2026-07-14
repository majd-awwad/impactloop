import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../theme/supplier_theme_extension.dart';
import 'supplier_location_input_mode.dart';
import 'supplier_reverse_geocode_state.dart';
import 'supplier_dark_form_field.dart';
import 'supplier_pickup_map.dart';
import 'supplier_selected_coordinates_panel.dart';
import 'supplier_type_selector.dart';

class SupplierProfileForm extends StatelessWidget {
  const SupplierProfileForm({
    super.key,
    required this.formKey,
    required this.isSaving,
    required this.hasExistingProfile,
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
    required this.workingDaysController,
    required this.workingFromController,
    required this.workingToController,
    required this.useSeparateBusinessLocation,
    required this.businessCountryController,
    required this.businessCityController,
    required this.businessAreaController,
    required this.businessAddressLineController,
    required this.onSupplierTypeChanged,
    required this.onVisibilityChanged,
    required this.onApproximateChanged,
    required this.onSeparateBusinessLocationChanged,
    required this.onFieldChanged,
    required this.onSave,
    required this.locationInputMode,
    required this.locationCapturedThisSession,
    required this.reverseGeocodeState,
    this.locationStatusMessage,
    required this.onPickupAddressFieldChanged,
    required this.onLocationInputModeChanged,
    this.onCancel,
    this.showMapInForm = true,
    this.showLocationButton = false,
    this.latitude,
    this.longitude,
    this.locationButtonState = SupplierLocationButtonState.idle,
    this.onUseCurrentLocation,
  });

  final GlobalKey<FormState> formKey;
  final bool isSaving;
  final bool hasExistingProfile;
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
  final TextEditingController workingDaysController;
  final TextEditingController workingFromController;
  final TextEditingController workingToController;
  final bool useSeparateBusinessLocation;
  final TextEditingController businessCountryController;
  final TextEditingController businessCityController;
  final TextEditingController businessAreaController;
  final TextEditingController businessAddressLineController;
  final ValueChanged<String> onSupplierTypeChanged;
  final ValueChanged<String> onVisibilityChanged;
  final ValueChanged<bool> onApproximateChanged;
  final ValueChanged<bool> onSeparateBusinessLocationChanged;
  final VoidCallback onFieldChanged;
  final VoidCallback? onCancel;
  final VoidCallback onSave;
  final SupplierLocationInputMode locationInputMode;
  final bool locationCapturedThisSession;
  final SupplierReverseGeocodeState reverseGeocodeState;
  final String? locationStatusMessage;
  final VoidCallback onPickupAddressFieldChanged;
  final ValueChanged<SupplierLocationInputMode> onLocationInputModeChanged;
  final bool showMapInForm;
  final bool showLocationButton;
  final double? latitude;
  final double? longitude;
  final SupplierLocationButtonState locationButtonState;
  final VoidCallback? onUseCurrentLocation;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;
    final showOrganization = isOrganizationSupplierType(supplierType);
    final isWide = MediaQuery.sizeOf(context).width >= 1024;
    final usingCurrentLocation =
        locationInputMode == SupplierLocationInputMode.currentLocation;
    final hasCoordinates = latitude != null && longitude != null;
    final hasFreshCapture = usingCurrentLocation && locationCapturedThisSession;

    String? cityValidator(String? value) {
      if (hasFreshCapture && hasCoordinates) {
        return null;
      }
      if (!usingCurrentLocation &&
          (value == null || value.trim().isEmpty)) {
        return l.required;
      }
      return null;
    }

    String? requiredValidator(String? value) {
      return value == null || value.trim().isEmpty ? l.required : null;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: decorations.profileGlassCard,
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              hasExistingProfile ? l.editProfileTitle : l.createProfile,
              style: context.supplierTitle(),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              l.profileIntro,
              style: context.supplierBody(),
            ),
            const SupplierSectionGap(),
            SupplierFormSectionHeader(
              icon: Icons.person_outline,
              title: l.publicDetails,
              subtitle: l.publicDetailsSubtitle,
            ),
            const SizedBox(height: AppSpacing.lg),
            SupplierDarkTextField(
              controller: publicNameController,
              label: l.publicName,
              hint: l.publicNameHint,
              validator: requiredValidator,
              onChanged: (_) => onFieldChanged(),
            ),
            const SupplierFieldGap(),
            SupplierTypeSelector(
              value: supplierType,
              onChanged: (value) {
                onSupplierTypeChanged(value);
                onFieldChanged();
              },
            ),
            const SupplierFieldGap(),
            SupplierDarkTextArea(
              controller: descriptionController,
              label: l.aboutMaterials,
              hint: l.aboutMaterialsHint,
              maxLines: 4,
              onChanged: (_) => onFieldChanged(),
            ),
            const SupplierSectionGap(),
            SupplierFormSectionHeader(
              icon: Icons.location_on_outlined,
              title: l.defaultPickupArea,
              subtitle: l.defaultPickupSubtitle,
            ),
            const SizedBox(height: AppSpacing.md),
            SegmentedButton<SupplierLocationInputMode>(
              segments: [
                ButtonSegment(
                  value: SupplierLocationInputMode.currentLocation,
                  label: Text(l.useCurrentLocation),
                  icon: const Icon(Icons.my_location_outlined, size: 18),
                ),
                ButtonSegment(
                  value: SupplierLocationInputMode.manual,
                  label: Text(l.enterManually),
                  icon: const Icon(Icons.edit_location_alt_outlined, size: 18),
                ),
              ],
              selected: {locationInputMode},
              style: SegmentedButton.styleFrom(
                foregroundColor: colors.textPrimary,
                selectedForegroundColor: colors.textOnAccent,
                selectedBackgroundColor: colors.accent,
                backgroundColor: colors.chipUnselected,
                disabledForegroundColor: colors.textMuted,
                side: BorderSide(
                  color: colors.borderFocused.withValues(alpha: 0.7),
                ),
              ),
              onSelectionChanged: (selection) {
                onLocationInputModeChanged(selection.first);
              },
            ),
            if (usingCurrentLocation) ...[
              const SizedBox(height: AppSpacing.md),
              if (locationButtonState == SupplierLocationButtonState.loading)
                Row(
                  children: [
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(locationStatusMessage ?? l.gettingLocation),
                  ],
                )
              else if (hasFreshCapture && hasCoordinates) ...[
                SupplierSelectedCoordinatesPanel(
                  latitude: latitude!,
                  longitude: longitude!,
                  helperMessage: locationStatusMessage,
                ),
                if (reverseGeocodeState == SupplierReverseGeocodeState.loading)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.sm),
                    child: Row(
                      children: [
                        const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Text(l.findingAddress),
                      ],
                    ),
                  ),
                const SizedBox(height: AppSpacing.sm),
                OutlinedButton.icon(
                  onPressed:
                      reverseGeocodeState == SupplierReverseGeocodeState.loading
                      ? null
                      : onUseCurrentLocation,
                  icon: const Icon(Icons.refresh, size: 18),
                  label: Text(l.refreshLocation),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: colors.accent,
                    side: BorderSide(
                      color: colors.borderFocused.withValues(alpha: 0.75),
                    ),
                  ),
                ),
              ] else
                OutlinedButton.icon(
                  onPressed: onUseCurrentLocation,
                  icon: const Icon(Icons.my_location_outlined, size: 18),
                  label: Text(l.useCurrentLocation),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: colors.textPrimary,
                    side: BorderSide(
                      color: colors.borderFocused.withValues(alpha: 0.75),
                    ),
                  ),
                ),
            ],
            if (hasFreshCapture) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                l.optionalAddressDetails,
                style: context.supplierLabel().copyWith(
                  color: colors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                l.coordinatesSourceOfTruth,
                style: context.supplierBody().copyWith(
                  color: colors.textSecondary,
                  fontSize: 13,
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            _ResponsiveFieldRow(
              children: [
                SupplierDarkTextField(
                  controller: countryController,
                  label: hasFreshCapture ? l.countryOptionalLabel : l.country,
                  hint: hasFreshCapture ? l.optional : l.country,
                  onChanged: (_) => onPickupAddressFieldChanged(),
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
                  hint: hasFreshCapture ? l.optionalNeighborhoodOrDistrict : l.areaHint,
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
            if (latitude != null &&
                longitude != null &&
                !usingCurrentLocation) ...[
              const SupplierSectionGap(),
              SupplierSelectedCoordinatesPanel(
                latitude: latitude!,
                longitude: longitude!,
              ),
            ],
            if (showMapInForm) ...[
              const SupplierSectionGap(),
              SupplierPickupMap(
                latitude: latitude,
                longitude: longitude,
                fallbackCity: hasFreshCapture && cityController.text.trim().isEmpty
                    ? ''
                    : cityController.text,
                fallbackArea: hasFreshCapture && areaController.text.trim().isEmpty
                    ? null
                    : areaController.text,
                fallbackCountry:
                    hasFreshCapture && countryController.text.trim().isEmpty
                    ? ''
                    : countryController.text,
                visibility: visibility,
                isEditable: true,
                showLocationButton: showLocationButton,
                locationButtonState: locationButtonState,
                onUseCurrentLocation: onUseCurrentLocation,
                compact: true,
                showCoordinatesAsLabel:
                    hasFreshCapture &&
                    hasCoordinates &&
                    cityController.text.trim().isEmpty &&
                    areaController.text.trim().isEmpty,
              ),
            ],
            const SupplierSectionGap(),
            SupplierFormSectionHeader(
              icon: Icons.privacy_tip_outlined,
              title: l.locationPrivacy,
              subtitle: l.locationPrivacySubtitle,
            ),
            const SizedBox(height: AppSpacing.lg),
            _ResponsiveFieldRow(
              children: [
                SupplierDarkDropdownField<String>(
                  label: l.locationVisibility,
                  hint: l.chooseVisibility,
                  value: visibility,
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
                  onChanged: (value) {
                    onApproximateChanged(value);
                    onFieldChanged();
                  },
                ),
              ],
            ),
            if (showOrganization) ...[
              const SupplierSectionGap(),
              SupplierFormSectionHeader(
                icon: Icons.business_outlined,
                title: l.organizationDetails,
                subtitle: l.organizationSubtitle,
              ),
              const SizedBox(height: AppSpacing.lg),
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
              const SupplierFieldGap(),
              _ResponsiveFieldRow(
                children: [
                  SupplierDarkTextField(
                    controller: workingDaysController,
                    label: l.workingDays,
                    hint: l.workingDaysHint,
                    onChanged: (_) => onFieldChanged(),
                  ),
                  SupplierDarkTextField(
                    controller: workingFromController,
                    label: l.openFrom,
                    hint: '09:00',
                    onChanged: (_) => onFieldChanged(),
                  ),
                  SupplierDarkTextField(
                    controller: workingToController,
                    label: l.openUntil,
                    hint: '17:00',
                    onChanged: (_) => onFieldChanged(),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              SupplierDarkSwitchTile(
                title: l.separateBusinessLocation,
                subtitle: l.separateBusinessLocationSubtitle,
                value: useSeparateBusinessLocation,
                onChanged: onSeparateBusinessLocationChanged,
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
            const SupplierSectionGap(),
            _FormActions(
              isSaving: isSaving,
              onSave: onSave,
              onCancel: onCancel,
              compact: !isWide,
            ),
          ],
        ),
      ),
    );
  }
}

class _FormActions extends StatelessWidget {
  const _FormActions({
    required this.isSaving,
    required this.onSave,
    required this.compact,
    this.onCancel,
  });

  final bool isSaving;
  final VoidCallback onSave;
  final VoidCallback? onCancel;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final saveButton = FilledButton.icon(
      onPressed: isSaving ? null : onSave,
      icon: isSaving
          ? const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Icon(Icons.save_outlined, size: 18),
      label: Text(isSaving ? l.savingProfile : l.saveProfile),
      style: AppStatusButtonStyle.filled(
        context,
        AppStatusTone.primary,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
      ),
    );

    final cancelButton = onCancel == null
        ? null
        : OutlinedButton(
            onPressed: isSaving ? null : onCancel,
            style: OutlinedButton.styleFrom(
              foregroundColor: colors.textPrimary,
              side: BorderSide(
                color: colors.border.withValues(alpha: 0.55),
              ),
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.md,
              ),
              shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
            ),
            child: Text(l.cancel),
          );

    if (compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          saveButton,
          if (cancelButton != null) ...[
            const SizedBox(height: AppSpacing.sm),
            cancelButton,
          ],
        ],
      );
    }

    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.sm,
      children: [
        saveButton,
        ?cancelButton,
      ],
    );
  }
}

class _ResponsiveFieldRow extends StatelessWidget {
  const _ResponsiveFieldRow({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.sizeOf(context).width >= 840;

    if (!isWide) {
      return Column(
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
