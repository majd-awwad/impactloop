import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/config/api_config.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../data/models/learner_material_request.dart';
import '../l10n/learner_material_requests_l10n.dart';

class LearnerMaterialRequestMatchCard extends StatelessWidget {
  const LearnerMaterialRequestMatchCard({
    super.key,
    required this.match,
    required this.requestId,
    required this.requestStatus,
    this.projectId,
    required this.isMutating,
    required this.onDismiss,
  });

  final LearnerMaterialRequestMatch match;
  final String requestId;
  final String requestStatus;
  final String? projectId;
  final bool isMutating;
  final VoidCallback onDismiss;

  String? _resolveImageUrl(String? value) => ApiConfig.resolveApiAssetUrl(value);

  void _openMaterial(BuildContext context, {required bool forReserve}) {
    final materialId = match.materialId;
    if (materialId.isEmpty) return;

    final returnTo = Uri.encodeComponent(
      '/learner/material-requests/$requestId',
    );
    final query = StringBuffer('/materials/$materialId?returnTo=$returnTo');
    if (forReserve) {
      query.write(
        '&materialRequestMatchId=${Uri.encodeComponent(match.id)}',
      );
    }
    context.push(query.toString());
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final material = match.material;
    final supplier = match.supplier;
    final supplierName =
        supplier?.displayName ?? material?.supplierPublicName ?? '';
    final imageUrl = _resolveImageUrl(material?.imageUrl);
    final isAcquired = match.isCompletedAcquisition && requestStatus == 'FULFILLED';

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: isAcquired
              ? colors.success.withValues(alpha: 0.45)
              : match.canReserve
              ? colors.primary.withValues(alpha: 0.35)
              : palette.borderSubtle,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: AppRadius.mdAll,
                child: Container(
                  width: 72,
                  height: 72,
                  color: palette.pageBackground,
                  child: imageUrl == null
                      ? Icon(
                          Icons.inventory_2_outlined,
                          color: palette.textSecondary,
                        )
                      : Image.network(
                          imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => Icon(
                            Icons.broken_image_outlined,
                            color: palette.textSecondary,
                          ),
                        ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isAcquired
                          ? LearnerMaterialRequestsL10n.acquiredMaterialTitle
                              .resolve(context)
                          : LearnerMaterialRequestsL10n.materialSuggestion
                              .resolve(context),
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      material?.title ?? LearnerMaterialRequestsL10n
                          .reviewMaterial
                          .resolve(context),
                      style: AppTextStyles.subtitle(context).copyWith(
                        color: palette.textPrimary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    AppStatusBadge(
                      label: isAcquired
                          ? LearnerMaterialRequestsL10n.acquiredLabel.resolve(
                              context,
                            )
                          : LearnerMaterialRequestsL10n.matchStatusLabel(
                              match.status,
                            ).resolve(context),
                      tone: isAcquired
                          ? AppStatusTone.success
                          : match.canReserve
                          ? AppStatusTone.primary
                          : match.isReserved
                          ? AppStatusTone.info
                          : AppStatusTone.warning,
                    ),
                    if (isAcquired && match.reservationStatus != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      AppStatusBadge(
                        label: LearnerMaterialRequestsL10n.reservationStatusLabel(
                          match.reservationStatus,
                        ).resolve(context),
                        tone: AppStatusTone.success,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (material != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              LearnerMaterialRequestsL10n.quantityUnitLine(
                _formatQuantity(material.quantity),
                material.unit,
              ).resolve(context),
              style: AppTextStyles.body(context).copyWith(
                color: palette.textSecondary,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              material.isFree
                  ? LearnerMaterialRequestsL10n.freeLabel.resolve(context)
                  : '${material.price?.toStringAsFixed(2) ?? ''} ${material.currency ?? ''}'
                        .trim(),
              style: AppTextStyles.body(context).copyWith(
                color: palette.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (material.condition != null &&
                material.condition!.trim().isNotEmpty) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                material.condition!,
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textSecondary,
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                if (material.pickupAllowed)
                  _SupportChip(
                    label: LearnerMaterialRequestsL10n.pickupSupported.resolve(
                      context,
                    ),
                  ),
                if (material.deliveryAllowed)
                  _SupportChip(
                    label: LearnerMaterialRequestsL10n.deliverySupported
                        .resolve(context),
                  ),
              ],
            ),
          ],
          if (supplierName.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                UserAvatar(
                  displayName: supplierName,
                  profileImageUrl: _resolveImageUrl(supplier?.avatarUrl),
                  radius: 18,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        LearnerMaterialRequestsL10n.suggestedBy.resolve(
                          context,
                        ),
                        style: AppTextStyles.label(context).copyWith(
                          color: palette.textSecondary,
                        ),
                      ),
                      Text(
                        supplierName,
                        style: AppTextStyles.body(context).copyWith(
                          color: palette.textPrimary,
                        ),
                      ),
                      if (supplier?.locationLabel.isNotEmpty == true)
                        Text(
                          supplier!.locationLabel,
                          style: AppTextStyles.body(context).copyWith(
                            color: palette.textSecondary,
                          ),
                        ),
                    ],
                  ),
                ),
                if (supplier?.isVerified == true)
                  Tooltip(
                    message: LearnerMaterialRequestsL10n.verifiedSupplier.resolve(
                      context,
                    ),
                    child: Icon(
                      Icons.verified_rounded,
                      color: colors.primary,
                      size: 18,
                    ),
                  ),
              ],
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              if (isAcquired) ...[
                FilledButton(
                  onPressed: () => _openMaterial(context, forReserve: false),
                  child: Text(
                    LearnerMaterialRequestsL10n.reviewMaterial.resolve(context),
                  ),
                ),
                if (match.reservationId != null)
                  OutlinedButton(
                    onPressed: () => context.push(
                      '/learner/reservations/${match.reservationId}',
                    ),
                    child: Text(
                      LearnerMaterialRequestsL10n.viewReservation.resolve(
                        context,
                      ),
                    ),
                  ),
                if (projectId != null && projectId!.isNotEmpty)
                  OutlinedButton(
                    onPressed: () => context.push('/learning/$projectId/build'),
                    child: Text(
                      LearnerMaterialRequestsL10n.returnToProjectBuild.resolve(
                        context,
                      ),
                    ),
                  ),
              ] else if (match.canReserve) ...[
                FilledButton(
                  onPressed: () => _openMaterial(context, forReserve: true),
                  child: Text(
                    LearnerMaterialRequestsL10n.reviewAndReserve.resolve(
                      context,
                    ),
                  ),
                ),
                OutlinedButton(
                  onPressed: () => _openMaterial(context, forReserve: false),
                  child: Text(
                    LearnerMaterialRequestsL10n.reviewMaterial.resolve(
                      context,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: isMutating ? null : onDismiss,
                  child: Text(
                    LearnerMaterialRequestsL10n.dismissSuggestion.resolve(
                      context,
                    ),
                  ),
                ),
              ] else if (match.isReserved && match.reservationId != null) ...[
                OutlinedButton(
                  onPressed: () => context.push(
                    '/learner/reservations/${match.reservationId}',
                  ),
                  child: Text(
                    LearnerMaterialRequestsL10n.viewReservation.resolve(
                      context,
                    ),
                  ),
                ),
                OutlinedButton(
                  onPressed: () => _openMaterial(context, forReserve: false),
                  child: Text(
                    LearnerMaterialRequestsL10n.reviewMaterial.resolve(
                      context,
                    ),
                  ),
                ),
              ] else ...[
                Text(
                  LearnerMaterialRequestsL10n.unavailableReasonLabel(
                    match.unavailableReason,
                  ).resolve(context),
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                  ),
                ),
                OutlinedButton(
                  onPressed: match.isDismissed || match.isUnavailable
                      ? () => _openMaterial(context, forReserve: false)
                      : null,
                  child: Text(
                    LearnerMaterialRequestsL10n.reviewMaterial.resolve(
                      context,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _SupportChip extends StatelessWidget {
  const _SupportChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: colors.primarySoft,
        borderRadius: AppRadius.pillAll,
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(color: colors.primary),
      ),
    );
  }
}

String _formatQuantity(double value) {
  if (value == value.roundToDouble()) {
    return value.toStringAsFixed(0);
  }
  return value.toStringAsFixed(2);
}
