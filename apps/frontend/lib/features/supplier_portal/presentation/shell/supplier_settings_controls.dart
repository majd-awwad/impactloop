import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/application/app_settings_notifier.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/widgets/nav_pill_menu.dart';
import '../theme/supplier_theme_extension.dart';

class SupplierSettingsControls extends ConsumerWidget {
  const SupplierSettingsControls({super.key, this.compact = false});

  final bool compact;

  static const _languageOptions = ['en', 'ar'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(appSettingsProvider);
    final l = context.s;

    String localizedThemeLabel(ThemeMode mode) {
      return switch (mode) {
        ThemeMode.system => l.themeSystem,
        ThemeMode.light => l.themeLight,
        ThemeMode.dark => l.themeDark,
      };
    }

    return Wrap(
      spacing: compact ? AppSpacing.xs : AppSpacing.sm,
      runSpacing: AppSpacing.xs,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        NavPillMenu<String>(
          icon: Icons.language_rounded,
          label: languageLabel(settings.languageCode),
          items: _languageOptions,
          selectedValue: settings.languageCode,
          itemLabel: languageLabel,
          onSelected: (code) {
            ref.read(appSettingsProvider.notifier).setLanguageCode(code);
          },
        ),
        NavPillMenu<ThemeMode>(
          icon: themeModeIcon(settings.themeMode),
          label: compact
              ? l.themeLabel
              : localizedThemeLabel(settings.themeMode),
          items: ThemeMode.values,
          selectedValue: settings.themeMode,
          itemLabel: localizedThemeLabel,
          onSelected: (mode) {
            ref.read(appSettingsProvider.notifier).setThemeMode(mode);
          },
        ),
      ],
    );
  }
}
