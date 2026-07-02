import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/admin_portal/data/models/admin_dashboard_models.dart';

void main() {
  test('AdminDashboardResponse.fromJson parses dashboard payload', () {
    final dashboard = AdminDashboardResponse.fromJson({
      'summary': {
        'totalUsers': 10,
        'totalSuppliers': 3,
        'totalMaterials': 25,
        'availableMaterials': 12,
        'pendingApprovals': 4,
        'activeInvitations': 2,
        'completedReuse': 5,
        'activeDrivers': 1,
      },
      'pendingActions': {
        'supplierVerifications': 0,
        'categoryRequests': 2,
        'priceRequests': 1,
        'reports': 0,
      },
      'impact': {
        'reusedMaterials': 5,
        'completedReservations': 4,
        'learnersBenefited': 3,
        'suppliersContributed': 2,
        'topCategory': {
          'id': 'cat-1',
          'nameEn': 'Electronics',
          'nameAr': 'إلكترونيات',
          'reusedCount': 3,
        },
        'reuseByMonth': [
          {'month': '2026-01', 'count': 1},
          {'month': '2026-02', 'count': 0},
        ],
        'estimatedCo2Kg': 5.6,
        'estimatedCo2Label': '5.6 kg CO₂e',
        'estimatedCo2Method': 'Conservative MVP estimates',
        'reuseCompletionRate': 0.42,
        'co2ReuseProgress': 0.2,
      },
      'materialsByCategory': [
        {
          'id': 'cat-1',
          'nameEn': 'Electronics',
          'nameAr': 'إلكترونيات',
          'count': 10,
        },
      ],
      'reservationStatusBreakdown': [
        {'status': 'COMPLETED', 'count': 4},
      ],
      'recentInvitations': [
        {
          'id': 'inv-1',
          'targetEmail': 'driver@impactloop.test',
          'targetRole': 'DRIVER',
          'status': 'PENDING',
          'expiresAt': '2026-12-31T00:00:00.000Z',
          'createdAt': '2026-06-01T00:00:00.000Z',
        },
      ],
      'supplierVerificationPendingCount': 0,
      'supplierVerificationPreview': [],
      'recentActivity': [],
    });

    expect(dashboard.summary.totalUsers, 10);
    expect(dashboard.summary.activeDrivers, 1);
    expect(dashboard.impact.topCategory?.nameEn, 'Electronics');
    expect(dashboard.impact.reuseByMonth, hasLength(2));
    expect(dashboard.impact.estimatedCo2Kg, 5.6);
    expect(dashboard.impact.estimatedCo2Label, '5.6 kg CO₂e');
    expect(dashboard.impact.reuseCompletionRate, 0.42);
    expect(dashboard.impact.co2ReuseProgress, 0.2);
    expect(dashboard.materialsByCategory.first.count, 10);
    expect(dashboard.recentInvitations.first.targetRole, 'DRIVER');
  });
}
