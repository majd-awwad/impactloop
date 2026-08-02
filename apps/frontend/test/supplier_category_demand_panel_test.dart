import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_category_demand.dart';
import 'package:frontend/features/supplier_portal/presentation/l10n/supplier_l10n.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_locale_scope.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/dashboard/supplier_category_demand_panel.dart';

SupplierCategoryDemandItem _item({
  required String id,
  required String en,
  required String ar,
  required SupplierCategoryDemandLevel level,
  required SupplierCategoryDemandReason reason,
  int views = 10,
  int likes = 3,
  int reservations = 2,
  int score = 50,
}) {
  return SupplierCategoryDemandItem(
    categoryId: id,
    categoryNameEn: en,
    categoryNameAr: ar,
    demandLevel: level,
    score: score,
    signals: SupplierCategoryDemandSignals(
      views: views,
      likes: likes,
      reservations: reservations,
    ),
    primaryReason: reason,
  );
}

SupplierCategoryDemandResult _result({
  List<SupplierCategoryDemandItem>? items,
  List<String>? summaryIds,
  SupplierCategoryDemandEmptyReason empty =
      SupplierCategoryDemandEmptyReason.none,
}) {
  final resolvedItems = items ?? const <SupplierCategoryDemandItem>[];
  return SupplierCategoryDemandResult(
    period: const SupplierCategoryDemandPeriod(
      days: 30,
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-31T00:00:00.000Z',
    ),
    methodologyVersion: 'category-demand-v1',
    source: 'PLATFORM_LEARNER_ACTIVITY',
    summaryTopCategoryIds:
        summaryIds ??
        resolvedItems.map((item) => item.categoryId).take(3).toList(),
    items: resolvedItems,
    emptyStateReason: empty,
  );
}

