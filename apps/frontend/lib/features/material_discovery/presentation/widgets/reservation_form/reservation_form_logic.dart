import '../../../domain/discovery_material.dart';
import '../../../../reservations/data/models/reservation_quote.dart';

const reservationFormDesktopBreakpoint = 720.0;
const reservationFormMaxWidth = 1000.0;

bool isCountLikeReservationUnit(String unit) =>
    !isMeasurableReservationUnit(unit);

/// Weight, volume, and length can be reserved in fractions.
/// Discrete items (piece, pcs, قطعة, bag, box, …) always step by 1.
bool isMeasurableReservationUnit(String unit) {
  const measurable = {
    'kg',
    'g',
    'liter',
    'ml',
    'meter',
    'cm',
    'm2',
    'm3',
  };

  return measurable.contains(_normalizedReservationUnit(unit));
}

double reservationQuantityStep(String unit) =>
    isMeasurableReservationUnit(unit) ? 0.1 : 1.0;

double reservationQuantityMinimum(String unit) =>
    isMeasurableReservationUnit(unit) ? 0.1 : 1.0;

String _normalizedReservationUnit(String unit) {
  final trimmed = unit.trim().toLowerCase();
  if (trimmed.isEmpty) {
    return '';
  }

  if (RegExp('كجم|كغ|كيلو').hasMatch(trimmed)) {
    return 'kg';
  }
  if (RegExp('غرام|جرام').hasMatch(trimmed) && !trimmed.contains('كيلو')) {
    return 'g';
  }
  if (RegExp('ملليلتر|مليلتر').hasMatch(trimmed)) {
    return 'ml';
  }
  if (RegExp('لتر|ليتر').hasMatch(trimmed)) {
    return 'liter';
  }
  if (RegExp('سنتيمتر|سم').hasMatch(trimmed)) {
    return 'cm';
  }
  if (RegExp('متر').hasMatch(trimmed)) {
    return 'meter';
  }

  final ascii = trimmed.replaceAll(RegExp(r'[^\x00-\x7F]+'), ' ').trim();
  final source = ascii.isNotEmpty ? ascii : trimmed;
  final token = source
      .split(RegExp(r'[\s,/_-]+'))
      .where((part) => part.isNotEmpty)
      .last;

  return switch (token) {
    'pcs' || 'pc' || 'piece' || 'pieces' => 'piece',
    'kg' || 'kilogram' || 'kilograms' || 'kilo' => 'kg',
    'g' || 'gram' || 'grams' => 'g',
    'l' || 'liter' || 'liters' || 'litre' || 'litres' => 'liter',
    'ml' || 'milliliter' || 'millilitre' => 'ml',
    'm' || 'meter' || 'meters' || 'metre' || 'metres' => 'meter',
    'cm' || 'centimeter' || 'centimetre' => 'cm',
    'm2' || 'm²' || 'sqm' => 'm2',
    'm3' || 'm³' => 'm3',
    _ => token,
  };
}

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
