import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../theme/supplier_theme_extension.dart';
import 'incoming_request_status_style.dart';

void _doNothing() {}

abstract final class IncomingRequestDesktopGrid {
  static const breakpoint = 1100.0;
  static const identityFlex = 42;
  static const fulfillmentFlex = 28;
  static const statusFlex = 22;
  static const detailsWidth = 48.0;
  static const columnGap = AppSpacing.md;
}

String formatPickupWindowShort(SupplierPickupWindow window) =>
    '${DateFormat('MMM d, HH:mm').format(window.start.toLocal())}–${DateFormat('HH:mm').format(window.end.toLocal())}';

class IncomingRequestCard extends StatelessWidget {
  const IncomingRequestCard({
    super.key,
    required this.request,
    this.onView = _doNothing,
    this.primaryLabel,
    this.onPrimaryAction,
    this.onMarkCompleted,
  });

  final SupplierIncomingRequest request;
  final String? primaryLabel;
  final VoidCallback? onPrimaryAction;
  final VoidCallback onView;
  final VoidCallback? onMarkCompleted;

  @override
  Widget build(BuildContext context) {
    final isTerminal = _isQuietTerminal(request);
    final desktop =
        MediaQuery.sizeOf(context).width >= IncomingRequestDesktopGrid.breakpoint;
    final effectiveLabel = primaryLabel ??
        (request.status == SupplierIncomingRequestStatus.accepted &&
                request.canSupplierComplete &&
                onMarkCompleted != null
            ? 'Mark completed'
            : null);
    final effectivePrimary = onPrimaryAction ?? onMarkCompleted;
    final content = desktop
        ? _desktopContent(context, effectiveLabel, effectivePrimary)
        : _cardContent(context, effectiveLabel, effectivePrimary);
    return Semantics(
      button: true,
      label: 'View request details',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onView,
          borderRadius: AppRadius.mdAll,
          child: Container(
            width: double.infinity,
            constraints: BoxConstraints(minHeight: isTerminal ? 96 : 108),
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 12),
            decoration: BoxDecoration(
              color: context.supplierColors.surfaceSolid,
              borderRadius: AppRadius.mdAll,
              border: Border.all(
                color: context.supplierColors.border.withValues(
                  alpha: isTerminal ? .32 : .5,
                ),
              ),
            ),
            child: content,
          ),
        ),
      ),
    );
  }

  Widget _desktopContent(
    BuildContext context,
    String? label,
    VoidCallback? primary,
  ) => Row(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      Expanded(
        flex: IncomingRequestDesktopGrid.identityFlex,
        child: _Identity(request: request),
      ),
      const SizedBox(width: IncomingRequestDesktopGrid.columnGap),
      Expanded(
        flex: IncomingRequestDesktopGrid.fulfillmentFlex,
        child: _Schedule(request: request),
      ),
      const SizedBox(width: IncomingRequestDesktopGrid.columnGap),
      Expanded(
        flex: IncomingRequestDesktopGrid.statusFlex,
        child: _OperationalState(request: request),
      ),
      const SizedBox(width: IncomingRequestDesktopGrid.columnGap),
      SizedBox(
        width: IncomingRequestDesktopGrid.detailsWidth,
        child: _Actions(
          label: label,
          onPrimary: primary,
          onView: onView,
          detailsLabel: 'View ${request.materialTitle} request details',
        ),
      ),
    ],
  );

  Widget _cardContent(
    BuildContext context,
    String? label,
    VoidCallback? primary,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _Identity(request: request),
      const SizedBox(height: AppSpacing.md),
      Wrap(
        spacing: AppSpacing.md,
        runSpacing: AppSpacing.md,
        children: [
          SizedBox(width: 260, child: _OperationalState(request: request)),
        ],
      ),
      const SizedBox(height: AppSpacing.md),
      _Schedule(request: request),
      const SizedBox(height: AppSpacing.md),
      _Actions(
        label: label,
        onPrimary: primary,
        onView: onView,
        detailsLabel: 'View ${request.materialTitle} request details',
        expanded: true,
      ),
    ],
  );
}

