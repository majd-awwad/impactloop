import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/format/localized_formatters.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/l10n/driver_quantity_labels.dart';
import '../../../../shared/l10n/driver_status_labels.dart';
import '../../../../shared/l10n/driver_ui_labels.dart';
import '../../../../shared/location/current_location_service.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/app_back_action.dart';
import '../../../../shared/widgets/app_text_area.dart';
import '../../../../shared/widgets/bidi_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../application/driver_deliveries_provider.dart';
import '../../application/driver_delivery_action_controller.dart';
import '../../application/driver_location_auto_ping_controller.dart';
import '../../data/models/driver_delivery.dart';
import '../../data/models/update_driver_delivery_status_request.dart';
import '../driver_delivery_timing_presentation.dart';
import '../widgets/driver_delivery_completion_flow.dart';
import '../widgets/driver_supplier_pickup_completion_flow.dart';
import '../widgets/driver_route_block.dart';
import '../widgets/driver_learner_contact_card.dart';
import '../widgets/partial_pickup_selection_dialog.dart';
import 'driver_history_detail_page.dart';

class DriverDeliveryDetailPage extends ConsumerWidget {
  const DriverDeliveryDetailPage({super.key, required this.deliveryId});

  final String deliveryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final deliveryAsync = ref.watch(driverDeliveryDetailProvider(deliveryId));

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.xl,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1040),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Align(
                alignment: AlignmentDirectional.centerStart,
                child: AppBackAction(fallbackLocation: '/driver/jobs'),
              ),
              const SizedBox(height: AppSpacing.sm),
              deliveryAsync.when(
                skipLoadingOnReload: true,
                loading: () => _StatePanel(
                  icon: Icons.route_outlined,
                  title: l10n.loadingDelivery,
                  subtitle: l10n.driverCheckingActiveDelivery,
                ),
                error: (_, _) => _StatePanel(
                  icon: Icons.cloud_off_outlined,
                  title: l10n.driverCouldNotLoadDetails,
                  subtitle: l10n.tryAgain,
                  actionLabel: l10n.retry,
                  actionTone: AppStatusTone.primary,
                  onAction: () => refreshActiveDriverDelivery(ref, deliveryId),
                ),
                data: (state) {
                  return switch (state) {
                    DriverDeliveryDetailActive(:final delivery) =>
                      _DeliveryContent(
                        delivery: delivery,
                        onRefresh: () =>
                            refreshActiveDriverDelivery(ref, deliveryId),
                      ),
                    DriverDeliveryDetailInactive(delivery: final delivery) =>
                      DriverHistoricalDeliveryContent(delivery: delivery),
                    DriverDeliveryDetailNotFound() => _StatePanel(
                      icon: Icons.lock_outline,
                      title: l10n.driverNotAssigned,
                      subtitle: l10n.driverOpenJobsBoard,
                      actionLabel: l10n.driverBackToJobs,
                      actionTone: AppStatusTone.neutral,
                      actionProminent: false,
                      onAction: () => context.popOrGo('/driver/jobs'),
                    ),
                  };
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DeliveryContent extends StatelessWidget {
  const _DeliveryContent({required this.delivery, required this.onRefresh});

  final DriverDelivery delivery;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 860;
    final summary = _SummaryPanel(delivery: delivery);
    final actions = _StatusActionPanel(delivery: delivery);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Header(delivery: delivery, onRefresh: onRefresh),
        const SizedBox(height: AppSpacing.lg),
        if (wide)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(flex: 5, child: summary),
              const SizedBox(width: AppSpacing.lg),
              Expanded(flex: 4, child: actions),
            ],
          )
        else ...[
          summary,
          const SizedBox(height: AppSpacing.lg),
          actions,
        ],
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.delivery, required this.onRefresh});

  final DriverDelivery delivery;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final formatters = LocalizedFormatters(l10n);

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  l10n.driverActiveDelivery,
                  style: AppTextStyles.display(
                    context,
                  ).copyWith(color: palette.textPrimary),
                ),
              ),
              IconButton(
                onPressed: onRefresh,
                tooltip: l10n.refresh,
                icon: const Icon(Icons.refresh_rounded),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              AppStatusBadge(
                label: driverDeliveryStatusLabel(delivery.status, l10n),
                tone: deliveryStatusAppTone(delivery.status),
              ),
              Text(
                l10n.driverAssignedAt(
                  formatters.dateTime(
                    delivery.assignedAt ?? delivery.requestedAt,
                  ),
                ),
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SummaryPanel extends StatelessWidget {
  const _SummaryPanel({required this.delivery});

  final DriverDelivery delivery;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final labels = DriverUiLabels(l10n);
    final pickupSummary = _locationLabel(
      city: delivery.pickupCity ?? delivery.pickupLocation.city,
      area: delivery.pickupArea ?? delivery.pickupLocation.area,
      fallback: labels.locationSummary(delivery.pickupLocation.safeSummary),
    );
    final dropoffSummary = _locationLabel(
      city: delivery.dropoffCity ?? delivery.dropoffLocation.city,
      area: delivery.dropoffArea ?? delivery.dropoffLocation.area,
      fallback: labels.locationSummary(delivery.dropoffLocation.safeSummary),
    );

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _PanelTitle(
            icon: Icons.inventory_2_outlined,
            title: delivery.hasGroupedItems ? l10n.materials : l10n.material,
            body: delivery.hasGroupedItems
                ? [
                    labels.groupedItemsCount(delivery.itemCount),
                    for (final item in delivery.items)
                      '${bidiIsolate(labels.materialTitle(item.title))} × ${bidiIsolate(driverQuantityLabel(l10n, item.quantity, item.unit))}',
                  ].join('\n')
                : '${bidiIsolate(labels.materialTitle(delivery.material.title))} - ${bidiIsolate(driverQuantityLabel(l10n, delivery.material.quantityRequested, delivery.material.unit))}',
          ),
          const SizedBox(height: AppSpacing.lg),
          DriverRouteBlock(
            pickupSummary: pickupSummary,
            dropoffSummary: dropoffSummary,
          ),
          const SizedBox(height: AppSpacing.lg),
          _InfoRow(
            label: l10n.pickupWindow,
            value: _driverPickupWindowDetail(delivery, l10n),
          ),
          _InfoRow(
            label: l10n.supplier,
            value: _partySummary(delivery.supplier, l10n),
          ),
          _InfoRow(
            label: l10n.driverPickupLabel,
            valueWidget: _locationDetail(
              context,
              delivery.pickupLocation,
              l10n,
            ),
          ),
          const Divider(height: AppSpacing.xl),
          _InfoRow(
            label: l10n.learner,
            value: delivery.learner == null
                ? l10n.driverLearnerUnavailable
                : _partySummary(delivery.learner!, l10n),
          ),
          _InfoRow(
            label: l10n.dropoff,
            valueWidget: _locationDetail(
              context,
              delivery.dropoffLocation,
              l10n,
            ),
          ),
          if (delivery.confirmedDeliveryWindowStart != null ||
              delivery.confirmedDeliveryWindowEnd != null)
            _InfoRow(
              label: l10n.driverDeliveryWindow,
              value: _deliveryWindowDetail(delivery, l10n),
            ),
          if (delivery.learnerNote?.trim().isNotEmpty == true)
            _InfoRow(
              label: l10n.driverLearnerNote,
              value: delivery.learnerNote!,
            ),
          const Divider(height: AppSpacing.xl),
          DriverLearnerContactCard(learner: delivery.learner),
          if (delivery.driverNote?.trim().isNotEmpty == true)
            _InfoRow(label: l10n.driverNote, value: delivery.driverNote!),
        ],
      ),
    );
  }
}

