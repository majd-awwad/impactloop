import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/account_status_presentation.dart';
import '../../../../shared/widgets/app_section_card.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../../auth/data/models/user.dart';
import '../l10n/learner_profile_l10n.dart';
import 'profile_visual_components.dart';

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

class LearnerProfileHubContent extends StatelessWidget {
  const LearnerProfileHubContent({
    super.key,
    required this.user,
    required this.onOpenAccountSettings,
  });

  final User user;
  final VoidCallback onOpenAccountSettings;

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    final phone = user.phone?.trim() ?? '';
    final memberSince = user.createdAt.millisecondsSinceEpoch == 0
        ? null
        : l10n.memberSince(
            MaterialLocalizations.of(context).formatMediumDate(user.createdAt),
          );
    final verificationNotice = resolveAccountVerificationNotice(user);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ProfileIdentityHeroCard(
          user: user,
          fallbackName: l10n.accountFallback,
          roleLabel: l10n.roleLabel(user.activeRole),
          statusLabel: l10n.accountStatusLabel(user.accountStatus),
          statusTone: accountStatusTone(user.accountStatus),
          metadata: [
            _LtrContactValue(value: user.email),
            if (phone.isNotEmpty) _LtrContactValue(value: phone),
            if (memberSince != null) _IdentityMetadataValue(value: memberSince),
          ],
          footer: verificationNotice == null
              ? null
              : AccountVerificationNotice(
                  state: verificationNotice,
                  onOpenPersonalInformation: () =>
                      context.push('/profile/edit'),
                ),
        ),
        const SizedBox(height: AppSpacing.md),
        LearnerProfilePreviewCard(
          profile: user.learnerProfile,
          prompt: resolveLearnerProfilePrompt(user),
          onOpen: () => context.push(learningProfileRoute),
          onEdit: () => context.push(learnerProfileEditRoute),
        ),
        const SizedBox(height: AppSpacing.lg),
        _ProfileSectionLabel(label: l10n.accountSection),
        const SizedBox(height: AppSpacing.sm),
        AppSectionCard(
          padding: EdgeInsets.zero,
          showShadow: false,
          child: ProfileDestinationRow(
            icon: Icons.manage_accounts_outlined,
            title: l10n.accountSettingsDestination,
            subtitle: l10n.accountSettingsDestinationBody,
            onTap: onOpenAccountSettings,
          ),
        ),
      ],
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
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.warningSoft,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.warningBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline_rounded, color: colors.warningText, size: 20),
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
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
                if (actionLabel != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  TextButton(
                    onPressed: onOpenPersonalInformation,
                    style: TextButton.styleFrom(
                      foregroundColor: colors.warningText,
                      minimumSize: const Size(48, 48),
                      padding: EdgeInsets.zero,
                      alignment: AlignmentDirectional.centerStart,
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

class LearnerProfilePreviewCard extends StatelessWidget {
  const LearnerProfilePreviewCard({
    super.key,
    required this.profile,
    required this.prompt,
    required this.onOpen,
    required this.onEdit,
  });

  final LearnerProfile? profile;
  final LearnerProfilePromptState? prompt;
  final VoidCallback onOpen;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final learnerType = profile?.learnerType.trim() ?? '';
    final skillLevel = profile?.skillLevel.trim() ?? '';
    final bio = profile?.bio?.trim() ?? '';
    final interests = _cleanInterests(profile?.interests ?? const <String>[]);
    final hasDetails =
        learnerType.isNotEmpty ||
        skillLevel.isNotEmpty ||
        interests.isNotEmpty ||
        bio.isNotEmpty;
    final visibleInterests = interests.take(4).toList(growable: false);
    final remainingInterests = interests.length - visibleInterests.length;

    return AppSectionCard(
      padding: EdgeInsets.zero,
      showShadow: false,
      child: Semantics(
        button: true,
        label: l10n.openLearningProfile,
        child: InkWell(
          onTap: onOpen,
          borderRadius: AppRadius.lgAll,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ProfileSurfaceHeader(
                      icon: Icons.school_outlined,
                      title: l10n.learnerProfile,
                      subtitle: l10n.learnerProfileDescription,
                      trailing: Icon(
                        Icons.chevron_right_rounded,
                        color: colors.textMuted,
                        textDirection: Directionality.of(context),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    if (!hasDetails)
                      _InlineEmptyValue(
                        icon: Icons.school_outlined,
                        label: l10n.noLearningDetails,
                      )
                    else ...[
                      LayoutBuilder(
                        builder: (context, constraints) => Wrap(
                          spacing: AppSpacing.sm,
                          runSpacing: AppSpacing.sm,
                          children: [
                            if (learnerType.isNotEmpty)
                              _LearningSummaryValue(
                                label: l10n.learnerType,
                                value: l10n.learnerTypeLabel(learnerType),
                                maxWidth: constraints.maxWidth,
                              ),
                            if (skillLevel.isNotEmpty)
                              _LearningSummaryValue(
                                label: l10n.skillLevel,
                                value: l10n.skillLevelLabel(skillLevel),
                                maxWidth: constraints.maxWidth,
                              ),
                          ],
                        ),
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
                        LayoutBuilder(
                          builder: (context, constraints) => Wrap(
                            spacing: AppSpacing.sm,
                            runSpacing: AppSpacing.sm,
                            children: [
                              for (final interest in visibleInterests)
                                ProfileInterestChip(
                                  label: l10n.interestLabel(interest),
                                  maxWidth: constraints.maxWidth,
                                ),
                              if (remainingInterests > 0)
                                ProfileInterestChip(
                                  label: l10n.moreInterests(remainingInterests),
                                  maxWidth: constraints.maxWidth,
                                ),
                            ],
                          ),
                        ),
                      ],
                      if (bio.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          bio,
                          maxLines: 2,
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
              ),
              if (prompt != null) ...[
                const Divider(height: 1),
                _LearnerProfileCompletionStrip(state: prompt!, onEdit: onEdit),
              ],
            ],
          ),
        ),
      ),
    );
  }

  static List<String> _cleanInterests(List<String> raw) {
    final values = <String>[];
    final seen = <String>{};
    for (final interest in raw) {
      final clean = interest.trim();
      if (clean.isNotEmpty && seen.add(clean.toLowerCase())) {
        values.add(clean);
      }
    }
    return values;
  }
}

class _LearnerProfileCompletionStrip extends StatelessWidget {
  const _LearnerProfileCompletionStrip({
    required this.state,
    required this.onEdit,
  });

  final LearnerProfilePromptState state;
  final VoidCallback onEdit;

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

    return Container(
      color: colors.primarySoft.withValues(alpha: 0.58),
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.tune_rounded, color: colors.primary, size: 20),
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
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                TextButton.icon(
                  onPressed: onEdit,
                  style: TextButton.styleFrom(
                    foregroundColor: colors.primary,
                    minimumSize: const Size(48, 48),
                    padding: EdgeInsets.zero,
                    alignment: AlignmentDirectional.centerStart,
                  ),
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: Text(l10n.completeLearningProfile),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LearningSummaryValue extends StatelessWidget {
  const _LearningSummaryValue({
    required this.label,
    required this.value,
    required this.maxWidth,
  });

  final String label;
  final String value;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Container(
      constraints: BoxConstraints(maxWidth: maxWidth),
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: '$label: ',
              style: AppTextStyles.label(
                context,
              ).copyWith(color: colors.textSecondary, fontSize: 12),
            ),
            TextSpan(
              text: value,
              style: AppTextStyles.label(context).copyWith(
                color: colors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InlineEmptyValue extends StatelessWidget {
  const _InlineEmptyValue({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Row(
      children: [
        Icon(icon, color: colors.textMuted, size: 18),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: colors.textSecondary),
          ),
        ),
      ],
    );
  }
}

class _ProfileSectionLabel extends StatelessWidget {
  const _ProfileSectionLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Padding(
      padding: const EdgeInsetsDirectional.only(start: AppSpacing.xs),
      child: Text(
        label,
        style: AppTextStyles.title(
          context,
        ).copyWith(color: colors.textPrimary, fontSize: 17),
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
          maxLines: 2,
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

class _IdentityMetadataValue extends StatelessWidget {
  const _IdentityMetadataValue({required this.value});

  final String value;

  @override
  Widget build(BuildContext context) {
    return Text(
      value,
      style: AppTextStyles.label(
        context,
      ).copyWith(color: AppThemeColors.of(context).textMuted, fontSize: 12),
    );
  }
}
