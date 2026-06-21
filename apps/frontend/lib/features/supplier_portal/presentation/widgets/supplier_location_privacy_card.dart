import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';

String visibilityLabel(String value) {
  return switch (value) {
    'PUBLIC' => 'Public area',
    'ORDER_ONLY' => 'Order only',
    'PRIVATE' => 'Private',
    _ => value,
  };
}

class SupplierLocationPrivacyCard extends StatelessWidget {
  const SupplierLocationPrivacyCard({super.key, this.visibility});

  final String? visibility;

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
                  Icons.privacy_tip_outlined,
                  color: AuthDarkColors.accent,
                  size: 20,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                'Location privacy',
                style: AuthDarkTextStyles.sectionTitle(context),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Your exact pickup address stays private. Learners only see a general area until a reservation is accepted.',
            style: AuthDarkTextStyles.body(context),
          ),
          if (visibility != null && visibility!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: SupplierDecorations.profileSectionPanel,
              child: Row(
                children: [
                  const Icon(
                    Icons.visibility_outlined,
                    color: AuthDarkColors.accent,
                    size: 18,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      'Current: ${visibilityLabel(visibility!)}',
                      style: AuthDarkTextStyles.body(
                        context,
                      ).copyWith(color: AuthDarkColors.textPrimary),
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
