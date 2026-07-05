import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';

class SupplierQuickActionCard extends StatelessWidget {
  const SupplierQuickActionCard({
    super.key,
    required this.label,
    required this.caption,
    required this.icon,
    required this.route,
  });

  final String label;
  final String caption;
  final IconData icon;
  final String route;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push(route),
        borderRadius: AppRadius.lgAll,
        hoverColor: context.supplierColors.chipSelected.withValues(alpha: 0.28),
        child: Ink(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: context.supplierDecorations.quickActionCard,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                width: 32,
                child: Icon(icon, color: context.supplierColors.accent),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.supplierLabel().copyWith(
                        color: context.supplierColors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      caption,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: context.supplierBody().copyWith(fontSize: 12),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_ios_rounded,
                size: 14,
                color: context.supplierColors.textMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
