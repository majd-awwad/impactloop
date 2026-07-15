import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../controllers/supplier_requests_providers.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/accept_incoming_request_dialog.dart';
import '../widgets/complete_pickup_dialog.dart';
import '../widgets/decline_incoming_request_dialog.dart';
import '../widgets/incoming_request_card.dart';
import '../widgets/reservation_follow_up_flow.dart';
import '../widgets/supplier_delivery_incident_flow.dart';
import '../widgets/supplier_feedback.dart';

const _contentMaxWidth = 1440.0;
const _deliveryHandledCompleteMessage =
    'This reservation is handled by delivery. The driver will mark it completed.';

bool _isDeliveryCompleteConflict(Object error) =>
    error is ApiException &&
    error.statusCode == 409 &&
    error.message.toLowerCase().contains('self-pickup');

class SupplierIncomingRequestsPage extends ConsumerStatefulWidget {
  const SupplierIncomingRequestsPage({
    super.key,
    this.initialTab,
    this.focusReservationId,
  });

  final String? initialTab;
  final String? focusReservationId;

  @override
  ConsumerState<SupplierIncomingRequestsPage> createState() =>
      _SupplierIncomingRequestsPageState();
}

class _SupplierIncomingRequestsPageState
    extends ConsumerState<SupplierIncomingRequestsPage> {
  final _searchController = TextEditingController();
  bool _initialTabApplied = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _applyInitialTab());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant SupplierIncomingRequestsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialTab != widget.initialTab) {
      _initialTabApplied = false;
      WidgetsBinding.instance.addPostFrameCallback((_) => _applyInitialTab());
    }
  }

  void _applyInitialTab() {
    if (_initialTabApplied || widget.initialTab == null) return;
    final current = ref.read(incomingRequestTabProvider);
    final value = widget.initialTab!.trim().toLowerCase();
    final next = switch (value) {
      'pending' => current.copyWith(status: 'PENDING', page: 1),
      'needs_learner' || 'needslearner' => current.copyWith(
        attentionState: 'WAITING_FOR_LEARNER',
        page: 1,
      ),
      'accepted' => current.copyWith(status: 'ACCEPTED', page: 1),
      'completed' => current.copyWith(status: 'COMPLETED', page: 1),
      'cancelled' => current.copyWith(status: 'CANCELLED', page: 1),
      _ => current,
    };
    ref.read(incomingRequestTabProvider.notifier).update(next);
    _initialTabApplied = true;
  }

  void _setQuery(SupplierRequestInboxQuery query) {
    ref.read(incomingRequestTabProvider.notifier).update(query);
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(incomingRequestTabProvider);
    final requestsAsync = ref.watch(incomingRequestsProvider);
    final compact = MediaQuery.sizeOf(context).width < 1100;

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _contentMaxWidth),
        child: SingleChildScrollView(
          padding: context.supplierDecorations.pagePadding(compact: compact).add(
            const EdgeInsets.only(top: AppSpacing.lg),
          ),
          child: requestsAsync.when(
            loading: () => const _InboxLoading(),
            error: (_, _) => _InboxError(
              onRetry: () => ref.invalidate(incomingRequestsProvider),
            ),
            data: (response) {
              final total = response.pagination?.total ?? response.summary?.total ?? 0;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _OperationalIntroduction(total: total),
                  const SizedBox(height: AppSpacing.sm),
                  _OperationalSummary(summary: response.summary),
                  const SizedBox(height: AppSpacing.md),
                  _FilterPanel(
                    query: query,
                    summary: response.summary,
                    searchController: _searchController,
                    onChanged: _setQuery,
                    onReset: () {
                      _searchController.clear();
                      ref.read(incomingRequestTabProvider.notifier).reset();
                    },
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _ResultsHeader(
                    query: query,
                    pagination: response.pagination,
                    onChanged: _setQuery,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  _RequestList(
                    requests: response.items,
                    query: query,
                    pagination: response.pagination,
                    onQueryChanged: _setQuery,
                    onReset: () {
                      _searchController.clear();
                      ref.read(incomingRequestTabProvider.notifier).reset();
                    },
                    cardFor: (request) => _requestCard(context, request),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _requestCard(BuildContext context, SupplierIncomingRequest request) {
    final primary = _primaryAction(request);
    return IncomingRequestCard(
      request: request,
      primaryLabel: primary?.label,
      onPrimaryAction: primary?.onPressed,
      onView: () => context.push(
        '/supplier/reservations/${Uri.encodeComponent(request.id)}',
      ),
    );
  }

  _InboxAction? _primaryAction(SupplierIncomingRequest request) {
    final actions = request.availableActions.where((item) => item.isExecutable).toList();
    if (request.isReadOnlyFinalState || actions.isEmpty) return null;
    if (actions.length > 1) {
      return _InboxAction('Review request', () => _openRequestActions(context, request));
    }
    return switch (actions.single.value) {
      SupplierReservationAction.completeSelfPickup => _InboxAction(
        'Confirm pickup',
        () => _handleComplete(context, request),
      ),
      SupplierReservationAction.acceptLearnerReschedule => _InboxAction(
        'Review reschedule',
        () => handleAcceptLearnerReschedule(context, ref, reservationId: request.id),
      ),
      SupplierReservationAction.proposeReschedule => _InboxAction(
        'Submit pickup window',
        () => handleRequestReschedulePickup(
          context,
          ref,
          reservationId: request.id,
          materialTitle: request.materialTitle,
          learnerName: request.learnerName,
        ),
      ),
      SupplierReservationAction.submitRecoveryPickupWindow => _InboxAction(
        'Submit pickup window',
        () => handleSubmitNoDriverPickupWindow(
          context,
          ref,
          reservationId: request.id,
          materialTitle: request.materialTitle,
          learnerName: request.learnerName,
        ),
      ),
      _ => _InboxAction('Review request', () => _openRequestActions(context, request)),
    };
  }

  Future<void> _openRequestActions(
    BuildContext context,
    SupplierIncomingRequest request,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(request.materialTitle, style: sheetContext.supplierTitle()),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Request ${_shortId(request.id)} · ${request.status.label}',
                style: sheetContext.supplierBody().copyWith(
                  color: sheetContext.supplierColors.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              ...request.availableActions.where((action) => action.isExecutable).map(
                (action) => Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.of(sheetContext).pop();
                        _runAction(context, request, action.value);
                      },
                      child: Text(_actionLabel(action.value)),
                    ),
                  ),
                ),
              ),
              if (request.availableActions.isEmpty)
                Text(
                  'No further action is required for this request.',
                  style: sheetContext.supplierBody(),
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _runAction(
    BuildContext context,
    SupplierIncomingRequest request,
    SupplierReservationAction action,
  ) {
    switch (action) {
      case SupplierReservationAction.accept:
        _handleAccept(context, request);
        return;
      case SupplierReservationAction.decline:
        _handleDecline(context, request);
        return;
      case SupplierReservationAction.completeSelfPickup:
        _handleComplete(context, request);
        return;
      case SupplierReservationAction.acceptLearnerReschedule:
        handleAcceptLearnerReschedule(context, ref, reservationId: request.id);
        return;
      case SupplierReservationAction.proposeReschedule:
        handleRequestReschedulePickup(
          context,
          ref,
          reservationId: request.id,
          materialTitle: request.materialTitle,
          learnerName: request.learnerName,
        );
        return;
      case SupplierReservationAction.submitRecoveryPickupWindow:
        handleSubmitNoDriverPickupWindow(
          context,
          ref,
          reservationId: request.id,
          materialTitle: request.materialTitle,
          learnerName: request.learnerName,
        );
        return;
      case SupplierReservationAction.closeReservation:
        handleCloseOverduePickup(context, ref, reservationId: request.id);
        return;
      case SupplierReservationAction.reportIncident:
        handleReportToAdminAndClose(context, ref, reservationId: request.id);
        return;
      case SupplierReservationAction.reportNoDriver:
        handleReportNoDriverAvailable(context, ref, reservationId: request.id);
        return;
      case SupplierReservationAction.markDeliveryPickupExpired:
        handleMarkDeliveryPickupExpired(context, ref, reservationId: request.id);
        return;
      case SupplierReservationAction.reportDriverNoShow:
        if (request.activeDelivery?.id != null) {
          handleReportDriverNoShow(context, ref, deliveryId: request.activeDelivery!.id);
        }
        return;
      case SupplierReservationAction.markLearnerNoShow:
        markLearnerNoShowForRequest(ref, requestId: request.id);
        return;
      case SupplierReservationAction.sendMessage:
      case SupplierReservationAction.unknown:
        showSupplierInfoSnackBar(context, 'Request messages will remain available in the request workspace.');
        return;
    }
  }

  Future<void> _handleAccept(BuildContext context, SupplierIncomingRequest request) async {
    final pickupWindow = await AcceptIncomingRequestDialog.show(context, request: request);
    if (pickupWindow == null || !context.mounted) return;
    try {
      await acceptIncomingRequest(ref, requestId: request.id, pickupWindow: pickupWindow);
      if (context.mounted) showSupplierInfoSnackBar(context, context.s.requestAccepted);
    } catch (error) {
      if (context.mounted) {
        showSupplierErrorSnackBar(context, error is ApiException ? error.displayMessage : context.s.requestAcceptFailed);
      }
    }
  }

  Future<void> _handleDecline(BuildContext context, SupplierIncomingRequest request) async {
    final result = await DeclineIncomingRequestDialog.show(
      context,
      materialTitle: request.materialTitle,
      learnerName: request.learnerName,
    );
    if (result == null || result.result != DeclineIncomingRequestResult.declined || !context.mounted) return;
    try {
      await declineIncomingRequest(ref, requestId: request.id, reason: result.reason);
      if (context.mounted) showSupplierInfoSnackBar(context, context.s.requestDeclined);
    } catch (error) {
      if (context.mounted) {
        showSupplierErrorSnackBar(context, error is ApiException ? error.displayMessage : context.s.requestDeclineFailed);
      }
    }
  }

  Future<void> _handleComplete(BuildContext context, SupplierIncomingRequest request) async {
    final code = await CompletePickupDialog.show(context);
    if (code == null || code.trim().isEmpty || !context.mounted) return;
    ref.read(completingReservationIdProvider.notifier).setCompleting(request.id);
    try {
      await completeIncomingRequest(ref, requestId: request.id, confirmationCode: code.trim());
      if (context.mounted) showSupplierInfoSnackBar(context, context.s.pickupCompleted);
    } catch (error) {
      if (context.mounted) {
        showSupplierErrorSnackBar(
          context,
          _isDeliveryCompleteConflict(error)
              ? _deliveryHandledCompleteMessage
              : context.s.pickupCompleteFailed,
        );
      }
    } finally {
      ref.read(completingReservationIdProvider.notifier).setCompleting(null);
    }
  }
}

class _OperationalIntroduction extends StatelessWidget {
  const _OperationalIntroduction({required this.total});
  final int total;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Operational overview', style: context.supplierLabel()),
          ],
        ),
      ),
    ],
  );
}

