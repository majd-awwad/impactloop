import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/account_status_presentation.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../../auth/application/portal_navigation.dart';
import '../../../auth/data/models/user.dart';
import '../l10n/account_settings_l10n.dart';
import 'profile_family_page_widgets.dart';

enum AccountRoleActionKind {
  supplierProfile,
  becomeSupplier,
  switchToSupplier,
  switchToLearner,
  becomeLearner,
}

class AccountRoleAccessResolution {
  const AccountRoleAccessResolution({
    this.actions = const <AccountRoleActionKind>[],
    this.showOrganizationRestriction = false,
  });

  final List<AccountRoleActionKind> actions;
  final bool showOrganizationRestriction;

  bool get isEmpty => actions.isEmpty && !showOrganizationRestriction;
}

AccountRoleAccessResolution resolveAccountRoleAccess(User user) {
  if (userHasRestrictedStaffRole(user)) {
    return const AccountRoleAccessResolution();
  }

  final actions = <AccountRoleActionKind>[];

  if (user.isLearnerMode) {
    if (shouldShowBecomeSupplier(user)) {
      actions.add(AccountRoleActionKind.becomeSupplier);
    } else if (shouldShowSwitchToSupplier(user)) {
      actions.add(AccountRoleActionKind.switchToSupplier);
    }
  } else if (user.isSupplierMode && user.hasRole('SUPPLIER')) {
    actions.add(AccountRoleActionKind.supplierProfile);
    if (shouldShowSwitchToLearner(user)) {
      actions.add(AccountRoleActionKind.switchToLearner);
    } else if (shouldShowBecomeLearner(user)) {
      actions.add(AccountRoleActionKind.becomeLearner);
    }
  }

  return AccountRoleAccessResolution(
    actions: actions,
    showOrganizationRestriction: isOrganizationSupplierWithoutLearnerSwitch(
      user,
    ),
  );
}

