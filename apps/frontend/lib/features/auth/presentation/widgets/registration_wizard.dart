import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../../supplier_portal/application/supplier_verification_access.dart';
import '../../../supplier_portal/data/supplier_verification_api.dart';
import '../../application/auth_controller.dart';
import '../../application/auth_navigation.dart';
import '../../application/registration_draft_notifier.dart';
import '../../data/models/registration_draft.dart';
import '../models/registration_intent.dart';
import '../models/registration_wizard_step.dart';
import '../utils/registration_onboarding_helpers.dart';
import 'auth_buttons.dart';
import 'auth_form_fields.dart';
import 'auth_password_field.dart';
import 'auth_text_field.dart';
import 'auth_ui_palette.dart';

class RegistrationWizard extends ConsumerStatefulWidget {
  const RegistrationWizard({super.key, this.initialIntent});

  final RegistrationIntent? initialIntent;

  @override
  ConsumerState<RegistrationWizard> createState() => _RegistrationWizardState();
}

class _RegistrationWizardState extends ConsumerState<RegistrationWizard> {
  final _formKey = GlobalKey<FormState>();
  final _displayNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _cityController = TextEditingController();
  final _areaController = TextEditingController();
  final _publicNameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _customInterestController = TextEditingController();

  RegistrationIntent? _intent;
  int _stepIndex = 0;
  String? _learnerType;
  String? _skillLevel;
  String? _supplierType;
  final Set<String> _selectedInterests = {};
  final Set<String> _selectedGoals = {};
  PlatformFile? _verificationDocument;

  bool _isSubmitting = false;
  bool _accountCreated = false;
  bool _verificationPendingRetry = false;

  String? _intentError;
  String? _formError;
  String? _learnerTypeError;
  String? _skillLevelError;
  String? _supplierTypeError;
  String? _verificationDocumentError;
  String? _cityError;
  String? _areaError;

  static const _intentOptions = [
    (RegistrationIntent.learner, 'Find materials'),
    (RegistrationIntent.supplier, 'Share materials'),
    (RegistrationIntent.both, 'Do both'),
  ];

  bool get _needsVerification => isOrganizationSupplierInput(_supplierType);

  bool get _needsSupplierProfile =>
      _intent == RegistrationIntent.supplier ||
      _intent == RegistrationIntent.both;

  bool get _needsLearnerProfile =>
      _intent == RegistrationIntent.learner ||
      _intent == RegistrationIntent.both;

  String get _trimmedDisplayName => _displayNameController.text.trim();

  String get _supplierPublicName {
    final customName = _publicNameController.text.trim();
    return customName.isEmpty ? _trimmedDisplayName : customName;
  }

  List<RegistrationWizardStep> get _steps {
    final intent = _intent;
    if (intent == null) {
      return const [RegistrationWizardStep.account];
    }

    return registrationWizardSteps(
      intent: intent,
      needsVerification: _needsVerification,
    );
  }

  RegistrationWizardStep get _currentStep => _steps[_stepIndex];

  @override
  void initState() {
    super.initState();
    _intent = widget.initialIntent;
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _cityController.dispose();
    _areaController.dispose();
    _publicNameController.dispose();
    _descriptionController.dispose();
    _customInterestController.dispose();
    super.dispose();
  }

  void _clearErrors({bool clearIntent = false}) {
    setState(() {
      if (clearIntent) {
        _intentError = null;
      }
      _formError = null;
      _learnerTypeError = null;
      _skillLevelError = null;
      _supplierTypeError = null;
      _verificationDocumentError = null;
      _cityError = null;
      _areaError = null;
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
      _supplierTypeError = firstFieldError(error, const [
        'supplierProfile.supplierType',
      ]);
      _cityError = firstFieldError(error, const ['supplierProfile.pickupArea']);
      _formError = null;

      if (_learnerTypeError == null &&
          _skillLevelError == null &&
          _supplierTypeError == null &&
          _cityError == null) {
        _formError = error.displayMessage;
      }
    });
  }

