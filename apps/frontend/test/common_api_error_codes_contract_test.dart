import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/core/errors/common_api_error_codes.dart';

void main() {
  test('Dart common error codes match the shared wire contract', () {
    final contractFile = File(
      '../../contracts/errors/common-error-codes-v1.json',
    );
    final contract =
        jsonDecode(contractFile.readAsStringSync()) as Map<String, dynamic>;

    expect(contract['contractId'], 'impactloop-common-error-codes-v1');
    expect(contract['codes'], CommonApiErrorCodes.byName);
  });

  test('Dart common error-code guard recognizes contract values', () {
    for (final code in CommonApiErrorCodes.values) {
      expect(CommonApiErrorCodes.contains(code), isTrue);
    }

    expect(CommonApiErrorCodes.contains('UNKNOWN_ERROR'), isFalse);
    expect(CommonApiErrorCodes.contains(null), isFalse);
  });
}
