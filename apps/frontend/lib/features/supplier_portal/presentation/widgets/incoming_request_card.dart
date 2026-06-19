import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../core/config/api_config.dart';
import '../../data/models/supplier_incoming_request.dart';
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
    final isPending = request.status == SupplierIncomingRequestStatus.pending;
    final isDeclined = request.status == SupplierIncomingRequestStatus.declined;
    final isAccepted = request.status == SupplierIncomingRequestStatus.accepted;
    final isCompleted = request.status == SupplierIncomingRequestStatus.completed;
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final pendingHeight = compact ? 312.0 : _pendingCardHeight;

    return Opacity(
      opacity: isDeclined ? 0.78 : 1,
      child: Container(
        width: double.infinity,
        height: isPending ? pendingHeight : null,
        decoration: BoxDecoration(
          color: AuthDarkColors.surfaceSolid.withValues(alpha: 0.78),
          borderRadius: AppRadius.lgAll,
          border: Border.all(
            color: isPending
                ? AuthDarkColors.border.withValues(alpha: 0.42)
                : AuthDarkColors.border.withValues(alpha: 0.28),
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
                              style: AuthDarkTextStyles.title(context).copyWith(
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
                        style: AuthDarkTextStyles.body(context).copyWith(
                          color: AuthDarkColors.textSecondary,
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
              pickupPreference: request.pickupPreference ?? 'Self pickup',
            ),
            const SizedBox(height: AppSpacing.sm),
            _LearnerNoteSlot(note: request.learnerNote),
            if (isPending) const Spacer(),
            if ((isAccepted || isCompleted) && request.pickupWindow != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: _PickupFooter(window: request.pickupWindow!),
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
              const Divider(height: 1, color: Color(0x332DD4BF)),
              const SizedBox(height: AppSpacing.md),
              _ActionRow(
                onAccept: onAccept,
                onDecline: onDecline,
                stacked: compact,
              ),
            ],
            if (isAccepted && onMarkCompleted != null) ...[
              const SizedBox(height: AppSpacing.md),
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton.tonal(
                  onPressed: isCompleting ? null : onMarkCompleted,
                  style: FilledButton.styleFrom(
                    backgroundColor:
                        AuthDarkColors.accentSoft.withValues(alpha: 0.22),
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
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
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

  String _formatQuantity(double value) {
    if (value % 1 == 0) {
      return value.toInt().toString();
    }
    return value.toString();
  }
}

class _MaterialThumbnail extends StatelessWidget {
  const _MaterialThumbnail({
    required this.size,
    this.imageUrl,
  });

  final double size;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.mdAll,
      child: Container(
        width: size,
        height: size,
        color: AuthDarkColors.backgroundElevated,
        child: imageUrl == null || imageUrl!.isEmpty
            ? Icon(
                Icons.inventory_2_outlined,
                color: AuthDarkColors.textSecondary,
                size: size * 0.38,
              )
            : Image.network(
                ApiConfig.resolveMediaUrl(imageUrl!),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Icon(
                  Icons.broken_image_outlined,
                  color: AuthDarkColors.textSecondary,
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
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: AuthDarkColors.textMuted),
        const SizedBox(width: 4),
        Text(
          label,
          style: AuthDarkTextStyles.body(context).copyWith(
            fontSize: 12,
            color: AuthDarkColors.textSecondary,
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
    final hasNote = note != null && note!.trim().isNotEmpty;

    return SizedBox(
      height: _noteAreaHeight,
      width: double.infinity,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AuthDarkColors.chipUnselected.withValues(alpha: 0.45),
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
              hasNote ? '"${note!.trim()}"' : 'No learner note.',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AuthDarkTextStyles.body(context).copyWith(
                fontSize: 13,
                color: hasNote
                    ? AuthDarkColors.textPrimary
                    : AuthDarkColors.textMuted,
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
    return SizedBox(
      height: _footerHeight,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AuthDarkColors.accentSoft.withValues(alpha: 0.16),
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
                'Pickup: ${formatPickupWindowShort(window)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AuthDarkTextStyles.label(context).copyWith(
                  color: AuthDarkColors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
              if (window.note != null && window.note!.trim().isNotEmpty)
                Text(
                  window.note!.trim(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AuthDarkTextStyles.body(context).copyWith(
                    fontSize: 12,
                    color: AuthDarkColors.textSecondary,
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
    return SizedBox(
      height: _footerHeight,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AuthDarkColors.backgroundElevated.withValues(alpha: 0.45),
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
              style: AuthDarkTextStyles.body(context).copyWith(
                fontSize: 12,
                color: AuthDarkColors.textSecondary,
              ),
            ),
          ),
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
      textStyle: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}

class _AcceptButton extends StatelessWidget {
  const _AcceptButton({required this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton.icon(
      onPressed: onPressed,
      style: _IncomingRequestActionButtonMetrics.baseStyle(
        background: AuthDarkColors.accentMuted.withValues(alpha: 0.82),
        foreground: AuthDarkColors.textOnAccent,
      ),
      icon: const Icon(
        Icons.check_circle_outline,
        size: _IncomingRequestActionButtonMetrics.iconSize,
      ),
      label: const Text('Accept'),
    );
  }
}

class _DeclineButton extends StatelessWidget {
  const _DeclineButton({required this.onPressed});

  final VoidCallback? onPressed;

  static const _background = Color(0x38EF4444);
  static const _border = Color(0x8CEF4444);
  static const _foreground = Color(0xFFF87171);

  @override
  Widget build(BuildContext context) {
    return FilledButton.icon(
      onPressed: onPressed,
      style: _IncomingRequestActionButtonMetrics.baseStyle(
        background: _background,
        foreground: _foreground,
        side: const BorderSide(color: _border),
      ).copyWith(
        overlayColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.pressed)) {
            return const Color(0x4DEF4444);
          }
          if (states.contains(WidgetState.hovered)) {
            return const Color(0x29EF4444);
          }
          return null;
        }),
      ),
      icon: const Icon(
        Icons.close,
        size: _IncomingRequestActionButtonMetrics.iconSize,
      ),
      label: const Text('Decline'),
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
        status.label,
        style: AuthDarkTextStyles.chip(context).copyWith(
          color: style.foreground,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
