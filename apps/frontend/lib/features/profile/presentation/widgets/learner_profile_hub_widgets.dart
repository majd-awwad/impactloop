import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/account_status_presentation.dart';
import '../../../../shared/widgets/app_section_card.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../../auth/data/models/user.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../l10n/learner_profile_l10n.dart';

enum LearnerProfilePromptKind { setup, interests, learningDetails }

enum AccountVerificationNoticeKind {
  emailUnverified,
  phoneMissing,
  phoneUnverified,
}

class AccountVerificationNoticeState {
  const AccountVerificationNoticeState(this.kind);

  final AccountVerificationNoticeKind kind;
}

AccountVerificationNoticeState? resolveAccountVerificationNotice(User user) {
  if (user.emailVerifiedAt == null) {
    return const AccountVerificationNoticeState(
      AccountVerificationNoticeKind.emailUnverified,
    );
  }

  final phone = user.phone?.trim() ?? '';
  if (phone.isEmpty) {
    return const AccountVerificationNoticeState(
      AccountVerificationNoticeKind.phoneMissing,
    );
  }

  if (user.phoneVerifiedAt == null) {
    return const AccountVerificationNoticeState(
      AccountVerificationNoticeKind.phoneUnverified,
    );
  }

  return null;
}

class LearnerProfilePromptState {
  const LearnerProfilePromptState({
    required this.kind,
    this.missingLearnerType = false,
    this.missingSkillLevel = false,
  });

  final LearnerProfilePromptKind kind;
  final bool missingLearnerType;
  final bool missingSkillLevel;
}

LearnerProfilePromptState? resolveLearnerProfilePrompt(User user) {
  final profile = user.learnerProfile;
  if (profile == null) {
    return const LearnerProfilePromptState(
      kind: LearnerProfilePromptKind.setup,
    );
  }

  final interests = profile.interests
      .map((value) => value.trim())
      .where((value) => value.isNotEmpty);
  if (interests.isEmpty) {
    return const LearnerProfilePromptState(
      kind: LearnerProfilePromptKind.interests,
    );
  }

  final missingLearnerType = profile.learnerType.trim().isEmpty;
  final missingSkillLevel = profile.skillLevel.trim().isEmpty;
  if (missingLearnerType || missingSkillLevel) {
    return LearnerProfilePromptState(
      kind: LearnerProfilePromptKind.learningDetails,
      missingLearnerType: missingLearnerType,
      missingSkillLevel: missingSkillLevel,
    );
  }

  return null;
}

class LearnerProfileHubContent extends ConsumerWidget {
  const LearnerProfileHubContent({
    super.key,
    required this.user,
    required this.onOpenAccountSettings,
  });

  final User user;
  final VoidCallback onOpenAccountSettings;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prompt = resolveLearnerProfilePrompt(user);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LearnerIdentityCard(
          user: user,
          onOpenPersonalInformation: () => context.push('/profile/edit'),
        ),
        if (prompt != null) ...[
          const SizedBox(height: AppSpacing.md),
          LearnerProfileActionPrompt(
            state: prompt,
            onPressed: () => context.push(learnerProfileEditRoute),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        LearnerProfilePreviewCard(
          profile: user.learnerProfile,
          onEdit: () => context.push(learningProfileRoute),
        ),
        const SizedBox(height: AppSpacing.md),
        ProfileDestinationsSection(
          onOpenLearningProfile: () => context.push(learningProfileRoute),
          onOpenAccountSettings: onOpenAccountSettings,
        ),
      ],
    );
  }
}

class LearnerIdentityCard extends StatelessWidget {
  const LearnerIdentityCard({
    super.key,
    required this.user,
    required this.onOpenPersonalInformation,
  });

  final User user;
  final VoidCallback onOpenPersonalInformation;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final displayName = user.displayName.trim().isEmpty
        ? l10n.accountFallback
        : user.displayName.trim();
    final phone = user.phone?.trim() ?? '';
    final memberSince = user.createdAt.millisecondsSinceEpoch == 0
        ? null
        : l10n.memberSince(
            MaterialLocalizations.of(context).formatMediumDate(user.createdAt),
          );
    final verificationNotice = resolveAccountVerificationNotice(user);

