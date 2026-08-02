import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/materials/application/material_listing_providers.dart';
import 'package:frontend/features/supplier_portal/application/supplier_material_requests_providers.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_material_request.dart';
import 'package:frontend/features/supplier_portal/presentation/l10n/supplier_l10n.dart';
import 'package:frontend/features/supplier_portal/presentation/pages/supplier_material_requests_page.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_locale_scope.dart';

void main() {
  group('SupplierMaterialRequest.fromJson', () {
    test('parses a feed item with candidates and own matches', () {
      final request = SupplierMaterialRequest.fromJson({
        'id': 'req-1',
        'categoryId': 'cat-1',
        'categoryNameEn': 'Electronics',
        'categoryNameAr': 'إلكترونيات',
        'requestedItemName': 'Arduino Uno',
        'description': 'For a robotics project',
        'quantity': 2,
        'unit': 'piece',
        'alternativesAllowed': true,
        'location': {'country': 'Palestine', 'city': 'Ramallah'},
        'status': 'OPEN',
        'expiresAt': '2026-08-30T00:00:00.000Z',
        'createdAt': '2026-07-01T00:00:00.000Z',
        'suggestionCount': 2,
        'respondedByMe': true,
        'ownMatches': [
          {
            'id': 'match-1',
            'materialId': 'mat-1',
            'status': 'SUGGESTED',
            'createdAt': '2026-07-02T00:00:00.000Z',
            'materialTitle': 'Arduino Uno R3',
          },
        ],
      });

      expect(request.isOpen, isTrue);
      expect(request.respondedByMe, isTrue);
      expect(request.ownMatches, hasLength(1));
      expect(request.ownMatches.single.isReserved, isFalse);
      expect(request.location.displayLabel, 'Ramallah');
    });
  });

  group('Learner material request privacy wording', () {
    test('privacy note never mentions exact address or contact details', () {
      final en = SupplierL10n.forLanguage('en');
      final ar = SupplierL10n.forLanguage('ar');

      expect(
        en.materialRequestPrivacyNote,
        contains('item, category, quantity, and general area'),
      );
      expect(en.materialRequestPrivacyNote, contains('never'));
      expect(ar.materialRequestPrivacyNote, contains('العنصر والفئة'));
      expect(ar.materialRequestPrivacyNote, isNotEmpty);
    });

    test('nav label and page title translate to the expected Arabic copy', () {
      final ar = SupplierL10n.forLanguage('ar');
      expect(ar.navLearnerMaterialRequests, 'طلبات المواد من المتعلمين');
      expect(ar.pageTitle('/supplier/material-requests'), ar.navLearnerMaterialRequests);
    });

    test('dashboard insight copy is bilingual', () {
      final en = SupplierL10n.forLanguage('en');
      final ar = SupplierL10n.forLanguage('ar');
      expect(en.learnerMaterialRequestsInsightMessage(1), contains('1'));
      expect(ar.learnerMaterialRequestsInsightMessage(2), contains('2'));
      expect(ar.reviewLearnerMaterialRequests, 'مراجعة الطلبات');
    });
  });

  group('SupplierMaterialRequestsPage', () {
    testWidgets('shows the empty state when the feed has no requests', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            supplierMaterialRequestsFeedProvider.overrideWith(
              (ref) async => const SupplierMaterialRequestListResult(
                items: [],
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 1,
              ),
            ),
            materialCategoriesProvider.overrideWith((ref) async => []),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const SupplierLocaleScope(
              languageCode: 'en',
              child: Scaffold(body: SupplierMaterialRequestsPage()),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      final en = SupplierL10n.forLanguage('en');
      expect(find.text(en.materialRequestsEmptyTitle), findsOneWidget);
      expect(find.text(en.materialRequestsEmptySubtitle), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders empty state under Arabic RTL directionality', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            supplierMaterialRequestsFeedProvider.overrideWith(
              (ref) async => const SupplierMaterialRequestListResult(
                items: [],
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 1,
              ),
            ),
            materialCategoriesProvider.overrideWith((ref) async => []),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const Directionality(
              textDirection: TextDirection.rtl,
              child: SupplierLocaleScope(
                languageCode: 'ar',
                child: Scaffold(body: SupplierMaterialRequestsPage()),
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      final ar = SupplierL10n.forLanguage('ar');
      expect(find.text(ar.materialRequestsEmptyTitle), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('shows the filtered empty state copy when filters are active', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            supplierMaterialRequestsQueryProvider.overrideWith(
              () => _UnansweredOnlyQueryNotifier(),
            ),
            supplierMaterialRequestsFeedProvider.overrideWith(
              (ref) async => const SupplierMaterialRequestListResult(
                items: [],
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 1,
              ),
            ),
            materialCategoriesProvider.overrideWith((ref) async => []),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const SupplierLocaleScope(
              languageCode: 'en',
              child: Scaffold(body: SupplierMaterialRequestsPage()),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      final en = SupplierL10n.forLanguage('en');
      expect(find.text(en.materialRequestsFilteredEmptyTitle), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}

class _UnansweredOnlyQueryNotifier extends SupplierMaterialRequestsQueryNotifier {
  @override
  SupplierMaterialRequestsQuery build() =>
      const SupplierMaterialRequestsQuery(unansweredByMe: true);
}
