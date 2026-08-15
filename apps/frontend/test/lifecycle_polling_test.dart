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

    test('skips ticks while a slow refresh is in flight', () async {
      var started = 0;
      var finished = 0;
      final controller = LifecyclePollingController(
        onRefresh: () async {
          started++;
          await Future<void>.delayed(const Duration(milliseconds: 180));
          finished++;
        },
        interval: const Duration(milliseconds: 50),
      );

      controller.syncEnabled(true);
      await Future<void>.delayed(const Duration(milliseconds: 220));
      expect(started, 1);
      expect(controller.isRefreshInFlight, isTrue);

      await Future<void>.delayed(const Duration(milliseconds: 200));
      expect(finished, greaterThanOrEqualTo(1));
      expect(started, lessThanOrEqualTo(finished + 1));
      expect(started, lessThan(4));

      controller.dispose();
    });

    test('recovers after a thrown refresh', () async {
      var attempts = 0;
      final controller = LifecyclePollingController(
        onRefresh: () {
          attempts++;
          if (attempts == 1) {
            throw StateError('boom');
          }
        },
        interval: const Duration(milliseconds: 40),
      );

      controller.syncEnabled(true);
      await Future<void>.delayed(const Duration(milliseconds: 160));
      expect(attempts, greaterThanOrEqualTo(2));
      for (var i = 0; i < 30; i++) {
        if (!controller.isRefreshInFlight) {
          break;
        }
        await Future<void>.delayed(const Duration(milliseconds: 50));
      }
      expect(controller.isRefreshInFlight, isFalse);

      controller.dispose();
    });

    test('dispose prevents future ticks', () async {
      var refreshCount = 0;
      final controller = LifecyclePollingController(
        onRefresh: () => refreshCount++,
        interval: const Duration(milliseconds: 40),
      );

      controller.syncEnabled(true);
      await Future<void>.delayed(const Duration(milliseconds: 90));
      final beforeDispose = refreshCount;
      expect(beforeDispose, greaterThanOrEqualTo(1));

      controller.dispose();
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(refreshCount, beforeDispose);
      expect(controller.isPollingActive, isFalse);
    });

    test('repeated enable does not create overlapping timers', () async {
      var refreshCount = 0;
      final controller = LifecyclePollingController(
        onRefresh: () => refreshCount++,
        interval: const Duration(milliseconds: 80),
      );

      controller.syncEnabled(true);
      controller.syncEnabled(true);
      controller.syncEnabled(true);

      await Future<void>.delayed(const Duration(milliseconds: 100));
      // First periodic fire is after one interval; expect roughly 1, not 3.
      expect(refreshCount, lessThanOrEqualTo(2));

      controller.dispose();
    });
  });
}
