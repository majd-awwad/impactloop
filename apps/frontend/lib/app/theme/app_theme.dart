import 'package:flutter/material.dart';

import 'app_radius.dart';
import 'app_spacing.dart';
import 'app_theme_colors.dart';

class AppTheme {
  const AppTheme._();

  static ThemeData get light {
    const colors = AppThemeColors.light;
    final colorScheme = _colorScheme(colors, Brightness.light);

    return ThemeData(
      colorScheme: colorScheme,
      useMaterial3: true,
      extensions: const [colors],
      scaffoldBackgroundColor: colors.pageBackground,
      textTheme: _textTheme.apply(
        bodyColor: colors.textPrimary,
        displayColor: colors.textPrimary,
      ),
      iconTheme: IconThemeData(color: colors.textSecondary),
      dividerTheme: _dividerTheme(colors),
      menuTheme: _menuTheme(colors),
      inputDecorationTheme: _inputDecorationTheme(colors),
      filledButtonTheme: _filledButtonTheme(colors),
      textButtonTheme: _textButtonTheme(colors),
      outlinedButtonTheme: _outlinedButtonTheme(colors),
      cardTheme: _cardTheme(colors),
      snackBarTheme: _snackBarTheme(colors),
    );
  }

  static ThemeData get dark {
    const colors = AppThemeColors.dark;
    final colorScheme = _colorScheme(colors, Brightness.dark);

    return ThemeData(
      colorScheme: colorScheme,
      useMaterial3: true,
      extensions: const [colors],
      scaffoldBackgroundColor: colors.pageBackground,
      textTheme: _textTheme.apply(
        bodyColor: colors.textPrimary,
        displayColor: colors.textPrimary,
      ),
      iconTheme: IconThemeData(color: colors.textSecondary),
      dividerTheme: _dividerTheme(colors),
      menuTheme: _menuTheme(colors),
      inputDecorationTheme: _inputDecorationTheme(colors),
      filledButtonTheme: _filledButtonTheme(colors),
      textButtonTheme: _textButtonTheme(colors),
      outlinedButtonTheme: _outlinedButtonTheme(colors),
      cardTheme: _cardTheme(colors),
      snackBarTheme: _snackBarTheme(colors),
    );
  }

  static ColorScheme _colorScheme(
    AppThemeColors colors,
    Brightness brightness,
  ) {
    return ColorScheme.fromSeed(
      seedColor: colors.primary,
      primary: colors.primary,
      secondary: colors.textSecondary,
      surface: colors.surface,
      error: colors.danger,
      brightness: brightness,
    ).copyWith(
      primaryContainer: colors.primarySoft,
      secondaryContainer: colors.surfaceMuted,
      surfaceContainer: colors.panelSurface,
      surfaceContainerHighest: colors.surfaceMuted,
      onPrimary: colors.textOnPrimary,
      onSecondary: colors.surface,
      onSurface: colors.textPrimary,
      onSurfaceVariant: colors.textSecondary,
      outline: colors.borderStrong,
      outlineVariant: colors.borderSubtle,
    );
  }

  static DividerThemeData _dividerTheme(AppThemeColors colors) {
    return DividerThemeData(color: colors.borderSubtle, thickness: 1, space: 1);
  }

