import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_inline_error.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/app_text_field.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../../auth/data/models/user.dart';
import '../../application/profile_providers.dart';
import '../../data/models/uploaded_profile_image.dart';
import '../l10n/account_settings_l10n.dart';
import '../widgets/profile_edit_widgets.dart';
import '../widgets/profile_family_page_widgets.dart';
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

  String? get _previewImageUrl {
    if (_removeImage) {
      return null;
    }
    if (_pendingImage != null) {
      return null;
    }
    return _currentImageUrl;
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

  void _cancel() {
    context.popOrGo(accountSettingsRoute);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AccountSettingsL10n.of(context);
    final user = ref.watch(authControllerProvider).user;
    final previewImageUrl = _previewImageUrl;

    return ProfileFamilyPageScaffold(
      title: l10n.editProfile,
      backTooltip: l10n.back,
      backFallbackRoute: accountSettingsRoute,
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ProfileEditPageSubtitle(text: l10n.editProfileSubtitle),
            const SizedBox(height: AppSpacing.md),
            if (user != null)
              ProfileEditIdentityHero(
                user: user,
                displayName: _displayNameController.text,
                imageUrl: previewImageUrl,
                pendingImage: _pendingImage,
              ),
            if (user != null) const SizedBox(height: AppSpacing.md),
            LayoutBuilder(
              builder: (context, constraints) {
                final imageCard = _buildImageCard(l10n, previewImageUrl);
                final formCard = _buildFormCard(l10n);

                if (constraints.maxWidth >= profileFamilyWideBreakpoint) {
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: imageCard),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(child: formCard),
                    ],
                  );
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    imageCard,
                    const SizedBox(height: AppSpacing.md),
                    formCard,
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImageCard(AccountSettingsL10n l10n, String? previewImageUrl) {
    return ProfileFamilySurface(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      child: ProfileImagePicker(
        displayInitial: _initial,
        imageUrl: previewImageUrl,
        pendingImage: _pendingImage,
        isUploading: _isUploading,
        onPickImage: _pickImage,
        onRemoveImage: _removeImageSelection,
        photoLabel: l10n.profilePhoto,
        photoBody: l10n.profilePhotoBody,
        qualityTip: l10n.profilePhotoQualityTip,
        guidelinesTitle: l10n.profilePhotoGuidelinesTitle,
        guidelinesBody: l10n.profilePhotoGuidelinesBody,
        chooseLabel: l10n.choosePhoto,
        uploadingLabel: l10n.uploading,
        removeLabel: l10n.removePhoto,
      ),
    );
  }

  Widget _buildFormCard(AccountSettingsL10n l10n) {
    return ProfileFamilySurface(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ProfileFamilySectionHeading(
            icon: Icons.person_outline_rounded,
            title: l10n.basicInformation,
            subtitle: l10n.basicInformationBody,
          ),
          const SizedBox(height: AppSpacing.lg),
          AppTextField(
            controller: _displayNameController,
            label: l10n.displayName,
            textInputAction: TextInputAction.next,
            errorText: _displayNameError,
            onChanged: (_) => setState(() {}),
            validator: (value) {
              if (value == null || value.trim().length < 2) {
                return l10n.displayNameTooShort;
              }
              return null;
            },
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l10n.displayNameHelper,
            style: AppTextStyles.body(context).copyWith(
              color: AppThemeColors.of(context).textSecondary,
              fontSize: 12.5,
              height: 1.4,
            ),
          ),
          const AppFieldGap(),
          AppTextField(
            controller: _phoneController,
            label: l10n.phone,
            hint: l10n.optional,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
            textDirection: TextDirection.ltr,
            errorText: _phoneError,
            onFieldSubmitted: (_) => _submit(),
          ),
          const SizedBox(height: AppSpacing.sm),
          ProfileEditInfoNotice(message: l10n.phoneVerificationReset),
          if (_formError != null) ...[
            const SizedBox(height: AppSpacing.md),
            AppInlineError(message: _formError!),
          ],
          const SizedBox(height: AppSpacing.lg),
          AppPrimaryButton(
            label: _isSubmitting ? l10n.saving : l10n.saveChanges,
            isLoading: _isSubmitting,
            onPressed: _isSubmitting ? null : _submit,
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton.icon(
              onPressed: _isSubmitting ? null : _cancel,
              style: AppStatusButtonStyle.outlined(
                context,
                AppStatusTone.neutral,
              ),
              icon: const Icon(Icons.arrow_back_rounded, size: 18),
              label: Text(l10n.cancel),
            ),
          ),
        ],
      ),
    );
  }
}
