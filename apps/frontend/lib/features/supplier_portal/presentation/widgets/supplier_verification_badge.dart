import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

class SupplierVerificationBadge extends StatelessWidget {
  const SupplierVerificationBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;

    final background = switch (status.toUpperCase()) {
      'VERIFIED' => colors.accentSoft,
      'REJECTED' => colors.error.withValues(alpha: 0.18),
      'NOT_REQUIRED' => colors.chipUnselected,
      _ => colors.chipSelected,
    };

    final foreground = switch (status.toUpperCase()) {
      'VERIFIED' => colors.accent,
      'REJECTED' => colors.error,
      _ => colors.textSecondary,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: decorations.badge(background: background),
      child: Text(
        context.s.verificationStatusLabel(status),
        style: context.supplierChip().copyWith(color: foreground),
      ),
    );
  }
}
