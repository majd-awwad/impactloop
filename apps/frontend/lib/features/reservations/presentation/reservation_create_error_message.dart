import '../../../core/errors/api_exception.dart';

String reservationCreateErrorMessage(ApiException error) {
  final message = error.message.trim();

  if (_isSelfReservationError(message)) {
    return 'You cannot reserve a material you listed yourself.';
  }

  if (_isOpenReservationExistsError(message)) {
    return 'You already have an open reservation for this material. Check My Reservations.';
  }

  if (_isUnavailableError(message, error.statusCode)) {
    return 'This material is no longer available for new reservations.';
  }

  final invalidQuantityMessage = _invalidQuantityErrorMessage(error);
  if (invalidQuantityMessage != null) {
    return invalidQuantityMessage;
  }

  if (message.isNotEmpty) {
    return message;
  }

  if (error.statusCode == 409) {
    return 'This material is no longer available for new reservations.';
  }

  return error.displayMessage;
}

bool _isSelfReservationError(String message) {
  final lower = message.toLowerCase();
  return lower.contains('cannot reserve your own material');
}

bool _isOpenReservationExistsError(String message) {
  final lower = message.toLowerCase();
  return lower.contains('already have an open reservation');
}

bool _isUnavailableError(String message, int? statusCode) {
  final lower = message.toLowerCase();
  if (lower.contains('no longer available')) {
    return true;
  }

  return statusCode == 409 &&
      lower.contains('material') &&
      !lower.contains('already have');
}

String? _invalidQuantityErrorMessage(ApiException error) {
  final message = error.message.trim().toLowerCase();
  final availableQuantity = error.details?['availableQuantity'];

  if (message.contains('quantity must be positive') ||
      availableQuantity != null) {
    if (availableQuantity != null) {
      final availableText = _formatAvailableQuantity(availableQuantity);
      return 'That quantity is not available. You can request up to $availableText right now.';
    }

    return 'Enter a quantity greater than zero and no more than what is available.';
  }

  return null;
}

String _formatAvailableQuantity(Object value) {
  if (value is num) {
    if (value == value.roundToDouble()) {
      return value.toStringAsFixed(0);
    }
    return value.toString();
  }

  return value.toString();
}
