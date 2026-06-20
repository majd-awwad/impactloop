import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../application/app_settings_notifier.dart';
import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/auth_dark_colors.dart';
import '../theme/auth_dark_decorations.dart';
import '../theme/auth_dark_text_styles.dart';
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
  });

  final bool showSignIn;
  final bool showCreateAccount;
  final VoidCallback? onSignIn;
  final VoidCallback? onCreateAccount;
  final String homeRoute;
  final List<Widget> trailingActions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final viewportWidth = MediaQuery.sizeOf(context).width;
    final isCompact = viewportWidth < 900;
    final isPhone = viewportWidth < 640;
    final useCondensedDesktop = viewportWidth < 1700;
    final settings = ref.watch(appSettingsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        0,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1180),
          child: DecoratedBox(
            decoration: (isDark
                    ? AuthDarkDecorations.navBarDecoration
                    : BoxDecoration(
                        color: AppColors.surfaceElevated.withValues(alpha: 0.96),
                        border: const Border(
                          bottom: BorderSide(color: AppColors.border),
                        ),
                      ))
                .copyWith(
              borderRadius: isPhone ? AppRadius.lgAll : AppRadius.xlAll,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.08),
                  blurRadius: 18,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Padding(
              padding: EdgeInsets.all(
                isPhone
                    ? AppSpacing.sm
                    : isCompact
                    ? AppSpacing.md
                    : AppSpacing.lg,
              ),
              child: isCompact
                  ? _MobileNavLayout(
                      showSignIn: showSignIn,
                      showCreateAccount: showCreateAccount,
                      onSignIn: onSignIn,
                      onCreateAccount: onCreateAccount,
                      homeRoute: homeRoute,
                      settings: settings,
                      ref: ref,
                      trailingActions: trailingActions,
                    )
                  : _DesktopNavLayout(
                      showSignIn: showSignIn,
                      showCreateAccount: showCreateAccount,
                      onSignIn: onSignIn,
                      onCreateAccount: onCreateAccount,
                      homeRoute: homeRoute,
                      settings: settings,
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

class _DesktopNavLayout extends StatelessWidget {
  const _DesktopNavLayout({
    required this.showSignIn,
    required this.showCreateAccount,
    required this.onSignIn,
    required this.onCreateAccount,
    required this.homeRoute,
    required this.settings,
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
  final WidgetRef ref;
  final bool condensed;
  final List<Widget> trailingActions;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Row(
      children: [
        InkWell(
          onTap: () => context.go(homeRoute),
          borderRadius: AppRadius.mdAll,
          child: const ImpactLoopLogo(compact: true),
        ),
        if (!condensed) ...[
          const SizedBox(width: AppSpacing.lg),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: isDark
                  ? AuthDarkColors.chipUnselected
                  : AppColors.surfaceContainer,
              borderRadius: AppRadius.pillAll,
              border: Border.all(
                color: isDark ? AuthDarkColors.border : AppColors.border,
              ),
            ),
            child: Text(
              'Learn. Reuse. Build.',
              style: AuthDarkTextStyles.body(context).copyWith(
                color: isDark
                    ? AuthDarkColors.textPrimary
                    : AppColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
        SizedBox(width: condensed ? AppSpacing.sm : AppSpacing.md),
        Flexible(child: _NavLinks(compact: condensed)),
        const Spacer(),
        _UtilityPills(settings: settings, ref: ref),
        if (trailingActions.isNotEmpty) ...[
          const SizedBox(width: AppSpacing.sm),
          ...trailingActions,
        ],
        if (showSignIn || showCreateAccount) ...[
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

    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        for (final item in _items)
          _NavLinkPill(
            label: item.$1,
            route: item.$2,
            icon: item.$3,
            compact: compact,
            selected:
                currentPath == item.$2 || currentPath.startsWith('${item.$2}/'),
            isDark: isDark,
          ),
      ],
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
    final accent = isDark ? AuthDarkColors.accent : AppColors.primary;
    final foreground = selected
        ? accent
        : isDark
        ? AuthDarkColors.textSecondary
        : AppColors.textSecondary;
    final background = selected
        ? accent.withValues(alpha: isDark ? 0.14 : 0.1)
        : Colors.transparent;

    final buttonStyle = TextButton.styleFrom(
      foregroundColor: foreground,
      backgroundColor: background,
      padding: EdgeInsetsDirectional.symmetric(
        horizontal: compact ? AppSpacing.xs : AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      minimumSize: Size(compact ? 34 : 0, 36),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
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
    required this.ref,
    required this.trailingActions,
  });

  final bool showSignIn;
  final bool showCreateAccount;
  final VoidCallback? onSignIn;
  final VoidCallback? onCreateAccount;
  final String homeRoute;
  final AppSettings settings;
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
                if (showCompactAction && showCreateAccount)
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: isDark
            ? AuthDarkColors.textPrimary
            : AppColors.textPrimary,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        minimumSize: const Size(0, 32),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      child: Text(
        label,
        style: AuthDarkTextStyles.label(context).copyWith(
          color: isDark ? AuthDarkColors.textPrimary : AppColors.textPrimary,
          fontWeight: FontWeight.w600,
        ),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = isDark ? AuthDarkColors.accent : AppColors.primary;
    final textOnAccent = isDark
        ? AuthDarkColors.textOnAccent
        : AppColors.textOnBrand;
    final primaryText = isDark
        ? AuthDarkColors.textPrimary
        : AppColors.textPrimary;
    final border = isDark ? AuthDarkColors.border : AppColors.border;
    final button = filled
        ? FilledButton.icon(
            onPressed: onPressed,
            style: FilledButton.styleFrom(
              backgroundColor: accent,
              foregroundColor: textOnAccent,
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.md,
              ),
              minimumSize: const Size(0, 46),
              shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
            ),
            icon: Icon(icon, size: 18),
            label: Text(
              label,
              style: AuthDarkTextStyles.body(context).copyWith(
                color: textOnAccent,
                fontWeight: FontWeight.w700,
              ),
            ),
          )
        : OutlinedButton.icon(
            onPressed: onPressed,
            style: OutlinedButton.styleFrom(
              foregroundColor: primaryText,
              side: BorderSide(color: border),
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.md,
              ),
              minimumSize: const Size(0, 46),
              shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
            ),
            icon: Icon(icon, size: 18),
            label: Text(
              label,
              style: AuthDarkTextStyles.body(context).copyWith(
                color: primaryText,
                fontWeight: FontWeight.w700,
              ),
            ),
          );

    return button;
  }
}
