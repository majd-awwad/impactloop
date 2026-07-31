import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/data/models/user.dart';
import '../../application/profile_providers.dart';
import '../../data/models/uploaded_profile_image.dart';
import '../l10n/account_settings_l10n.dart';
import '../widgets/profile_image_picker.dart';

class ProfileEditPage extends ConsumerStatefulWidget {
  const ProfileEditPage({super.key});

  @override
  ConsumerState<ProfileEditPage> createState() => _ProfileEditPageState();
}

class _ProfileEditPageState extends ConsumerState<ProfileEditPage> {
  final _formKey = GlobalKey<FormState>();
  final _displayNameController = TextEditingController();
  final _phoneController = TextEditingController();
  PendingProfileImage? _pendingImage;
  String? _currentImageUrl;
  bool _removeImage = false;
  bool _isSubmitting = false;
  bool _isUploading = false;
  String? _formError;
  String? _displayNameError;
  String? _phoneError;
  String _initialPhone = '';

  @override
  void initState() {
    super.initState();
    final user = ref.read(authControllerProvider).user;
    _applyUser(user);
  }

  void _applyUser(User? user) {
    _displayNameController.text = user?.displayName.trim() ?? '';
    _initialPhone = user?.phone?.trim() ?? '';
    _phoneController.text = _initialPhone;
    _currentImageUrl = user?.profileImageUrl;
  }

  ({bool updatePhone, String? phone}) _phoneUpdatePayload() {
    final trimmedPhone = _phoneController.text.trim();

    if (trimmedPhone.isEmpty) {
      if (_initialPhone.isNotEmpty) {
        return (updatePhone: true, phone: null);
      }
      return (updatePhone: false, phone: null);
    }

    if (trimmedPhone == _initialPhone) {
      return (updatePhone: false, phone: null);
    }

    return (updatePhone: true, phone: trimmedPhone);
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  String get _initial {
    final name = _displayNameController.text.trim();
    if (name.isEmpty) {
      return 'A';
    }
    return name.characters.first.toUpperCase();
  }

  Future<void> _pickImage() async {
    final l10n = AccountSettingsL10n.of(context);
    try {
      final picked = await pickProfileImageFile();
      if (picked == null) {
        return;
      }

      setState(() {
        _pendingImage = picked;
        _removeImage = false;
      });
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      final message = switch (error.code) {
        'PROFILE_IMAGE_READ_FAILED' => l10n.imageReadFailed,
        'PROFILE_IMAGE_TOO_LARGE' => l10n.imageTooLarge,
        _ => error.displayMessage,
      };
      showErrorSnackBar(context, message);
    }
  }

  void _removeImageSelection() {
    setState(() {
      _pendingImage = null;
      _removeImage = true;
    });
  }

  Future<void> _submit() async {
    if (_isSubmitting) {
      return;
    }

    setState(() {
      _displayNameError = null;
      _phoneError = null;
      _formError = null;
    });

    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    setState(() => _isSubmitting = true);
    final l10n = AccountSettingsL10n.of(context);

    try {
      String? profileImageUrl;
      var shouldSendImage = false;

      if (_pendingImage != null) {
        setState(() => _isUploading = true);
        final uploaded = await ref
            .read(profileRepositoryProvider)
            .uploadProfileImage(_pendingImage!);
        profileImageUrl = uploaded.url;
        shouldSendImage = true;
        setState(() => _isUploading = false);
      } else if (_removeImage) {
        profileImageUrl = null;
        shouldSendImage = true;
      }

      final phoneUpdate = _phoneUpdatePayload();
      final user = await ref
          .read(profileRepositoryProvider)
          .updateProfile(
            displayName: _displayNameController.text.trim(),
            phone: phoneUpdate.phone,
            updatePhone: phoneUpdate.updatePhone,
            profileImageUrl: shouldSendImage ? profileImageUrl : null,
            updateProfileImage: shouldSendImage,
          );

      ref.read(authControllerProvider.notifier).syncAuthenticatedUser(user);
      var accountRefreshFailed = false;
      try {
        await ref.read(authControllerProvider.notifier).refreshCurrentUser();
      } catch (_) {
        accountRefreshFailed = true;
      }

      if (!mounted) {
        return;
      }

      showInfoSnackBar(
        context,
        accountRefreshFailed
            ? l10n.profileSavedRefreshFailed
            : l10n.profileUpdated,
      );
      context.popOrGo('/profile');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _isUploading = false;
        _displayNameError = firstFieldError(error, const ['displayName']);
        _phoneError = firstFieldError(error, const ['phone']);
        _formError = _displayNameError == null && _phoneError == null
            ? error.displayMessage
            : null;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSubmitting = false;
        _isUploading = false;
        _formError = l10n.updateProfileFailed;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AccountSettingsL10n.of(context);
    final previewImageUrl = _removeImage
        ? null
        : (_pendingImage == null ? _currentImageUrl : null);

    return ProfileSubpageScaffold(
      title: l10n.editProfile,
      backTooltip: l10n.back,
      child: ProfileEditCard(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ProfileImagePicker(
                displayInitial: _initial,
                imageUrl: previewImageUrl,
                pendingImage: _pendingImage,
                isUploading: _isUploading,
                onPickImage: _pickImage,
                onRemoveImage: _removeImageSelection,
                photoLabel: l10n.profilePhoto,
                requirementsLabel: l10n.profilePhotoRequirements,
                chooseLabel: l10n.choosePhoto,
                uploadingLabel: l10n.uploading,
                removeLabel: l10n.remove,
              ),
              const SizedBox(height: AppSpacing.lg),
              AppTextField(
                controller: _displayNameController,
                label: l10n.displayName,
                textInputAction: TextInputAction.next,
                errorText: _displayNameError,
                validator: (value) {
                  if (value == null || value.trim().length < 2) {
                    return l10n.displayNameTooShort;
                  }
                  return null;
                },
              ),
              const AppFieldGap(),
              AppTextField(
                controller: _phoneController,
                label: l10n.phone,
                hint: l10n.optional,
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.done,
                errorText: _phoneError,
                onFieldSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(l10n.phoneVerificationReset),
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
        ),
      ),
    );
  }
}