class _Identity extends StatelessWidget {
  const _Identity({required this.request});
  final SupplierIncomingRequest request;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final quantity = request.quantityRequested % 1 == 0
        ? request.quantityRequested.toInt().toString()
        : request.quantityRequested.toString();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Thumbnail(imageUrl: request.materialImageUrl),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Tooltip(
                message: request.materialTitle,
                child: Text(
                  request.materialTitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: context.supplierTitle().copyWith(fontSize: 16),
                ),
              ),
              const SizedBox(height: 3),
              Text(
                '${request.learnerName} · $quantity ${request.unit}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.supplierBody().copyWith(color: colors.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 3),
              Text(
                'RSV-${_shortId(request.id)}',
                style: context.supplierLabel().copyWith(fontSize: 11, color: colors.textMuted),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Thumbnail extends StatelessWidget {
  const _Thumbnail({this.imageUrl});
  final String? imageUrl;
  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: AppRadius.smAll,
    child: SizedBox(
      height: 56,
      width: 56,
      child: imageUrl == null || imageUrl!.isEmpty
          ? ColoredBox(color: context.supplierColors.backgroundElevated, child: Icon(Icons.inventory_2_outlined, color: context.supplierColors.textSecondary))
          : Image.network(
              ApiConfig.resolveMediaUrl(imageUrl!),
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => ColoredBox(color: context.supplierColors.backgroundElevated, child: Icon(Icons.broken_image_outlined, color: context.supplierColors.textSecondary)),
            ),
    ),
  );
}

class _Schedule extends StatelessWidget {
  const _Schedule({required this.request});
  final SupplierIncomingRequest request;
  @override
  Widget build(BuildContext context) {
    final summary = request.scheduleSummary;
    final window = summary?.effectiveWindow;
    final terminal = _isQuietTerminal(request);
    final isDelivery = request.isDeliveryFulfillment || request.hasDelivery;
    final heading = isDelivery ? 'Delivery' : 'Self pickup';
    final date = window?.start == null || window?.end == null ? null : _formatWindow(window!.start!, window.end!);
    final recovery = summary?.recoveryContext != null;
    final deliveryState = request.deliverySummary?.status ?? request.activeDelivery?.status;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(heading, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.supplierLabel()),
        const SizedBox(height: 3),
        Text(
          terminal
              ? _terminalFulfillmentLine(request.status)
              : recovery
              ? 'Admin recovery in progress'
              : isDelivery && deliveryState != null
              ? _deliveryLabel(deliveryState)
              : date == null
              ? 'No confirmed time yet'
              : '',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: context.supplierBody().copyWith(color: context.supplierColors.textSecondary, fontSize: 13),
        ),
        if (date != null) Text(date, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.supplierBody().copyWith(fontSize: 13)),
      ],
    );
  }
}

class _OperationalState extends StatelessWidget {
  const _OperationalState({required this.request});
  final SupplierIncomingRequest request;
  @override
  Widget build(BuildContext context) {
    final style = IncomingRequestStatusStyle.forStatus(request.status).resolve(context);
    final terminal = _isQuietTerminal(request);
    final nextActor = request.nextActor?.value;
    final isAdminReview = request.attentionState?.value == SupplierAttentionState.adminReviewRequired || request.summaryBucket?.value == SupplierSummaryBucket.adminReview;
    final supporting = terminal
        ? _terminalOutcome(request.status)
        : isAdminReview
        ? 'Recovery · Next: Admin'
        : nextActor != null && nextActor != SupplierNextActor.none
        ? '${_attentionLabel(request.attentionState?.value)} · Next: ${_actorLabel(nextActor)}'
        : _attentionLabel(request.attentionState?.value);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: style.background, borderRadius: AppRadius.pillAll, border: Border.all(color: style.border)),
          child: Text(request.status.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.supplierChip().copyWith(color: style.foreground, fontSize: 11, fontWeight: FontWeight.w600)),
        ),
        if (supporting != null) ...[
          const SizedBox(height: 5),
          Text(
            supporting,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.supplierBody().copyWith(
              fontSize: 13,
              color: request.attentionState?.value == SupplierAttentionState.supplierActionRequired
                  ? context.supplierColors.accent
                  : context.supplierColors.textSecondary,
            ),
          ),
        ],
      ],
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({
    this.label,
    this.onPrimary,
    required this.onView,
    required this.detailsLabel,
    this.expanded = false,
  });
  final String? label;
  final VoidCallback? onPrimary;
  final VoidCallback onView;
  final String detailsLabel;
  final bool expanded;
  @override
  Widget build(BuildContext context) {
    final style = ButtonStyle(
      minimumSize: const WidgetStatePropertyAll(Size(84, 40)),
      padding: const WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 8)),
      visualDensity: VisualDensity.compact,
    );
    final primary = label == null ? const SizedBox.shrink() : Tooltip(message: label!, child: FilledButton(onPressed: onPrimary, style: style, child: Text(label!, maxLines: 1, overflow: TextOverflow.ellipsis)));
    final view = Tooltip(
      message: detailsLabel,
      child: IconButton(
        onPressed: onView,
        tooltip: detailsLabel,
        icon: const Icon(Icons.chevron_right_rounded),
      ),
    );
    if (expanded) return Row(children: [if (label != null) Expanded(child: primary), if (label != null) const SizedBox(width: AppSpacing.sm), Expanded(child: view)]);
    return Align(alignment: AlignmentDirectional.centerStart, child: label == null ? view : primary);
  }
}

