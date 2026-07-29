import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/application/app_settings_notifier.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/auth_route_helpers.dart';
import '../../../auth/data/models/user.dart';
import '../../../auth/presentation/widgets/portal_switch_menu.dart';
import '../../../notifications/application/notifications_routes.dart';
import '../l10n/account_settings_l10n.dart';
import '../widgets/account_settings_widgets.dart';
import '../widgets/profile_image_picker.dart';

class AccountSettingsPage extends ConsumerStatefulWidget {
  const AccountSettingsPage({super.key});

  @override
  ConsumerState<AccountSettingsPage> createState() =>
      _AccountSettingsPageState();
}

class _AccountSettingsPageState extends ConsumerState<AccountSettingsPage> {
  bool _isLoggingOut = false;
  AccountRoleActionKind? _busyRoleAction;

  Future<T?> _showPreferenceSelector<T>({
    required String title,
    required T selectedValue,
    required List<AccountPreferenceOption<T>> options,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      useSafeArea: true,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => AccountPreferenceSelectorSheet<T>(
        title: title,
        selectedValue: selectedValue,
        options: options,
      ),
    );
  }

  Future<void> _chooseTheme(ThemeMode current) async {
    final l10n = AccountSettingsL10n.of(context);
    final selected = await _showPreferenceSelector<ThemeMode>(
      title: l10n.chooseAppearance,
      selectedValue: current,
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
    );

    if (selected != null && selected != current) {
      ref.read(appSettingsProvider.notifier).setThemeMode(selected);
    }
  }

  Future<void> _chooseLanguage(String current) async {
    final l10n = AccountSettingsL10n.of(context);
    final selected = await _showPreferenceSelector<String>(
      title: l10n.chooseLanguage,
      selectedValue: current,
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
    );

    if (selected != null && selected != current) {
      ref.read(appSettingsProvider.notifier).setLanguageCode(selected);
    }
  }

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

    return ProfileSubpageScaffold(
      title: l10n.pageTitle,
      backTooltip: l10n.back,
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AccountIdentitySummaryCard(
          user: user,
          onEdit: () => context.push('/profile/edit'),
        ),
        const SizedBox(height: AppSpacing.lg),
        AccountSettingsSection(
          title: l10n.accountDetails,
          children: [
            AccountSettingsDestinationRow(
              icon: Icons.person_outline_rounded,
              title: l10n.personalInformation,
              subtitle: l10n.personalInformationBody,
              onTap: () => context.push('/profile/edit'),
            ),
            AccountSettingsDestinationRow(
              icon: Icons.location_on_outlined,
              title: l10n.savedLocations,
              subtitle: l10n.savedLocationsBody,
              onTap: () => context.push('/profile/locations'),
            ),
            AccountSettingsDestinationRow(
              icon: Icons.lock_outline_rounded,
              title: l10n.security,
              subtitle: l10n.securityBody,
              onTap: () => context.push('/profile/security'),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        AccountSettingsSection(
          title: l10n.appPreferences,
          note: l10n.localPreferencesNote,
          children: [
            AccountPreferenceRow(
              icon: Icons.brightness_6_outlined,
              title: l10n.appearance,
              currentValue: _themeLabel(l10n, settings.themeMode),
              onTap: () => _chooseTheme(settings.themeMode),
            ),
            AccountPreferenceRow(
              icon: Icons.language_rounded,
              title: l10n.language,
              currentValue: settings.languageCode == 'ar'
                  ? l10n.arabic
                  : l10n.english,
              onTap: () => _chooseLanguage(settings.languageCode),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        AccountSettingsSection(
          title: l10n.communication,
          children: [
            AccountSettingsDestinationRow(
              icon: Icons.notifications_none_rounded,
              title: l10n.notifications,
              subtitle: l10n.notificationsBody,
              onTap: () => _openNotifications(user),
            ),
          ],
        ),
        if (!roleAccess.isEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          AccountRoleAccessSection(
            resolution: roleAccess,
            busyAction: _busyRoleAction,
            onAction: (action) => _handleRoleAction(user, action),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        AccountStateCard(user: user),
        const SizedBox(height: AppSpacing.lg),
        AccountSessionSection(
          isLoggingOut: _isLoggingOut,
          onLogout: _isLoggingOut ? null : _logout,
        ),
      ],
    );
  }

  String _themeLabel(AccountSettingsL10n l10n, ThemeMode mode) {
    return switch (mode) {
      ThemeMode.system => l10n.systemTheme,
      ThemeMode.light => l10n.lightTheme,
      ThemeMode.dark => l10n.darkTheme,
    };
  }
}
