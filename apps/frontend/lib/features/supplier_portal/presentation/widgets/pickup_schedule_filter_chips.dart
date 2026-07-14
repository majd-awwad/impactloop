import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../data/models/supplier_pickup_schedule_item.dart';
import '../controllers/supplier_pickup_schedule_providers.dart';
import '../theme/supplier_theme_extension.dart';
import 'pickup_schedule_status_style.dart';

class PickupScheduleFilterChips extends ConsumerWidget {
  const PickupScheduleFilterChips({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(pickupScheduleFilterProvider);
    final l = context.s;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: SupplierPickupScheduleFilter.values.map((filter) {
          final isSelected = filter == selected;
          return Padding(
            padding: const EdgeInsets.only(right: AppSpacing.sm),
            child: _FilterChip(
              label: l.pickupScheduleFilterLabel(filter),
              style: PickupScheduleStatusStyle.styleForPickupFilter(filter),
              isSelected: isSelected,
              onTap: () {
                ref
                    .read(pickupScheduleFilterProvider.notifier)
                    .selectFilter(filter);
              },
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.style,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final PickupScheduleStatusStyle style;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final statusStyle = style.resolve(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: Ink(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: 6,
          ),
          decoration: BoxDecoration(
            color: isSelected
                ? statusStyle.selectedBackground
                : statusStyle.background,
            borderRadius: AppRadius.pillAll,
            border: Border.all(
              color:
                  isSelected ? statusStyle.selectedBorder : statusStyle.border,
            ),
          ),
          child: Text(
            label,
            style: context.supplierChip().copyWith(
              fontSize: 13,
              color: isSelected
                  ? statusStyle.foreground
                  : statusStyle.foreground.withValues(alpha: 0.78),
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}
