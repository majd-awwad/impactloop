import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../application/auth_controller.dart';
import '../../application/auth_navigation.dart';
import '../../data/models/become_supplier_request.dart';
import '../models/become_supplier_step.dart';
import '../utils/registration_onboarding_helpers.dart';
import 'auth_buttons.dart';
import 'auth_form_fields.dart';
import 'auth_onboarding_shell.dart';
import 'auth_text_field.dart';
import 'auth_ui_palette.dart';

class BecomeSupplierPage extends StatelessWidget {
  const BecomeSupplierPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const AuthOnboardingShell(
      showSignIn: false,
      showCreateAccount: false,
      child: BecomeSupplierWizard(),
    );
  }
}

class BecomeSupplierWizard extends ConsumerStatefulWidget {
  const BecomeSupplierWizard({super.key});

  @override
  ConsumerState<BecomeSupplierWizard> createState() =>
      _BecomeSupplierWizardState();
}

class _BecomeSupplierWizardState extends ConsumerState<BecomeSupplierWizard> {
  final _formKey = GlobalKey<FormState>();
  final _publicNameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _cityController = TextEditingController();
  final _areaController = TextEditingController();
  final _pickupLocationController = TextEditingController();
  final _workingHoursController = TextEditingController();
  final _pickupNotesController = TextEditingController();

  int _stepIndex = 0;
  String? _supplierType;
  bool _isSubmitting = false;
  String? _supplierTypeError;
  String? _publicNameError;
  String? _cityError;
  String? _formError;

