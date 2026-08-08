import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/polling/lifecycle_polling_controller.dart';

void main() {
  group('LifecyclePollingController', () {
    test('pauses periodic refresh while inactive', () async {
      var refreshCount = 0;
      final controller = LifecyclePollingController(
        onRefresh: () => refreshCount++,
        interval: const Duration(milliseconds: 50),
      );

      controller.syncEnabled(true);
      expect(controller.isPollingActive, isTrue);

      controller.setPaused(true);
      expect(controller.isPollingActive, isFalse);

      final pausedCount = refreshCount;
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(refreshCount, pausedCount);

      controller.setPaused(false);
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(refreshCount, greaterThan(pausedCount));

      controller.dispose();
    });

    test('stops polling when disabled', () async {
      var refreshCount = 0;
      final controller = LifecyclePollingController(
        onRefresh: () => refreshCount++,
        interval: const Duration(milliseconds: 50),
      );

      controller.syncEnabled(true);
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(refreshCount, greaterThanOrEqualTo(1));

      controller.syncEnabled(false);
      expect(controller.isPollingActive, isFalse);

      final beforeDisableCount = refreshCount;
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(refreshCount, beforeDisableCount);

      controller.dispose();
    });
  });
}
