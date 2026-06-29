import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_dropdown_field.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_text_area.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/data/models/registration_draft.dart';
import '../../../auth/data/models/user.dart';
import '../../application/profile_providers.dart';
import '../../data/models/learner_profile_options.dart';
import '../widgets/profile_image_picker.dart';

class LearnerProfileEditPage extends ConsumerStatefulWidget {
  const LearnerProfileEditPage({super.key});

  @override
  ConsumerState<LearnerProfileEditPage> createState() =>
      _LearnerProfileEditPageState();
}

class _LearnerProfileEditPageState extends ConsumerState<LearnerProfileEditPage> {
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

  @override
  void initState() {
    super.initState();
    _applyUser(ref.read(authControllerProvider).user);
  }

  void _applyUser(User? user) {
    final profile = user?.learnerProfile;
    _learnerType = _nullableValue(profile?.learnerType);
    _skillLevel = _nullableValue(profile?.skillLevel);
    _interestsController.text = profile?.interests.join(', ') ?? '';
    _bioController.text = profile?.bio?.trim() ?? '';
  }

  String? _nullableValue(String? value) {
    final trimmed = value?.trim() ?? '';
    return trimmed.isEmpty ? null : trimmed;
  }

  @override
  void dispose() {
    _interestsController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_isSubmitting) {
      return;
    }

    setState(() {
      _learnerTypeError = null;
      _skillLevelError = null;
      _interestsError = null;
      _bioError = null;
      _formError = null;
    });

    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final bio = _bioController.text.trim();
      final user = await ref.read(profileRepositoryProvider).updateLearnerProfile(
            learnerType: _learnerType!,
            skillLevel: _skillLevel!,
            interests: parseInterestsInput(_interestsController.text),
            bio: bio.isEmpty ? null : bio,
          );

      ref.read(authControllerProvider.notifier).syncAuthenticatedUser(user);

      if (!mounted) {
        return;
      }

      showInfoSnackBar(context, 'Learner profile updated.');
      context.go('/profile');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _learnerTypeError = firstFieldError(error, const ['learnerType']);
        _skillLevelError = firstFieldError(error, const ['skillLevel']);
        _interestsError = firstFieldError(error, const ['interests']);
        _bioError = firstFieldError(error, const ['bio']);
        _formError = _learnerTypeError == null &&
                _skillLevelError == null &&
                _interestsError == null &&
                _bioError == null
            ? error.displayMessage
            : null;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _formError = 'Could not update your learner profile. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final isLearner = user?.hasRole('LEARNER') == true;

    if (!isLearner) {
      return ProfileSubpageScaffold(
        title: 'Edit learner profile',
        child: ProfileEditCard(
          child: Text(
            'Learner profile editing is available for learner accounts.',
          ),
        ),
      );
    }

    return ProfileSubpageScaffold(
      title: 'Edit learner profile',
      child: ProfileEditCard(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AppDropdownField<String>(
                label: 'Learner type',
                hint: 'Select your learner type',
                value: _learnerType,
                errorText: _learnerTypeError,
                items: [
                  for (final type in LearnerProfileOptions.learnerTypes)
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
                errorText: _skillLevelError,
                items: [
                  for (final level in LearnerProfileOptions.skillLevels)
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
                label: 'Interests',
                hint: 'Arduino, robotics, electronics',
                textInputAction: TextInputAction.next,
                errorText: _interestsError,
              ),
              const AppFieldGap(),
              AppTextArea(
                controller: _bioController,
                label: 'Bio',
                hint: 'Tell others a little about your learning goals',
                textInputAction: TextInputAction.done,
                errorText: _bioError,
                onFieldSubmitted: (_) => _submit(),
              ),
              if (_formError != null) ...[
                const SizedBox(height: AppSpacing.md),
                AppInlineError(message: _formError!),
              ],
              const SizedBox(height: AppSpacing.lg),
              AppPrimaryButton(
                label: _isSubmitting ? 'Saving...' : 'Save changes',
                onPressed: _isSubmitting ? null : _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
