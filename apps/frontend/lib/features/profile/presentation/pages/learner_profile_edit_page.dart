import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_dropdown_field.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_text_area.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../../auth/data/models/user.dart';
import '../../application/profile_providers.dart';
import '../../data/models/learner_interest_options.dart';
import '../../data/models/learner_profile_options.dart';
import '../l10n/learner_profile_l10n.dart';
import '../widgets/learner_interest_chip_picker.dart';
import '../widgets/profile_image_picker.dart';

List<String> learnerProfileDropdownValues({
  required List<String> supported,
  required String? current,
}) {
  final currentValue = current;
  final currentKey = currentValue?.trim().toLowerCase();
  final hasCurrent = currentKey != null && currentKey.isNotEmpty;
  final values = <String>[];
  final seenKeys = <String>{};
  var insertedCurrent = false;

  for (final supportedValue in supported) {
    final supportedKey = supportedValue.trim().toLowerCase();
    if (supportedKey.isEmpty || !seenKeys.add(supportedKey)) {
      continue;
    }

    if (hasCurrent && supportedKey == currentKey) {
      values.add(currentValue!);
      insertedCurrent = true;
    } else {
      values.add(supportedValue);
    }
  }

  if (hasCurrent && !insertedCurrent) {
    values.insert(0, currentValue!);
  }

  return List.unmodifiable(values);
}

class LearnerProfileEditPage extends ConsumerStatefulWidget {
  const LearnerProfileEditPage({super.key});

  @override
  ConsumerState<LearnerProfileEditPage> createState() =>
      _LearnerProfileEditPageState();
}

