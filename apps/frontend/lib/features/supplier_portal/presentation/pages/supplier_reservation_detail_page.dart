import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_section_card.dart';
import '../../../../shared/widgets/app_back_action.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/handover_confirmation_code_panel.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../controllers/supplier_requests_providers.dart';
import '../supplier_reservation_history_notes.dart';
import '../supplier_reservation_ui_helpers.dart';
import '../supplier_driver_pickup_handover_qr_dialog.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/accept_incoming_request_dialog.dart';
import '../widgets/decline_incoming_request_dialog.dart';
import '../widgets/reservation_follow_up_flow.dart';
import '../widgets/supplier_delivery_incident_flow.dart';
import '../widgets/supplier_feedback.dart';
import '../widgets/supplier_pickup_completion_flow.dart';

class SupplierReservationDetailPage extends ConsumerStatefulWidget {
  const SupplierReservationDetailPage({super.key, required this.reservationId});

  final String reservationId;

  @override
  ConsumerState<SupplierReservationDetailPage> createState() =>
      _SupplierReservationDetailPageState();
}

class _SupplierReservationDetailPageState
    extends ConsumerState<SupplierReservationDetailPage> {
  final _messageController = TextEditingController();
  final _messageFocusNode = FocusNode();
  final _messageScrollKey = GlobalKey();
  final _localMessages = <SupplierReservationMessageSummary>[];
  String? _busyAction;
  String? _actionError;

  @override
  void dispose() {
    _messageController.dispose();
    _messageFocusNode.dispose();
    super.dispose();
  }

  void _back() => context.popOrGo('/supplier/reservations');

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 1100;
    final detailAsync = ref.watch(
      supplierReservationDetailProvider(widget.reservationId),
    );

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 1440),
        child: SingleChildScrollView(
          padding: context.supplierDecorations.pagePadding(compact: compact),
          child: Material(
            type: MaterialType.transparency,
            child: detailAsync.when(
              loading: () => const _DetailSkeleton(),
              error: (error, _) => _DetailError(
                notFound: _isNotFound(error),
                onBack: _back,
                onRetry: () => ref.invalidate(
                  supplierReservationDetailProvider(widget.reservationId),
                ),
              ),
              data: (detail) => _workspace(context, detail),
            ),
          ),
        ),
      ),
    );
  }

  Widget _workspace(BuildContext context, SupplierReservationDetail detail) {
    final reservation = detail.reservation;
    final executableActions = reservation.availableActions
        .where((action) => action.isExecutable)
        .map((action) => action.value)
        .where((action) => action != SupplierReservationAction.unknown)
        .toList(growable: false);
    final width = MediaQuery.sizeOf(context).width;
    final desktop = width >= 1100;
    final learnerName = _learnerName(detail);
    final materialTitle = _materialTitle(detail);

    final header = _HeaderCard(
      reservation: reservation,
      materialTitle: materialTitle,
      learnerName: learnerName,
      onBack: _back,
      actions: executableActions,
      busyAction: _busyAction,
      onAction: (action) => _runAction(detail, action),
    );
    final stateStrip = _StateStrip(detail: detail);
    final actions = _ActionPanel(
      actions: executableActions,
      busyAction: _busyAction,
      error: _actionError,
      onAction: (action) => _runAction(detail, action),
    );
    final summary = _RequestSummaryCard(
      detail: detail,
      materialTitle: materialTitle,
      learnerName: learnerName,
    );
    final schedule = _ScheduleCard(detail: detail);
    final fulfillment = _FulfillmentCard(detail: detail);
    final incident = detail.incident == null
        ? null
        : _IncidentCard(incident: detail.incident!);
    final group = detail.group == null
        ? null
        : _GroupCard(group: detail.group!);
    final messages = _MessagesCard(
      key: _messageScrollKey,
      detail: detail,
      learnerName: learnerName,
      controller: _messageController,
      focusNode: _messageFocusNode,
      localMessages: _localMessages,
      onSend: () => _sendMessage(detail),
      sending: _busyAction == 'SEND_MESSAGE',
    );
    final history = _HistoryCard(history: detail.history);
    final attention = _AttentionCard(reservation: reservation);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        header,
        const SizedBox(height: AppSpacing.md),
        stateStrip,
        if (!desktop) ...[
          const SizedBox(height: AppSpacing.md),
          if (executableActions.isNotEmpty) actions,
          const SizedBox(height: AppSpacing.md),
          summary,
          const SizedBox(height: AppSpacing.md),
          schedule,
          const SizedBox(height: AppSpacing.md),
          fulfillment,
          if (incident != null) ...[
            const SizedBox(height: AppSpacing.md),
            incident,
          ],
          if (group != null) ...[const SizedBox(height: AppSpacing.md), group],
          const SizedBox(height: AppSpacing.md),
          messages,
          const SizedBox(height: AppSpacing.md),
          history,
        ] else ...[
          const SizedBox(height: AppSpacing.lg),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 7,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    summary,
                    const SizedBox(height: AppSpacing.md),
                    schedule,
                    const SizedBox(height: AppSpacing.md),
                    messages,
                    const SizedBox(height: AppSpacing.md),
                    history,
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                flex: 3,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    attention,
                    const SizedBox(height: AppSpacing.md),
                    fulfillment,
                    if (incident != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      incident,
                    ],
                    if (group != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      group,
                    ],
                    if (executableActions.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.md),
                      actions,
                    ],
                  ],
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Future<void> _runAction(
    SupplierReservationDetail detail,
    SupplierReservationAction action,
  ) async {
    if (_busyAction != null) return;
    if (action == SupplierReservationAction.sendMessage) {
      _messageFocusNode.requestFocus();
      return;
    }

    setState(() {
      _busyAction = action.name;
      _actionError = null;
    });
    final reservation = detail.reservation;
    try {
      switch (action) {
        case SupplierReservationAction.accept:
          final window = await AcceptIncomingRequestDialog.show(
            context,
            request: reservation,
          );
          if (window != null && mounted) {
            await acceptIncomingRequest(
              ref,
              requestId: reservation.id,
              pickupWindow: window,
            );
            if (mounted)
              showSupplierInfoSnackBar(context, context.s.requestAccepted);
          }
        case SupplierReservationAction.decline:
          final result = await DeclineIncomingRequestDialog.show(
            context,
            materialTitle: reservation.materialTitle,
            learnerName: reservation.learnerName,
          );
          if (result?.result == DeclineIncomingRequestResult.declined &&
              mounted) {
            await declineIncomingRequest(
              ref,
              requestId: reservation.id,
              reason: result!.reason,
            );
            if (mounted)
              showSupplierInfoSnackBar(context, context.s.requestDeclined);
          }
        case SupplierReservationAction.completeSelfPickup:
          final completed = await runSupplierPickupCompletionFlow(
            context,
            ref,
            reservationId: reservation.id,
            payment: reservation.handoverPayment,
          );
          if (!completed) break;
        case SupplierReservationAction.acceptLearnerReschedule:
          await handleAcceptLearnerReschedule(
            context,
            ref,
            reservationId: reservation.id,
          );
        case SupplierReservationAction.proposeReschedule:
          await handleRequestReschedulePickup(
            context,
            ref,
            reservationId: reservation.id,
            materialTitle: reservation.materialTitle,
            learnerName: reservation.learnerName,
          );
        case SupplierReservationAction.submitRecoveryPickupWindow:
          await handleSubmitNoDriverPickupWindow(
            context,
            ref,
            reservationId: reservation.id,
            materialTitle: reservation.materialTitle,
            learnerName: reservation.learnerName,
          );
        case SupplierReservationAction.closeReservation:
          await handleCloseOverduePickup(
            context,
            ref,
            reservationId: reservation.id,
          );
        case SupplierReservationAction.reportIncident:
          await handleReportToAdminAndClose(
            context,
            ref,
            reservationId: reservation.id,
          );
        case SupplierReservationAction.reportNoDriver:
          await handleReportNoDriverAvailable(
            context,
            ref,
            reservationId: reservation.id,
          );
        case SupplierReservationAction.markDeliveryPickupExpired:
          await handleMarkDeliveryPickupExpired(
            context,
            ref,
            reservationId: reservation.id,
          );
        case SupplierReservationAction.reportDriverNoShow:
          final deliveryId = reservation.activeDelivery?.id;
          if (deliveryId != null) {
            await handleReportDriverNoShow(
              context,
              ref,
              deliveryId: deliveryId,
            );
          }
        case SupplierReservationAction.markLearnerNoShow:
          final confirmed = await _confirm(
            title: context.l10n.supplierMarkLearnerNoShowTitle,
            message: context.l10n.supplierMarkLearnerNoShowMessage,
            confirmLabel: context.l10n.supplierMarkLearnerNoShowConfirm,
          );
          if (confirmed && mounted) {
            await markLearnerNoShowForRequest(ref, requestId: reservation.id);
          }
        case SupplierReservationAction.sendMessage:
        case SupplierReservationAction.unknown:
          break;
      }
      if (mounted) {
        ref.invalidate(supplierReservationDetailProvider(widget.reservationId));
      }
    } catch (error) {
      if (mounted) {
        final message = error is ApiException
            ? localizedApiErrorMessage(error, context.l10n)
            : context.l10n.supplierCouldNotUpdateRequest;
        setState(() => _actionError = message);
        showSupplierErrorSnackBar(context, message);
      }
    } finally {
      if (mounted) setState(() => _busyAction = null);
    }
  }

  Future<void> _sendMessage(SupplierReservationDetail detail) async {
    final body = _messageController.text.trim();
    if (body.isEmpty ||
        _busyAction != null ||
        !detail.reservation.availableActions.any(
          (action) => action.value == SupplierReservationAction.sendMessage,
        )) {
      return;
    }
    setState(() {
      _busyAction = 'SEND_MESSAGE';
      _actionError = null;
    });
    try {
      final message = await ref
          .read(supplierRequestsRepositoryProvider)
          .sendReservationMessage(detail.reservation.id, body);
      if (!mounted) return;
      setState(() {
        _localMessages.add(
          SupplierReservationMessageSummary(
            id: message.id,
            senderRole: 'SUPPLIER',
            senderId: message.sender.id,
            body: message.body,
            createdAt: message.createdAt,
          ),
        );
        _messageController.clear();
      });
      ref.invalidate(supplierReservationDetailProvider(widget.reservationId));
    } catch (error) {
      if (!mounted) return;
      final message = error is ApiException
          ? localizedApiErrorMessage(error, context.l10n)
          : context.l10n.supplierCouldNotSendMessage;
      setState(() => _actionError = message);
      showSupplierErrorSnackBar(context, message);
    } finally {
      if (mounted) setState(() => _busyAction = null);
    }
  }

  Future<bool> _confirm({
    required String title,
    required String message,
    required String confirmLabel,
  }) async {
    return await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: Text(title),
            content: Text(message),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: Text(context.s.cancel),
              ),
              FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: Text(confirmLabel),
              ),
            ],
          ),
        ) ??
        false;
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({
    required this.reservation,
    required this.materialTitle,
    required this.learnerName,
    required this.onBack,
    required this.actions,
    required this.busyAction,
    required this.onAction,
  });

  final SupplierIncomingRequest reservation;
  final String materialTitle;
  final String learnerName;
  final VoidCallback onBack;
  final List<SupplierReservationAction> actions;
  final String? busyAction;
  final ValueChanged<SupplierReservationAction> onAction;

  @override
  Widget build(BuildContext context) {
    final l = context.s;
    final ui = SupplierReservationUiHelpers.of(context);
    final colors = context.supplierColors;
    final image = reservation.materialImageUrl;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppBackBreadcrumb(
          onBack: onBack,
          ancestors: [
            AppBackBreadcrumbItem(
              label: l.incomingRequestsTitle,
              location: '/supplier/reservations',
            ),
          ],
          currentLabel: l.requestDetails,
        ),
        const SizedBox(height: AppSpacing.sm),
        AppSectionCard(
          emphasized: true,
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final narrow = constraints.maxWidth < 980;
              final identity = Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _MaterialImage(url: image, size: narrow ? 76 : 112),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(materialTitle, style: context.supplierTitle()),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          learnerName,
                          style: context.supplierBody().copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Wrap(
                          spacing: AppSpacing.xs,
                          runSpacing: AppSpacing.xs,
                          children: [
                            AppStatusBadge(
                              label: ui.reservationStatus(reservation),
                              tone: _statusTone(reservation.status),
                            ),
                            if (reservation.workflowPhase != null)
                              AppStatusBadge(
                                label: ui.workflowLabel(
                                  reservation.workflowPhase!.value,
                                ),
                                tone: AppStatusTone.info,
                              ),
                            if (reservation.attentionState != null)
                              AppStatusBadge(
                                label: ui.attentionLabel(
                                  reservation.attentionState!.value,
                                ),
                                tone: _attentionTone(
                                  reservation.attentionState!.value,
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          '${_quantity(reservation.quantityRequested)} ${reservation.unit}  ·  ${ui.fulfillmentMethodLabel(reservation)}  ·  ${l.createdLabel} ${ui.formatDateTime(reservation.requestedAt)}',
                          style: context.supplierLabel().copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              );
              return narrow
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        identity,
                        if (actions.isNotEmpty) ...[
                          const SizedBox(height: AppSpacing.md),
                          _HeaderActions(
                            actions: actions,
                            busyAction: busyAction,
                            onAction: onAction,
                          ),
                        ],
                      ],
                    )
                  : Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: identity),
                        if (actions.isNotEmpty) ...[
                          const SizedBox(width: AppSpacing.md),
                          _HeaderActions(
                            actions: actions,
                            busyAction: busyAction,
                            onAction: onAction,
                          ),
                        ],
                      ],
                    );
            },
          ),
        ),
      ],
    );
  }
}