String _shortId(String id) => id.length <= 8 ? id.toUpperCase() : id.substring(0, 8).toUpperCase();

String _formatWindow(DateTime start, DateTime end) => '${DateFormat('MMM d · h:mm a').format(start.toLocal())}–${DateFormat('h:mm a').format(end.toLocal())}';

String _attentionLabel(SupplierAttentionState? attention) => switch (attention) {
  SupplierAttentionState.supplierActionRequired => 'Needs your response',
  SupplierAttentionState.waitingForLearner => 'Waiting for learner',
  SupplierAttentionState.fulfillmentInProgress => 'Fulfillment active',
  SupplierAttentionState.adminReviewRequired => 'Admin review',
  SupplierAttentionState.terminal => 'No further action',
  _ => 'Review request',
};

String? _terminalOutcome(SupplierIncomingRequestStatus status) => switch (status) {
  SupplierIncomingRequestStatus.completed => 'Completed successfully',
  SupplierIncomingRequestStatus.expired => 'No response before the deadline',
  _ => null,
};

String _terminalFulfillmentLine(SupplierIncomingRequestStatus status) => switch (status) {
  SupplierIncomingRequestStatus.completed => 'Completed fulfillment',
  SupplierIncomingRequestStatus.cancelled => 'Cancelled before fulfillment',
  SupplierIncomingRequestStatus.expired => 'Expired before fulfillment',
  SupplierIncomingRequestStatus.noShow => 'Closed after no-show',
  SupplierIncomingRequestStatus.fulfillmentFailed => 'Fulfillment failed',
  SupplierIncomingRequestStatus.declined => 'Rejected before fulfillment',
  _ => 'Final reservation outcome',
};

bool _isQuietTerminal(SupplierIncomingRequest request) {
  final adminReview = request.attentionState?.value == SupplierAttentionState.adminReviewRequired || request.summaryBucket?.value == SupplierSummaryBucket.adminReview;
  return !adminReview && (request.attentionState?.value == SupplierAttentionState.terminal || request.isReadOnlyFinalState);
}

String _actorLabel(SupplierNextActor actor) => switch (actor) {
  SupplierNextActor.supplier => 'Supplier',
  SupplierNextActor.learner => 'Learner',
  SupplierNextActor.driver => 'Driver',
  SupplierNextActor.admin => 'Admin',
  SupplierNextActor.system => 'System',
  _ => '',
};

String _deliveryLabel(String value) => switch (value.toUpperCase()) {
  'WAITING_FOR_DRIVER' => 'Waiting for driver',
  'DRIVER_ASSIGNED' => 'Driver assigned',
  'ARRIVED_PICKUP' => 'Driver at pickup',
  'IN_TRANSIT' => 'On the way',
  'DELIVERED' => 'Delivered',
  _ => value.replaceAll('_', ' ').toLowerCase(),
};
