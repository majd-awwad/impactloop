import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_profile.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_profile_location.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_locale_scope.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/supplier_profile_view_widgets.dart';

void main() {
  testWidgets('renders the compact management workspace without raw enums', (
    tester,
  ) async {
    final profile = _profile(
      completion: const SupplierProfileManagementCompletion(
        completedCount: 5,
        totalCount: 5,
        percentage: 100,
        missingFields: [],
      ),
    );

    await tester.pumpWidget(
      _Harness(
        child: Column(
          children: [
            SupplierProfileHeader(profile: profile, onEdit: () {}),
            const SizedBox(height: 16),
            ProfileDetailsSection(profile: profile, onEdit: () {}),
          ],
        ),
      ),
    );

    expect(find.text('Business identity'), findsOneWidget);
    expect(find.text('Working availability'), findsOneWidget);
    expect(find.text('Pickup location & privacy'), findsOneWidget);
    expect(find.text('Verification'), findsOneWidget);
    expect(find.text('Workshop'), findsNWidgets(2));
    expect(find.text('Verified'), findsOneWidget);
    expect(find.text('5 of 5 essentials complete'), findsOneWidget);
    expect(find.text('Pickup map unavailable'), findsOneWidget);
    expect(find.text('Public area — approximate location'), findsOneWidget);
    expect(find.textContaining('Location privacy unavailable'), findsNothing);
    expect(find.textContaining('Map pin is approximate'), findsNothing);
    expect(find.text('WORKSHOP'), findsNothing);
    expect(find.text('APPROVED'), findsNothing);
    expect(find.text('PUBLIC_APPROXIMATE'), findsNothing);
  });

  testWidgets('maps each supported privacy state without raw values', (
    tester,
  ) async {
    for (final state in [
      ('PUBLIC', true, 'Public area — approximate location'),
      ('PUBLIC', false, 'Public exact location'),
      ('ORDER_ONLY', true, 'Shared after reservation acceptance'),
      ('PRIVATE', true, 'Private location'),
      ('FUTURE_VALUE', true, 'Location privacy unavailable'),
    ]) {
      await tester.pumpWidget(
        _Harness(
          child: ProfileDetailsSection(
            profile: _profile(visibility: state.$1, isApproximate: state.$2),
            onEdit: () {},
          ),
        ),
      );

      expect(find.text(state.$3), findsOneWidget, reason: state.$1);
    }
  });

  testWidgets('uses server missing fields for incomplete completion', (
    tester,
  ) async {
    final profile = _profile(
      completion: const SupplierProfileManagementCompletion(
        completedCount: 4,
        totalCount: 5,
        percentage: 80,
        missingFields: ['DESCRIPTION'],
      ),
    );

    await tester.pumpWidget(
      _Harness(
        child: ProfileDetailsSection(profile: profile, onEdit: () {}),
      ),
    );

    expect(find.textContaining('Missing:'), findsOneWidget);
    expect(find.text('About your materials'), findsNothing);
    expect(find.text('Missing: Description'), findsOneWidget);
    expect(find.text('80%'), findsOneWidget);
  });

  testWidgets('shows verification admin feedback only for actionable states', (
    tester,
  ) async {
    final profile = _profile(
      verification: const SupplierProfileManagementVerification(
        rawStatus: 'CHANGES_REQUESTED',
        status: 'CHANGES_REQUESTED',
        isVerified: false,
        canSubmit: false,
        canResubmit: true,
        adminNote: 'Please clarify the pickup area.',
      ),
    );

    await tester.pumpWidget(
      _Harness(
        child: ProfileDetailsSection(
          profile: profile,
          onEdit: () {},
          onVerificationAction: () {},
        ),
      ),
    );

    expect(find.text('Changes required'), findsOneWidget);
    expect(find.text('Please clarify the pickup area.'), findsOneWidget);
    expect(find.text('Resubmit'), findsOneWidget);
    expect(find.text('View verification details'), findsNothing);
  });

  testWidgets(
    'suppresses duplicate organization names and keeps real contacts',
    (tester) async {
      await tester.pumpWidget(
        _Harness(
          child: ProfileDetailsSection(
            profile: _profile(
              organizationName: 'Impact Workshop',
              contactPersonName: 'Majd Tech Reuse',
            ),
            onEdit: () {},
          ),
        ),
      );

      expect(find.text('Organization name'), findsNothing);
      expect(find.text('Majd Tech Reuse'), findsOneWidget);
    },
  );

  testWidgets('renders passive consecutive and non-consecutive weekdays', (
    tester,
  ) async {
    await tester.pumpWidget(
      _Harness(
        child: ProfileDetailsSection(
          profile: _profile(
            workingDays: const [
              'SUNDAY',
              'MONDAY',
              'TUESDAY',
              'WEDNESDAY',
              'THURSDAY',
            ],
          ),
          onEdit: () {},
        ),
      ),
    );
    expect(find.text('Sun–Thu'), findsOneWidget);
    expect(find.byIcon(Icons.check), findsNothing);

    await tester.pumpWidget(
      _Harness(
        child: ProfileDetailsSection(
          profile: _profile(workingDays: const ['SUNDAY', 'WEDNESDAY']),
          onEdit: () {},
        ),
      ),
    );
    expect(find.text('Sun'), findsOneWidget);
    expect(find.text('Wed'), findsOneWidget);
    expect(find.byIcon(Icons.check), findsNothing);
  });

  test('normalizes legacy visibility without storing a presentation enum', () {
    final location = SupplierProfileLocation.fromJson({
      'id': 'location-1',
      'country': 'Palestine',
      'city': 'Hebron',
      'visibility': 'PUBLIC_APPROXIMATE',
      'isApproximate': true,
      'latitude': '31.53',
      'longitude': 35.1,
    });

    expect(location.visibility, 'PUBLIC');
    expect(location.isApproximate, isTrue);
    expect(location.latitude, 31.53);
    expect(location.longitude, 35.1);
  });
}

