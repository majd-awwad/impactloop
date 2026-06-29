import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../data/models/supplier_pickup_schedule_item.dart';
import '../theme/supplier_theme_extension.dart';
import 'pickup_schedule_status_style.dart';

class PickupScheduleCard extends StatelessWidget {
  const PickupScheduleCard({
    super.key,
    required this.item,
    required this.groupKind,
    this.onViewDetails,
    this.onMarkCompleted,
    this.isCompleting = false,
  });

  final SupplierPickupScheduleItem item;
  final PickupScheduleGroupKind groupKind;
  final VoidCallback? onViewDetails;
  final VoidCallback? onMarkCompleted;
  final bool isCompleting;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final style = PickupScheduleStatusStyle.forItem(item, groupKind);
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final times = _timeParts(item, l.scheduleDone);
    final note = _displayNote(item);
    final showMarkCompleted =
        item.status == SupplierPickupScheduleStatus.accepted &&
        item.canSupplierComplete &&
        onMarkCompleted != null;
    final showDeliveryStatus =
        item.status == SupplierPickupScheduleStatus.accepted &&
        item.hasDelivery &&
        !item.canSupplierComplete;

    return Material(
      color: Colors.transparent,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? AppSpacing.sm : AppSpacing.md,
          vertical: compact ? AppSpacing.sm : AppSpacing.md,
        ),
        decoration: BoxDecoration(
          color: colors.surfaceSolid.withValues(alpha: 0.55),
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: colors.border.withValues(alpha: 0.22)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InkWell(
              onTap: onViewDetails,
              borderRadius: AppRadius.mdAll,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: compact ? 52 : 60,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          times.$1,
                          style: context.supplierTitle().copyWith(
                            fontSize: compact ? 15 : 16,
                            fontWeight: FontWeight.w700,
                            color: style.foreground,
                            height: 1.1,
                          ),
                        ),
                        Text(
                          times.$2,
                          style: context.supplierLabel().copyWith(
                            fontSize: compact ? 13 : 14,
                            color: colors.textMuted,
                            height: 1.1,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    width: 1,
                    height: compact ? 48 : 52,
                    margin: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                    ),
                    color: colors.border.withValues(alpha: 0.28),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                item.materialTitle,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: context.supplierTitle().copyWith(
                                  fontSize: compact ? 15 : 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            _StatusBadge(status: item.status, style: style),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '${item.learnerName} · ${item.quantityLabel} · ${item.pickupType}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: context.supplierBody().copyWith(
                            fontSize: 13,
                            color: colors.textMuted,
                            height: 1.3,
                          ),
                        ),
                        if (note != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            note,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: context.supplierBody().copyWith(
                              fontSize: 12,
                              color: colors.textPrimary.withValues(alpha: 0.78),
                              height: 1.3,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  _MaterialThumbnail(
                    imageUrl: item.materialImageUrl,
                    size: compact ? 40 : 48,
                  ),
                ],
              ),
            ),
            if (showMarkCompleted) ...[
              const SizedBox(height: AppSpacing.sm),
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton.tonal(
                  onPressed: isCompleting ? null : onMarkCompleted,
                  style: FilledButton.styleFrom(
                    backgroundColor: colors.accentSoft.withValues(alpha: 0.22),
                    foregroundColor: colors.textPrimary,
                    padding: EdgeInsets.symmetric(
                      horizontal: compact ? 12 : 14,
                      vertical: compact ? 8 : 10,
                    ),
                    minimumSize: Size(compact ? 0 : 120, compact ? 36 : 40),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadius.mdAll,
                    ),
                  ),
                  child: isCompleting
                      ? SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: colors.textPrimary.withValues(alpha: 0.8),
                          ),
                        )
                      : Text(
                          l.markCompleted,
                          style: context.supplierLabel().copyWith(
                            fontSize: compact ? 12 : 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
            ],
            if (showDeliveryStatus) ...[
              const SizedBox(height: AppSpacing.sm),
              _DeliveryStatusPanel(statusLabel: item.deliveryStatusLabel),
            ],
          ],
        ),
      ),
    );
  }

  (String, String) _timeParts(
    SupplierPickupScheduleItem item,
    String doneLabel,
  ) {
    final window = item.pickupWindow;
    if (window == null) {
      return item.isCompleted ? (doneLabel, '') : ('—', '');
    }

    final start = window.start.toLocal();
    final end = window.end.toLocal();
    return (_formatClock(start), _formatClock(end));
  }

  String? _displayNote(SupplierPickupScheduleItem item) {
    final supplierNote = item.supplierNote?.trim();
    if (supplierNote != null && supplierNote.isNotEmpty) {
      return supplierNote;
    }
    final learnerMessage = item.learnerMessage?.trim();
    if (learnerMessage != null && learnerMessage.isNotEmpty) {
      return learnerMessage;
    }
    return null;
  }

  String _formatClock(DateTime value) {
    return '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
  }
}

class _DeliveryStatusPanel extends StatelessWidget {
  const _DeliveryStatusPanel({required this.statusLabel});

  final String statusLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.accentSoft.withValues(alpha: 0.16),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.border.withValues(alpha: 0.24)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.sm,
        ),
        child: Row(
          children: [
            Icon(Icons.local_shipping_outlined, size: 18, color: colors.accent),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Text(
                statusLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.supplierLabel().copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status, required this.style});

  final SupplierPickupScheduleStatus status;
  final PickupScheduleStatusStyle style;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: style.border.withValues(alpha: 0.7)),
      ),
      child: Text(
        context.s.pickupScheduleStatusLabel(status),
        style: context.supplierChip().copyWith(
          fontSize: 10,
          color: style.foreground,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _MaterialThumbnail extends StatelessWidget {
  const _MaterialThumbnail({required this.imageUrl, required this.size});

  final String? imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return ClipRRect(
      borderRadius: AppRadius.smAll,
      child: Container(
        width: size,
        height: size,
        color: colors.surfaceSolid,
        child: imageUrl != null && imageUrl!.isNotEmpty
            ? Image.network(
                ApiConfig.resolveMediaUrl(imageUrl!),
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _placeholder(size, context),
              )
            : _placeholder(size, context),
      ),
    );
  }

  Widget _placeholder(double size, BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      color: colors.accentSoft.withValues(alpha: 0.1),
      child: Icon(
        Icons.inventory_2_outlined,
        size: size * 0.45,
        color: colors.textMuted,
      ),
    );
  }
}