class _HeaderActions extends StatelessWidget {
  const _HeaderActions({
    required this.actions,
    required this.busyAction,
    required this.onAction,
  });

  final List<SupplierReservationAction> actions;
  final String? busyAction;
  final ValueChanged<SupplierReservationAction> onAction;

  @override
  Widget build(BuildContext context) {
    final primary = actions.first;
    final busy = busyAction != null;
    return Wrap(
      alignment: WrapAlignment.end,
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        FilledButton.icon(
          onPressed: busy ? null : () => onAction(primary),
          icon: busy && busyAction == primary.name
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.check_circle_outline, size: 17),
          label: Text(_actionLabel(context,primary)),
        ),
        if (actions.length > 1)
          PopupMenuButton<SupplierReservationAction>(
            tooltip: context.l10n.supplierAvailableActions,
            onSelected: busy ? null : onAction,
            itemBuilder: (context) => actions
                .skip(1)
                .map(
                  (action) => PopupMenuItem(
                    value: action,
                    child: Text(_actionLabel(context,action)),
                  ),
                )
                .toList(),
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              decoration: BoxDecoration(
                border: Border.all(color: context.supplierColors.border),
                borderRadius: AppRadius.mdAll,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.more_horiz, size: 18),
                  SizedBox(width: AppSpacing.xs),
                  Text(context.l10n.supplierMore),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _StateStrip extends StatelessWidget {
  const _StateStrip({required this.detail});
  final SupplierReservationDetail detail;

  @override
  Widget build(BuildContext context) {
    final reservation = detail.reservation;
    final terminal = _isTerminalReservation(detail);
    final facts = terminal
        ? _terminalStateFacts(context, detail)
        : _activeStateFacts(
            context,
            detail,
            detail.schedule?.summary ?? reservation.scheduleSummary,
          );

    return AppSectionCard(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final narrow = constraints.maxWidth < 720;
          if (narrow) {
            final itemWidth = (constraints.maxWidth - AppSpacing.sm) / 2;
            return Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.md,
              children: facts
                  .map(
                    (fact) => SizedBox(
                      width: itemWidth,
                      child: _StateItem(fact: fact),
                    ),
                  )
                  .toList(),
            );
          }

          return Row(
            children: facts
                .map((fact) => Expanded(child: _StateItem(fact: fact)))
                .toList(),
          );
        },
      ),
    );
  }
}

