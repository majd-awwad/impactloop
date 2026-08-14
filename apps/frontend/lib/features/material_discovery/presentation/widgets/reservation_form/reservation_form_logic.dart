import '../../../domain/discovery_material.dart';
import '../../../../reservations/data/models/reservation_quote.dart';

const reservationFormDesktopBreakpoint = 720.0;
const reservationFormMaxWidth = 1000.0;

bool isCountLikeReservationUnit(String unit) {
  const countLike = {
    'piece',
    'pieces',
    'item',
    'items',
    'unit',
    'units',
    'sheet',
    'sheets',
    'panel',
    'panels',
    'crate',
    'crates',
  };

  return countLike.contains(unit.toLowerCase());
}

double reservationQuantityStep(String unit) =>
    isCountLikeReservationUnit(unit) ? 1.0 : 0.1;

double reservationQuantityMinimum(String unit) =>
    isCountLikeReservationUnit(unit) ? 1.0 : 0.1;

double resolveInitialReservationQuantity({
  required double availableQuantity,
  required String unit,
  double? requestedQuantity,
}) {
  if (availableQuantity <= 0) {
    return 0;
  }

  if (requestedQuantity != null && requestedQuantity > 0) {
    final min = reservationQuantityMinimum(unit);
    return requestedQuantity.clamp(min, availableQuantity).toDouble();
  }

  final min = reservationQuantityMinimum(unit);
  if (availableQuantity < min) {
    return availableQuantity;
  }

  if (availableQuantity >= 1) {
    return 1.0;
  }

  return availableQuantity < min ? availableQuantity : min;
}

String? initialFulfillmentMethod(DiscoveryMaterial material) {
  if (material.pickupAllowed) {
    return 'PICKUP';
  }

  if (material.deliveryAvailable) {
    return 'DELIVERY';
  }

  return null;
}

bool shouldShowReservationPaymentMethod({
  required DiscoveryMaterial material,
  required String? fulfillmentMethod,
  required double? quantity,
  ReservationQuote? quote,
}) {
  if (fulfillmentMethod == null) {
    return false;
  }

  if (quantity == null || quantity <= 0) {
    return false;
  }

  if (quote != null) {
    return quote.totalAmount > 0;
  }

  return !material.isFree;
}

bool canSubmitReservationForm({
  required bool isSubmitting,
  required String? fulfillmentMethod,
  required double? quantity,
  required double availableQuantity,
  required bool isPickup,
  required bool isDelivery,
  required String dropoffCity,
  required String deliveryAddress,
  required ReservationQuote? quote,
  required bool quoteLoading,
  required String? quoteError,
  required bool paymentRequired,
  required String paymentMethod,
}) {
  if (isSubmitting || fulfillmentMethod == null) {
    return false;
  }

  if (quantity == null || quantity <= 0 || quantity > availableQuantity) {
    return false;
  }

  if (paymentRequired && paymentMethod.trim().isEmpty) {
    return false;
  }

  if (isPickup) {
    return quote != null && !quoteLoading;
  }

  if (isDelivery) {
    if (dropoffCity.trim().isEmpty || deliveryAddress.trim().isEmpty) {
      return false;
    }

    return quote != null && !quoteLoading && quoteError == null;
  }

  return false;
}