class _StatusActionPanel extends ConsumerStatefulWidget {
  const _StatusActionPanel({required this.delivery});

  final DriverDelivery delivery;

  @override
  ConsumerState<_StatusActionPanel> createState() => _StatusActionPanelState();
}

class _StatusActionPanelState extends ConsumerState<_StatusActionPanel> {
  final _noteController = TextEditingController();
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _startCountdownTimer();
  }

  @override
  void didUpdateWidget(covariant _StatusActionPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.delivery.id != widget.delivery.id ||
        oldWidget.delivery.status != widget.delivery.status) {
      _startCountdownTimer();
    }
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _noteController.dispose();
    super.dispose();
  }

  void _startCountdownTimer() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (!mounted) return;
      setState(() {});
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final actionState = ref.watch(driverDeliveryActionControllerProvider);
    final guidance = buildDriverNextActionGuidance(widget.delivery, l10n: l10n);
    final nextStatus = widget.delivery.nextStatus;
    final isSubmitting = actionState.isLoading;
    final canPressAction =
        nextStatus != null && guidance.isActionEnabled && !isSubmitting;

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StatusGuidanceCard(delivery: widget.delivery, guidance: guidance),
          const SizedBox(height: AppSpacing.lg),
          _StepList(currentStatus: widget.delivery.status),
          const SizedBox(height: AppSpacing.lg),
          if (nextStatus == null)
            _InlineNotice(
              icon: Icons.check_circle_outline,
              title: l10n.driverNoNextAction,
              body: l10n.driverCannotAdvance,
            )
          else ...[
            if (guidance.timingGate != null)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
                child: _InlineNotice(
                  icon: guidance.isBlockedByTiming
                      ? Icons.schedule_outlined
                      : Icons.info_outline,
                  title: guidance.timingGate!.title ?? l10n.driverTimingNote,
                  body: [
                    if (guidance.timingGate!.body != null)
                      guidance.timingGate!.body!,
                    if (guidance.timingGate!.remainingLabel != null)
                      guidance.timingGate!.remainingLabel!,
                  ].join('\n'),
                ),
              ),
            for (final requirement in guidance.requirements) ...[
              _RequirementRow(text: requirement),
              const SizedBox(height: AppSpacing.xs),
            ],
            const SizedBox(height: AppSpacing.sm),
            AppTextArea(
              controller: _noteController,
              label: l10n.driverOptionalNote,
              hint: l10n.driverOptionalNoteHint,
              minLines: 2,
              maxLines: 3,
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: canPressAction ? () => _advance(nextStatus) : null,
                style: AppStatusButtonStyle.filled(
                  context,
                  deliveryStatusAppTone(nextStatus),
                ),
                icon: isSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        Directionality.of(context) == TextDirection.rtl
                            ? Icons.arrow_back_rounded
                            : Icons.arrow_forward_rounded,
                      ),
                label: Text(
                  isSubmitting ? l10n.driverUpdating : guidance.actionLabel,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
            if (!guidance.isActionEnabled) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _disabledActionReason(widget.delivery, nextStatus, l10n),
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: MaterialsUiPalette.of(context).textMuted),
              ),
            ],
          ],
          const SizedBox(height: AppSpacing.md),
          if (widget.delivery.canDriverReportPickupFailed)
            OutlinedButton.icon(
              onPressed: isSubmitting ? null : _reportPickupFailed,
              style: AppStatusButtonStyle.outlined(
                context,
                AppStatusTone.danger,
              ),
              icon: const Icon(Icons.report_problem_outlined),
              label: Text(l10n.driverReportPickupFailed),
            ),
          if (widget.delivery.canDriverReportDeliveryFailed) ...[
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton.icon(
              onPressed: isSubmitting ? null : _reportDeliveryFailed,
              style: AppStatusButtonStyle.outlined(
                context,
                AppStatusTone.danger,
              ),
              icon: const Icon(Icons.no_accounts_outlined),
              label: Text(l10n.driverReportDeliveryFailed),
            ),
          ],
          if (widget.delivery.canDriverReportDriverIssue) ...[
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton.icon(
              onPressed: isSubmitting ? null : _reportDriverIssue,
              style: AppStatusButtonStyle.outlined(
                context,
                AppStatusTone.danger,
              ),
              icon: const Icon(Icons.car_crash_outlined),
              label: Text(l10n.driverReportDriverIssue),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          _LocationSharingSection(delivery: widget.delivery),
          const SizedBox(height: AppSpacing.md),
          TextButton.icon(
            onPressed: () => context.popOrGo('/driver/jobs'),
            style: AppStatusButtonStyle.text(context, AppStatusTone.neutral),
            icon: const Icon(Icons.local_shipping_outlined),
            label: Text(l10n.driverBackToJobs),
          ),
        ],
      ),
    );
  }

  Future<void> _advance(String nextStatus) async {
    final l10n = context.l10n;
    String? confirmationCode;
    List<String>? pickedReservationIds;
    List<UpdateDriverDeliveryUnpickedItem>? unpicked;

    if (nextStatus == 'PICKED_UP') {
      final needsPartialPickupUi =
          widget.delivery.hasGroupedItems && widget.delivery.items.length > 1;
      if (needsPartialPickupUi) {
        final selection = await showPartialPickupSelectionDialog(
          context: context,
          delivery: widget.delivery,
        );
        if (selection == null || !mounted) return;
        pickedReservationIds = selection.pickedReservationIds;
        unpicked = selection.unpicked;
      }

      final completed = await runDriverSupplierPickupCompletionFlow(
        context,
        ref,
        deliveryId: widget.delivery.id,
        reservationId: widget.delivery.reservationId,
        note: _noteController.text,
        pickedReservationIds: pickedReservationIds,
        unpicked: unpicked,
        showSuccessSnackBar: false,
      );
      if (!completed || !mounted) return;

      showInfoSnackBar(context, l10n.driverStatusPickedUpSuccess);
      _noteController.clear();
      return;
    } else if (nextStatus == 'DELIVERED') {
      final completed = await runDriverDeliveryCompletionFlow(
        context,
        ref,
        deliveryId: widget.delivery.id,
        reservationId: widget.delivery.reservationId,
        note: _noteController.text,
        payment: widget.delivery.handoverPayment,
        showSuccessSnackBar: false,
      );
      if (!completed || !mounted) return;

      context.popOrGo('/driver/active');
      leaveDriverDeliveryDetail(ref);
      showInfoSnackBar(context, l10n.driverDeliveryMarkedDelivered);
      _noteController.clear();
      return;
    }

    try {
      await ref
          .read(driverDeliveryActionControllerProvider.notifier)
          .updateStatus(
            deliveryId: widget.delivery.id,
            status: nextStatus,
            note: _noteController.text,
            confirmationCode: confirmationCode,
            pickedReservationIds: pickedReservationIds,
            unpicked: unpicked,
          );

      if (!mounted) return;

      if (nextStatus == 'DELIVERED') {
        if (!mounted) return;
        context.popOrGo('/driver/active');
        leaveDriverDeliveryDetail(ref);
        showInfoSnackBar(context, l10n.driverDeliveryMarkedDelivered);
        return;
      }

      final successMessage = switch (nextStatus) {
        'ARRIVED_PICKUP' => l10n.driverStatusArrivedPickupSuccess,
        'PICKED_UP' => l10n.driverStatusPickedUpSuccess,
        'ON_THE_WAY' => l10n.driverStatusOnTheWaySuccess,
        'ARRIVED_DROPOFF' => l10n.driverStatusArrivedDropoffSuccess,
        _ => l10n.driverStatusUpdated,
      };
      showInfoSnackBar(context, successMessage);
      _noteController.clear();
    } on ApiException catch (error) {
      if (!mounted) return;
      ref.invalidate(driverDeliveryDetailProvider(widget.delivery.id));
      final message = error.code == 'INVALID_DELIVERY_TRANSITION'
          ? l10n.driverStatusChangedRefresh
          : localizedApiErrorMessage(error, l10n);
      showInfoSnackBar(context, message);
    } catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, error);
    }
  }

  Future<void> _reportPickupFailed() async {
    final l10n = context.l10n;
    final labels = DriverUiLabels(l10n);
    final result = await _showDriverIncidentDialog(
      context,
      title: l10n.driverReportPickupFailed,
      reasonCodes: const [
        'SUPPLIER_UNAVAILABLE',
        'MATERIAL_NOT_READY',
        'LOCATION_ISSUE',
        'OTHER',
      ],
      reasonLabel: labels.failurePickupReason,
    );
    if (result == null || !mounted) return;

    try {
      await ref
          .read(driverDeliveryActionControllerProvider.notifier)
          .reportPickupFailed(
            deliveryId: widget.delivery.id,
            reason: result.reason,
            note: result.note,
          );
      if (!mounted) return;
      showInfoSnackBar(context, l10n.driverPickupFailureReported);
      context.popOrGo('/driver/active');
      leaveDriverDeliveryDetail(ref);
    } on ApiException catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, localizedApiErrorMessage(error, l10n));
    }
  }

  Future<void> _reportDeliveryFailed() async {
    final l10n = context.l10n;
    final labels = DriverUiLabels(l10n);
    final result = await _showDriverIncidentDialog(
      context,
      title: l10n.driverReportDeliveryFailed,
      reasonCodes: const [
        'LEARNER_UNAVAILABLE',
        'ADDRESS_ISSUE',
        'ACCESS_ISSUE',
        'OTHER',
      ],
      reasonLabel: labels.failureDeliveryReason,
    );
    if (result == null || !mounted) return;

    try {
      await ref
          .read(driverDeliveryActionControllerProvider.notifier)
          .reportDeliveryFailed(
            deliveryId: widget.delivery.id,
            reason: result.reason,
            note: result.note,
          );
      if (!mounted) return;
      showInfoSnackBar(context, l10n.driverDeliveryFailureReported);
      context.popOrGo('/driver/active');
      leaveDriverDeliveryDetail(ref);
    } on ApiException catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, localizedApiErrorMessage(error, l10n));
    }
  }

  Future<void> _reportDriverIssue() async {
    final l10n = context.l10n;
    final noteController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AppDialogShell(
        title: Text(l10n.driverReportDriverIssue),
        content: TextField(
          controller: noteController,
          maxLength: 1000,
          minLines: 3,
          maxLines: 5,
          decoration: InputDecoration(
            labelText: l10n.driverNoteRequired,
            hintText: l10n.driverIssueNoteHint,
          ),
        ),
        footer: AppDialogFooter.decision(
          secondaryAction: TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.driverCancelAction),
          ),
          primaryAction: FilledButton(
            onPressed: () {
              if (noteController.text.trim().isEmpty) return;
              Navigator.of(context).pop(true);
            },
            style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
            child: Text(l10n.driverSubmitReport),
          ),
        ),
      ),
    );
    final note = noteController.text.trim();
    noteController.dispose();
    if (confirmed != true || note.isEmpty || !mounted) return;

    try {
      await ref
          .read(driverDeliveryActionControllerProvider.notifier)
          .reportDriverIssue(deliveryId: widget.delivery.id, note: note);
      if (!mounted) return;
      showInfoSnackBar(context, l10n.driverIssueReported);
      context.popOrGo('/driver/active');
      leaveDriverDeliveryDetail(ref);
    } on ApiException catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, localizedApiErrorMessage(error, l10n));
    }
  }

  Future<_DriverIncidentFormResult?> _showDriverIncidentDialog(
    BuildContext context, {
    required String title,
    required List<String> reasonCodes,
    required String Function(String code) reasonLabel,
  }) async {
    final l10n = context.l10n;
    var selectedReason = reasonCodes.first;
    final noteController = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AppDialogShell(
          title: Text(title),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: selectedReason,
                decoration: InputDecoration(labelText: l10n.driverReason),
                items: reasonCodes
                    .map(
                      (code) => DropdownMenuItem(
                        value: code,
                        child: Text(reasonLabel(code)),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  if (value == null) return;
                  setState(() => selectedReason = value);
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteController,
                maxLength: 1000,
                minLines: 3,
                maxLines: 5,
                decoration: InputDecoration(labelText: l10n.driverNoteRequired),
              ),
            ],
          ),
          footer: AppDialogFooter.decision(
            secondaryAction: TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(l10n.driverCancelAction),
            ),
            primaryAction: FilledButton(
              onPressed: () {
                if (noteController.text.trim().isEmpty) return;
                Navigator.of(context).pop(true);
              },
              style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
              child: Text(l10n.driverSubmitReport),
            ),
          ),
        ),
      ),
    );
    final note = noteController.text.trim();
    noteController.dispose();
    if (confirmed != true || note.isEmpty) return null;
    return _DriverIncidentFormResult(reason: selectedReason, note: note);
  }
}