class _StateItem extends StatelessWidget {
  const _StateItem({required this.fact});
  final _StateFact fact;

  @override
  Widget build(BuildContext context) => SizedBox(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(fact.label, style: context.supplierLabel().copyWith(fontSize: 11)),
        const SizedBox(height: 2),
        Text(
          fact.value,
          style: context.supplierBody().copyWith(fontWeight: FontWeight.w700),
        ),
      ],
    ),
  );
}

class _StateFact {
  const _StateFact(this.label, this.value);

  final String label;
  final String value;
}

List<_StateFact> _activeStateFacts(
  BuildContext context,
  SupplierReservationDetail detail,
  SupplierScheduleSummary? summary,
) {
  final l = context.l10n;
  final ui = SupplierReservationUiHelpers.of(context);
  final reservation = detail.reservation;
  final facts = <_StateFact>[];
  final workflow = ui.workflowLabel(reservation.workflowPhase?.value);
  final attention = ui.attentionLabel(reservation.attentionState?.value);
  final actor = reservation.nextActor?.value;
  final schedule = _effectiveScheduleWindow(summary);
  final emDash = ui.emDash;

  if (workflow != emDash) {
    facts.add(_StateFact(l.supplierWorkflowScheduling, workflow));
  }
  if (attention != emDash) {
    facts.add(_StateFact(l.supplierAttentionTitle, attention));
  }
  if (actor != null &&
      actor != SupplierNextActor.none &&
      actor != SupplierNextActor.unknown) {
    facts.add(_StateFact(l.supplierStatus, ui.actorLabel(actor)));
  }
  facts.add(
    _StateFact(
      l.supplierFulfillmentAndDelivery,
      ui.fulfillmentMethodLabel(reservation),
    ),
  );
  if (schedule != null) {
    facts.add(_StateFact(l.pickupWindow, ui.formatScheduleWindow(schedule)));
  }
  return facts;
}

List<_StateFact> _terminalStateFacts(
  BuildContext context,
  SupplierReservationDetail detail,
) {
  final l = context.l10n;
  final ui = SupplierReservationUiHelpers.of(context);
  final identity = detail.identity;
  final reservation = detail.reservation;
  final facts = <_StateFact>[
    _StateFact(
      l.statusCompleted,
      ui.terminalOutcome(reservation.status) ?? ui.emDash,
    ),
    _StateFact(
      l.supplierFulfillmentAndDelivery,
      ui.fulfillmentMethodLabel(reservation),
    ),
  ];
  final created = identity?.createdAt ?? reservation.requestedAt;
  final updated = identity?.updatedAt;
  facts.add(_StateFact(l.supplierCreated, ui.formatDateTime(created)));
  if (updated != null) {
    facts.add(_StateFact(l.supplierUpdated, ui.formatDateTime(updated)));
  }
  return facts.take(4).toList(growable: false);
}

class _ActionPanel extends StatelessWidget {
  const _ActionPanel({
    required this.actions,
    required this.busyAction,
    required this.error,
    required this.onAction,
  });

