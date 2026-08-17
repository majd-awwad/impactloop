enum SmartBuildPlanPolicyKey { recommended, cheapest, fewestPickups }

enum SmartBuildPlanLabel { bestOverall, cheapest, fewestPickupLocations }

enum SmartBuildPlannerState {
  alreadySatisfied,
  inProgress,
  attention,
  planned,
  uncovered,
}

enum SmartBuildMatchType { exact, compatible, alternative }

enum SmartBuildReasonTag {
  exactMatch,
  compatibleMatch,
  approvedAlternative,
  free,
  sameCity,
  sameArea,
  samePickupAsOtherItem,
  sameSupplierAsOtherItem,
  onlyCompatibleOption,
}

enum SmartBuildUncoveredReason {
  noEligibleCandidates,
  insufficientAvailableQuantity,
  incompatibleUnit,
  noAvailableMaterial,
  notOptimizable,
}

class SmartBuildPlanResult {
  const SmartBuildPlanResult({
    required this.buildId,
    required this.projectId,
    required this.generatedAt,
    required this.advisory,
    required this.summary,
    required this.plans,
  });

  final String buildId;
  final String projectId;
  final DateTime generatedAt;
  final bool advisory;
  final SmartBuildPlanBuildSummary summary;
  final List<SmartBuildPlan> plans;

  bool get hasOptimizableItems => summary.optimizable > 0;
}

class SmartBuildPlanBuildSummary {
  const SmartBuildPlanBuildSummary({
    required this.requiredComponents,
    required this.alreadySatisfied,
    required this.inProgress,
    required this.attention,
    required this.optimizable,
  });

  final int requiredComponents;
  final int alreadySatisfied;
  final int inProgress;
  final int attention;
  final int optimizable;
}

class SmartBuildPlan {
  const SmartBuildPlan({
    required this.key,
    required this.labels,
    required this.summary,
    required this.items,
  });

  final SmartBuildPlanPolicyKey key;
  final List<SmartBuildPlanLabel> labels;
  final SmartBuildPlanPlanSummary summary;
  final List<SmartBuildPlanItem> items;
}

class SmartBuildPlanPlanSummary {
  const SmartBuildPlanPlanSummary({
    required this.newlyPlannedComponents,
    required this.totalCoveredComponents,
    required this.totalRequiredComponents,
    required this.uncoveredComponents,
    required this.materialSubtotal,
    required this.currency,
    required this.priceUnknownCount,
    required this.supplierCount,
    required this.pickupLocationCount,
    required this.deliveryFeeIncluded,
  });

  final int newlyPlannedComponents;
  final int totalCoveredComponents;
  final int totalRequiredComponents;
  final int uncoveredComponents;
  final double materialSubtotal;
  final String currency;
  final int priceUnknownCount;
  final int supplierCount;
  final int pickupLocationCount;
  final bool deliveryFeeIncluded;

  bool get hasUnknownPrices => priceUnknownCount > 0;
}

class SmartBuildPlanItem {
  const SmartBuildPlanItem({
    required this.buildItemId,
    required this.requiredComponentId,
    required this.componentName,
    required this.requiredQuantity,
    required this.requiredUnit,
    required this.plannerState,
    this.acquisitionState,
    this.allocationResult,
    this.candidate,
    this.reasonTags = const [],
    this.uncoveredReason,
  });

  final String buildItemId;
  final String requiredComponentId;
  final String componentName;
  final double requiredQuantity;
  final String requiredUnit;
  final SmartBuildPlannerState plannerState;
  final String? acquisitionState;
  final String? allocationResult;
  final SmartBuildPlanCandidate? candidate;
  final List<SmartBuildReasonTag> reasonTags;
  final SmartBuildUncoveredReason? uncoveredReason;
}

class SmartBuildPlanCandidate {
  const SmartBuildPlanCandidate({
    required this.materialId,
    required this.title,
    required this.matchType,
    required this.matchHints,
    required this.allocatedQuantity,
    required this.unit,
    required this.availableQuantity,
    required this.isFree,
    required this.unitPrice,
    required this.lineSubtotal,
    required this.currency,
    required this.priceKnown,
    this.supplierProfileId,
    required this.locationId,
    required this.city,
    this.area,
    required this.pickupAllowed,
    required this.deliveryAllowed,
    this.imageUrl,
  });

  final String materialId;
  final String title;
  final String? imageUrl;
  final SmartBuildMatchType matchType;
  final List<String> matchHints;
  final double allocatedQuantity;
  final String unit;
  final double availableQuantity;
  final bool isFree;
  final double? unitPrice;
  final double? lineSubtotal;
  final String currency;
  final bool priceKnown;
  final String? supplierProfileId;
  final String locationId;
  final String city;
  final String? area;
  final bool pickupAllowed;
  final bool deliveryAllowed;
}
