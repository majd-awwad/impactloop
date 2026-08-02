import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/notification_bell_button.dart';
import '../../data/models/uploaded_profile_image.dart';
import 'profile_edit_widgets.dart';
import 'profile_family_page_widgets.dart';

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
    required this.photoLabel,
    required this.photoBody,
    required this.qualityTip,
    required this.guidelinesTitle,
    required this.guidelinesBody,
    required this.chooseLabel,
    required this.uploadingLabel,
    required this.removeLabel,
  });

  final String displayInitial;
  final String? imageUrl;
  final PendingProfileImage? pendingImage;
  final bool isUploading;
  final VoidCallback onPickImage;
  final VoidCallback onRemoveImage;
  final String photoLabel;
  final String photoBody;
  final String qualityTip;
  final String guidelinesTitle;
  final String guidelinesBody;
  final String chooseLabel;
  final String uploadingLabel;
  final String removeLabel;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final imageProvider = profileEditImageProvider(
      imageUrl: imageUrl,
      pendingImage: pendingImage,
    );
    final hasImage = imageProvider != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ProfileFamilySectionHeading(
          icon: Icons.photo_camera_outlined,
          title: photoLabel,
          subtitle: photoBody,
        ),
        const SizedBox(height: AppSpacing.lg),
        Center(
          child: ProfileEditAvatar(
            displayInitial: displayInitial,
            imageProvider: imageProvider,
            radius: 56,
            showCameraBadge: true,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          qualityTip,
          textAlign: TextAlign.center,
          style: AppTextStyles.body(
            context,
          ).copyWith(color: colors.textSecondary, fontSize: 13, height: 1.4),
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            OutlinedButton.icon(
              onPressed: isUploading ? null : onPickImage,
              style: AppStatusButtonStyle.outlined(
                context,
                AppStatusTone.primary,
              ),
              icon: const Icon(Icons.image_outlined, size: 18),
              label: Text(isUploading ? uploadingLabel : chooseLabel),
            ),
            if (hasImage)
              OutlinedButton.icon(
                onPressed: isUploading ? null : onRemoveImage,
                style: AppStatusButtonStyle.outlined(
                  context,
                  AppStatusTone.danger,
                ),
                icon: const Icon(Icons.delete_outline_rounded, size: 18),
                label: Text(removeLabel),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        ProfileEditGuidelinesBox(title: guidelinesTitle, body: guidelinesBody),
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
    throw const ApiException(
      message: 'Could not read the selected image.',
      code: 'PROFILE_IMAGE_READ_FAILED',
    );
  }

  if (bytes.length > _maxBytes) {
    throw const ApiException(
      message: 'The image must be 5 MB or smaller.',
      code: 'PROFILE_IMAGE_TOO_LARGE',
    );
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
    this.backFallbackRoute = '/profile',
    this.backTooltip = 'Back',
    this.headerAction,
    this.showNotificationBell = true,
  });

  final String title;
  final Widget child;
  final String backFallbackRoute;
  final String backTooltip;
  final Widget? headerAction;
  final bool showNotificationBell;

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
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 720),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: () => context.popOrGo(backFallbackRoute),
                        icon: const Icon(Icons.arrow_back_rounded),
                        tooltip: backTooltip,
                      ),
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.title(
                            context,
                          ).copyWith(color: colors.textPrimary, fontSize: 20),
                        ),
                      ),
                      if (headerAction != null) ...[
                        const SizedBox(width: AppSpacing.sm),
                        headerAction!,
                      ],
                      if (showNotificationBell) ...[
                        const SizedBox(width: AppSpacing.xs),
                        const NotificationBellButton(compact: true),
                      ],
                    ],
                  ),
                ),
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
