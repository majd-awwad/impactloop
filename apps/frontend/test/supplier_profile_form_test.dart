import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/supplier_portal/presentation/l10n/supplier_l10n.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_locale_scope.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/supplier_location_input_mode.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/supplier_profile_form.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/supplier_reverse_geocode_state.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/supplier_pickup_map.dart';

void main() {
  testWidgets('renders one location selector and hides raw coordinates', (
    tester,
  ) async {
    await tester.pumpWidget(const _Harness());
    await tester.pumpAndSettle();

    expect(find.text('Use current location'), findsOneWidget);
    expect(find.text('Choose manually'), findsOneWidget);
    expect(find.text('Latitude'), findsNothing);
    expect(find.text('Longitude'), findsNothing);
    expect(find.text('32.22000'), findsNothing);
    expect(find.text('35.25000'), findsNothing);
    expect(find.text('Tap the map to place the pickup pin'), findsOneWidget);
  });

  testWidgets('manual mode exposes address fields and map instructions', (
    tester,
  ) async {
    await tester.pumpWidget(const _Harness());
    await tester.pumpAndSettle();

    expect(find.text('Country'), findsAtLeastNWidgets(1));
    expect(find.text('City'), findsAtLeastNWidgets(1));
    expect(find.text('Area'), findsAtLeastNWidgets(1));
    expect(find.text('Address line'), findsAtLeastNWidgets(1));
    expect(find.textContaining('move the map pin'), findsOneWidget);
    expect(find.byType(SupplierPickupMap), findsOneWidget);
    expect(find.textContaining('Visibility:'), findsNothing);
  });

  testWidgets(
    'constrains the location selector on desktop and expands on mobile',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(1440, 900));
      await tester.pumpWidget(const _Harness());
      await tester.pumpAndSettle();
      final desktopWidth = tester
          .renderObject<RenderBox>(
            find.byKey(const ValueKey('location-mode-width')),
          )
          .size
          .width;
      expect(desktopWidth, 480);

      await tester.binding.setSurfaceSize(const Size(360, 800));
      await tester.pumpWidget(const _Harness());
      await tester.pumpAndSettle();
      final mobileWidth = tester
          .renderObject<RenderBox>(
            find.byKey(const ValueKey('location-mode-width')),
          )
          .size
          .width;
      expect(mobileWidth, lessThan(360));
      await tester.binding.setSurfaceSize(null);
    },
  );

  testWidgets('uses the canonical localized country presentation', (
    tester,
  ) async {
    await tester.pumpWidget(const _Harness());
    await tester.pumpAndSettle();
    final l10n = SupplierL10n.of(
      tester.element(find.byType(SupplierProfileForm)),
    );
    expect(l10n.countryDisplay('Palestinian Territories'), 'Palestine');
  });

  testWidgets('privacy copy follows visibility and approximate settings', (
    tester,
  ) async {
    await tester.pumpWidget(
      const _Harness(key: ValueKey('public'), visibility: 'PUBLIC'),
    );
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Learners see the general area.'),
      findsOneWidget,
    );

    await tester.pumpWidget(
      const _Harness(key: ValueKey('order-only'), visibility: 'ORDER_ONLY'),
    );
    await tester.pumpAndSettle();
    expect(
      find.textContaining('only after the reservation is accepted'),
      findsOneWidget,
    );

    await tester.pumpWidget(
      const _Harness(key: ValueKey('private'), visibility: 'PRIVATE'),
    );
    await tester.pumpAndSettle();
    expect(find.text('The pickup location remains private.'), findsOneWidget);

    await tester.pumpWidget(
      const _Harness(key: ValueKey('future'), visibility: 'FUTURE_VALUE'),
    );
    await tester.pumpAndSettle();
    expect(
      find.text('Location visibility details are unavailable.'),
      findsOneWidget,
    );
  });

  testWidgets('organization fields and structured weekdays are conditional', (
    tester,
  ) async {
    await tester.pumpWidget(
      const _Harness(supplierType: 'INDIVIDUAL_SUPPLIER'),
    );
    await tester.pumpAndSettle();
    expect(find.text('Organization name'), findsNothing);
    expect(find.byKey(const ValueKey('working-day-SUNDAY')), findsNothing);

    await tester.pumpWidget(const _Harness());
    await tester.pumpAndSettle();
    expect(find.text('Organization name'), findsOneWidget);
    expect(find.byKey(const ValueKey('working-day-SUNDAY')), findsOneWidget);
    expect(find.byKey(const ValueKey('working-day-MONDAY')), findsOneWidget);
    expect(find.byKey(const ValueKey('working-day-TUESDAY')), findsOneWidget);
    expect(find.byKey(const ValueKey('working-day-WEDNESDAY')), findsOneWidget);
    expect(find.byKey(const ValueKey('working-day-THURSDAY')), findsOneWidget);
    expect(find.byKey(const ValueKey('working-day-FRIDAY')), findsOneWidget);
    expect(find.byKey(const ValueKey('working-day-SATURDAY')), findsOneWidget);
    expect(find.text('SUNDAY, MONDAY'), findsNothing);
  });

  testWidgets('open-from control opens the Flutter time picker', (
    tester,
  ) async {
    await tester.pumpWidget(const _Harness());
    await tester.pumpAndSettle();

    final timeValue = find.text('9:00 AM');
    await tester.ensureVisible(timeValue);
    await tester.tap(timeValue);
    await tester.pumpAndSettle();

    expect(find.byType(TimePickerDialog), findsOneWidget);
  });

  testWidgets('stays overflow-safe across mobile, tablet, RTL, and dark mode', (
    tester,
  ) async {
    for (final size in [
      const Size(360, 800),
      const Size(700, 900),
      const Size(1200, 900),
    ]) {
      await tester.binding.setSurfaceSize(size);
      await tester.pumpWidget(
        _Harness(
          key: ValueKey(size),
          textDirection: size.width == 360
              ? TextDirection.rtl
              : TextDirection.ltr,
          dark: size.width == 1200,
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: 'size $size');
    }
    await tester.binding.setSurfaceSize(null);
  });
}