  String? _validateVerificationDocument(PlatformFile? file) {
    if (file == null || file.bytes == null) {
      return 'Verification document is required';
    }

    if (file.size > maxVerificationDocumentBytes) {
      return 'File must be 5MB or smaller';
    }

    final extension = file.name.split('.').last.toLowerCase();
    if (!allowedVerificationExtensions.contains(extension)) {
      return 'Allowed file types: PDF, PNG, JPG, JPEG';
    }

    return null;
  }

  Future<void> _pickVerificationDocument() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: allowedVerificationExtensions.toList(),
      withData: true,
    );
    if (result == null || result.files.isEmpty) {
      return;
    }

    final file = result.files.first;
    final validationError = _validateVerificationDocument(file);

    setState(() {
      _verificationDocument = validationError == null ? file : null;
      _verificationDocumentError = validationError;
      if (validationError == null) {
        _formError = null;
        _verificationPendingRetry = false;
      }
    });
  }

  bool _validateCurrentStep() {
    _clearErrors();

    switch (_currentStep) {
      case RegistrationWizardStep.account:
        if (_intent == null) {
          setState(() {
            _intentError = 'Please choose how you want to use ImpactLoop.';
          });
          return false;
        }
        return _formKey.currentState?.validate() ?? false;

      case RegistrationWizardStep.interests:
        return true;

      case RegistrationWizardStep.goals:
        return true;

      case RegistrationWizardStep.location:
        if (!_needsSupplierProfile) {
          return true;
        }
        return _formKey.currentState?.validate() ?? false;

      case RegistrationWizardStep.learnerBasics:
        if (_learnerType == null || _learnerType!.isEmpty) {
          setState(() => _learnerTypeError = 'Learner type is required');
          return false;
        }
        if (_skillLevel == null || _skillLevel!.isEmpty) {
          setState(() => _skillLevelError = 'Skill level is required');
          return false;
        }
        return true;

      case RegistrationWizardStep.supplierBasics:
        if (_supplierType == null || _supplierType!.isEmpty) {
          setState(() => _supplierTypeError = 'Supplier type is required');
          return false;
        }
        return _formKey.currentState?.validate() ?? false;

      case RegistrationWizardStep.verification:
        if (!_needsVerification) {
          return true;
        }
        final documentError = _validateVerificationDocument(
          _verificationDocument,
        );
        if (documentError != null) {
          setState(() => _verificationDocumentError = documentError);
          return false;
        }
        return true;

      case RegistrationWizardStep.review:
        return true;
    }
  }

  void _persistCurrentStep() {
    final draftNotifier = ref.read(registrationDraftProvider.notifier);

    switch (_currentStep) {
      case RegistrationWizardStep.account:
        final phone = _phoneController.text.trim();
        final displayName = _displayNameController.text.trim();
        draftNotifier
          ..setBasicInfo(
            displayName: displayName,
            email: _emailController.text.trim(),
            password: _passwordController.text,
            phone: phone.isEmpty ? null : phone,
          )
          ..setIntent(_intent!);
        if (_needsSupplierProfile &&
            _publicNameController.text.trim().isEmpty) {
          _publicNameController.text = displayName;
        }
        break;

      case RegistrationWizardStep.interests:
        final interests = {..._selectedInterests};
        final custom = _customInterestController.text.trim();
        if (custom.isNotEmpty) {
          interests.add(custom);
        }
        draftNotifier.setOnboardingInterests(interests.toList());
        break;

      case RegistrationWizardStep.goals:
        draftNotifier.setOnboardingGoals(_selectedGoals.toList());
        break;

      case RegistrationWizardStep.location:
        draftNotifier.setOnboardingLocation(
          city: _cityController.text.trim(),
          area: _areaController.text.trim(),
        );
        break;

      case RegistrationWizardStep.learnerBasics:
        if (_intent == RegistrationIntent.both && _supplierType == null) {
          _supplierType = suggestedSupplierTypeForLearnerType(_learnerType);
        }
        draftNotifier.setLearnerProfile(
          LearnerProfileDraft(
            learnerType: _learnerType!,
            skillLevel: _skillLevel!,
            interests: ref.read(registrationDraftProvider).onboardingInterests,
          ),
        );
        break;

      case RegistrationWizardStep.supplierBasics:
        final draft = ref.read(registrationDraftProvider);
        final pickupArea = formatPickupArea(
          city: draft.onboardingCity ?? _cityController.text.trim(),
          area: draft.onboardingArea ?? _areaController.text.trim(),
        );
        draftNotifier.setSupplierProfile(
          SupplierProfileDraft(
            supplierType: _supplierType!,
            publicName: _supplierPublicName,
            description: _descriptionController.text.trim().isEmpty
                ? null
                : _descriptionController.text.trim(),
            pickupArea: pickupArea,
          ),
        );
        break;

      case RegistrationWizardStep.verification:
      case RegistrationWizardStep.review:
        break;
    }
  }

  void _goNext() {
    if (_isSubmitting) {
      return;
    }

    if (!_validateCurrentStep()) {
      return;
    }

    _persistCurrentStep();

    if (_currentStep == RegistrationWizardStep.review ||
        (_currentStep == RegistrationWizardStep.verification &&
            _accountCreated &&
            _verificationPendingRetry)) {
      _handleCreateAccount();
      return;
    }

    setState(() {
      final nextIndex = _stepIndex + 1;
      if (nextIndex < _steps.length) {
        _stepIndex = nextIndex;
      } else if (_steps.isNotEmpty) {
        _stepIndex = _steps.length - 1;
      }
    });
  }

  void _goBack() {
    if (_isSubmitting || _stepIndex == 0) {
      return;
    }

    setState(() {
      _stepIndex -= 1;
      _formError = null;
    });
  }

  Future<void> _submitVerification() async {
    final api = ref.read(supplierVerificationApiProvider);
    final supplierProfile = ref.read(registrationDraftProvider).supplierProfile;
    if (supplierProfile == null || _verificationDocument == null) {
      throw StateError('Verification details are incomplete');
    }

    final uploaded = await api.uploadDocument(
      bytes: _verificationDocument!.bytes!,
      fileName: _verificationDocument!.name,
      mimeType: mimeTypeForVerificationFile(_verificationDocument!.name),
    );
    final location = verificationLocationPayload(supplierProfile.pickupArea);
    final apiSupplierType = normalizeSupplierTypeInput(_supplierType)!;

    await api.submitVerification({
      'organizationName': supplierProfile.publicName,
      'supplierType': apiSupplierType,
      'description': supplierProfile.description,
      'defaultPickupLocation': location,
      'businessLocation': location,
      'verificationDocumentUrl': uploaded.url,
      'verificationDocumentName': uploaded.name,
    });
    await ref.read(authControllerProvider.notifier).refreshCurrentUser();
  }

  void _syncAllProfiles() {
    final draftNotifier = ref.read(registrationDraftProvider.notifier);
    final interests = {..._selectedInterests};
    final customInterest = _customInterestController.text.trim();
    if (customInterest.isNotEmpty) {
      interests.add(customInterest);
    }

    draftNotifier.setOnboardingGoals(_selectedGoals.toList());

    if (_needsLearnerProfile) {
      draftNotifier.setOnboardingInterests(interests.toList());
      if (_learnerType != null && _skillLevel != null) {
        if (_intent == RegistrationIntent.both && _supplierType == null) {
          _supplierType = suggestedSupplierTypeForLearnerType(_learnerType);
        }
        draftNotifier.setLearnerProfile(
          LearnerProfileDraft(
            learnerType: _learnerType!,
            skillLevel: _skillLevel!,
            interests: interests.toList(),
          ),
        );
      }
    }

    if (_needsSupplierProfile) {
      draftNotifier.setOnboardingLocation(
        city: _cityController.text.trim(),
        area: _areaController.text.trim(),
      );
      if (_supplierType != null && _supplierPublicName.isNotEmpty) {
        final pickupArea = formatPickupArea(
          city: _cityController.text.trim(),
          area: _areaController.text.trim(),
        );
        draftNotifier.setSupplierProfile(
          SupplierProfileDraft(
            supplierType: _supplierType!,
            publicName: _supplierPublicName,
            description: _descriptionController.text.trim().isEmpty
                ? null
                : _descriptionController.text.trim(),
            pickupArea: pickupArea,
          ),
        );
      }
    }
  }

  Future<void> _handleCreateAccount() async {
    if (_isSubmitting) {
      return;
    }

    if (_accountCreated && !_verificationPendingRetry) {
      return;
    }

    _clearErrors();
    setState(() => _isSubmitting = true);

    try {
      if (!_accountCreated) {
        _syncAllProfiles();

        final draftNotifier = ref.read(registrationDraftProvider.notifier);
        final request = draftNotifier.toRegisterRequest();

        if (request == null) {
          setState(() {
            _isSubmitting = false;
            _formError =
                'Registration details are incomplete. Please review your answers.';
          });
          return;
        }

        await ref.read(authControllerProvider.notifier).register(request);
        _accountCreated = true;
      }

      if (_needsVerification) {
        await _submitVerification();
        ref.read(registrationDraftProvider.notifier).clear();

        if (!mounted) {
          return;
        }

        context.go(supplierVerificationPendingRoute);
        return;
      }

      ref.read(registrationDraftProvider.notifier).clear();

      if (!mounted) {
        return;
      }

      final user = ref.read(authControllerProvider).user;
      context.go(user == null ? registerRoute : postAuthRouteForUser(user));
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      if (_accountCreated && _needsVerification) {
        setState(() {
          _isSubmitting = false;
          _verificationPendingRetry = true;
          _formError =
              'Your account was created, but verification upload failed. '
              'Fix the issue below and try again.';
          _stepIndex = _steps.indexOf(RegistrationWizardStep.verification);
          if (_stepIndex < 0) {
            _stepIndex = _steps.length - 1;
          }
        });
      } else {
        _applyServerError(error);
        setState(() => _isSubmitting = false);
      }
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        if (_accountCreated && _needsVerification) {
          _verificationPendingRetry = true;
          _formError =
              'Your account was created, but verification upload failed. '
              'Please try uploading again.';
          _stepIndex = _steps.indexOf(RegistrationWizardStep.verification);
          if (_stepIndex < 0) {
            _stepIndex = _steps.length - 1;
          }
        } else {
          _formError = 'Something went wrong. Please try again.';
        }
      });
    }
  }

  void _toggleInterest(String interest) {
    _clearErrors();
    setState(() {
      if (_selectedInterests.contains(interest)) {
        _selectedInterests.remove(interest);
      } else {
        _selectedInterests.add(interest);
      }
    });
  }

  void _toggleGoal(String goal) {
    _clearErrors();
    setState(() {
      if (_selectedGoals.contains(goal)) {
        _selectedGoals.remove(goal);
      } else {
        _selectedGoals.add(goal);
      }
    });
  }

  String _stepSubtitle(RegistrationWizardStep step) {
    if (step == RegistrationWizardStep.location) {
      if (_needsSupplierProfile) {
        return 'City and area help learners understand where pickup can happen.';
      }

      return 'Optional for learners. You can add precise delivery details when you reserve materials.';
    }

    if (step == RegistrationWizardStep.supplierBasics) {
      return 'Choose who is sharing materials. We use your full name as the public supplier name unless you change it.';
    }

    if (step == RegistrationWizardStep.learnerBasics) {
      return 'This helps us suggest projects that match your experience.';
    }

    return step.subtitle;
  }

  Widget _buildStepHeader(BuildContext context) {
    final colors = AuthUiPalette.of(context);
    final stepNumber = _stepIndex + 1;
    final totalSteps = _steps.length;
    final nextStep = _stepIndex + 1 < _steps.length
        ? _steps[_stepIndex + 1]
        : null;

    if (_intent == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: colors.primarySoft,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: 6,
                ),
                child: Text(
                  'Choose your path',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: colors.primary,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Start your setup',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Choose how you want to use ImpactLoop. The setup steps will adapt after that.',
            style: TextStyle(
              fontSize: 14,
              height: 1.5,
              color: colors.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                color: colors.primarySoft,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: 6,
                ),
                child: Text(
                  'Step $stepNumber of $totalSteps',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: colors.primary,
                  ),
                ),
              ),
            ),
            const Spacer(),
            if (nextStep != null)
              Flexible(
                child: Text(
                  'Next: ${nextStep.title}',
                  textAlign: TextAlign.right,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: colors.textMuted,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        _StepProgressSegments(steps: _steps, currentIndex: _stepIndex),
        const SizedBox(height: AppSpacing.md),
        Text(
          _currentStep.title,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: colors.textPrimary,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          _stepSubtitle(_currentStep),
          style: TextStyle(
            fontSize: 14,
            height: 1.5,
            color: colors.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
      ],
    );
  }

  Widget _buildAccountStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'How do you want to use ImpactLoop?',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            height: 1.5,
            color: AuthUiPalette.of(context).textPrimary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final option in _intentOptions)
              AuthIntentChip(
                label: option.$2,
                isSelected: _intent == option.$1,
                onTap: () {
                  _clearErrors(clearIntent: true);
                  setState(() {
                    _intent = option.$1;
                    if (option.$1 == RegistrationIntent.supplier) {
                      _learnerType = null;
                      _skillLevel = null;
                      _selectedInterests.clear();
                    } else if (option.$1 == RegistrationIntent.learner) {
                      _supplierType = null;
                      _verificationDocument = null;
                    }
                  });
                },
              ),
          ],
        ),
        if (_intentError != null) AppInlineError(message: _intentError!),
        if (_intent == RegistrationIntent.both) ...[
          const SizedBox(height: AppSpacing.md),
          const AuthSectionTitle(title: 'Learner profile'),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'You will complete learner and supplier details in the next steps.',
            style: TextStyle(
              fontSize: 13,
              color: AuthUiPalette.of(context).textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          const AuthSectionTitle(title: 'Supplier profile'),
        ],
        const SizedBox(height: AppSpacing.lg),
        AuthTextField(
          controller: _displayNameController,
          label: 'Full name',
          hint: 'Your name',
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.name],
          onChanged: (_) => _clearErrors(),
          validator: (value) {
            if (value == null || value.trim().isEmpty) {
              return 'Full name is required';
            }
            return null;
          },
        ),
        const AuthFieldGap(),
        AuthTextField(
          controller: _emailController,
          label: 'Email address',
          hint: 'you@example.com',
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.email],
          onChanged: (_) => _clearErrors(),
          validator: (value) {
            final trimmed = value?.trim() ?? '';
            if (trimmed.isEmpty) {
              return 'Email is required';
            }
            if (!trimmed.contains('@')) {
              return 'Enter a valid email address';
            }
            return null;
          },
        ),
        const AuthFieldGap(),
        AuthTextField(
          controller: _phoneController,
          label: 'Phone number (optional)',
          hint: '+970 000 000 000',
          keyboardType: TextInputType.phone,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.telephoneNumber],
          onChanged: (_) => _clearErrors(),
        ),
        const AuthFieldGap(),
        AuthPasswordField(
          controller: _passwordController,
          label: 'Password',
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.newPassword],
          onChanged: (_) => _clearErrors(),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Password is required';
            }
            return null;
          },
        ),
        const AuthFieldGap(),
        AuthPasswordField(
          controller: _confirmPasswordController,
          label: 'Confirm password',
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.newPassword],
          onChanged: (_) => _clearErrors(),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Confirm password is required';
            }
            if (value != _passwordController.text) {
              return 'Passwords do not match';
            }
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildInterestsStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final interest in registrationInterestOptions)
              AuthIntentChip(
                label: interest,
                isSelected: _selectedInterests.contains(interest),
                onTap: () => _toggleInterest(interest),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        AuthTextField(
          controller: _customInterestController,
          label: 'Add another interest (optional)',
          hint: 'Solar energy, CNC, etc.',
          textInputAction: TextInputAction.done,
          onChanged: (_) => _clearErrors(),
        ),
      ],
    );
  }

  Widget _buildGoalsStep() {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        for (final goal in registrationGoalOptions)
          AuthIntentChip(
            label: goal,
            isSelected: _selectedGoals.contains(goal),
            onTap: () => _toggleGoal(goal),
          ),
      ],
    );
  }

  Widget _buildLocationStep() {
    final colors = AuthUiPalette.of(context);
    final isRequired = _needsSupplierProfile;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          isRequired
              ? 'Suppliers need a city and area so pickups can be planned. Exact pickup details can stay private until a reservation or delivery is arranged.'
              : 'You can skip this for now. We will ask for accurate reservation or delivery details only when they are needed.',
          style: TextStyle(
            fontSize: 13,
            height: 1.45,
            color: colors.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        AuthTextField(
          controller: _cityController,
          label: isRequired ? 'City' : 'City (optional)',
          hint: 'Nablus',
          textInputAction: TextInputAction.next,
          errorText: _cityError,
          onChanged: (_) => _clearErrors(),
          validator: (value) {
            if (isRequired && (value == null || value.trim().isEmpty)) {
              return 'City is required';
            }
            return null;
          },
        ),
        const AuthFieldGap(),
        AuthTextField(
          controller: _areaController,
          label: isRequired
              ? 'Area / neighborhood'
              : 'Area / neighborhood (optional)',
          hint: 'Rafidia',
          textInputAction: TextInputAction.done,
          errorText: _areaError,
          onChanged: (_) => _clearErrors(),
          validator: (value) {
            if (isRequired && (value == null || value.trim().isEmpty)) {
              return 'Area is required';
            }
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildLearnerBasicsStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const AuthSectionTitle(title: 'Learner type'),
        const SizedBox(height: AppSpacing.sm),
        for (final type in registrationLearnerTypes) ...[
          AuthSelectCard(
            label: type,
            description: learnerTypeDescription(type),
            isSelected: _learnerType == type,
            onTap: () {
              _clearErrors();
              setState(() => _learnerType = type);
            },
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (_learnerTypeError != null)
          AppInlineError(message: _learnerTypeError!),
        const SizedBox(height: AppSpacing.md),
        const AuthSectionTitle(title: 'Skill level'),
        Text(
          'How comfortable are you with building learning projects?',
          style: TextStyle(
            fontSize: 13,
            height: 1.45,
            color: AuthUiPalette.of(context).textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        for (final level in registrationSkillLevels) ...[
          AuthSelectCard(
            label: level,
            description: skillLevelDescription(level),
            isSelected: _skillLevel == level,
            onTap: () {
              _clearErrors();
              setState(() => _skillLevel = level);
            },
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (_skillLevelError != null)
          AppInlineError(message: _skillLevelError!),
      ],
    );
  }

  Widget _buildSupplierBasicsStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const AuthSectionTitle(title: 'Supplier type'),
        const SizedBox(height: AppSpacing.sm),
        for (final type in registrationSupplierTypes) ...[
          AuthSelectCard(
            label: type,
            description: supplierTypeDescription(type),
            isSelected: _supplierType == type,
            onTap: () {
              _clearErrors();
              setState(() {
                _supplierType = type;
                if (!isOrganizationSupplierInput(type)) {
                  _verificationDocument = null;
                  _verificationDocumentError = null;
                }
              });
            },
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (_supplierTypeError != null)
          AppInlineError(message: _supplierTypeError!),
        const SizedBox(height: AppSpacing.md),
        Text(
          'Public name appears on your material listings and reservation messages.',
          style: TextStyle(
            fontSize: 13,
            height: 1.45,
            color: AuthUiPalette.of(context).textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        AuthTextField(
          controller: _publicNameController,
          label: 'Supplier display name (optional)',
          hint: _trimmedDisplayName.isEmpty
              ? 'Uses your full name by default'
              : _trimmedDisplayName,
          textInputAction: TextInputAction.next,
          onChanged: (_) => _clearErrors(),
        ),
        const AuthFieldGap(),
        AuthTextArea(
          controller: _descriptionController,
          label: 'Short description (optional)',
          hint: 'What kinds of materials do you usually share?',
          minLines: 2,
          maxLines: 4,
          onChanged: (_) => _clearErrors(),
        ),
      ],
    );
  }

  Widget _buildVerificationStep() {
    final colors = AuthUiPalette.of(context);
    final hasFile =
        _verificationDocument?.name != null &&
        _verificationDocument!.name.trim().isNotEmpty;

    if (!_needsVerification) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Icon(Icons.verified_user_outlined, color: colors.primary, size: 32),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'No verification document is required for this supplier type.',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'You can review your account details next and create the account '
            'without uploading a file.',
            style: TextStyle(
              fontSize: 13,
              color: colors.textSecondary,
              height: 1.5,
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_accountCreated) ...[
          AppInlineError(
            message:
                _formError ??
                'Your account is ready. Upload your verification document to continue.',
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        Text(
          'Upload a document that proves your organization identity, such as a '
          'workshop license, factory document, or university/institution proof.',
          style: TextStyle(
            fontSize: 13,
            color: colors.textSecondary,
            height: 1.5,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        InputDecorator(
          decoration: InputDecoration(
            labelText: 'Verification document',
            hintText: 'PDF, PNG, JPG, or JPEG (max 5MB)',
            floatingLabelBehavior: FloatingLabelBehavior.always,
            errorText: _verificationDocumentError,
            filled: true,
            fillColor: colors.surfaceElevated,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            enabledBorder: OutlineInputBorder(
              borderSide: BorderSide(color: colors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderSide: BorderSide(color: colors.primary, width: 1.4),
            ),
            errorBorder: OutlineInputBorder(
              borderSide: BorderSide(
                color: Theme.of(context).colorScheme.error,
              ),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  hasFile ? _verificationDocument!.name : 'No file selected',
                  style: TextStyle(
                    color: hasFile ? colors.textPrimary : colors.textMuted,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              TextButton(
                onPressed: _pickVerificationDocument,
                child: Text(hasFile ? 'Change file' : 'Select file'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildReviewStep() {
    final colors = AuthUiPalette.of(context);
    final draft = ref.watch(registrationDraftProvider);
    final interests = draft.onboardingInterests;
    final goals = draft.onboardingGoals;
    final pickupArea =
        (_intent == RegistrationIntent.supplier ||
                _intent == RegistrationIntent.both) &&
            draft.onboardingCity != null
        ? formatPickupArea(
            city: draft.onboardingCity!,
            area: draft.onboardingArea ?? '',
          )
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ReviewRow(label: 'Intent', value: _intentLabel(_intent)),
        _ReviewRow(label: 'Name', value: _displayNameController.text.trim()),
        _ReviewRow(label: 'Email', value: _emailController.text.trim()),
        if (interests.isNotEmpty)
          _ReviewRow(label: 'Interests', value: interests.join(', ')),
        if (goals.isNotEmpty)
          _ReviewRow(label: 'Goals', value: goals.join(', ')),
        if (pickupArea != null)
          _ReviewRow(label: 'Location', value: pickupArea),
        if (draft.learnerProfile != null) ...[
          _ReviewRow(
            label: 'Learner type',
            value: draft.learnerProfile!.learnerType,
          ),
          _ReviewRow(
            label: 'Skill level',
            value: draft.learnerProfile!.skillLevel,
          ),
        ],
        if (draft.supplierProfile != null) ...[
          _ReviewRow(
            label: 'Supplier type',
            value: draft.supplierProfile!.supplierType,
          ),
          _ReviewRow(
            label: 'Public name',
            value: draft.supplierProfile!.publicName,
          ),
          if (draft.supplierProfile!.description?.isNotEmpty ?? false)
            _ReviewRow(
              label: 'Description',
              value: draft.supplierProfile!.description!,
            ),
        ],
        if (_needsVerification)
          _ReviewRow(
            label: 'Verification document',
            value: _verificationDocument?.name ?? 'Not selected',
          ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Goals are used to personalize your onboarding and are not sent separately to the server.',
          style: TextStyle(fontSize: 12, color: colors.textMuted, height: 1.4),
        ),
      ],
    );
  }

  String _intentLabel(RegistrationIntent? intent) {
    return switch (intent) {
      RegistrationIntent.learner => 'Find materials',
      RegistrationIntent.supplier => 'Share materials',
      RegistrationIntent.both => 'Do both',
      null => '',
    };
  }

  Widget _buildStepContent() {
    switch (_currentStep) {
      case RegistrationWizardStep.account:
        return _buildAccountStep();
      case RegistrationWizardStep.interests:
        return _buildInterestsStep();
      case RegistrationWizardStep.goals:
        return _buildGoalsStep();
      case RegistrationWizardStep.location:
        return _buildLocationStep();
      case RegistrationWizardStep.learnerBasics:
        return _buildLearnerBasicsStep();
      case RegistrationWizardStep.supplierBasics:
        return _buildSupplierBasicsStep();
      case RegistrationWizardStep.verification:
        return _buildVerificationStep();
      case RegistrationWizardStep.review:
        return _buildReviewStep();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isReview = _currentStep == RegistrationWizardStep.review;
    final isVerificationRetry =
        _currentStep == RegistrationWizardStep.verification &&
        _accountCreated &&
        _verificationPendingRetry;
    final primaryLabel = isReview
        ? (_accountCreated && _verificationPendingRetry
              ? 'Retry verification'
              : 'Create account')
        : isVerificationRetry
        ? 'Retry verification'
        : 'Continue';

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildStepHeader(context),
          _buildStepContent(),
          if (_formError != null &&
              _currentStep != RegistrationWizardStep.verification) ...[
            const SizedBox(height: AppSpacing.md),
            AppInlineError(message: _formError!),
          ],
          const SizedBox(height: AppSpacing.lg),
          AuthPrimaryButton(
            label: primaryLabel,
            isLoading: _isSubmitting,
            onPressed: _goNext,
          ),
          if (_stepIndex > 0) ...[
            const SizedBox(height: AppSpacing.sm),
            AuthOutlinedButton(label: 'Back', onPressed: _goBack),
          ],
        ],
      ),
    );
  }
}

class _StepProgressSegments extends StatelessWidget {
  const _StepProgressSegments({
    required this.steps,
    required this.currentIndex,
  });

  final List<RegistrationWizardStep> steps;
  final int currentIndex;

  @override
  Widget build(BuildContext context) {
    final colors = AuthUiPalette.of(context);

    return Semantics(
      label:
          'Registration progress, step ${currentIndex + 1} of '
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
                fontWeight: FontWeight.w600,
                color: colors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
