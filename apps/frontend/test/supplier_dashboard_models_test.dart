import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_dashboard.dart';

void main() {
  group('SupplierDashboard.fromJson', () {
    test('parses missing profile response with zero stats', () {
      final dashboard = SupplierDashboard.fromJson({
        'hasSupplierProfile': false,
        'message': 'Complete your supplier profile to start listing materials.',
        'stats': {
          'materials': {
            'total': 0,
            'available': 0,
            'pendingReservation': 0,
            'reserved': 0,
            'reused': 0,
            'unavailable': 0,
          },
          'reservations': {
            'pending': 0,
            'accepted': 0,
            'completed': 0,
            'rejected': 0,
            'cancelled': 0,
            'expired': 0,
          },
          'impact': {'reusedMaterials': 0, 'reusedQuantity': 0},
          'reviews': {'averageRating': 0, 'totalReviews': 0},
          'notifications': {'unread': 0},
          'engagement': {'totalViews': 0, 'totalLikes': 0, 'followersCount': 0},
          'operational': {'scheduledPickups': 0, 'activeMaterials': 0},
        },
        'recentMaterials': [],
        'upcomingPickups': [],
        'recentActivity': [],
        'recentReservationRequests': [],
        'mostViewedMaterial': null,
        'highDemandMaterials': [],
        'projectSupport': {
          'projectsSupported': 0,
          'projectComponentsSupported': 0,
          'learnerBuildsHelped': 0,
          'completedLinkedReservations': 0,
          'latestSupportedProjects': [],
        },
      });

      expect(dashboard.hasSupplierProfile, isFalse);
      expect(dashboard.message, isNotNull);
      expect(dashboard.supplier, isNull);
      expect(dashboard.stats.materials.total, 0);
      expect(dashboard.recentMaterials, isEmpty);
      expect(dashboard.projectSupport.projectsSupported, 0);
      expect(dashboard.projectSupport.hasImpact, isFalse);
    });

    test('parses populated dashboard response', () {
      final dashboard = SupplierDashboard.fromJson({
        'hasSupplierProfile': true,
        'supplier': {
          'id': 'sp1',
          'userId': 'u1',
          'publicName': 'ImpactLoop Supplier',
          'supplierType': 'INDIVIDUAL_SUPPLIER',
          'description': 'Optional description',
          'verificationStatus': 'PENDING',
          'defaultLocation': {
            'id': 'loc1',
            'city': 'Nablus',
            'area': 'Rafidia',
            'visibility': 'ORDER_ONLY',
            'isApproximate': true,
          },
        },
        'stats': {
          'materials': {
            'total': 2,
            'available': 1,
            'pendingReservation': 0,
            'reserved': 1,
            'reused': 0,
            'unavailable': 0,
          },
          'reservations': {
            'pending': 1,
            'accepted': 0,
            'completed': 0,
            'rejected': 0,
            'cancelled': 0,
            'expired': 0,
          },
          'impact': {'reusedMaterials': 0, 'reusedQuantity': 0},
          'reviews': {'averageRating': 4.5, 'totalReviews': 2},
          'notifications': {'unread': 3},
          'engagement': {
            'totalViews': 20,
            'totalLikes': 4,
            'followersCount': 2,
          },
          'operational': {'scheduledPickups': 1, 'activeMaterials': 1},
        },
        'recentMaterials': [
          {
            'id': 'm1',
            'title': 'Aluminum offcuts',
            'status': 'AVAILABLE',
            'quantity': 5,
            'unit': 'kg',
            'viewsCount': 12,
            'categoryName': 'Metal',
            'coverImageUrl': null,
            'createdAt': '2026-06-16T10:00:00.000Z',
          },
        ],
        'upcomingPickups': [],
        'recentActivity': [],
        'recentReservationRequests': [],
        'mostViewedMaterial': null,
        'highDemandMaterials': [],
        'projectSupport': {
          'projectsSupported': 2,
          'projectComponentsSupported': 3,
          'learnerBuildsHelped': 2,
          'completedLinkedReservations': 3,
          'latestSupportedProjects': [
            {
              'projectId': 'proj-1',
              'title': 'Solar charger',
              'categoryName': 'Electronics',
              'completedAt': '2026-07-01T10:00:00.000Z',
            },
            {
              'projectId': 'proj-2',
              'title': 'Line follower',
              'categoryName': 'Robotics',
              'completedAt': '2026-06-20T10:00:00.000Z',
            },
          ],
        },
      });
      expect(dashboard.supplier?.publicName, 'ImpactLoop Supplier');
      expect(dashboard.stats.materials.total, 2);
      expect(dashboard.stats.engagement.totalViews, 20);
      expect(dashboard.stats.reviews.averageRating, 4.5);
      expect(dashboard.recentMaterials, hasLength(1));
      expect(dashboard.projectSupport.projectsSupported, 2);
      expect(dashboard.projectSupport.projectComponentsSupported, 3);
      expect(dashboard.projectSupport.latestSupportedProjects, hasLength(2));
    });
  });
}
