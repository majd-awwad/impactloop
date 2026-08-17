import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../supplier_portal/application/supplier_verification_access.dart';
import '../../../supplier_portal/data/supplier_verification_api.dart';
import '../../../profile/application/profile_providers.dart';
import '../../../profile/data/models/learner_interest_options.dart';
import '../../../profile/presentation/l10n/learner_profile_l10n.dart';
import '../../../profile/presentation/widgets/learner_interest_chip_picker.dart';
import '../../application/auth_controller.dart';
import '../../application/auth_navigation.dart';
import '../../application/registration_draft_notifier.dart';
import '../../data/models/registration_draft.dart';
import '../models/learner_setup_mode.dart';
import '../models/registration_intent.dart';
import '../models/registration_wizard_step.dart';
import '../utils/auth_supplier_l10n.dart';
import '../utils/registration_onboarding_helpers.dart';
import '../utils/registration_option_l10n.dart';
import 'auth_buttons.dart';
import 'auth_form_fields.dart';
import 'auth_password_field.dart';
import 'auth_text_field.dart';
import 'auth_ui_palette.dart';

class RegistrationWizard extends ConsumerStatefulWidget {
  const RegistrationWizard({
    super.key,
    this.initialIntent,
    this.mode = LearnerSetupMode.registration,
  });

  final RegistrationIntent? initialIntent;
  final LearnerSetupMode mode;

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

  bool get _isAddToExistingAccount =>
      widget.mode == LearnerSetupMode.addToExistingAccount;

  bool get _needsVerification => isOrganizationSupplierInput(_supplierType);

  bool get _needsSupplierProfile =>
      !_isAddToExistingAccount &&
      (_intent == RegistrationIntent.supplier ||
          _intent == RegistrationIntent.both);

  bool get _needsLearnerProfile =>
      _isAddToExistingAccount ||
      _intent == RegistrationIntent.learner ||
      _intent == RegistrationIntent.both;

  String get _trimmedDisplayName => _displayNameController.text.trim();

  String get _supplierPublicName {
    final customName = _publicNameController.text.trim();
    return customName.isEmpty ? _trimmedDisplayName : customName;
  }

