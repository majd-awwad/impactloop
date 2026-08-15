import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/presentation/widgets/project_build_material_linking.dart';
import 'package:frontend/features/reservations/data/models/create_reservation_request.dart';
import 'package:frontend/features/reservations/data/models/reservation_preferred_window.dart';

void main() {
  test('CreateReservationRequest includes buildItemId when provided', () {
    final request = CreateReservationRequest(
      materialId: 'mat-1',
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      buildItemId: 'item-1',
      learnerPreferredPickupWindows: [
        ReservationPreferredWindow(
          start: DateTime.utc(2026, 7, 8, 10),
          end: DateTime.utc(2026, 7, 8, 12),
        ),
      ],
    );

    final json = request.toJson();

    expect(json['buildItemId'], 'item-1');
    expect(json['materialId'], 'mat-1');
  });

  test('buildChecklistMaterialDetailUri preserves build context params', () {
    final uri = buildChecklistMaterialDetailUri(
      materialId: 'mat-1',
      projectId: 'project-1',
      buildItemId: 'item-1',
      componentName: 'Arduino board',
    );

    final parsed = Uri.parse(uri);

    expect(parsed.path, '/materials/mat-1');
    expect(parsed.queryParameters['projectId'], 'project-1');
    expect(parsed.queryParameters['buildItemId'], 'item-1');
    expect(parsed.queryParameters['componentName'], 'Arduino board');
    expect(parsed.queryParameters.containsKey('requestedQuantity'), isFalse);
    expect(
      Uri.decodeComponent(parsed.queryParameters['returnTo']!),
      '/learning/project-1/build',
    );
  });

  test('buildChecklistMaterialDetailUri includes requestedQuantity when positive', () {
    final uri = buildChecklistMaterialDetailUri(
      materialId: 'mat-1',
      projectId: 'project-1',
      buildItemId: 'item-1',
      requestedQuantity: 2.5,
    );

    final parsed = Uri.parse(uri);

    expect(parsed.queryParameters['requestedQuantity'], '2.5');
  });

  test('buildChecklistMaterialDetailUri omits non-positive requestedQuantity', () {
    final uri = buildChecklistMaterialDetailUri(
      materialId: 'mat-1',
      projectId: 'project-1',
      buildItemId: 'item-1',
      requestedQuantity: 0,
    );

    expect(
      Uri.parse(uri).queryParameters.containsKey('requestedQuantity'),
      isFalse,
    );
  });
}