class _OperationalSummary extends StatelessWidget {
  const _OperationalSummary({this.summary});
  final SupplierReservationSummary? summary;

  @override
  Widget build(BuildContext context) {
    final cards = [
      (Icons.priority_high_rounded, 'Needs your response', summary?.needsSupplierResponse ?? 0, _SummaryTone.action),
      (Icons.hourglass_top_rounded, 'Waiting for learner', summary?.waitingForLearner ?? 0, _SummaryTone.waiting),
      (Icons.local_shipping_outlined, 'In progress', summary?.fulfillmentInProgress ?? 0, _SummaryTone.progress),
      (Icons.admin_panel_settings_outlined, 'Admin review', summary?.adminReview ?? 0, _SummaryTone.review),
    ];
    return Column(
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth >= 1120
                ? 4
                : constraints.maxWidth >= 420
                ? 2
                : 1;
            return GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: columns,
                crossAxisSpacing: AppSpacing.md,
                mainAxisSpacing: AppSpacing.md,
                mainAxisExtent: 82,
              ),
              itemCount: cards.length,
              itemBuilder: (context, index) {
                final item = cards[index];
                return _SummaryCard(
                  icon: item.$1,
                  label: item.$2,
                  count: item.$3,
                  tone: item.$4,
                );
              },
            );
          },
        ),
      ],
    );
  }
}

