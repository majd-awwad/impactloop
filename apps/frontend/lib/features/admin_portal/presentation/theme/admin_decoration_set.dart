import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import 'admin_palette.dart';

class AdminDecorationSet {
  const AdminDecorationSet(this.palette);

  final AdminPalette palette;

  BoxDecoration get pageBackground => BoxDecoration(color: palette.pageBackground);

  BoxDecoration get topBar => BoxDecoration(
        color: palette.topBarBackground,
        border: Border(
          bottom: BorderSide(
            color: palette.cardBorder.withValues(alpha: palette.isDark ? 0.55 : 1),
          ),
        ),
        boxShadow: [
          if (!palette.isDark)
            BoxShadow(
              color: palette.cardShadow,
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
        ],
      );

  BoxDecoration sidebar({required TextDirection direction}) {
    final side = direction == TextDirection.rtl
        ? BorderSide(color: palette.sidebarBorder)
        : BorderSide.none;
    final start = direction == TextDirection.ltr
        ? BorderSide(color: palette.sidebarBorder)
        : BorderSide.none;

    return BoxDecoration(
      color: palette.sidebarBackground,
      border: Border(left: start, right: side),
    );
  }

  BoxDecoration get topBarPill => BoxDecoration(
        color: palette.isDark
            ? palette.cardBackground.withValues(alpha: 0.72)
            : const Color(0xFFF9FAFB),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.cardBorder),
      );

  BoxDecoration navItem({required bool isActive}) => BoxDecoration(
        color: isActive ? palette.sidebarActiveBackground : Colors.transparent,
        borderRadius: AppRadius.mdAll,
        border: isActive
            ? Border.all(
                color: palette.sidebarActiveAccent.withValues(alpha: 0.45),
              )
            : null,
      );

  BoxDecoration get sidebarProfile => BoxDecoration(
        color: palette.sidebarBackground.withValues(alpha: 0.92),
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: palette.sidebarBorder.withValues(alpha: 0.85),
        ),
      );

  BoxDecoration get avatarCircle => BoxDecoration(
        color: palette.sidebarActiveBackground,
        shape: BoxShape.circle,
        border: Border.all(
          color: palette.sidebarActiveAccent.withValues(alpha: 0.4),
        ),
      );
}

extension AdminThemeX on BuildContext {
  AdminPalette get adminPalette => AdminPalette.of(this);

  AdminDecorationSet get adminDecorations => AdminDecorationSet(adminPalette);
}
