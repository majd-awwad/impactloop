import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/domain/models/project_build_material_link.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/learning_project_build_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_build_material_linking.dart';

void main() {
  testWidgets('completed reservation shows readiness text once and no warning', (
    tester,
  ) async {
    const material = LinkedMaterialSummary(
      id: 'material-1',
      title: 'Sorted Plastic Bottle Caps Bag',
      categoryNameEn: 'Storage',
      condition: 'GOOD',
      status: 'REUSED',
      isPubliclyAvailable: false,
      isFree: true,
      currency: 'NIS',
      supplierName: 'Supplier',
      city: 'Ramallah',
      pickupAllowed: true,
      deliveryAllowed: false,
      availabilityWarning:
          'This linked material is no longer available on the platform.',
    );
    const reservation = LinkedReservationSummary(
      id: 'reservation-1',
      status: 'COMPLETED',
      materialId: 'material-1',
      needsAction: false,
      statusLabel: 'Ready for build — material acquired',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ProjectBuildLinkedMaterialPanel(
            material: material,
            linkedReservation: reservation,
            isReadyForBuild: true,
            readinessLabel: 'Ready for build — material acquired',
            isBusy: false,
            onViewMaterial: () {},
            onUnlink: () {},
          ),
        ),
      ),
    );

    expect(
      find.text('This linked material is no longer available on the platform.'),
      findsNothing,
    );
    expect(
      find.text(LearningProjectBuildL10n.readyForBuildMaterialAcquired.en),
      findsOneWidget,
    );
    expect(find.text('Ready for build — material acquired'), findsOneWidget);
  });

  testWidgets('incomplete unavailable material still shows warning', (
    tester,
  ) async {
    const material = LinkedMaterialSummary(
      id: 'material-1',
      title: 'Sorted Plastic Bottle Caps Bag',
      categoryNameEn: 'Storage',
      condition: 'GOOD',
      status: 'REUSED',
      isPubliclyAvailable: false,
      isFree: true,
      currency: 'NIS',
      supplierName: 'Supplier',
      city: 'Ramallah',
      pickupAllowed: true,
      deliveryAllowed: false,
      availabilityWarning:
          'This linked material is no longer available on the platform.',
    );
    const reservation = LinkedReservationSummary(
      id: 'reservation-1',
      status: 'ACCEPTED',
      materialId: 'material-1',
      needsAction: false,
      statusLabel: 'Accepted — pickup or delivery in progress',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ProjectBuildLinkedMaterialPanel(
            material: material,
            linkedReservation: reservation,
            isReadyForBuild: false,
            readinessLabel: 'Reservation in progress — not ready yet',
            isBusy: false,
            onViewMaterial: () {},
            onUnlink: () {},
          ),
        ),
      ),
    );

    expect(
      find.text('This linked material is no longer available on the platform.'),
      findsOneWidget,
    );
    expect(
      find.text('Accepted — pickup or delivery in progress'),
      findsOneWidget,
    );
  });
}
