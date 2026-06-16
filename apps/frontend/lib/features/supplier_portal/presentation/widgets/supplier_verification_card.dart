import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import 'supplier_verification_badge.dart';

class SupplierVerificationCard extends StatelessWidget {
  const SupplierVerificationCard({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(minHeight: 180),
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
                  Icons.verified_user_outlined,
                  color: AuthDarkColors.accent,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                'Verification',
                style: AuthDarkTextStyles.sectionTitle(context),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          SupplierVerificationBadge(status: status),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Verification is read-only for now. Document upload and review workflows will come later.',
            style: AuthDarkTextStyles.body(context),
          ),
        ],
      ),
    );
  }
}
