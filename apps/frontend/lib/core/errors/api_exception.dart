import '../../l10n/app_localizations.dart';
import 'common_api_error_codes.dart';

class ApiFieldIssue {
  const ApiFieldIssue({required this.path, required this.message});

  final String path;
  final String message;
}

class ApiException implements Exception {
  const ApiException({
    required this.message,
    this.code,
    this.statusCode,
    this.details,
  });

  final String message;
  final String? code;
  final int? statusCode;
  final Map<String, dynamic>? details;

  bool get isCancellation => code == 'CANCELLED';

  List<ApiFieldIssue> get fieldIssues {
    final rawIssues = details?['issues'];

    if (rawIssues is! List) {
      return const [];
    }

    return rawIssues.whereType<Map>().map((issue) {
      final field =
          issue['field']?.toString() ?? issue['path']?.toString() ?? '';
      return ApiFieldIssue(
        path: field,
        message: issue['message']?.toString() ?? 'Invalid value',
      );
    }).toList();
  }

  @override
  String toString() => message;

  String get displayMessage {
    switch (code) {
      case 'NETWORK_ERROR':
        return 'We could not reach the server. Check your connection and make sure the backend is running.';
      case 'TIMEOUT':
        return 'The server took too long to respond. Please try again.';
      case CommonApiErrorCodes.conflict:
        return message.isNotEmpty && !containsInternalIdentifier(message)
            ? message
            : 'This request conflicts with the current state. Please refresh and try again.';
      case CommonApiErrorCodes.validationError:
        final firstIssue = fieldIssues.isNotEmpty
            ? fieldIssues.first.message
            : null;
        if (firstIssue != null &&
            firstIssue.isNotEmpty &&
            !containsInternalIdentifier(firstIssue)) {
          return firstIssue;
        }
        return message.isNotEmpty && !containsInternalIdentifier(message)
            ? message
            : 'Check the highlighted information and try again.';
      case 'PROJECT_SUBMISSION_INCOMPLETE':
        return formatProjectSubmissionIncompleteMessage(this);
      case CommonApiErrorCodes.unauthenticated:
        return 'Your session has expired. Please sign in again.';
      case CommonApiErrorCodes.forbidden:
        return message.isNotEmpty && !containsInternalIdentifier(message)
            ? message
            : 'You do not have permission to complete this action.';
      case 'ACCOUNT_SUSPENDED':
        return 'Your account has been suspended after repeated verified reports. Contact admin.';
      case 'PICKUP_WINDOW_REQUIRED':
        return 'Choose a new pickup start and end time before sending a reschedule request.';
      default:
        final errorCode = code;
        if (errorCode != null && errorCode.startsWith('PICKUP_')) {
          return message.isNotEmpty && !containsInternalIdentifier(message)
              ? message
              : 'The pickup window is not valid. Choose a different time.';
        }
        if (statusCode != null && statusCode! >= 500) {
          return 'The server hit a problem. Please try again in a moment.';
        }

        return message.isNotEmpty && !containsInternalIdentifier(message)
            ? message
            : 'Something went wrong. Please try again.';
    }
  }
}

String userFriendlyErrorMessage(Object error) {
  if (error is ApiException) {
    return error.displayMessage;
  }

  return 'Something went wrong. Please try again.';
}