enum _SummaryTone { action, waiting, progress, review }

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.icon, required this.label, required this.count, required this.tone});
  final IconData icon;
  final String label;
  final int count;
  final _SummaryTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final semantic = switch (tone) {
      _SummaryTone.action => Theme.of(context).colorScheme.tertiary,
      _SummaryTone.waiting => Theme.of(context).colorScheme.primary,
      _SummaryTone.progress => colors.accent,
      _SummaryTone.review => Theme.of(context).colorScheme.secondary,
    };
    final emphasized = count > 0;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 12),
      decoration: BoxDecoration(
        color: colors.surfaceSolid,
        border: Border.all(color: colors.border.withValues(alpha: .5)),
        borderRadius: AppRadius.lgAll,
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            width: 38,
            height: 38,
            decoration: BoxDecoration(color: semantic.withValues(alpha: emphasized ? .13 : .06), borderRadius: AppRadius.mdAll),
            child: Icon(icon, color: semantic.withValues(alpha: emphasized ? 1 : .55), size: 20),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: Column(
            mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('$count', style: context.supplierSectionTitle().copyWith(fontSize: 19, color: emphasized ? semantic : colors.textPrimary)),
                Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: context.supplierBody().copyWith(fontSize: 12, color: colors.textSecondary)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterPanel extends StatefulWidget {
  const _FilterPanel({required this.query, required this.summary, required this.searchController, required this.onChanged, required this.onReset});
  final SupplierRequestInboxQuery query;
  final SupplierReservationSummary? summary;
  final TextEditingController searchController;
  final ValueChanged<SupplierRequestInboxQuery> onChanged;
  final VoidCallback onReset;
  @override
  State<_FilterPanel> createState() => _FilterPanelState();
}

class _FilterPanelState extends State<_FilterPanel> {
  bool _showAdvanced = false;
  static const _attention = <String, String>{
    'SUPPLIER_ACTION_REQUIRED': 'Needs your response', 'WAITING_FOR_LEARNER': 'Waiting for learner', 'FULFILLMENT_IN_PROGRESS': 'In progress', 'ADMIN_REVIEW_REQUIRED': 'Admin review', 'TERMINAL': 'Terminal',
  };
  static const _statuses = <String, String>{
    'PENDING': 'Pending', 'AWAITING_LEARNER_CONFIRMATION': 'Awaiting learner', 'AWAITING_SUPPLIER_CONFIRMATION': 'Awaiting supplier', 'ACCEPTED': 'Accepted', 'REJECTED': 'Rejected', 'CANCELLED': 'Cancelled', 'COMPLETED': 'Completed', 'EXPIRED': 'Expired', 'NO_SHOW': 'Learner no-show', 'FULFILLMENT_FAILED': 'Fulfillment failed', 'AWAITING_RESOLUTION': 'Awaiting resolution',
  };

  @override
  Widget build(BuildContext context) {
    final query = widget.query;
    final advancedActive = query.status != null || query.dateFrom != null || query.dateTo != null;
    final advancedCount = (query.status == null ? 0 : 1) +
        (query.dateFrom == null && query.dateTo == null ? 0 : 1);
    final showAdvanced = _showAdvanced || advancedActive;
    final search = _SearchField(controller: widget.searchController, onSubmitted: (value) => widget.onChanged(query.copyWith(search: value, clearSearch: value.trim().isEmpty, page: 1)));
    final attention = _SelectField<String>(value: query.attentionState, hint: 'All attention', items: _attention, onChanged: (value) => widget.onChanged(query.copyWith(attentionState: value, clearAttentionState: value == null, page: 1)));
    final fulfillment = _SelectField<String>(value: query.fulfillmentMethod, hint: 'All fulfillment', items: const {'PICKUP': 'Pickup', 'DELIVERY': 'Delivery'}, onChanged: (value) => widget.onChanged(query.copyWith(fulfillmentMethod: value, clearFulfillmentMethod: value == null, page: 1)));
    final history = _HistoryScopeControl(
      selected: query.historyScope,
      onChanged: (value) => widget.onChanged(query.copyWith(historyScope: value, page: 1)),
    );
    final status = _SelectField<String>(value: query.status, hint: 'All statuses', items: _statuses, onChanged: (value) => widget.onChanged(query.copyWith(status: value, clearStatus: value == null, page: 1)));
    final date = OutlinedButton.icon(
      onPressed: () async {
        final selected = await showDateRangePicker(context: context, firstDate: DateTime(2020), lastDate: DateTime(2100), initialDateRange: query.dateFrom == null || query.dateTo == null ? null : DateTimeRange(start: query.dateFrom!, end: query.dateTo!));
        if (selected != null) {
          widget.onChanged(query.copyWith(dateFrom: selected.start, dateTo: selected.end.add(const Duration(days: 1)).subtract(const Duration(milliseconds: 1)), page: 1));
        }
      },
      icon: const Icon(Icons.calendar_today_outlined, size: 17),
      label: Text(query.dateFrom == null ? 'Date range' : '${query.dateFrom!.month}/${query.dateFrom!.day} – ${query.dateTo!.month}/${query.dateTo!.day}'),
    );
    final more = OutlinedButton.icon(onPressed: () => setState(() => _showAdvanced = !_showAdvanced), icon: Icon(showAdvanced ? Icons.expand_less : Icons.tune, size: 17), label: Text(advancedCount == 0 ? 'More filters' : 'Filters $advancedCount'));
    final reset = TextButton.icon(onPressed: query.hasActiveFilters ? widget.onReset : null, icon: const Icon(Icons.restart_alt, size: 17), label: const Text('Reset'));
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: context.supplierColors.surfaceSolid.withValues(alpha: .7), border: Border.all(color: context.supplierColors.border.withValues(alpha: .55)), borderRadius: AppRadius.mdAll),
      child: LayoutBuilder(builder: (context, constraints) {
        final wide = constraints.maxWidth >= 1060;
        if (wide) {
          return Column(mainAxisSize: MainAxisSize.min, children: [
            Row(children: [Expanded(flex: 22, child: search), const SizedBox(width: AppSpacing.sm), Expanded(flex: 10, child: attention), const SizedBox(width: AppSpacing.sm), Expanded(flex: 10, child: fulfillment), const SizedBox(width: AppSpacing.sm), Expanded(flex: 9, child: history), const SizedBox(width: AppSpacing.sm), more]),
            if (query.historyScope == 'TERMINAL') ...[
              const SizedBox(height: AppSpacing.xs),
              _HistoryCounters(completed: widget.summary?.completed ?? 0, closed: widget.summary?.closed ?? 0),
            ],
            if (showAdvanced) ...[const SizedBox(height: AppSpacing.sm), Row(children: [Expanded(child: status), const SizedBox(width: AppSpacing.sm), Expanded(child: date), const SizedBox(width: AppSpacing.sm), reset, const Spacer()])],
          ]);
        }
        final half = (constraints.maxWidth - AppSpacing.sm) / 2;
        return Wrap(spacing: AppSpacing.sm, runSpacing: AppSpacing.sm, children: [
          SizedBox(width: constraints.maxWidth, child: search),
          SizedBox(width: half, child: attention), SizedBox(width: half, child: fulfillment), SizedBox(width: constraints.maxWidth, child: history), SizedBox(width: half, child: more),
          if (query.historyScope == 'TERMINAL') SizedBox(width: constraints.maxWidth, child: _HistoryCounters(completed: widget.summary?.completed ?? 0, closed: widget.summary?.closed ?? 0)),
          if (showAdvanced) ...[SizedBox(width: half, child: status), SizedBox(width: half, child: date), reset],
        ]);
      }),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.onSubmitted});
  final TextEditingController controller;
  final ValueChanged<String> onSubmitted;
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<TextEditingValue>(
    valueListenable: controller,
    builder: (context, value, _) => TextField(
      controller: controller,
      textInputAction: TextInputAction.search,
      onSubmitted: onSubmitted,
      decoration: InputDecoration(
        hintText: 'Search material, learner, or reservation ID',
        prefixIcon: const Icon(Icons.search, size: 20),
        suffixIcon: value.text.isEmpty ? null : IconButton(icon: const Icon(Icons.clear, size: 18), tooltip: 'Clear search', onPressed: controller.clear),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      ),
    ),
  );
}