class _Harness extends StatefulWidget {
  const _Harness({
    super.key,
    this.visibility = 'PUBLIC',
    this.supplierType = 'WORKSHOP',
    this.textDirection = TextDirection.ltr,
    this.dark = false,
  });

  final String visibility;
  final String supplierType;
  final TextDirection textDirection;
  final bool dark;

  @override
  State<_Harness> createState() => _HarnessState();
}

class _HarnessState extends State<_Harness> {
  final formKey = GlobalKey<FormState>();
  late final publicName = TextEditingController(text: 'Impact Workshop');
  late final description = TextEditingController(text: 'Reusable materials');
  late final country = TextEditingController(text: 'Palestine');
  late final city = TextEditingController(text: 'Hebron');
  late final area = TextEditingController(text: 'University District');
  late final address = TextEditingController(text: 'Main gate');
  late final organization = TextEditingController(text: 'Impact Workshop');
  late final contact = TextEditingController(text: 'Majd');
  late final from = TextEditingController(text: '09:00');
  late final until = TextEditingController(text: '17:00');
  late final businessCountry = TextEditingController();
  late final businessCity = TextEditingController();
  late final businessArea = TextEditingController();
  late final businessAddress = TextEditingController();
  late List<String> selectedDays = [...supplierWorkingDayValues];
  late String visibility = widget.visibility;

  @override
  void dispose() {
    for (final controller in [
      publicName,
      description,
      country,
      city,
      area,
      address,
      organization,
      contact,
      from,
      until,
      businessCountry,
      businessCity,
      businessArea,
      businessAddress,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      theme: ThemeData(
        brightness: widget.dark ? Brightness.dark : Brightness.light,
      ),
      home: Scaffold(
        body: SupplierLocaleScope(
          languageCode: 'en',
          child: Directionality(
            textDirection: widget.textDirection,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: SupplierProfileForm(
                formKey: formKey,
                publicNameController: publicName,
                descriptionController: description,
                countryController: country,
                cityController: city,
                areaController: area,
                addressLineController: address,
                supplierType: widget.supplierType,
                visibility: visibility,
                isApproximate: true,
                organizationNameController: organization,
                contactPersonController: contact,
                workingFromController: from,
                workingToController: until,
                selectedWorkingDays: selectedDays,
                useSeparateBusinessLocation: false,
                businessCountryController: businessCountry,
                businessCityController: businessCity,
                businessAreaController: businessArea,
                businessAddressLineController: businessAddress,
                onSupplierTypeChanged: (_) {},
                onVisibilityChanged: (value) =>
                    setState(() => visibility = value),
                onApproximateChanged: (_) {},
                onSeparateBusinessLocationChanged: (_) {},
                onWorkingDaysChanged: (value) =>
                    setState(() => selectedDays = [...value]),
                onFieldChanged: () {},
                onCountryChanged: () {},
                locationInputMode: SupplierLocationInputMode.manual,
                locationCapturedThisSession: false,
                reverseGeocodeState: SupplierReverseGeocodeState.idle,
                onPickupAddressFieldChanged: () {},
                onLocationInputModeChanged: (_) {},
                onPinMoved: (_) {},
                latitude: null,
                longitude: null,
                locationButtonState: SupplierLocationButtonState.idle,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