  static MenuThemeData _menuTheme(AppThemeColors colors) {
    return MenuThemeData(
      style: MenuStyle(
        backgroundColor: WidgetStatePropertyAll(colors.surfaceElevated),
        elevation: const WidgetStatePropertyAll(8),
        shadowColor: WidgetStatePropertyAll(colors.shadow),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(
            borderRadius: AppRadius.mdAll,
            side: BorderSide(color: colors.borderSubtle),
          ),
        ),
      ),
    );
  }

  static InputDecorationTheme _inputDecorationTheme(AppThemeColors colors) {
    final baseBorder = _outlineBorder(colors.borderSubtle);

    return InputDecorationTheme(
      filled: true,
      fillColor: colors.surfaceElevated,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.fieldHorizontal,
        vertical: AppSpacing.fieldVertical,
      ),
      border: baseBorder,
      enabledBorder: baseBorder,
      disabledBorder: _outlineBorder(
        colors.borderSubtle.withValues(alpha: 0.6),
      ),
      focusedBorder: _outlineBorder(colors.primary, width: 1.5),
      errorBorder: _outlineBorder(colors.danger),
      focusedErrorBorder: _outlineBorder(colors.danger, width: 1.5),
      labelStyle: TextStyle(
        color: colors.textSecondary,
        fontWeight: FontWeight.w600,
      ),
      floatingLabelStyle: TextStyle(
        color: colors.textPrimary,
        fontWeight: FontWeight.w700,
      ),
      hintStyle: TextStyle(color: colors.textMuted),
      errorStyle: TextStyle(color: colors.danger, fontWeight: FontWeight.w600),
      prefixIconColor: colors.textMuted,
      suffixIconColor: colors.textMuted,
    );
  }

  static FilledButtonThemeData _filledButtonTheme(AppThemeColors colors) {
    return FilledButtonThemeData(
      style: ButtonStyle(
        minimumSize: const WidgetStatePropertyAll(
          Size(0, AppSpacing.buttonHeight),
        ),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.sm,
          ),
        ),
        backgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.disabled)) {
            return colors.surfaceMuted;
          }
          if (states.contains(WidgetState.pressed)) {
            return colors.primaryHover;
          }
          return colors.primary;
        }),
        foregroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.disabled)) {
            return colors.textMuted;
          }
          return colors.textOnPrimary;
        }),
        overlayColor: WidgetStatePropertyAll(
          colors.textOnPrimary.withValues(alpha: 0.08),
        ),
        elevation: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.disabled)) {
            return 0;
          }
          if (states.contains(WidgetState.pressed)) {
            return 1;
          }
          return 2;
        }),
        shadowColor: WidgetStatePropertyAll(colors.shadow),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        ),
        textStyle: const WidgetStatePropertyAll(
          TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }

  static TextButtonThemeData _textButtonTheme(AppThemeColors colors) {
    return TextButtonThemeData(
      style: ButtonStyle(
        foregroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.disabled)) {
            return colors.textMuted;
          }
          return colors.primary;
        }),
        overlayColor: WidgetStatePropertyAll(
          colors.primarySoft.withValues(alpha: 0.55),
        ),
        textStyle: const WidgetStatePropertyAll(
          TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }

  static OutlinedButtonThemeData _outlinedButtonTheme(AppThemeColors colors) {
    return OutlinedButtonThemeData(
      style: ButtonStyle(
        foregroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.disabled)) {
            return colors.textMuted;
          }
          return colors.textPrimary;
        }),
        side: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.disabled)) {
            return BorderSide(
              color: colors.borderSubtle.withValues(alpha: 0.6),
            );
          }
          if (states.contains(WidgetState.focused) ||
              states.contains(WidgetState.hovered)) {
            return BorderSide(color: colors.primary, width: 1.25);
          }
          return BorderSide(color: colors.borderStrong);
        }),
        overlayColor: WidgetStatePropertyAll(
          colors.primarySoft.withValues(alpha: 0.45),
        ),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        ),
        minimumSize: const WidgetStatePropertyAll(
          Size(0, AppSpacing.buttonHeight),
        ),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        ),
        textStyle: const WidgetStatePropertyAll(
          TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }

  static CardThemeData _cardTheme(AppThemeColors colors) {
    return CardThemeData(
      color: colors.cardSurface,
      elevation: 0,
      shadowColor: colors.shadow,
      surfaceTintColor: colors.surfaceElevated,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
        side: BorderSide(color: colors.borderSubtle),
      ),
      margin: EdgeInsets.zero,
    );
  }

  static SnackBarThemeData _snackBarTheme(AppThemeColors colors) {
    return SnackBarThemeData(
      backgroundColor: colors.textPrimary,
      contentTextStyle: _textTheme.bodyMedium?.copyWith(
        color: colors.surfaceElevated,
        fontWeight: FontWeight.w600,
      ),
      behavior: SnackBarBehavior.floating,
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
      insetPadding: const EdgeInsets.all(AppSpacing.md),
    );
  }

  static OutlineInputBorder _outlineBorder(Color color, {double width = 1}) {
    return OutlineInputBorder(
      borderRadius: AppRadius.mdAll,
      borderSide: BorderSide(color: color, width: width),
    );
  }

  static const TextTheme _textTheme = TextTheme(
    headlineLarge: TextStyle(fontSize: 34, height: 1.15),
    headlineMedium: TextStyle(fontSize: 28, height: 1.2),
    titleLarge: TextStyle(fontSize: 22, height: 1.25),
    titleMedium: TextStyle(fontSize: 18, height: 1.35),
    bodyLarge: TextStyle(fontSize: 16, height: 1.5),
    bodyMedium: TextStyle(fontSize: 14, height: 1.5),
    labelLarge: TextStyle(fontSize: 14, height: 1.4),
  );
}
