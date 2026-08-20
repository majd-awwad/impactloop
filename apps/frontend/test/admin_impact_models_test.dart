import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/admin_portal/data/models/admin_impact_models.dart';

void main() {
  test('AdminImpactAnalytics.fromJson parses the impact contract', () {
    final impact = AdminImpactAnalytics.fromJson({
      'verifiedImpact': {
        'completedReuseEvents': 5,
        'distinctMaterialsReused': 4,
        'learnersBenefited': 2,
        'suppliersContributed': 2,
      },
      'learningImpact': {
        'componentsFulfilled': 3,
        'buildsSupported': 2,
        'projectsSupported': 2,
      },
      'reuseByCategory': [
        {
          'nameEn': 'Electronics',
          'nameAr': 'إلكترونيات',
          'completedReuseEvents': 3,
        },
      ],
      'monthlyReuse': [
        {'month': '2026-08', 'completedReuseEvents': 5},
      ],
      'environmentalEstimate': {
        'estimatedCo2eKg': null,
        'estimatedCo2eLabel': null,
        'isEstimate': true,
        'includedReuseEvents': 0,
        'totalCompletedReuseEvents': 5,
        'coveragePercent': 0,
        'methodologyVersion': 'admin-impact-co2e-v2-mass-only',
        'unavailableReason': 'NO_ELIGIBLE_EVENTS',
      },
    });

    expect(impact.verifiedImpact.completedReuseEvents, 5);
    expect(impact.verifiedImpact.distinctMaterialsReused, 4);
    expect(impact.verifiedImpact.learnersBenefited, 2);
    expect(impact.verifiedImpact.suppliersContributed, 2);
    expect(impact.learningImpact.componentsFulfilled, 3);
    expect(impact.hasLearningImpact, isTrue);
    expect(impact.reuseByCategory.single.completedReuseEvents, 3);
    expect(impact.monthlyReuse.single.month, '2026-08');
    expect(impact.environmentalEstimate.isEstimate, isTrue);
    expect(impact.environmentalEstimate.isAvailable, isFalse);
    expect(impact.environmentalEstimate.coveragePercent, 0);
    expect(
      impact.environmentalEstimate.unavailableReason,
      'NO_ELIGIBLE_EVENTS',
    );
  });

  test('empty learning impact is omitted by hasLearningImpact', () {
    final impact = AdminImpactAnalytics.fromJson({
      'verifiedImpact': {
        'completedReuseEvents': 1,
        'distinctMaterialsReused': 1,
        'learnersBenefited': 1,
        'suppliersContributed': 1,
      },
      'learningImpact': {
        'componentsFulfilled': 0,
        'buildsSupported': 0,
        'projectsSupported': 0,
      },
      'reuseByCategory': [],
      'monthlyReuse': [],
      'environmentalEstimate': {
        'isEstimate': true,
        'includedReuseEvents': 0,
        'totalCompletedReuseEvents': 0,
        'coveragePercent': 0,
      },
    });

    expect(impact.hasLearningImpact, isFalse);
  });
}
