import 'package:flutter/material.dart';

import '../../../../app/theme/app_color_tokens.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../theme/supplier_theme_extension.dart';
import 'incoming_request_status_style.dart';

const _noteAreaHeight = 48.0;
const _footerHeight = 52.0;
const _pendingCardHeight = 268.0;

String formatIncomingRequestDateTime(DateTime value) {
  final local = value.toLocal();
  final month = _monthLabel(local.month);
  final day = local.day.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$month $day, ${local.year} · $hour:$minute';
}

String formatPickupWindowShort(SupplierPickupWindow window) {
  final start = window.start.toLocal();
  final end = window.end.toLocal();
  final date = '${_monthLabel(start.month)} ${start.day}';
  final startTime =
      '${start.hour.toString().padLeft(2, '0')}:${start.minute.toString().padLeft(2, '0')}';
  final endTime =
      '${end.hour.toString().padLeft(2, '0')}:${end.minute.toString().padLeft(2, '0')}';
  return '$date, $startTime–$endTime';
}

String _monthLabel(int month) {
  const labels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return labels[month - 1];
}

class IncomingRequestCard extends StatelessWidget {
  const IncomingRequestCard({
    super.key,
    required this.request,
    this.onAccept,
    this.onDecline,
    this.onMarkCompleted,
    this.isCompleting = false,
  });

  final SupplierIncomingRequest request;
  final VoidCallback? onAccept;
  final VoidCallback? onDecline;
  final VoidCallback? onMarkCompleted;
  final bool isCompleting;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final isPending = request.status == SupplierIncomingRequestStatus.pending;
    final isDeclined = request.status == SupplierIncomingRequestStatus.declined;
    final isAccepted = request.status == SupplierIncomingRequestStatus.accepted;
    final isCompleted =
        request.status == SupplierIncomingRequestStatus.completed;
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final pendingHeight = compact ? 312.0 : _pendingCardHeight;

    return Opacity(
      opacity: isDeclined ? 0.78 : 1,
      child: Container(
        width: double.infinity,
        height: isPending ? pendingHeight : null,
        decoration: BoxDecoration(
          color: colors.surfaceSolid.withValues(alpha: 0.78),
          borderRadius: AppRadius.lgAll,
          border: Border.all(
            color: isPending
                ? colors.border.withValues(alpha: 0.42)
                : colors.border.withValues(alpha: 0.28),
          ),
        ),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _MaterialThumbnail(
                  imageUrl: request.materialImageUrl,
                  size: compact ? 56 : 64,
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              request.materialTitle,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: context.supplierTitle().copyWith(
                                fontSize: compact ? 16 : 17,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          _StatusBadge(status: request.status),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        request.learnerName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.supplierBody().copyWith(
                          color: colors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            _MetaRow(
              quantity:
                  '${_formatQuantity(request.quantityRequested)} ${request.unit}',
              requestedAt: formatIncomingRequestDateTime(request.requestedAt),
              pickupPreference: request.pickupPreference ?? l.selfPickup,
            ),
            const SizedBox(height: AppSpacing.sm),
            _LearnerNoteSlot(note: request.learnerNote),
            if (isPending) const Spacer(),
            if ((isAccepted || isCompleted) && request.pickupWindow != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: _PickupFooter(window: request.pickupWindow!),
              ),
            if (isAccepted &&
                request.hasDelivery &&
                !request.canSupplierComplete)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: _DeliveryFooter(
                  statusLabel: request.deliveryStatusLabel,
                ),
              ),
            if (isDeclined &&
                request.declineReason != null &&
                request.declineReason!.trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: _DeclineFooter(reason: request.declineReason!.trim()),
              ),
            if (isPending) ...[
              const SizedBox(height: AppSpacing.md),
              const Divider(
                height: 1,
                color: AppColorTokens.supplierDividerStrong,
              ),
              const SizedBox(height: AppSpacing.md),
              _ActionRow(
                onAccept: onAccept,
                onDecline: onDecline,
                stacked: compact,
              ),
            ],
            if (isAccepted &&
                request.canSupplierComplete &&
                onMarkCompleted != null) ...[
              const SizedBox(height: AppSpacing.md),
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
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
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
          ],
        ),
      ),
    );
  }

  String _formatQuantity(double value) {
    if (value % 1 == 0) {
      return value.toInt().toString();
    }
    return value.toString();
  }
}

class _MaterialThumbnail extends StatelessWidget {
  const _MaterialThumbnail({required this.size, this.imageUrl});

  final double size;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return ClipRRect(
      borderRadius: AppRadius.mdAll,
      child: Container(
        width: size,
        height: size,
        color: colors.backgroundElevated,
        child: imageUrl == null || imageUrl!.isEmpty
            ? Icon(
                Icons.inventory_2_outlined,
                color: colors.textSecondary,
                size: size * 0.38,
              )
            : Image.network(
                ApiConfig.resolveMediaUrl(imageUrl!),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Icon(
                  Icons.broken_image_outlined,
                  color: colors.textSecondary,
                  size: size * 0.38,
                ),
              ),
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({
    required this.quantity,
    required this.requestedAt,
    required this.pickupPreference,
  });

  final String quantity;
  final String requestedAt;
  final String pickupPreference;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.xs,
      children: [
        _MetaItem(icon: Icons.straighten_outlined, label: quantity),
        _MetaItem(icon: Icons.schedule_outlined, label: requestedAt),
        _MetaItem(icon: Icons.place_outlined, label: pickupPreference),
      ],
    );
  }
}

