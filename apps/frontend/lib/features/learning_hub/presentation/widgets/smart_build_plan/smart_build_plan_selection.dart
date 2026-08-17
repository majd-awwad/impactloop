import '../../../domain/models/smart_build_plan.dart';

SmartBuildPlanSelection? selectionFromPlan(SmartBuildPlan plan) {
  return SmartBuildPlanSelection(
    policyKey: plan.key,
    primaryLabel: plan.labels.isNotEmpty ? plan.labels.first : null,
  );
}

int resolveSelectedPlanIndex({
  required List<SmartBuildPlan> plans,
  SmartBuildPlanSelection? preferred,
  int fallbackIndex = 0,
}) {
  if (plans.isEmpty) {
    return 0;
  }

  if (preferred != null) {
    final byKey = plans.indexWhere((plan) => plan.key == preferred.policyKey);
    if (byKey >= 0) {
      return byKey;
    }

    final label = preferred.primaryLabel;
    if (label != null) {
      final byLabel = plans.indexWhere((plan) => plan.labels.contains(label));
      if (byLabel >= 0) {
        return byLabel;
      }
    }
  }

  final recommendedIndex = plans.indexWhere(
    (plan) => plan.labels.contains(SmartBuildPlanLabel.bestOverall),
  );
  if (recommendedIndex >= 0) {
    return recommendedIndex;
  }

  return fallbackIndex.clamp(0, plans.length - 1);
}

class SmartBuildPlanSelection {
  const SmartBuildPlanSelection({required this.policyKey, this.primaryLabel});

  final SmartBuildPlanPolicyKey policyKey;
  final SmartBuildPlanLabel? primaryLabel;
}
