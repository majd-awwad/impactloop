import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/deliveries/data/saved_dropoff_addresses_repository.dart';
import 'package:frontend/features/material_discovery/domain/discovery_material.dart';
import 'package:frontend/features/material_discovery/presentation/widgets/material_reservation_dialog.dart';
import 'package:frontend/features/reservations/data/models/create_reservation_request.dart';
import 'package:frontend/features/reservations/data/models/reservation_quote.dart';
import 'package:frontend/features/reservations/data/reservations_repository.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_en.dart';
import 'package:frontend/shared/models/localized_text.dart';
import 'package:frontend/shared/widgets/materials/material_condition_badge.dart';
import 'package:frontend/shared/widgets/materials/material_status_badge.dart';

class _FakeReservationsRepository implements ReservationsRepository {
  _FakeReservationsRepository(this._quote, {this.isFree = false});

  final ReservationQuote _quote;
  final bool isFree;

  @override
  Future<ReservationQuote> fetchReservationQuote(
    ReservationQuoteRequest request,
  ) async {
    if (isFree) {
      return ReservationQuote(
        materialId: _quote.materialId,
        unitPrice: 0,
        quantity: request.quantity,
        materialSubtotal: 0,
        deliveryFee: 0,
        totalAmount: 0,
        currency: _quote.currency,
        fulfillmentMethod: request.fulfillmentMethod,
        paymentMethod: request.paymentMethod,
        canDeliver: true,
        groupingAvailable: false,
        groupingApplied: false,
      );
    }

    return ReservationQuote(
      materialId: _quote.materialId,
      unitPrice: _quote.unitPrice,
      quantity: request.quantity,
      materialSubtotal: _quote.unitPrice * request.quantity,
      deliveryFee: request.fulfillmentMethod == 'DELIVERY'
          ? _quote.deliveryFee
          : 0,
      totalAmount: request.fulfillmentMethod == 'DELIVERY'
          ? (_quote.unitPrice * request.quantity) + _quote.deliveryFee
          : _quote.unitPrice * request.quantity,
      currency: _quote.currency,
      fulfillmentMethod: request.fulfillmentMethod,
      paymentMethod: request.paymentMethod,
      canDeliver: true,
      groupingAvailable: false,
      groupingApplied: false,
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

DiscoveryMaterial _material({
  double availableQuantity = 20,
  bool isFree = false,
  bool pickupAllowed = true,
  bool deliveryAvailable = true,
}) {
  return DiscoveryMaterial(
    id: 'material-1',
    availableQuantity: availableQuantity,
    quantity: availableQuantity,
    unit: 'piece',
    title: const LocalizedText(en: 'Jumper Wires', ar: 'أسلاك توصيل'),
    description: const LocalizedText(en: 'Bundle', ar: 'حزمة'),
    category: const LocalizedText(en: 'Electronics', ar: 'إلكترونيات'),
    conditionLabel: const LocalizedText(en: 'Good', ar: 'جيد'),
    conditionTone: MaterialConditionBadgeTone.good,
    statusLabel: const LocalizedText(en: 'Available', ar: 'متاح'),
    statusTone: MaterialStatusBadgeTone.available,
    quantityLabel: const LocalizedText(en: '20', ar: '20'),
    priceLabel: const LocalizedText(en: '10 NIS', ar: '10 شيكل'),
    locationLabel: const LocalizedText(en: 'Ramallah', ar: 'رام الله'),
    availabilityLabel: const LocalizedText(en: 'Available', ar: 'متاح'),
    deliveryAvailable: deliveryAvailable,
    pickupAllowed: pickupAllowed,
    isFree: isFree,
    supplierName: const LocalizedText(en: 'Supplier', ar: 'مورد'),
    supplierSubtitle: const LocalizedText(en: 'Supplier', ar: 'مورد'),
    heroIconData: Icons.inventory_2_outlined,
    cardGradient: const [0xFF123456, 0xFF654321],
  );
}

Widget _wrap({
  required Widget child,
  required ReservationsRepository repository,
  Locale locale = const Locale('en'),
  Size size = const Size(390, 900),
}) {
  return ProviderScope(
    overrides: [
      reservationsRepositoryProvider.overrideWithValue(repository),
      savedDropoffAddressesProvider.overrideWith((ref) async => const []),
    ],
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: MediaQuery(
        data: MediaQueryData(size: size),
        child: Scaffold(body: child),
      ),
    ),
  );
}

Future<void> _pumpDialog(
  WidgetTester tester, {
  DiscoveryMaterial? material,
  double? initialQuantity,
  Locale locale = const Locale('en'),
  Size size = const Size(390, 900),
}) async {
  final resolvedMaterial = material ?? _material();
  final quote = ReservationQuote(
    materialId: 'material-1',
    unitPrice: 10,
    quantity: 1,
    materialSubtotal: 10,
    deliveryFee: 10,
    totalAmount: 20,
    currency: 'NIS',
    fulfillmentMethod: 'PICKUP',
    canDeliver: true,
    groupingAvailable: false,
    groupingApplied: false,
  );

  await tester.pumpWidget(
    _wrap(
      repository: _FakeReservationsRepository(
        quote,
        isFree: resolvedMaterial.isFree,
      ),
      locale: locale,
      size: size,
      child: Center(
        child: MaterialReservationDialog(
          material: resolvedMaterial,
          initialQuantity: initialQuantity,
          onSubmit: (_) async {},
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('defaults quantity to 1', (tester) async {
    await _pumpDialog(tester, material: _material(availableQuantity: 20));

    expect(
      find.byKey(const ValueKey('reservation-quantity-field')),
      findsOneWidget,
    );
    expect(
      tester
          .widget<TextFormField>(
            find.byKey(const ValueKey('reservation-quantity-field')),
          )
          .controller
          ?.text,
      '1',
    );
  });

  testWidgets('preserves build requested quantity', (tester) async {
    await _pumpDialog(
      tester,
      material: _material(availableQuantity: 20),
      initialQuantity: 5,
    );

    expect(
      tester
          .widget<TextFormField>(
            find.byKey(const ValueKey('reservation-quantity-field')),
          )
          .controller
          ?.text,
      '5',
    );
  });

  testWidgets('delivery with positive amount shows payment method before quote', (
    tester,
  ) async {
    await _pumpDialog(
      tester,
      material: _material(deliveryAvailable: true, pickupAllowed: true),
    );

    await tester.ensureVisible(
      find.byKey(const ValueKey('reservation-fulfillment-delivery')),
    );
    await tester.tap(
      find.byKey(const ValueKey('reservation-fulfillment-delivery')),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('reservation-payment-card')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('reservation-payment-cash')),
      findsOneWidget,
    );
  });

  testWidgets('pickup with positive amount shows payment method', (tester) async {
    await _pumpDialog(tester);

    expect(
      find.byKey(const ValueKey('reservation-payment-card')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('reservation-payment-cash')),
      findsOneWidget,
    );
  });

  testWidgets('free reservation hides payment method', (tester) async {
    await _pumpDialog(tester, material: _material(isFree: true));

    expect(
      find.byKey(const ValueKey('reservation-payment-card')),
      findsNothing,
    );
  });

  testWidgets('cash selection disables safe drop-off for delivery', (tester) async {
    await _pumpDialog(tester);

    await tester.ensureVisible(
      find.byKey(const ValueKey('reservation-fulfillment-delivery')),
    );
    await tester.tap(
      find.byKey(const ValueKey('reservation-fulfillment-delivery')),
    );
    await tester.pumpAndSettle();

    await tester.ensureVisible(
      find.byKey(const ValueKey('reservation-payment-cash')),
    );
    await tester.tap(find.byKey(const ValueKey('reservation-payment-cash')));
    await tester.pumpAndSettle();

    final switchFinder = find.byKey(
      const ValueKey('reservation-safe-dropoff-switch'),
    );
    expect(switchFinder, findsOneWidget);
    final switchWidget = tester.widget<SwitchListTile>(switchFinder);
    expect(switchWidget.value, isFalse);
    expect(switchWidget.onChanged, isNull);
  });

  testWidgets('delivery shows delivery fields and pickup hides them', (
    tester,
  ) async {
    await _pumpDialog(tester);

    expect(
      find.text(AppLocalizationsEn().reservationDeliveryDetails),
      findsNothing,
    );

    await tester.ensureVisible(
      find.byKey(const ValueKey('reservation-fulfillment-delivery')),
    );
    await tester.tap(
      find.byKey(const ValueKey('reservation-fulfillment-delivery')),
    );
    await tester.pumpAndSettle();
    expect(
      find.text(AppLocalizationsEn().reservationDeliveryDetails),
      findsOneWidget,
    );

    await tester.ensureVisible(
      find.byKey(const ValueKey('reservation-fulfillment-pickup')),
    );
    await tester.tap(
      find.byKey(const ValueKey('reservation-fulfillment-pickup')),
    );
    await tester.pumpAndSettle();
    expect(
      find.text(AppLocalizationsEn().reservationDeliveryDetails),
      findsNothing,
    );
  });

  testWidgets('preferred windows stay collapsed by default', (tester) async {
    await _pumpDialog(tester);

    expect(
      find.text(AppLocalizationsEn().reservationAddAnotherWindow),
      findsNothing,
    );
  });

  testWidgets('mobile layout exposes sticky submit action', (tester) async {
    await _pumpDialog(tester, size: const Size(360, 640));

    expect(
      find.byKey(const ValueKey('reservation-submit-button')),
      findsOneWidget,
    );
    expect(find.text(AppLocalizationsEn().sendRequest), findsOneWidget);
  });

  testWidgets('desktop layout shows form and summary side by side', (
    tester,
  ) async {
    await _pumpDialog(tester, size: const Size(1024, 900));
    await tester.pumpAndSettle();

    expect(
      find.text(AppLocalizationsEn().reservationOrderSummary),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('reservation-quantity-field')),
      findsOneWidget,
    );
  });

  testWidgets('arabic layout has no horizontal overflow on narrow width', (
    tester,
  ) async {
    await _pumpDialog(
      tester,
      locale: const Locale('ar'),
      size: const Size(360, 800),
    );

    expect(tester.takeException(), isNull);
    expect(
      find.byKey(const ValueKey('reservation-submit-button')),
      findsOneWidget,
    );
  });

  testWidgets('submit sends expected reservation payload', (tester) async {
    CreateReservationRequest? submitted;

    final quote = ReservationQuote(
      materialId: 'material-1',
      unitPrice: 10,
      quantity: 2,
      materialSubtotal: 20,
      deliveryFee: 0,
      totalAmount: 20,
      currency: 'NIS',
      fulfillmentMethod: 'PICKUP',
      canDeliver: false,
      groupingAvailable: false,
      groupingApplied: false,
    );

    await tester.pumpWidget(
      _wrap(
        repository: _FakeReservationsRepository(quote),
        child: MaterialReservationDialog(
          material: _material(),
          onSubmit: (request) async {
            submitted = request;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey('reservation-quantity-field')),
      '2',
    );
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('reservation-submit-button')));
    await tester.pumpAndSettle();

    expect(submitted, isNotNull);
    expect(submitted!.quantityRequested, 2);
    expect(submitted!.fulfillmentMethod, 'PICKUP');
    expect(submitted!.paymentMethod, 'CARD');
  });
}
