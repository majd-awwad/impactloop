import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../application/auth_controller.dart';
import '../../data/models/register_request.dart';
import '../../data/models/registration_draft.dart';
import '../models/registration_intent.dart';
import 'dark_auth_buttons.dart';
import 'dark_auth_form_card.dart';
import 'dark_auth_form_fields.dart';
import 'dark_auth_password_field.dart';
import 'dark_auth_text_field.dart';

class UnifiedRegisterForm extends ConsumerStatefulWidget {
  const UnifiedRegisterForm({super.key});

  @override
  ConsumerState<UnifiedRegisterForm> createState() =>
      _UnifiedRegisterFormState();
}

class _UnifiedRegisterFormState extends ConsumerState<UnifiedRegisterForm> {
  final _formKey = GlobalKey<FormState>();
  final _displayNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _interestsController = TextEditingController();
  final _bioController = TextEditingController();
  final _publicNameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _pickupAreaController = TextEditingController();

  RegistrationIntent? _intent;
  String? _learnerType;
  String? _skillLevel;
  String? _supplierType;
  bool _isSubmitting = false;
  String? _intentError;
  String? _formError;
  final Map<String, String> _serverErrors = {};

  static const _intentOptions = [
    (RegistrationIntent.learner, 'Find materials'),
    (RegistrationIntent.supplier, 'Share materials'),
    (RegistrationIntent.both, 'Do both'),
  ];

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

  static const _supplierTypes = [
    'Student supplier',
    'Individual supplier',
    'Workshop',
    'Factory',
    'Educational institution',
  ];

  bool get _showLearnerFields =>
      _intent == RegistrationIntent.learner ||
      _intent == RegistrationIntent.both;

  bool get _showSupplierFields =>
      _intent == RegistrationIntent.supplier ||
      _intent == RegistrationIntent.both;

  @override
  void dispose() {
    _displayNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _interestsController.dispose();
    _bioController.dispose();
    _publicNameController.dispose();
    _descriptionController.dispose();
    _pickupAreaController.dispose();
    super.dispose();
  }

  String? _errorFor(String key) => _serverErrors[key];

  void _clearErrors({String? field, bool clearForm = true}) {
    setState(() {
      if (field == null) {
        _serverErrors.clear();
        _intentError = null;
      } else {
        _serverErrors.remove(field);
        if (field == 'intent') {
          _intentError = null;
        }
      }

      if (clearForm) {
        _formError = null;
      }
    });
  }

  void _applyRegisterError(ApiException error) {
    setState(() {
      _serverErrors.clear();
      _intentError = null;
      _formError = null;

      for (final issue in error.fieldIssues) {
        if (issue.path == 'displayName') {
          _serverErrors['displayName'] = issue.message;
        } else if (issue.path == 'email') {
          _serverErrors['email'] = issue.message;
        } else if (issue.path == 'phone') {
          _serverErrors['phone'] = issue.message;
        } else if (issue.path == 'password') {
          _serverErrors['password'] = issue.message;
        } else if (issue.path == 'roles') {
          _intentError = issue.message;
        } else if (issue.path == 'learnerProfile') {
          _serverErrors['learnerProfile'] = issue.message;
        } else if (issue.path == 'learnerProfile.learnerType') {
          _serverErrors['learnerType'] = issue.message;
        } else if (issue.path == 'learnerProfile.skillLevel') {
          _serverErrors['skillLevel'] = issue.message;
        } else if (issue.path == 'learnerProfile.interests') {
          _serverErrors['interests'] = issue.message;
        } else if (issue.path == 'learnerProfile.bio') {
          _serverErrors['bio'] = issue.message;
        } else if (issue.path == 'supplierProfile') {
          _serverErrors['supplierProfile'] = issue.message;
        } else if (issue.path == 'supplierProfile.supplierType') {
          _serverErrors['supplierType'] = issue.message;
        } else if (issue.path == 'supplierProfile.publicName') {
          _serverErrors['publicName'] = issue.message;
        } else if (issue.path == 'supplierProfile.pickupArea') {
          _serverErrors['pickupArea'] = issue.message;
        } else if (issue.path == 'supplierProfile.description') {
          _serverErrors['description'] = issue.message;
        }
      }

      if (error.code == 'CONFLICT') {
        final message = error.displayMessage;
        if (message.toLowerCase().contains('phone')) {
          _serverErrors['phone'] = message;
        } else {
          _serverErrors['email'] = message;
        }
      } else if (_serverErrors.isEmpty && _intentError == null) {
        _formError = error.displayMessage;
      }
    });
  }