class AccountIdentitySummaryCard extends StatelessWidget {
  const AccountIdentitySummaryCard({super.key, required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    final l10n = AccountSettingsL10n.of(context);
    final colors = AppThemeColors.of(context);
    final displayName = user.displayName.trim().isEmpty
        ? l10n.accountFallback
        : user.displayName.trim();
    final scale = MediaQuery.textScalerOf(context).scale(1);

    return ProfileFamilyIntroductionSurface(
      padding: EdgeInsetsDirectional.all(
        MediaQuery.sizeOf(context).width < 390 ? AppSpacing.md : AppSpacing.lg,
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final stackIdentity = constraints.maxWidth < 270 || scale >= 1.3;
          final avatar = Semantics(
            image: true,
            label: l10n.avatarLabel(displayName),
            child: ExcludeSemantics(
              child: UserAvatar(
                displayName: displayName,
                profileImageUrl: user.profileImageUrl,
                radius: 34,
                backgroundColor: colors.primarySoft,
                foregroundColor: colors.primary,
                initialTextStyle: AppTextStyles.title(context).copyWith(
                  color: colors.primary,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          );
          final identity = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ProfileFamilyDirectionalText(
                displayName,
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

class AccountSettingsSection extends StatelessWidget {
  const AccountSettingsSection({
    super.key,
    required this.icon,
    required this.title,
    required this.children,
    this.note,
  });

  final IconData icon;
  final String title;
  final String? note;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ProfileFamilySectionHeading(icon: icon, title: title),
        if (children.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          for (var index = 0; index < children.length; index++) ...[
            if (index > 0) const SizedBox(height: AppSpacing.sm),
            children[index],
          ],
        ],
        if (note != null) ...[
          const SizedBox(height: AppSpacing.sm),
          ProfileFamilySurface(
            showShadow: false,
            tone: ProfileFamilyTone.neutral,
            padding: const EdgeInsetsDirectional.all(AppSpacing.sm + 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ExcludeSemantics(
                  child: Icon(
                    Icons.devices_outlined,
                    size: 18,
                    color: colors.textMuted,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    note!,
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
          ),
        ],
      ],
    );
  }
}

class AccountSettingsDestinationRow extends StatelessWidget {
  const AccountSettingsDestinationRow({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    required this.onTap,
    this.trailingValue,
    this.busy = false,
    this.tone = ProfileFamilyTone.neutral,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final String? trailingValue;
  final bool busy;
  final ProfileFamilyTone tone;

  @override
  Widget build(BuildContext context) {
    final l10n = AccountSettingsL10n.of(context);
    final detail = [
      if (subtitle?.trim().isNotEmpty ?? false) subtitle!.trim(),
      if (trailingValue?.trim().isNotEmpty ?? false) trailingValue!.trim(),
    ].join(' ');

    return ProfileFamilyDestinationTile(
      icon: icon,
      title: title,
      subtitle: detail,
      semanticLabel: l10n.destinationSemantics(title, detail),
      onTap: onTap ?? () {},
      enabled: onTap != null,
      busy: busy,
      tone: tone,
    );
  }
}

class AccountInlinePreferenceControl<T> extends StatelessWidget {
  const AccountInlinePreferenceControl({
    super.key,
    required this.icon,
    required this.title,
    required this.selectedValue,
    required this.options,
    required this.onSelected,
  });

  final IconData icon;
  final String title;
  final T selectedValue;
  final List<AccountPreferenceOption<T>> options;
  final ValueChanged<T> onSelected;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = AccountSettingsL10n.of(context);

    return ProfileFamilySurface(
      showShadow: false,
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm + 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              ProfileFamilyIconContainer(
                icon: icon,
                tone: ProfileFamilyTone.primary,
                size: 40,
                iconSize: 20,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  title,
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final option in options)
                Semantics(
                  label: l10n.preferenceOptionSemantics(
                    title,
                    option.label,
                    option.value == selectedValue,
                  ),
                  selected: option.value == selectedValue,
                  button: true,
                  child: ExcludeSemantics(
                    child: ChoiceChip(
                      selected: option.value == selectedValue,
                      onSelected: (_) => onSelected(option.value),
                      avatar: Icon(option.icon, size: 17),
                      label: Text(option.label),
                      showCheckmark: true,
                      checkmarkColor: colors.primary,
                      backgroundColor: colors.surfaceMuted,
                      selectedColor: colors.primarySoft,
                      side: BorderSide(
                        color: option.value == selectedValue
                            ? colors.primary
                            : colors.borderSubtle,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: AppRadius.pillAll,
                      ),
                      materialTapTargetSize: MaterialTapTargetSize.padded,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class AccountRoleAccessSection extends StatelessWidget {
  const AccountRoleAccessSection({
    super.key,
    required this.resolution,
    required this.onAction,
    this.busyAction,
  });

  final AccountRoleAccessResolution resolution;
  final ValueChanged<AccountRoleActionKind> onAction;
  final AccountRoleActionKind? busyAction;

  @override
  Widget build(BuildContext context) {
    final l10n = AccountSettingsL10n.of(context);

    return AccountSettingsSection(
      icon: Icons.switch_account_outlined,
      title: l10n.rolesAndAccess,
      note: resolution.showOrganizationRestriction
          ? l10n.organizationSupplierRestriction
          : null,
      children: [
        for (final action in resolution.actions)
          AccountSettingsDestinationRow(
            icon: _iconFor(action),
            title: _titleFor(l10n, action),
            subtitle: _subtitleFor(l10n, action),
            busy: busyAction == action,
            tone: _toneFor(action),
            onTap: busyAction == null ? () => onAction(action) : null,
          ),
      ],
    );
  }

  ProfileFamilyTone _toneFor(AccountRoleActionKind action) => switch (action) {
    AccountRoleActionKind.supplierProfile => ProfileFamilyTone.blue,
    AccountRoleActionKind.becomeSupplier => ProfileFamilyTone.mint,
    AccountRoleActionKind.switchToSupplier => ProfileFamilyTone.blue,
    AccountRoleActionKind.switchToLearner => ProfileFamilyTone.mint,
    AccountRoleActionKind.becomeLearner => ProfileFamilyTone.mint,
  };

  IconData _iconFor(AccountRoleActionKind action) => switch (action) {
    AccountRoleActionKind.supplierProfile => Icons.storefront_outlined,
    AccountRoleActionKind.becomeSupplier => Icons.add_business_outlined,
    AccountRoleActionKind.switchToSupplier => Icons.swap_horiz_rounded,
    AccountRoleActionKind.switchToLearner => Icons.swap_horiz_rounded,
    AccountRoleActionKind.becomeLearner => Icons.school_outlined,
  };

  String _titleFor(AccountSettingsL10n l10n, AccountRoleActionKind action) =>
      switch (action) {
        AccountRoleActionKind.supplierProfile => l10n.supplierProfile,
        AccountRoleActionKind.becomeSupplier => l10n.becomeSupplier,
        AccountRoleActionKind.switchToSupplier => l10n.switchToSupplier,
        AccountRoleActionKind.switchToLearner => l10n.switchToLearner,
        AccountRoleActionKind.becomeLearner => l10n.becomeLearner,
      };

  String _subtitleFor(AccountSettingsL10n l10n, AccountRoleActionKind action) =>
      switch (action) {
        AccountRoleActionKind.supplierProfile => l10n.supplierProfileBody,
        AccountRoleActionKind.becomeSupplier => l10n.becomeSupplierBody,
        AccountRoleActionKind.switchToSupplier => l10n.switchToSupplierBody,
        AccountRoleActionKind.switchToLearner => l10n.switchToLearnerBody,
        AccountRoleActionKind.becomeLearner => l10n.becomeLearnerBody,
      };
}

class AccountStateCard extends StatelessWidget {
  const AccountStateCard({super.key, required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    final l10n = AccountSettingsL10n.of(context);
    final phone = user.phone?.trim() ?? '';

    return AccountSettingsSection(
      icon: Icons.verified_user_outlined,
      title: l10n.verification,
      children: [
        AccountVerificationRow(
          icon: Icons.email_outlined,
          label: l10n.email,
          value: user.email,
          statusLabel: user.emailVerifiedAt == null
              ? l10n.notVerified
              : l10n.verified,
          tone: user.emailVerifiedAt == null
              ? AppStatusTone.warning
              : AppStatusTone.success,
        ),
        AccountVerificationRow(
          icon: Icons.phone_outlined,
          label: l10n.phone,
          value: phone.isEmpty ? l10n.notAdded : phone,
          forceLtr: phone.isNotEmpty,
          statusLabel: phone.isEmpty
              ? l10n.notAdded
              : user.phoneVerifiedAt == null
              ? l10n.notVerified
              : l10n.verified,
          tone: phone.isEmpty
              ? AppStatusTone.neutral
              : user.phoneVerifiedAt == null
              ? AppStatusTone.warning
              : AppStatusTone.success,
        ),
      ],
    );
  }
}

class AccountVerificationRow extends StatelessWidget {
  const AccountVerificationRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.statusLabel,
    required this.tone,
    this.forceLtr = true,
  });

  final IconData icon;
  final String label;
  final String value;
  final String statusLabel;
  final AppStatusTone tone;
  final bool forceLtr;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = AccountSettingsL10n.of(context);
    final status = AppStatusStyle.of(context, tone);
    final profileTone = switch (tone) {
      AppStatusTone.success => ProfileFamilyTone.success,
      AppStatusTone.warning => ProfileFamilyTone.warning,
      _ => ProfileFamilyTone.neutral,
    };

    return Semantics(
      label: l10n.verificationSemantics(label, value, statusLabel),
      child: ExcludeSemantics(
        child: ProfileFamilySurface(
          showShadow: false,
          tone: profileTone,
          padding: const EdgeInsetsDirectional.all(AppSpacing.sm + 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ProfileFamilyIconContainer(
                icon: icon,
                tone: profileTone,
                size: 40,
                iconSize: 20,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: AppTextStyles.label(context).copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    if (forceLtr)
                      AccountLtrValue(value: value, compact: true)
                    else
                      ProfileFamilyDirectionalText(
                        value,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: colors.textSecondary, fontSize: 13),
                      ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          tone == AppStatusTone.success
                              ? Icons.check_circle_rounded
                              : tone == AppStatusTone.warning
                              ? Icons.error_outline_rounded
                              : Icons.info_outline_rounded,
                          size: 17,
                          color: status.foreground,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Flexible(
                          child: Text(
                            statusLabel,
                            style: AppTextStyles.label(context).copyWith(
                              color: status.foreground,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AccountLtrValue extends StatelessWidget {
  const AccountLtrValue({super.key, required this.value, this.compact = false});

  final String value;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Text(
          value,
          textAlign: TextAlign.left,
          overflow: TextOverflow.ellipsis,
          maxLines: 2,
          style: AppTextStyles.body(context).copyWith(
            color: AppThemeColors.of(context).textSecondary,
            fontSize: compact ? 13 : 15,
          ),
        ),
      ),
    );
  }
}

class AccountSessionSection extends StatelessWidget {
  const AccountSessionSection({
    super.key,
    required this.onLogout,
    required this.isLoggingOut,
  });

  final VoidCallback? onLogout;
  final bool isLoggingOut;

  @override
  Widget build(BuildContext context) {
    final l10n = AccountSettingsL10n.of(context);
    final colors = AppThemeColors.of(context);

    return Semantics(
      label: l10n.logoutSemantics,
      button: true,
      enabled: onLogout != null,
      child: ExcludeSemantics(
        child: SizedBox(
          width: double.infinity,
          height: 52,
          child: OutlinedButton.icon(
            onPressed: onLogout,
            style: OutlinedButton.styleFrom(
              foregroundColor: colors.danger,
              backgroundColor: colors.dangerSoft.withValues(alpha: 0.38),
              side: BorderSide(color: colors.danger.withValues(alpha: 0.62)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            icon: isLoggingOut
                ? SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: colors.danger,
                    ),
                  )
                : const Icon(Icons.logout_rounded),
            label: Text(isLoggingOut ? l10n.loggingOut : l10n.logout),
          ),
        ),
      ),
    );
  }
}

class AccountPreferenceOption<T> {
  const AccountPreferenceOption({
    required this.value,
    required this.label,
    required this.icon,
  });

  final T value;
  final String label;
  final IconData icon;
}

class AccountLogoutConfirmationDialog extends StatelessWidget {
  const AccountLogoutConfirmationDialog({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AccountSettingsL10n.of(context);

    return AppDialogShell(
      title: Text(l10n.logoutTitle),
      content: Text(l10n.logoutBody),
      footer: AppDialogFooter.decision(
        primaryAction: FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
          child: Text(l10n.confirmLogout),
        ),
        secondaryAction: OutlinedButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(l10n.cancel),
        ),
      ),
    );
  }
}
