import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

import '../../../../app/theme/app_spacing.dart';
import 'change_password_dialog.dart';

class SupplierAccountSecurityCard extends StatelessWidget {
  const SupplierAccountSecurityCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: context.supplierDecorations.sideInsightCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: context.supplierColors.accentSoft.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: context.supplierColors.border.withValues(alpha: 0.35),
                  ),
                ),
                child: Icon(
                  Icons.lock_outline,
                  color: context.supplierColors.accent,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.s.accountSecurity,
                      style: context.supplierSectionTitle(),
                    ),
                    Text(
                      context.s.accountSecuritySubtitle,
                      style: context.supplierBody(),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton.icon(
            onPressed: () => showChangePasswordDialog(context),
            icon: Icon(Icons.password_outlined, size: 18),
            label: Text(context.s.changePassword),
            style: OutlinedButton.styleFrom(
              foregroundColor: context.supplierColors.textPrimary,
              side: BorderSide(
                color: context.supplierColors.border.withValues(alpha: 0.55),
              ),
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