  List<RegistrationWizardStep> get _steps {
    if (_isAddToExistingAccount) {
      return becomeLearnerWizardSteps;
    }

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
    if (_isAddToExistingAccount) {
      _intent = RegistrationIntent.learner;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) {
          return;
        }
        ref.read(registrationDraftProvider.notifier).clear();
      });
    } else {
      _intent = widget.initialIntent;
    }
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
        'learnerType',
      ]);
      _skillLevelError = firstFieldError(error, const [
        'learnerProfile.skillLevel',
        'skillLevel',
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
        _formError = localizedApiErrorMessage(error, context.l10n);
      }
    });
  }

  String? _validateVerificationDocument(PlatformFile? file) {
    final l10n = context.l10n;

    if (file == null || file.bytes == null) {
      return l10n.verificationDocumentRequired;
    }

    if (file.size > maxVerificationDocumentBytes) {
      return l10n.verificationFileSizeLimit;
    }

    final extension = file.name.split('.').last.toLowerCase();
    if (!allowedVerificationExtensions.contains(extension)) {
      return l10n.verificationAllowedFileTypes;
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
            _intentError = context.l10n.registerHowDoYouWantToUse;
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
          setState(() => _learnerTypeError = context.l10n.registerLearnerTypeRequired);
          return false;
        }
        if (_skillLevel == null || _skillLevel!.isEmpty) {
          setState(() => _skillLevelError = context.l10n.registerSkillLevelRequired);
          return false;
        }
        return true;

      case RegistrationWizardStep.supplierBasics:
        if (_supplierType == null || _supplierType!.isEmpty) {
          setState(
            () => _supplierTypeError =
                context.l10n.becomeSupplierSupplierTypeRequired,
          );
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
        draftNotifier.setOnboardingInterests(_currentInterestSelection());
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
      if (_isAddToExistingAccount) {
        _handleBecomeLearner();
      } else {
        _handleCreateAccount();
      }
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
    if (_isSubmitting) {
      return;
    }

    if (_stepIndex == 0) {
      if (_isAddToExistingAccount) {
        context.go(supplierOverviewRoute);
      }
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

  List<String> _currentInterestSelection() {
    return mergeInterestSelection(
      selectedKeys: _selectedInterests,
      customInterestText: _customInterestController.text,
    );
  }

  void _syncAllProfiles() {
    final draftNotifier = ref.read(registrationDraftProvider.notifier);
    final interests = _currentInterestSelection();

    draftNotifier.setOnboardingGoals(_selectedGoals.toList());

    if (_needsLearnerProfile) {
      draftNotifier.setOnboardingInterests(interests);
      if (_learnerType != null && _skillLevel != null) {
        if (_intent == RegistrationIntent.both && _supplierType == null) {
          _supplierType = suggestedSupplierTypeForLearnerType(_learnerType);
        }
        draftNotifier.setLearnerProfile(
          LearnerProfileDraft(
            learnerType: _learnerType!,
            skillLevel: _skillLevel!,
            interests: interests,
          ),
        );
      }
    }

    if (_needsSupplierProfile || _isAddToExistingAccount) {
      draftNotifier.setOnboardingLocation(
        city: _cityController.text.trim(),
        area: _areaController.text.trim(),
      );
    }

    if (_needsSupplierProfile) {
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
            _formError = context.l10n.registrationDetailsIncomplete;
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
              context.l10n.registerVerificationUploadFailedFix;
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
              context.l10n.registerVerificationUploadFailedRetry;
          _stepIndex = _steps.indexOf(RegistrationWizardStep.verification);
          if (_stepIndex < 0) {
            _stepIndex = _steps.length - 1;
          }
        } else {
          _formError = context.l10n.somethingWentWrong;
        }
      });
    }
  }

  Future<void> _handleBecomeLearner() async {
    if (_isSubmitting) {
      return;
    }

    _clearErrors();
    setState(() => _isSubmitting = true);

    try {
      _syncAllProfiles();

      final request = ref
          .read(registrationDraftProvider.notifier)
          .toBecomeLearnerRequest();

      if (request == null) {
        setState(() {
          _isSubmitting = false;
          _formError =
              context.l10n.registerLearnerSetupIncomplete;
        });
        return;
      }

      await ref.read(authControllerProvider.notifier).becomeLearner(request);
      ref.read(registrationDraftProvider.notifier).clear();

      if (!mounted) {
        return;
      }

      showInfoSnackBar(context, context.l10n.registerLearnerAccessAdded);

      final user = ref.read(authControllerProvider).user;
      context.go(user == null ? homeRoute : postAuthRouteForUser(user));
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      _applyServerError(error);
      setState(() => _isSubmitting = false);
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _formError = context.l10n.somethingWentWrong;
      });
    }
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
    final l10n = context.l10n;
    if (step == RegistrationWizardStep.interests) {
      return _intent == RegistrationIntent.both
          ? l10n.registerStepInterestsBothSubtitle
          : l10n.registerStepInterestsSubtitle;
    }

    if (step == RegistrationWizardStep.goals) {
      return switch (_intent) {
        RegistrationIntent.supplier =>
          l10n.registerSupplierShareMaterialsGoals,
        RegistrationIntent.both => l10n.registerStepGoalsBothSubtitle,
        RegistrationIntent.learner ||
        null => l10n.registerStepGoalsLearnerSubtitle,
      };
    }

    if (step == RegistrationWizardStep.location) {
      if (_needsSupplierProfile) {
        return _intent == RegistrationIntent.both
            ? l10n.registerSupplierLocationBothSubtitle
            : l10n.registerSupplierLocationSubtitle;
      }

      return l10n.registerStepLocationLearnerSubtitle;
    }

    if (step == RegistrationWizardStep.supplierBasics) {
      return l10n.registerSupplierBasicsSubtitle;
    }

    if (step == RegistrationWizardStep.learnerBasics) {
      return l10n.registerStepLearnerBasicsSubtitle;
    }

    if (step == RegistrationWizardStep.verification) {
      return l10n.registerSupplierVerificationSubtitle;
    }

    if (step == RegistrationWizardStep.review) {
      if (_isAddToExistingAccount) {
        return l10n.registerStepReviewAddLearnerSubtitle;
      }

      return switch (_intent) {
        RegistrationIntent.supplier =>
          l10n.registerSupplierReviewSupplierSubtitle,
        RegistrationIntent.both =>
          l10n.registerSupplierReviewBothSubtitle,
        RegistrationIntent.learner ||
        null => l10n.registerStepReviewLearnerSubtitle,
      };
    }

    return l10n.registerStepAccountSubtitle;
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
            alignment: AlignmentDirectional.centerStart,
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
                  context.l10n.registerChooseYourPath,
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
            context.l10n.registerStartYourSetup,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            context.l10n.registerChooseHowYouUse,
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
        if (_isAddToExistingAccount) ...[
          Text(
            context.l10n.becomeLearner,
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            context.l10n.registerAddLearnerIntro,
            style: TextStyle(
              fontSize: 14,
              height: 1.5,
              color: colors.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
        ],
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
                  context.l10n.registerStepOf(stepNumber, totalSteps),
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
                  context.l10n.registerNextStep(_localizedStepTitle(nextStep)),
                  textAlign: TextAlign.end,
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
          _localizedStepTitle(_currentStep),
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
          context.l10n.registerHowDoYouWantToUse,
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
            for (final option in [
              (RegistrationIntent.learner, context.l10n.registerIntentFindMaterials),
              (RegistrationIntent.supplier, context.l10n.shareMaterials),
              (RegistrationIntent.both, context.l10n.registerIntentDoBoth),
            ])
              AuthIntentChip(
                label: option.$2,
                isSelected: _intent == option.$1,
                onTap: () {
                  _clearErrors(clearIntent: true);
                  setState(() {
                    _intent = option.$1;
                    _selectedGoals.clear();
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
        if (_intent != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            _intentSetupDescription(_intent!),
            style: TextStyle(
              fontSize: 13,
              height: 1.45,
              color: AuthUiPalette.of(context).textSecondary,
            ),
          ),
        ],
        if (_intent == RegistrationIntent.both) ...[
          const SizedBox(height: AppSpacing.md),
          AuthSectionTitle(title: context.l10n.registerLearnerProfileTitle),
          const SizedBox(height: AppSpacing.xs),
          Text(
            context.l10n.registerBothProfilesHint,
            style: TextStyle(
              fontSize: 13,
              color: AuthUiPalette.of(context).textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          AuthSectionTitle(title: context.l10n.registerSupplierProfileTitle),
        ],
        const SizedBox(height: AppSpacing.lg),
        AuthTextField(
          controller: _displayNameController,
          label: context.l10n.registerFullNameLabel,
          hint: context.l10n.registerYourNameHint,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.name],
          onChanged: (_) => _clearErrors(),
          validator: (value) {
            if (value == null || value.trim().isEmpty) {
              return context.l10n.registerFullNameRequired;
            }
            return null;
          },
        ),
        const AuthFieldGap(),
        AuthTextField(
          controller: _emailController,
          label: context.l10n.registerEmailAddressLabel,
          hint: context.l10n.emailHint,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.email],
          onChanged: (_) => _clearErrors(),
          validator: (value) {
            final trimmed = value?.trim() ?? '';
            if (trimmed.isEmpty) {
              return context.l10n.emailRequired;
            }
            if (!trimmed.contains('@')) {
              return context.l10n.validEmailRequired;
            }
            return null;
          },
        ),
        const AuthFieldGap(),
        AuthTextField(
          controller: _phoneController,
          label: context.l10n.registerPhoneOptionalLabel,
          hint: '+970 000 000 000',
          keyboardType: TextInputType.phone,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.telephoneNumber],
          onChanged: (_) => _clearErrors(),
        ),
        const AuthFieldGap(),
        AuthPasswordField(
          controller: _passwordController,
          label: context.l10n.password,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.newPassword],
          onChanged: (_) => _clearErrors(),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return context.l10n.passwordRequired;
            }
            return null;
          },
        ),
        const AuthFieldGap(),
        AuthPasswordField(
          controller: _confirmPasswordController,
          label: context.l10n.confirmPassword,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.newPassword],
          onChanged: (_) => _clearErrors(),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return context.l10n.registerConfirmPasswordRequired;
            }
            if (value != _passwordController.text) {
              return context.l10n.passwordsDoNotMatch;
            }
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildInterestsStep() {
    final optionsAsync = ref.watch(learnerInterestOptionsProvider);

    return optionsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => _interestChipPicker(fallbackLearnerInterestOptions),
      data: _interestChipPicker,
    );
  }

  Widget _interestChipPicker(LearnerInterestOptionsResponse options) {
    final profileL10n = LearnerProfileL10n.of(context);
    return LearnerInterestChipPicker(
      options: options,
      selectedKeys: _selectedInterests,
      onChanged: (value) => setState(() {
        _selectedInterests
          ..clear()
          ..addAll(value);
      }),
      customInterestController: _customInterestController,
      useAuthFields: true,
      errorText: _formError,
      interestLabelBuilder: (key, fallbackLabel) =>
          localizedInterestLabel(context, key, fallbackLabel: fallbackLabel),
      customInterestLabel: profileL10n.addAnotherInterest,
      customInterestHint: profileL10n.customInterestHint,
    );
  }

  Widget _buildGoalsStep() {
    final colors = AuthUiPalette.of(context);
    final goals = registrationGoalOptionsForIntent(_intent);
    final helper = switch (_intent) {
      RegistrationIntent.supplier => context.l10n.registerGoalsHelperSupplier,
      RegistrationIntent.both => context.l10n.registerGoalsHelperBoth,
      RegistrationIntent.learner || null =>
        context.l10n.registerGoalsHelperLearner,
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          helper,
          style: TextStyle(
            fontSize: 13,
            height: 1.45,
            color: colors.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final goal in goals)
              AuthIntentChip(
                label: localizedRegistrationGoal(context.l10n, goal),
                isSelected: _selectedGoals.contains(goal),
                onTap: () => _toggleGoal(goal),
              ),
          ],
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
          _locationStepHelperText(isRequired),
          style: TextStyle(
            fontSize: 13,
            height: 1.45,
            color: colors.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        AuthTextField(
          controller: _cityController,
          label: isRequired ? context.l10n.city : context.l10n.registerCityOptional,
          hint: context.l10n.registerCityHint,
          textInputAction: TextInputAction.next,
          errorText: _cityError,
          onChanged: (_) => _clearErrors(),
          validator: (value) {
            if (isRequired && (value == null || value.trim().isEmpty)) {
              return context.l10n.registerCityRequired;
            }
            return null;
          },
        ),
        const AuthFieldGap(),
        AuthTextField(
          controller: _areaController,
          label: isRequired
              ? context.l10n.registerAreaNeighborhood
              : context.l10n.registerAreaNeighborhoodOptional,
          hint: context.l10n.registerAreaHint,
          textInputAction: TextInputAction.done,
          errorText: _areaError,
          onChanged: (_) => _clearErrors(),
          validator: (value) {
            if (isRequired && (value == null || value.trim().isEmpty)) {
              return context.l10n.registerAreaRequired;
            }
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildLearnerBasicsStep() {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthSectionTitle(title: l10n.registerLearnerTypeTitle),
        const SizedBox(height: AppSpacing.sm),
        for (final type in registrationLearnerTypes) ...[
          AuthSelectCard(
            label: localizedLearnerType(l10n, type),
            description: localizedLearnerTypeDescription(l10n, type),
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
        AuthSectionTitle(title: l10n.registerSkillLevelTitle),
        Text(
          l10n.registerSkillLevelHelper,
          style: TextStyle(
            fontSize: 13,
            height: 1.45,
            color: AuthUiPalette.of(context).textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        for (final level in registrationSkillLevels) ...[
          AuthSelectCard(
            label: localizedSkillLevel(l10n, level),
            description: localizedSkillLevelDescription(l10n, level),
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
    final l10n = context.l10n;
    final colors = AuthUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AuthSectionTitle(title: l10n.supplierSupplierType),
        Text(
          l10n.registerSupplierTypeControlsVerification,
          style: TextStyle(
            fontSize: 13,
            height: 1.45,
            color: colors.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        for (final type in registrationSupplierTypes) ...[
          AuthSelectCard(
            label: localizedSupplierType(l10n, type),
            description: localizedSupplierTypeDescription(l10n, type),
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
          l10n.registerSupplierPublicNameHelp,
          style: TextStyle(
            fontSize: 13,
            height: 1.45,
            color: colors.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        AuthTextField(
          controller: _publicNameController,
          label: l10n.registerSupplierDisplayNameOptional,
          hint: _trimmedDisplayName.isEmpty
              ? l10n.registerSupplierUsesFullNameDefault
              : _trimmedDisplayName,
          textInputAction: TextInputAction.next,
          onChanged: (_) => _clearErrors(),
        ),
        const AuthFieldGap(),
        AuthTextArea(
          controller: _descriptionController,
          label: l10n.shortDescriptionOptional,
          hint: l10n.becomeSupplierAboutDescriptionHint,
          minLines: 2,
          maxLines: 4,
          onChanged: (_) => _clearErrors(),
        ),
      ],
    );
  }

  Widget _buildVerificationStep() {
    final l10n = context.l10n;
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
            l10n.registerSupplierNoVerificationRequired,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l10n.registerSupplierNoVerificationBody,
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
                _formError ?? l10n.registerAccountReadyUploadVerification,
          ),
          const SizedBox(height: AppSpacing.md),
        ],
        Text(
          l10n.verificationDocumentUploadHint,
          style: TextStyle(
            fontSize: 13,
            color: colors.textSecondary,
            height: 1.5,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        InputDecorator(
          decoration: InputDecoration(
            labelText: l10n.verificationDocument,
            hintText: l10n.verificationDocumentHint,
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
                  hasFile ? _verificationDocument!.name : l10n.noFileSelected,
                  style: TextStyle(
                    color: hasFile ? colors.textPrimary : colors.textMuted,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              TextButton(
                onPressed: _pickVerificationDocument,
                child: Text(hasFile ? l10n.changeFile : l10n.selectFile),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildReviewStep() {
    final l10n = context.l10n;
    final colors = AuthUiPalette.of(context);
    final draft = ref.watch(registrationDraftProvider);
    final interests = draft.onboardingInterests;
    final goals = draft.onboardingGoals;
    final user = ref.watch(authControllerProvider).user;
    final learnerLocation =
        draft.onboardingCity != null && draft.onboardingCity!.trim().isNotEmpty
        ? formatPickupArea(
            city: draft.onboardingCity!,
            area: draft.onboardingArea ?? '',
          )
        : null;
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
        if (_isAddToExistingAccount) ...[
          if (user != null) ...[
            _ReviewRow(label: l10n.registerReviewAccount, value: user.displayName.trim()),
            _ReviewRow(label: l10n.email, value: user.email.trim()),
          ],
        ] else ...[
          _ReviewRow(label: l10n.registerReviewIntent, value: _intentLabel(_intent)),
          _ReviewRow(label: l10n.registerReviewName, value: _displayNameController.text.trim()),
          _ReviewRow(label: l10n.email, value: _emailController.text.trim()),
        ],
        if (interests.isNotEmpty)
          _ReviewRow(
            label: l10n.registerReviewInterests,
            value: interests
                .map(
                  (interest) => localizedInterestLabel(context, interest),
                )
                .join(', '),
          ),
        if (goals.isNotEmpty)
          _ReviewRow(
            label: l10n.registerReviewGoals,
            value: goals.map((goal) => localizedRegistrationGoal(l10n, goal)).join(', '),
          ),
        if (_isAddToExistingAccount && learnerLocation != null)
          _ReviewRow(label: l10n.registerReviewLocation, value: learnerLocation),
        if (!_isAddToExistingAccount && pickupArea != null)
          _ReviewRow(label: l10n.registerReviewLocation, value: pickupArea),
        if (draft.learnerProfile != null) ...[
          _ReviewRow(
            label: l10n.registerReviewLearnerType,
            value: localizedLearnerType(l10n, draft.learnerProfile!.learnerType),
          ),
          _ReviewRow(
            label: l10n.registerReviewSkillLevel,
            value: localizedSkillLevel(l10n, draft.learnerProfile!.skillLevel),
          ),
        ],
        if (draft.supplierProfile != null) ...[
          _ReviewRow(
            label: l10n.supplierSupplierType,
            value: localizedSupplierType(
              l10n,
              draft.supplierProfile!.supplierType,
            ),
          ),
          _ReviewRow(
            label: l10n.supplierPublicSupplierName,
            value: draft.supplierProfile!.publicName,
          ),
          if (draft.supplierProfile!.description?.isNotEmpty ?? false)
            _ReviewRow(
              label: l10n.description,
              value: draft.supplierProfile!.description!,
            ),
        ],
        if (_needsVerification)
          _ReviewRow(
            label: l10n.verificationDocument,
            value: _verificationDocument?.name ?? l10n.notSelected,
          ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          _reviewHelperText(),
          style: TextStyle(fontSize: 12, color: colors.textMuted, height: 1.4),
        ),
      ],
    );
  }

  String _intentLabel(RegistrationIntent? intent) {
    final l10n = context.l10n;
    return switch (intent) {
      RegistrationIntent.learner => l10n.registerIntentFindMaterials,
      RegistrationIntent.supplier => l10n.shareMaterials,
      RegistrationIntent.both => l10n.registerIntentDoBoth,
      null => '',
    };
  }

  String _intentSetupDescription(RegistrationIntent intent) {
    final l10n = context.l10n;
    return switch (intent) {
      RegistrationIntent.learner => l10n.registerLearnerSetupDescription,
      RegistrationIntent.supplier => l10n.registerSupplierSetupDescription,
      RegistrationIntent.both => l10n.registerBothSupplierSetupDescription,
    };
  }

  String _locationStepHelperText(bool isRequired) {
    final l10n = context.l10n;
    if (!isRequired) {
      return l10n.registerLocationSkipHelper;
    }

    if (_intent == RegistrationIntent.both) {
      return l10n.registerSupplierLocationHelperBoth;
    }

    return l10n.registerSupplierLocationHelper;
  }

  String _reviewHelperText() {
    final l10n = context.l10n;
    if (_isAddToExistingAccount) {
      return l10n.registerAddLearnerReviewHelper;
    }

    return switch (_intent) {
      RegistrationIntent.supplier => l10n.registerSupplierReviewHelper,
      RegistrationIntent.both => l10n.registerBothReviewHelper,
      RegistrationIntent.learner || null => l10n.registerLearnerReviewHelper,
    };
  }

  String _localizedStepTitle(RegistrationWizardStep step) {
    final l10n = context.l10n;
    return switch (step) {
      RegistrationWizardStep.account => l10n.account,
      RegistrationWizardStep.interests => l10n.registerReviewInterests,
      RegistrationWizardStep.goals => l10n.registerReviewGoals,
      RegistrationWizardStep.location => l10n.registerReviewLocation,
      RegistrationWizardStep.learnerBasics => l10n.registerLearnerProfileTitle,
      RegistrationWizardStep.supplierBasics => l10n.supplierProfile,
      RegistrationWizardStep.verification => l10n.supplierVerification,
      RegistrationWizardStep.review => l10n.review,
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
    final l10n = context.l10n;
    final isReview = _currentStep == RegistrationWizardStep.review;
    final isVerificationRetry =
        _currentStep == RegistrationWizardStep.verification &&
        _accountCreated &&
        _verificationPendingRetry;
    final primaryLabel = isReview
        ? (_isAddToExistingAccount
              ? l10n.registerAddLearnerAccess
              : (_accountCreated && _verificationPendingRetry
                    ? l10n.retryVerification
                    : l10n.createAccount))
        : isVerificationRetry
        ? l10n.retryVerification
        : l10n.actionContinue;

    final showBackButton = _stepIndex > 0 || _isAddToExistingAccount;

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
          if (showBackButton) ...[
            const SizedBox(height: AppSpacing.sm),
            AuthOutlinedButton(label: l10n.supplierBack, onPressed: _goBack),
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
      label: context.l10n.registerProgressSemantic(
        currentIndex + 1,
        steps.length,
      ),
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
