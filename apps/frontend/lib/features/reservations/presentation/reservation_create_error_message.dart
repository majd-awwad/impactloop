import '../../../core/errors/api_exception.dart';
import '../../../l10n/app_localizations.dart';

String reservationCreateErrorMessage(
  ApiException error, {
  AppLocalizations? l10n,
}) {
  final message = error.message.trim();
  final displayMessage = error.displayMessage.trim();

  if (_isSelfReservationError(message)) {
    return l10n?.cannotReserveOwnMaterial ??
        'You cannot reserve a material you listed yourself.';
  }

  if (_isOpenReservationExistsError(message)) {
    return l10n?.openReservationAlreadyExists ??
        'You already have an open reservation for this material. Check My Reservations.';
  }

  if (_isUnavailableError(message, error.statusCode)) {
    return l10n?.materialUnavailableForReservation ??
        'This material is no longer available for new reservations.';
  }

  final invalidQuantityMessage = _invalidQuantityErrorMessage(error, l10n);
  if (invalidQuantityMessage != null) {
    return invalidQuantityMessage;
  }

  if (l10n != null) {
    return localizedApiErrorMessage(error, l10n);
  }

  if (displayMessage.isNotEmpty && displayMessage != 'Validation failed') {
    return displayMessage;
  }

  if (message.isNotEmpty) {
    return message;
  }

  if (error.statusCode == 409) {
    return l10n?.materialUnavailableForReservation ??
        'This material is no longer available for new reservations.';
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

String? _invalidQuantityErrorMessage(
  ApiException error,
  AppLocalizations? l10n,
) {
  final message = error.message.trim().toLowerCase();
  final availableQuantity = error.details?['availableQuantity'];

  if (message.contains('quantity must be positive') ||
      availableQuantity != null) {
    if (availableQuantity != null) {
      final availableText = _formatAvailableQuantity(availableQuantity);
      return l10n?.reservationQuantityUpTo(availableText) ??
          'That quantity is not available. You can request up to $availableText right now.';
    }

    return l10n?.invalidReservationQuantity ??
        'Enter a quantity greater than zero and no more than what is available.';
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
