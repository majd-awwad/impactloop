import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
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
  final bool showMapInForm;
  final bool showLocationButton;
  final double? latitude;
  final double? longitude;
  final SupplierLocationButtonState locationButtonState;
  final VoidCallback? onUseCurrentLocation;

  @override
  Widget build(BuildContext context) {
    final showOrganization = isOrganizationSupplierType(supplierType);
    final isWide = MediaQuery.sizeOf(context).width >= 1024;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: SupplierDecorations.profileGlassCard,
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              hasExistingProfile ? 'Edit profile' : 'Create your profile',
              style: AuthDarkTextStyles.title(context),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Update how learners discover you and where materials can be collected.',
              style: AuthDarkTextStyles.body(context),
            ),
            const SupplierSectionGap(),
            const SupplierFormSectionHeader(
              icon: Icons.person_outline,
              title: 'Public supplier details',
              subtitle: 'These details appear on your public supplier profile.',
            ),
            const SizedBox(height: AppSpacing.lg),
            SupplierDarkTextField(
              controller: publicNameController,
              label: 'Public supplier name',
              hint: 'How learners will see you',
              validator: _required,
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
              label: 'About your materials',
              hint: 'Share the material types you usually offer.',
              maxLines: 4,
              onChanged: (_) => onFieldChanged(),
            ),
            const SupplierSectionGap(),
            const SupplierFormSectionHeader(
              icon: Icons.location_on_outlined,
              title: 'Default pickup area',
              subtitle:
                  'Use a general pickup area. Exact addresses stay hidden until needed.',
            ),
            const SizedBox(height: AppSpacing.lg),
            _ResponsiveFieldRow(
              children: [
                SupplierDarkTextField(
                  controller: countryController,
                  label: 'Country',
                  hint: 'Country',
                  validator: _required,
                  onChanged: (_) => onFieldChanged(),
                ),
                SupplierDarkTextField(
                  controller: cityController,
                  label: 'City',
                  hint: 'City',
                  validator: _required,
                  onChanged: (_) => onFieldChanged(),
                ),
              ],
            ),
            const SupplierFieldGap(),
            _ResponsiveFieldRow(
              children: [
                SupplierDarkTextField(
                  controller: areaController,
                  label: 'Area',
                  hint: 'Neighborhood or district',
                  onChanged: (_) => onFieldChanged(),
                ),
                SupplierDarkTextField(
                  controller: addressLineController,
                  label: 'Address line',
                  hint: 'Street or building (kept private)',
                  onChanged: (_) => onFieldChanged(),
                ),
              ],
            ),
            if (latitude != null && longitude != null) ...[
              const SupplierSectionGap(),
              SupplierSelectedCoordinatesPanel(
                latitude: latitude!,
                longitude: longitude!,
                showCaptureHelper:
                    locationButtonState == SupplierLocationButtonState.captured,
              ),
            ],
            if (showMapInForm) ...[
              const SupplierSectionGap(),
              SupplierPickupMap(
                latitude: latitude,
                longitude: longitude,
                fallbackCity: cityController.text,
                fallbackArea: areaController.text,
                fallbackCountry: countryController.text,
                visibility: visibility,
                isEditable: true,
                showLocationButton: showLocationButton,
                locationButtonState: locationButtonState,
                onUseCurrentLocation: onUseCurrentLocation,
                compact: true,
              ),
            ],
            const SupplierSectionGap(),
            const SupplierFormSectionHeader(
              icon: Icons.privacy_tip_outlined,
              title: 'Location privacy',
              subtitle:
                  'Your exact pickup address stays private. Learners only see a general area until a reservation is accepted.',
            ),
            const SizedBox(height: AppSpacing.lg),
            _ResponsiveFieldRow(
              children: [
                SupplierDarkDropdownField<String>(
                  label: 'Location visibility',
                  hint: 'Choose visibility',
                  value: visibility,
                  items: const [
                    DropdownMenuItem(
                      value: 'PUBLIC',
                      child: Text('Public area'),
                    ),
                    DropdownMenuItem(
                      value: 'ORDER_ONLY',
                      child: Text('Order only'),
                    ),
                    DropdownMenuItem(value: 'PRIVATE', child: Text('Private')),
                  ],
                  onChanged: (value) {
                    if (value != null) {
                      onVisibilityChanged(value);
                      onFieldChanged();
                    }
                  },
                ),
                SupplierDarkSwitchTile(
                  title: 'Show as approximate',
                  subtitle: 'Learners see a general area, not an exact pin.',
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
              const SupplierFormSectionHeader(
                icon: Icons.business_outlined,
                title: 'Organization details',
                subtitle:
                    'For workshops, factories, and educational institutions only.',
              ),
              const SizedBox(height: AppSpacing.lg),
              _ResponsiveFieldRow(
                children: [
                  SupplierDarkTextField(
                    controller: organizationNameController,
                    label: 'Organization name',
                    hint: 'Legal or public organization name',
                    validator: _required,
                    onChanged: (_) => onFieldChanged(),
                  ),
                  SupplierDarkTextField(
                    controller: contactPersonController,
                    label: 'Contact person',
                    hint: 'Optional contact name',
                    onChanged: (_) => onFieldChanged(),
                  ),
                ],
              ),
              const SupplierFieldGap(),
              _ResponsiveFieldRow(
                children: [
                  SupplierDarkTextField(
                    controller: workingDaysController,
                    label: 'Working days',
                    hint: 'Mon, Tue, Wed',
                    onChanged: (_) => onFieldChanged(),
                  ),
                  SupplierDarkTextField(
                    controller: workingFromController,
                    label: 'Open from',
                    hint: '09:00',
                    onChanged: (_) => onFieldChanged(),
                  ),
                  SupplierDarkTextField(
                    controller: workingToController,
                    label: 'Open until',
                    hint: '17:00',
                    onChanged: (_) => onFieldChanged(),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              SupplierDarkSwitchTile(
                title: 'Use a separate business location',
                subtitle: 'Leave off to use your default pickup location.',
                value: useSeparateBusinessLocation,
                onChanged: onSeparateBusinessLocationChanged,
              ),
              if (useSeparateBusinessLocation) ...[
                const SupplierFieldGap(),
                _ResponsiveFieldRow(
                  children: [
                    SupplierDarkTextField(
                      controller: businessCountryController,
                      label: 'Business country',
                      validator: _required,
                      onChanged: (_) => onFieldChanged(),
                    ),
                    SupplierDarkTextField(
                      controller: businessCityController,
                      label: 'Business city',
                      validator: _required,
                      onChanged: (_) => onFieldChanged(),
                    ),
                  ],
                ),
                const SupplierFieldGap(),
                _ResponsiveFieldRow(
                  children: [
                    SupplierDarkTextField(
                      controller: businessAreaController,
                      label: 'Business area',
                      onChanged: (_) => onFieldChanged(),
                    ),
                    SupplierDarkTextField(
                      controller: businessAddressLineController,
                      label: 'Business address line',
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

  static String? _required(String? value) {
    return value == null || value.trim().isEmpty ? 'Required' : null;
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
    final saveButton = FilledButton.icon(
      onPressed: isSaving ? null : onSave,
      icon: isSaving
          ? const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Icon(Icons.save_outlined, size: 18),
      label: Text(isSaving ? 'Saving...' : 'Save Profile'),
      style: FilledButton.styleFrom(
        backgroundColor: AuthDarkColors.accent,
        foregroundColor: AuthDarkColors.textOnAccent,
        disabledBackgroundColor: AuthDarkColors.accentSoft,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
      ),
    );

    final cancelButton = onCancel == null
        ? null
        : OutlinedButton(
            onPressed: isSaving ? null : onCancel,
            style: OutlinedButton.styleFrom(
              foregroundColor: AuthDarkColors.textPrimary,
              side: BorderSide(
                color: AuthDarkColors.border.withValues(alpha: 0.55),
              ),
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.md,
              ),
              shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
            ),
            child: const Text('Cancel'),
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
      children: [saveButton, if (cancelButton != null) cancelButton],
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