class _DriverIncidentFormResult {
  const _DriverIncidentFormResult({required this.reason, required this.note});
  final String reason;
  final String note;
}

class _LocationSharingSection extends ConsumerStatefulWidget {
  const _LocationSharingSection({required this.delivery});
  final DriverDelivery delivery;

  @override
  ConsumerState<_LocationSharingSection> createState() =>
      _LocationSharingSectionState();
}

class _LocationSharingSectionState
    extends ConsumerState<_LocationSharingSection> {
  DriverLocationAutoPingController? _autoPingController;
  DriverLocationAutoPingState _autoPingState =
      const DriverLocationAutoPingState();
  bool _isManualPinging = false;

  @override
  void initState() {
    super.initState();
    _bindAutoPingController();
  }

  @override
  void didUpdateWidget(covariant _LocationSharingSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.delivery.id != widget.delivery.id) {
      _autoPingController?.dispose();
      _bindAutoPingController();
    } else {
      _autoPingController?.updateDeliveryStatus(
        widget.delivery.status,
        canShareLocation: widget.delivery.canShareLocation,
      );
    }
  }

  @override
  void dispose() {
    _autoPingController?.dispose();
    super.dispose();
  }

  void _bindAutoPingController() {
    _autoPingController =
        DriverLocationAutoPingController(
          sendPing: () => ref
              .read(driverDeliveryActionControllerProvider.notifier)
              .captureAndSendLocationPing(widget.delivery.id),
          resolveErrorMessage: (error) =>
              DriverUiLabels(context.l10n).locationError(error),
          onStateChanged: (state) {
            if (!mounted) return;
            setState(() => _autoPingState = state);
          },
        )..updateDeliveryStatus(
          widget.delivery.status,
          canShareLocation: widget.delivery.canShareLocation,
        );
    _autoPingState = _autoPingController!.state;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final formatters = LocalizedFormatters(l10n);
    final eligible = widget.delivery.canShareLocation;
    final sharingActive = _autoPingState.enabled && _autoPingState.isSharing;
    final isBusy = _autoPingState.isPinging || _isManualPinging;

    return _InlineNotice(
      icon: Icons.my_location_outlined,
      title: l10n.driverLocationSharing,
      body: l10n.driverLocationSharingBody,
      action: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (eligible)
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              title: Text(l10n.driverShareAutomatically),
              subtitle: Text(
                sharingActive
                    ? l10n.driverSharingEvery45Seconds
                    : l10n.driverLocationSharingPaused,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
              value: _autoPingState.enabled,
              onChanged: isBusy
                  ? null
                  : (value) => _autoPingController?.setEnabled(value),
            )
          else
            Text(
              l10n.driverLocationSharingPaused,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
          if (_autoPingState.lastSharedAt != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              l10n.driverLastShared(
                formatters.dateTime(_autoPingState.lastSharedAt!),
              ),
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
          ],
          if (_autoPingState.inlineError != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              _autoPingState.inlineError!,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textMuted),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          FilledButton.icon(
            onPressed: !eligible || isBusy
                ? null
                : () => _sendManualLocation(context),
            style: AppStatusButtonStyle.filled(context, AppStatusTone.info),
            icon: isBusy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.my_location_outlined),
            label: Text(
              isBusy ? l10n.driverSending : l10n.driverSendMyLocation,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _sendManualLocation(BuildContext context) async {
    final l10n = context.l10n;
    setState(() => _isManualPinging = true);
    try {
      await ref
          .read(driverDeliveryActionControllerProvider.notifier)
          .captureAndSendLocationPing(widget.delivery.id);
      if (!mounted) return;
      setState(() {
        _autoPingState = _autoPingState.copyWith(
          lastSharedAt: DateTime.now(),
          clearInlineError: true,
        );
      });
      if (!context.mounted) return;
      showInfoSnackBar(context, l10n.driverLocationUpdateSent);
    } on CurrentLocationException catch (error) {
      if (!mounted) return;
      setState(() {
        _autoPingState = _autoPingState.copyWith(
          inlineError: DriverUiLabels(l10n).locationError(error),
        );
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _autoPingState = _autoPingState.copyWith(
          inlineError: localizedApiErrorMessage(error, l10n),
        );
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _autoPingState = _autoPingState.copyWith(
          inlineError: DriverUiLabels(l10n).locationError(error),
        );
      });
    } finally {
      if (mounted) setState(() => _isManualPinging = false);
    }
  }
}

class _StatusGuidanceCard extends StatelessWidget {
  const _StatusGuidanceCard({required this.delivery, required this.guidance});

  final DriverDelivery delivery;
  final DriverNextActionGuidance guidance;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);

    return _InlineNotice(
      icon: Icons.timeline_outlined,
      title: l10n.driverCurrentStage(
        driverDeliveryStatusLabel(delivery.status, l10n),
      ),
      body: delivery.nextStatus == null
          ? l10n.driverNoFurtherSteps
          : l10n.driverAdvanceTo(guidance.actionLabel),
      action: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.driverNextAction(guidance.actionLabel),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          if (delivery.status == 'ARRIVED_PICKUP' ||
              delivery.nextStatus == 'PICKED_UP') ...[
            const SizedBox(height: AppSpacing.sm),
            Text(l10n.driverSupplierCodeRequired),
          ],
          if (delivery.nextStatus == 'DELIVERED') ...[
            const SizedBox(height: AppSpacing.sm),
            Text(l10n.driverLearnerCodeRequired),
          ],
        ],
      ),
    );
  }
}

