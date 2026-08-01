import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../materials/data/models/material_price_check_result.dart';

class AddMaterialPriceVerificationCard extends StatelessWidget {
  const AddMaterialPriceVerificationCard({
    super.key,
    required this.result,
    required this.isRequestingPriceReview,
    this.priceReviewMessage,
    required this.onSubmitPriceReview,
    required this.onSelectSuggestion,
    this.showPriceReview = true,
  });

  final MaterialPriceCheckResult result;
  final bool isRequestingPriceReview;
  final String? priceReviewMessage;
  final VoidCallback onSubmitPriceReview;
  final ValueChanged<String> onSelectSuggestion;
  final bool showPriceReview;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final allowed = result.allowed;
    final canSubmitPriceReview =
        showPriceReview && _showPriceReviewButton(result.reason);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: context.supplierDecorations.profileSectionPanel,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            allowed ? l.priceVerified : _blockedTitle(context, result.reason),
            style: context.supplierSectionTitle().copyWith(
              color: allowed
                  ? context.supplierColors.accent
                  : context.supplierColors.error,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(result.message, style: context.supplierBody()),
          if (result.matchedReference != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              l.matchedPriceReference(result.matchedReference!.displayLabel),
              style: context.supplierBody().copyWith(
                color: context.supplierColors.textMuted,
              ),
            ),
          ],
          if (result.maxAllowedPrice != null)
            Text(
              l.maxAllowedUnitPriceMessage(
                result.currencySymbol,
                result.maxAllowedPrice!.toStringAsFixed(2),
                result.approvedUnit,
              ),
              style: context.supplierBody(),
            ),
          if (result.baseMaxPrice != null &&
              result.adjustedMaxPrice != null &&
              result.selectedCondition != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              l.conditionAdjustedMaxMessage(
                result.currencySymbol,
                result.baseMaxPrice!.toStringAsFixed(2),
                l.conditionLabel(result.selectedCondition!),
                result.adjustedMaxPrice!.toStringAsFixed(2),
              ),
              style: context.supplierBody().copyWith(
                color: context.supplierColors.textSecondary,
                fontSize: 12,
              ),
            ),
          ],
          if (result.submittedPrice != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              '${l.pricePerUnit}: ${result.currencySymbol}${result.submittedPrice!.toStringAsFixed(2)}',
              style: context.supplierBody(),
            ),
          ],
          if (result.approvedUnit != null)
            Text(
              l.approvedUnitLabel(result.approvedUnit!),
              style: context.supplierBody(),
            ),
          if (result.candidates.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text(l.didYouMeanThese, style: context.supplierLabel()),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: result.candidates
                  .map(
                    (candidate) => ActionChip(
                      label: Text(candidate.displayLabel),
                      onPressed: () =>
                          onSelectSuggestion(candidate.displayLabel),
                    ),
                  )
                  .toList(),
            ),
          ],
          if (canSubmitPriceReview) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              l.priceReviewRequiredMessage,
              style: context.supplierBody().copyWith(
                color: context.supplierColors.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton.icon(
              onPressed: isRequestingPriceReview ? null : onSubmitPriceReview,
              icon: const Icon(Icons.request_quote_outlined),
              label: Text(
                isRequestingPriceReview ? l.sending : l.submitPriceReview,
              ),
            ),
            if (priceReviewMessage != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(priceReviewMessage!, style: context.supplierBody()),
            ],
          ],
        ],
      ),
    );
  }

  String _blockedTitle(BuildContext context, String? reason) {
    final l = context.s;
    return switch (reason) {
      'PAID_OTHER_NOT_ALLOWED' => l.paidCannotUseOther,
      'AMBIGUOUS_MATERIAL_MATCH' => l.clarifyMaterialName,
      'PRICE_TOO_HIGH' => l.priceBlockedReason('PRICE_TOO_HIGH'),
      'PRICE_RULE_REQUIRED' ||
      'MATERIAL_REVIEW_REQUIRED' => l.priceVerificationRequired,
      _ => l.priceVerificationRequired,
    };
  }

  bool _showPriceReviewButton(String? reason) {
    return reason == 'MATERIAL_REVIEW_REQUIRED' ||
        reason == 'PRICE_RULE_REQUIRED';
  }
}
