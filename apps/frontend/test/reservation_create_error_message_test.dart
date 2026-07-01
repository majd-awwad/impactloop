import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/reservations/presentation/reservation_create_error_message.dart';

void main() {
  test('returns friendly copy for open reservation conflict', () {
    const error = ApiException(
      message: 'You already have an open reservation for this material.',
      code: 'CONFLICT',
      statusCode: 409,
    );

    expect(
      reservationCreateErrorMessage(error),
      'You already have an open reservation for this material. Check My Reservations.',
    );
  });

  test('returns friendly copy for self reservation', () {
    const error = ApiException(
      message: 'You cannot reserve your own material.',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    );

    expect(
      reservationCreateErrorMessage(error),
      'You cannot reserve a material you listed yourself.',
    );
  });

  test('returns friendly copy for unavailable material', () {
    const error = ApiException(
      message: 'This material is no longer available.',
      code: 'CONFLICT',
      statusCode: 409,
    );

    expect(
      reservationCreateErrorMessage(error),
      'This material is no longer available for new reservations.',
    );
  });

  test('returns friendly copy for invalid quantity with available amount', () {
    const error = ApiException(
      message:
          'Requested quantity must be positive and no more than the available quantity.',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details: {'availableQuantity': 3},
    );

    expect(
      reservationCreateErrorMessage(error),
      'That quantity is not available. You can request up to 3 right now.',
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
      'This material is no longer available for new reservations.',
    );
  });
}
