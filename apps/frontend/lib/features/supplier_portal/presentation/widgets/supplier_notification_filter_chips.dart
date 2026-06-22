import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../data/models/supplier_action_notification.dart';
import '../controllers/supplier_notifications_providers.dart';
import '../theme/supplier_theme_extension.dart';
import 'supplier_notification_style.dart';

class SupplierNotificationFilterChips extends ConsumerWidget {
  const SupplierNotificationFilterChips({super.key});

  static const _filters = [
    SupplierNotificationFilter.all,
    SupplierNotificationFilter.actionNeeded,
    SupplierNotificationFilter.reservations,
    SupplierNotificationFilter.completed,
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(supplierNotificationFilterProvider);
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final colors = context.supplierColors;
    final l = context.s;

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: _filters.map((filter) {
        final isSelected = selected == filter;
        final accent = SupplierNotificationStyle.filterSelectedColor(
          context,
          filter,
        );

        return FilterChip(
          label: Text(l.notificationFilterLabel(filter)),
          selected: isSelected,
          showCheckmark: false,
          onSelected: (_) {
            ref
                .read(supplierNotificationFilterProvider.notifier)
                .selectFilter(filter);
          },
          labelStyle: context.supplierChip().copyWith(
            color: isSelected ? colors.textOnAccent : colors.textPrimary,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
            fontSize: compact ? 12 : 13,
          ),
          selectedColor: accent,
          backgroundColor: isSelected ? accent : colors.chipUnselected,
          side: BorderSide(
            color: isSelected ? accent : colors.border,
            width: isSelected ? 1.5 : 1,
          ),
          padding: EdgeInsets.symmetric(
            horizontal: compact ? 10 : 12,
            vertical: compact ? 4 : 6,
          ),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.pillAll),
        );
      }).toList(),
    );
  }
}
