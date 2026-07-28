import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/material_discovery/domain/material_view_operation_key.dart';

void main() {
  test('creates a web-safe operation key with a 32-bit random value', () {
    final key = createMaterialViewOperationKey(
      'material-1',
      random: Random(42),
      now: DateTime.fromMicrosecondsSinceEpoch(123456),
    );

    expect(key, startsWith('material-view-material-1-123456-'));
    expect(key.split('-').last, matches(RegExp(r'^[0-9a-f]{8}$')));
  });
}
