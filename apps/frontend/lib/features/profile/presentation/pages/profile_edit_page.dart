import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
      showErrorSnackBar(context, error);
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
      final user = await ref.read(profileRepositoryProvider).updateProfile(
            displayName: _displayNameController.text.trim(),
            phone: phoneUpdate.phone,
            updatePhone: phoneUpdate.updatePhone,
            profileImageUrl: shouldSendImage ? profileImageUrl : null,
            updateProfileImage: shouldSendImage,
          );

      ref.read(authControllerProvider.notifier).syncAuthenticatedUser(user);
      await ref.read(authControllerProvider.notifier).refreshCurrentUser();

      if (!mounted) {
        return;
      }

      showInfoSnackBar(context, 'Profile updated.');
      context.go('/profile');
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
        _formError = 'Could not update your profile. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final previewImageUrl = _removeImage
        ? null
        : (_pendingImage == null ? _currentImageUrl : null);

    return ProfileSubpageScaffold(
      title: 'Edit profile',
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
              ),
              const SizedBox(height: AppSpacing.lg),
              AppTextField(
                controller: _displayNameController,
                label: 'Display name',
                textInputAction: TextInputAction.next,
                errorText: _displayNameError,
                validator: (value) {
                  if (value == null || value.trim().length < 2) {
                    return 'Display name must be at least 2 characters';
                  }
                  return null;
                },
              ),
              const AppFieldGap(),
              AppTextField(
                controller: _phoneController,
                label: 'Phone',
                hint: 'Optional',
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.done,
                errorText: _phoneError,
                onFieldSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: AppSpacing.sm),
              const Text(
                'Saving a new phone number will mark it as not verified.',
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
