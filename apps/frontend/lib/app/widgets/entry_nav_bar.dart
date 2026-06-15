import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../application/app_settings_notifier.dart';
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
  });

  final bool showSignIn;
  final bool showCreateAccount;
  final VoidCallback? onSignIn;
  final VoidCallback? onCreateAccount;
  final String homeRoute;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final viewportWidth = MediaQuery.sizeOf(context).width;
    final isCompact = viewportWidth < 900;
    final useCondensedDesktop = viewportWidth < 1320;
    final settings = ref.watch(appSettingsProvider);

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
            decoration: AuthDarkDecorations.navBarDecoration.copyWith(
              borderRadius: AppRadius.xlAll,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.18),
                  blurRadius: 18,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Padding(
              padding: EdgeInsets.all(
                isCompact ? AppSpacing.md : AppSpacing.lg,
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
  });

  final bool showSignIn;
  final bool showCreateAccount;
  final VoidCallback? onSignIn;
  final VoidCallback? onCreateAccount;
  final String homeRoute;
  final AppSettings settings;
  final WidgetRef ref;
  final bool condensed;

  @override
  Widget build(BuildContext context) {
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
              color: AuthDarkColors.chipUnselected,
              borderRadius: AppRadius.pillAll,
              border: Border.all(color: AuthDarkColors.border),
            ),
            child: Text(
              'Learn. Reuse. Build.',
              style: AuthDarkTextStyles.body(context).copyWith(
                color: AuthDarkColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
        const Spacer(),
        _UtilityPills(settings: settings, ref: ref),
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

class _MobileNavLayout extends StatelessWidget {
  const _MobileNavLayout({
    required this.showSignIn,
    required this.showCreateAccount,
    required this.onSignIn,
    required this.onCreateAccount,
    required this.homeRoute,
    required this.settings,
    required this.ref,
  });

  final bool showSignIn;
  final bool showCreateAccount;
  final VoidCallback? onSignIn;
  final VoidCallback? onCreateAccount;
  final String homeRoute;
  final AppSettings settings;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            InkWell(
              onTap: () => context.go(homeRoute),
              borderRadius: AppRadius.mdAll,
              child: const ImpactLoopLogo(
                compact: true,
                showWordmark: false,
              ),
            ),
            const Spacer(),
            _UtilityPills(settings: settings, ref: ref),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Learn. Reuse. Build.',
          style: AuthDarkTextStyles.body(context).copyWith(
            color: AuthDarkColors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (showSignIn || showCreateAccount) ...[
          const SizedBox(height: AppSpacing.md),
          _ActionCluster(
            showSignIn: showSignIn,
            showCreateAccount: showCreateAccount,
            onSignIn: onSignIn,
            onCreateAccount: onCreateAccount,
            compact: true,
          ),
        ],
      ],
    );
  }
}

class _UtilityPills extends StatelessWidget {
  const _UtilityPills({
    required this.settings,
    required this.ref,
  });

  final AppSettings settings;
  final WidgetRef ref;

  static const _languageOptions = ['en', 'ar'];

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
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
    this.compact = false,
  });

  final bool showSignIn;
  final bool showCreateAccount;
  final VoidCallback? onSignIn;
  final VoidCallback? onCreateAccount;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final buttons = [
      if (showSignIn)
        _NavActionButton(
          label: 'Sign in',
          icon: Icons.login_rounded,
          onPressed: onSignIn ?? () => context.go('/login'),
          compact: compact,
        ),
      if (showCreateAccount)
        _NavActionButton(
          label: 'Create account',
          icon: Icons.arrow_outward_rounded,
          onPressed: onCreateAccount ?? () => context.go('/register'),
          filled: true,
          compact: compact,
        ),
    ];

    if (!compact) {
      return Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.sm,
        alignment: WrapAlignment.end,
        children: buttons,
      );
    }

    return Row(
      children: [
        for (var index = 0; index < buttons.length; index++) ...[
          Expanded(child: buttons[index]),
          if (index < buttons.length - 1) const SizedBox(width: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _NavActionButton extends StatelessWidget {
  const _NavActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.filled = false,
    this.compact = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final bool filled;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final button = filled
        ? FilledButton.icon(
            onPressed: onPressed,
            style: FilledButton.styleFrom(
              backgroundColor: AuthDarkColors.accent,
              foregroundColor: AuthDarkColors.textOnAccent,
              padding: EdgeInsets.symmetric(
                horizontal: compact ? AppSpacing.md : AppSpacing.lg,
                vertical: AppSpacing.md,
              ),
              minimumSize: const Size(0, 46),
              shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
            ),
            icon: Icon(icon, size: 18),
            label: Text(
              label,
              style: AuthDarkTextStyles.body(context).copyWith(
                color: AuthDarkColors.textOnAccent,
                fontWeight: FontWeight.w700,
              ),
            ),
          )
        : OutlinedButton.icon(
            onPressed: onPressed,
            style: OutlinedButton.styleFrom(
              foregroundColor: AuthDarkColors.textPrimary,
              side: const BorderSide(color: AuthDarkColors.border),
              padding: EdgeInsets.symmetric(
                horizontal: compact ? AppSpacing.md : AppSpacing.lg,
                vertical: AppSpacing.md,
              ),
              minimumSize: const Size(0, 46),
              shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
            ),
            icon: Icon(icon, size: 18),
            label: Text(
              label,
              style: AuthDarkTextStyles.body(context).copyWith(
                color: AuthDarkColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          );

    return button;
  }
}
