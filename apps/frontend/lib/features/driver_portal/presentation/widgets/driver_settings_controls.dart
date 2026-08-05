import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/application/app_settings_notifier.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/widgets/nav_pill_menu.dart';
import '../../../../l10n/l10n.dart';

class DriverSettingsControls extends ConsumerWidget {
  const DriverSettingsControls({super.key, this.compact = true});

  final bool compact;

  static const _languageOptions = ['en', 'ar'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(appSettingsProvider);
    final l10n = context.l10n;

    return Wrap(
      spacing: compact ? AppSpacing.xs : AppSpacing.sm,
      runSpacing: AppSpacing.xs,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        NavPillMenu<String>(
          icon: Icons.language_rounded,
          label: languageLabel(settings.languageCode),
          compact: compact,
          items: _languageOptions,
          selectedValue: settings.languageCode,
          itemLabel: languageLabel,
          onSelected: (code) {
            ref.read(appSettingsProvider.notifier).setLanguageCode(code);
          },
        ),
        NavPillMenu<ThemeMode>(
          icon: themeModeIcon(settings.themeMode),
          label: themeModeLabel(settings.themeMode, l10n: l10n),
          compact: compact,
          items: ThemeMode.values,
          selectedValue: settings.themeMode,
          itemLabel: (mode) => themeModeLabel(mode, l10n: l10n),
          onSelected: (mode) {
            ref.read(appSettingsProvider.notifier).setThemeMode(mode);
          },
        ),
      ],
    );
  }
}
