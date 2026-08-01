import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/review_status_presentation.dart';
import '../../data/models/supplier_action_notification.dart';
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
      decoration: context.supplierDecorations.profileSectionPanel,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.s.categoryRequests,
            style: context.supplierSectionTitle(),
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
                          style: context.supplierLabel(),
                        ),
                        if (request.title.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            request.title,
                            style: context.supplierBody().copyWith(
                              color: context.supplierColors.textMuted,
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
                            context.s.approvedAs(request.approvedCategoryName!),
                            style: context.supplierBody().copyWith(
                              fontSize: 13,
                              color: context.supplierColors.accent,
                            ),
                          ),
                        ],
                        if (request.status == 'PENDING') ...[
                          const SizedBox(height: 4),
                          Text(
                            context.s.waitingAdminApproval,
                            style: context.supplierBody().copyWith(
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (request.canContinue)
                    TextButton(
                      onPressed: () => onContinue(request.id),
                      child: Text(context.s.continueListing),
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
      'APPROVED' => context.s.notificationStatusLabel(
        SupplierActionNotificationStatus.approved,
      ),
      'REJECTED' => context.s.notificationStatusLabel(
        SupplierActionNotificationStatus.rejected,
      ),
      _ => context.s.tabPending,
    };

    return AppStatusBadge(label: label, tone: reviewStatusTone(status));
  }
}
