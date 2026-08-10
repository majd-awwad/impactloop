import 'package:flutter/material.dart';

import '../../../../app/theme/app_theme_colors.dart';
import '../../domain/models/learning_project.dart';

List<Color> projectGradient(LearningProject project) {
  return project.cardGradient.map(Color.new).toList();
}

/// Shared ImpactLoop-neutral placeholder for projects without cover images.
Color projectImagePlaceholderColor(BuildContext context) {
  final colors = AppThemeColors.of(context);
  return Color.alphaBlend(
    colors.primary.withValues(alpha: 0.10),
    colors.primarySoft,
  );
}

Color projectImagePlaceholderIconColor(BuildContext context) {
  final colors = AppThemeColors.of(context);
  return colors.primary.withValues(alpha: 0.55);
}