class _RequirementRow extends StatelessWidget {
  const _RequirementRow({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.check_circle_outline, size: 16, color: palette.textMuted),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Text(
            text,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ),
      ],
    );
  }
}

class _StepList extends StatelessWidget {
  const _StepList({required this.currentStatus});
  final String currentStatus;

  static const _steps = [
    'DRIVER_ASSIGNED',
    'ARRIVED_PICKUP',
    'PICKED_UP',
    'ON_THE_WAY',
    'ARRIVED_DROPOFF',
    'DELIVERED',
  ];

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final currentIndex = _steps.indexOf(currentStatus);
    final safeIndex = currentIndex < 0 ? 0 : currentIndex;

    return Column(
      children: [
        for (var index = 0; index < _steps.length; index++)
          _StatusStep(
            label: driverDeliveryStatusLabel(_steps[index], l10n),
            complete: currentIndex >= 0 && safeIndex >= index,
            current: currentIndex >= 0 && safeIndex == index,
          ),
      ],
    );
  }
}

class _StatusStep extends StatelessWidget {
  const _StatusStep({
    required this.label,
    required this.complete,
    required this.current,
  });

  final String label;
  final bool complete;
  final bool current;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final color = complete ? palette.mint : palette.textMuted;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Icon(
            complete ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 20,
            color: color,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              label,
              style: AppTextStyles.body(context).copyWith(
                color: current ? palette.textPrimary : palette.textSecondary,
                fontWeight: current ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: child,
    );
  }
}

