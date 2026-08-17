import '../../../domain/models/smart_build_plan.dart';

class SmartBuildPlanItemGroups {
  const SmartBuildPlanItemGroups({
    required this.planned,
    required this.inProgress,
    required this.alreadySatisfied,
    required this.attention,
    required this.uncovered,
  });

  factory SmartBuildPlanItemGroups.fromItems(List<SmartBuildPlanItem> items) {
    return SmartBuildPlanItemGroups(
      planned: items
          .where((item) => item.plannerState == SmartBuildPlannerState.planned)
          .toList(growable: false),
      inProgress: items
          .where(
            (item) => item.plannerState == SmartBuildPlannerState.inProgress,
          )
          .toList(growable: false),
      alreadySatisfied: items
          .where(
            (item) =>
                item.plannerState == SmartBuildPlannerState.alreadySatisfied,
          )
          .toList(growable: false),
      attention: items
          .where(
            (item) => item.plannerState == SmartBuildPlannerState.attention,
          )
          .toList(growable: false),
      uncovered: items
          .where(
            (item) => item.plannerState == SmartBuildPlannerState.uncovered,
          )
          .toList(growable: false),
    );
  }

  final List<SmartBuildPlanItem> planned;
  final List<SmartBuildPlanItem> inProgress;
  final List<SmartBuildPlanItem> alreadySatisfied;
  final List<SmartBuildPlanItem> attention;
  final List<SmartBuildPlanItem> uncovered;

  bool get hasRecommendations => planned.isNotEmpty;
}

List<SmartBuildReasonTag> prioritizedReasonTags({
  required List<SmartBuildReasonTag> tags,
  required SmartBuildMatchType matchType,
  int maxVisible = 2,
}) {
  const priority = <SmartBuildReasonTag>[
    SmartBuildReasonTag.exactMatch,
    SmartBuildReasonTag.free,
    SmartBuildReasonTag.samePickupAsOtherItem,
    SmartBuildReasonTag.sameSupplierAsOtherItem,
    SmartBuildReasonTag.onlyCompatibleOption,
    SmartBuildReasonTag.sameCity,
    SmartBuildReasonTag.sameArea,
    SmartBuildReasonTag.compatibleMatch,
    SmartBuildReasonTag.approvedAlternative,
  ];

  final filtered = tags
      .where((tag) {
        return switch (tag) {
          SmartBuildReasonTag.exactMatch ||
          SmartBuildReasonTag.compatibleMatch ||
          SmartBuildReasonTag.approvedAlternative => false,
          _ => true,
        };
      })
      .toList(growable: false);

  filtered.sort((a, b) {
    final aIndex = priority.indexOf(a);
    final bIndex = priority.indexOf(b);
    return (aIndex == -1 ? 999 : aIndex).compareTo(bIndex == -1 ? 999 : bIndex);
  });

  return filtered.take(maxVisible).toList(growable: false);
}

int hiddenReasonTagCount({
  required List<SmartBuildReasonTag> tags,
  required SmartBuildMatchType matchType,
  int maxVisible = 2,
}) {
  final filteredCount = tags.where((tag) {
    return switch (tag) {
      SmartBuildReasonTag.exactMatch ||
      SmartBuildReasonTag.compatibleMatch ||
      SmartBuildReasonTag.approvedAlternative => false,
      _ => true,
    };
  }).length;
  return filteredCount > maxVisible ? filteredCount - maxVisible : 0;
}
