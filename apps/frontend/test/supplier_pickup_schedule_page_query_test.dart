import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_pickup_schedule_item.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_pickup_schedule_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/pages/supplier_pickup_schedule_page.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_locale_scope.dart';

void main() {
  testWidgets('Overdue and All send valid schedule classification queries', (
    tester,
  ) async {
    final queries = <SupplierScheduleQuery>[];
    const response = SupplierSchedulePage(
      items: [],
      pagination: SupplierScheduleApiPagination(
        page: 1,
        limit: 5,
        total: 0,
        totalPages: 0,
      ),
      summary: SupplierScheduleApiSummary(
        total: 0,
        unscheduledAction: 0,
        adminReview: 0,
        overdue: 0,
        inProgress: 0,
        today: 0,
        upcoming: 0,
        completed: 0,
        closed: 0,
        needsAttention: 0,
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          pickupSchedulePageProvider.overrideWith((ref, query) {
            queries.add(query);
            return response;
          }),
        ],
        child: MaterialApp(
          home: SupplierLocaleScope(
            languageCode: 'en',
            child: const Scaffold(body: SupplierPickupSchedulePage()),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Overdue').first);
    await tester.pumpAndSettle();
    final overdue = queries.last;

    expect(overdue.scope, 'ACTIVE');
    expect(overdue.category, 'OVERDUE');
    expect(overdue.dayStart, isNotNull);
    expect(overdue.dayEnd, isNotNull);
    expect(overdue.toQueryParameters(), containsPair('category', 'OVERDUE'));
    expect(
      overdue.toQueryParameters(),
      containsPair('dayStart', isA<String>()),
    );
    expect(overdue.toQueryParameters(), containsPair('dayEnd', isA<String>()));

    await tester.tap(find.text('All').first);
    await tester.pumpAndSettle();
    final all = queries.last;

    expect(all.scope, 'ALL');
    expect(all.category, isNull);
    expect(all.dayStart, isNotNull);
    expect(all.dayEnd, isNotNull);
    expect(all.toQueryParameters(), isNot(contains('category')));
    expect(all.toQueryParameters(), containsPair('dayStart', isA<String>()));
    expect(all.toQueryParameters(), containsPair('dayEnd', isA<String>()));
  });
}
