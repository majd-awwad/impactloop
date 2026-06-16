import 'package:flutter/material.dart';

import 'app_radius.dart';
import 'app_spacing.dart';
import 'auth_dark_colors.dart';

abstract final class SupplierDecorations {
  static const LinearGradient heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      AuthDarkColors.landingBackground,
      AuthDarkColors.backgroundElevated,
      AuthDarkColors.background,
    ],
    stops: [0.0, 0.58, 1.0],
  );

  static BoxDecoration pageBackground = const BoxDecoration(
    gradient: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        AuthDarkColors.landingBackground,
        AuthDarkColors.landingBackground,
        AuthDarkColors.landingBackground,
      ],
    ),
  );

  static BoxDecoration topBar = BoxDecoration(
    color: AuthDarkColors.navBar.withValues(alpha: 0.74),
    border: Border(
      bottom: BorderSide(color: AuthDarkColors.border.withValues(alpha: 0.28)),
    ),
  );

  static BoxDecoration sidebar = BoxDecoration(
    color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.78),
    border: Border(
      right: BorderSide(color: AuthDarkColors.border.withValues(alpha: 0.34)),
    ),
  );

  static BoxDecoration dashboardCard = BoxDecoration(
    color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.74),
    borderRadius: AppRadius.lgAll,
    border: Border.all(color: AuthDarkColors.border.withValues(alpha: 0.34)),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.22),
        blurRadius: 22,
        offset: const Offset(0, 10),
      ),
    ],
  );

  static BoxDecoration topBarPill = BoxDecoration(
    color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.72),
    borderRadius: AppRadius.pillAll,
    border: Border.all(color: AuthDarkColors.border.withValues(alpha: 0.42)),
  );

  static BoxDecoration heroPanel = BoxDecoration(
    gradient: heroGradient,
    borderRadius: AppRadius.xlAll,
    border: Border.all(color: AuthDarkColors.border.withValues(alpha: 0.65)),
    boxShadow: [
      BoxShadow(
        color: AuthDarkColors.accentSoft.withValues(alpha: 0.18),
        blurRadius: 34,
        offset: const Offset(0, 12),
      ),
    ],
  );

  static BoxDecoration statCard = BoxDecoration(
    color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.68),
    borderRadius: AppRadius.lgAll,
    border: Border.all(color: AuthDarkColors.border.withValues(alpha: 0.3)),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.18),
        blurRadius: 18,
        offset: const Offset(0, 8),
      ),
    ],
  );

  static BoxDecoration highlightedStatCard = BoxDecoration(
    color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.74),
    borderRadius: AppRadius.lgAll,
    border: Border.all(
      color: AuthDarkColors.borderFocused.withValues(alpha: 0.42),
    ),
    boxShadow: [
      BoxShadow(
        color: AuthDarkColors.accentSoft.withValues(alpha: 0.16),
        blurRadius: 24,
        offset: const Offset(0, 10),
      ),
    ],
  );

  static BoxDecoration quickActionCard = BoxDecoration(
    color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.66),
    borderRadius: AppRadius.lgAll,
    border: Border.all(color: AuthDarkColors.border.withValues(alpha: 0.3)),
  );

  static BoxDecoration navItem({required bool isActive}) {
    return BoxDecoration(
      color: isActive
          ? AuthDarkColors.accentSoft.withValues(alpha: 0.16)
          : Colors.transparent,
      borderRadius: AppRadius.mdAll,
      border: isActive
          ? Border.all(
              color: AuthDarkColors.borderFocused.withValues(alpha: 0.45),
            )
          : null,
    );
  }

  static BoxDecoration sidebarProfile = BoxDecoration(
    color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.62),
    borderRadius: AppRadius.lgAll,
    border: Border.all(color: AuthDarkColors.border.withValues(alpha: 0.32)),
  );

  static BoxDecoration lifecycleNode({required bool isActive}) {
    return BoxDecoration(
      color: isActive
          ? AuthDarkColors.accentSoft.withValues(alpha: 0.22)
          : AuthDarkColors.surfaceSolid.withValues(alpha: 0.7),
      borderRadius: AppRadius.pillAll,
      border: Border.all(
        color: isActive
            ? AuthDarkColors.borderFocused.withValues(alpha: 0.75)
            : AuthDarkColors.border.withValues(alpha: 0.45),
      ),
    );
  }

  static BoxDecoration mobileNavBar = BoxDecoration(
    color: AuthDarkColors.navBar.withValues(alpha: 0.94),
    border: Border(
      top: BorderSide(color: AuthDarkColors.border.withValues(alpha: 0.45)),
    ),
  );

  static BoxDecoration avatarCircle = BoxDecoration(
    color: AuthDarkColors.accentSoft.withValues(alpha: 0.2),
    shape: BoxShape.circle,
    border: Border.all(
      color: AuthDarkColors.borderFocused.withValues(alpha: 0.5),
    ),
  );

  static BoxDecoration badge({required Color background}) {
    return BoxDecoration(
      color: background,
      borderRadius: AppRadius.pillAll,
      border: Border.all(color: AuthDarkColors.border.withValues(alpha: 0.35)),
    );
  }

  static BoxDecoration materialPlaceholder = BoxDecoration(
    color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.72),
    borderRadius: AppRadius.mdAll,
    border: Border.all(color: AuthDarkColors.border.withValues(alpha: 0.3)),
  );

  static BoxDecoration profileGlassCard = BoxDecoration(
    color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.58),
    borderRadius: AppRadius.xlAll,
    border: Border.all(color: AuthDarkColors.border.withValues(alpha: 0.38)),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.24),
        blurRadius: 28,
        offset: const Offset(0, 12),
      ),
    ],
  );

  static BoxDecoration profileSectionPanel = BoxDecoration(
    color: AuthDarkColors.landingBackground.withValues(alpha: 0.72),
    borderRadius: AppRadius.lgAll,
    border: Border.all(color: AuthDarkColors.border.withValues(alpha: 0.28)),
  );

  static BoxDecoration sideInsightCard = BoxDecoration(
    color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.7),
    borderRadius: AppRadius.lgAll,
    border: Border.all(color: AuthDarkColors.border.withValues(alpha: 0.32)),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.16),
        blurRadius: 16,
        offset: const Offset(0, 6),
      ),
    ],
  );

  static BoxDecoration mapPreviewPanel = BoxDecoration(
    color: AuthDarkColors.landingBackground,
    borderRadius: AppRadius.lgAll,
    border: Border.all(color: AuthDarkColors.border.withValues(alpha: 0.34)),
  );

  static InputDecoration darkFormFieldDecoration({
    String? hint,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: AuthDarkColors.textMuted),
      filled: true,
      fillColor: AuthDarkColors.surfaceSolid.withValues(alpha: 0.92),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 16,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: AppRadius.mdAll,
        borderSide: BorderSide(
          color: AuthDarkColors.border.withValues(alpha: 0.55),
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: AppRadius.mdAll,
        borderSide: const BorderSide(
          color: AuthDarkColors.borderFocused,
          width: 1.5,
        ),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: AppRadius.mdAll,
        borderSide: const BorderSide(color: AuthDarkColors.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: AppRadius.mdAll,
        borderSide: const BorderSide(color: AuthDarkColors.error, width: 1.5),
      ),
      suffixIcon: suffixIcon,
    );
  }

  static EdgeInsets pagePadding({required bool compact}) {
    return EdgeInsets.all(compact ? AppSpacing.md : AppSpacing.lg);
  }
}
