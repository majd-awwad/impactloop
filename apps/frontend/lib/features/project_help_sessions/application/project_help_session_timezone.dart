import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import '../../../core/errors/api_exception.dart';
import '../presentation/l10n/project_help_sessions_l10n.dart';
import 'project_help_session_mutation.dart';

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

String resolveProjectHelpSessionErrorFromObject(
  Object error, {
  required bool isArabic,
}) {
  if (error is ProjectHelpSessionMutationFailure) {
    return resolveProjectHelpSessionErrorFromObject(
      error.error,
      isArabic: isArabic,
    );
  }

  if (error is ProjectHelpSessionTimezoneException) {
    return error.message;
  }

  if (error is ApiException) {
    if (error.statusCode == 409 || error.code == 'ACTIVE_SESSION_EXISTS') {
      final mapped = resolveProjectHelpSessionErrorMessage(
        'ACTIVE_SESSION_EXISTS',
        isArabic: isArabic,
      );
      if (mapped.isNotEmpty) {
        return mapped;
      }
    }
    if (error.code == 'VALIDATION_ERROR') {
      final issue = error.fieldIssues.isNotEmpty ? error.fieldIssues.first : null;
      if (issue != null) {
        final friendly = _friendlyValidationIssue(issue, isArabic: isArabic);
        if (friendly != null && friendly.isNotEmpty) {
          return friendly;
        }
      }
    }

    final mapped = resolveProjectHelpSessionErrorMessage(
      error.code,
      isArabic: isArabic,
    );
    final generic = isArabic
        ? 'حدث خطأ. حاول مرة أخرى.'
        : 'Something went wrong. Please try again.';
    if (mapped != generic) {
      return mapped;
    }
    if (error.code == 'VALIDATION_ERROR') {
      final issue = error.fieldIssues.isNotEmpty ? error.fieldIssues.first : null;
      if (issue != null && issue.message.trim().isNotEmpty) {
        return issue.message.trim();
      }
    }
    if (error.message.trim().isNotEmpty && error.code != 'INTERNAL_ERROR') {
      return error.message.trim();
    }
  }

  return resolveProjectHelpSessionErrorMessage(null, isArabic: isArabic);
}

String? _friendlyValidationIssue(
  ApiFieldIssue issue, {
  required bool isArabic,
}) {
  return switch (issue.path) {
    'projectStepId' => isArabic
        ? 'تعذر استخدام الخطوة المحددة. اختر خطوة من هذا المشروع أو اتركها عامة.'
        : 'The selected step is invalid. Choose a step from this project or leave it as a general question.',
    'buildId' => isArabic
        ? 'تعذر العثور على هذا البناء. أعد تحميل صفحة المشروع وحاول مرة أخرى.'
        : 'This build could not be found. Refresh the project page and try again.',
    'proposedTimes' => issue.message.trim().isNotEmpty
        ? issue.message.trim()
        : (isArabic
            ? 'تحقق من المواعيد المقترحة وحاول مرة أخرى.'
            : 'Check the proposed times and try again.'),
    'problemDescription' => issue.message.trim().isNotEmpty
        ? issue.message.trim()
        : (isArabic
            ? 'تحقق من وصف المشكلة وحاول مرة أخرى.'
            : 'Check the problem description and try again.'),
    _ => issue.message.trim().isNotEmpty ? issue.message.trim() : null,
  };
}
