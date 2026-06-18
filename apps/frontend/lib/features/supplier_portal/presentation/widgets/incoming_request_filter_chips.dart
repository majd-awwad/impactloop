import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../controllers/supplier_requests_providers.dart';
import 'incoming_request_status_style.dart';

class IncomingRequestFilterChips extends ConsumerWidget {
  const IncomingRequestFilterChips({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(incomingRequestTabProvider);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: SupplierIncomingRequestTab.values.map((tab) {
          final isSelected = tab == selected;
          return Padding(
            padding: const EdgeInsets.only(right: AppSpacing.sm),
            child: _FilterChip(
              label: tab.label,
              style: IncomingRequestStatusStyle.forTab(tab),
              isSelected: isSelected,
              onTap: () {
                ref.read(incomingRequestTabProvider.notifier).selectTab(tab);
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
  final IncomingRequestStatusStyle style;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: Ink(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: isSelected ? style.selectedBackground : style.background,
            borderRadius: AppRadius.pillAll,
            border: Border.all(
              color: isSelected ? style.selectedBorder : style.border,
            ),
          ),
          child: Text(
            label,
            style: AuthDarkTextStyles.chip(context).copyWith(
              fontSize: 13,
              color: isSelected
                  ? style.foreground
                  : style.foreground.withValues(alpha: 0.78),
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}
