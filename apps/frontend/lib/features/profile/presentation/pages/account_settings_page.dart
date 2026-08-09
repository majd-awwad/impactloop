import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/application/app_settings_notifier.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../../auth/application/portal_navigation.dart';
import '../../../auth/data/models/user.dart';
import '../../../auth/presentation/widgets/portal_switch_menu.dart';
import '../../../notifications/application/notifications_routes.dart';
import '../l10n/account_settings_l10n.dart';
import '../widgets/account_settings_widgets.dart';
import '../widgets/profile_family_page_widgets.dart';

class AccountSettingsPage extends ConsumerStatefulWidget {
  const AccountSettingsPage({super.key});

  @override
  ConsumerState<AccountSettingsPage> createState() =>
      _AccountSettingsPageState();
}

class _AccountSettingsPageState extends ConsumerState<AccountSettingsPage> {
  bool _isLoggingOut = false;
  AccountRoleActionKind? _busyRoleAction;

  void _openNotifications(User user) {
    final route = notificationInboxRouteForUser(user);
    if (user.isDriverMode && user.hasRole('DRIVER')) {
      context.go(route);
      return;
    }
    context.push(route);
  }

  Future<void> _handleRoleAction(
    User user,
    AccountRoleActionKind action,
  ) async {
    if (_busyRoleAction != null) {
      return;
    }

    switch (action) {
      case AccountRoleActionKind.supplierProfile:
        context.push(supplierEntryRouteForUser(user));
        return;
      case AccountRoleActionKind.becomeSupplier:
        context.push(becomeSupplierRoute);
        return;
      case AccountRoleActionKind.becomeLearner:
        context.push(becomeLearnerRoute);
        return;
      case AccountRoleActionKind.switchToSupplier:
      case AccountRoleActionKind.switchToLearner:
        break;
    }

    setState(() => _busyRoleAction = action);
    final targetRole = action == AccountRoleActionKind.switchToSupplier
        ? 'SUPPLIER'
        : 'LEARNER';

    await handlePortalRoleSwitch(
      context: context,
      ref: ref,
      targetRole: targetRole,
      failureMessage: AccountSettingsL10n.of(context).portalSwitchFailed,
    );

    if (mounted) {
      setState(() => _busyRoleAction = null);
    }
  }

  Future<void> _logout() async {
    if (_isLoggingOut) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => const AccountLogoutConfirmationDialog(),
    );
    if (confirmed != true || !mounted) {
      return;
    }

    final router = GoRouter.of(context);
    final warning = AccountSettingsL10n.of(context).localLogoutWarning;
    setState(() => _isLoggingOut = true);
    final logoutError = await ref
        .read(authControllerProvider.notifier)
        .logout();

    if (!mounted) {
      return;
    }

    if (logoutError != null) {
      showInfoSnackBar(context, warning);
    }
    router.go(loginRoute);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AccountSettingsL10n.of(context);
    final user = ref.watch(authControllerProvider).user;
    final settings = ref.watch(appSettingsProvider);

    return ProfileFamilyPageScaffold(
      title: l10n.pageTitle,
      backFallbackRoute: user == null
          ? profileRoute
          : profileRouteForActiveRole(user),
      child: user == null
          ? AppEmptyStateCard(
              icon: Icons.manage_accounts_outlined,
              title: l10n.pageTitle,
              subtitle: l10n.accountUnavailable,
              compact: true,
            )
          : _buildContent(context, user, settings, l10n),
    );
  }

  Widget _buildContent(
    BuildContext context,
    User user,
    AppSettings settings,
    AccountSettingsL10n l10n,
  ) {
    final roleAccess = resolveAccountRoleAccess(user);
    final essentials = AccountSettingsSection(
      icon: Icons.manage_accounts_outlined,
      title: l10n.accountEssentials,
      children: [
        AccountSettingsDestinationRow(
          icon: Icons.person_outline_rounded,
          title: l10n.personalInformation,
          subtitle: l10n.personalInformationBody,
          tone: ProfileFamilyTone.mint,
          onTap: () => context.push('/profile/edit'),
        ),
        AccountSettingsDestinationRow(
          icon: Icons.location_on_outlined,
          title: l10n.savedLocations,
          subtitle: l10n.savedLocationsBody,
          tone: ProfileFamilyTone.blue,
          onTap: () => context.push('/profile/locations'),
        ),
        AccountSettingsDestinationRow(
          icon: Icons.lock_outline_rounded,
          title: l10n.security,
          subtitle: l10n.securityBody,
          tone: ProfileFamilyTone.amber,
          onTap: () => context.push('/profile/security'),
        ),
      ],
    );
    final verification = AccountStateCard(user: user);
    final preferences = AccountSettingsSection(
      icon: Icons.tune_rounded,
      title: l10n.appPreferences,
      note: l10n.localPreferencesNote,
      children: [
        AccountInlinePreferenceControl<ThemeMode>(
          icon: Icons.brightness_6_outlined,
          title: l10n.appearance,
          selectedValue: settings.themeMode,
          options: [
            AccountPreferenceOption(
              value: ThemeMode.system,
              label: l10n.systemTheme,
              icon: Icons.brightness_auto_outlined,
            ),
            AccountPreferenceOption(
              value: ThemeMode.light,
              label: l10n.lightTheme,
              icon: Icons.light_mode_outlined,
            ),
            AccountPreferenceOption(
              value: ThemeMode.dark,
              label: l10n.darkTheme,
              icon: Icons.dark_mode_outlined,
            ),
          ],
          onSelected: (value) =>
              ref.read(appSettingsProvider.notifier).setThemeMode(value),
        ),
        AccountInlinePreferenceControl<String>(
          icon: Icons.language_rounded,
          title: l10n.language,
          selectedValue: settings.languageCode,
          options: [
            AccountPreferenceOption(
              value: 'en',
              label: l10n.english,
              icon: Icons.translate_rounded,
            ),
            AccountPreferenceOption(
              value: 'ar',
              label: l10n.arabic,
              icon: Icons.translate_rounded,
            ),
          ],
          onSelected: (value) =>
              ref.read(appSettingsProvider.notifier).setLanguageCode(value),
        ),
        AccountSettingsDestinationRow(
          icon: Icons.notifications_none_rounded,
          title: l10n.notifications,
          subtitle: l10n.notificationsBody,
          tone: ProfileFamilyTone.blue,
          onTap: () => _openNotifications(user),
        ),
      ],
    );
    final role = roleAccess.isEmpty
        ? null
        : AccountRoleAccessSection(
            resolution: roleAccess,
            busyAction: _busyRoleAction,
            onAction: (action) => _handleRoleAction(user, action),
          );
    final session = AccountSessionSection(
      isLoggingOut: _isLoggingOut,
      onLogout: _isLoggingOut ? null : _logout,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AccountIdentitySummaryCard(user: user),
        const SizedBox(height: AppSpacing.md),
        LayoutBuilder(
          builder: (context, constraints) {
            if (constraints.maxWidth >= profileFamilyWideBreakpoint) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        essentials,
                        const SizedBox(height: AppSpacing.md),
                        verification,
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        preferences,
                        if (role != null) ...[
                          const SizedBox(height: AppSpacing.md),
                          role,
                        ],
                        const SizedBox(height: AppSpacing.lg),
                        session,
                      ],
                    ),
                  ),
                ],
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                essentials,
                const SizedBox(height: AppSpacing.md),
                verification,
                const SizedBox(height: AppSpacing.md),
                preferences,
                if (role != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  role,
                ],
                const SizedBox(height: AppSpacing.lg),
                session,
              ],
            );
          },
        ),
      ],
    );
  }
}
