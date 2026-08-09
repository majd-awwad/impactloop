import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/core/errors/idempotency_error_codes.dart';

void main() {
  test('Dart idempotency error codes match the shared wire contract', () {
    final contractFile = File(
      '../../contracts/errors/idempotency-error-codes-v1.json',
    );
    final contract = jsonDecode(contractFile.readAsStringSync())
        as Map<String, dynamic>;

    expect(
      contract['contractId'],
      'impactloop-idempotency-error-codes-v1',
    );
    expect(contract['codes'], IdempotencyErrorCodes.byName);
  });

  test('Dart idempotency error-code guard recognizes contract values', () {
    for (final code in IdempotencyErrorCodes.values) {
      expect(IdempotencyErrorCodes.contains(code), isTrue);
    }

    expect(IdempotencyErrorCodes.contains('IDEMPOTENCY_UNKNOWN'), isFalse);
    expect(IdempotencyErrorCodes.contains(null), isFalse);
  });
}
