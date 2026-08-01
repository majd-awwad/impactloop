import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/models/uploaded_profile_image.dart';

const _maxBytes = 5 * 1024 * 1024;
const _allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];

class ProfileImagePicker extends StatelessWidget {
  const ProfileImagePicker({
    super.key,
    required this.displayInitial,
    required this.imageUrl,
    required this.pendingImage,
    required this.isUploading,
    required this.onPickImage,
    required this.onRemoveImage,
  });

  final String displayInitial;
  final String? imageUrl;
  final PendingProfileImage? pendingImage;
  final bool isUploading;
  final VoidCallback onPickImage;
  final VoidCallback onRemoveImage;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    ImageProvider? imageProvider;

    if (pendingImage != null) {
      imageProvider = MemoryImage(
        pendingImage!.bytes is Uint8List
            ? pendingImage!.bytes as Uint8List
            : Uint8List.fromList(pendingImage!.bytes),
      );
    } else if (imageUrl != null && imageUrl!.trim().isNotEmpty) {
      imageProvider = NetworkImage(ApiConfig.resolveMediaUrl(imageUrl!.trim()));
    }

    return Row(
      children: [
        CircleAvatar(
          radius: 36,
          backgroundColor: colors.primarySoft,
          backgroundImage: imageProvider,
          child: imageProvider == null
              ? Text(
                  displayInitial,
                  style: AppTextStyles.title(context).copyWith(
                    color: colors.primary,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                  ),
                )
              : null,
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Profile photo',
                style: AppTextStyles.label(context).copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'JPG, PNG, or WebP up to 5 MB.',
                style: AppTextStyles.label(context).copyWith(
                  color: colors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.xs,
                children: [
                  OutlinedButton.icon(
                    onPressed: isUploading ? null : onPickImage,
                    style: AppStatusButtonStyle.outlined(
                      context,
                      AppStatusTone.primary,
                    ),
                    icon: const Icon(Icons.photo_outlined, size: 18),
                    label: Text(isUploading ? 'Uploading...' : 'Choose photo'),
                  ),
                  if (imageProvider != null)
                    TextButton(
                      onPressed: isUploading ? null : onRemoveImage,
                      style: AppStatusButtonStyle.text(
                        context,
                        AppStatusTone.danger,
                      ),
                      child: const Text('Remove'),
                    ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

Future<PendingProfileImage?> pickProfileImageFile() async {
  final result = await FilePicker.platform.pickFiles(
    type: FileType.custom,
    allowedExtensions: _allowedExtensions,
    withData: true,
    allowMultiple: false,
  );

  if (result == null || result.files.isEmpty) {
    return null;
  }

  final file = result.files.first;
  final bytes = file.bytes;

  if (bytes == null || bytes.isEmpty) {
    throw const ApiException(message: 'Could not read the selected image.');
  }

  if (bytes.length > _maxBytes) {
    throw const ApiException(message: 'The image must be 5 MB or smaller.');
  }

  final extension = (file.extension ?? 'jpg').toLowerCase();
  final mimeType = switch (extension) {
    'png' => 'image/png',
    'webp' => 'image/webp',
    _ => 'image/jpeg',
  };

  return PendingProfileImage(
    bytes: bytes,
    fileName: file.name.isNotEmpty ? file.name : 'profile.$extension',
    mimeType: mimeType,
  );
}

class ProfileEditCard extends StatelessWidget {
  const ProfileEditCard({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: child,
    );
  }
}

class ProfileSubpageScaffold extends StatelessWidget {
  const ProfileSubpageScaffold({
    super.key,
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Scaffold(
      backgroundColor: colors.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.md,
                0,
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => context.popOrGo('/profile'),
                    icon: const Icon(Icons.arrow_back_rounded),
                    tooltip: 'Back',
                  ),
                  Expanded(
                    child: Text(
                      title,
                      style: AppTextStyles.title(
                        context,
                      ).copyWith(color: colors.textPrimary, fontSize: 20),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.xl,
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 720),
                    child: child,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