class _MetaItem extends StatelessWidget {
  const _MetaItem({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: colors.textMuted),
        const SizedBox(width: 4),
        Text(
          label,
          style: context.supplierBody().copyWith(
            fontSize: 12,
            color: colors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _LearnerNoteSlot extends StatelessWidget {
  const _LearnerNoteSlot({this.note});

  final String? note;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    final hasNote = note != null && note!.trim().isNotEmpty;

    return SizedBox(
      height: _noteAreaHeight,
      width: double.infinity,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.chipUnselected.withValues(alpha: 0.45),
          borderRadius: AppRadius.mdAll,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xs,
          ),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              hasNote ? '"${note!.trim()}"' : l.noLearnerNote,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: context.supplierBody().copyWith(
                fontSize: 13,
                color: hasNote ? colors.textPrimary : colors.textMuted,
                fontStyle: hasNote ? FontStyle.italic : FontStyle.normal,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PickupFooter extends StatelessWidget {
  const _PickupFooter({required this.window});

  final SupplierPickupWindow window;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    return SizedBox(
      height: _footerHeight,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.accentSoft.withValues(alpha: 0.16),
          borderRadius: AppRadius.mdAll,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xs,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                l.pickupWindowLabel(formatPickupWindowShort(window)),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.supplierLabel().copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
              if (window.note != null && window.note!.trim().isNotEmpty)
                Text(
                  window.note!.trim(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.supplierBody().copyWith(
                    fontSize: 12,
                    color: colors.textSecondary,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DeclineFooter extends StatelessWidget {
  const _DeclineFooter({required this.reason});

  final String reason;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return SizedBox(
      height: _footerHeight,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.backgroundElevated.withValues(alpha: 0.45),
          borderRadius: AppRadius.mdAll,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xs,
          ),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              reason,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: context.supplierBody().copyWith(
                fontSize: 12,
                color: colors.textSecondary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DeliveryFooter extends StatelessWidget {
  const _DeliveryFooter({required this.statusLabel});

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
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.local_shipping_outlined, size: 18, color: colors.accent),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    statusLabel == 'Delivered'
                        ? 'Delivered'
                        : 'Waiting for driver delivery',
                    style: context.supplierLabel().copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'The driver will complete this reservation after delivery.',
                    style: context.supplierBody().copyWith(
                      color: colors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.onAccept,
    required this.onDecline,
    required this.stacked,
  });

  final VoidCallback? onAccept;
  final VoidCallback? onDecline;
  final bool stacked;

  @override
  Widget build(BuildContext context) {
    if (stacked) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _AcceptButton(onPressed: onAccept),
          const SizedBox(height: AppSpacing.sm),
          _DeclineButton(onPressed: onDecline),
        ],
      );
    }

    return Row(
      children: [
        Expanded(child: _AcceptButton(onPressed: onAccept)),
        const SizedBox(width: AppSpacing.sm),
        Expanded(child: _DeclineButton(onPressed: onDecline)),
      ],
    );
  }
}

class _IncomingRequestActionButtonMetrics {
  static const iconSize = 18.0;
  static const padding = EdgeInsets.symmetric(horizontal: 16, vertical: 12);
  static const minimumSize = Size(64, 44);

  static ButtonStyle baseStyle({
    required Color background,
    required Color foreground,
    BorderSide? side,
  }) {
    return FilledButton.styleFrom(
      backgroundColor: background,
      foregroundColor: foreground,
      padding: padding,
      minimumSize: minimumSize,
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
      side: side ?? BorderSide.none,
      textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
    );
  }
}

class _AcceptButton extends StatelessWidget {
  const _AcceptButton({required this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final colors = context.supplierColors;
    return FilledButton.icon(
      onPressed: onPressed,
      style: _IncomingRequestActionButtonMetrics.baseStyle(
        background: colors.accentMuted.withValues(alpha: 0.82),
        foreground: colors.textOnAccent,
      ),
      icon: const Icon(
        Icons.check_circle_outline,
        size: _IncomingRequestActionButtonMetrics.iconSize,
      ),
      label: Text(l.accept),
    );
  }
}

class _DeclineButton extends StatelessWidget {
  const _DeclineButton({required this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton.icon(
      onPressed: onPressed,
      style:
          _IncomingRequestActionButtonMetrics.baseStyle(
            background: AppColorTokens.supplierDeclineButtonBackground,
            foreground: AppColorTokens.supplierDashboardUnavailable,
            side: const BorderSide(
              color: AppColorTokens.supplierDeclineButtonBorder,
            ),
          ).copyWith(
            overlayColor: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.pressed)) {
                return AppColorTokens.supplierDeclineButtonPressedOverlay;
              }
              if (states.contains(WidgetState.hovered)) {
                return AppColorTokens.supplierDeclineButtonHoverOverlay;
              }
              return null;
            }),
          ),
      icon: const Icon(
        Icons.close,
        size: _IncomingRequestActionButtonMetrics.iconSize,
      ),
      label: Text(context.s.decline),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final SupplierIncomingRequestStatus status;

  @override
  Widget build(BuildContext context) {
    final style = IncomingRequestStatusStyle.forStatus(status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: style.border),
      ),
      child: Text(
        context.s.incomingRequestStatusLabel(status),
        style: context.supplierChip().copyWith(
          color: style.foreground,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