class _PanelTitle extends StatelessWidget {
  const _PanelTitle({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: palette.mint),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textPrimary),
              ),
              const SizedBox(height: AppSpacing.xs),
              BidiText(
                body,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, this.value, this.valueWidget})
    : assert(value != null || valueWidget != null);

  final String label;
  final String? value;
  final Widget? valueWidget;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textMuted),
          ),
          const SizedBox(height: AppSpacing.xs),
          valueWidget ??
              BidiText(
                value!,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textPrimary),
              ),
        ],
      ),
    );
  }
}

class _InlineNotice extends StatelessWidget {
  const _InlineNotice({
    required this.icon,
    required this.title,
    required this.body,
    this.action,
  });

  final IconData icon;
  final String title;
  final String body;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: palette.mint),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTextStyles.label(context)),
                const SizedBox(height: AppSpacing.xs),
                Text(body, style: AppTextStyles.body(context)),
                if (action != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  action!,
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatePanel extends StatelessWidget {
  const _StatePanel({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
    this.actionTone = AppStatusTone.primary,
    this.actionProminent = true,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final AppStatusTone actionTone;
  final bool actionProminent;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: palette.mint),
          const SizedBox(height: AppSpacing.sm),
          Text(
            title,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            subtitle,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.md),
            FilledButton(
              onPressed: onAction,
              style: actionProminent
                  ? AppStatusButtonStyle.filled(context, actionTone)
                  : AppStatusButtonStyle.outlined(context, actionTone),
              child: Text(actionLabel!),
            ),
          ],
        ],
      ),
    );
  }
}

