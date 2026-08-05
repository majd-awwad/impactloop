import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/l10n/driver_profile_ui_labels.dart';
import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../application/driver_profile_provider.dart';
import '../../data/models/driver_operational_profile.dart';
import '../widgets/driver_availability_summary_card.dart';
import '../widgets/driver_page_header.dart';

class DriverProfilePage extends ConsumerStatefulWidget {
  const DriverProfilePage({super.key});

  @override
  ConsumerState<DriverProfilePage> createState() => _DriverProfilePageState();
}

class _DriverProfilePageState extends ConsumerState<DriverProfilePage> {
  final _formKey = GlobalKey<FormState>();
  final _cityController = TextEditingController();
  final _areaController = TextEditingController();
  final _vehicleLabelController = TextEditingController();
  final _vehiclePlateController = TextEditingController();
  final _capacityNotesController = TextEditingController();

  DriverTransportationType _transportationType =
      DriverTransportationType.unknown;
  DateTime? _boundUpdatedAt;
  bool _hasBoundProfile = false;
  bool _suppressDirty = false;
  bool _isDirty = false;
  Map<String, String> _fieldErrors = const {};

  @override
  void initState() {
    super.initState();
    for (final controller in [
      _cityController,
      _areaController,
      _vehicleLabelController,
      _vehiclePlateController,
      _capacityNotesController,
    ]) {
      controller.addListener(_markDirty);
    }
  }

  @override
  void dispose() {
    _cityController.dispose();
    _areaController.dispose();
    _vehicleLabelController.dispose();
    _vehiclePlateController.dispose();
    _capacityNotesController.dispose();
    super.dispose();
  }

  void _markDirty() {
    if (_suppressDirty || _isDirty || !mounted) return;
    setState(() => _isDirty = true);
  }

  void _bindProfile(DriverOperationalProfile profile) {
    if (_hasBoundProfile &&
        (_isDirty || _boundUpdatedAt == profile.updatedAt)) {
      return;
    }
    _suppressDirty = true;
    _cityController.text = profile.city ?? '';
    _areaController.text = profile.area ?? '';
    _vehicleLabelController.text = profile.vehicleLabel ?? '';
    _vehiclePlateController.text = profile.vehiclePlate ?? '';
    _capacityNotesController.text = profile.capacityNotes ?? '';
    _transportationType = profile.transportationType;
    _boundUpdatedAt = profile.updatedAt;
    _hasBoundProfile = true;
    _isDirty = false;
    _suppressDirty = false;
  }

