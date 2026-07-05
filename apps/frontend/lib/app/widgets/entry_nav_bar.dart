import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../application/app_settings_notifier.dart';
import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/auth_dark_text_styles.dart';
import '../theme/app_theme_colors.dart';
import '../../features/auth/application/auth_controller.dart';
import '../../features/auth/application/auth_navigation.dart';
import '../../features/auth/presentation/widgets/portal_switch_menu.dart';
import '../../features/auth/data/models/user.dart';
import '../../shared/widgets/app_feedback.dart';
import '../../shared/widgets/user_avatar.dart';
import 'impact_loop_logo.dart';
import 'nav_pill_menu.dart';

class EntryNavBar extends ConsumerWidget {
  const EntryNavBar({
    super.key,
    this.showSignIn = true,
    this.showCreateAccount = true,
    this.onSignIn,
    this.onCreateAccount,
    this.homeRoute = '/',
    this.trailingActions = const [],
    this.showPhoneAccountMenu = true,
    this.phoneTitle,
  });

  final bool showSignIn;
  final bool showCreateAccount;
  final VoidCallback? onSignIn;
  final VoidCallback? onCreateAccount;
  final String homeRoute;
  final List<Widget> trailingActions;
  final bool showPhoneAccountMenu;
  final String? phoneTitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final viewportWidth = MediaQuery.sizeOf(context).width;
    final isCompact = viewportWidth < 900;
    final isPhone = viewportWidth < 600;
    final useCondensedDesktop = viewportWidth < 1500;
    final settings = ref.watch(appSettingsProvider);
    final authState = ref.watch(authControllerProvider);
    final user = authState.user;
    final isAuthenticated =
        authState.status == AuthStatus.authenticated &&
        authState.isAuthenticated &&
        user != null;
    final effectiveShowSignIn = !isAuthenticated && showSignIn;
    final effectiveShowCreateAccount = !isAuthenticated && showCreateAccount;

