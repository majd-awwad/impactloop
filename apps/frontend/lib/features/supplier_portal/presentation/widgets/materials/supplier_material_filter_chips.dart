import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_responsive_chip_row.dart';

enum SupplierMaterialStatusFilter {
  all,
  available,
  pending,
  reserved,
  reused,
  unavailable,
}

enum SupplierMaterialPriceFilter {
  all,
  free,
  paid,
}

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

  Color accentColor(BuildContext context) => switch (this) {
        SupplierMaterialStatusFilter.all => context.supplierColors.accent,
        SupplierMaterialStatusFilter.available => context.supplierColors.accent,
        SupplierMaterialStatusFilter.pending => context.supplierColors.accent,
        SupplierMaterialStatusFilter.reserved => context.supplierColors.accent,
        SupplierMaterialStatusFilter.reused => context.supplierColors.accent,
        SupplierMaterialStatusFilter.unavailable => context.supplierColors.accent,
      };
}

/// Maps API query status to the status filter chip selection.
SupplierMaterialStatusFilter statusFilterFromQuery(String? status) {
  return SupplierMaterialStatusFilter.values.firstWhere(
    (filter) => filter.apiValue == status,
    orElse: () => SupplierMaterialStatusFilter.all,
  );
}

/// Maps API query isFree to the price filter chip selection.
SupplierMaterialPriceFilter priceFilterFromQuery(bool? isFree) {
  return SupplierMaterialPriceFilter.values.firstWhere(
    (filter) => filter.apiValue == isFree,
    orElse: () => SupplierMaterialPriceFilter.all,
  );
}

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

  Color accentColor(BuildContext context) => switch (this) {
        SupplierMaterialPriceFilter.all => context.supplierColors.accent,
        SupplierMaterialPriceFilter.free => context.supplierColors.accent,
        SupplierMaterialPriceFilter.paid => context.supplierColors.accent,
      };
}

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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          l.filterStatusLabel,
          style: context.supplierLabel().copyWith(
            color: context.supplierColors.textSecondary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        SupplierResponsiveChipRow(
          children: SupplierMaterialStatusFilter.values
              .map(
                (filter) => _FilterChip(
                  label: filter.label(l),
                  selected: statusFilter == filter,
                  onTap: () => onStatusSelected(filter),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          l.filterPriceLabel,
          style: context.supplierLabel().copyWith(
            color: context.supplierColors.textSecondary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        SupplierResponsiveChipRow(
          children: SupplierMaterialPriceFilter.values
              .map(
                (filter) => _FilterChip(
                  label: filter.label(l),
                  selected: priceFilter == filter,
                  onTap: () => onPriceSelected(filter),
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final textTheme = Theme.of(context).textTheme;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.md - AppSpacing.xs,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: selected ? colors.accentSoft : colors.chipUnselected,
            borderRadius: AppRadius.pillAll,
            border: Border.all(
              color: selected
                  ? colors.accent.withValues(alpha: 0.34)
                  : colors.border,
            ),
          ),
          child: Text(
            label,
            softWrap: false,
            style: textTheme.labelMedium?.copyWith(
              color: selected ? colors.accent : colors.textSecondary,
              fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}
