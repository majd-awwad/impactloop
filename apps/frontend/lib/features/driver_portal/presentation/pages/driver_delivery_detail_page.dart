import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_text_area.dart';
import '../../../../shared/location/current_location_service.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../../../shared/widgets/handover_confirmation_code_panel.dart';
import '../../application/driver_deliveries_provider.dart';
import '../../application/driver_delivery_action_controller.dart';
import '../../application/driver_location_auto_ping_controller.dart';
import '../../data/models/driver_delivery.dart';

class DriverDeliveryDetailPage extends ConsumerWidget {
  const DriverDeliveryDetailPage({super.key, required this.deliveryId});

  final String deliveryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final deliveryAsync = ref.watch(activeDriverDeliveryProvider(deliveryId));

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
          child: deliveryAsync.when(
            loading: () => const _StatePanel(
              icon: Icons.route_outlined,
              title: 'Loading delivery',
              subtitle: 'Checking your active assigned delivery.',
            ),
            error: (_, _) => _StatePanel(
              icon: Icons.cloud_off_outlined,
              title: 'Could not load delivery',
              subtitle: 'Please try again.',
              actionLabel: 'Retry',
              onAction: () =>
                  ref.invalidate(activeDriverDeliveryProvider(deliveryId)),
            ),
            data: (delivery) {
              if (delivery == null) {
                return _StatePanel(
                  icon: Icons.lock_outline,
                  title: 'Delivery not active or not assigned to you',
                  subtitle:
                      'Open the jobs board to view your current assigned delivery.',
                  actionLabel: 'Back to jobs',
                  onAction: () => context.go('/driver/jobs'),
                );
              }

              return _DeliveryContent(delivery: delivery);
            },
          ),
        ),
      ),
    );
  }
}

class _DeliveryContent extends StatelessWidget {
  const _DeliveryContent({required this.delivery});

  final DriverDelivery delivery;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 860;
    final summary = _SummaryPanel(delivery: delivery);
    final actions = _StatusActionPanel(delivery: delivery);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Header(delivery: delivery),
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
  const _Header({required this.delivery});

