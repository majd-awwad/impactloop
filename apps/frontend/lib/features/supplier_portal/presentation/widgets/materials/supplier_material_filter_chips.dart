import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../theme/supplier_theme_extension.dart';

enum SupplierMaterialStatusFilter {
  all,
  available,
  pending,
  reserved,
  reused,
  unavailable,
}

enum SupplierMaterialPriceFilter { all, free, paid }

extension SupplierMaterialStatusFilterX on SupplierMaterialStatusFilter {
  String? get apiValue => switch (this) {
    SupplierMaterialStatusFilter.available => 'AVAILABLE',
    SupplierMaterialStatusFilter.pending => 'PENDING_RESERVATION',
    SupplierMaterialStatusFilter.reserved => 'RESERVED',
    SupplierMaterialStatusFilter.reused => 'REUSED',
    SupplierMaterialStatusFilter.unavailable => 'UNAVAILABLE',
    SupplierMaterialStatusFilter.all => null,
  };

  String label(SupplierL10n l) => switch (this) {
    SupplierMaterialStatusFilter.all => l.filterAll,
    SupplierMaterialStatusFilter.available => l.filterAvailable,
    SupplierMaterialStatusFilter.pending => l.filterPending,
    SupplierMaterialStatusFilter.reserved => l.filterReserved,
    SupplierMaterialStatusFilter.reused => l.filterReused,
    SupplierMaterialStatusFilter.unavailable => l.filterUnavailable,
  };
}

SupplierMaterialStatusFilter statusFilterFromQuery(String? status) =>
    SupplierMaterialStatusFilter.values.firstWhere(
      (filter) => filter.apiValue == status,
      orElse: () => SupplierMaterialStatusFilter.all,
    );

SupplierMaterialPriceFilter priceFilterFromQuery(bool? isFree) =>
    SupplierMaterialPriceFilter.values.firstWhere(
      (filter) => filter.apiValue == isFree,
      orElse: () => SupplierMaterialPriceFilter.all,
    );

extension SupplierMaterialPriceFilterX on SupplierMaterialPriceFilter {
  bool? get apiValue => switch (this) {
    SupplierMaterialPriceFilter.free => true,
    SupplierMaterialPriceFilter.paid => false,
    SupplierMaterialPriceFilter.all => null,
  };

  String label(SupplierL10n l) => switch (this) {
    SupplierMaterialPriceFilter.all => l.filterAllPrices,
    SupplierMaterialPriceFilter.free => l.free,
    SupplierMaterialPriceFilter.paid => l.paid,
  };
}

/// Compact server-backed status and price selectors for the materials toolbar.
class SupplierMaterialFilterChips extends StatelessWidget {
  const SupplierMaterialFilterChips({
    super.key,
    required this.statusFilter,
    required this.priceFilter,
    required this.onStatusSelected,
    required this.onPriceSelected,
  });

  final SupplierMaterialStatusFilter statusFilter;
  final SupplierMaterialPriceFilter priceFilter;
  final ValueChanged<SupplierMaterialStatusFilter> onStatusSelected;
  final ValueChanged<SupplierMaterialPriceFilter> onPriceSelected;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    return LayoutBuilder(
      builder: (context, constraints) {
        final stack = constraints.maxWidth < 330;
        final status = _FilterDropdown<SupplierMaterialStatusFilter>(
          label: l.filterStatusLabel,
          value: statusFilter,
          items: SupplierMaterialStatusFilter.values,
          itemLabel: (value) => value.label(l),
          onChanged: onStatusSelected,
        );
        final price = _FilterDropdown<SupplierMaterialPriceFilter>(
          label: l.filterPriceLabel,
          value: priceFilter,
          items: SupplierMaterialPriceFilter.values,
          itemLabel: (value) => value.label(l),
          onChanged: onPriceSelected,
        );

        if (stack) {
          return Column(
            children: [
              status,
              const SizedBox(height: AppSpacing.sm),
              price,
            ],
          );
        }

        return Row(
          children: [
            Expanded(child: status),
            const SizedBox(width: AppSpacing.sm),
            Expanded(child: price),
          ],
        );
      },
    );
  }
}

class _FilterDropdown<T> extends StatelessWidget {
  const _FilterDropdown({
    required this.label,
    required this.value,
    required this.items,
    required this.itemLabel,
    required this.onChanged,
  });

  final String label;
  final T value;
  final List<T> items;
  final String Function(T value) itemLabel;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return DropdownButtonFormField<T>(
      initialValue: value,
      isExpanded: true,
      onChanged: (next) {
        if (next != null) onChanged(next);
      },
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: colors.surfaceSolid,
        contentPadding: const EdgeInsetsDirectional.fromSTEB(
          AppSpacing.md,
          12,
          AppSpacing.sm,
          12,
        ),
        border: OutlineInputBorder(
          borderRadius: AppRadius.lgAll,
          borderSide: BorderSide(color: colors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.lgAll,
          borderSide: BorderSide(color: colors.border),
        ),
      ),
      items: [
        for (final item in items)
          DropdownMenuItem(value: item, child: Text(itemLabel(item))),
      ],
    );
  }
}