String _disabledActionReason(
  DriverDelivery delivery,
  String nextStatus,
  AppLocalizations l10n,
) {
  final guidance = buildDriverNextActionGuidance(delivery, l10n: l10n);
  if (guidance.timingGate?.isBlocked == true) {
    final gate = guidance.timingGate!;
    return [
      if (gate.body != null) gate.body!,
      if (gate.remainingLabel != null) gate.remainingLabel!,
    ].join('\n');
  }
  return switch (nextStatus) {
    'PICKED_UP' => l10n.driverCompleteArriveBeforePickedUp,
    'ON_THE_WAY' => l10n.driverMarkPickedUpBeforeDelivery,
    'ARRIVED_DROPOFF' => l10n.driverStartDeliveryBeforeArrive,
    'DELIVERED' => l10n.driverArriveBeforeDelivered,
    _ => l10n.driverActionNotAvailable,
  };
}

String _driverPickupWindowDetail(
  DriverDelivery delivery,
  AppLocalizations l10n,
) {
  final start =
      delivery.supplierPickupWindowStart ?? delivery.pickupWindowStart;
  final end = delivery.supplierPickupWindowEnd ?? delivery.pickupWindowEnd;
  if (start == null && end == null) return l10n.driverNotSet;
  final formatters = LocalizedFormatters(l10n);
  if (start != null && end != null) return formatters.dateTimeRange(start, end);
  return formatters.dateTime(start ?? end!);
}