String localizedApiErrorMessage(
  Object error,
  AppLocalizations l10n, {
  String? operation,
}) {
  if (error is! ApiException) return l10n.somethingWentWrong;

  switch (error.code) {
    case 'NETWORK_ERROR':
      return l10n.networkError;
    case 'TIMEOUT':
      return l10n.timeoutError;
    case CommonApiErrorCodes.conflict:
      return l10n.conflictError;
    case 'DRIVER_ACTIVE_LIMIT_REACHED':
      return l10n.driverReachedActiveLimit;
    case 'DELIVERY_NOT_AVAILABLE':
      return l10n.driverDeliveryNoLongerAvailable;
    case 'DRIVER_NOT_AVAILABLE':
      return l10n.conflictError;
    case 'DRIVER_NOT_ACCEPTING_NEW_JOBS':
      return l10n.driverNotAcceptingNewJobsError;
    case 'DELIVERY_TERMINAL':
      return l10n.driverNoLongerActive;
    case 'INVALID_DELIVERY_TRANSITION':
      return l10n.driverStatusChangedRefresh;
    case 'DELIVERY_LOCATION_PING_NOT_ALLOWED':
      return l10n.driverActionNotAvailable;
    case 'DRIVER_PICKUP_FAILURE_NOT_ALLOWED':
    case 'DRIVER_DELIVERY_FAILURE_NOT_ALLOWED':
    case 'DRIVER_ISSUE_NOT_ALLOWED':
      return l10n.driverActionNotAvailable;
    case 'INVALID_CONFIRMATION_CODE':
      return l10n.driverInvalidConfirmationCode;
    case 'HANDOVER_WINDOW_NOT_STARTED':
      return l10n.driverHandoverWindowNotStarted;
    case 'HANDOVER_WINDOW_EXPIRED':
      return l10n.driverHandoverWindowExpired;
    case 'CASH_COLLECTION_CONFIRMATION_REQUIRED':
      return l10n.cashCollectionRequiredError;
    case 'HANDOVER_CASH_COLLECTOR_INVALID':
    case 'HANDOVER_PAYMENT_INVARIANT_INVALID':
      return l10n.driverActionNotAvailable;
    case 'HANDOVER_CREDENTIAL_INVALID':
      // Privacy-safe: do not distinguish wrong supplier / expired / used.
      return l10n.supplierPickupQrCredentialUnavailable;
    case 'DRIVER_PARTIAL_PICKUP_SELECTION_INVALID':
      return l10n.driverPartialPickupSelectionInvalid;
    case 'DRIVER_GROUPED_DELIVERY_SPLIT_CONFLICT':
      return l10n.driverGroupedDeliverySplitConflict;
    case 'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID':
      return l10n.driverAvailableJobsCursorInvalid;
    case 'DELIVERY_WINDOW_INVALID':
      return l10n.driverDeliveryWindowMustBeFuture;
    case 'DELIVERY_WINDOW_NOT_ALLOWED':
      return l10n.driverDeliveryWindowNotAllowed;
    case 'DELIVERY_WINDOW_REQUIRED':
      return l10n.driverDeliveryWindowRequired;
    case 'DELIVERY_SCHEDULING_CONFLICT':
      return l10n.driverDeliverySchedulingConflict;
    case 'REDELIVERY_ALREADY_SCHEDULED':
      return l10n.driverRedeliveryAlreadyScheduled;
    case 'REDELIVERY_DEADLINE_EXCEEDED':
      return l10n.driverRedeliveryDeadlineExceeded;
    case CommonApiErrorCodes.validationError:
      return l10n.validationError;
    case 'PROJECT_SUBMISSION_INCOMPLETE':
      return localizedProjectSubmissionIncompleteMessage(error, l10n);
    case CommonApiErrorCodes.unauthenticated:
      return l10n.sessionExpired;
    case CommonApiErrorCodes.forbidden:
      return l10n.forbiddenError;
    case 'ACCOUNT_SUSPENDED':
      return l10n.accountSuspended;
    case 'EMAIL_VERIFICATION_REQUIRED':
      return operation == 'supplier_material'
          ? l10n.supplierMaterialEmailVerificationRequired
          : l10n.reservationEmailVerificationRequired;
    case 'EMAIL_VERIFICATION_TOKEN_EXPIRED':
      return l10n.emailVerificationExpiredToken;
    case 'EMAIL_VERIFICATION_TOKEN_INVALID':
    case 'EMAIL_VERIFICATION_TOKEN_USED':
      return l10n.emailVerificationInvalidToken;
    case 'PICKUP_WINDOW_REQUIRED':
      return l10n.pickupWindowRequired;
    case 'RESERVATION_EXPIRED':
      return l10n.reservationExpiredError;
    case 'RESERVATION_ALREADY_ACCEPTED':
      return l10n.reservationAlreadyAccepted;
    case 'RESERVATION_ALREADY_DECLINED':
      return l10n.reservationAlreadyDeclined;
    case 'RESERVATION_CANCELLED':
      return l10n.reservationCancelledError;
    case 'RESERVATION_NOT_PENDING':
      return l10n.reservationNotPending;
    default:
      final errorCode = error.code;
      if (errorCode != null && errorCode.startsWith('PICKUP_')) {
        return l10n.invalidPickupWindow;
      }
      if (error.statusCode != null && error.statusCode! >= 500) {
        return l10n.serverError;
      }
      if (error.message.trim().isNotEmpty &&
          !containsInternalIdentifier(error.message)) {
        return error.message;
      }
      return l10n.somethingWentWrong;
  }
}