class _HistoryScopeControl extends StatelessWidget {
  const _HistoryScopeControl({required this.selected, required this.onChanged});
  final String selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Container(
      height: 44,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: colors.surfaceSolid,
        border: Border.all(color: colors.border.withValues(alpha: .65)),
        borderRadius: AppRadius.mdAll,
      ),
      child: Row(
        children: [
          _scopeButton(context, 'Active', 'ACTIVE'),
          _scopeButton(context, 'History', 'TERMINAL'),
          _scopeButton(context, 'All', 'ALL'),
        ],
      ),
    );
  }

  Widget _scopeButton(BuildContext context, String label, String value) {
    final active = selected == value;
    return Expanded(
      child: Semantics(
        button: true,
        selected: active,
        child: TextButton(
          onPressed: () => onChanged(value),
          style: TextButton.styleFrom(
            minimumSize: const Size(0, 36),
            padding: const EdgeInsets.symmetric(horizontal: 6),
            foregroundColor: active
                ? context.supplierColors.accent
                : context.supplierColors.textSecondary,
            backgroundColor: active
                ? context.supplierColors.accentSoft.withValues(alpha: .38)
                : Colors.transparent,
            shape: RoundedRectangleBorder(borderRadius: AppRadius.smAll),
          ),
          child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
      ),
    );
  }
}

