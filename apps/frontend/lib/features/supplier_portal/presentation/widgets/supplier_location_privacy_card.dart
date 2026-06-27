import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

class SupplierLocationPrivacyCard extends StatelessWidget {
  const SupplierLocationPrivacyCard({super.key, this.visibility});

  final String? visibility;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

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
                  color: colors.accentSoft.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: colors.border.withValues(alpha: 0.35),
                  ),
                ),
                child: Icon(
                  Icons.privacy_tip_outlined,
                  color: colors.accent,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                context.s.locationPrivacy,
                style: context.supplierSectionTitle(),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            context.s.locationPrivacySubtitle,
            style: context.supplierBody(),
          ),
          if (visibility != null && visibility!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: context.supplierDecorations.profileSectionPanel,
              child: Row(
                children: [
                  Icon(
                    Icons.visibility_outlined,
                    color: colors.accent,
                    size: 18,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      context.s.visibilityCurrent(
                        context.s.visibilityLabel(visibility!),
                      ),
                      style: context.supplierBody().copyWith(
                        color: colors.textPrimary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