void main() {
  group('SupplierCategoryDemand parsing and localization', () {
    test('parses json safely with missing optional fields', () {
      final result = SupplierCategoryDemandResult.fromJson({
        'period': {'days': 30},
        'methodology': {'version': 'category-demand-v1'},
        'summaryTopCategoryIds': ['a'],
        'items': [
          {
            'categoryId': 'a',
            'demandLevel': 'HIGH',
            'primaryReason': 'STRONG_RESERVATION_ACTIVITY',
          },
        ],
        'emptyStateReason': null,
      });

      expect(result.items.single.categoryNameEn, '');
      expect(result.items.single.signals.views, 0);
      expect(result.items.single.demandLevel, SupplierCategoryDemandLevel.high);
    });

    test('unknown reason and level fall back gracefully', () {
      expect(
        SupplierCategoryDemandReason.parse('FUTURE_REASON'),
        SupplierCategoryDemandReason.unknown,
      );
      expect(
        SupplierCategoryDemandLevel.parse('SUPER_HIGH'),
        SupplierCategoryDemandLevel.unknown,
      );
      final en = SupplierL10n.forLanguage('en');
      expect(
        en.categoryDemandReason(SupplierCategoryDemandReason.unknown),
        'Recent learner activity',
      );
      expect(
        en.categoryDemandLevelLabel(SupplierCategoryDemandLevel.unknown),
        'Interest level unavailable',
      );
    });

    test('localized names prefer language with fallback', () {
      final item = _item(
        id: 'c1',
        en: 'Electronics',
        ar: 'إلكترونيات',
        level: SupplierCategoryDemandLevel.high,
        reason: SupplierCategoryDemandReason.strongReservationActivity,
      );
      expect(item.localizedName('en'), 'Electronics');
      expect(item.localizedName('ar'), 'إلكترونيات');

      final missingAr = _item(
        id: 'c2',
        en: 'Wood',
        ar: '',
        level: SupplierCategoryDemandLevel.moderate,
        reason: SupplierCategoryDemandReason.likeEngagement,
      );
      expect(missingAr.localizedName('ar'), 'Wood');
    });

    test('English and Arabic summaries for 1–3 categories', () {
      final en = SupplierL10n.forLanguage('en');
      final ar = SupplierL10n.forLanguage('ar');

      expect(
        en.categoryDemandSummary(['Electronics']),
        'Electronics is receiving the strongest learner interest during the last 30 days.',
      );
      expect(
        en.categoryDemandSummary(['Electronics', 'Wood']),
        'Electronics and Wood are receiving the strongest learner interest during the last 30 days.',
      );
      expect(
        en.categoryDemandSummary(['Electronics', 'Wood', 'Fabric']),
        'Electronics, Wood, and Fabric are receiving the strongest learner interest during the last 30 days.',
      );

      expect(
        ar.categoryDemandSummary(['الإلكترونيات']),
        'تحظى فئة الإلكترونيات بأعلى اهتمام من المتعلمين خلال آخر 30 يومًا.',
      );
      expect(
        ar.categoryDemandSummary(['الإلكترونيات', 'الخشب']),
        'تحظى فئتا الإلكترونيات والخشب بأعلى اهتمام من المتعلمين خلال آخر 30 يومًا.',
      );
      expect(
        ar.categoryDemandSummary(['الإلكترونيات', 'الخشب', 'الأقمشة']),
        'تحظى فئات الإلكترونيات والخشب والأقمشة بأعلى اهتمام من المتعلمين خلال آخر 30 يومًا.',
      );
    });

    test('demand level and reason localization', () {
      final en = SupplierL10n.forLanguage('en');
      final ar = SupplierL10n.forLanguage('ar');

      expect(
        en.categoryDemandLevelLabel(SupplierCategoryDemandLevel.high),
        'High interest',
      );
      expect(
        en.categoryDemandLevelLabel(SupplierCategoryDemandLevel.moderate),
        'Moderate interest',
      );
      expect(
        en.categoryDemandLevelLabel(SupplierCategoryDemandLevel.emerging),
        'Emerging interest',
      );
      expect(
        ar.categoryDemandLevelLabel(SupplierCategoryDemandLevel.high),
        'اهتمام مرتفع',
      );
      expect(
        ar.categoryDemandLevelLabel(SupplierCategoryDemandLevel.moderate),
        'اهتمام متوسط',
      );
      expect(
        ar.categoryDemandLevelLabel(SupplierCategoryDemandLevel.emerging),
        'اهتمام ناشئ',
      );

      expect(
        en.categoryDemandReason(
          SupplierCategoryDemandReason.strongReservationActivity,
        ),
        contains('reservations'),
      );
      expect(
        en.categoryDemandReason(SupplierCategoryDemandReason.balancedEngagement),
        contains('views'),
      );
      expect(
        en.categoryDemandReason(SupplierCategoryDemandReason.likeEngagement),
        contains('like'),
      );
      expect(
        en.categoryDemandReason(SupplierCategoryDemandReason.viewEngagement),
        contains('view'),
      );
      expect(
        en.categoryDemandReason(
          SupplierCategoryDemandReason.limitedRecentActivity,
        ),
        contains('Limited'),
      );

      final wording = [
        en.categoryDemandTitle,
        en.categoryDemandSubtitle,
        en.categoryDemandSummary(['Electronics']),
        en.categoryDemandReason(
          SupplierCategoryDemandReason.strongReservationActivity,
        ),
      ].join(' ');
      expect(wording.toLowerCase().contains('request'), isFalse);
      expect(wording.toLowerCase().contains('save'), isFalse);
    });
  });

  group('SupplierCategoryDemandPanelContent', () {
    testWidgets('shows ranked categories, signals, and two-category summary', (
      tester,
    ) async {
      final result = _result(
        items: [
          _item(
            id: '1',
            en: 'Electronics',
            ar: 'إلكترونيات',
            level: SupplierCategoryDemandLevel.high,
            reason: SupplierCategoryDemandReason.strongReservationActivity,
            views: 42,
            likes: 13,
            reservations: 7,
          ),
          _item(
            id: '2',
            en: 'Wood',
            ar: 'خشب',
            level: SupplierCategoryDemandLevel.moderate,
            reason: SupplierCategoryDemandReason.balancedEngagement,
          ),
        ],
      );

      await tester.pumpWidget(
        _wrap(SupplierCategoryDemandPanelContent(result: result)),
      );
      await tester.pumpAndSettle();

      expect(
        find.text(
          'Electronics and Wood are receiving the strongest learner interest during the last 30 days.',
        ),
        findsOneWidget,
      );
      expect(find.text('Electronics'), findsOneWidget);
      expect(find.text('Wood'), findsOneWidget);
      expect(find.text('High interest'), findsOneWidget);
      expect(find.text('Moderate interest'), findsOneWidget);
      expect(find.text('42 views'), findsOneWidget);
      expect(find.text('13 likes'), findsOneWidget);
      expect(find.text('7 reservations'), findsOneWidget);
      expect(find.textContaining('%'), findsNothing);
    });

    testWidgets('period label and one-category summary on panel', (tester) async {
      await tester.pumpWidget(
        _wrap(
          SupplierCategoryDemandPanel(
            debugAsyncOverride: AsyncValue.data(
              _result(
                items: [
                  _item(
                    id: '1',
                    en: 'Electronics',
                    ar: 'إلكترونيات',
                    level: SupplierCategoryDemandLevel.emerging,
                    reason: SupplierCategoryDemandReason.viewEngagement,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Learner interest by category'), findsOneWidget);
      expect(find.text('Last 30 days'), findsOneWidget);
      expect(
        find.text(
          'Electronics is receiving the strongest learner interest during the last 30 days.',
        ),
        findsOneWidget,
      );
      expect(find.text('Emerging interest'), findsOneWidget);
    });

    testWidgets('Arabic category names and RTL summary', (tester) async {
      final result = _result(
        items: [
          _item(
            id: '1',
            en: 'Electronics',
            ar: 'الإلكترونيات',
            level: SupplierCategoryDemandLevel.high,
            reason: SupplierCategoryDemandReason.strongReservationActivity,
          ),
          _item(
            id: '2',
            en: 'Wood',
            ar: 'الخشب',
            level: SupplierCategoryDemandLevel.moderate,
            reason: SupplierCategoryDemandReason.likeEngagement,
          ),
        ],
      );

      await tester.pumpWidget(
        _wrap(
          SupplierCategoryDemandPanelContent(result: result, languageCode: 'ar'),
          languageCode: 'ar',
          textDirection: TextDirection.rtl,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('الإلكترونيات'), findsWidgets);
      expect(find.text('الخشب'), findsOneWidget);
      expect(
        find.text(
          'تحظى فئتا الإلكترونيات والخشب بأعلى اهتمام من المتعلمين خلال آخر 30 يومًا.',
        ),
        findsOneWidget,
      );
      expect(find.text('اهتمام مرتفع'), findsOneWidget);
    });

    testWidgets('long category names render without crashing', (tester) async {
      const longName =
          'Very long electronics and recycled components category name for layout';
      await tester.pumpWidget(
        _wrap(
          SizedBox(
            width: 280,
            child: SupplierCategoryDemandPanelContent(
              result: _result(
                items: [
                  _item(
                    id: '1',
                    en: longName,
                    ar: longName,
                    level: SupplierCategoryDemandLevel.emerging,
                    reason: SupplierCategoryDemandReason.limitedRecentActivity,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('Very long electronics'), findsWidgets);
    });

    testWidgets('empty states', (tester) async {
      await tester.pumpWidget(
        _wrap(
          SupplierCategoryDemandPanelContent(
            result: _result(
              empty: SupplierCategoryDemandEmptyReason.noRecentActivity,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.textContaining('not enough recent learner activity'),
        findsOneWidget,
      );

      await tester.pumpWidget(
        _wrap(
          SupplierCategoryDemandPanelContent(
            result: _result(
              empty: SupplierCategoryDemandEmptyReason.noActiveCategories,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.textContaining('No active material categories'),
        findsOneWidget,
      );
    });

    testWidgets('error state exposes retry', (tester) async {
      var retries = 0;
      await tester.pumpWidget(
        ProviderScope(
          child: _wrap(
            SupplierCategoryDemandPanel(
              debugAsyncOverride: AsyncValue<SupplierCategoryDemandResult>.error(
                Exception('boom'),
                StackTrace.current,
              ),
              debugOnRetry: () => retries += 1,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.textContaining('Could not load category interest'),
        findsOneWidget,
      );
      expect(find.text('Retry'), findsOneWidget);
      await tester.tap(find.text('Retry'));
      await tester.pump();
      expect(retries, 1);
    });

    testWidgets('loading skeleton keeps title visible', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const SupplierCategoryDemandPanel(
            debugAsyncOverride: AsyncValue<SupplierCategoryDemandResult>.loading(),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('Learner interest by category'), findsOneWidget);
      expect(find.text('Retry'), findsNothing);
    });

    testWidgets('unknown reason/level fallbacks render', (tester) async {
      await tester.pumpWidget(
        _wrap(
          SupplierCategoryDemandPanelContent(
            result: _result(
              items: [
                _item(
                  id: '1',
                  en: 'Fabric',
                  ar: '',
                  level: SupplierCategoryDemandLevel.unknown,
                  reason: SupplierCategoryDemandReason.unknown,
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Fabric'), findsOneWidget);
      expect(find.text('Interest level unavailable'), findsOneWidget);
      expect(find.text('Recent learner activity'), findsOneWidget);
    });

    testWidgets('three-category English summary', (tester) async {
      await tester.pumpWidget(
        _wrap(
          SupplierCategoryDemandPanelContent(
            result: _result(
              items: [
                _item(
                  id: '1',
                  en: 'Electronics',
                  ar: 'إلكترونيات',
                  level: SupplierCategoryDemandLevel.high,
                  reason: SupplierCategoryDemandReason.strongReservationActivity,
                ),
                _item(
                  id: '2',
                  en: 'Wood',
                  ar: 'خشب',
                  level: SupplierCategoryDemandLevel.moderate,
                  reason: SupplierCategoryDemandReason.balancedEngagement,
                ),
                _item(
                  id: '3',
                  en: 'Fabric',
                  ar: 'أقمشة',
                  level: SupplierCategoryDemandLevel.emerging,
                  reason: SupplierCategoryDemandReason.viewEngagement,
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Electronics, Wood, and Fabric are receiving the strongest learner interest during the last 30 days.',
        ),
        findsOneWidget,
      );
    });
  });
}

Widget _wrap(
  Widget child, {
  String languageCode = 'en',
  TextDirection textDirection = TextDirection.ltr,
}) {
  return MaterialApp(
    home: Directionality(
      textDirection: textDirection,
      child: SupplierLocaleScope(
        languageCode: languageCode,
        child: Scaffold(body: SingleChildScrollView(child: child)),
      ),
    ),
  );
}
