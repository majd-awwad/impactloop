import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learner_material_requests/data/models/learner_material_request.dart';
import 'package:frontend/features/learner_material_requests/presentation/l10n/learner_material_requests_l10n.dart';
import 'package:frontend/features/learner_material_requests/presentation/pages/learner_material_request_form_page.dart';
import 'package:frontend/features/locations/application/saved_locations_providers.dart';
import 'package:frontend/features/locations/data/saved_location.dart';
import 'package:frontend/features/materials/application/material_listing_providers.dart';
import 'package:frontend/features/materials/data/models/category.dart';

void main() {
  group('LearnerMaterialRequest.fromJson', () {
    test('parses a full request payload including matches', () {
      final request = LearnerMaterialRequest.fromJson({
        'id': 'req-1',
        'categoryId': 'cat-1',
        'categoryNameEn': 'Electronics',
        'categoryNameAr': 'إلكترونيات',
        'requestedItemName': 'Arduino Uno',
        'description': 'Need it for a robotics project',
        'quantity': 2,
        'unit': 'piece',
        'alternativesAllowed': true,
        'location': {
          'country': 'Palestine',
          'city': 'Ramallah',
          'area': 'Al-Tireh',
        },
        'projectId': 'proj-1',
        'projectBuildId': 'build-1',
        'projectBuildItemId': 'item-1',
        'projectContext': {
          'title': 'Smart Home Hub',
          'componentName': 'Microcontroller',
        },
        'status': 'OPEN',
        'neededBy': '2026-08-15T00:00:00.000Z',
        'expiresAt': '2026-08-30T00:00:00.000Z',
        'createdAt': '2026-07-01T00:00:00.000Z',
        'updatedAt': '2026-07-02T00:00:00.000Z',
        'suggestionCount': 1,
        'matches': [
          {
            'id': 'match-1',
            'materialRequestId': 'req-1',
            'materialId': 'mat-1',
            'status': 'SUGGESTED',
            'matchReasonCode': 'CATEGORY_AND_KEYWORD',
            'rankingScore': 0.82,
            'reservationId': null,
            'createdAt': '2026-07-03T00:00:00.000Z',
            'updatedAt': '2026-07-03T00:00:00.000Z',
            'material': {
              'id': 'mat-1',
              'title': 'Arduino Uno R3',
              'status': 'AVAILABLE',
              'quantity': 5,
              'unit': 'piece',
              'pickupAllowed': true,
              'deliveryAllowed': false,
              'location': {'country': 'Palestine', 'city': 'Ramallah'},
              'supplierPublicName': 'Tech Reuse Hub',
            },
          },
        ],
      });

      expect(request.id, 'req-1');
      expect(request.requestedItemName, 'Arduino Uno');
      expect(request.quantity, 2);
      expect(request.location.displayLabel, 'Ramallah, Al-Tireh');
      expect(request.isOpen, isTrue);
      expect(request.projectContext?.title, 'Smart Home Hub');
      expect(request.matches, hasLength(1));

      final match = request.matches.single;
      expect(match.isSuggested, isTrue);
      expect(match.isDismissed, isFalse);
      expect(match.isReserved, isFalse);
      expect(match.material?.title, 'Arduino Uno R3');
      expect(request.activeMatches, hasLength(1));
    });

    test('applies safe defaults for missing/null fields', () {
      final request = LearnerMaterialRequest.fromJson({
        'id': 'req-2',
        'categoryId': 'cat-2',
        'requestedItemName': 'Plywood sheet',
        'status': 'FULFILLED',
      });

      expect(request.description, isNull);
      expect(request.quantity, 0);
      expect(request.unit, '');
      expect(request.alternativesAllowed, isTrue);
      expect(request.location.country, '');
      expect(request.location.city, '');
      expect(request.projectContext, isNull);
      expect(request.matches, isEmpty);
      expect(request.isFulfilled, isTrue);
      expect(request.isOpen, isFalse);
    });

    test('LearnerMaterialRequestListResult.fromJson parses pagination', () {
      final result = LearnerMaterialRequestListResult.fromJson({
        'items': [
          {
            'id': 'req-1',
            'categoryId': 'cat-1',
            'requestedItemName': 'Arduino Uno',
            'status': 'OPEN',
          },
        ],
        'page': 1,
        'limit': 20,
        'total': 45,
        'totalPages': 3,
      });

      expect(result.items, hasLength(1));
      expect(result.total, 45);
      expect(result.hasMore, isTrue);
    });

    test('LearnerMaterialRequestListResult.fromJson handles empty list', () {
      final result = LearnerMaterialRequestListResult.fromJson({
        'items': <Object?>[],
        'page': 1,
        'limit': 20,
        'total': 0,
        'totalPages': 1,
      });

      expect(result.items, isEmpty);
      expect(result.hasMore, isFalse);
    });
  });

  group('LearnerMaterialRequestsL10n.statusLabel', () {
    test('resolves known statuses in English and Arabic', () {
      expect(LearnerMaterialRequestsL10n.statusLabel('OPEN').en, 'Open');
      expect(LearnerMaterialRequestsL10n.statusLabel('OPEN').ar, 'مفتوح');
      expect(
        LearnerMaterialRequestsL10n.statusLabel('FULFILLED').en,
        'Fulfilled',
      );
      expect(
        LearnerMaterialRequestsL10n.statusLabel('CANCELLED').en,
        'Cancelled',
      );
      expect(
        LearnerMaterialRequestsL10n.statusLabel('EXPIRED').en,
        'Expired',
      );
    });

    test('falls back to the raw status for unknown values', () {
      final label = LearnerMaterialRequestsL10n.statusLabel('SOMETHING_NEW');
      expect(label.en, 'SOMETHING_NEW');
      expect(label.ar, 'SOMETHING_NEW');
    });
  });

  group('LearnerMaterialRequestFormPage', () {
    testWidgets('renders and prefills item name and category from query', (
      tester,
    ) async {
      const categories = [
        MaterialCategory(
          id: 'cat-1',
          nameEn: 'Electronics',
          nameAr: 'إلكترونيات',
          categoryType: 'MATERIAL',
        ),
      ];

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            materialCategoriesProvider.overrideWith(
              (ref) async => categories,
            ),
            savedLocationsProvider.overrideWith(
              (ref) async => const <SavedLocation>[],
            ),
          ],
          child: const MaterialApp(
            home: LearnerMaterialRequestFormPage(
              initialQuery: 'Arduino Uno',
              initialCategoryId: 'cat-1',
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Arduino Uno'), findsOneWidget);
      expect(
        find.text(LearnerMaterialRequestsL10n.createRequestTitle.en),
        findsWidgets,
      );
      expect(
        find.text(LearnerMaterialRequestsL10n.submitRequest.en),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    });
  });
}
