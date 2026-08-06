import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import '../presentation/l10n/project_help_sessions_l10n.dart';

const projectHelpSessionMvpTimezones = [
  'Asia/Hebron',
  'Asia/Jerusalem',
  'UTC',
];

const defaultProjectHelpSessionTimezone = 'Asia/Hebron';

bool _timezonesInitialized = false;

/// Initializes IANA timezone database once per app process.
void ensureProjectHelpSessionTimezonesInitialized() {
  if (_timezonesInitialized) {
    return;
  }
  tz_data.initializeTimeZones();
  _timezonesInitialized = true;
}

/// Raised when a wall-clock value cannot be represented in the selected zone.
class ProjectHelpSessionTimezoneException implements Exception {
  const ProjectHelpSessionTimezoneException(this.message);

  final String message;

  @override
  String toString() => message;
}

bool isValidProjectHelpSessionTimezone(String value) {
  ensureProjectHelpSessionTimezonesInitialized();
  if (!projectHelpSessionMvpTimezones.contains(value)) {
    return false;
  }
  try {
    tz.getLocation(value);
    return true;
  } catch (_) {
    return false;
  }
}

/// Converts a naive local wall-clock selection into UTC using [ianaTimezone].
///
/// Ambiguous fall-back times (DST end) resolve to the later occurrence because
/// [tz.TZDateTime] picks the later offset when two instants share a label.
DateTime projectHelpSessionLocalToUtc(
  DateTime localWallClock,
  String ianaTimezone,
) {
  ensureProjectHelpSessionTimezonesInitialized();
  if (!isValidProjectHelpSessionTimezone(ianaTimezone)) {
    throw const ProjectHelpSessionTimezoneException('Invalid timezone.');
  }

  final location = tz.getLocation(ianaTimezone);
  tz.TZDateTime tzLocal;
  try {
    tzLocal = tz.TZDateTime(
      location,
      localWallClock.year,
      localWallClock.month,
      localWallClock.day,
      localWallClock.hour,
      localWallClock.minute,
    );
  } catch (_) {
    throw ProjectHelpSessionTimezoneException(
      'Invalid local date/time for $ianaTimezone.',
    );
  }

  if (tzLocal.year != localWallClock.year ||
      tzLocal.month != localWallClock.month ||
      tzLocal.day != localWallClock.day ||
      tzLocal.hour != localWallClock.hour ||
      tzLocal.minute != localWallClock.minute) {
    throw ProjectHelpSessionTimezoneException(
      'Selected time does not exist in $ianaTimezone (daylight saving transition).',
    );
  }

  return tzLocal.toUtc();
}

/// Converts a UTC instant into a naive wall-clock [DateTime] in [ianaTimezone].
DateTime projectHelpSessionUtcToWallClock(
  DateTime utc,
  String ianaTimezone,
) {
  ensureProjectHelpSessionTimezonesInitialized();
  final location = tz.getLocation(ianaTimezone);
  final tzLocal = tz.TZDateTime.from(utc.toUtc(), location);
  return DateTime(
    tzLocal.year,
    tzLocal.month,
    tzLocal.day,
    tzLocal.hour,
    tzLocal.minute,
  );
}

String resolveProjectHelpSessionErrorMessage(
  String? code, {
  required bool isArabic,
}) {
  final message = isArabic
      ? ProjectHelpSessionsL10n.errorMessage(code)
      : ProjectHelpSessionsL10n.errorMessageEn(code);
  if (message.isNotEmpty) {
    return message;
  }
  return isArabic ? 'حدث خطأ. حاول مرة أخرى.' : 'Something went wrong. Please try again.';
}
