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
import '../../application/auth_navigation.dart';
import '../../application/registration_draft_notifier.dart';
import '../../data/models/registration_draft.dart';
import '../models/registration_intent.dart';

class CompleteLearnerProfileForm extends ConsumerStatefulWidget {
  const CompleteLearnerProfileForm({
    super.key,
    this.showSupplierNextHint = false,
  });

  final bool showSupplierNextHint;

  @override
  ConsumerState<CompleteLearnerProfileForm> createState() =>
      _CompleteLearnerProfileFormState();
}

class _CompleteLearnerProfileFormState
    extends ConsumerState<CompleteLearnerProfileForm> {
  final _formKey = GlobalKey<FormState>();
  final _interestsController = TextEditingController();
  final _bioController = TextEditingController();
  String? _learnerType;
  String? _skillLevel;
  bool _isSubmitting = false;
  String? _learnerTypeError;
  String? _skillLevelError;
  String? _interestsError;
  String? _bioError;
  String? _formError;

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

  void _clearErrors() {
    setState(() {
      _learnerTypeError = null;
      _skillLevelError = null;
      _interestsError = null;
      _bioError = null;
      _formError = null;
    });
  }

  void _applyServerError(ApiException error) {
    setState(() {
      _learnerTypeError = firstFieldError(error, const [
        'learnerProfile.learnerType',
      ]);
      _skillLevelError = firstFieldError(error, const [
        'learnerProfile.skillLevel',
      ]);
      _interestsError = firstFieldError(error, const [
        'learnerProfile.interests',
      ]);
      _bioError = firstFieldError(error, const ['learnerProfile.bio']);
      _formError = null;

      if (_learnerTypeError == null &&
          _skillLevelError == null &&
          _interestsError == null &&
          _bioError == null) {
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

    final intent = ref.read(registrationDraftProvider).intent;
    final draftNotifier = ref.read(registrationDraftProvider.notifier);

    draftNotifier.setLearnerProfile(
      LearnerProfileDraft(
        learnerType: _learnerType!,
        skillLevel: _skillLevel!,
        interests: parseInterestsInput(_interestsController.text),
        bio: _bioController.text.trim().isEmpty
            ? null
            : _bioController.text.trim(),
      ),
    );

    if (intent == RegistrationIntent.both) {
      if (!mounted) {
        return;
      }

      setState(() => _isSubmitting = false);
      context.go('/complete-supplier-profile?intent=both');
      return;
    }

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
      final user = await ref.read(authControllerProvider.notifier).register(
        request,
      );
      ref.read(registrationDraftProvider.notifier).clear();

      if (!mounted) {
        return;
      }

      context.go(postAuthRouteForUser(user));
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
            errorText: _learnerTypeError,
            items: [
              for (final type in _learnerTypes)
                DropdownMenuItem(value: type, child: Text(type)),
            ],
            onChanged: (value) {
              if (_learnerTypeError != null || _formError != null) {
                _clearErrors();
              }
              setState(() => _learnerType = value);
            },
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
            errorText: _skillLevelError,
            items: [
              for (final level in _skillLevels)
                DropdownMenuItem(value: level, child: Text(level)),
            ],
            onChanged: (value) {
              if (_skillLevelError != null || _formError != null) {
                _clearErrors();
              }
              setState(() => _skillLevel = value);
            },
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
            errorText: _interestsError,
            onChanged: (_) {
              if (_interestsError != null || _formError != null) {
                _clearErrors();
              }
            },
          ),
          const AppFieldGap(),
          AppTextArea(
            controller: _bioController,
            label: 'Bio (optional)',
            hint: 'Tell others a little about your learning goals',
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _handleSubmit(),
            errorText: _bioError,
            onChanged: (_) {
              if (_bioError != null || _formError != null) {
                _clearErrors();
              }
            },
          ),
          if (_formError != null) ...[
            const SizedBox(height: AppSpacing.sm),
            AppInlineError(message: _formError!),
          ],
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
