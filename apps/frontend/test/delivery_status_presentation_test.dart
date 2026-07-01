import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/deliveries/presentation/delivery_status_presentation.dart';

void main() {
  test('formatDeliveryPickupWindow renders readable same-day window', () {
    final text = formatDeliveryPickupWindow(
      pickupWindowStart: DateTime.parse('2026-06-27T07:00:00.000Z'),
      pickupWindowEnd: DateTime.parse('2026-06-27T13:00:00.000Z'),
    );

    expect(text, isNotNull);
    expect(text, contains('Jun 27'));
    expect(text, contains('–'));
  });

  test('deliveryStatusLabel maps delivered status', () {
    expect(deliveryStatusLabel('DELIVERED'), 'Delivered');
  });
}
