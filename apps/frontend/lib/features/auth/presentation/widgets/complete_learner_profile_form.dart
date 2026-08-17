import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_dropdown_field.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_text_area.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../profile/application/profile_providers.dart';
import '../../../profile/data/models/learner_interest_options.dart';
import '../../../profile/presentation/l10n/learner_profile_l10n.dart';
import '../../../profile/presentation/widgets/learner_interest_chip_picker.dart';
import '../../application/auth_controller.dart';
import '../../application/auth_navigation.dart';
import '../../application/registration_draft_notifier.dart';
import '../../data/models/registration_draft.dart';
import '../utils/registration_option_l10n.dart';
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
  final _customInterestController = TextEditingController();
  final _bioController = TextEditingController();
  String? _learnerType;
  String? _skillLevel;
  Set<String> _selectedInterestKeys = {};
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
    _customInterestController.dispose();
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
        _formError = localizedApiErrorMessage(error, context.l10n);
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
        interests: mergeInterestSelection(
          selectedKeys: _selectedInterestKeys,
          customInterestText: _customInterestController.text,
        ),
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
        _formError = context.l10n.registrationDetailsIncomplete;
      });
      context.go('/register');
      return;
    }

    try {
      final user = await ref
          .read(authControllerProvider.notifier)
          .register(request);
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
        _formError = context.l10n.somethingWentWrong;
      });
    }
  }

  Widget _interestPicker(LearnerInterestOptionsResponse options) {
    final l10n = context.l10n;
    final profileL10n = LearnerProfileL10n.of(context);
    return LearnerInterestChipPicker(
      options: options,
      selectedKeys: _selectedInterestKeys,
      onChanged: (value) {
        if (_interestsError != null || _formError != null) {
          _clearErrors();
        }
        setState(() => _selectedInterestKeys = value);
      },
      customInterestController: _customInterestController,
      label: l10n.registerInterestsOptionalLabel,
      errorText: _interestsError,
      interestLabelBuilder: (key, fallbackLabel) =>
          localizedInterestLabel(context, key, fallbackLabel: fallbackLabel),
      customInterestLabel: profileL10n.addAnotherInterest,
      customInterestHint: profileL10n.customInterestHint,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final optionsAsync = ref.watch(learnerInterestOptionsProvider);
    final draft = ref.watch(registrationDraftProvider);

    return optionsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => _interestPicker(fallbackLearnerInterestOptions),
      data: (options) {
        if (_selectedInterestKeys.isEmpty) {
          final fromDraft = draft.onboardingInterests.isNotEmpty
              ? draft.onboardingInterests
              : draft.learnerProfile?.interests ?? const [];
          _selectedInterestKeys = normalizeSelectedInterestKeys(
            fromDraft,
            labelByKey: options.labelByKey,
          );
        }

        return Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (widget.showSupplierNextHint) ...[
                Text(
                  l10n.registerSupplierNextHint,
                  style: AppTextStyles.subtitle(context),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              AppDropdownField<String>(
                label: l10n.registerLearnerTypeTitle,
                hint: l10n.registerSelectLearnerType,
                value: _learnerType,
                errorText: _learnerTypeError,
                items: [
                  for (final type in _learnerTypes)
                    DropdownMenuItem(
                      value: type,
                      child: Text(localizedLearnerType(l10n, type)),
                    ),
                ],
                onChanged: (value) {
                  if (_learnerTypeError != null || _formError != null) {
                    _clearErrors();
                  }
                  setState(() => _learnerType = value);
                },
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return l10n.registerLearnerTypeRequired;
                  }
                  return null;
                },
              ),
              const AppFieldGap(),
              AppDropdownField<String>(
                label: l10n.registerSkillLevelTitle,
                hint: l10n.registerSelectSkillLevel,
                value: _skillLevel,
                errorText: _skillLevelError,
                items: [
                  for (final level in _skillLevels)
                    DropdownMenuItem(
                      value: level,
                      child: Text(localizedSkillLevel(l10n, level)),
                    ),
                ],
                onChanged: (value) {
                  if (_skillLevelError != null || _formError != null) {
                    _clearErrors();
                  }
                  setState(() => _skillLevel = value);
                },
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return l10n.registerSkillLevelRequired;
                  }
                  return null;
                },
              ),
              const AppFieldGap(),
              _interestPicker(options),
              const AppFieldGap(),
              AppTextArea(
                controller: _bioController,
                label: l10n.registerBioOptionalLabel,
                hint: l10n.registerBioHint,
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
                label: l10n.actionContinue,
                isLoading: _isSubmitting,
                onPressed: _handleSubmit,
              ),
            ],
          ),
        );
      },
    );
  }
}