class _Harness extends StatelessWidget {
  const _Harness({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => MaterialApp(
    home: Scaffold(
      body: SupplierLocaleScope(
        languageCode: 'en',
        child: SingleChildScrollView(child: child),
      ),
    ),
  );
}

SupplierProfileManagement _profile({
  SupplierProfileManagementCompletion? completion,
  SupplierProfileManagementVerification? verification,
  String visibility = 'PUBLIC',
  bool isApproximate = true,
  String? organizationName,
  String? contactPersonName,
  List<String> workingDays = const ['SUNDAY', 'MONDAY', 'WEDNESDAY'],
  double? latitude,
  double? longitude,
}) {
  return SupplierProfileManagement(
    hasSupplierProfile: true,
    identity: const SupplierProfileManagementIdentity(
      supplierProfileId: 'supplier-1',
      publicName: 'Impact Workshop',
      supplierType: 'WORKSHOP',
      description: 'Reusable workshop materials.',
    ),
    pickupLocation: SupplierProfileLocation(
      id: 'location-1',
      country: 'Palestine',
      city: 'Hebron',
      area: 'University District',
      addressLine: 'Private pickup address',
      visibility: visibility,
      isApproximate: isApproximate,
      latitude: latitude,
      longitude: longitude,
    ),
    organization: SupplierProfileManagementOrganization(
      organizationName: organizationName,
      contactPersonName: contactPersonName,
      workingDays: workingDays,
      workingHours: {'from': '09:00', 'to': '17:00'},
    ),
    verification:
        verification ??
        const SupplierProfileManagementVerification(
          rawStatus: 'APPROVED',
          status: 'APPROVED',
          isVerified: true,
          canSubmit: false,
          canResubmit: false,
        ),
    completion:
        completion ??
        const SupplierProfileManagementCompletion(
          completedCount: 5,
          totalCount: 5,
          percentage: 100,
          missingFields: [],
        ),
  );
}