class _LearnerProfileEditPageState
    extends ConsumerState<LearnerProfileEditPage> {
  final _formKey = GlobalKey<FormState>();
  final _customInterestController = TextEditingController();
  final _bioController = TextEditingController();
  String? _learnerType;
  String? _skillLevel;
  Set<String> _selectedInterestKeys = {};
  bool _isSubmitting = false;
  bool _interestsTouched = false;
  bool _didApplyRemoteInterestLabels = false;
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

  void _applyUser(User? user, {Map<String, String>? labelByKey}) {
    final profile = user?.learnerProfile;
    _learnerType = _nullableValue(profile?.learnerType);
    _skillLevel = _nullableValue(profile?.skillLevel);
    _selectedInterestKeys = normalizeSelectedInterestKeys(
      profile?.interests ?? const [],
      labelByKey: labelByKey,
    );
    _bioController.text = profile?.bio?.trim() ?? '';
  }

  void _applyRemoteInterestLabelsIfNeeded(
    User? user,
    LearnerInterestOptionsResponse options,
  ) {
    if (_didApplyRemoteInterestLabels || _interestsTouched) {
      return;
    }
    _didApplyRemoteInterestLabels = true;
    _selectedInterestKeys = normalizeSelectedInterestKeys(
      user?.learnerProfile?.interests ?? const [],
      labelByKey: options.labelByKey,
    );
  }

  String? _nullableValue(String? value) {
    final trimmed = value?.trim() ?? '';
    return trimmed.isEmpty ? null : value;
  }

  @override
  void dispose() {
    _customInterestController.dispose();
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
    final l10n = LearnerProfileL10n.of(context);

    try {
      final bio = _bioController.text.trim();
      final user = await ref
          .read(profileRepositoryProvider)
          .updateLearnerProfile(
            learnerType: _learnerType!,
            skillLevel: _skillLevel!,
            interests: mergeInterestSelection(
              selectedKeys: _selectedInterestKeys,
              customInterestText: _customInterestController.text,
            ),
            bio: bio.isEmpty ? null : bio,
          );

      ref.read(authControllerProvider.notifier).syncAuthenticatedUser(user);

      if (!mounted) {
        return;
      }

      showInfoSnackBar(context, l10n.learnerProfileUpdated);
      context.go(learningProfileRoute);
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _learnerTypeError = firstFieldError(
          error,
          const ['learnerType'],
          l10n: context.l10n,
        );
        _skillLevelError = firstFieldError(
          error,
          const ['skillLevel'],
          l10n: context.l10n,
        );
        _interestsError = firstFieldError(
          error,
          const ['interests'],
          l10n: context.l10n,
        );
        _bioError = firstFieldError(error, const ['bio'], l10n: context.l10n);
        _formError =
            _learnerTypeError == null &&
                _skillLevelError == null &&
                _interestsError == null &&
                _bioError == null
            ? localizedApiErrorMessage(error, context.l10n)
            : null;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _formError = l10n.updateLearnerProfileFailed;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    final user = ref.watch(authControllerProvider).user;
    final isActiveLearner =
        user?.hasRole('LEARNER') == true && user?.isLearnerMode == true;
    final optionsAsync = ref.watch(learnerInterestOptionsProvider);

    if (!isActiveLearner) {
      return ProfileSubpageScaffold(
        title: l10n.editLearningProfile,
        backFallbackRoute: learningProfileRoute,
        backTooltip: l10n.back,
        child: ProfileEditCard(child: Text(l10n.learnerOnlyEditMessage)),
      );
    }

    return ProfileSubpageScaffold(
      title: l10n.editLearningProfile,
      backFallbackRoute: learningProfileRoute,
      backTooltip: l10n.back,
      child: ProfileEditCard(
        child: optionsAsync.when(
          loading: () => Semantics(
            label: l10n.loadingInterests,
            child: const Center(child: CircularProgressIndicator()),
          ),
          error: (_, _) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AppInlineError(message: l10n.interestFallbackMessage),
              const SizedBox(height: AppSpacing.md),
              _buildForm(fallbackLearnerInterestOptions),
            ],
          ),
          data: (options) {
            _applyRemoteInterestLabelsIfNeeded(user, options);
            return _buildForm(options);
          },
        ),
      ),
    );
  }

  Widget _buildForm(LearnerInterestOptionsResponse options) {
    final l10n = LearnerProfileL10n.of(context);
    final learnerTypes = learnerProfileDropdownValues(
      supported: LearnerProfileOptions.learnerTypes,
      current: _learnerType,
    );
    final skillLevels = learnerProfileDropdownValues(
      supported: LearnerProfileOptions.skillLevels,
      current: _skillLevel,
    );

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppDropdownField<String>(
            label: l10n.learnerType,
            hint: l10n.selectLearnerType,
            value: _learnerType,
            errorText: _learnerTypeError,
            items: [
              for (final type in learnerTypes)
                DropdownMenuItem(
                  value: type,
                  child: Text(l10n.learnerTypeLabel(type)),
                ),
            ],
            onChanged: (value) => setState(() => _learnerType = value),
            validator: (value) => value == null || value.trim().isEmpty
                ? l10n.learnerTypeRequired
                : null,
          ),
          const AppFieldGap(),
          AppDropdownField<String>(
            label: l10n.skillLevel,
            hint: l10n.selectSkillLevel,
            value: _skillLevel,
            errorText: _skillLevelError,
            items: [
              for (final level in skillLevels)
                DropdownMenuItem(
                  value: level,
                  child: Text(l10n.skillLevelLabel(level)),
                ),
            ],
            onChanged: (value) => setState(() => _skillLevel = value),
            validator: (value) => value == null || value.trim().isEmpty
                ? l10n.skillLevelRequired
                : null,
          ),
          const AppFieldGap(),
          LearnerInterestChipPicker(
            options: options,
            selectedKeys: _selectedInterestKeys,
            onChanged: (value) => setState(() {
              _interestsTouched = true;
              _selectedInterestKeys = value;
            }),
            customInterestController: _customInterestController,
            label: l10n.interests,
            errorText: _interestsError,
            interestLabelBuilder: (key, fallbackLabel) {
              return l10n.hasLocalizedInterestLabel(key)
                  ? l10n.interestLabel(key)
                  : fallbackLabel;
            },
            customInterestLabel: l10n.addAnotherInterest,
            customInterestHint: l10n.customInterestHint,
          ),
          const AppFieldGap(),
          AppTextArea(
            controller: _bioController,
            label: l10n.about,
            hint: l10n.bioHint,
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
            label: _isSubmitting ? l10n.saving : l10n.saveChanges,
            onPressed: _isSubmitting ? null : _submit,
          ),
        ],
      ),
    );
  }
}
