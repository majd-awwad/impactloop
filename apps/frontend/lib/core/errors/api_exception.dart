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

  List<ApiFieldIssue> get fieldIssues {
    final rawIssues = details?['issues'];

    if (rawIssues is! List) {
      return const [];
    }

    return rawIssues.whereType<Map>().map((issue) {
      return ApiFieldIssue(
        path: issue['path']?.toString() ?? '',
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
        return 'An account with that email or phone already exists.';
      case 'VALIDATION_ERROR':
        return message;
      case 'UNAUTHENTICATED':
        return 'Your session has expired. Please sign in again.';
      case 'FORBIDDEN':
        return message.isNotEmpty
            ? message
            : 'You do not have permission to complete this action.';
      default:
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
