import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'English and Arabic catalogs have matching messages and placeholders',
    () {
      final english = _readCatalog('lib/l10n/app_en.arb');
      final arabic = _readCatalog('lib/l10n/app_ar.arb');

      final englishKeys = english.keys.where(_isMessageKey).toSet();
      final arabicKeys = arabic.keys.where(_isMessageKey).toSet();
      expect(arabicKeys, englishKeys);

      for (final key in englishKeys) {
        expect(
          _placeholders(arabic, key),
          _placeholders(english, key),
          reason: 'Placeholder mismatch for $key',
        );
      }
    },
  );

  test('Arabic catalog contains no common mojibake markers', () {
    final source = File('lib/l10n/app_ar.arb').readAsStringSync();
    expect(source, isNot(contains('╪')));
    expect(source, isNot(contains('┘')));
    expect(source, isNot(contains('Ã')));
    expect(source, isNot(contains('Ø')));
  });
}

Map<String, dynamic> _readCatalog(String path) =>
    jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

bool _isMessageKey(String key) => !key.startsWith('@');

Set<String> _placeholders(Map<String, dynamic> catalog, String key) {
  final metadata = catalog['@$key'];
  if (metadata is! Map<String, dynamic>) return const {};
  final placeholders = metadata['placeholders'];
  if (placeholders is! Map<String, dynamic>) return const {};
  return placeholders.keys.toSet();
}
