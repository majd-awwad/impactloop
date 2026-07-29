import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/account_status_presentation.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_section_card.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../../auth/application/portal_navigation.dart';
import '../../../auth/data/models/user.dart';
import '../l10n/account_settings_l10n.dart';

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
  const AccountIdentitySummaryCard({
    super.key,
    required this.user,
    required this.onEdit,
  });

  final User user;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = AccountSettingsL10n.of(context);
    final displayName = user.displayName.trim().isEmpty
        ? l10n.accountFallback
        : user.displayName.trim();

    return AppSectionCard(
      emphasized: true,
      borderRadius: AppRadius.xlAll,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            label: l10n.avatarLabel,
            image: true,
            child: ExcludeSemantics(
              child: UserAvatar(
                displayName: displayName,
                profileImageUrl: user.profileImageUrl,
                radius: 32,
                backgroundColor: colors.primarySoft,
                foregroundColor: colors.primary,
                initialTextStyle: AppTextStyles.title(
                  context,
                ).copyWith(color: colors.primary, fontWeight: FontWeight.w800),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  displayName,
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: colors.textPrimary, fontSize: 21),
                ),
                const SizedBox(height: AppSpacing.xs),
                AccountLtrValue(value: user.email),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    Semantics(
                      label: l10n.roleLabel(user.activeRole),
                      child: ExcludeSemantics(
                        child: AppStatusBadge(
                          label: l10n.roleLabel(user.activeRole),
                          tone: AppStatusTone.primary,
                        ),
                      ),
                    ),
                    Semantics(
                      label: l10n.accountStatusLabel(user.accountStatus),
                      child: ExcludeSemantics(
                        child: AppStatusBadge(
                          label: l10n.accountStatusLabel(user.accountStatus),
                          tone: accountStatusTone(user.accountStatus),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                TextButton.icon(
                  onPressed: onEdit,
                  style: TextButton.styleFrom(
                    foregroundColor: colors.primary,
                    padding: EdgeInsets.zero,
                    visualDensity: VisualDensity.compact,
                    alignment: AlignmentDirectional.centerStart,
                  ),
                  icon: const Icon(Icons.edit_outlined, size: 17),
                  label: Text(l10n.editPersonalInformation),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class AccountSettingsSection extends StatelessWidget {
  const AccountSettingsSection({
    super.key,
    required this.title,
    required this.children,
    this.note,
  });

  final String title;
  final String? note;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
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
            title,
            style: AppTextStyles.label(context).copyWith(
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        AppSectionCard(
          padding: EdgeInsets.zero,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var index = 0; index < children.length; index++) ...[
                if (index > 0) const Divider(height: 1),
                children[index],
              ],
              if (note != null) ...[
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.md),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.devices_outlined,
                        size: 17,
                        color: colors.textMuted,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          note!,
                          style: AppTextStyles.label(context).copyWith(
                            color: colors.textSecondary,
                            fontWeight: FontWeight.w500,
                            height: 1.35,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
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
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final String? trailingValue;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Semantics(
      button: true,
      enabled: onTap != null,
      label: trailingValue == null ? title : '$title, $trailingValue',
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 64),
          child: Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: colors.primarySoft,
                    borderRadius: AppRadius.mdAll,
                  ),
                  child: Icon(icon, color: colors.primary, size: 20),
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
                      if (subtitle != null) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          subtitle!,
                          style: AppTextStyles.body(
                            context,
                          ).copyWith(color: colors.textSecondary, height: 1.35),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                if (busy)
                  const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else ...[
                  if (trailingValue != null)
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 92),
                      child: Text(
                        trailingValue!,
                        textAlign: TextAlign.end,
                        style: AppTextStyles.label(context).copyWith(
                          color: colors.textSecondary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  const SizedBox(width: AppSpacing.xs),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: colors.textMuted,
                    textDirection: Directionality.of(context),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class AccountPreferenceRow extends StatelessWidget {
  const AccountPreferenceRow({
    super.key,
    required this.icon,
    required this.title,
    required this.currentValue,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String currentValue;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AccountSettingsDestinationRow(
      icon: icon,
      title: title,
      trailingValue: currentValue,
      onTap: onTap,
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
            onTap: busyAction == null ? () => onAction(action) : null,
          ),
      ],
    );
  }

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
      title: l10n.accountState,
      children: [
        AccountVerificationRow(
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
    required this.label,
    required this.value,
    required this.statusLabel,
    required this.tone,
    this.forceLtr = true,
  });

  final String label;
  final String value;
  final String statusLabel;
  final AppStatusTone tone;
  final bool forceLtr;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Semantics(
      label: '$label, $value, $statusLabel',
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: AppTextStyles.label(context).copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                ExcludeSemantics(
                  child: AppStatusBadge(label: statusLabel, tone: tone),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            if (forceLtr)
              AccountLtrValue(value: value)
            else
              Text(
                value,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: colors.textSecondary),
              ),
          ],
        ),
      ),
    );
  }
}

class AccountLtrValue extends StatelessWidget {
  const AccountLtrValue({super.key, required this.value});

  final String value;

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
          style: AppTextStyles.body(
            context,
          ).copyWith(color: AppThemeColors.of(context).textSecondary),
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsetsDirectional.only(
            start: AppSpacing.xs,
            bottom: AppSpacing.sm,
          ),
          child: Text(
            l10n.session,
            style: AppTextStyles.label(context).copyWith(
              color: AppThemeColors.of(context).textSecondary,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: onLogout,
            style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger)
                .copyWith(
                  minimumSize: const WidgetStatePropertyAll(Size(0, 52)),
                  shape: WidgetStatePropertyAll(
                    RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
                  ),
                ),
            icon: isLoggingOut
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.logout_rounded),
            label: Text(isLoggingOut ? l10n.loggingOut : l10n.logout),
          ),
        ),
      ],
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

class AccountPreferenceSelectorSheet<T> extends StatelessWidget {
  const AccountPreferenceSelectorSheet({
    super.key,
    required this.title,
    required this.selectedValue,
    required this.options,
  });

  final String title;
  final T selectedValue;
  final List<AccountPreferenceOption<T>> options;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(
          AppSpacing.md,
          0,
          AppSpacing.md,
          AppSpacing.lg,
        ),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  title,
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: colors.textPrimary, fontSize: 20),
                ),
                const SizedBox(height: AppSpacing.md),
                AppSectionCard(
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      for (var index = 0; index < options.length; index++) ...[
                        if (index > 0) const Divider(height: 1),
                        Semantics(
                          selected: options[index].value == selectedValue,
                          button: true,
                          child: ListTile(
                            minTileHeight: 56,
                            leading: Icon(
                              options[index].icon,
                              color: colors.primary,
                            ),
                            title: Text(options[index].label),
                            trailing: Icon(
                              options[index].value == selectedValue
                                  ? Icons.radio_button_checked_rounded
                                  : Icons.radio_button_off_rounded,
                              color: options[index].value == selectedValue
                                  ? colors.primary
                                  : colors.textMuted,
                            ),
                            onTap: () =>
                                Navigator.of(context).pop(options[index].value),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
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
