import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/reservations/presentation/reservation_create_error_message.dart';

void main() {
  test('uses API message for open reservation conflict', () {
    const error = ApiException(
      message: 'You already have an open reservation for this material.',
      code: 'CONFLICT',
      statusCode: 409,
    );

    expect(
      reservationCreateErrorMessage(error),
      'You already have an open reservation for this material.',
    );
  });

  test('falls back for empty message on conflict', () {
    const error = ApiException(
      message: '',
      code: 'CONFLICT',
      statusCode: 409,
    );

    expect(
      reservationCreateErrorMessage(error),
      'This material is no longer available.',
    );
  });
}
