import '../../../../app/theme/app_spacing.dart';

class LearningProjectCardLayout {
  const LearningProjectCardLayout._();

  static const double coverHeight = 168;
  static const double gridCardHeight = 436;

  static int columnsForWidth(double width) {
    if (width >= 1160) {
      return 3;
    }
    if (width >= 760) {
      return 2;
    }
    return 1;
  }

  static double itemWidthForGrid({
    required double gridWidth,
    required int columns,
  }) {
    return (gridWidth - ((columns - 1) * AppSpacing.md)) / columns;
  }
}
