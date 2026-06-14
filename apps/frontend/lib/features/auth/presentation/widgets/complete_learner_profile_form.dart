import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_dropdown_field.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_text_area.dart';
import '../../../../shared/widgets/app_text_field.dart';

class CompleteLearnerProfileForm extends StatefulWidget {
  const CompleteLearnerProfileForm({
    super.key,
    this.showSupplierNextHint = false,
  });

  final bool showSupplierNextHint;

  @override
  State<CompleteLearnerProfileForm> createState() =>
      _CompleteLearnerProfileFormState();
}

class _CompleteLearnerProfileFormState extends State<CompleteLearnerProfileForm> {
  final _formKey = GlobalKey<FormState>();
  final _interestsController = TextEditingController();
  final _bioController = TextEditingController();
  String? _learnerType;
  String? _skillLevel;
  bool _isSubmitting = false;

  static const _learnerTypes = [
    'University student',
    'School student',
    'Self learner',
    'Maker / hobbyist',
  ];

  static const _skillLevels = [
    'Beginner',
    'Intermediate',
    'Advanced',
    'Expert',
  ];

  @override
  void dispose() {
    _interestsController.dispose();
    _bioController.dispose();
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
          'Learner profile placeholder: $_learnerType, $_skillLevel'
          '${widget.showSupplierNextHint ? ' (BOTH flow — supplier profile next)' : ''}',
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
          if (widget.showSupplierNextHint) ...[
            Text(
              'Next, we’ll help you set up your supplier profile too.',
              style: AppTextStyles.subtitle(context),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          AppDropdownField<String>(
            label: 'Learner type',
            hint: 'Select your learner type',
            value: _learnerType,
            items: [
              for (final type in _learnerTypes)
                DropdownMenuItem(value: type, child: Text(type)),
            ],
            onChanged: (value) => setState(() => _learnerType = value),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Learner type is required';
              }
              return null;
            },
          ),
          const AppFieldGap(),
          AppDropdownField<String>(
            label: 'Skill level',
            hint: 'Select your skill level',
            value: _skillLevel,
            items: [
              for (final level in _skillLevels)
                DropdownMenuItem(value: level, child: Text(level)),
            ],
            onChanged: (value) => setState(() => _skillLevel = value),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Skill level is required';
              }
              return null;
            },
          ),
          const AppFieldGap(),
          AppTextField(
            controller: _interestsController,
            label: 'Interests (optional)',
            hint: 'Arduino, robotics, electronics',
            textInputAction: TextInputAction.next,
          ),
          const AppFieldGap(),
          AppTextArea(
            controller: _bioController,
            label: 'Bio (optional)',
            hint: 'Tell others a little about your learning goals',
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _handleSubmit(),
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
