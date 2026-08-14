import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/deliveries/data/models/saved_dropoff_address.dart';
import 'package:frontend/features/material_discovery/presentation/widgets/reservation_form/reservation_delivery_details_section.dart';
import 'package:frontend/features/material_discovery/presentation/widgets/reservation_form/reservation_saved_address_selector.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_en.dart';

SavedDropoffAddress _address({
  required String id,
  required String label,
  bool isDefault = false,
  String city = 'Hebron',
  String? area = 'University District',
  String? addressLine,
}) {
  return SavedDropoffAddress(
    id: id,
    label: label,
    isDefault: isDefault,
    location: SavedDropoffLocation(
      country: 'Palestine',
      city: city,
      area: area,
      addressLine: addressLine,
    ),
    createdAt: DateTime(2026, 1, 1),
    updatedAt: DateTime(2026, 1, 1),
  );
}

Widget _wrap({
  required Widget child,
  Locale locale = const Locale('en'),
  Size size = const Size(390, 640),
}) {
  return MaterialApp(
    locale: locale,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: MediaQuery(
      data: MediaQueryData(size: size),
      child: Scaffold(
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: child,
        ),
      ),
    ),
  );
}

void main() {
  group('formatSavedAddressSecondaryLine', () {
    test('joins city and area with middle dot', () {
      final line = formatSavedAddressSecondaryLine(
        const SavedDropoffLocation(
          country: 'Palestine',
          city: 'Hebron',
          area: 'Ein Sara',
        ),
      );

      expect(line, 'Hebron · Ein Sara');
    });
  });

  group('ReservationSavedAddressSelector', () {
    testWidgets('selected saved address renders structured layout', (
      tester,
    ) async {
      final addresses = [
        _address(
          id: 'default',
          label: 'Default learner dropoff',
          isDefault: true,
          area: 'University District',
        ),
        _address(id: 'home', label: 'Home', city: 'Nablus', area: 'Old City'),
      ];

      await tester.pumpWidget(
        _wrap(
          child: ReservationSavedAddressSelector(
            addresses: addresses,
            selectedAddressId: 'default',
            onAddressSelected: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.location_on_outlined), findsOneWidget);
      expect(find.text('Default learner dropoff'), findsOneWidget);
      expect(find.text('Hebron · University District'), findsOneWidget);
      expect(
        find.byKey(const ValueKey('reservation-saved-address-dropdown')),
        findsOneWidget,
      );
    });

    testWidgets('default badge appears only for default address', (
      tester,
    ) async {
      final addresses = [
        _address(id: 'default', label: 'Default dropoff', isDefault: true),
        _address(id: 'home', label: 'Home', isDefault: false),
      ];

      await tester.pumpWidget(
        _wrap(
          child: ReservationSavedAddressSelector(
            addresses: addresses,
            selectedAddressId: 'default',
            onAddressSelected: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.byKey(
          const ValueKey('reservation-saved-address-default-badge-default'),
        ),
        findsOneWidget,
      );
      expect(find.text(AppLocalizationsEn().savedAddressDefaultBadge), findsOneWidget);
      expect(
        find.byKey(
          const ValueKey('reservation-saved-address-default-badge-home'),
        ),
        findsNothing,
      );

      await tester.tap(
        find.byKey(const ValueKey('reservation-saved-address-dropdown')),
      );
      await tester.pumpAndSettle();

      expect(
        find.byKey(
          const ValueKey('reservation-saved-address-default-badge-default'),
        ),
        findsNWidgets(2),
      );
      expect(
        find.byKey(
          const ValueKey('reservation-saved-address-default-badge-home'),
        ),
        findsNothing,
      );
    });

    testWidgets('dropdown opens and displays structured options', (
      tester,
    ) async {
      final addresses = [
        _address(id: 'default', label: 'Default learner dropoff', isDefault: true),
        _address(id: 'home', label: 'Home', area: 'Ein Sara'),
      ];
      SavedDropoffAddress? selected;

      await tester.pumpWidget(
        _wrap(
          child: ReservationSavedAddressSelector(
            addresses: addresses,
            selectedAddressId: 'default',
            onAddressSelected: (address) => selected = address,
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(
        find.byKey(const ValueKey('reservation-saved-address-dropdown')),
      );
      await tester.pumpAndSettle();

      expect(
        find.byKey(
          const ValueKey('reservation-saved-address-option-home'),
        ),
        findsOneWidget,
      );
      expect(find.text('Home'), findsWidgets);
      expect(find.text('Hebron · Ein Sara'), findsOneWidget);

      await tester.tap(
        find.byKey(
          const ValueKey('reservation-saved-address-option-home'),
        ),
      );
      await tester.pumpAndSettle();

      expect(selected?.id, 'home');
    });

    testWidgets('selected option shows check state in menu', (tester) async {
      final addresses = [
        _address(id: 'default', label: 'Default dropoff', isDefault: true),
        _address(id: 'home', label: 'Home'),
      ];

      await tester.pumpWidget(
        _wrap(
          child: ReservationSavedAddressSelector(
            addresses: addresses,
            selectedAddressId: 'default',
            onAddressSelected: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(
        find.byKey(const ValueKey('reservation-saved-address-dropdown')),
      );
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
    });

    testWidgets('single saved address renders polished display without menu', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          child: ReservationSavedAddressSelector(
            addresses: [
              _address(id: 'only', label: 'Only address', isDefault: true),
            ],
            selectedAddressId: 'only',
            onAddressSelected: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.byKey(const ValueKey('reservation-saved-address-display')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey('reservation-saved-address-dropdown')),
        findsNothing,
      );
      expect(find.byIcon(Icons.keyboard_arrow_down_rounded), findsNothing);
      expect(find.text('Only address'), findsOneWidget);
    });

    testWidgets('arabic RTL layout has no horizontal overflow', (tester) async {
      await tester.pumpWidget(
        _wrap(
          locale: const Locale('ar'),
          size: const Size(360, 640),
          child: ReservationSavedAddressSelector(
            addresses: [
              _address(
                id: 'default',
                label: 'عنوان التوصيل الافتراضي',
                isDefault: true,
                city: 'الخليل',
                area: 'الحرم',
              ),
              _address(
                id: 'home',
                label: 'المنزل',
                city: 'نابلس',
                area: 'البلد القديمة',
              ),
            ],
            selectedAddressId: 'default',
            onAddressSelected: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('الافتراضي'), findsOneWidget);
    });

    testWidgets('mobile width has no horizontal overflow', (tester) async {
      await tester.pumpWidget(
        _wrap(
          size: const Size(360, 640),
          child: ReservationSavedAddressSelector(
            addresses: [
              _address(
                id: 'default',
                label: 'Default learner dropoff with a longer label',
                isDefault: true,
              ),
              _address(id: 'home', label: 'Home'),
            ],
            selectedAddressId: 'default',
            onAddressSelected: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });

  group('ReservationDeliveryDetailsSection saved-address fallback', () {
    testWidgets('hides selector when there are no saved addresses', (
      tester,
    ) async {
      final cityController = TextEditingController();
      final addressController = TextEditingController();
      final deliveryNoteController = TextEditingController();

      addTearDown(cityController.dispose);
      addTearDown(addressController.dispose);
      addTearDown(deliveryNoteController.dispose);

      await tester.pumpWidget(
        _wrap(
          child: ReservationDeliveryDetailsSection(
            cityController: cityController,
            addressController: addressController,
            deliveryNoteController: deliveryNoteController,
            cityFieldKey: GlobalKey(),
            addressFieldKey: GlobalKey(),
            enabled: true,
            safeDropoffAllowed: true,
            paymentMethod: 'CARD',
            onSafeDropoffChanged: (_) {},
            savedAddresses: const [],
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.byKey(const ValueKey('reservation-saved-address-dropdown')),
        findsNothing,
      );
      expect(
        find.byKey(const ValueKey('reservation-saved-address-display')),
        findsNothing,
      );
      expect(find.text(AppLocalizationsEn().city), findsNothing);
      expect(find.textContaining('City'), findsOneWidget);
    });
  });
}