  final DriverDelivery delivery;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Active delivery',
            style: AppTextStyles.display(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              MaterialStatusBadge(
                label: deliveryStatusLabel(delivery.status),
                tone: deliveryStatusTone(delivery.status),
              ),
              Text(
                'Assigned ${_formatDateTime(delivery.assignedAt ?? delivery.requestedAt)}',
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
    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _PanelTitle(
            icon: Icons.inventory_2_outlined,
            title: 'Material',
            body:
                '${delivery.material.title} - ${delivery.material.quantityLabel}',
          ),
          const SizedBox(height: AppSpacing.lg),
          _InfoRow(label: 'Pickup window', value: _pickupWindowText(delivery)),
          _InfoRow(label: 'Supplier', value: _partySummary(delivery.supplier)),
          _InfoRow(
            label: 'Pickup',
            value: _locationSummary(delivery.pickupLocation),
          ),
          const Divider(height: AppSpacing.xl),
          _InfoRow(
            label: 'Learner',
            value: delivery.learner == null
                ? 'Learner unavailable'
                : _partySummary(delivery.learner!),
          ),
          _InfoRow(
            label: 'Dropoff',
            value: _locationSummary(delivery.dropoffLocation),
          ),
          if (delivery.learnerNote?.trim().isNotEmpty == true)
            _InfoRow(label: 'Learner note', value: delivery.learnerNote!),
          if (delivery.driverNote?.trim().isNotEmpty == true)
            _InfoRow(label: 'Driver note', value: delivery.driverNote!),
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

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final actionState = ref.watch(driverDeliveryActionControllerProvider);
    final nextStatus = widget.delivery.nextStatus;
    final isSubmitting = actionState.isLoading;

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _PanelTitle(
            icon: Icons.timeline_outlined,
            title: 'Status update',
            body: 'Move this delivery through the backend order.',
          ),
          const SizedBox(height: AppSpacing.lg),
          _StepList(currentStatus: widget.delivery.status),
          const SizedBox(height: AppSpacing.lg),
          if (nextStatus == null)
            const _InlineNotice(
              icon: Icons.check_circle_outline,
              title: 'No next action',
              body: 'This delivery cannot be advanced from its current status.',
            )
          else ...[
            AppTextArea(
              controller: _noteController,
              label: 'Optional driver note',
              hint: 'Add a short note for this status update',
              minLines: 2,
              maxLines: 3,
            ),
            const SizedBox(height: AppSpacing.md),
            FilledButton.icon(
              onPressed: isSubmitting ? null : () => _advance(nextStatus),
              icon: isSubmitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.arrow_forward_rounded),
              label: Text(
                isSubmitting ? 'Updating...' : _nextActionLabel(nextStatus),
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          if (widget.delivery.canDriverReportPickupFailed)
            OutlinedButton.icon(
              onPressed: isSubmitting
                  ? null
                  : () => _reportPickupFailed(context),
              icon: const Icon(Icons.report_problem_outlined),
              label: const Text('Report pickup failed'),
            ),
          if (widget.delivery.canDriverReportDeliveryFailed) ...[
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton.icon(
              onPressed: isSubmitting
                  ? null
                  : () => _reportDeliveryFailed(context),
              icon: const Icon(Icons.no_accounts_outlined),
              label: const Text('Report delivery failed'),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          _LocationSharingSection(delivery: widget.delivery),
          const SizedBox(height: AppSpacing.md),
          TextButton.icon(
            onPressed: () => context.go('/driver/jobs'),
            icon: const Icon(Icons.local_shipping_outlined),
            label: const Text('Back to jobs'),
          ),
        ],
      ),
    );
  }

  Future<void> _advance(String nextStatus) async {
    String? confirmationCode;
    if (nextStatus == 'PICKED_UP') {
      confirmationCode = await HandoverCodeInputDialog.show(
        context,
        title: 'Supplier handover code',
        message:
            'Enter the code the supplier gives you after handing over the material.',
        confirmLabel: 'Mark picked up',
      );
      if (confirmationCode == null || !mounted) {
        return;
      }
    } else if (nextStatus == 'DELIVERED') {
      confirmationCode = await HandoverCodeInputDialog.show(
        context,
        title: 'Learner delivery code',
        message:
            'Enter the code the learner gives you when they receive the material.',
        confirmLabel: 'Mark delivered',
      );
      if (confirmationCode == null || !mounted) {
        return;
      }
    }

    try {
      await ref
          .read(driverDeliveryActionControllerProvider.notifier)
          .updateStatus(
            deliveryId: widget.delivery.id,
            status: nextStatus,
            note: _noteController.text,
            confirmationCode: confirmationCode,
          );

      if (!mounted) {
        return;
      }

      if (nextStatus == 'DELIVERED') {
        showInfoSnackBar(context, 'Delivery marked delivered.');
        context.go('/driver/jobs');
        return;
      }

      showInfoSnackBar(context, 'Delivery status updated.');
      _noteController.clear();
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      final message = error.statusCode == 409
          ? 'Delivery status changed. Refresh and try the next valid action.'
          : error.statusCode == 400
          ? error.displayMessage
          : error.displayMessage;
      showInfoSnackBar(context, message);
    } catch (error) {
      if (!mounted) {
        return;
      }

      showErrorSnackBar(context, error);
    }
  }

  Future<void> _reportPickupFailed(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Report pickup failed'),
        content: const Text(
          'Confirm that the supplier pickup window expired and the handover could not happen.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Report failed'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    try {
      await ref
          .read(driverDeliveryActionControllerProvider.notifier)
          .reportPickupFailed(
            deliveryId: widget.delivery.id,
            reason: 'SUPPLIER_UNAVAILABLE',
            note: _noteController.text.trim().isEmpty
                ? null
                : _noteController.text.trim(),
          );
      if (!mounted) {
        return;
      }
      showInfoSnackBar(context, 'Pickup failure reported.');
      context.go('/driver/jobs');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      showErrorSnackBar(context, error.displayMessage);
    }
  }

  Future<void> _reportDeliveryFailed(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Report delivery failed'),
        content: const Text(
          'Confirm that the delivery window expired and the learner could not receive the material.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Report failed'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    try {
      await ref
          .read(driverDeliveryActionControllerProvider.notifier)
          .reportDeliveryFailed(
            deliveryId: widget.delivery.id,
            reason: 'LEARNER_UNAVAILABLE',
            note: _noteController.text.trim().isEmpty
                ? null
                : _noteController.text.trim(),
          );
      if (!mounted) {
        return;
      }
      showInfoSnackBar(context, 'Delivery failure reported.');
      context.go('/driver/jobs');
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      showErrorSnackBar(context, error.displayMessage);
    }
  }
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
      _autoPingController?.updateDeliveryStatus(widget.delivery.status);
    }
  }

  @override
  void dispose() {
    _autoPingController?.dispose();
    super.dispose();
  }

  void _bindAutoPingController() {
    _autoPingController = DriverLocationAutoPingController(
      sendPing: () => ref
          .read(driverDeliveryActionControllerProvider.notifier)
          .captureAndSendLocationPing(widget.delivery.id),
      onStateChanged: (state) {
        if (!mounted) {
          return;
        }

        setState(() => _autoPingState = state);
      },
    )..updateDeliveryStatus(widget.delivery.status);
    _autoPingState = _autoPingController!.state;
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final eligible = widget.delivery.isAutoPingEligible;
    final sharingActive = _autoPingState.enabled && _autoPingState.isSharing;
    final isBusy = _autoPingState.isPinging || _isManualPinging;

    return _InlineNotice(
      icon: Icons.my_location_outlined,
      title: 'Location sharing',
      body:
          'Share your location while this delivery is active so the learner can track progress.',
      action: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (eligible)
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              title: const Text('Share automatically'),
              subtitle: Text(
                sharingActive
                    ? 'Sharing every 45 seconds while this page is open.'
                    : 'Location sharing paused',
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
              'Location sharing paused',
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
          if (_autoPingState.lastSharedAt != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Last shared: ${_formatDateTime(_autoPingState.lastSharedAt!)}',
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
            onPressed: isBusy ? null : () => _sendManualLocation(context),
            icon: isBusy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.my_location_outlined),
            label: Text(isBusy ? 'Sending...' : 'Send my location'),
          ),
        ],
      ),
    );
  }

