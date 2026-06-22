import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_my_materials_colors.dart';

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
        SupplierMaterialStatusFilter.all =>
          SupplierMyMaterialsColors.statTotal(context),
        SupplierMaterialStatusFilter.available =>
          SupplierMyMaterialsColors.statAvailable(context),
        SupplierMaterialStatusFilter.pending =>
          SupplierMyMaterialsColors.statPending(context),
        SupplierMaterialStatusFilter.reserved =>
          SupplierMyMaterialsColors.statReserved(context),
        SupplierMaterialStatusFilter.reused =>
          SupplierMyMaterialsColors.statReused(context),
        SupplierMaterialStatusFilter.unavailable =>
          SupplierMyMaterialsColors.statUnavailable(context),
      };
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
        SupplierMaterialPriceFilter.all =>
          SupplierMyMaterialsColors.statTotal(context),
        SupplierMaterialPriceFilter.free =>
          SupplierMyMaterialsColors.statAvailable(context),
        SupplierMaterialPriceFilter.paid =>
          SupplierMyMaterialsColors.statReserved(context),
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
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l.filterStatusLabel,
          style: context.supplierLabel().copyWith(
            color: context.supplierColors.textSecondary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        _ChipRow(
          children: SupplierMaterialStatusFilter.values
              .map(
                (filter) => _FilterChip(
                  label: filter.label(l),
                  selected: statusFilter == filter,
                  accent: filter.accentColor(context),
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
        _ChipRow(
          children: SupplierMaterialPriceFilter.values
              .map(
                (filter) => _FilterChip(
                  label: filter.label(l),
                  selected: priceFilter == filter,
                  accent: filter.accentColor(context),
                  onTap: () => onPriceSelected(filter),
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}

class _ChipRow extends StatelessWidget {
  const _ChipRow({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(width: AppSpacing.sm),
            children[i],
          ],
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.accent,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: 14,
            vertical: 8,
          ),
          decoration: BoxDecoration(
            color: selected
                ? SupplierMyMaterialsColors.chipSelectedBackground(
                    context,
                    accent,
                  )
                : SupplierMyMaterialsColors.chipUnselectedBackground(
                    context,
                    accent,
                  ),
            borderRadius: AppRadius.pillAll,
            border: Border.all(
              color: selected
                  ? SupplierMyMaterialsColors.chipSelectedBorder(
                      context,
                      accent,
                    )
                  : SupplierMyMaterialsColors.chipUnselectedBorder(
                      context,
                      accent,
                    ),
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Text(
            label,
            style: context.supplierBody().copyWith(
              color: selected
                  ? SupplierMyMaterialsColors.chipSelectedText(context, accent)
                  : SupplierMyMaterialsColors.chipUnselectedText(
                      context,
                      accent,
                    ),
              fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }
}