  Future<void> _handleSubmit() async {
    if (_intent == null) {
      setState(() {
        _intentError = 'Please choose how you want to use ImpactLoop.';
        _formError = null;
      });
      return;
    }

    _clearErrors();

    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final request = RegisterRequest.fromFormValues(
        intent: _intent!,
        displayName: _displayNameController.text,
        email: _emailController.text,
        password: _passwordController.text,
        phone: _phoneController.text.trim().isEmpty
            ? null
            : _phoneController.text.trim(),
        learnerProfile: _showLearnerFields
            ? LearnerProfileDraft(
                learnerType: _learnerType!,
                skillLevel: _skillLevel!,
                interests: parseInterestsInput(_interestsController.text),
                bio: _bioController.text.trim().isEmpty
                    ? null
                    : _bioController.text.trim(),
              )
            : null,
        supplierProfile: _showSupplierFields
            ? SupplierProfileDraft(
                supplierType: _supplierType!,
                publicName: _publicNameController.text.trim(),
                description: _descriptionController.text.trim().isEmpty
                    ? null
                    : _descriptionController.text.trim(),
                pickupArea: _pickupAreaController.text.trim(),
              )
            : null,
      );

      await ref.read(authControllerProvider.notifier).register(request);

      if (!mounted) {
        return;
      }

      context.go('/home');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() => _isSubmitting = false);
      _applyRegisterError(error);
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
          Text(
            'How do you want to use ImpactLoop?',
            style: AuthDarkTextStyles.subtitle(context),
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
                    _clearErrors(field: 'intent');
                    setState(() => _intent = option.$1);
                  },
                ),
            ],
          ),
          if (_intentError != null) AppInlineError(message: _intentError!),
          const SizedBox(height: AppSpacing.lg),
          DarkAuthTextField(
            controller: _displayNameController,
            label: 'Full name',
            hint: 'Your name',
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.name],
            errorText: _errorFor('displayName'),
            onChanged: (_) {
              if (_errorFor('displayName') != null || _formError != null) {
                _clearErrors(field: 'displayName');
              }
            },
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Full name is required';
              }
              return null;
            },
          ),
          const DarkAuthFieldGap(),
          DarkAuthTextField(
            controller: _emailController,
            label: 'Email address',
            hint: 'you@example.com',
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.email],
            errorText: _errorFor('email'),
            onChanged: (_) {
              if (_errorFor('email') != null || _formError != null) {
                _clearErrors(field: 'email');
              }
            },
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
          const DarkAuthFieldGap(),
          DarkAuthTextField(
            controller: _phoneController,
            label: 'Phone number (optional)',
            hint: '+970 000 000 000',
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.telephoneNumber],
            errorText: _errorFor('phone'),
            onChanged: (_) {
              if (_errorFor('phone') != null || _formError != null) {
                _clearErrors(field: 'phone');
              }
            },
          ),
          const DarkAuthFieldGap(),
          DarkAuthPasswordField(
            controller: _passwordController,
            label: 'Password',
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.newPassword],
            errorText: _errorFor('password'),
            onChanged: (_) {
              if (_errorFor('password') != null || _formError != null) {
                _clearErrors(field: 'password');
              }
            },
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Password is required';
              }
              return null;
            },
          ),
          const DarkAuthFieldGap(),
          DarkAuthPasswordField(
            controller: _confirmPasswordController,
            label: 'Confirm password',
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.newPassword],
            onChanged: (_) {
              if (_formError != null) {
                _clearErrors();
              }
            },
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
          if (_showLearnerFields) ...[
            const SizedBox(height: AppSpacing.lg),
            const DarkAuthSectionTitle(title: 'Learner profile'),
            if (_errorFor('learnerProfile') != null)
              AppInlineError(message: _errorFor('learnerProfile')!),
            const DarkAuthFieldGap(),
            DarkAuthDropdownField<String>(
              label: 'Learner type',
              hint: 'Select your learner type',
              value: _learnerType,
              errorText: _errorFor('learnerType'),
              items: [
                for (final type in _learnerTypes)
                  DropdownMenuItem(value: type, child: Text(type)),
              ],
              onChanged: (value) {
                _clearErrors(field: 'learnerType');
                setState(() => _learnerType = value);
              },
              validator: (value) {
                if (!_showLearnerFields) {
                  return null;
                }
                if (value == null || value.isEmpty) {
                  return 'Learner type is required';
                }
                return null;
              },
            ),
            const DarkAuthFieldGap(),
            DarkAuthDropdownField<String>(
              label: 'Skill level',
              hint: 'Select your skill level',
              value: _skillLevel,
              errorText: _errorFor('skillLevel'),
              items: [
                for (final level in _skillLevels)
                  DropdownMenuItem(value: level, child: Text(level)),
              ],
              onChanged: (value) {
                _clearErrors(field: 'skillLevel');
                setState(() => _skillLevel = value);
              },
              validator: (value) {
                if (!_showLearnerFields) {
                  return null;
                }
                if (value == null || value.isEmpty) {
                  return 'Skill level is required';
                }
                return null;
              },
            ),
            const DarkAuthFieldGap(),
            DarkAuthTextField(
              controller: _interestsController,
              label: 'Interests (optional)',
              hint: 'Arduino, robotics, electronics',
              textInputAction: TextInputAction.next,
              errorText: _errorFor('interests'),
              onChanged: (_) {
                if (_errorFor('interests') != null || _formError != null) {
                  _clearErrors(field: 'interests');
                }
              },
            ),
            const DarkAuthFieldGap(),
            DarkAuthTextArea(
              controller: _bioController,
              label: 'Bio (optional)',
              hint: 'Tell others a little about your learning goals',
              errorText: _errorFor('bio'),
              onChanged: (_) {
                if (_errorFor('bio') != null || _formError != null) {
                  _clearErrors(field: 'bio');
                }
              },
            ),
          ],
          if (_showSupplierFields) ...[
            const SizedBox(height: AppSpacing.lg),
            const DarkAuthSectionTitle(title: 'Supplier profile'),
            if (_errorFor('supplierProfile') != null)
              AppInlineError(message: _errorFor('supplierProfile')!),
            const DarkAuthFieldGap(),
            DarkAuthDropdownField<String>(
              label: 'Supplier type',
              hint: 'Select your supplier type',
              value: _supplierType,
              errorText: _errorFor('supplierType'),
              items: [
                for (final type in _supplierTypes)
                  DropdownMenuItem(value: type, child: Text(type)),
              ],
              onChanged: (value) {
                _clearErrors(field: 'supplierType');
                setState(() => _supplierType = value);
              },
              validator: (value) {
                if (!_showSupplierFields) {
                  return null;
                }
                if (value == null || value.isEmpty) {
                  return 'Supplier type is required';
                }
                return null;
              },
            ),
            const DarkAuthFieldGap(),
            DarkAuthTextField(
              controller: _publicNameController,
              label: 'Public name',
              hint: 'How others will see you',
              textInputAction: TextInputAction.next,
              errorText: _errorFor('publicName'),
              onChanged: (_) {
                if (_errorFor('publicName') != null || _formError != null) {
                  _clearErrors(field: 'publicName');
                }
              },
              validator: (value) {
                if (!_showSupplierFields) {
                  return null;
                }
                if (value == null || value.trim().isEmpty) {
                  return 'Public name is required';
                }
                return null;
              },
            ),
            const DarkAuthFieldGap(),
            DarkAuthTextField(
              controller: _pickupAreaController,
              label: 'Pickup area / location',
              hint: 'Nablus, Rafidia',
              textInputAction: TextInputAction.next,
              errorText: _errorFor('pickupArea'),
              onChanged: (_) {
                if (_errorFor('pickupArea') != null || _formError != null) {
                  _clearErrors(field: 'pickupArea');
                }
              },
              validator: (value) {
                if (!_showSupplierFields) {
                  return null;
                }
                if (value == null || value.trim().isEmpty) {
                  return 'Pickup area is required';
                }
                return null;
              },
            ),
            const DarkAuthFieldGap(),
            DarkAuthTextArea(
              controller: _descriptionController,
              label: 'Short description (optional)',
              hint: 'What kinds of materials do you usually share?',
              minLines: 2,
              maxLines: 4,
              errorText: _errorFor('description'),
              onChanged: (_) {
                if (_errorFor('description') != null || _formError != null) {
                  _clearErrors(field: 'description');
                }
              },
            ),
          ],
          if (_formError != null) ...[
            const SizedBox(height: AppSpacing.md),
            AppInlineError(message: _formError!),
          ],
          const SizedBox(height: AppSpacing.lg),
          DarkAuthPrimaryButton(
            label: 'Create account',
            isLoading: _isSubmitting,
            onPressed: _handleSubmit,
          ),
        ],
      ),
    );
  }
}
