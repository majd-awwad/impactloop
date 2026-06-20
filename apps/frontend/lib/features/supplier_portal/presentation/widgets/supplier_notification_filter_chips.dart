import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../data/models/supplier_action_notification.dart';
import '../controllers/supplier_notifications_providers.dart';
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

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: _filters.map((filter) {
        final isSelected = selected == filter;
        final accent = SupplierNotificationStyle.filterSelectedColor(filter);

        return FilterChip(
          label: Text(filter.label),
          selected: isSelected,
          showCheckmark: false,
          onSelected: (_) {
            ref.read(supplierNotificationFilterProvider.notifier).selectFilter(
                  filter,
                );
          },
          labelStyle: AuthDarkTextStyles.chip(context).copyWith(
            color: isSelected ? Colors.white : AuthDarkColors.textPrimary,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            fontSize: compact ? 12 : 13,
          ),
          selectedColor: accent,
          backgroundColor: AuthDarkColors.surfaceSolid.withValues(alpha: 0.92),
          side: BorderSide(
            color: isSelected
                ? accent
                : AuthDarkColors.border.withValues(alpha: 0.55),
            width: isSelected ? 1.2 : 1,
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