  final List<SupplierReservationAction> actions;
  final String? busyAction;
  final String? error;
  final ValueChanged<SupplierReservationAction> onAction;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return AppSectionCard(
    tone: AppStatusTone.warning,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l.supplierAvailableActions, style: context.supplierSectionTitle()),
        const SizedBox(height: AppSpacing.md),
        ...actions.map(
          (action) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: OutlinedButton.icon(
              onPressed: busyAction == null ? () => onAction(action) : null,
              icon: Icon(_actionIcon(action), size: 18),
              label: Align(
                alignment: AlignmentDirectional.centerStart,
                child: Text(_actionLabel(context,action)),
              ),
            ),
          ),
        ),
        if (error != null)
          Text(
            error!,
            style: context.supplierBody().copyWith(
              color: context.supplierColors.error,
            ),
          ),
      ],
    ),
  );
  }
}

class _RequestSummaryCard extends StatelessWidget {
  const _RequestSummaryCard({
    required this.detail,
    required this.materialTitle,
    required this.learnerName,
  });

  final SupplierReservationDetail detail;
  final String materialTitle;
  final String learnerName;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final reservation = detail.reservation;
    final request = detail.request;
    final identity = detail.identity;
    final note = request?.originalLearnerNote ?? reservation.learnerNote;
    final material = detail.identity?.material;
    final learner = detail.identity?.learner;
    return AppSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _TitleRow(icon: Icons.assignment_outlined, title: l.supplierRequestSummary),
          const SizedBox(height: AppSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _MaterialImage(
                url:
                    _string(material, 'imageUrl') ??
                    reservation.materialImageUrl,
                size: 74,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      materialTitle,
                      style: context.supplierBody().copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      l.supplierLearnerLine(learnerName),
                      style: context.supplierBody(),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _InfoGrid(
            rows: [
              (
                l.supplierQuantity,
                '${_quantity(identity?.quantityRequested ?? reservation.quantityRequested)} ${reservation.unit}',
              ),
              (l.supplierFulfillmentLabel, _fulfillmentLabel(context, reservation)),
              (
                l.supplierCreated,
                _date(context, identity?.createdAt ?? reservation.requestedAt),
              ),
              (l.supplierUpdated, _date(context, identity?.updatedAt)),
              if (_string(learner, 'email') != null)
                (l.supplierLearnerEmail, _string(learner, 'email')!),
            ],
          ),
          if (note != null && note.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            _NoteBlock(label: l.supplierOriginalLearnerNote, text: note),
          ],
          if (request?.deliveryAddressText != null &&
              request!.deliveryAddressText!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            _NoteBlock(
              label: l.supplierDeliveryAddressLabel,
              text: request.deliveryAddressText!,
            ),
          ],
        ],
      ),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  const _ScheduleCard({required this.detail});
  final SupplierReservationDetail detail;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    if (_isTerminalReservation(detail)) {
      return _TerminalScheduleCard(detail: detail);
    }

    final schedule = detail.schedule;
    final summary = schedule?.summary ?? detail.reservation.scheduleSummary;
    final delivery = detail.reservation.isDeliveryFulfillment;
    final supplierProposal = _completeWindow(schedule?.supplierProposal);
    final learnerProposal = _completeWindow(schedule?.learnerProposal);
    final confirmedPickup = _completeWindow(schedule?.confirmedPickupWindow);
    final supplierDeliveryPickup = _completeWindow(
      schedule?.supplierDeliveryPickupWindow,
    );
    final confirmedDelivery = _completeWindow(
      schedule?.confirmedDeliveryWindow,
    );
    final pendingReschedule = summary?.pendingReschedule;
    final pendingWindow = _completeWindow(
      pendingReschedule?.proposedPickupWindow,
    );
    final windows = <_WindowRow>[
      if (!delivery &&
          detail.request?.learnerPreferredPickupWindows.any(
                _hasPreferredWindow,
              ) ==
              true)
        _WindowRow(
          label: l.supplierLearnerPreferredPickupWindows,
          windows: detail.request!.learnerPreferredPickupWindows
              .map(
                (window) => SupplierScheduleWindow(
                  start: window.start,
                  end: window.end,
                ),
              )
              .where(_hasCompleteScheduleWindow)
              .toList(),
        ),
      if (delivery &&
          detail.request?.learnerPreferredDeliveryWindows.any(
                _hasPreferredWindow,
              ) ==
              true)
        _WindowRow(
          label: l.supplierLearnerPreferredDeliveryWindows,
          windows: detail.request!.learnerPreferredDeliveryWindows
              .map(
                (window) => SupplierScheduleWindow(
                  start: window.start,
                  end: window.end,
                ),
              )
              .where(_hasCompleteScheduleWindow)
              .toList(),
        ),
      if (supplierProposal != null)
        _WindowRow(label: l.supplierSupplierProposal, windows: [supplierProposal]),
      if (learnerProposal != null)
        _WindowRow(label: l.supplierLearnerProposal, windows: [learnerProposal]),
      if (!delivery && confirmedPickup != null)
        _WindowRow(
          label: l.supplierConfirmedPickupWindow,
          windows: [confirmedPickup],
        ),
      if (delivery && supplierDeliveryPickup != null)
        _WindowRow(
          label: l.supplierSupplierDeliveryPickupWindow,
          windows: [supplierDeliveryPickup],
        ),
      if (delivery && confirmedDelivery != null)
        _WindowRow(
          label: l.supplierConfirmedDeliveryWindow,
          windows: [confirmedDelivery],
        ),
      if (pendingReschedule != null && pendingWindow != null)
        _WindowRow(
          label: l.supplierActorRequestedReschedule(
            _actorLabel(context, pendingReschedule.requestedBy.value),
          ),
          windows: [pendingWindow],
        ),
    ];
    final recovery = summary?.recoveryContext;
    final showRecovery =
        recovery != null &&
        (_nonEmpty(recovery.note) != null ||
            _nonEmpty(recovery.reason) != null);
    final pending = summary?.pendingReschedule;
    final showPending =
        pending != null &&
        (_hasCompleteScheduleWindow(pending.proposedPickupWindow) ||
            _nonEmpty(pending.note) != null ||
            _nonEmpty(pending.reason) != null);

