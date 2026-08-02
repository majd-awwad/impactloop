import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_build_item_display.dart';

void main() {
  test('completed linked reservation shows Acquired instead of Missing', () {
    const item = ProjectBuildItem(
      id: 'item-1',
      requiredComponentId: 'component-1',
      status: ProjectBuildItemStatus.missing,
      component: ProjectRequiredComponentItem(
        id: 'component-1',
        name: LocalizedText(en: 'Arduino', ar: 'Arduino'),
        materialType: 'Board',
        quantity: 1,
        unit: 'piece',
        isRequired: true,
        canBeSubstituted: false,
      ),
      isReadyForBuild: true,
      readinessLabel: 'Ready for build — material acquired',
      linkedMaterial: LinkedMaterialSummary(
        id: 'material-1',
        title: 'Arduino Uno',
        categoryNameEn: 'Electronics',
        condition: 'GOOD',
        status: 'REUSED',
        isPubliclyAvailable: false,
        isFree: true,
        currency: 'NIS',
        supplierName: 'Supplier',
        city: 'Ramallah',
        pickupAllowed: true,
        deliveryAllowed: false,
      ),
      linkedReservation: LinkedReservationSummary(
        id: 'reservation-1',
        status: 'COMPLETED',
        materialId: 'material-1',
        needsAction: false,
        statusLabel: 'Completed',
      ),
    );

    final meta = ProjectBuildItemDisplayMeta.forItem(item);

    expect(meta.label.en, 'Acquired');
    expect(meta.label.en, isNot('Missing'));
    expect(meta.label.en, isNot('Already owned'));
  });

  test('active linked reservation shows In progress instead of Missing', () {
    const item = ProjectBuildItem(
      id: 'item-1',
      requiredComponentId: 'component-1',
      status: ProjectBuildItemStatus.missing,
      component: ProjectRequiredComponentItem(
        id: 'component-1',
        name: LocalizedText(en: 'Arduino', ar: 'Arduino'),
        materialType: 'Board',
        quantity: 1,
        unit: 'piece',
        isRequired: true,
        canBeSubstituted: false,
      ),
      isReadyForBuild: false,
      readinessLabel: 'Reservation in progress — not ready yet',
      linkedMaterial: LinkedMaterialSummary(
        id: 'material-1',
        title: 'Arduino Uno',
        categoryNameEn: 'Electronics',
        condition: 'GOOD',
        status: 'AVAILABLE',
        isPubliclyAvailable: true,
        isFree: true,
        currency: 'NIS',
        supplierName: 'Supplier',
        city: 'Ramallah',
        pickupAllowed: true,
        deliveryAllowed: false,
      ),
      linkedReservation: LinkedReservationSummary(
        id: 'reservation-1',
        status: 'ACCEPTED',
        materialId: 'material-1',
        needsAction: false,
        statusLabel: 'Accepted',
      ),
    );

    final meta = ProjectBuildItemDisplayMeta.forItem(item);

    expect(meta.label.en, 'In progress');
    expect(meta.label.en, isNot('Missing'));
  });
}