  Future<void> _changePreference(bool value) async {
    if (!await confirmDriverAvailabilityPreference(context, value) ||
        !mounted) {
      return;
    }
    final changed = await ref
        .read(driverProfileProvider.notifier)
        .setAcceptingNewJobs(value);
    if (!mounted || changed) return;
    final error = ref.read(driverProfileProvider).value?.availabilityError;
    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(localizedApiErrorMessage(error, context.l10n))),
      );
    }
  }

  Future<void> _save() async {
    setState(() => _fieldErrors = const {});
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final saved = await ref
        .read(driverProfileProvider.notifier)
        .saveProfile(
          UpdateDriverOperationalProfileRequest(
            city: _cityController.text,
            area: _areaController.text,
            transportationType: _transportationType,
            vehicleLabel: _vehicleLabelController.text,
            vehiclePlate: _vehiclePlateController.text,
            capacityNotes: _capacityNotesController.text,
          ),
        );
    if (!mounted) return;

    final state = ref.read(driverProfileProvider).value;
    if (saved && state != null) {
      _suppressDirty = true;
      _isDirty = false;
      _boundUpdatedAt = state.profile.updatedAt;
      _suppressDirty = false;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(context.l10n.driverProfileSaved)));
      setState(() {});
      return;
    }

    final error = state?.saveError;
    if (error != null) {
      setState(() => _fieldErrors = _localizedFieldErrors(error));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(localizedApiErrorMessage(error, context.l10n))),
      );
    }
  }

  Map<String, String> _localizedFieldErrors(ApiException error) {
    final l10n = context.l10n;
    return {
      for (final issue in error.fieldIssues)
        issue.path: switch (issue.path) {
          'city' => l10n.driverCityValidation,
          'area' => l10n.driverAreaValidation,
          'transportationType' => l10n.driverTransportationValidation,
          'vehicleLabel' => l10n.driverVehicleLabelValidation,
          'vehiclePlate' => l10n.driverVehiclePlateValidation,
          'capacityNotes' => l10n.driverCapacityNotesValidation,
          _ => l10n.validationError,
        },
    };
  }

  Future<void> _confirmDiscard() async {
    final discard = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(context.l10n.driverUnsavedChangesTitle),
        content: Text(context.l10n.driverUnsavedChangesBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(context.l10n.driverKeepEditing),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(context.l10n.driverDiscardChanges),
          ),
        ],
      ),
    );
    if (discard == true && mounted) {
      setState(() => _isDirty = false);
      Navigator.of(context).maybePop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(driverProfileProvider);

    return PopScope(
      canPop: !_isDirty,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _isDirty) _confirmDiscard();
      },
      child: RefreshIndicator(
        onRefresh: () => ref.refresh(driverProfileProvider.future),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsetsDirectional.fromSTEB(
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.md,
            _bottomPadding(context),
          ),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1120),
                child: profileAsync.when(
                  loading: () => Padding(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Center(
                      child: Semantics(
                        label: context.l10n.driverLoadingActive,
                        child: const CircularProgressIndicator(),
                      ),
                    ),
                  ),
                  error: (error, _) => AppEmptyStateCard(
                    icon: Icons.person_off_outlined,
                    title: context.l10n.driverProfileLoadError,
                    subtitle: localizedApiErrorMessage(error, context.l10n),
                    actions: [
                      FilledButton.icon(
                        onPressed: () => ref.invalidate(driverProfileProvider),
                        icon: const Icon(Icons.refresh_rounded),
                        label: Text(context.l10n.retry),
                      ),
                    ],
                  ),
                  data: (state) {
                    _bindProfile(state.profile);
                    return _buildContent(state);
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(DriverProfileState state) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final profile = state.profile;
    final editable = profile.isAdministrativelyActive && !state.isMutating;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DriverPageHeader(
          title: l10n.driverProfileTitle,
          subtitle: l10n.driverProfileSubtitle,
          maxWidth: 1120,
        ),
        const SizedBox(height: AppSpacing.lg),

        // Availability section
        DriverAvailabilitySummaryCard(
          profile: profile,
          isMutating: state.isMutating,
          isUpdatingAvailability: state.isUpdatingAvailability,
          onPreferenceChanged: _changePreference,
        ),
        const SizedBox(height: AppSpacing.lg),

        // Operating details section
        _ProfileSection(
          title: l10n.driverOperationalProfileDetails,
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                LayoutBuilder(
                  builder: (context, constraints) {
                    final twoColumns = constraints.maxWidth >= 700;
                    final city = _textField(
                      key: const ValueKey('driver-profile-city'),
                      controller: _cityController,
                      label: l10n.driverProfileCity,
                      error: _fieldErrors['city'],
                      enabled: editable,
                      maxLength: 100,
                      validator: (value) => _requiredLocationValidator(
                        value,
                        l10n.driverCityValidation,
                      ),
                    );
                    final area = _textField(
                      key: const ValueKey('driver-profile-area'),
                      controller: _areaController,
                      label: l10n.driverProfileArea,
                      error: _fieldErrors['area'],
                      enabled: editable,
                      maxLength: 100,
                      validator: (value) => _requiredLocationValidator(
                        value,
                        l10n.driverAreaValidation,
                      ),
                    );
                    if (!twoColumns) {
                      return Column(
                        children: [
                          city,
                          const SizedBox(height: AppSpacing.md),
                          area,
                        ],
                      );
                    }
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: city),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(child: area),
                      ],
                    );
                  },
                ),
                const SizedBox(height: AppSpacing.md),

                // Transportation
                DropdownButtonFormField<DriverTransportationType>(
                  key: const ValueKey('driver-profile-transportation'),
                  isExpanded: true,
                  initialValue:
                      _transportationType == DriverTransportationType.unknown
                      ? null
                      : _transportationType,
                  decoration: InputDecoration(
                    labelText: l10n.driverTransportationType,
                    errorText: _fieldErrors['transportationType'],
                    border: const OutlineInputBorder(),
                  ),
                  hint: Text(
                    _transportationType == DriverTransportationType.unknown
                        ? l10n.driverTransportationUnknown
                        : l10n.driverChooseTransportation,
                  ),
                  items: DriverTransportationType.values
                      .where(
                        (value) => value != DriverTransportationType.unknown,
                      )
                      .map(
                        (value) => DropdownMenuItem(
                          value: value,
                          child: Text(driverTransportationLabel(l10n, value)),
                        ),
                      )
                      .toList(growable: false),
                  onChanged: editable
                      ? (value) {
                          if (value == null) return;
                          setState(() {
                            _transportationType = value;
                            _isDirty = true;
                          });
                        }
                      : null,
                  validator: (value) => value == null
                      ? l10n.driverTransportationValidation
                      : null,
                ),
                const SizedBox(height: AppSpacing.lg),

                // Vehicle section
                Text(
                  l10n.driverVehicleDescription,
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: palette.textMuted),
                ),
                const SizedBox(height: AppSpacing.sm),
                _textField(
                  key: const ValueKey('driver-profile-vehicle-label'),
                  controller: _vehicleLabelController,
                  label: l10n.driverVehicleDescription,
                  hint: l10n.driverOptionalField,
                  error: _fieldErrors['vehicleLabel'],
                  enabled: editable,
                  maxLength: 120,
                ),
                const SizedBox(height: AppSpacing.md),
                _textField(
                  key: const ValueKey('driver-profile-vehicle-plate'),
                  controller: _vehiclePlateController,
                  label: l10n.driverVehiclePlate,
                  hint: l10n.driverOptionalField,
                  error: _fieldErrors['vehiclePlate'],
                  enabled: editable,
                  maxLength: 32,
                  textDirection: TextDirection.ltr,
                  textAlign: TextAlign.left,
                ),
                const SizedBox(height: AppSpacing.lg),

                // Capacity section
                Text(
                  l10n.driverCapacityNotes,
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: palette.textMuted),
                ),
                const SizedBox(height: AppSpacing.sm),
                _textField(
                  key: const ValueKey('driver-profile-capacity-notes'),
                  controller: _capacityNotesController,
                  label: l10n.driverCapacityNotes,
                  hint: l10n.driverCapacityNotesHint,
                  error: _fieldErrors['capacityNotes'],
                  enabled: editable,
                  maxLength: 500,
                  maxLines: 4,
                ),
                const SizedBox(height: AppSpacing.lg),

                // Save button
                FilledButton.icon(
                  key: const ValueKey('driver-profile-save'),
                  onPressed: editable && _isDirty ? _save : null,
                  icon: state.isSaving
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.save_outlined),
                  label: Text(
                    state.isSaving
                        ? l10n.driverSavingProfile
                        : l10n.driverSaveProfile,
                  ),
                  style: _isDirty && editable
                      ? AppStatusButtonStyle.filled(
                          context,
                          AppStatusTone.primary,
                        )
                      : null,
                ),
                if (!editable && !state.isMutating) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    driverProfileStatusExplanation(l10n, profile.status),
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textMuted, fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),

        // Account settings card
        _AccountSettingsCard(
          onOpen: () => context.push(accountSettingsRoute),
        ),
      ],
    );
  }

  Widget _textField({
    required Key key,
    required TextEditingController controller,
    required String label,
    required int maxLength,
    required bool enabled,
    String? hint,
    String? error,
    int maxLines = 1,
    TextDirection? textDirection,
    TextAlign textAlign = TextAlign.start,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      key: key,
      controller: controller,
      enabled: enabled,
      maxLength: maxLength,
      maxLines: maxLines,
      textDirection: textDirection,
      textAlign: textAlign,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        errorText: error,
        border: const OutlineInputBorder(),
      ),
      validator: validator,
    );
  }

  String? _requiredLocationValidator(String? value, String message) {
    final length = value?.trim().length ?? 0;
    return length < 2 || length > 100 ? message : null;
  }
}

class _ProfileSection extends StatelessWidget {
  const _ProfileSection({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: AppTextStyles.title(context)),
          const SizedBox(height: AppSpacing.lg),
          child,
        ],
      ),
    );
  }
}

class _AccountSettingsCard extends StatelessWidget {
  const _AccountSettingsCard({required this.onOpen});

  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Wrap(
        spacing: AppSpacing.md,
        runSpacing: AppSpacing.md,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          const Icon(Icons.manage_accounts_outlined),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 680),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.driverAccountSettingsTitle,
                  style: AppTextStyles.label(context),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  l10n.driverAccountSettingsExplanation,
                  style: AppTextStyles.body(context),
                ),
              ],
            ),
          ),
          OutlinedButton.icon(
            key: const ValueKey('driver-account-settings-link'),
            onPressed: onOpen,
            icon: const Icon(Icons.open_in_new_rounded),
            label: Text(l10n.driverOpenAccountSettings),
          ),
        ],
      ),
    );
  }
}

double _bottomPadding(BuildContext context) =>
    MediaQuery.sizeOf(context).width < 820
    ? kBottomNavigationBarHeight +
          MediaQuery.paddingOf(context).bottom +
          AppSpacing.lg
    : AppSpacing.xl;