class _HistoryCounters extends StatelessWidget {
  const _HistoryCounters({required this.completed, required this.closed});
  final int completed;
  final int closed;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return Padding(
      padding: const EdgeInsetsDirectional.only(start: 4),
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 6,
        children: [
          _counterDot(colors.accent),
          Text('Completed $completed', style: context.supplierBody().copyWith(fontSize: 12, color: colors.textSecondary)),
          Text('·', style: context.supplierBody().copyWith(color: colors.textMuted)),
          _counterDot(Theme.of(context).colorScheme.error.withValues(alpha: .7)),
          Text('Closed $closed', style: context.supplierBody().copyWith(fontSize: 12, color: colors.textSecondary)),
        ],
      ),
    );
  }

  Widget _counterDot(Color color) => Container(
    width: 7,
    height: 7,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );
}

class _SelectField<T> extends StatelessWidget {
  const _SelectField({this.value, this.hint, required this.items, required this.onChanged});
  final T? value;
  final String? hint;
  final Map<T, String> items;
  final ValueChanged<T?> onChanged;
  @override
  Widget build(BuildContext context) => DropdownButtonFormField<T>(
    initialValue: value,
    isExpanded: true,
    hint: Text(hint ?? ''),
    decoration: const InputDecoration(contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 2)),
    items: [if (hint != null) DropdownMenuItem<T>(value: null, child: Text(hint!)), ...items.entries.map((entry) => DropdownMenuItem<T>(value: entry.key, child: Text(entry.value)))],
    onChanged: onChanged,
  );
}

