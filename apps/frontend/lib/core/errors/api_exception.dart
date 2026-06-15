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

  @override
  String toString() => message;

  String get displayMessage {
    switch (code) {
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
        return message.isNotEmpty
            ? message
            : 'Something went wrong. Please try again.';
    }
  }
}
