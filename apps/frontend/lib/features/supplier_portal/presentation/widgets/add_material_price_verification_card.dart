import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
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
    final allowed = result.allowed;
    final canSubmitPriceReview = showPriceReview && _showPriceReviewButton(result.reason);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: SupplierDecorations.profileSectionPanel,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            allowed ? 'Price verified' : _blockedTitle(result.reason),
            style: AuthDarkTextStyles.sectionTitle(context).copyWith(
              color: allowed ? AuthDarkColors.accent : AuthDarkColors.error,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(result.message, style: AuthDarkTextStyles.body(context)),
          if (result.matchedReference != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Matched price reference: ${result.matchedReference!.displayLabel}',
              style: AuthDarkTextStyles.body(context).copyWith(
                color: AuthDarkColors.textMuted,
              ),
            ),
          ],
          if (result.maxAllowedPrice != null)
            Text(
              'Maximum allowed: ${result.currencySymbol}${result.maxAllowedPrice!.toStringAsFixed(2)}',
              style: AuthDarkTextStyles.body(context),
            ),
          if (result.approvedUnit != null)
            Text(
              'Approved unit: ${result.approvedUnit}',
              style: AuthDarkTextStyles.body(context),
            ),
          if (result.candidates.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              'Did you mean one of these?',
              style: AuthDarkTextStyles.label(context),
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: result.candidates
                  .map(
                    (candidate) => ActionChip(
                      label: Text(candidate.displayLabel),
                      onPressed: () => onSelectSuggestion(candidate.displayLabel),
                    ),
                  )
                  .toList(),
            ),
          ],
          if (canSubmitPriceReview) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              'Price review is required before paid publishing. A Gemini-assisted price suggestion will be generated for admin review.',
              style: AuthDarkTextStyles.body(context).copyWith(
                color: AuthDarkColors.textMuted,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton.icon(
              onPressed: isRequestingPriceReview ? null : onSubmitPriceReview,
              icon: const Icon(Icons.request_quote_outlined),
              label: Text(
                isRequestingPriceReview ? 'Submitting...' : 'Submit price review',
              ),
            ),
            if (priceReviewMessage != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(priceReviewMessage!, style: AuthDarkTextStyles.body(context)),
            ],
          ],
        ],
      ),
    );
  }

  String _blockedTitle(String? reason) {
    return switch (reason) {
      'PAID_OTHER_NOT_ALLOWED' => 'Paid listings cannot use Other',
      'AMBIGUOUS_MATERIAL_MATCH' => 'Please clarify the material name',
      'PRICE_TOO_HIGH' => 'Price is above the allowed limit',
      'PRICE_RULE_REQUIRED' => 'This paid material needs price review before publishing',
      'MATERIAL_REVIEW_REQUIRED' => 'This paid material needs price review before publishing',
      _ => 'This paid material needs price review before publishing',
    };
  }

  bool _showPriceReviewButton(String? reason) {
    return reason == 'MATERIAL_REVIEW_REQUIRED' ||
        reason == 'PRICE_RULE_REQUIRED';
  }
}
