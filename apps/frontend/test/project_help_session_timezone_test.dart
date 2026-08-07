import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/project_help_sessions/application/project_help_session_timezone.dart';

void main() {
  setUpAll(ensureProjectHelpSessionTimezonesInitialized);

  group('projectHelpSessionLocalToUtc', () {
    test('Asia/Hebron uses timezone data', () {
      final utc = projectHelpSessionLocalToUtc(
        DateTime(2026, 1, 15, 10, 0),
        'Asia/Hebron',
      );
      expect(utc.isUtc, isTrue);
      expect(utc, DateTime.utc(2026, 1, 15, 8, 0));
    });

    test('Asia/Jerusalem uses timezone data', () {
      final utc = projectHelpSessionLocalToUtc(
        DateTime(2026, 1, 15, 10, 0),
        'Asia/Jerusalem',
      );
      expect(utc, DateTime.utc(2026, 1, 15, 8, 0));
    });

    test('UTC conversion works', () {
      final utc = projectHelpSessionLocalToUtc(
        DateTime(2026, 6, 1, 12, 30),
        'UTC',
      );
      expect(utc, DateTime.utc(2026, 6, 1, 12, 30));
    });

    test('DST offset change produces different UTC values', () {
      final winter = projectHelpSessionLocalToUtc(
        DateTime(2026, 1, 15, 10, 0),
        'Asia/Jerusalem',
      );
      final summer = projectHelpSessionLocalToUtc(
        DateTime(2026, 7, 15, 10, 0),
        'Asia/Jerusalem',
      );
      expect(winter, DateTime.utc(2026, 1, 15, 8, 0));
      expect(summer, DateTime.utc(2026, 7, 15, 7, 0));
      expect(winter, isNot(equals(summer)));
    });

    test('does not depend on machine timezone', () {
      final utc = projectHelpSessionLocalToUtc(
        DateTime(2026, 3, 10, 9, 0),
        'Asia/Hebron',
      );
      expect(utc, DateTime.utc(2026, 3, 10, 7, 0));
    });

    test('rejects invalid local time during DST gap', () {
      expect(
        () => projectHelpSessionLocalToUtc(
          DateTime(2026, 3, 27, 2, 30),
          'Asia/Jerusalem',
        ),
        throwsA(isA<ProjectHelpSessionTimezoneException>()),
      );
    });
  });

  group('projectHelpSessionUtcToWallClock', () {
    test('display conversion uses selected IANA zone', () {
      final wall = projectHelpSessionUtcToWallClock(
        DateTime.utc(2026, 7, 15, 7, 0),
        'Asia/Jerusalem',
      );
      expect(wall.year, 2026);
      expect(wall.month, 7);
      expect(wall.day, 15);
      expect(wall.hour, 10);
      expect(wall.minute, 0);
    });
  });
}