    return AppSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _TitleRow(
            icon: Icons.calendar_month_outlined,
            title: l.supplierScheduleNegotiation,
          ),
          const SizedBox(height: AppSpacing.sm),
          if (showRecovery)
            _ContextBanner(
              label: l.supplierAdminInitiatedRecovery,
              value: _nonEmpty(recovery.note) ?? _nonEmpty(recovery.reason)!,
              tone: AppStatusTone.warning,
            ),
          if (showPending) ...[
            const SizedBox(height: AppSpacing.sm),
            _ContextBanner(
              label: l.supplierPendingReschedule,
              value:
                  _nonEmpty(pending.note) ??
                  _nonEmpty(pending.reason) ??
                  l.supplierNewWindowAwaiting,
              tone: AppStatusTone.info,
            ),
          ],
          if (windows.isEmpty)
            _EmptyLine(
              text: l.supplierNoWindowProposed,
            ),
          ...windows.map((row) => _WindowSection(row: row)),
          if (_nonEmpty(summary?.schedulingConflictReason) != null) ...[
            const SizedBox(height: AppSpacing.sm),
            _ContextBanner(
              label: l.supplierSchedulingContext,
              value: _nonEmpty(summary!.schedulingConflictReason)!,
              tone: AppStatusTone.warning,
            ),
          ],
          if (summary?.earliestDeliveryStart != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              l.supplierEarliestFeasibleDelivery(
                _date(context, summary!.earliestDeliveryStart),
              ),
              style: context.supplierLabel(),
            ),
          ],
        ],
      ),
    );
  }
}

class _TerminalScheduleCard extends StatelessWidget {
  const _TerminalScheduleCard({required this.detail});

  final SupplierReservationDetail detail;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final schedule = detail.schedule;
    final delivery = detail.reservation.isDeliveryFulfillment;
    final confirmedPickup = _completeWindow(schedule?.confirmedPickupWindow);
    final supplierDeliveryPickup = _completeWindow(
      schedule?.supplierDeliveryPickupWindow,
    );
    final confirmedDelivery = _completeWindow(
      schedule?.confirmedDeliveryWindow,
    );
    final historicalWindows = <_WindowRow>[
      if (!delivery && confirmedPickup != null)
        _WindowRow(
          label: l.supplierConfirmedPickupWindow,
          windows: [confirmedPickup],
        ),
      if (delivery && supplierDeliveryPickup != null)
        _WindowRow(
          label: l.supplierSupplierDeliveryPickupWindow,
          windows: [supplierDeliveryPickup],
        ),
      if (delivery && confirmedDelivery != null)
        _WindowRow(
          label: l.supplierConfirmedDeliveryWindow,
          windows: [confirmedDelivery],
        ),
    ];
    final emptyMessage = delivery
        ? l.supplierNoWindowConfirmedPickup
        : l.supplierNoWindowConfirmedBeforeTerminal(
            _terminalVerb(context, detail.reservation),
          );

    return AppSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _TitleRow(icon: Icons.history_outlined, title: l.supplierScheduleHistory),
          const SizedBox(height: AppSpacing.sm),
          if (historicalWindows.isEmpty)
            _EmptyLine(text: emptyMessage)
          else ...[
            ...historicalWindows.map((row) => _WindowSection(row: row)),
            const SizedBox(height: AppSpacing.sm),
            _InfoGrid(
              rows: [(l.supplierOutcomeLabel, _terminalScheduleOutcome(context, detail.reservation))],
            ),
          ],
        ],
      ),
    );
  }
}

class _FulfillmentCard extends ConsumerWidget {
  const _FulfillmentCard({required this.detail});
  final SupplierReservationDetail detail;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = context.l10n;
    final reservation = detail.reservation;
    final delivery = detail.delivery ?? reservation.deliverySummary;
    final driver = delivery?.driver;
    final fulfillment =
        detail.request?.fulfillmentMethod ?? reservation.fulfillmentMethod;
    final showHandover = reservation.shouldShowSupplierHandoverCode;
    final materialTitle = _materialTitle(detail);

    return AppSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _TitleRow(
            icon: Icons.local_shipping_outlined,
            title: l.supplierFulfillmentAndDelivery,
          ),
          const SizedBox(height: AppSpacing.md),
          _InfoGrid(
            rows: [
              (l.supplierMethodLabel, _fulfillmentLabel(context, reservation)),
              (
                l.supplierDeliveryStatusLabel,
                delivery?.status == null
                    ? l.notSelected
                    : _deliveryStatusLabel(context, delivery!.status!),
              ),
              if (driver?.displayName != null) (l.driver, driver!.displayName!),
            ],
          ),
          if (showHandover) ...[
            const SizedBox(height: AppSpacing.md),
            DecoratedBox(
              decoration: BoxDecoration(
                color: context.supplierColors.accentSoft.withValues(alpha: 0.16),
                borderRadius: AppRadius.mdAll,
                border: Border.all(
                  color: context.supplierColors.border.withValues(alpha: 0.24),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      l.driverPickupVerification,
                      style: context.supplierSectionTitle().copyWith(
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l.driverPickupVerificationBody,
                      style: context.supplierBody().copyWith(
                        color: context.supplierColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    HandoverConfirmationCodePanel(
                      code: reservation.supplierHandoverCode!,
                      instructions: l.supplierDriverHandoverCodeInstructions,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    OutlinedButton.icon(
                      onPressed: () => showSupplierDriverPickupHandoverQrDialog(
                        context: context,
                        ref: ref,
                        reservationId: reservation.id,
                        materialTitle: materialTitle,
                      ),
                      icon: const Icon(Icons.qr_code_2_outlined, size: 18),
                      label: Text(l.showPickupQr),
                    ),
                  ],
                ),
              ),
            ),
          ],
          if (delivery?.failureReason != null) ...[
            const SizedBox(height: AppSpacing.md),
            _ContextBanner(
              label: l.supplierFailureRecovery,
              value: delivery!.failureReason!,
              tone: AppStatusTone.danger,
            ),
          ],
          if (detail.request?.deliveryNote != null &&
              detail.request!.deliveryNote!.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            _NoteBlock(
              label: l.supplierDeliveryNote,
              text: detail.request!.deliveryNote!,
            ),
          ],
          if (fulfillment.toUpperCase() == 'DELIVERY' && delivery == null)
            _EmptyLine(
              text: l.supplierDeliveryNotCreated,
            ),
        ],
      ),
    );
  }
}

