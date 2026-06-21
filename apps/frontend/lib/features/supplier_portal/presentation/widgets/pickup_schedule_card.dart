import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../core/config/api_config.dart';
import '../../data/models/supplier_pickup_schedule_item.dart';
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
    final style = PickupScheduleStatusStyle.forItem(item, groupKind);
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final times = _timeParts(item);
    final note = _displayNote(item);
    final showMarkCompleted =
        item.status == SupplierPickupScheduleStatus.accepted &&
        onMarkCompleted != null;

    return Material(
      color: Colors.transparent,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? AppSpacing.sm : AppSpacing.md,
          vertical: compact ? AppSpacing.sm : AppSpacing.md,
        ),
        decoration: BoxDecoration(
          color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.55),
          borderRadius: AppRadius.mdAll,
          border: Border.all(
            color: AuthDarkColors.border.withValues(alpha: 0.22),
          ),
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
                          style: AuthDarkTextStyles.title(context).copyWith(
                            fontSize: compact ? 15 : 16,
                            fontWeight: FontWeight.w700,
                            color: style.foreground,
                            height: 1.1,
                          ),
                        ),
                        Text(
                          times.$2,
                          style: AuthDarkTextStyles.label(context).copyWith(
                            fontSize: compact ? 13 : 14,
                            color: AuthDarkColors.textMuted,
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
                    color: AuthDarkColors.border.withValues(alpha: 0.28),
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
                                style: AuthDarkTextStyles.title(context)
                                    .copyWith(
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
                          style: AuthDarkTextStyles.body(context).copyWith(
                            fontSize: 13,
                            color: AuthDarkColors.textMuted,
                            height: 1.3,
                          ),
                        ),
                        if (note != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            note,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: AuthDarkTextStyles.body(context).copyWith(
                              fontSize: 12,
                              color: AuthDarkColors.textPrimary.withValues(
                                alpha: 0.78,
                              ),
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
                    backgroundColor: AuthDarkColors.accentSoft.withValues(
                      alpha: 0.22,
                    ),
                    foregroundColor: AuthDarkColors.textPrimary,
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
                            color: AuthDarkColors.textPrimary.withValues(
                              alpha: 0.8,
                            ),
                          ),
                        )
                      : Text(
                          'Mark completed',
                          style: AuthDarkTextStyles.label(context).copyWith(
                            fontSize: compact ? 12 : 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  (String, String) _timeParts(SupplierPickupScheduleItem item) {
    final window = item.pickupWindow;
    if (window == null) {
      return item.isCompleted ? ('Done', '') : ('—', '');
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
        status.label,
        style: AuthDarkTextStyles.chip(context).copyWith(
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
    return ClipRRect(
      borderRadius: AppRadius.smAll,
      child: Container(
        width: size,
        height: size,
        color: AuthDarkColors.surfaceSolid,
        child: imageUrl != null && imageUrl!.isNotEmpty
            ? Image.network(
                ApiConfig.resolveMediaUrl(imageUrl!),
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _placeholder(size),
              )
            : _placeholder(size),
      ),
    );
  }

  Widget _placeholder(double size) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      color: AuthDarkColors.accentSoft.withValues(alpha: 0.1),
      child: Icon(
        Icons.inventory_2_outlined,
        size: size * 0.45,
        color: AuthDarkColors.textMuted,
      ),
    );
  }
}
