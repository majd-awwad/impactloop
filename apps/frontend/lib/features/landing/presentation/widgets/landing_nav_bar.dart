import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/application/app_settings_notifier.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_decorations.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../auth/presentation/widgets/impact_loop_logo.dart';
import 'landing_nav_pill_menu.dart';

class LandingNavBar extends ConsumerWidget {
  const LandingNavBar({
    super.key,
    required this.onSignIn,
    required this.onCreateAccount,
  });

  final VoidCallback onSignIn;
  final VoidCallback onCreateAccount;

  static const _languageOptions = ['en', 'ar'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final showSignIn = MediaQuery.sizeOf(context).width >= 720;
    final settings = ref.watch(appSettingsProvider);

    return Container(
      margin: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        0,
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      decoration: AuthDarkDecorations.navBarDecoration,
      child: Row(
        children: [
          const ImpactLoopLogo(compact: true),
          const Spacer(),
          Flexible(
            child: Align(
              alignment: Alignment.centerRight,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                reverse: true,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: AuthDarkColors.accent,
                        foregroundColor: AuthDarkColors.textOnAccent,
                        minimumSize: const Size(0, 40),
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md,
                          vertical: AppSpacing.sm,
                        ),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: AppRadius.pillAll,
                        ),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      onPressed: onCreateAccount,
                      icon: const Icon(Icons.person_add_alt_1, size: 18),
                      label: const Text('Create account'),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    if (showSignIn) ...[
                      TextButton(
                        onPressed: onSignIn,
                        child: Text(
                          'Sign in',
                          style: AuthDarkTextStyles.body(context).copyWith(
                            color: AuthDarkColors.textPrimary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                    ],
                    LandingNavPillMenu<ThemeMode>(
                      icon: themeModeIcon(settings.themeMode),
                      label: themeModeLabel(settings.themeMode),
                      items: ThemeMode.values,
                      selectedValue: settings.themeMode,
                      itemLabel: themeModeLabel,
                      onSelected: (mode) {
                        ref
                            .read(appSettingsProvider.notifier)
                            .setThemeMode(mode);
                      },
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    LandingNavPillMenu<String>(
                      icon: Icons.language,
                      label: languageLabel(settings.languageCode),
                      items: _languageOptions,
                      selectedValue: settings.languageCode,
                      itemLabel: languageLabel,
                      onSelected: (code) {
                        ref
                            .read(appSettingsProvider.notifier)
                            .setLanguageCode(code);
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
