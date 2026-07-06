import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/material_discovery/presentation/discovery_material_display.dart';
import 'package:frontend/shared/models/localized_text.dart';

void main() {
  group('DiscoveryMaterialDisplay', () {
    test('removes my-materials-seed marker lines', () {
      const raw =
          '[my-materials-seed] key:elec-12-l298n-drivers\nDual H-bridge motor driver modules for Arduino projects.';

      expect(
        DiscoveryMaterialDisplay.sanitizePublicDescription(raw),
        'Dual H-bridge motor driver modules for Arduino projects.',
      );
    });

    test('removes standalone key lines', () {
      const raw = 'key:wood-01-panels\nClean plywood offcuts for student projects.';

      expect(
        DiscoveryMaterialDisplay.sanitizePublicDescription(raw),
        'Clean plywood offcuts for student projects.',
      );
    });

    test('falls back when only internal markers remain', () {
      expect(
        DiscoveryMaterialDisplay.sanitizedDescriptionOrFallback(
          '[my-materials-seed] key:test-only',
        ),
        'No description available.',
      );
    });

    test('displayDescription keeps localized human text', () {
      final description = DiscoveryMaterialDisplay.displayDescription(
        const LocalizedText(
          en: '[my-materials-seed] key:x\nReadable summary.',
          ar: '[my-materials-seed] key:x\nملخص مقروء.',
        ),
      );

      expect(description.en, 'Readable summary.');
      expect(description.ar, 'ملخص مقروء.');
    });
  });
}
