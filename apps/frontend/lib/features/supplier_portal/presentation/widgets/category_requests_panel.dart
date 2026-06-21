import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../../materials/data/models/category_request.dart';

class CategoryRequestsPanel extends StatelessWidget {
  const CategoryRequestsPanel({
    super.key,
    required this.requests,
    required this.onContinue,
  });

  final List<CategoryRequestListItem> requests;
  final ValueChanged<String> onContinue;

  @override
  Widget build(BuildContext context) {
    if (requests.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: SupplierDecorations.profileSectionPanel,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Category requests',
            style: AuthDarkTextStyles.sectionTitle(context),
          ),
          const SizedBox(height: AppSpacing.md),
          ...requests.take(5).map((request) {
            return Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          request.requestedName,
                          style: AuthDarkTextStyles.label(context),
                        ),
                        if (request.title.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            request.title,
                            style: AuthDarkTextStyles.body(context).copyWith(
                              color: AuthDarkColors.textMuted,
                              fontSize: 13,
                            ),
                          ),
                        ],
                        const SizedBox(height: 4),
                        _StatusChip(status: request.status),
                        if (request.status == 'APPROVED' &&
                            request.approvedCategoryName != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            'Approved as ${request.approvedCategoryName}',
                            style: AuthDarkTextStyles.body(context).copyWith(
                              fontSize: 13,
                              color: AuthDarkColors.accent,
                            ),
                          ),
                        ],
                        if (request.status == 'PENDING') ...[
                          const SizedBox(height: 4),
                          Text(
                            'Waiting for admin approval.',
                            style: AuthDarkTextStyles.body(
                              context,
                            ).copyWith(fontSize: 13),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (request.canContinue)
                    TextButton(
                      onPressed: () => onContinue(request.id),
                      child: const Text('Continue listing'),
                    ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final label = switch (status) {
      'APPROVED' => 'Approved',
      'REJECTED' => 'Rejected',
      _ => 'Pending',
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 2,
      ),
      decoration: SupplierDecorations.badge(
        background: AuthDarkColors.accentSoft.withValues(alpha: 0.12),
      ),
      child: Text(label, style: AuthDarkTextStyles.chip(context)),
    );
  }
}
