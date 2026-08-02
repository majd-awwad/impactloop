import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/driver_portal/application/driver_archive_provider.dart';
import 'package:frontend/features/driver_portal/application/driver_deliveries_provider.dart';
import 'package:frontend/features/driver_portal/data/models/driver_archive.dart';
import 'package:frontend/features/driver_portal/data/models/driver_deliveries_list_result.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery_inactive_context.dart';
import 'package:frontend/features/driver_portal/presentation/pages/driver_delivery_detail_page.dart';
import 'package:frontend/features/driver_portal/presentation/pages/driver_history_detail_page.dart';
import 'package:frontend/features/driver_portal/presentation/pages/driver_history_page.dart';
import 'package:frontend/l10n/app_localizations.dart';

void main() {
  testWidgets('History shows loading, empty, error, and retry states', (
    tester,
  ) async {
    final pending = Completer<DriverArchivePage<DriverHistoricalDelivery>>();
    await pumpHistory(
      tester,
      historyFetcher: ({String? cursor, int limit = 20}) => pending.future,
    );
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    pending.complete(historyPage(const []));
    await tester.pumpAndSettle();
    expect(find.text('No historical deliveries yet.'), findsOneWidget);

    var calls = 0;
    await pumpHistory(
      tester,
      historyFetcher: ({String? cursor, int limit = 20}) async {
        calls += 1;
        if (calls == 1) throw Exception('temporary');
        return historyPage(const []);
      },
    );
    await tester.pumpAndSettle();
    expect(find.text('Could not load this archive.'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(calls, 2);
    expect(find.text('No historical deliveries yet.'), findsOneWidget);
  });

  testWidgets('Reports shows loading, empty, error, and retry states', (
    tester,
  ) async {
    var calls = 0;
    await pumpHistory(
      tester,
      initialTab: 1,
      incidentsFetcher: ({String? cursor, int limit = 20}) async {
        calls += 1;
        if (calls == 1) throw Exception('temporary');
        return incidentPage(const []);
      },
    );
    await tester.pumpAndSettle();
    expect(find.text('Could not load this archive.'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(calls, 2);
    expect(find.text('You have not submitted any reports yet.'), findsOneWidget);
  });

  testWidgets('historical detail is read-only and renders every unpicked item', (
    tester,
  ) async {
    await tester.pumpWidget(localizedApp(
      locale: const Locale('en'),
      child: Scaffold(
        body: SingleChildScrollView(
          child: DriverHistoricalDeliveryContent(
            delivery: delivery('delivery-1', withUnpicked: true),
          ),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Read only'), findsOneWidget);
    expect(find.text('Not picked up'), findsOneWidget);
    expect(find.textContaining('Material missing'), findsOneWidget);
    expect(find.textContaining('Driver-authored note'), findsOneWidget);
    expect(find.byType(FilledButton), findsNothing);
    expect(find.byIcon(Icons.location_searching_rounded), findsNothing);
    expect(find.bySemanticsLabel(RegExp('Not picked up: Metal')), findsOneWidget);
  });

  testWidgets('old notification Delivery link renders the historical detail', (
    tester,
  ) async {
    final historical = delivery('delivery-old-link', withUnpicked: true);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          driverDeliveryDetailProvider.overrideWith(
            (ref, id) async => DriverDeliveryDetailInactive(
              const DriverDeliveryInactiveContext(
                deliveryId: 'delivery-old-link',
                isActive: false,
                status: 'DELIVERED',
                closureReason: 'NO_LONGER_ACTIVE',
              ),
              historical,
            ),
          ),
        ],
        child: localizedApp(
          locale: const Locale('en'),
          child: const Scaffold(
            body: DriverDeliveryDetailPage(deliveryId: 'delivery-old-link'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Historical delivery'), findsOneWidget);
    expect(find.text('Read only'), findsOneWidget);
    expect(find.byType(FilledButton), findsNothing);
  });

  testWidgets('History supports Arabic RTL at 320px and 1.6x text', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    tester.view.physicalSize = const Size(320, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await pumpHistory(
      tester,
      locale: const Locale('ar'),
      textScale: 1.6,
      historyFetcher: ({String? cursor, int limit = 20}) async =>
          historyPage([delivery('delivery-ar')]),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(Directionality.of(tester.element(find.byType(DriverHistoryPage))), TextDirection.rtl);
    expect(find.bySemanticsLabel(RegExp('فتح التوصيل السابق')), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('History supports wide English LTR at 1.3x text and semantics', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    tester.view.physicalSize = const Size(1280, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await pumpHistory(
      tester,
      textScale: 1.3,
      historyFetcher: ({String? cursor, int limit = 20}) async =>
          historyPage([delivery('delivery-en')]),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(Directionality.of(tester.element(find.byType(DriverHistoryPage))), TextDirection.ltr);
    expect(find.bySemanticsLabel(RegExp('Open historical delivery')), findsOneWidget);
    expect(find.byType(SegmentedButton<int>), findsOneWidget);
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
    expect(FocusManager.instance.primaryFocus, isNotNull);
    semantics.dispose();
  });
}

Future<void> pumpHistory(
  WidgetTester tester, {
  int initialTab = 0,
  Locale locale = const Locale('en'),
  double textScale = 1,
  DriverHistoryFetcher? historyFetcher,
  DriverIncidentsFetcher? incidentsFetcher,
}) => tester.pumpWidget(
  ProviderScope(
    key: UniqueKey(),
    overrides: [
      driverHistoryFetcherProvider.overrideWithValue(
        historyFetcher ??
            ({String? cursor, int limit = 20}) async => historyPage(const []),
      ),
      driverIncidentsFetcherProvider.overrideWithValue(
        incidentsFetcher ??
            ({String? cursor, int limit = 20}) async => incidentPage(const []),
      ),
    ],
    child: localizedApp(
      locale: locale,
      textScale: textScale,
      child: Scaffold(body: DriverHistoryPage(initialTab: initialTab)),
    ),
  ),
);

Widget localizedApp({
  required Locale locale,
  required Widget child,
  double textScale = 1,
}) => MaterialApp(
  locale: locale,
  supportedLocales: AppLocalizations.supportedLocales,
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  builder: (context, child) => MediaQuery(
    data: MediaQuery.of(context).copyWith(
      textScaler: TextScaler.linear(textScale),
    ),
    child: child!,
  ),
  home: child,
);

DriverArchivePage<DriverHistoricalDelivery> historyPage(
  List<DriverHistoricalDelivery> items,
) => DriverArchivePage(
  items: items,
  pagination: const DriverDeliveriesPagination(limit: 20, hasMore: false),
);

DriverArchivePage<DriverIncident> incidentPage(List<DriverIncident> items) =>
    DriverArchivePage(
      items: items,
      pagination: const DriverDeliveriesPagination(limit: 20, hasMore: false),
    );

DriverHistoricalDelivery delivery(String id, {bool withUnpicked = false}) =>
    DriverHistoricalDelivery(
      id: id,
      status: 'DELIVERED',
      historicalAt: DateTime.utc(2026, 8, 2),
      assignmentOutcome: 'CLOSED',
      supplier: const DriverDeliveryParty(displayName: 'Supplier'),
      pickupLocation: const DriverSafeLocation(city: 'Hebron', area: 'North'),
      dropoffLocation: const DriverSafeLocation(city: 'Nablus', area: 'South'),
      carriedItems: const [
        DriverHistoricalCarriedItem(
          reservationId: 'reservation-1',
          materialId: 'material-1',
          materialTitle: 'Wood',
          quantity: 2,
          unit: 'kg',
        ),
      ],
      unpickedItems: withUnpicked
          ? [
              DriverHistoricalUnpickedItem(
                reservationId: 'reservation-2',
                materialId: 'material-2',
                materialTitle: 'Metal',
                quantity: 1,
                unit: 'kg',
                unpickedReason: 'MATERIAL_MISSING',
                driverNote: 'Driver-authored note',
                recordedAt: DateTime.utc(2026, 8, 2),
                recordedAtRequired: DateTime.utc(2026, 8, 2),
              ),
            ]
          : const [],
      partialPickupOccurred: withUnpicked,
      itemAuditComplete: true,
      timeline: const [],
    );