    return AppSectionCard(
      emphasized: true,
      borderRadius: AppRadius.xlAll,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          UserAvatar(
            displayName: displayName,
            profileImageUrl: user.profileImageUrl,
            radius: 34,
            backgroundColor: colors.primarySoft,
            foregroundColor: colors.primary,
            initialTextStyle: AppTextStyles.title(
              context,
            ).copyWith(color: colors.primary, fontWeight: FontWeight.w800),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  displayName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: colors.textPrimary, fontSize: 21),
                ),
                const SizedBox(height: AppSpacing.xs),
                _LtrContactValue(value: user.email),
                if (phone.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xs),
                  _LtrContactValue(value: phone),
                ],
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    AppStatusBadge(
                      label: l10n.roleLabel(user.activeRole),
                      tone: AppStatusTone.primary,
                    ),
                    AppStatusBadge(
                      label: l10n.accountStatusLabel(user.accountStatus),
                      tone: accountStatusTone(user.accountStatus),
                    ),
                  ],
                ),
                if (memberSince != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    memberSince,
                    style: AppTextStyles.label(
                      context,
                    ).copyWith(color: colors.textMuted, fontSize: 12),
                  ),
                ],
                if (verificationNotice != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  AccountVerificationNotice(
                    state: verificationNotice,
                    onOpenPersonalInformation: onOpenPersonalInformation,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class AccountVerificationNotice extends StatelessWidget {
  const AccountVerificationNotice({
    super.key,
    required this.state,
    required this.onOpenPersonalInformation,
  });

  final AccountVerificationNoticeState state;
  final VoidCallback onOpenPersonalInformation;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final (title, body, actionLabel) = switch (state.kind) {
      AccountVerificationNoticeKind.emailUnverified => (
        l10n.emailNotVerifiedTitle,
        l10n.emailNotVerifiedBody,
        null,
      ),
      AccountVerificationNoticeKind.phoneMissing => (
        l10n.phoneMissingTitle,
        l10n.phoneMissingBody,
        l10n.addPhoneAction,
      ),
      AccountVerificationNoticeKind.phoneUnverified => (
        l10n.phoneNotVerifiedTitle,
        l10n.phoneNotVerifiedBody,
        l10n.reviewPhoneAction,
      ),
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline_rounded, color: colors.textMuted, size: 18),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.textPrimary,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  body,
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    height: 1.35,
                  ),
                ),
                if (actionLabel != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  TextButton(
                    onPressed: onOpenPersonalInformation,
                    style: TextButton.styleFrom(
                      foregroundColor: colors.primary,
                      padding: EdgeInsets.zero,
                      visualDensity: VisualDensity.compact,
                    ),
                    child: Text(actionLabel),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LtrContactValue extends StatelessWidget {
  const _LtrContactValue({required this.value});

  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.left,
          style: AppTextStyles.body(
            context,
          ).copyWith(color: colors.textSecondary, fontSize: 14),
        ),
      ),
    );
  }
}

class LearnerProfileActionPrompt extends StatelessWidget {
  const LearnerProfileActionPrompt({
    super.key,
    required this.state,
    required this.onPressed,
  });

  final LearnerProfilePromptState state;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final (title, body) = switch (state.kind) {
      LearnerProfilePromptKind.setup => (
        l10n.setupProfileTitle,
        l10n.setupProfileBody,
      ),
      LearnerProfilePromptKind.interests => (
        l10n.addInterestsTitle,
        l10n.addInterestsBody,
      ),
      LearnerProfilePromptKind.learningDetails => (
        l10n.addLearningDetailsTitle,
        l10n.missingLearningDetailsBody(
          state.missingLearnerType,
          state.missingSkillLevel,
        ),
      ),
    };