class _ResultsHeader extends StatelessWidget {
  const _ResultsHeader({required this.query, required this.pagination, required this.onChanged});
  final SupplierRequestInboxQuery query;
  final SupplierReservationPagination? pagination;
  final ValueChanged<SupplierRequestInboxQuery> onChanged;
  @override
  Widget build(BuildContext context) {
    final total = pagination?.total ?? 0;
    final start = total == 0 ? 0 : ((pagination?.page ?? 1) - 1) * (pagination?.limit ?? query.limit) + 1;
    final end = total == 0 ? 0 : (start + (pagination?.limit ?? query.limit) - 1).clamp(0, total);
    return Row(children: [
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Requests', style: context.supplierTitle().copyWith(fontSize: 20)), Text('Showing $start–$end of $total', style: context.supplierBody().copyWith(color: context.supplierColors.textSecondary))])),
      if (query.activeFilterCount > 0) Text('${query.activeFilterCount} filters', style: context.supplierBody().copyWith(color: context.supplierColors.textSecondary)),
    ]);
  }
}

class _RequestList extends StatelessWidget {
  const _RequestList({required this.requests, required this.query, required this.pagination, required this.onQueryChanged, required this.onReset, required this.cardFor});
  final List<SupplierIncomingRequest> requests;
  final SupplierRequestInboxQuery query;
  final SupplierReservationPagination? pagination;
  final ValueChanged<SupplierRequestInboxQuery> onQueryChanged;
  final VoidCallback onReset;
  final Widget Function(SupplierIncomingRequest) cardFor;
  @override
  Widget build(BuildContext context) {
    if (requests.isEmpty) return _ContextEmpty(query: query, onReset: onReset);
    return LayoutBuilder(
      builder: (context, constraints) => Column(
        children: [
          if (constraints.maxWidth >= IncomingRequestDesktopGrid.breakpoint)
            const _DesktopRequestColumnHeader(),
          ...requests.map(
            (request) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: cardFor(request),
            ),
          ),
          if ((pagination?.totalPages ?? 1) > 1)
            _Pagination(
              query: query,
              pagination: pagination,
              onChanged: onQueryChanged,
            ),
        ],
      ),
    );
  }
}

