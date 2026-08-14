import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/learning_hub/domain/models/smart_build_plan.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/smart_build_plan/smart_build_plan_selection.dart';

void main() {
  group('resolveSelectedPlanIndex', () {
    test('preserves cheapest selection when still available', () {
      final plans = [
        _plan(
          key: SmartBuildPlanPolicyKey.recommended,
          labels: [SmartBuildPlanLabel.bestOverall],
        ),
        _plan(
          key: SmartBuildPlanPolicyKey.cheapest,
          labels: [SmartBuildPlanLabel.cheapest],
        ),
      ];

      final index = resolveSelectedPlanIndex(
        plans: plans,
        preferred: const SmartBuildPlanSelection(
          policyKey: SmartBuildPlanPolicyKey.cheapest,
          primaryLabel: SmartBuildPlanLabel.cheapest,
        ),
      );

      expect(index, 1);
    });

    test('falls back to matching label when policy key disappears after merge', () {
      final plans = [
        _plan(
          key: SmartBuildPlanPolicyKey.recommended,
          labels: [
            SmartBuildPlanLabel.bestOverall,
            SmartBuildPlanLabel.cheapest,
          ],
        ),
      ];

      final index = resolveSelectedPlanIndex(
        plans: plans,
        preferred: const SmartBuildPlanSelection(
          policyKey: SmartBuildPlanPolicyKey.cheapest,
          primaryLabel: SmartBuildPlanLabel.cheapest,
        ),
      );

      expect(index, 0);
    });

    test('falls back to best overall when preferred plan disappears', () {
      final plans = [
        _plan(
          key: SmartBuildPlanPolicyKey.fewestPickups,
          labels: [SmartBuildPlanLabel.fewestPickupLocations],
        ),
      ];

      final index = resolveSelectedPlanIndex(
        plans: plans,
        preferred: const SmartBuildPlanSelection(
          policyKey: SmartBuildPlanPolicyKey.cheapest,
          primaryLabel: SmartBuildPlanLabel.cheapest,
        ),
      );

      expect(index, 0);
    });
  });
}

SmartBuildPlan _plan({
  required SmartBuildPlanPolicyKey key,
  required List<SmartBuildPlanLabel> labels,
}) {
  return SmartBuildPlan(
    key: key,
    labels: labels,
    summary: const SmartBuildPlanPlanSummary(
      newlyPlannedComponents: 1,
      totalCoveredComponents: 1,
      totalRequiredComponents: 1,
      uncoveredComponents: 0,
      materialSubtotal: 10,
      currency: 'ILS',
      priceUnknownCount: 0,
      supplierCount: 1,
      pickupLocationCount: 1,
      deliveryFeeIncluded: false,
    ),
    items: const [],
  );
}
