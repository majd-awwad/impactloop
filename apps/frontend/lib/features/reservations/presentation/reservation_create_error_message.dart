import '../../../core/errors/api_exception.dart';

String reservationCreateErrorMessage(ApiException error) {
  if (error.message.isNotEmpty) {
    return error.message;
  }

  if (error.statusCode == 409) {
    return 'This material is no longer available.';
  }

  return error.displayMessage;
}
