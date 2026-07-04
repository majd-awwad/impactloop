import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/deliveries/data/models/saved_dropoff_address.dart';

void main() {
  test('SavedDropoffAddress parses API payload', () {
    final address = SavedDropoffAddress.fromJson({
      'id': 'saved-1',
      'label': 'Home',
      'isDefault': true,
      'location': {
        'country': 'Palestine',
        'city': 'Nablus',
        'area': 'Old City',
        'addressLine': 'Main street',
        'isApproximate': false,
      },
      'createdAt': '2026-07-04T12:00:00.000Z',
      'updatedAt': '2026-07-04T12:00:00.000Z',
    });

    expect(address.id, 'saved-1');
    expect(address.label, 'Home');
    expect(address.isDefault, isTrue);
    expect(address.location.summary, contains('Nablus'));
  });
}