  Future<void> _sendManualLocation(BuildContext context) async {
    setState(() => _isManualPinging = true);

    try {
      await ref
          .read(driverDeliveryActionControllerProvider.notifier)
          .captureAndSendLocationPing(widget.delivery.id);

      if (!mounted) {
        return;
      }

      setState(() {
        _autoPingState = _autoPingState.copyWith(
          lastSharedAt: DateTime.now(),
          clearInlineError: true,
        );
      });
      if (!context.mounted) {
        return;
      }
      showInfoSnackBar(context, 'Location update sent.');
    } on CurrentLocationException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _autoPingState = _autoPingState.copyWith(inlineError: error.message);
      });
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _autoPingState = _autoPingState.copyWith(
          inlineError: error.displayMessage,
        );
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      showErrorSnackBar(context, error);
    } finally {
      if (mounted) {
        setState(() => _isManualPinging = false);
      }
    }
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
    final currentIndex = _steps.indexOf(currentStatus);

    return Column(
      children: [
        for (var index = 0; index < _steps.length; index++)
          _StatusStep(
            label: deliveryStatusLabel(_steps[index]),
            complete: currentIndex >= index,
            current: currentIndex == index,
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
              Text(
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
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

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
          Text(
            value,
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
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

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
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}

String _nextActionLabel(String status) {
  switch (status) {
    case 'ARRIVED_PICKUP':
      return 'Arrived at pickup';
    case 'PICKED_UP':
      return 'Picked up';
    case 'ON_THE_WAY':
      return 'On the way';
    case 'ARRIVED_DROPOFF':
      return 'Arrived at dropoff';
    case 'DELIVERED':
      return 'Mark delivered';
    default:
      return deliveryStatusLabel(status);
  }
}

String _partySummary(DriverDeliveryParty party) {
  final details = [
    party.displayName,
    if (party.phone?.trim().isNotEmpty == true) party.phone!,
  ];
  return details.join(' - ');
}

String _locationSummary(DriverSafeLocation location) {
  final summary = location.exactSummary;
  if (location.hasExactCoordinates) {
    return '$summary (${location.latitude!.toStringAsFixed(5)}, ${location.longitude!.toStringAsFixed(5)})';
  }

  return summary;
}

String _pickupWindowText(DriverDelivery delivery) {
  final start = delivery.pickupWindowStart;
  final end = delivery.pickupWindowEnd;

  if (start == null && end == null) {
    return 'Not set';
  }

  if (start != null && end != null) {
    return '${_formatDateTime(start)} - ${_formatDateTime(end)}';
  }

  return _formatDateTime(start ?? end!);
}

String _formatDateTime(DateTime dateTime) {
  final local = dateTime.toLocal();
  final month = local.month.toString().padLeft(2, '0');
  final day = local.day.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '${local.year}-$month-$day $hour:$minute';
}