String _deliveryWindowDetail(DriverDelivery delivery, AppLocalizations l10n) {
  final start = delivery.confirmedDeliveryWindowStart;
  final end = delivery.confirmedDeliveryWindowEnd;
  if (start == null && end == null) return l10n.driverNotSet;
  final formatters = LocalizedFormatters(l10n);
  if (start != null && end != null) return formatters.dateTimeRange(start, end);
  return formatters.dateTime(start ?? end!);
}

String _partySummary(DriverDeliveryParty party, AppLocalizations l10n) {
  final details = [
    bidiIsolate(DriverUiLabels(l10n).partyDisplayName(party.displayName)),
    if (party.phone?.trim().isNotEmpty == true) bidiIsolate(party.phone!),
  ];
  return details.join(' - ');
}

Widget _locationDetail(
  BuildContext context,
  DriverSafeLocation location,
  AppLocalizations l10n,
) {
  final palette = MaterialsUiPalette.of(context);
  final bodyStyle = AppTextStyles.body(
    context,
  ).copyWith(color: palette.textPrimary);
  final summary = DriverUiLabels(l10n).locationSummary(location.exactSummary);

  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      BidiText(summary, style: bodyStyle),
      if (location.isApproximate == true) ...[
        const SizedBox(height: AppSpacing.xs),
        Text(l10n.driverApproximateAddress, style: bodyStyle),
      ],
      if (!location.hasExactCoordinates) ...[
        const SizedBox(height: AppSpacing.xs),
        Text(l10n.driverExactCoordinatesMissing, style: bodyStyle),
      ] else ...[
        const SizedBox(height: AppSpacing.xs),
        BidiText(
          '${location.latitude!.toStringAsFixed(5)}, '
          '${location.longitude!.toStringAsFixed(5)}',
          style: bodyStyle,
          technical: true,
        ),
      ],
    ],
  );
}

String _locationLabel({String? city, String? area, required String fallback}) {
  final parts = [area, city]
      .where((p) => p != null && p.trim().isNotEmpty)
      .cast<String>()
      .toList(growable: false);
  return parts.isEmpty ? fallback : parts.join(', ');
}