bool containsInternalIdentifier(String message) {
  final value = message.trim();
  if (value.isEmpty) return false;

  final uuid = RegExp(
    r'\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b',
    caseSensitive: false,
  );
  final cuid = RegExp(r'\bc[a-z0-9]{20,31}\b', caseSensitive: false);
  final labeledInternalId = RegExp(
    r'\b(?:reservation|delivery|payment|session|order|request)[ _-]?id\s*[:=]\s*[a-z0-9_-]{8,}\b',
    caseSensitive: false,
  );

  return uuid.hasMatch(value) ||
      cuid.hasMatch(value) ||
      labeledInternalId.hasMatch(value);
}

ApiException normalizeApiException(Object error) {
  if (error is ApiException) {
    return error;
  }

  return ApiException(message: userFriendlyErrorMessage(error));
}

String? firstFieldError(
  ApiException error,
  List<String> fieldPaths, {
  AppLocalizations? l10n,
}) {
  for (final issue in error.fieldIssues) {
    if (fieldPaths.contains(issue.path)) {
      if (l10n != null) {
        return localizedFieldIssueMessage(issue, l10n);
      }
      return containsInternalIdentifier(issue.message)
          ? 'Invalid value'
          : issue.message;
    }
  }

  return null;
}

String localizedFieldIssueMessage(ApiFieldIssue issue, AppLocalizations l10n) {
  final projectSubmissionMessage = _localizedProjectSubmissionFieldMessage(
    issue.path,
    l10n,
  );
  if (projectSubmissionMessage != null) {
    return projectSubmissionMessage;
  }

  return l10n.completeRequiredDetail;
}

String? _localizedProjectSubmissionFieldMessage(
  String path,
  AppLocalizations l10n,
) {
  return switch (path) {
    'coverImageUrl' => l10n.projectSubmissionCoverImageRequired,
    'requiredComponents' => l10n.projectSubmissionRequiredComponentsRequired,
    'steps' => l10n.projectSubmissionStepsRequired,
    'categoryId' => l10n.projectSubmissionCategoryRequired,
    'title' => l10n.projectSubmissionTitleRequired,
    'shortDescription' => l10n.projectSubmissionShortDescriptionRequired,
    'description' => l10n.projectSubmissionDescriptionRequired,
    'difficulty' => l10n.projectSubmissionDifficultyRequired,
    'estimatedDurationMinutes' => l10n.projectSubmissionDurationRequired,
    _ => null,
  };
}

String projectSubmissionFieldMessage(ApiFieldIssue issue) {
  return switch (issue.path) {
    'coverImageUrl' =>
      'Add at least one project image before submitting for review.',
    'requiredComponents' =>
      'Add at least one required component before submitting.',
    'steps' => 'Add at least one project step before submitting.',
    'categoryId' => 'Choose a project category before submitting.',
    'title' => 'Add a project title before submitting.',
    'shortDescription' => 'Add a short description before submitting.',
    'description' => 'Add a full project description before submitting.',
    'difficulty' => 'Choose a difficulty level before submitting.',
    'estimatedDurationMinutes' =>
      'Add an estimated project duration before submitting.',
    _ => 'Complete this required project detail before submitting.',
  };
}

String localizedProjectSubmissionIncompleteMessage(
  ApiException error,
  AppLocalizations l10n,
) {
  if (error.code != 'PROJECT_SUBMISSION_INCOMPLETE') {
    return localizedApiErrorMessage(error, l10n);
  }

  final messages = error.fieldIssues
      .map((issue) => localizedFieldIssueMessage(issue, l10n))
      .where((message) => message.trim().isNotEmpty)
      .toSet()
      .toList(growable: false);

  if (messages.isEmpty) {
    return l10n.projectSubmissionDetailsRequired;
  }

  if (messages.length == 1) {
    return messages.first;
  }

  return messages.map((message) => '• $message').join('\n');
}

bool projectSubmissionIncompleteRequiresImage(ApiException error) {
  if (error.code != 'PROJECT_SUBMISSION_INCOMPLETE') {
    return false;
  }

  return error.fieldIssues.any((issue) => issue.path == 'coverImageUrl');
}

String formatProjectSubmissionIncompleteMessage(ApiException error) {
  if (error.code != 'PROJECT_SUBMISSION_INCOMPLETE') {
    return error.displayMessage;
  }

  final messages = error.fieldIssues
      .map(projectSubmissionFieldMessage)
      .where((message) => message.trim().isNotEmpty)
      .toSet()
      .toList(growable: false);

  if (messages.isEmpty) {
    return error.message.trim().isNotEmpty
        ? error.message
        : 'Complete the required project details before submitting.';
  }

  if (messages.length == 1) {
    return messages.first;
  }

  return messages.map((message) => '• $message').join('\n');
}
