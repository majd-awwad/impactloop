import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import 'supplier_color_scheme.dart';

/// Theme-aware supplier decorations derived from [SupplierColorScheme].
class SupplierDecorationSet {
  const SupplierDecorationSet(this.colors);

  final SupplierColorScheme colors;

  LinearGradient get heroGradient => LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          colors.landingBackground,
          colors.backgroundElevated,
          colors.background,
        ],
        stops: const [0.0, 0.58, 1.0],
      );

  BoxDecoration get pageBackground => BoxDecoration(
        color: colors.landingBackground,
      );

  BoxDecoration get topBar => BoxDecoration(
        color: colors.navBar.withValues(alpha: colors.isDark ? 0.74 : 0.96),
        border: Border(
          bottom: BorderSide(
            color: colors.border.withValues(alpha: colors.isDark ? 0.28 : 0.55),
          ),
        ),
      );

  BoxDecoration sidebar({required TextDirection direction}) {
    final side = direction == TextDirection.rtl
        ? BorderSide(
            color: colors.border.withValues(alpha: colors.isDark ? 0.34 : 0.85),
          )
        : BorderSide.none;
    final start = direction == TextDirection.ltr
        ? BorderSide(
            color: colors.border.withValues(alpha: colors.isDark ? 0.34 : 0.85),
          )
        : BorderSide.none;

    return BoxDecoration(
      color: colors.surfaceSolid.withValues(alpha: colors.isDark ? 0.78 : 1),
      border: Border(left: start, right: side),
    );
  }

  BoxDecoration get dashboardCard => BoxDecoration(
        color: colors.surfaceSolid.withValues(alpha: colors.isDark ? 0.74 : 1),
        borderRadius: AppRadius.lgAll,
        border: colors.isDark
            ? Border.all(
                color: colors.border.withValues(alpha: 0.55),
              )
            : Border.all(color: colors.border),
        boxShadow: [
          BoxShadow(
            color: colors.cardShadow,
            blurRadius: colors.isDark ? 22 : 14,
            offset: Offset(0, colors.isDark ? 10 : 6),
          ),
        ],
      );

  BoxDecoration get topBarPill => BoxDecoration(
        color: colors.surfaceSolid.withValues(alpha: colors.isDark ? 0.72 : 1),
        borderRadius: AppRadius.pillAll,
        border: Border.all(
          color: colors.border.withValues(alpha: colors.isDark ? 0.42 : 0.7),
        ),
      );

  BoxDecoration get heroPanel => BoxDecoration(
        gradient: heroGradient,
        borderRadius: AppRadius.xlAll,
        border: Border.all(
          color: colors.border.withValues(alpha: colors.isDark ? 0.65 : 0.55),
        ),
        boxShadow: [
          BoxShadow(
            color: colors.accentSoft.withValues(alpha: colors.isDark ? 0.18 : 0.12),
            blurRadius: 34,
            offset: const Offset(0, 12),
          ),
        ],
      );

  BoxDecoration get statCard => BoxDecoration(
        color: colors.surfaceSolid.withValues(alpha: colors.isDark ? 0.68 : 1),
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: colors.border.withValues(alpha: colors.isDark ? 0.3 : 0.65),
        ),
        boxShadow: [
          BoxShadow(
            color: colors.cardShadow,
            blurRadius: colors.isDark ? 18 : 10,
            offset: Offset(0, colors.isDark ? 8 : 4),
          ),
        ],
      );

  BoxDecoration get highlightedStatCard => BoxDecoration(
        color: colors.surfaceSolid.withValues(alpha: colors.isDark ? 0.74 : 1),
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: colors.borderFocused.withValues(alpha: colors.isDark ? 0.42 : 0.75),
        ),
        boxShadow: [
          BoxShadow(
            color: colors.accentSoft.withValues(alpha: colors.isDark ? 0.16 : 0.1),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      );

  BoxDecoration get quickActionCard => BoxDecoration(
        color: colors.surfaceSolid.withValues(alpha: colors.isDark ? 0.66 : 1),
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: colors.border.withValues(alpha: colors.isDark ? 0.3 : 0.65),
        ),
      );

  BoxDecoration navItem({required bool isActive}) => BoxDecoration(
        color: isActive
            ? colors.accentSoft.withValues(alpha: colors.isDark ? 0.16 : 0.22)
            : Colors.transparent,
        borderRadius: AppRadius.mdAll,
        border: isActive
            ? Border.all(
                color: colors.borderFocused.withValues(alpha: 0.45),
              )
            : null,
      );

  BoxDecoration get sidebarProfile => BoxDecoration(
        color: colors.surfaceSolid.withValues(alpha: colors.isDark ? 0.62 : 0.98),
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: colors.border.withValues(alpha: colors.isDark ? 0.32 : 0.65),
        ),
      );

  BoxDecoration lifecycleNode({required bool isActive}) => BoxDecoration(
        color: isActive
            ? colors.accentSoft.withValues(alpha: colors.isDark ? 0.22 : 0.28)
            : colors.surfaceSolid.withValues(alpha: colors.isDark ? 0.7 : 1),
        borderRadius: AppRadius.pillAll,
        border: Border.all(
          color: isActive
              ? colors.borderFocused.withValues(alpha: 0.75)
              : colors.border.withValues(alpha: colors.isDark ? 0.45 : 0.65),
        ),
      );

  BoxDecoration get mobileNavBar => BoxDecoration(
        color: colors.navBar.withValues(alpha: colors.isDark ? 0.94 : 0.98),
        border: Border(
          top: BorderSide(
            color: colors.border.withValues(alpha: colors.isDark ? 0.45 : 0.65),
          ),
        ),
      );

  BoxDecoration get avatarCircle => BoxDecoration(
        color: colors.accentSoft.withValues(alpha: colors.isDark ? 0.2 : 0.25),
        shape: BoxShape.circle,
        border: Border.all(
          color: colors.borderFocused.withValues(alpha: 0.5),
        ),
      );

  BoxDecoration badge({required Color background}) => BoxDecoration(
        color: background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(
          color: colors.border.withValues(alpha: colors.isDark ? 0.35 : 0.5),
        ),
      );

  BoxDecoration get materialPlaceholder => BoxDecoration(
        color: colors.surfaceSolid.withValues(alpha: colors.isDark ? 0.72 : 1),
        borderRadius: AppRadius.mdAll,
        border: Border.all(
          color: colors.border.withValues(alpha: colors.isDark ? 0.3 : 0.65),
        ),
      );

  BoxDecoration get profileGlassCard => BoxDecoration(
        color: colors.surfaceSolid.withValues(alpha: colors.isDark ? 0.58 : 1),
        borderRadius: AppRadius.xlAll,
        border: Border.all(
          color: colors.border.withValues(alpha: colors.isDark ? 0.38 : 0.7),
        ),
        boxShadow: [
          BoxShadow(
            color: colors.cardShadow,
            blurRadius: colors.isDark ? 28 : 16,
            offset: const Offset(0, 12),
          ),
        ],
      );

  BoxDecoration get profileSectionPanel => BoxDecoration(
        color: colors.backgroundElevated.withValues(alpha: colors.isDark ? 0.72 : 1),
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: colors.border.withValues(alpha: colors.isDark ? 0.28 : 0.6),
        ),
      );

  BoxDecoration get sideInsightCard => BoxDecoration(
        color: colors.surfaceSolid.withValues(alpha: colors.isDark ? 0.7 : 1),
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: colors.border.withValues(alpha: colors.isDark ? 0.32 : 0.65),
        ),
        boxShadow: [
          BoxShadow(
            color: colors.cardShadow,
            blurRadius: colors.isDark ? 16 : 8,
            offset: Offset(0, colors.isDark ? 6 : 3),
          ),
        ],
      );

  BoxDecoration get mapPreviewPanel => BoxDecoration(
        color: colors.landingBackground,
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: colors.border.withValues(alpha: colors.isDark ? 0.34 : 0.65),
        ),
      );

  InputDecoration formFieldDecoration({String? hint, Widget? suffixIcon}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: colors.textMuted),
      filled: true,
      fillColor: colors.surfaceSolid.withValues(alpha: colors.isDark ? 0.92 : 1),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 16,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: AppRadius.mdAll,
        borderSide: BorderSide(
          color: colors.border.withValues(alpha: colors.isDark ? 0.55 : 0.85),
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: AppRadius.mdAll,
        borderSide: BorderSide(
          color: colors.borderFocused,
          width: 1.5,
        ),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: AppRadius.mdAll,
        borderSide: BorderSide(color: colors.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: AppRadius.mdAll,
        borderSide: BorderSide(color: colors.error, width: 1.5),
      ),
      suffixIcon: suffixIcon,
    );
  }

  EdgeInsets pagePadding({required bool compact}) {
    return EdgeInsets.all(compact ? AppSpacing.md : AppSpacing.lg);
  }
}