class _AttentionCard extends StatelessWidget {
  const _AttentionCard({required this.reservation});
  final SupplierIncomingRequest reservation;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return AppSectionCard(
    tone: _attentionTone(reservation.attentionState?.value),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TitleRow(icon: Icons.priority_high_outlined, title: l.supplierAttentionTitle),
        const SizedBox(height: AppSpacing.sm),
        Text(
          _attentionLabel(context, reservation.attentionState?.value),
          style: context.supplierTitle().copyWith(fontSize: 18),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          l.supplierNextActorLine(
            _actorLabel(context, reservation.nextActor?.value),
          ),
          style: context.supplierBody().copyWith(
            color: context.supplierColors.textSecondary,
          ),
        ),
        if (reservation.attentionState?.value ==
            SupplierAttentionState.adminReviewRequired) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            l.supplierAwaitingAdminResolution,
            style: context.supplierBody(),
          ),
        ],
      ],
    ),
  );
  }
}

class _IncidentCard extends StatelessWidget {
  const _IncidentCard({required this.incident});
  final SupplierIncidentSummary incident;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return AppSectionCard(
    tone: AppStatusTone.info,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TitleRow(
          icon: Icons.shield_outlined,
          title: l.supplierIncidentAdminReview,
        ),
        const SizedBox(height: AppSpacing.md),
        _InfoGrid(
          rows: [
            if (incident.reasonCode != null)
              (l.reason, _reasonLabel(context, incident.reasonCode!)),
            if (incident.status != null)
              (l.supplierStatus, _reasonLabel(context, incident.status!)),
            if (incident.workflowType != null)
              (l.supplierWorkflowField, _reasonLabel(context, incident.workflowType!)),
            if (incident.operationalState != null)
              (l.supplierOperationalStateLabel, _reasonLabel(context, incident.operationalState!)),
          ],
        ),
        if (incident.note != null && incident.note!.trim().isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          _NoteBlock(label: l.supplierSupplierExplanation, text: incident.note!),
        ],
        if (incident.reviewNote != null &&
            incident.reviewNote!.trim().isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          _NoteBlock(label: l.supplierAdminReviewNote, text: incident.reviewNote!),
        ],
      ],
    ),
  );
  }
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.group});
  final SupplierGroupSummary group;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return AppSectionCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TitleRow(icon: Icons.account_tree_outlined, title: l.supplierGroupContext),
        const SizedBox(height: AppSpacing.md),
        _InfoGrid(
          rows: [
            if (group.status != null) (l.supplierStatus, _reasonLabel(context, group.status!)),
            if (group.itemCount != null) (l.supplierItemsLabel, '${group.itemCount}'),
            if (group.driver?.displayName != null)
              (l.driver, group.driver!.displayName!),
          ],
        ),
        if (group.items.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(l.supplierItemsInGroup, style: context.supplierLabel()),
          const SizedBox(height: AppSpacing.xs),
          ...group.items
              .take(3)
              .map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: Text(
                    _string(item, 'materialTitle') ??
                        _string(item, 'title') ??
                        l.supplierGroupedReservationItem,
                    style: context.supplierBody(),
                  ),
                ),
              ),
          if (group.hasMoreItems == true)
            Text(
              l.supplierMoreGroupItems,
              style: context.supplierLabel(),
            ),
        ],
      ],
    ),
  );
  }
}

class _MessagesCard extends StatelessWidget {
  const _MessagesCard({
    super.key,
    required this.detail,
    required this.learnerName,
    required this.controller,
    required this.focusNode,
    required this.localMessages,
    required this.onSend,
    required this.sending,
  });

  final SupplierReservationDetail detail;
  final String learnerName;
  final TextEditingController controller;
  final FocusNode focusNode;
  final List<SupplierReservationMessageSummary> localMessages;
  final VoidCallback onSend;
  final bool sending;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final original = detail.request?.originalLearnerNote?.trim();
    final messages = [...detail.messages, ...localMessages].where((message) {
      if (original == null ||
          detail.reservation.messageSummary?.matchesOriginalLearnerNote != true)
        return true;
      return message.body?.trim() != original;
    }).toList();
    messages.sort(
      (a, b) =>
          (a.createdAt ?? DateTime(0)).compareTo(b.createdAt ?? DateTime(0)),
    );
    final canSend = detail.reservation.availableActions.any(
      (action) => action.value == SupplierReservationAction.sendMessage,
    );

    return AppSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _TitleRow(
            icon: Icons.chat_bubble_outline,
            title: messages.isEmpty
                ? l.supplierMessagesTitle
                : l.supplierMessagesTitleWithCount(messages.length),
          ),
          const SizedBox(height: AppSpacing.md),
          if (messages.isEmpty)
            _EmptyLine(text: l.supplierNoMessagesYet)
          else
            ...messages.map(
              (message) =>
                  _MessageBubble(message: message, learnerName: learnerName),
            ),
          if (canSend) ...[
            const SizedBox(height: AppSpacing.md),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: controller,
                    focusNode: focusNode,
                    maxLines: 3,
                    minLines: 1,
                    maxLength: 1000,
                    decoration: InputDecoration(
                      hintText: l.supplierTypeMessageHint,
                    ),
                    onSubmitted: (_) => onSend(),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                IconButton.filled(
                  onPressed: sending ? null : onSend,
                  tooltip: l.supplierSendMessageTooltip,
                  icon: sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send_outlined),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, required this.learnerName});
  final SupplierReservationMessageSummary message;
  final String learnerName;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final learner = message.senderRole?.toUpperCase() == 'LEARNER';
    final sender = learner ? learnerName : l.supplierYou;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: learner
              ? context.supplierColors.surface
              : context.supplierColors.accentSoft.withValues(alpha: .35),
          borderRadius: AppRadius.mdAll,
          border: Border.all(
            color: context.supplierColors.border.withValues(alpha: .6),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: AppSpacing.sm,
              runSpacing: 2,
              children: [
                Text(
                  sender,
                  style: context.supplierLabel().copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  learner ? l.learner : l.supplier,
                  style: context.supplierLabel().copyWith(
                    color: context.supplierColors.textSecondary,
                  ),
                ),
                Text(
                  _date(context, message.createdAt),
                  style: context.supplierLabel().copyWith(
                    color: context.supplierColors.textMuted,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(message.body ?? '', style: context.supplierBody()),
          ],
        ),
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.history});
  final List<SupplierReservationHistoryEntry> history;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return AppSectionCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TitleRow(icon: Icons.history_outlined, title: l.supplierReservationHistory),
        const SizedBox(height: AppSpacing.md),
        if (history.isEmpty)
          _EmptyLine(text: l.supplierNoHistoryEvents)
        else
          ...history.map((event) => _HistoryEvent(event: event)),
      ],
    ),
  );
  }
}

