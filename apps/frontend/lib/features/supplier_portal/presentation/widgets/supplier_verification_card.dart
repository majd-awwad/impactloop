import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

import '../../../../app/theme/app_spacing.dart';
import 'supplier_verification_badge.dart';

class SupplierVerificationCard extends StatelessWidget {
  const SupplierVerificationCard({
    super.key,
    required this.status,
    this.adminNote,
  });

  final String status;
  final String? adminNote;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(minHeight: 180),
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
                  color: context.supplierColors.accentSoft.withValues(
                    alpha: 0.16,
                  ),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: context.supplierColors.border.withValues(
                      alpha: 0.35,
                    ),
                  ),
                ),
                child: Icon(
                  Icons.verified_user_outlined,
                  color: context.supplierColors.accent,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                context.s.verification,
                style: context.supplierSectionTitle(),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          SupplierVerificationBadge(status: status),
          const SizedBox(height: AppSpacing.sm),
          if (adminNote != null && adminNote!.trim().isNotEmpty) ...[
            Text(
              context.s.verificationAdminNoteLabel,
              style: context.supplierSectionTitle().copyWith(fontSize: 14),
            ),
            const SizedBox(height: 4),
            Text(adminNote!.trim(), style: context.supplierBody()),
            const SizedBox(height: AppSpacing.sm),
          ],
          Text(
            context.s.verificationReadOnlyNote,
            style: context.supplierBody(),
          ),
        ],
      ),
    );
  }
}
