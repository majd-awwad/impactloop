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
      case 'CONFLICT':
        return message.isNotEmpty
            ? message
            : 'This request conflicts with the current state. Please refresh and try again.';
      case 'VALIDATION_ERROR':
        final firstIssue = fieldIssues.isNotEmpty
            ? fieldIssues.first.message
            : null;
        if (firstIssue != null && firstIssue.isNotEmpty) {
          return firstIssue;
        }
        return message;
      case 'PROJECT_SUBMISSION_INCOMPLETE':
        return formatProjectSubmissionIncompleteMessage(this);
      case 'UNAUTHENTICATED':
        return 'Your session has expired. Please sign in again.';
      case 'FORBIDDEN':
        return message.isNotEmpty
            ? message
            : 'You do not have permission to complete this action.';
      case 'ACCOUNT_SUSPENDED':
        return 'Your account has been suspended after repeated verified reports. Contact admin.';
      case 'PICKUP_WINDOW_REQUIRED':
        return 'Choose a new pickup start and end time before sending a reschedule request.';
      default:
        final errorCode = code;
        if (errorCode != null && errorCode.startsWith('PICKUP_')) {
          return message.isNotEmpty
              ? message
              : 'The pickup window is not valid. Choose a different time.';
        }
        if (statusCode != null && statusCode! >= 500) {
          return 'The server hit a problem. Please try again in a moment.';
        }

        return message.isNotEmpty
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

ApiException normalizeApiException(Object error) {
  if (error is ApiException) {
    return error;
  }

  return ApiException(message: userFriendlyErrorMessage(error));
}

String? firstFieldError(ApiException error, List<String> fieldPaths) {
  for (final issue in error.fieldIssues) {
    if (fieldPaths.contains(issue.path)) {
      return issue.message;
    }
  }

  return null;
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
    _ =>
      issue.message.trim().isNotEmpty
          ? issue.message
          : 'Complete this required project detail before submitting.',
  };
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
