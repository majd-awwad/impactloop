String formatReservationAvailableQuantityLabel({
  required double availableQuantity,
  required String unit,
}) {
  final formatted = formatReservationQuantity(availableQuantity);
  final unitLabel = formatReservationUnitForQuantity(unit, availableQuantity);
  return 'Available: $formatted $unitLabel';
}

String formatReservationQuantity(double value) {
  if (value == value.roundToDouble()) {
    return value.toStringAsFixed(0);
  }

  return value
      .toStringAsFixed(2)
      .replaceFirst(RegExp(r'0+$'), '')
      .replaceFirst(RegExp(r'\.$'), '');
}

String formatReservationUnitForQuantity(String unit, double quantity) {
  final normalized = unit.trim().toLowerCase();
  if (quantity == 1) {
    switch (normalized) {
      case 'pieces':
        return 'piece';
      case 'items':
        return 'item';
      case 'units':
        return 'unit';
      case 'sheets':
        return 'sheet';
      case 'panels':
        return 'panel';
      case 'crates':
        return 'crate';
      default:
        return unit;
    }
  }

  switch (normalized) {
    case 'piece':
      return 'pieces';
    case 'item':
      return 'items';
    case 'unit':
      return 'units';
    case 'sheet':
      return 'sheets';
    case 'panel':
      return 'panels';
    case 'crate':
      return 'crates';
    default:
      return unit;
  }
}