class _DesktopRequestColumnHeader extends StatelessWidget {
  const _DesktopRequestColumnHeader();

  @override
  Widget build(BuildContext context) {
    final style = context.supplierBody().copyWith(
      fontSize: 12,
      fontWeight: FontWeight.w600,
      color: context.supplierColors.textSecondary,
    );
    Widget label(String text, {TextAlign? textAlign}) => Text(
      text,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      textAlign: textAlign,
      style: style,
    );

    return SizedBox(
      height: 36,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        child: Row(
          children: [
            Expanded(
              flex: IncomingRequestDesktopGrid.identityFlex,
              child: label('Request'),
            ),
            const SizedBox(width: IncomingRequestDesktopGrid.columnGap),
            Expanded(
              flex: IncomingRequestDesktopGrid.fulfillmentFlex,
              child: label('Fulfillment & schedule'),
            ),
            const SizedBox(width: IncomingRequestDesktopGrid.columnGap),
            Expanded(
              flex: IncomingRequestDesktopGrid.statusFlex,
              child: label('Status & attention'),
            ),
            const SizedBox(width: IncomingRequestDesktopGrid.columnGap),
            SizedBox(
              width: IncomingRequestDesktopGrid.detailsWidth,
              child: label('Details', textAlign: TextAlign.center),
            ),
          ],
        ),
      ),
    );
  }
}

class _Pagination extends StatelessWidget {
  const _Pagination({required this.query, required this.pagination, required this.onChanged});
  final SupplierRequestInboxQuery query;
  final SupplierReservationPagination? pagination;
  final ValueChanged<SupplierRequestInboxQuery> onChanged;
  @override
  Widget build(BuildContext context) {
    final page = pagination?.page ?? 1;
    final pages = pagination?.totalPages ?? 1;
    if (pages <= 1) return const SizedBox.shrink();
    final total = pagination?.total ?? 0;
    final start = total == 0 ? 0 : (page - 1) * query.limit + 1;
    final end = total == 0 ? 0 : (start + query.limit - 1).clamp(0, total);
    final visible = List.generate(pages > 5 ? 5 : pages, (index) => index + 1);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        runSpacing: AppSpacing.sm,
        children: [
          Text('Showing $start–$end of $total requests', style: context.supplierBody().copyWith(color: context.supplierColors.textSecondary)),
          if (pages > 1) Row(mainAxisSize: MainAxisSize.min, children: [
            IconButton(onPressed: page > 1 ? () => onChanged(query.copyWith(page: page - 1)) : null, icon: const Icon(Icons.chevron_left), tooltip: 'Previous'),
            ...visible.map((value) => Padding(padding: const EdgeInsets.symmetric(horizontal: 2), child: FilledButton(onPressed: value == page ? () {} : () => onChanged(query.copyWith(page: value)), style: FilledButton.styleFrom(minimumSize: const Size(36, 36), padding: EdgeInsets.zero), child: Text('$value')))),
            IconButton(onPressed: page < pages ? () => onChanged(query.copyWith(page: page + 1)) : null, icon: const Icon(Icons.chevron_right), tooltip: 'Next'),
          ]),
          if (pages > 1) Container(
            height: 38,
            padding: const EdgeInsetsDirectional.only(start: 10, end: 6),
            decoration: BoxDecoration(color: context.supplierColors.surfaceSolid, border: Border.all(color: context.supplierColors.border.withValues(alpha: .65)), borderRadius: AppRadius.smAll),
            child: DropdownButton<int>(value: query.limit, underline: const SizedBox(), items: const [10, 20, 50].map((value) => DropdownMenuItem(value: value, child: Text('$value per page'))).toList(), onChanged: (value) { if (value != null) onChanged(query.copyWith(limit: value, page: 1)); }),
          ),
        ],
      ),
    );
  }
}