  BecomeSupplierStep get _currentStep => becomeSupplierSteps[_stepIndex];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_publicNameController.text.isNotEmpty) {
      return;
    }

    final user = ref.read(authControllerProvider).user;
    if (user != null && user.displayName.trim().isNotEmpty) {
      _publicNameController.text = user.displayName.trim();
    }
  }

  @override
  void dispose() {
    _publicNameController.dispose();
    _descriptionController.dispose();
    _cityController.dispose();
    _areaController.dispose();
    _pickupLocationController.dispose();
    _workingHoursController.dispose();
    _pickupNotesController.dispose();
    super.dispose();
  }

  void _clearErrors() {
    setState(() {
      _supplierTypeError = null;
      _publicNameError = null;
      _cityError = null;
      _formError = null;
    });
  }

  void _applyServerError(ApiException error) {
    setState(() {
      _supplierTypeError = firstFieldError(error, const ['supplierType']);
      _publicNameError = firstFieldError(error, const ['publicName']);
      _cityError = firstFieldError(error, const ['pickupArea']);
      _formError = null;

      if (_supplierTypeError == null &&
          _publicNameError == null &&
          _cityError == null) {
        _formError = error.displayMessage;
      }
    });
  }

  String get _pickupArea {
    return formatPickupArea(
      city: _cityController.text,
      area: _areaController.text,
    );
  }

  bool _validateCurrentStep() {
    switch (_currentStep) {
      case BecomeSupplierStep.supplierType:
        if (_supplierType == null || _supplierType!.isEmpty) {
          setState(() {
            _supplierTypeError = 'Supplier type is required';
          });
          return false;
        }
        return true;
      case BecomeSupplierStep.profile:
        if (_publicNameController.text.trim().isEmpty) {
          setState(() {
            _publicNameError = 'Supplier name is required';
          });
          return false;
        }
        return true;
      case BecomeSupplierStep.location:
        if (_cityController.text.trim().isEmpty) {
          setState(() {
            _cityError = 'City is required';
          });
          return false;
        }
        return true;
      case BecomeSupplierStep.pickupDetails:
      case BecomeSupplierStep.review:
        return true;
    }
  }

  void _goBack() {
    if (_stepIndex == 0) {
      context.go(homeRoute);
      return;
    }

    setState(() {
      _stepIndex -= 1;
      _clearErrors();
    });
  }

  Future<void> _goNext() async {
    _clearErrors();

    if (_currentStep != BecomeSupplierStep.review) {
      if (!_validateCurrentStep()) {
        return;
      }

      setState(() => _stepIndex += 1);
      return;
    }

    setState(() => _isSubmitting = true);

    final pickupNotes = [
      if (_pickupLocationController.text.trim().isNotEmpty)
        'Pickup location: ${_pickupLocationController.text.trim()}',
      if (_pickupNotesController.text.trim().isNotEmpty)
        _pickupNotesController.text.trim(),
    ].join('\n');

    try {
      await ref.read(authControllerProvider.notifier).becomeSupplier(
            BecomeSupplierRequest(
              supplierType: _supplierType!,
              publicName: _publicNameController.text.trim(),
              description: _descriptionController.text.trim().isEmpty
                  ? null
                  : _descriptionController.text.trim(),
              pickupArea: _pickupArea,
              workingHours: _workingHoursController.text.trim().isEmpty
                  ? null
                  : _workingHoursController.text.trim(),
              pickupNotes: pickupNotes.trim().isEmpty ? null : pickupNotes,
            ),
          );

      if (!mounted) {
        return;
      }

      final user = ref.read(authControllerProvider).user;
      context.go(
        user == null ? supplierOverviewRoute : postAuthRouteForUser(user),
      );
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() => _isSubmitting = false);
      _applyServerError(error);
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _formError = 'Something went wrong. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Become a supplier',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Keep your learner access and add a personal supplier profile on the same account.',
            style: TextStyle(
              fontSize: 14,
              height: 1.5,
              color: colors.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          _BecomeSupplierStepProgress(
            steps: becomeSupplierSteps,
            currentIndex: _stepIndex,
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            _currentStep.title,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            _currentStep.subtitle,
            style: TextStyle(
              fontSize: 13,
              height: 1.5,
              color: colors.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          _buildStepContent(context),
          if (_formError != null) ...[
            const SizedBox(height: AppSpacing.md),
            AppInlineError(message: _formError!),
          ],
          const SizedBox(height: AppSpacing.lg),
          AuthPrimaryButton(
            label: _currentStep == BecomeSupplierStep.review
                ? 'Open Supplier Portal'
                : 'Continue',
            isLoading: _isSubmitting,
            onPressed: _goNext,
          ),
          const SizedBox(height: AppSpacing.sm),
          AuthOutlinedButton(label: 'Back', onPressed: _goBack),
        ],
      ),
    );
  }

  Widget _buildStepContent(BuildContext context) {
    switch (_currentStep) {
      case BecomeSupplierStep.supplierType:
        return _buildSupplierTypeStep(context);
      case BecomeSupplierStep.profile:
        return _buildProfileStep(context);
      case BecomeSupplierStep.location:
        return _buildLocationStep(context);
      case BecomeSupplierStep.pickupDetails:
        return _buildPickupDetailsStep(context);
      case BecomeSupplierStep.review:
        return _buildReviewStep(context);
    }
  }

  Widget _buildSupplierTypeStep(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const AuthSectionTitle(title: 'Personal supplier type'),
        const SizedBox(height: AppSpacing.sm),
        for (final type in registrationPersonalSupplierTypes) ...[
          AuthSelectCard(
            label: type,
            description: supplierTypeDescription(type),
            isSelected: _supplierType == type,
            onTap: () {
              _clearErrors();
              setState(() => _supplierType = type);
            },
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (_supplierTypeError != null)
          AppInlineError(message: _supplierTypeError!),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Student and individual suppliers can switch back to learner mode anytime. Organization supplier accounts are set up separately.',
          style: TextStyle(
            fontSize: 13,
            height: 1.45,
            color: AuthUiPalette.of(context).textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildProfileStep(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthTextField(
          controller: _publicNameController,
          label: 'Supplier name',
          hint: 'How others will see you',
          textInputAction: TextInputAction.next,
          errorText: _publicNameError,
          onChanged: (_) => _clearErrors(),
        ),
        const AuthFieldGap(),
        AuthTextArea(
          controller: _descriptionController,
          label: 'About / description (optional)',
          hint: 'What kinds of materials do you usually share?',
          minLines: 2,
          maxLines: 4,
          onChanged: (_) => _clearErrors(),
        ),
      ],
    );
  }

  Widget _buildLocationStep(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'City and area help learners understand where pickup usually happens. Exact pickup details can stay private until a reservation is accepted.',
          style: TextStyle(
            fontSize: 13,
            height: 1.45,
            color: colors.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        AuthTextField(
          controller: _cityController,
          label: 'City',
          hint: 'Nablus',
          textInputAction: TextInputAction.next,
          errorText: _cityError,
          onChanged: (_) => _clearErrors(),
        ),
        const AuthFieldGap(),
        AuthTextField(
          controller: _areaController,
          label: 'Area',
          hint: 'Rafidia',
          textInputAction: TextInputAction.next,
          onChanged: (_) => _clearErrors(),
        ),
        const AuthFieldGap(),
        AuthTextField(
          controller: _pickupLocationController,
          label: 'Pickup location note (optional)',
          hint: 'Near university gate, workshop entrance, etc.',
          textInputAction: TextInputAction.done,
          onChanged: (_) => _clearErrors(),
        ),
      ],
    );
  }

  Widget _buildPickupDetailsStep(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthTextField(
          controller: _workingHoursController,
          label: 'Working hours (optional)',
          hint: 'Mon-Fri 4pm-7pm',
          textInputAction: TextInputAction.next,
          onChanged: (_) => _clearErrors(),
        ),
        const AuthFieldGap(),
        AuthTextArea(
          controller: _pickupNotesController,
          label: 'Pickup notes (optional)',
          hint: 'Call before pickup, bring student ID, etc.',
          minLines: 2,
          maxLines: 4,
          onChanged: (_) => _clearErrors(),
        ),
      ],
    );
  }

  Widget _buildReviewStep(BuildContext context) {
    final notes = [
      if (_pickupLocationController.text.trim().isNotEmpty)
        'Pickup location: ${_pickupLocationController.text.trim()}',
      if (_workingHoursController.text.trim().isNotEmpty)
        'Working hours: ${_workingHoursController.text.trim()}',
      if (_pickupNotesController.text.trim().isNotEmpty)
        'Pickup notes: ${_pickupNotesController.text.trim()}',
    ].join('\n');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ReviewRow(label: 'Supplier type', value: _supplierType ?? '-'),
        _ReviewRow(
          label: 'Supplier name',
          value: _publicNameController.text.trim(),
        ),
        _ReviewRow(
          label: 'About',
          value: _descriptionController.text.trim().isEmpty
              ? '-'
              : _descriptionController.text.trim(),
        ),
        _ReviewRow(label: 'Pickup area', value: _pickupArea),
        if (notes.isNotEmpty) _ReviewRow(label: 'Pickup details', value: notes),
      ],
    );
  }
}

class _BecomeSupplierStepProgress extends StatelessWidget {
  const _BecomeSupplierStepProgress({
    required this.steps,
    required this.currentIndex,
  });

  final List<BecomeSupplierStep> steps;
  final int currentIndex;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Semantics(
      label:
          'Become supplier progress, step ${currentIndex + 1} of '
          '${steps.length}',
      child: Row(
        children: [
          for (var index = 0; index < steps.length; index++) ...[
            Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                height: 6,
                decoration: BoxDecoration(
                  color: index <= currentIndex
                      ? colors.primary
                      : colors.surfaceElevated,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: index <= currentIndex
                        ? colors.primary
                        : colors.border,
                  ),
                ),
              ),
            ),
            if (index != steps.length - 1) const SizedBox(width: AppSpacing.xs),
          ],
        ],
      ),
    );
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: colors.textMuted,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13,
                height: 1.45,
                color: colors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
