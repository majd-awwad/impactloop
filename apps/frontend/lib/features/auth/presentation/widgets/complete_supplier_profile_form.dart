import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_dropdown_field.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_text_area.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../application/auth_controller.dart';
import '../../application/registration_draft_notifier.dart';
import '../../data/models/registration_draft.dart';

class CompleteSupplierProfileForm extends ConsumerStatefulWidget {
  const CompleteSupplierProfileForm({super.key});

  @override
  ConsumerState<CompleteSupplierProfileForm> createState() =>
      _CompleteSupplierProfileFormState();
}

class _CompleteSupplierProfileFormState
    extends ConsumerState<CompleteSupplierProfileForm> {
  final _formKey = GlobalKey<FormState>();
  final _publicNameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _pickupAreaController = TextEditingController();
  String? _supplierType;
  bool _isSubmitting = false;
  String? _supplierTypeError;
  String? _publicNameError;
  String? _descriptionError;
  String? _pickupAreaError;
  String? _formError;

  static const _supplierTypes = [
    'Student supplier',
    'Individual supplier',
    'Workshop',
    'Factory',
    'Educational institution',
  ];

  @override
  void dispose() {
    _publicNameController.dispose();
    _descriptionController.dispose();
    _pickupAreaController.dispose();
    super.dispose();
  }

  void _clearErrors() {
    setState(() {
      _supplierTypeError = null;
      _publicNameError = null;
      _descriptionError = null;
      _pickupAreaError = null;
      _formError = null;
    });
  }

  void _applyServerError(ApiException error) {
    setState(() {
      _supplierTypeError = firstFieldError(error, const ['supplierProfile.supplierType']);
      _publicNameError = firstFieldError(error, const ['supplierProfile.publicName']);
      _descriptionError = firstFieldError(error, const ['supplierProfile.description']);
      _pickupAreaError = firstFieldError(error, const ['supplierProfile.pickupArea']);
      _formError = null;

      if (_supplierTypeError == null &&
          _publicNameError == null &&
          _descriptionError == null &&
          _pickupAreaError == null) {
        _formError = error.displayMessage;
      }
    });
  }

  Future<void> _handleSubmit() async {
    _clearErrors();

    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);

    final draftNotifier = ref.read(registrationDraftProvider.notifier);

    draftNotifier.setSupplierProfile(
      SupplierProfileDraft(
        supplierType: _supplierType!,
        publicName: _publicNameController.text.trim(),
        description: _descriptionController.text.trim().isEmpty
            ? null
            : _descriptionController.text.trim(),
        pickupArea: _pickupAreaController.text.trim(),
      ),
    );

    final request = draftNotifier.toRegisterRequest();

    if (request == null) {
      if (!mounted) {
        return;
      }

      setState(() => _isSubmitting = false);
      setState(() {
        _formError = 'Registration details are incomplete. Please start again.';
      });
      context.go('/register');
      return;
    }

    try {
      await ref.read(authControllerProvider.notifier).register(request);
      ref.read(registrationDraftProvider.notifier).clear();

      if (!mounted) {
        return;
      }

      context.go('/home');
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

      setState(() => _isSubmitting = false);
      setState(() {
        _formError = 'Something went wrong. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppDropdownField<String>(
            label: 'Supplier type',
            hint: 'Select your supplier type',
            value: _supplierType,
            errorText: _supplierTypeError,
            items: [
              for (final type in _supplierTypes)
                DropdownMenuItem(value: type, child: Text(type)),
            ],
            onChanged: (value) {
              if (_supplierTypeError != null || _formError != null) {
                _clearErrors();
              }
              setState(() => _supplierType = value);
            },
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Supplier type is required';
              }
              return null;
            },
          ),
          const AppFieldGap(),
          AppTextField(
            controller: _publicNameController,
            label: 'Public name',
            hint: 'How others will see you',
            textInputAction: TextInputAction.next,
            errorText: _publicNameError,
            onChanged: (_) {
              if (_publicNameError != null || _formError != null) {
                _clearErrors();
              }
            },
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Public name is required';
              }
              return null;
            },
          ),
          const AppFieldGap(),
          AppTextArea(
            controller: _descriptionController,
            label: 'Short description (optional)',
            hint: 'What kinds of materials do you usually share?',
            textInputAction: TextInputAction.next,
            minLines: 2,
            maxLines: 4,
            errorText: _descriptionError,
            onChanged: (_) {
              if (_descriptionError != null || _formError != null) {
                _clearErrors();
              }
            },
          ),
          const AppFieldGap(),
          AppTextField(
            controller: _pickupAreaController,
            label: 'Pickup area / location',
            hint: 'Nablus, Rafidia',
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _handleSubmit(),
            errorText: _pickupAreaError,
            onChanged: (_) {
              if (_pickupAreaError != null || _formError != null) {
                _clearErrors();
              }
            },
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Pickup area is required';
              }
              return null;
            },
          ),
          if (_formError != null) ...[
            const SizedBox(height: AppSpacing.sm),
            AppInlineError(message: _formError!),
          ],
          const SizedBox(height: AppSpacing.md),
          Text(
            'You can start as an individual and update your supplier details later.',
            style: AppTextStyles.subtitle(context),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.lg),
          AppPrimaryButton(
            label: 'Continue',
            isLoading: _isSubmitting,
            onPressed: _handleSubmit,
          ),
        ],
      ),
    );
  }
}
