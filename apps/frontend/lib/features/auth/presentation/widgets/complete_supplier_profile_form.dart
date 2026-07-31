import 'package:file_picker/file_picker.dart';
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
import '../../application/auth_controller.dart';
import '../../application/auth_navigation.dart';
import '../../application/registration_draft_notifier.dart';
import '../../data/models/become_supplier_request.dart';
import '../../data/models/registration_draft.dart';
import '../../../supplier_portal/application/supplier_verification_access.dart';
import '../../../supplier_portal/data/supplier_verification_api.dart';

const _maxVerificationDocumentBytes = 5 * 1024 * 1024;
const _allowedVerificationExtensions = {'pdf', 'png', 'jpg', 'jpeg'};

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
  PlatformFile? _verificationDocument;
  bool _isSubmitting = false;
  String? _supplierTypeError;
  String? _publicNameError;
  String? _descriptionError;
  String? _pickupAreaError;
  String? _verificationDocumentError;
  String? _formError;

  static const _supplierTypes = [
    'Student supplier',
    'Individual supplier',
    'Workshop',
    'Factory',
    'Educational institution',
  ];

  bool get _isOrganizationSupplier =>
      isOrganizationSupplierInput(_supplierType);

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
      _verificationDocumentError = null;
      _formError = null;
    });
  }

  void _applyServerError(ApiException error) {
    setState(() {
      _supplierTypeError = firstFieldError(error, const [
        'supplierProfile.supplierType',
      ]);
      _publicNameError = firstFieldError(error, const [
        'supplierProfile.publicName',
      ]);
      _descriptionError = firstFieldError(error, const [
        'supplierProfile.description',
      ]);
      _pickupAreaError = firstFieldError(error, const [
        'supplierProfile.pickupArea',
      ]);
      _formError = null;

      if (_supplierTypeError == null &&
          _publicNameError == null &&
          _descriptionError == null &&
          _pickupAreaError == null) {
        _formError = localizedApiErrorMessage(error, context.l10n);
      }
    });
  }

  String? _validateVerificationDocument(PlatformFile? file) {
    if (file == null || file.bytes == null) {
      return 'Verification document is required';
    }

    if (file.size > _maxVerificationDocumentBytes) {
      return 'File must be 5MB or smaller';
    }

    final extension = file.name.split('.').last.toLowerCase();
    if (!_allowedVerificationExtensions.contains(extension)) {
      return 'Allowed file types: PDF, PNG, JPG, JPEG';
    }

    return null;
  }

  Future<void> _pickVerificationDocument() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: _allowedVerificationExtensions.toList(),
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
      }
    });
  }

  String _mimeTypeForFile(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.png')) return 'image/png';
    return 'image/jpeg';
  }

  ({String city, String area}) _parsePickupArea(String pickupArea) {
    final parts = pickupArea
        .split(',')
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty)
        .toList();

    if (parts.isEmpty) {
      throw const FormatException('Pickup area is required');
    }

    final city = parts.first;
    final area = parts.length > 1 ? parts.sublist(1).join(', ') : city;
    return (city: city, area: area);
  }

  Map<String, dynamic> _locationPayload(String pickupArea) {
    final parsed = _parsePickupArea(pickupArea);
    return {
      'country': 'Palestine',
      'city': parsed.city,
      'area': parsed.area,
      'visibility': 'PRIVATE',
      'isApproximate': true,
    };
  }

  Future<void> _handleSubmit() async {
    _clearErrors();

    if (_isOrganizationSupplier) {
      final documentError = _validateVerificationDocument(
        _verificationDocument,
      );
      if (documentError != null) {
        setState(() => _verificationDocumentError = documentError);
        return;
      }
    }

    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);

    final authState = ref.read(authControllerProvider);
    final isAuthenticated = authState.isAuthenticated;

    try {
      if (isAuthenticated) {
        await ref
            .read(authControllerProvider.notifier)
            .becomeSupplier(
              BecomeSupplierRequest(
                supplierType: _supplierType!,
                publicName: _publicNameController.text.trim(),
                description: _descriptionController.text.trim().isEmpty
                    ? null
                    : _descriptionController.text.trim(),
                pickupArea: _pickupAreaController.text.trim(),
              ),
            );
      } else {
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
            _formError =
                'Registration details are incomplete. Please start again.';
          });
          context.go('/register');
          return;
        }

        await ref.read(authControllerProvider.notifier).register(request);
        draftNotifier.clear();
      }

      if (_isOrganizationSupplier) {
        final api = ref.read(supplierVerificationApiProvider);
        final uploaded = await api.uploadDocument(
          bytes: _verificationDocument!.bytes!,
          fileName: _verificationDocument!.name,
          mimeType: _mimeTypeForFile(_verificationDocument!.name),
        );
        final pickupArea = _pickupAreaController.text.trim();
        final location = _locationPayload(pickupArea);
        final apiSupplierType = normalizeSupplierTypeInput(_supplierType)!;

        await api.submitVerification({
          'organizationName': _publicNameController.text.trim(),
          'supplierType': apiSupplierType,
          'description': _descriptionController.text.trim().isEmpty
              ? null
              : _descriptionController.text.trim(),
          'defaultPickupLocation': location,
          'businessLocation': location,
          'verificationDocumentUrl': uploaded.url,
          'verificationDocumentName': uploaded.name,
        });
        await ref.read(authControllerProvider.notifier).refreshCurrentUser();
        if (!mounted) {
          return;
        }
        context.go(supplierVerificationPendingRoute);
        return;
      }

      if (!mounted) {
        return;
      }

      final user = ref.read(authControllerProvider).user;
      context.go(
        user == null ? supplierPortalRoute : postAuthRouteForUser(user),
      );
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
              setState(() {
                _supplierType = value;
                if (!isOrganizationSupplierInput(value)) {
                  _verificationDocument = null;
                  _verificationDocumentError = null;
                }
              });
            },
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Supplier type is required';
              }
              return null;
            },
          ),
          if (_supplierType != null) ...[
            const AppFieldGap(),
            Text(
              isOrganizationSupplierInput(_supplierType)
                  ? 'Organization suppliers are treated as supplier organizations and may need verification before listing materials.'
                  : 'Student and individual suppliers can still switch back to learner mode after setup.',
              style: AppTextStyles.subtitle(context),
            ),
          ],
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
          if (_isOrganizationSupplier) ...[
            const AppFieldGap(),
            const _VerificationDocumentSection(),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Upload a document that proves your organization identity, such as a workshop license, factory document, or university/institution proof.',
              style: AppTextStyles.subtitle(context),
            ),
            const SizedBox(height: AppSpacing.sm),
            _VerificationDocumentField(
              fileName: _verificationDocument?.name,
              errorText: _verificationDocumentError,
              onPick: _pickVerificationDocument,
            ),
          ],
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

class _VerificationDocumentSection extends StatelessWidget {
  const _VerificationDocumentSection();

  @override
  Widget build(BuildContext context) {
    return Text(
      'Verification document',
      style: Theme.of(context).textTheme.titleSmall,
    );
  }
}

class _VerificationDocumentField extends StatelessWidget {
  const _VerificationDocumentField({
    required this.onPick,
    this.fileName,
    this.errorText,
  });

  final VoidCallback onPick;
  final String? fileName;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final hasFile = fileName != null && fileName!.trim().isNotEmpty;

    return InputDecorator(
      decoration: InputDecoration(
        hintText: 'PDF, PNG, JPG, or JPEG (max 5MB)',
        floatingLabelBehavior: FloatingLabelBehavior.always,
        errorText: errorText,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              hasFile ? fileName! : 'No file selected',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: hasFile ? null : Theme.of(context).hintColor,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          TextButton(
            onPressed: onPick,
            child: Text(hasFile ? 'Change file' : 'Select file'),
          ),
        ],
      ),
    );
  }
}
