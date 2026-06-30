import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/material_discovery/presentation/reservation_dialog_copy.dart';

void main() {
  test('formats available quantity with plural units', () {
    expect(
      formatReservationAvailableQuantityLabel(
        availableQuantity: 500,
        unit: 'piece',
      ),
      'Available: 500 pieces',
    );
  });

  test('formats available quantity with singular unit', () {
    expect(
      formatReservationAvailableQuantityLabel(
        availableQuantity: 1,
        unit: 'piece',
      ),
      'Available: 1 piece',
    );
  });
}
