import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/application/app_settings_notifier.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_section_card.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../auth/application/auth_controller.dart';
import '../l10n/learner_profile_l10n.dart';
import 'learner_profile_hub_widgets.dart';

/// Transitional LP-01 compatibility behavior.
///
/// LP-03 must remove this launcher when the final Account and Settings
/// destination replaces it.
Future<void> showAccountSettingsLauncherSheet({
  required BuildContext context,
  required WidgetRef ref,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (sheetContext) =>
        _AccountSettingsLauncherSheet(parentContext: context, ref: ref),
  );
}

class _AccountSettingsLauncherSheet extends StatelessWidget {
  const _AccountSettingsLauncherSheet({
    required this.parentContext,
    required this.ref,
  });

  final BuildContext parentContext;
  final WidgetRef ref;

  Future<void> _logout(BuildContext context) async {
    final l10n = LearnerProfileL10n.of(context);
    final router = GoRouter.of(parentContext);
    final logoutError = await ref
        .read(authControllerProvider.notifier)
        .logout();

    if (!context.mounted) {
      return;
    }

    await Navigator.of(context).maybePop();
    router.go('/login');

    if (logoutError != null && parentContext.mounted) {
      showInfoSnackBar(parentContext, l10n.localLogoutWarning);
    }
  }

  Future<void> _openRoute(BuildContext context, String route) async {
    final router = GoRouter.of(parentContext);
    await Navigator.of(context).maybePop();
    router.push(route);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    final colors = AppThemeColors.of(context);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        0,
        AppSpacing.md,
        AppSpacing.lg + bottomInset,
      ),
      child: SingleChildScrollView(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.accountSettingsLauncherTitle,
                            style: AppTextStyles.title(
                              context,
                            ).copyWith(color: colors.textPrimary, fontSize: 20),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            l10n.accountSettingsLauncherBody,
                            style: AppTextStyles.body(context).copyWith(
                              color: colors.textSecondary,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      tooltip: l10n.close,
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                AppSectionCard(
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      ProfileDestinationTile(
                        icon: Icons.person_outline_rounded,
                        title: l10n.personalInformation,
                        subtitle: l10n.personalInformationBody,
                        onTap: () => _openRoute(context, '/profile/edit'),
                      ),
                      const Divider(height: 1),
                      ProfileDestinationTile(
                        icon: Icons.location_on_outlined,
                        title: l10n.savedLocations,
                        subtitle: l10n.savedLocationsBody,
                        onTap: () => _openRoute(context, '/profile/locations'),
                      ),
                      const Divider(height: 1),
                      ProfileDestinationTile(
                        icon: Icons.lock_outline_rounded,
                        title: l10n.security,
                        subtitle: l10n.securityBody,
                        onTap: () => _openRoute(context, '/profile/security'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                const _LocalSettingsCard(),
                const SizedBox(height: AppSpacing.md),
                OutlinedButton.icon(
                  onPressed: () => _logout(context),
                  style:
                      AppStatusButtonStyle.outlined(
                        context,
                        AppStatusTone.danger,
                      ).copyWith(
                        minimumSize: const WidgetStatePropertyAll(
                          Size(double.infinity, 48),
                        ),
                        shape: WidgetStatePropertyAll(
                          RoundedRectangleBorder(
                            borderRadius: AppRadius.pillAll,
                          ),
                        ),
                      ),
                  icon: const Icon(Icons.logout_rounded),
                  label: Text(l10n.logout),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LocalSettingsCard extends ConsumerWidget {
  const _LocalSettingsCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = LearnerProfileL10n.of(context);
    final settings = ref.watch(appSettingsProvider);

    return AppSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SettingChoice<ThemeMode>(
            icon: Icons.brightness_6_outlined,
            title: l10n.appearance,
            value: settings.themeMode,
            values: ThemeMode.values,
            labelFor: (mode) => switch (mode) {
              ThemeMode.system => l10n.systemTheme,
              ThemeMode.light => l10n.lightTheme,
              ThemeMode.dark => l10n.darkTheme,
            },
            onChanged: (mode) =>
                ref.read(appSettingsProvider.notifier).setThemeMode(mode),
          ),
          const SizedBox(height: AppSpacing.md),
          _SettingChoice<String>(
            icon: Icons.language_rounded,
            title: l10n.language,
            value: settings.languageCode,
            values: const ['en', 'ar'],
            labelFor: (language) =>
                language == 'ar' ? l10n.arabic : l10n.english,
            onChanged: (language) => ref
                .read(appSettingsProvider.notifier)
                .setLanguageCode(language),
          ),
        ],
      ),
    );
  }
}

class _SettingChoice<T> extends StatelessWidget {
  const _SettingChoice({
    required this.icon,
    required this.title,
    required this.value,
    required this.values,
    required this.labelFor,
    required this.onChanged,
  });

  final IconData icon;
  final String title;
  final T value;
  final List<T> values;
  final String Function(T value) labelFor;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, color: colors.primary, size: 18),
            const SizedBox(width: AppSpacing.sm),
            Text(
              title,
              style: AppTextStyles.label(context).copyWith(
                color: colors.textPrimary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final item in values)
              ChoiceChip(
                label: Text(labelFor(item)),
                selected: item == value,
                onSelected: (_) => onChanged(item),
                selectedColor: colors.primary,
                backgroundColor: colors.surfaceMuted,
                checkmarkColor: colors.textOnPrimary,
                labelStyle: TextStyle(
                  color: item == value
                      ? colors.textOnPrimary
                      : colors.textSecondary,
                  fontWeight: FontWeight.w700,
                ),
                side: BorderSide(
                  color: item == value ? colors.primary : colors.borderSubtle,
                ),
              ),
          ],
        ),
      ],
    );
  }
}
