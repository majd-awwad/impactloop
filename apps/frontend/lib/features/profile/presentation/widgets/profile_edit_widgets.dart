import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/config/api_config.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../auth/data/models/user.dart';
import '../../data/models/uploaded_profile_image.dart';
import '../l10n/account_settings_l10n.dart';
import 'account_settings_widgets.dart';
import 'profile_family_page_widgets.dart';

class ProfileEditPageSubtitle extends StatelessWidget {
  const ProfileEditPageSubtitle({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Text(
      text,
      style: AppTextStyles.body(context).copyWith(
        color: colors.textSecondary,
        fontSize: 14,
        height: 1.45,
      ),
    );
  }
}

class ProfileEditIdentityHero extends StatelessWidget {
  const ProfileEditIdentityHero({
    super.key,
    required this.user,
    required this.displayName,
    this.imageUrl,
    this.pendingImage,
  });

  final User user;
  final String displayName;
  final String? imageUrl;
  final PendingProfileImage? pendingImage;

  @override
  Widget build(BuildContext context) {
    final l10n = AccountSettingsL10n.of(context);
    final colors = AppThemeColors.of(context);
    final name = displayName.trim().isEmpty
        ? l10n.accountFallback
        : displayName.trim();
    final scale = MediaQuery.textScalerOf(context).scale(1);
    final imageProvider = profileEditImageProvider(
      imageUrl: imageUrl,
      pendingImage: pendingImage,
    );

    return ProfileFamilyIntroductionSurface(
      padding: EdgeInsetsDirectional.all(
        MediaQuery.sizeOf(context).width < 390 ? AppSpacing.md : AppSpacing.lg,
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final stackIdentity = constraints.maxWidth < 270 || scale >= 1.3;
          final avatar = Semantics(
            image: true,
            label: l10n.avatarLabel(name),
            child: ExcludeSemantics(
              child: ProfileEditAvatar(
                displayInitial: name.isEmpty
                    ? 'A'
                    : name.characters.first.toUpperCase(),
                imageProvider: imageProvider,
                radius: 34,
              ),
            ),
          );
          final identity = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ProfileFamilyDirectionalText(
                name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.title(context).copyWith(
                  color: colors.textPrimary,
                  fontSize: 23,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              AccountLtrValue(value: user.email, compact: true),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  _ContextBadge(
                    icon: Icons.person_outline_rounded,
                    label: l10n.editPersonalInformation,
                  ),
                ],
              ),
            ],
          );

          if (stackIdentity) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                avatar,
                const SizedBox(height: AppSpacing.md),
                identity,
              ],
            );
          }

          return Row(
            children: [
              avatar,
              const SizedBox(width: AppSpacing.md),
              Expanded(child: identity),
            ],
          );
        },
      ),
    );
  }
}

class ProfileEditAvatar extends StatelessWidget {
  const ProfileEditAvatar({
    super.key,
    required this.displayInitial,
    required this.radius,
    this.imageProvider,
    this.showCameraBadge = false,
  });

  final String displayInitial;
  final double radius;
  final ImageProvider? imageProvider;
  final bool showCameraBadge;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final avatar = CircleAvatar(
      radius: radius,
      backgroundColor: colors.primarySoft,
      backgroundImage: imageProvider,
      child: imageProvider == null
          ? Text(
              displayInitial,
              style: AppTextStyles.title(context).copyWith(
                color: colors.primary,
                fontSize: radius * 0.7,
                fontWeight: FontWeight.w800,
              ),
            )
          : null,
    );

    if (!showCameraBadge) {
      return avatar;
    }

    return SizedBox(
      width: radius * 2,
      height: radius * 2,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          avatar,
          PositionedDirectional(
            end: 0,
            bottom: 0,
            child: ExcludeSemantics(
              child: Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colors.primary,
                  shape: BoxShape.circle,
                  border: Border.all(color: colors.cardSurface, width: 2.5),
                  boxShadow: [
                    BoxShadow(
                      color: colors.shadow.withValues(alpha: 0.16),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Icon(
                  Icons.photo_camera_outlined,
                  size: 16,
                  color: colors.textOnPrimary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ProfileEditInfoNotice extends StatelessWidget {
  const ProfileEditInfoNotice({
    super.key,
    required this.message,
    this.icon = Icons.info_outline_rounded,
    this.tone = ProfileFamilyTone.neutral,
  });

  final String message;
  final IconData icon;
  final ProfileFamilyTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final style = ProfileFamilyToneStyle.of(context, tone);

    return ProfileFamilySurface(
      showShadow: false,
      tone: tone,
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm + 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(
            child: Icon(
              icon,
              size: 18,
              color: tone == ProfileFamilyTone.neutral
                  ? colors.textMuted
                  : style.foreground,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: AppTextStyles.label(context).copyWith(
                color: colors.textSecondary,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ProfileEditGuidelinesBox extends StatelessWidget {
  const ProfileEditGuidelinesBox({
    super.key,
    required this.title,
    required this.body,
  });

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final style = ProfileFamilyToneStyle.of(context, ProfileFamilyTone.mint);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Color.lerp(colors.cardSurface, style.surface, 0.72),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: style.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(
            child: Icon(
              Icons.info_outline_rounded,
              size: 18,
              color: style.foreground,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  body,
                  style: AppTextStyles.body(context).copyWith(
                    color: colors.textSecondary,
                    fontSize: 12.5,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ContextBadge extends StatelessWidget {
  const _ContextBadge({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final style = AppStatusStyle.of(context, AppStatusTone.primary);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm + 2,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: style.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: style.foreground),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: style.foreground,
                fontWeight: FontWeight.w700,
                height: 1.1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

ImageProvider? profileEditImageProvider({
  String? imageUrl,
  PendingProfileImage? pendingImage,
}) {
  if (pendingImage != null) {
    final bytes = pendingImage.bytes is Uint8List
        ? pendingImage.bytes as Uint8List
        : Uint8List.fromList(pendingImage.bytes);
    return MemoryImage(bytes);
  }

  final trimmed = imageUrl?.trim() ?? '';
  if (trimmed.isEmpty) {
    return null;
  }

  return NetworkImage(ApiConfig.resolveMediaUrl(trimmed));
}