    if (isPhone) {
      return Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(
          AppSpacing.md,
          AppSpacing.xs,
          AppSpacing.md,
          0,
        ),
        child: SizedBox(
          height: 52,
          child: _PhoneAppBarLayout(
            showSignIn: effectiveShowSignIn,
            showCreateAccount: effectiveShowCreateAccount,
            onSignIn: onSignIn,
            onCreateAccount: onCreateAccount,
            homeRoute: homeRoute,
            settings: settings,
            user: user,
            isAuthenticated: isAuthenticated,
            isAuthLoading: authState.isLoading,
            ref: ref,
            showAccountMenu: showPhoneAccountMenu,
            phoneTitle: phoneTitle,
          ),
        ),
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = AppThemeColors.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        0,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1530),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: colors.surfaceElevated.withValues(
                alpha: isDark ? 0.96 : 0.97,
              ),
              borderRadius: isPhone ? AppRadius.lgAll : AppRadius.xlAll,
              border: Border.all(
                color: colors.borderSubtle.withValues(alpha: isDark ? 0.72 : 1),
              ),
              boxShadow: [
                BoxShadow(
                  color: colors.shadow.withValues(alpha: isDark ? 0.9 : 0.7),
                  blurRadius: isDark ? 18 : 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: isPhone ? AppSpacing.sm : AppSpacing.lg,
                vertical: isPhone ? AppSpacing.sm : AppSpacing.md,
              ),
              child: isCompact
                  ? _MobileNavLayout(
                      showSignIn: effectiveShowSignIn,
                      showCreateAccount: effectiveShowCreateAccount,
                      onSignIn: onSignIn,
                      onCreateAccount: onCreateAccount,
                      homeRoute: homeRoute,
                      settings: settings,
                      user: user,
                      isAuthenticated: isAuthenticated,
                      isAuthLoading: authState.isLoading,
                      ref: ref,
                      trailingActions: trailingActions,
                    )
                  : _DesktopNavLayout(
                      showSignIn: effectiveShowSignIn,
                      showCreateAccount: effectiveShowCreateAccount,
                      onSignIn: onSignIn,
                      onCreateAccount: onCreateAccount,
                      homeRoute: homeRoute,
                      settings: settings,
                      user: user,
                      isAuthenticated: isAuthenticated,
                      isAuthLoading: authState.isLoading,
                      ref: ref,
                      condensed: useCondensedDesktop,
                      trailingActions: trailingActions,
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PhoneAppBarLayout extends StatelessWidget {
  const _PhoneAppBarLayout({
    required this.showSignIn,
    required this.showCreateAccount,
    required this.onSignIn,
    required this.onCreateAccount,
    required this.homeRoute,
    required this.settings,
    required this.user,
    required this.isAuthenticated,
    required this.isAuthLoading,
    required this.ref,
    required this.showAccountMenu,
    this.phoneTitle,
  });

  final bool showSignIn;
  final bool showCreateAccount;
  final VoidCallback? onSignIn;
  final VoidCallback? onCreateAccount;
  final String homeRoute;
  final AppSettings settings;
  final User? user;
  final bool isAuthenticated;
  final bool isAuthLoading;
  final WidgetRef ref;
  final bool showAccountMenu;
  final String? phoneTitle;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Row(
      children: [
        InkWell(
          onTap: () => context.go(homeRoute),
          borderRadius: AppRadius.mdAll,
          child: const ImpactLoopLogo(compact: true, showWordmark: false),
        ),
        if (phoneTitle != null) ...[
          const SizedBox(width: AppSpacing.sm),
          Text(
            phoneTitle!,
            style: AuthDarkTextStyles.label(context).copyWith(
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
        const Spacer(),
        if (isAuthenticated && user != null && showAccountMenu)
          _AccountMenu(
            user: user!,
            settings: settings,
            ref: ref,
            compact: true,
            isLoggingOut: isAuthLoading,
          )
        else if (!isAuthenticated)
          _GuestMobileMenu(
            showSignIn: showSignIn,
            showCreateAccount: showCreateAccount,
            onSignIn: onSignIn,
            onCreateAccount: onCreateAccount,
            settings: settings,
            ref: ref,
          ),
      ],
    );
  }
}

class _DesktopNavLayout extends StatelessWidget {
  const _DesktopNavLayout({
    required this.showSignIn,
    required this.showCreateAccount,
    required this.onSignIn,
    required this.onCreateAccount,
    required this.homeRoute,
    required this.settings,
    required this.user,
    required this.isAuthenticated,
    required this.isAuthLoading,
    required this.ref,
    required this.condensed,
    required this.trailingActions,
  });

  final bool showSignIn;
  final bool showCreateAccount;
  final VoidCallback? onSignIn;
  final VoidCallback? onCreateAccount;
  final String homeRoute;
  final AppSettings settings;
  final User? user;
  final bool isAuthenticated;
  final bool isAuthLoading;
  final WidgetRef ref;
  final bool condensed;
  final List<Widget> trailingActions;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        InkWell(
          onTap: () => context.go(homeRoute),
          borderRadius: AppRadius.mdAll,
          child: const ImpactLoopLogo(compact: true),
        ),
        if (!condensed) ...[
          const SizedBox(width: AppSpacing.md),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: colors.surfaceMuted,
              borderRadius: AppRadius.pillAll,
              border: Border.all(color: colors.borderSubtle),
            ),
            child: Text(
              'Learn. Reuse. Build.',
              style: AuthDarkTextStyles.body(context).copyWith(
                color: colors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
        SizedBox(width: condensed ? AppSpacing.md : AppSpacing.lg),
        Expanded(
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            child: _NavLinks(compact: condensed),
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        _UtilityPills(settings: settings, ref: ref),
        if (trailingActions.isNotEmpty) ...[
          const SizedBox(width: AppSpacing.sm),
          ...trailingActions,
        ],
        if (isAuthenticated && user != null) ...[
          const SizedBox(width: AppSpacing.sm),
          _AccountMenu(
            user: user!,
            settings: settings,
            ref: ref,
            compact: condensed,
            isLoggingOut: isAuthLoading,
          ),
        ] else if (showSignIn || showCreateAccount) ...[
          const SizedBox(width: AppSpacing.md),
          _ActionCluster(
            showSignIn: showSignIn,
            showCreateAccount: showCreateAccount,
            onSignIn: onSignIn,
            onCreateAccount: onCreateAccount,
          ),
        ],
      ],
    );
  }
}

class _NavLinks extends StatelessWidget {
  const _NavLinks({required this.compact});

  final bool compact;

  static const _items = [
    ('Home', '/home', Icons.home_outlined),
    ('Materials', '/materials', Icons.inventory_2_outlined),
    ('Learning', '/learning', Icons.school_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    var currentPath = '';

    try {
      currentPath = GoRouterState.of(context).uri.path;
    } catch (_) {
      currentPath = '';
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final item in _items) ...[
            _NavLinkPill(
              label: item.$1,
              route: item.$2,
              icon: item.$3,
              compact: compact,
              selected:
                  currentPath == item.$2 ||
                  currentPath.startsWith('${item.$2}/'),
              isDark: isDark,
            ),
            if (item != _items.last) const SizedBox(width: AppSpacing.xs),
          ],
        ],
      ),
    );
  }
}

class _NavLinkPill extends StatelessWidget {
  const _NavLinkPill({
    required this.label,
    required this.route,
    required this.icon,
    required this.compact,
    required this.selected,
    required this.isDark,
  });

  final String label;
  final String route;
  final IconData icon;
  final bool compact;
  final bool selected;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final accent = colors.primary;
    final border = colors.borderSubtle;
    final foreground = selected ? accent : colors.textSecondary;
    final background = selected
        ? accent.withValues(alpha: isDark ? 0.16 : 0.1)
        : Colors.transparent;

    final buttonStyle = TextButton.styleFrom(
      foregroundColor: foreground,
      backgroundColor: background,
      padding: EdgeInsetsDirectional.symmetric(
        horizontal: compact ? AppSpacing.sm : AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
      minimumSize: Size(compact ? 38 : 0, 38),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
      side: selected ? BorderSide(color: border.withValues(alpha: 0.7)) : null,
    );

    if (compact) {
      return Tooltip(
        message: label,
        child: IconButton(
          onPressed: () => context.go(route),
          style: buttonStyle,
          icon: Icon(icon, size: 18),
          color: foreground,
          visualDensity: VisualDensity.compact,
        ),
      );
    }

    return TextButton.icon(
      onPressed: () => context.go(route),
      style: buttonStyle,
      icon: Icon(icon, size: 17),
      label: Text(
        label,
        style: AuthDarkTextStyles.label(context).copyWith(
          color: foreground,
          fontSize: 13,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
        ),
      ),
    );
  }
}

class _MobileNavLayout extends StatelessWidget {
  const _MobileNavLayout({
    required this.showSignIn,
    required this.showCreateAccount,
    required this.onSignIn,
    required this.onCreateAccount,
    required this.homeRoute,
    required this.settings,
    required this.user,
    required this.isAuthenticated,
    required this.isAuthLoading,
    required this.ref,
    required this.trailingActions,
  });

  final bool showSignIn;
  final bool showCreateAccount;
  final VoidCallback? onSignIn;
  final VoidCallback? onCreateAccount;
  final String homeRoute;
  final AppSettings settings;
  final User? user;
  final bool isAuthenticated;
  final bool isAuthLoading;
  final WidgetRef ref;
  final List<Widget> trailingActions;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final showCompactAction = width >= 480;

    return Row(
      children: [
        InkWell(
          onTap: () => context.go(homeRoute),
          borderRadius: AppRadius.mdAll,
          child: const ImpactLoopLogo(compact: true, showWordmark: false),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Align(
            alignment: Alignment.centerRight,
            child: Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.xs,
              crossAxisAlignment: WrapCrossAlignment.center,
              alignment: WrapAlignment.end,
              children: [
                if (isAuthenticated && user != null)
                  _AccountMenu(
                    user: user!,
                    settings: settings,
                    ref: ref,
                    compact: true,
                    isLoggingOut: isAuthLoading,
                  )
                else if (showCompactAction && showCreateAccount)
                  _CompactNavLink(
                    label: 'Create account',
                    onPressed: onCreateAccount ?? () => context.go('/register'),
                  )
                else if (showCompactAction && showSignIn)
                  _CompactNavLink(
                    label: 'Sign in',
                    onPressed: onSignIn ?? () => context.go('/login'),
                  ),
                _UtilityPills(settings: settings, ref: ref, compact: true),
                ...trailingActions,
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _UtilityPills extends StatelessWidget {
  const _UtilityPills({
    required this.settings,
    required this.ref,
    this.compact = false,
  });

  final AppSettings settings;
  final WidgetRef ref;
  final bool compact;

  static const _languageOptions = ['en', 'ar'];

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: compact ? AppSpacing.xs : AppSpacing.sm,
      runSpacing: compact ? AppSpacing.xs : AppSpacing.sm,
      alignment: WrapAlignment.end,
      children: [
        NavPillMenu<ThemeMode>(
          icon: themeModeIcon(settings.themeMode),
          label: themeModeLabel(settings.themeMode),
          items: ThemeMode.values,
          selectedValue: settings.themeMode,
          itemLabel: themeModeLabel,
          onSelected: (mode) {
            ref.read(appSettingsProvider.notifier).setThemeMode(mode);
          },
        ),
        NavPillMenu<String>(
          icon: Icons.language,
          label: languageLabel(settings.languageCode),
          items: _languageOptions,
          selectedValue: settings.languageCode,
          itemLabel: languageLabel,
          onSelected: (code) {
            ref.read(appSettingsProvider.notifier).setLanguageCode(code);
          },
        ),
      ],
    );
  }
}

class _GuestMobileMenu extends StatelessWidget {
  const _GuestMobileMenu({
    required this.showSignIn,
    required this.showCreateAccount,
    required this.onSignIn,
    required this.onCreateAccount,
    required this.settings,
    required this.ref,
  });

  final bool showSignIn;
  final bool showCreateAccount;
  final VoidCallback? onSignIn;
  final VoidCallback? onCreateAccount;
  final AppSettings settings;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return MenuAnchor(
      style: MenuStyle(
        backgroundColor: WidgetStatePropertyAll(colors.surfaceElevated),
        elevation: const WidgetStatePropertyAll(10),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(
            borderRadius: AppRadius.lgAll,
            side: BorderSide(color: colors.borderSubtle),
          ),
        ),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(vertical: AppSpacing.sm),
        ),
      ),
      builder: (context, controller, child) {
        return IconButton.filledTonal(
          tooltip: 'Menu',
          onPressed: () {
            if (controller.isOpen) {
              controller.close();
            } else {
              controller.open();
            }
          },
          icon: const Icon(Icons.menu_rounded),
          style: IconButton.styleFrom(
            backgroundColor: colors.surfaceMuted,
            foregroundColor: colors.textPrimary,
            side: BorderSide(color: colors.borderSubtle),
          ),
        );
      },
      menuChildren: [
        if (showSignIn)
          _AccountMenuItem(
            icon: Icons.login_rounded,
            label: 'Sign in',
            onPressed: onSignIn ?? () => context.go('/login'),
          ),
        if (showCreateAccount)
          _AccountMenuItem(
            icon: Icons.person_add_alt_1_rounded,
            label: 'Create account',
            onPressed: onCreateAccount ?? () => context.go('/register'),
          ),
        if (showSignIn || showCreateAccount) const Divider(height: 1),
        Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Settings',
                style: AuthDarkTextStyles.label(context).copyWith(
                  color: colors.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              _UtilityPills(settings: settings, ref: ref, compact: true),
            ],
          ),
        ),
      ],
    );
  }
}

class _AccountMenu extends StatelessWidget {
  const _AccountMenu({
    required this.user,
    required this.settings,
    required this.ref,
    required this.compact,
    required this.isLoggingOut,
  });

  final User user;
  final AppSettings settings;
  final WidgetRef ref;
  final bool compact;
  final bool isLoggingOut;

  String get _displayName {
    final name = user.displayName.trim();
    return name.isEmpty ? 'Account' : name;
  }

  bool get _isSupplier => user.hasRole('SUPPLIER');

  bool get _isLearner => user.hasRole('LEARNER');

  bool get _isAdmin => userHasAdminRole(user);

  bool get _showLearnerActions => _isLearner && user.isLearnerMode;

  bool get _showSupplierDashboard => _isSupplier && user.isSupplierMode;

  Future<void> _logout(BuildContext context) async {
    final logoutError = await ref
        .read(authControllerProvider.notifier)
        .logout();

    if (!context.mounted) {
      return;
    }

    context.go('/login');

    if (logoutError != null) {
      showInfoSnackBar(
        context,
        'You were signed out locally, but the server could not be reached.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = AppThemeColors.of(context);
    final surface = colors.surfaceElevated;
    final primaryText = colors.textPrimary;
    final secondaryText = colors.textSecondary;
    final border = colors.borderSubtle;
    final accent = colors.primary;

    return MenuAnchor(
      style: MenuStyle(
        backgroundColor: WidgetStatePropertyAll(colors.surfaceElevated),
        elevation: const WidgetStatePropertyAll(10),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(
            borderRadius: AppRadius.lgAll,
            side: BorderSide(color: border),
          ),
        ),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(vertical: AppSpacing.sm),
        ),
      ),
      builder: (context, controller, child) {
        return Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {
              if (controller.isOpen) {
                controller.close();
              } else {
                controller.open();
              }
            },
            borderRadius: AppRadius.pillAll,
            child: Ink(
              height: 42,
              padding: EdgeInsetsDirectional.symmetric(
                horizontal: compact ? AppSpacing.xs : AppSpacing.sm,
              ),
              decoration: BoxDecoration(
                color: surface,
                borderRadius: AppRadius.pillAll,
                border: Border.all(color: controller.isOpen ? accent : border),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  UserAvatar(
                    displayName: _displayName,
                    profileImageUrl: user.profileImageUrl,
                    radius: 15,
                    backgroundColor: accent.withValues(
                      alpha: isDark ? 0.16 : 0.1,
                    ),
                    foregroundColor: accent,
                    initialTextStyle: AuthDarkTextStyles.label(
                      context,
                    ).copyWith(color: accent, fontWeight: FontWeight.w800),
                  ),
                  if (!compact) ...[
                    const SizedBox(width: AppSpacing.sm),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 112),
                      child: Text(
                        _displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AuthDarkTextStyles.label(context).copyWith(
                          color: primaryText,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(width: AppSpacing.xs),
                  Icon(
                    controller.isOpen
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    size: 18,
                    color: secondaryText,
                  ),
                ],
              ),
            ),
          ),
        );
      },
      menuChildren: [
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.md,
          ),
          child: SizedBox(
            width: 280,
            child: Row(
              children: [
                UserAvatar(
                  displayName: _displayName,
                  profileImageUrl: user.profileImageUrl,
                  radius: 22,
                  backgroundColor: accent.withValues(alpha: 0.14),
                  foregroundColor: accent,
                  initialTextStyle: AuthDarkTextStyles.title(
                    context,
                  ).copyWith(color: accent, fontSize: 18),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AuthDarkTextStyles.label(context).copyWith(
                          color: primaryText,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        user.email,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AuthDarkTextStyles.body(
                          context,
                        ).copyWith(color: secondaryText, fontSize: 12),
                      ),
                      Text(
                        activePortalModeLabel(user),
                        style: AuthDarkTextStyles.body(
                          context,
                        ).copyWith(color: accent, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const Divider(height: 1),
        _AccountMenuItem(
          icon: Icons.person_outline_rounded,
          label: 'Profile',
          onPressed: () => context.go('/profile'),
        ),
        if (_showLearnerActions)
          _AccountMenuItem(
            icon: Icons.receipt_long_outlined,
            label: 'My reservations',
            onPressed: () => context.go(learnerReservationsRoute),
          ),
        if (_isAdmin)
          _AccountMenuItem(
            icon: Icons.admin_panel_settings_outlined,
            label: 'Admin Portal',
            onPressed: () => context.go(adminPortalRoute),
          ),
        if (_showSupplierDashboard)
          _AccountMenuItem(
            icon: Icons.dashboard_outlined,
            label: 'Supplier dashboard',
            onPressed: () => context.go('/supplier'),
          ),
        if (!_isSupplier)
          _AccountMenuItem(
            icon: Icons.storefront_outlined,
            label: 'Become a supplier',
            onPressed: () => context.go(supplierEntryRouteForUser(user)),
          ),
        ...PortalSwitchMenuItems.build(
          context: context,
          ref: ref,
          user: user,
          labelStyle: AuthDarkTextStyles.label(
            context,
          ).copyWith(color: primaryText),
          noteStyle: AuthDarkTextStyles.body(
            context,
          ).copyWith(color: secondaryText, fontSize: 12),
        ).map(
          (item) => Padding(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
            ),
            child: item,
          ),
        ),
        const Divider(height: 1),
        Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Settings',
                style: AuthDarkTextStyles.label(context).copyWith(
                  color: secondaryText,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              _UtilityPills(settings: settings, ref: ref, compact: true),
            ],
          ),
        ),
        const Divider(height: 1),
        _AccountMenuItem(
          icon: Icons.logout_rounded,
          label: isLoggingOut ? 'Logging out...' : 'Logout',
          destructive: true,
          onPressed: isLoggingOut ? null : () => _logout(context),
        ),
      ],
    );
  }
}

class _AccountMenuItem extends StatelessWidget {
  const _AccountMenuItem({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final color = destructive ? colors.danger : colors.textPrimary;

    return MenuItemButton(
      onPressed: onPressed,
      leadingIcon: Icon(icon, color: color, size: 20),
      child: Text(
        label,
        style: AuthDarkTextStyles.label(context).copyWith(color: color),
      ),
    );
  }
}

class _ActionCluster extends StatelessWidget {
  const _ActionCluster({
    required this.showSignIn,
    required this.showCreateAccount,
    required this.onSignIn,
    required this.onCreateAccount,
  });

  final bool showSignIn;
  final bool showCreateAccount;
  final VoidCallback? onSignIn;
  final VoidCallback? onCreateAccount;

  @override
  Widget build(BuildContext context) {
    final buttons = [
      if (showSignIn)
        _NavActionButton(
          label: 'Sign in',
          icon: Icons.login_rounded,
          onPressed: onSignIn ?? () => context.go('/login'),
        ),
      if (showCreateAccount)
        _NavActionButton(
          label: 'Create account',
          icon: Icons.arrow_outward_rounded,
          onPressed: onCreateAccount ?? () => context.go('/register'),
          filled: true,
        ),
    ];

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      alignment: WrapAlignment.end,
      children: buttons,
    );
  }
}

class _CompactNavLink extends StatelessWidget {
  const _CompactNavLink({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: colors.textPrimary,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        minimumSize: const Size(0, 32),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      child: Text(
        label,
        style: AuthDarkTextStyles.label(
          context,
        ).copyWith(color: colors.textPrimary, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _NavActionButton extends StatelessWidget {
  const _NavActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.filled = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final accent = colors.primary;
    final textOnAccent = colors.textOnPrimary;
    final primaryText = colors.textPrimary;
    final border = colors.borderSubtle;
    final button = filled
        ? FilledButton.icon(
            onPressed: onPressed,
            style: FilledButton.styleFrom(
              backgroundColor: accent,
              foregroundColor: textOnAccent,
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              minimumSize: const Size(0, 42),
              shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
            ),
            icon: Icon(icon, size: 18),
            label: Text(
              label,
              style: AuthDarkTextStyles.body(
                context,
              ).copyWith(color: textOnAccent, fontWeight: FontWeight.w700),
            ),
          )
        : OutlinedButton.icon(
            onPressed: onPressed,
            style: OutlinedButton.styleFrom(
              foregroundColor: primaryText,
              side: BorderSide(color: border),
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              minimumSize: const Size(0, 42),
              shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
            ),
            icon: Icon(icon, size: 18),
            label: Text(
              label,
              style: AuthDarkTextStyles.body(
                context,
              ).copyWith(color: primaryText, fontWeight: FontWeight.w700),
            ),
          );

    return button;
  }
}
