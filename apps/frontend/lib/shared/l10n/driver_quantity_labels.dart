import '../../features/material_discovery/presentation/reservation_dialog_copy.dart';
import '../../l10n/app_localizations.dart';

/// Localized quantity + unit label for driver delivery items.
String driverQuantityLabel(
  AppLocalizations l10n,
  double quantity,
  String unit,
) {
  final count = quantity % 1 == 0 ? quantity.round() : null;
  final quantityText = formatReservationQuantity(quantity);
  final normalized = _normalizeUnitCode(unit);

  if (count != null) {
    return switch (normalized) {
      'piece' => l10n.driverQuantityPiece(count),
      'sheet' => l10n.driverQuantitySheet(count),
      'bag' => l10n.driverQuantityBag(count),
      'kg' => l10n.driverQuantityKg(count),
      'item' => l10n.driverQuantityItem(count),
      'unit' => l10n.driverQuantityUnit(count),
      'panel' => l10n.driverQuantityPanel(count),
      'crate' => l10n.driverQuantityCrate(count),
      'meter' => l10n.driverQuantityMeter(count),
      'liter' => l10n.driverQuantityLiter(count),
      'roll' => l10n.driverQuantityRoll(count),
      'box' => l10n.driverQuantityBox(count),
      'pack' => l10n.driverQuantityPack(count),
      'set' => l10n.driverQuantitySet(count),
      _ => l10n.quantityWithUnit(quantityText, unit.trim()),
    };
  }

  final unitLabel = _singularUnitLabel(l10n, normalized, unit.trim());
  return l10n.quantityWithUnit(quantityText, unitLabel);
}

String _singularUnitLabel(
  AppLocalizations l10n,
  String normalized,
  String rawUnit,
) {
  return switch (normalized) {
    'piece' => l10n.driverUnitPiece,
    'sheet' => l10n.driverUnitSheet,
    'bag' => l10n.driverUnitBag,
    'kg' => l10n.driverUnitKg,
    'item' => l10n.driverUnitItem,
    'unit' => l10n.driverUnitUnit,
    'panel' => l10n.driverUnitPanel,
    'crate' => l10n.driverUnitCrate,
    'meter' => l10n.driverUnitMeter,
    'liter' => l10n.driverUnitLiter,
    'roll' => l10n.driverUnitRoll,
    'box' => l10n.driverUnitBox,
    'pack' => l10n.driverUnitPack,
    'set' => l10n.driverUnitSet,
    _ => rawUnit,
  };
}

String _normalizeUnitCode(String unit) {
  final trimmed = unit.trim();
  if (trimmed.isEmpty) {
    return '';
  }

  final ascii = trimmed
      .replaceAll(RegExp(r'[^\x00-\x7F]+'), '')
      .trim()
      .toLowerCase();

  return switch (ascii) {
    'pcs' || 'pc' || 'piece' || 'pieces' => 'piece',
    'sheet' || 'sheets' => 'sheet',
    'bag' || 'bags' => 'bag',
    'kg' || 'kilogram' || 'kilograms' || 'kilo' => 'kg',
    'item' || 'items' => 'item',
    'unit' || 'units' => 'unit',
    'panel' || 'panels' => 'panel',
    'crate' || 'crates' => 'crate',
    'meter' || 'meters' || 'm' || 'metre' || 'metres' => 'meter',
    'liter' || 'liters' || 'litre' || 'litres' || 'l' => 'liter',
    'roll' || 'rolls' => 'roll',
    'box' || 'boxes' => 'box',
    'pack' || 'packs' => 'pack',
    'set' || 'sets' => 'set',
    _ => ascii,
  };
}