    return AppSectionCard(
      tone: AppStatusTone.primary,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: colors.primarySoft,
              borderRadius: AppRadius.mdAll,
            ),
            child: Icon(Icons.tune_rounded, color: colors.primary, size: 20),
          ),
          const SizedBox(width: AppSpacing.md),
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
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: colors.textSecondary, height: 1.4),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextButton(
                  onPressed: onPressed,
                  style: TextButton.styleFrom(
                    foregroundColor: colors.primary,
                    padding: EdgeInsets.zero,
                    visualDensity: VisualDensity.compact,
                  ),
                  child: Text(l10n.edit),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class LearnerProfilePreviewCard extends StatelessWidget {
  const LearnerProfilePreviewCard({
    super.key,
    required this.profile,
    required this.onEdit,
  });

  final LearnerProfile? profile;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final learnerType = profile?.learnerType.trim() ?? '';
    final skillLevel = profile?.skillLevel.trim() ?? '';
    final bio = profile?.bio?.trim() ?? '';
    final interests = <String>[];
    final seenInterests = <String>{};
    for (final interest in profile?.interests ?? const <String>[]) {
      final clean = interest.trim();
      if (clean.isNotEmpty && seenInterests.add(clean.toLowerCase())) {
        interests.add(clean);
      }
    }
    final hasDetails =
        learnerType.isNotEmpty ||
        skillLevel.isNotEmpty ||
        interests.isNotEmpty ||
        bio.isNotEmpty;
    final visibleInterests = interests.take(4).toList(growable: false);
    final remainingInterests = interests.length - visibleInterests.length;

    return AppSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.learnerProfile,
                      style: AppTextStyles.title(
                        context,
                      ).copyWith(color: colors.textPrimary, fontSize: 18),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l10n.learnerProfileDescription,
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: colors.textSecondary, height: 1.35),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              TextButton(onPressed: onEdit, child: Text(l10n.viewDetails)),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (!hasDetails)
            Text(
              l10n.noLearningDetails,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: colors.textSecondary),
            )
          else ...[
            if (learnerType.isNotEmpty)
              _ProfileInfoRow(
                label: l10n.learnerType,
                value: l10n.learnerTypeLabel(learnerType),
              ),
            if (learnerType.isNotEmpty && skillLevel.isNotEmpty)
              const Divider(height: AppSpacing.lg),
            if (skillLevel.isNotEmpty)
              _ProfileInfoRow(
                label: l10n.skillLevel,
                value: l10n.skillLevelLabel(skillLevel),
              ),
            if (interests.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                l10n.interests,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: colors.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (final interest in visibleInterests)
                    _InterestChip(label: l10n.interestLabel(interest)),
                  if (remainingInterests > 0)
                    _InterestChip(
                      label: l10n.moreInterests(remainingInterests),
                    ),
                ],
              ),
            ],
            if (bio.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                l10n.about,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: colors.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                bio,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: colors.textSecondary, height: 1.45),
              ),
            ] else if (learnerType.isNotEmpty &&
                skillLevel.isNotEmpty &&
                interests.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                l10n.optionalNotAdded,
                style: AppTextStyles.label(context).copyWith(
                  color: colors.textMuted,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _ProfileInfoRow extends StatelessWidget {
  const _ProfileInfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: colors.textSecondary, fontSize: 12),
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: colors.textPrimary, fontWeight: FontWeight.w800),
          ),
        ),
      ],
    );
  }
}

class _InterestChip extends StatelessWidget {
  const _InterestChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.primarySoft,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: colors.primary.withValues(alpha: 0.24)),
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: colors.primary,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class ProfileDestinationsSection extends StatelessWidget {
  const ProfileDestinationsSection({
    super.key,
    required this.onOpenLearningProfile,
    required this.onOpenAccountSettings,
  });

  final VoidCallback onOpenLearningProfile;
  final VoidCallback onOpenAccountSettings;

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    final colors = AppThemeColors.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsetsDirectional.only(
            start: AppSpacing.xs,
            bottom: AppSpacing.sm,
          ),
          child: Text(
            l10n.destinations,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: colors.textSecondary, fontSize: 12),
          ),
        ),
        AppSectionCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              ProfileDestinationTile(
                icon: Icons.school_outlined,
                title: l10n.learningProfileDestination,
                subtitle: l10n.learningProfileDestinationBody,
                onTap: onOpenLearningProfile,
              ),
              const Divider(height: 1),
              ProfileDestinationTile(
                icon: Icons.manage_accounts_outlined,
                title: l10n.accountSettingsDestination,
                subtitle: l10n.accountSettingsDestinationBody,
                onTap: onOpenAccountSettings,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class ProfileDestinationTile extends StatelessWidget {
  const ProfileDestinationTile({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: colors.primarySoft,
                borderRadius: AppRadius.mdAll,
              ),
              child: Icon(icon, color: colors.primary, size: 21),
            ),
            const SizedBox(width: AppSpacing.md),
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
                    subtitle,
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: colors.textSecondary, height: 1.35),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Icon(
              Icons.chevron_right_rounded,
              color: colors.textMuted,
              textDirection: Directionality.of(context),
            ),
          ],
        ),
      ),
    );
  }
}
