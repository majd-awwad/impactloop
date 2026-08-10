import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/learner_discovery/learner_discovery.dart';

class LearningProjectCardLayout {
  const LearningProjectCardLayout._();

  static const double coverHeight = 168;
  static const double gridCardHeight = 436;
  static const double compactCardHeight = 132;

  static int columnsForWidth(double width) {
    return LearnerDiscoveryLayout.discoveryColumns(width);
  }

  static bool useCompactList(double width) => width < 600;

  static double itemWidthForGrid({
    required double gridWidth,
    required int columns,
  }) {
    return (gridWidth - ((columns - 1) * AppSpacing.md)) / columns;
  }
}
