import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import 'change_password_dialog.dart';

class SupplierAccountSecurityCard extends StatelessWidget {
  const SupplierAccountSecurityCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: SupplierDecorations.sideInsightCard,
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
                  color: AuthDarkColors.accentSoft.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: AuthDarkColors.border.withValues(alpha: 0.35),
                  ),
                ),
                child: const Icon(
                  Icons.lock_outline,
                  color: AuthDarkColors.accent,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Account Security',
                      style: AuthDarkTextStyles.sectionTitle(context),
                    ),
                    Text(
                      'Keep your account protected.',
                      style: AuthDarkTextStyles.body(context),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton.icon(
            onPressed: () => showChangePasswordDialog(context),
            icon: const Icon(Icons.password_outlined, size: 18),
            label: const Text('Change password'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AuthDarkColors.textPrimary,
              side: BorderSide(
                color: AuthDarkColors.border.withValues(alpha: 0.55),
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