class _HistoryEvent extends StatelessWidget {
  const _HistoryEvent({required this.event});
  final SupplierReservationHistoryEntry event;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final actor = _string(event.actor, 'displayName') ?? _actorLabel(context, null);
    final role = _string(event.actor, 'role');
    final transition = event.newStatus == null
        ? l.supplierReservationUpdated
        : l.supplierHistoryStatusChange(
            _reasonLabel(context, event.oldStatus ?? 'Request'),
            _reasonLabel(context, event.newStatus!),
          );
    final noteLabel = supplierReservationHistoryNoteLabel(l, event);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.radio_button_checked,
            size: 16,
            color: context.supplierColors.accent,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  transition,
                  style: context.supplierBody().copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$actor${role == null ? '' : ' · ${_reasonLabel(context, role)}'} · ${_date(context, event.createdAt)}',
                  style: context.supplierLabel().copyWith(
                    color: context.supplierColors.textSecondary,
                  ),
                ),
                if (noteLabel != null && noteLabel.isNotEmpty)
                  Text(noteLabel, style: context.supplierLabel()),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TitleRow extends StatelessWidget {
  const _TitleRow({required this.icon, required this.title});
  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(icon, size: 21, color: context.supplierColors.accent),
      const SizedBox(width: AppSpacing.sm),
      Expanded(child: Text(title, style: context.supplierSectionTitle())),
    ],
  );
}

class _InfoGrid extends StatelessWidget {
  const _InfoGrid({required this.rows});
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) => Column(
    children: rows
        .map(
          (row) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 132,
                  child: Text(
                    row.$1,
                    style: context.supplierLabel().copyWith(
                      color: context.supplierColors.textSecondary,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    row.$2,
                    style: context.supplierBody().copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        )
        .toList(),
  );
}

class _NoteBlock extends StatelessWidget {
  const _NoteBlock({required this.label, required this.text});
  final String label;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(AppSpacing.md),
    decoration: BoxDecoration(
      color: context.supplierColors.surface,
      borderRadius: AppRadius.mdAll,
      border: Border.all(
        color: context.supplierColors.border.withValues(alpha: .55),
      ),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: context.supplierLabel().copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(text, style: context.supplierBody()),
      ],
    ),
  );
}

class _ContextBanner extends StatelessWidget {
  const _ContextBanner({
    required this.label,
    required this.value,
    required this.tone,
  });
  final String label;
  final String value;
  final AppStatusTone tone;

  @override
  Widget build(BuildContext context) {
    final style = AppStatusStyle.of(context, tone);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: style.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: context.supplierLabel().copyWith(
              color: style.foreground,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 3),
          Text(value, style: context.supplierBody()),
        ],
      ),
    );
  }
}

class _WindowRow {
  const _WindowRow({required this.label, required this.windows});
  final String label;
  final List<SupplierScheduleWindow> windows;
}

class _WindowSection extends StatelessWidget {
  const _WindowSection({required this.row});
  final _WindowRow row;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: AppSpacing.sm),
    child: Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: context.supplierColors.surface,
        borderRadius: AppRadius.mdAll,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            row.label,
            style: context.supplierLabel().copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          ...row.windows
              .where((window) => window.start != null || window.end != null)
              .map(
                (window) => Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(_window(context, window), style: context.supplierBody()),
                ),
              ),
        ],
      ),
    ),
  );
}

class _EmptyLine extends StatelessWidget {
  const _EmptyLine({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Text(
    text,
    style: context.supplierBody().copyWith(
      color: context.supplierColors.textSecondary,
    ),
  );
}

class _MaterialImage extends StatelessWidget {
  const _MaterialImage({required this.url, required this.size});
  final String? url;
  final double size;

  @override
  Widget build(BuildContext context) {
    final imageUrl = url?.trim();
    return ClipRRect(
      borderRadius: AppRadius.mdAll,
      child: SizedBox(
        width: size,
        height: size,
        child: imageUrl == null || imageUrl.isEmpty
            ? ColoredBox(
                color: context.supplierColors.surface,
                child: Icon(
                  Icons.inventory_2_outlined,
                  color: context.supplierColors.textMuted,
                  size: size * .38,
                ),
              )
            : Image.network(
                ApiConfig.resolveMediaUrl(imageUrl),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => ColoredBox(
                  color: context.supplierColors.surface,
                  child: Icon(
                    Icons.inventory_2_outlined,
                    color: context.supplierColors.textMuted,
                    size: size * .38,
                  ),
                ),
              ),
      ),
    );
  }
}

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton();
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const SizedBox(height: 48),
      _SkeletonBox(height: 140),
      const SizedBox(height: AppSpacing.md),
      _SkeletonBox(height: 60),
      const SizedBox(height: AppSpacing.lg),
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              children: [
                const _SkeletonBox(height: 220),
                const SizedBox(height: AppSpacing.md),
                const _SkeletonBox(height: 280),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          const Expanded(child: _SkeletonBox(height: 420)),
        ],
      ),
    ],
  );
}

class _SkeletonBox extends StatelessWidget {
  const _SkeletonBox({required this.height});
  final double height;
  @override
  Widget build(BuildContext context) => AppSectionCard(
    child: SizedBox(
      height: height,
      child: const Center(child: CircularProgressIndicator()),
    ),
  );
}

class _DetailError extends StatelessWidget {
  const _DetailError({
    required this.notFound,
    required this.onBack,
    required this.onRetry,
  });
  final bool notFound;
  final VoidCallback onBack;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    return AppSectionCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(
          notFound ? Icons.search_off_outlined : Icons.cloud_off_outlined,
          size: 40,
          color: context.supplierColors.textSecondary,
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          notFound ? l.supplierRequestNotFound : l.supplierCouldNotLoadRequestTitle,
          textAlign: TextAlign.center,
          style: context.supplierTitle(),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          notFound
              ? l.supplierRequestUnavailable
              : l.supplierCouldNotLoadRequest,
          textAlign: TextAlign.center,
          style: context.supplierBody(),
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: AppSpacing.sm,
          children: [
            OutlinedButton(
              onPressed: onBack,
              child: Text(l.supplierBackToIncomingRequests),
            ),
            if (!notFound)
              FilledButton(onPressed: onRetry, child: Text(l.retry)),
          ],
        ),
      ],
    ),
  );
  }
}