class _ContextEmpty extends StatelessWidget {
  const _ContextEmpty({required this.query, required this.onReset});
  final SupplierRequestInboxQuery query;
  final VoidCallback onReset;
  @override
  Widget build(BuildContext context) {
    final (title, subtitle) = switch (query.attentionState) {
      'SUPPLIER_ACTION_REQUIRED' => ('You’re all caught up', 'No requests currently need your response.'),
      'WAITING_FOR_LEARNER' => ('No requests are waiting for learner confirmation.', ''),
      'FULFILLMENT_IN_PROGRESS' => ('No active pickups or deliveries.', ''),
      'ADMIN_REVIEW_REQUIRED' => ('No requests are currently under admin review.', ''),
      _ when query.historyScope == 'TERMINAL' => ('No completed or closed requests found.', ''),
      _ when query.hasActiveFilters => ('No requests match the selected filters.', ''),
      _ => ('No incoming requests yet', ''),
    };
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(children: [
        Icon(Icons.inbox_outlined, size: 34, color: context.supplierColors.textSecondary),
        const SizedBox(height: AppSpacing.md),
        Text(title, textAlign: TextAlign.center, style: context.supplierTitle().copyWith(fontSize: 18)),
        if (subtitle.isNotEmpty) ...[const SizedBox(height: AppSpacing.xs), Text(subtitle, textAlign: TextAlign.center, style: context.supplierBody())],
        if (query.hasActiveFilters) ...[const SizedBox(height: AppSpacing.md), OutlinedButton.icon(onPressed: onReset, icon: const Icon(Icons.restart_alt), label: const Text('Reset filters'))],
      ]),
    );
  }
}

class _InboxLoading extends StatelessWidget {
  const _InboxLoading();
  @override
  Widget build(BuildContext context) => Column(children: [
    const _Skeleton(height: 54),
    const SizedBox(height: AppSpacing.md),
    GridView.count(crossAxisCount: MediaQuery.sizeOf(context).width > 900 ? 4 : 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), childAspectRatio: 2.2, crossAxisSpacing: AppSpacing.md, mainAxisSpacing: AppSpacing.md, children: List.generate(4, (_) => const _Skeleton(height: 108))),
    const SizedBox(height: AppSpacing.lg),
    const _Skeleton(height: 124),
    const SizedBox(height: AppSpacing.lg),
    ...List.generate(5, (_) => const Padding(padding: EdgeInsets.only(bottom: AppSpacing.sm), child: _Skeleton(height: 112))),
  ]);
}

class _Skeleton extends StatelessWidget {
  const _Skeleton({required this.height});
  final double height;
  @override
  Widget build(BuildContext context) => Container(height: height, width: double.infinity, decoration: BoxDecoration(color: context.supplierColors.backgroundElevated, borderRadius: AppRadius.lgAll));
}

class _InboxError extends StatelessWidget {
  const _InboxError({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(AppSpacing.lg),
    decoration: BoxDecoration(borderRadius: AppRadius.lgAll, border: Border.all(color: context.supplierColors.border)),
    child: Row(children: [const Icon(Icons.cloud_off_outlined), const SizedBox(width: AppSpacing.md), Expanded(child: Text('We couldn’t refresh incoming requests.', style: context.supplierBody())), OutlinedButton(onPressed: onRetry, child: const Text('Retry'))]),
  );
}

class _InboxAction {
  const _InboxAction(this.label, this.onPressed);
  final String label;
  final VoidCallback onPressed;
}

String _shortId(String id) => id.length <= 8 ? id : id.substring(0, 8).toUpperCase();

String _actionLabel(SupplierReservationAction action) => switch (action) {
  SupplierReservationAction.accept => 'Accept request',
  SupplierReservationAction.decline => 'Decline request',
  SupplierReservationAction.completeSelfPickup => 'Confirm pickup',
  SupplierReservationAction.proposeReschedule => 'Propose a new time',
  SupplierReservationAction.acceptLearnerReschedule => 'Accept learner reschedule',
  SupplierReservationAction.closeReservation => 'Close reservation',
  SupplierReservationAction.markLearnerNoShow => 'Mark learner no-show',
  SupplierReservationAction.reportIncident => 'Report to admin',
  SupplierReservationAction.reportNoDriver => 'Report no driver',
  SupplierReservationAction.markDeliveryPickupExpired => 'Mark pickup expired',
  SupplierReservationAction.reportDriverNoShow => 'Report driver no-show',
  SupplierReservationAction.submitRecoveryPickupWindow => 'Submit pickup window',
  SupplierReservationAction.sendMessage => 'Send message',
  SupplierReservationAction.unknown => 'Review request',
};
