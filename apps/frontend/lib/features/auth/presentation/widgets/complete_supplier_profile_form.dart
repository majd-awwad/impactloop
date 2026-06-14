import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_dropdown_field.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_text_field.dart';

class CompleteSupplierProfileForm extends StatefulWidget {
  const CompleteSupplierProfileForm({super.key});

  @override
  State<CompleteSupplierProfileForm> createState() =>
      _CompleteSupplierProfileFormState();
}

class _CompleteSupplierProfileFormState
    extends State<CompleteSupplierProfileForm> {
  final _formKey = GlobalKey<FormState>();
  final _publicNameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _pickupAreaController = TextEditingController();
  String? _supplierType;
  bool _isSubmitting = false;

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

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);

    // Placeholder only — API integration will replace this in a later step.
    await Future<void>.delayed(const Duration(milliseconds: 600));

    if (!mounted) {
      return;
    }

    setState(() => _isSubmitting = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Supplier profile placeholder: $_supplierType, '
          '${_publicNameController.text.trim()}',
        ),
      ),
    );
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
            items: [
              for (final type in _supplierTypes)
                DropdownMenuItem(value: type, child: Text(type)),
            ],
            onChanged: (value) => setState(() => _supplierType = value),
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
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Public name is required';
              }
              return null;
            },
          ),
          const AppFieldGap(),
          AppTextField(
            controller: _descriptionController,
            label: 'Short description (optional)',
            hint: 'What kinds of materials do you usually share?',
            textInputAction: TextInputAction.next,
            minLines: 2,
            maxLines: 3,
          ),
          const AppFieldGap(),
          AppTextField(
            controller: _pickupAreaController,
            label: 'Pickup area / location',
            hint: 'City, campus area, or neighborhood',
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _handleSubmit(),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Pickup area is required';
              }
              return null;
            },
          ),
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