bool _isNotFound(Object error) =>
    error is ApiException &&
    (error.statusCode == 403 || error.statusCode == 404);

String _materialTitle(SupplierReservationDetail detail) =>
    _string(detail.identity?.material, 'title') ??
    _string(detail.identity?.material, 'name') ??
    detail.reservation.materialTitle;

String _learnerName(SupplierReservationDetail detail) =>
    _string(detail.identity?.learner, 'displayName') ??
    _string(detail.identity?.learner, 'name') ??
    detail.reservation.learnerName;

String? _string(Map<String, dynamic>? map, String key) => map?[key] as String?;

String? _nonEmpty(String? value) =>
    value == null || value.trim().isEmpty ? null : value.trim();

String _quantity(double value) => value == value.roundToDouble()
    ? value.toInt().toString()
    : value.toStringAsFixed(2);

String _date(BuildContext context, DateTime? value) =>
    SupplierReservationUiHelpers.of(context).formatDateTime(value);

String _window(BuildContext context, SupplierScheduleWindow window) =>
    SupplierReservationUiHelpers.of(context).formatScheduleWindow(window);

String _fulfillmentLabel(
  BuildContext context,
  SupplierIncomingRequest reservation,
) => SupplierReservationUiHelpers.of(context).fulfillmentMethodLabel(
  reservation,
);

String _stateFulfillmentLabel(
  BuildContext context,
  SupplierIncomingRequest reservation,
) => SupplierReservationUiHelpers.of(context).fulfillmentMethodLabel(
  reservation,
);

String _terminalOutcomeLabel(
  BuildContext context,
  SupplierIncomingRequest reservation,
) => SupplierReservationUiHelpers.of(context).terminalOutcome(reservation.status);

String _terminalScheduleOutcome(
  BuildContext context,
  SupplierIncomingRequest reservation,
) => SupplierReservationUiHelpers.of(context).terminalScheduleOutcome(reservation);

String _terminalVerb(
  BuildContext context,
  SupplierIncomingRequest reservation,
) => SupplierReservationUiHelpers.of(context).terminalVerb(reservation.status);

String _workflowLabel(BuildContext context, SupplierWorkflowPhase? phase) =>
    SupplierReservationUiHelpers.of(context).workflowLabel(phase);

String _attentionLabel(BuildContext context, SupplierAttentionState? attention) =>
    SupplierReservationUiHelpers.of(context).attentionLabel(attention);

String _actorLabel(BuildContext context, SupplierNextActor? actor) =>
    SupplierReservationUiHelpers.of(context).actorLabel(actor);

String _reasonLabel(BuildContext context, String raw) =>
    SupplierReservationUiHelpers.of(context).reasonCodeLabel(raw);

String _deliveryStatusLabel(BuildContext context, String raw) =>
    SupplierReservationUiHelpers.of(context).deliveryStatus(raw);

String _actionLabel(BuildContext context, SupplierReservationAction action) =>
    SupplierReservationUiHelpers.of(context).reservationActionLabel(action);

bool _isTerminalReservation(SupplierReservationDetail detail) {
  final reservation = detail.reservation;
  return reservation.attentionState?.value == SupplierAttentionState.terminal ||
      reservation.workflowPhase?.value == SupplierWorkflowPhase.completed ||
      reservation.workflowPhase?.value == SupplierWorkflowPhase.closed;
}

SupplierScheduleWindow? _effectiveScheduleWindow(
  SupplierScheduleSummary? summary,
) {
  if (_hasCompleteScheduleWindow(summary?.effectiveWindow)) {
    return summary!.effectiveWindow;
  }
  final pending = summary?.pendingReschedule?.proposedPickupWindow;
  return _hasCompleteScheduleWindow(pending) ? pending : null;
}

bool _hasCompleteScheduleWindow(SupplierScheduleWindow? window) =>
    window?.start != null && window?.end != null;

SupplierScheduleWindow? _completeWindow(SupplierScheduleWindow? window) =>
    _hasCompleteScheduleWindow(window) ? window : null;

bool _hasPreferredWindow(dynamic window) =>
    window.start != null && window.end != null;

AppStatusTone _statusTone(SupplierIncomingRequestStatus status) =>
    switch (status) {
      SupplierIncomingRequestStatus.completed ||
      SupplierIncomingRequestStatus.accepted => AppStatusTone.success,
      SupplierIncomingRequestStatus.declined ||
      SupplierIncomingRequestStatus.cancelled ||
      SupplierIncomingRequestStatus.expired ||
      SupplierIncomingRequestStatus.noShow ||
      SupplierIncomingRequestStatus.fulfillmentFailed => AppStatusTone.danger,
      SupplierIncomingRequestStatus.needsResolution => AppStatusTone.info,
      _ => AppStatusTone.warning,
    };

AppStatusTone _attentionTone(SupplierAttentionState? attention) =>
    switch (attention) {
      SupplierAttentionState.adminReviewRequired => AppStatusTone.info,
      SupplierAttentionState.supplierActionRequired => AppStatusTone.warning,
      SupplierAttentionState.fulfillmentInProgress => AppStatusTone.primary,
      SupplierAttentionState.terminal => AppStatusTone.success,
      _ => AppStatusTone.neutral,
    };

IconData _actionIcon(SupplierReservationAction action) => switch (action) {
  SupplierReservationAction.accept ||
  SupplierReservationAction.acceptLearnerReschedule =>
    Icons.check_circle_outline,
  SupplierReservationAction.decline => Icons.close,
  SupplierReservationAction.sendMessage => Icons.chat_bubble_outline,
  SupplierReservationAction.completeSelfPickup => Icons.task_alt,
  SupplierReservationAction.proposeReschedule ||
  SupplierReservationAction.submitRecoveryPickupWindow =>
    Icons.schedule_outlined,
  SupplierReservationAction.closeReservation => Icons.archive_outlined,
  SupplierReservationAction.markLearnerNoShow ||
  SupplierReservationAction.reportDriverNoShow => Icons.person_off_outlined,
  SupplierReservationAction.reportIncident ||
  SupplierReservationAction.reportNoDriver => Icons.warning_amber_outlined,
  SupplierReservationAction.markDeliveryPickupExpired =>
    Icons.timer_off_outlined,
  SupplierReservationAction.unknown => Icons.more_horiz,
};
