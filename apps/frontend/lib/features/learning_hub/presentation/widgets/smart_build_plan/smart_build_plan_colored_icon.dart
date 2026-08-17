import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';

class SmartBuildPlanIconColors {
  const SmartBuildPlanIconColors._({
    required this.foreground,
    required this.background,
  });

  final Color foreground;
  final Color background;

  static const blue = SmartBuildPlanIconColors._(
    foreground: Color(0xFF2563EB),
    background: Color(0xFFEFF6FF),
  );

  static const green = SmartBuildPlanIconColors._(
    foreground: Color(0xFF16A34A),
    background: Color(0xFFECFDF5),
  );

  static const orange = SmartBuildPlanIconColors._(
    foreground: Color(0xFFEA580C),
    background: Color(0xFFFFF7ED),
  );

  static const amber = SmartBuildPlanIconColors._(
    foreground: Color(0xFFD97706),
    background: Color(0xFFFFFBEB),
  );

  static const purple = SmartBuildPlanIconColors._(
    foreground: Color(0xFF7C3AED),
    background: Color(0xFFF5F3FF),
  );

  static const teal = SmartBuildPlanIconColors._(
    foreground: Color(0xFF0D9488),
    background: Color(0xFFF0FDFA),
  );
}

class SmartBuildPlanIconBadge extends StatelessWidget {
  const SmartBuildPlanIconBadge({
    super.key,
    required this.icon,
    required this.colors,
    this.size = 48,
    this.iconSize = 24,
  });

  final IconData icon;
  final SmartBuildPlanIconColors colors;
  final double size;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: AppRadius.mdAll,
      ),
      child: Icon(icon, size: iconSize, color: colors.foreground),
    );
  }
}

class SmartBuildPlanColoredIcon extends StatelessWidget {
  const SmartBuildPlanColoredIcon({
    super.key,
    required this.icon,
    required this.colors,
    this.size = 20,
  });

  final IconData icon;
  final SmartBuildPlanIconColors colors;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Icon(icon, size: size, color: colors.foreground);
  }
}
