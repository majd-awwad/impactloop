import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/app_back_action.dart';
import '../../../../app/router/navigation_extensions.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../data/admin_deliveries_api.dart';
import '../../data/models/admin_deliveries_models.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import '../widgets/admin_monitoring_utils.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;

final adminDeliveryDetailProvider = FutureProvider.autoDispose
    .family<AdminDeliveryDetail, String>((ref, id) {
      return ref.watch(adminDeliveriesApiProvider).fetchDeliveryDetail(id);
    });

class AdminDeliveryDetailPage extends ConsumerStatefulWidget {
  const AdminDeliveryDetailPage({super.key, required this.deliveryId});

  final String deliveryId;

  @override
  ConsumerState<AdminDeliveryDetailPage> createState() =>
      _AdminDeliveryDetailPageState();
}

class _AdminDeliveryDetailPageState
    extends ConsumerState<AdminDeliveryDetailPage> {
  String _tab = 'Overview';
  var _isReopening = false;

  void _back() => context.popOrGo('/admin/deliveries');

  Future<void> _reopen(AdminDeliveryDetail detail) async {
    if (_isReopening) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AppDialogShell(
        title: const Text('Reopen driver assignment?'),
        content: const Text(
          'The current assignment will be released and the delivery will return to the driver pool. Another driver may accept it. Pickup must not have started.',
        ),
        footer: AppDialogFooter.decision(
          secondaryAction: TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(AdminL10n.of(context).cancel),
          ),
          primaryAction: FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: AppStatusButtonStyle.filled(context, AppStatusTone.warning),
            child: const Text('Reopen assignment'),
          ),
        ),
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _isReopening = true);
    try {
      await ref
          .read(adminDeliveriesApiProvider)
          .reopenDriverAssignment(detail.id);
      ref.invalidate(adminDeliveryDetailProvider(widget.deliveryId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Driver assignment reopened.')),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(AdminL10n.of(context).localizedError(error))));
      }
    } finally {
      if (mounted) setState(() => _isReopening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detailAsync = ref.watch(
      adminDeliveryDetailProvider(widget.deliveryId),
    );
    return detailAsync.when(
      loading: () =>
          _DetailFrame(onBack: _back, child: const _DetailSkeleton()),
      error: (error, _) => _DetailFrame(
        onBack: _back,
        child: _DetailFailure(
          notFound: error is ApiException && error.statusCode == 404,
          onRetry: () =>
              ref.invalidate(adminDeliveryDetailProvider(widget.deliveryId)),
          onBack: _back,
        ),
      ),
      data: (detail) => _DetailFrame(
        onBack: _back,
        child: _DeliveryWorkspace(
          detail: detail,
          tab: _tab,
          busy: _isReopening,
          onTab: (value) => setState(() => _tab = value),
          onReopen: () => _reopen(detail),
        ),
      ),
    );
  }
}

class _DetailFrame extends StatelessWidget {
  const _DetailFrame({required this.onBack, required this.child});
  final VoidCallback onBack;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return ColoredBox(
      color: palette.pageBackground,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(24, 18, 24, 28),
          child: child,
        ),
      ),
    );
  }
}

class _DeliveryWorkspace extends StatelessWidget {
  const _DeliveryWorkspace({
    required this.detail,
    required this.tab,
    required this.busy,
    required this.onTab,
    required this.onReopen,
  });

  final AdminDeliveryDetail detail;
  final String tab;
  final bool busy;
  final ValueChanged<String> onTab;
  final VoidCallback onReopen;

  @override
  Widget build(BuildContext context) {
    final tabs = <String>['Overview', 'Timeline', 'Assignments'];
    if (detail.scope == DeliveryScope.grouped && detail.group != null) {
      tabs.add('Group');
    }
    if (detail.incidentCount > 0 || detail.primaryIncident != null) {
      tabs.add('Incident');
    }
    if (detail.tracking != null || detail.locationHistory.items.isNotEmpty) {
      tabs.add('Tracking');
    }
    final activeTab = tabs.contains(tab) ? tab : 'Overview';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Header(detail: detail, busy: busy, onReopen: onReopen, onTab: onTab),
        const SizedBox(height: 16),
        _StateStrip(detail: detail),
        const SizedBox(height: 16),
        _Tabs(tabs: tabs, active: activeTab, onChanged: onTab),
        const SizedBox(height: 12),
        Expanded(
          child: SingleChildScrollView(
            child: switch (activeTab) {
              'Timeline' => _TimelineTab(detail: detail),
              'Assignments' => _AssignmentsTab(detail: detail),
              'Group' => _GroupTab(detail: detail),
              'Incident' => _IncidentTab(detail: detail),
              'Tracking' => _TrackingTab(detail: detail),
              _ => _OverviewTab(detail: detail, onTab: onTab),
            },
          ),
        ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.detail,
    required this.busy,
    required this.onReopen,
    required this.onTab,
  });
  final AdminDeliveryDetail detail;
  final bool busy;
  final VoidCallback onReopen;
  final ValueChanged<String> onTab;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final links = detail.availableLinks;
    final incident =
        detail.primaryIncident ??
        (detail.linkedIncidents.isNotEmpty
            ? detail.linkedIncidents.first
            : null);
    return LayoutBuilder(
      builder: (context, constraints) {
        final actions = Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            if (detail.availableMutations.contains(
              DeliveryMutation.reopenDriverAssignment,
            ))
              FilledButton.icon(
                onPressed: busy ? null : onReopen,
                icon: busy
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh, size: 18),
                label: const Text('Reopen driver assignment'),
              ),
            if (links.contains(DeliveryLink.openIncident) && incident != null)
              OutlinedButton.icon(
                onPressed: () => context.push(
                  '/admin/no-show-reports/${Uri.encodeComponent(incident.id)}',
                ),
                icon: const Icon(Icons.report_outlined, size: 18),
                label: const Text('Open Incident Review'),
              ),
            if (links.contains(DeliveryLink.openReservation))
              OutlinedButton(
                onPressed: () => context.push('/admin/reservations'),
                child: const Text('Open reservation'),
              ),
            if (links.contains(DeliveryLink.openGroup) && detail.group != null)
              OutlinedButton(
                onPressed: () => onTab('Group'),
                child: const Text('Open group'),
              ),
          ],
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const AppBackAction(fallbackLocation: '/admin/deliveries'),
            const SizedBox(height: 8),
            if (constraints.maxWidth >= 1080)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: _Identity(detail: detail, palette: palette),
                  ),
                  actions,
                ],
              )
            else ...[
              _Identity(detail: detail, palette: palette),
              const SizedBox(height: 12),
              actions,
            ],
          ],
        );
      },
    );
  }
}

class _Identity extends StatelessWidget {
  const _Identity({required this.detail, required this.palette});
  final AdminDeliveryDetail detail;
  final dynamic palette;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Wrap(
        spacing: 6,
        runSpacing: 6,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text(
            detail.material.title.trim().isEmpty
                ? context.l10n.viewDeliveryDetails
                : detail.material.title.trim(),
            style: AdminTypography.pageTitle(palette),
          ),
          AppStatusBadge(
            label: deliveryStatusLabel(detail.status),
            tone: deliveryStatusAppTone(detail.status),
          ),
          _Badge(
            label: _phaseLabel(detail.lifecyclePhase),
            tone: AppStatusTone.info,
          ),
          if (detail.adminAttentionState != AdminAttentionState.none) ...[
            _Badge(
              label: _attentionLabel(detail.adminAttentionState),
              tone: AppStatusTone.warning,
            ),
          ],
          if (detail.scope == DeliveryScope.grouped) ...[
            const _Badge(label: 'Grouped', tone: AppStatusTone.primary),
          ],
        ],
      ),
      const SizedBox(height: 7),
      Text(
        formatAdminDateTime(detail.requestedAt) ?? detail.requestedAt,
        style: AdminTypography.pageSubtitle(palette),
      ),
      if (detail.primaryIncident != null)
        Padding(
          padding: const EdgeInsets.only(top: 5),
          child: _Badge(
            label: humanizeEnum(detail.primaryIncident!.operationalState),
            tone: AppStatusTone.warning,
          ),
        ),
    ],
  );
}

class _StateStrip extends StatelessWidget {
  const _StateStrip({required this.detail});
  final AdminDeliveryDetail detail;
  @override
  Widget build(BuildContext context) {
    final items = [
      (
        'Scope',
        detail.scope == DeliveryScope.grouped ? 'Grouped' : 'Single',
        Icons.layers_outlined,
      ),
      ('Lifecycle', _phaseLabel(detail.lifecyclePhase), Icons.route_outlined),
      (
        'Attention',
        _attentionLabel(detail.adminAttentionState),
        Icons.warning_amber_outlined,
      ),
      (
        'Assignment',
        _assignmentLabel(detail.assignmentState),
        Icons.person_outline,
      ),
      (
        'Incident',
        detail.incidentCount == 0
            ? 'No incident'
            : '${detail.incidentCount} incident${detail.incidentCount == 1 ? '' : 's'}',
        Icons.report_outlined,
      ),
    ];
    return LayoutBuilder(
      builder: (context, constraints) => Wrap(
        spacing: 10,
        runSpacing: 10,
        children: items
            .map(
              (item) => SizedBox(
                width: constraints.maxWidth >= 1000
                    ? (constraints.maxWidth - 40) / 5
                    : constraints.maxWidth >= 620
                    ? (constraints.maxWidth - 10) / 2
                    : constraints.maxWidth,
                child: _StateTile(
                  label: item.$1,
                  value: item.$2,
                  icon: item.$3,
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _StateTile extends StatelessWidget {
  const _StateTile({
    required this.label,
    required this.value,
    required this.icon,
  });
  final String label;
  final String value;
  final IconData icon;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return _Card(
      child: Row(
        children: [
          Icon(icon, size: 19, color: palette.primaryTeal),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: AdminTypography.kpiHelper(palette)),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AdminTypography.kpiLabel(palette),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Tabs extends StatelessWidget {
  const _Tabs({
    required this.tabs,
    required this.active,
    required this.onChanged,
  });
  final List<String> tabs;
  final String active;
  final ValueChanged<String> onChanged;
  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 6,
    runSpacing: 6,
    children: tabs
        .map(
          (value) => ChoiceChip(
            label: Text(value),
            selected: value == active,
            onSelected: (_) => onChanged(value),
          ),
        )
        .toList(),
  );
}

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({required this.detail, required this.onTab});
  final AdminDeliveryDetail detail;
  final ValueChanged<String> onTab;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final side = <Widget>[
        if (detail.currentAssignment != null || detail.lastAssignment != null)
          _AssignmentCard(detail: detail),
        if (detail.primaryIncident != null)
          _IncidentSummaryCard(detail: detail, onTab: onTab),
        if (detail.scope == DeliveryScope.grouped && detail.group != null)
          _GroupSummaryCard(detail: detail, onTab: onTab),
      ];
      final main = <Widget>[
        _SummaryCard(detail: detail),
        const SizedBox(height: 14),
        _PeopleCard(detail: detail),
        const SizedBox(height: 14),
        _LocationsCard(detail: detail),
        const SizedBox(height: 14),
        _ProgressCard(detail: detail),
      ];
      if (constraints.maxWidth >= 900 && side.isNotEmpty) {
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(flex: 2, child: Column(children: main)),
            const SizedBox(width: 16),
            SizedBox(width: 330, child: Column(children: _gapped(side))),
          ],
        );
      }
      return Column(
        children: [
          ...main,
          if (side.isNotEmpty) ...[
            const SizedBox(height: 14),
            ..._gapped(side),
          ],
        ],
      );
    },
  );
}

List<Widget> _gapped(List<Widget> children) => [
  for (var i = 0; i < children.length; i++) ...[
    children[i],
    if (i < children.length - 1) const SizedBox(height: 14),
  ],
];

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.detail});
  final AdminDeliveryDetail detail;
  @override
  Widget build(BuildContext context) => _Panel(
    title: 'Delivery summary',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Info(
          label: 'Material',
          value: detail.material.title.isEmpty ? '—' : detail.material.title,
        ),
        _Info(
          label: 'Quantity',
          value:
              '${detail.reservation.quantityRequested} ${detail.reservation.unit}'
                  .trim(),
        ),
        _Info(
          label: 'Reservation status',
          value: humanizeEnum(detail.reservation.status),
        ),
        _Info(
          label: 'Requested',
          value: formatAdminDateTime(detail.requestedAt) ?? detail.requestedAt,
        ),
        _Info(
          label: 'Pickup window',
          value: _window(
            detail.pickup.pickupWindowStart,
            detail.pickup.pickupWindowEnd,
          ),
        ),
        _Info(
          label: 'Confirmed window',
          value: _window(
            detail.reservation.pickupWindowStart,
            detail.reservation.pickupWindowEnd,
          ),
        ),
      ],
    ),
  );
}

class _PeopleCard extends StatelessWidget {
  const _PeopleCard({required this.detail});
  final AdminDeliveryDetail detail;
  @override
  Widget build(BuildContext context) => _Panel(
    title: 'People',
    child: Column(
      children: [
        _Person(role: 'Learner', person: detail.learner),
        _Person(role: 'Supplier', person: detail.supplier),
        if (detail.currentDriver != null)
          _Person(role: 'Current driver', person: detail.currentDriver!)
        else if (detail.assignmentState == AssignmentState.released)
          const _Info(label: 'Current driver', value: 'No active driver'),
        if (detail.lastAssignedDriver != null &&
            detail.lastAssignedDriver?.id != detail.currentDriver?.id)
          _Person(
            role: detail.assignmentState == AssignmentState.historical
                ? 'Delivery driver'
                : 'Last assigned driver',
            person: detail.lastAssignedDriver!,
          ),
      ],
    ),
  );
}

class _LocationsCard extends StatelessWidget {
  const _LocationsCard({required this.detail});
  final AdminDeliveryDetail detail;
  @override
  Widget build(BuildContext context) => _Panel(
    title: 'Pickup and dropoff',
    child: LayoutBuilder(
      builder: (context, c) => c.maxWidth >= 620
          ? Row(
              children: [
                Expanded(
                  child: _Location(
                    title: 'Pickup',
                    detail: detail.pickup.location,
                    window: _window(
                      detail.pickup.pickupWindowStart,
                      detail.pickup.pickupWindowEnd,
                    ),
                    note: detail.pickup.supplierNote,
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: Icon(Icons.arrow_forward),
                ),
                Expanded(
                  child: _Location(
                    title: 'Dropoff',
                    detail: detail.dropoff.location,
                    window: 'Not confirmed',
                    note: detail.dropoff.deliveryNotes,
                  ),
                ),
              ],
            )
          : Column(
              children: [
                _Location(
                  title: 'Pickup',
                  detail: detail.pickup.location,
                  window: _window(
                    detail.pickup.pickupWindowStart,
                    detail.pickup.pickupWindowEnd,
                  ),
                  note: detail.pickup.supplierNote,
                ),
                const Divider(),
                _Location(
                  title: 'Dropoff',
                  detail: detail.dropoff.location,
                  window: 'Not confirmed',
                  note: detail.dropoff.deliveryNotes,
                ),
              ],
            ),
    ),
  );
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.detail});
  final AdminDeliveryDetail detail;
  @override
  Widget build(BuildContext context) {
    final blocked =
        detail.lifecyclePhase == LifecyclePhase.recoveryRequired ||
        detail.lifecyclePhase == LifecyclePhase.recoveryInProgress ||
        detail.lifecyclePhase == LifecyclePhase.terminalFailure ||
        detail.lifecyclePhase == LifecyclePhase.cancelled;
    if (blocked) {
      return _Panel(
        title: 'Operational status',
        child: Text(
          _recoveryCopy(detail),
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      );
    }
    const steps = [
      'Waiting for driver',
      'Driver assigned',
      'Arrived pickup',
      'Picked up',
      'On the way',
      'Arrived dropoff',
      'Delivered',
    ];
    final current = _progressIndex(detail.status);
    return _Panel(
      title: 'Status progress',
      child: Wrap(
        spacing: 5,
        runSpacing: 8,
        children: List.generate(
          steps.length,
          (index) => _Badge(
            label: steps[index],
            tone: index < current
                ? AppStatusTone.success
                : index == current
                ? AppStatusTone.info
                : AppStatusTone.neutral,
          ),
        ),
      ),
    );
  }
}

class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard({required this.detail});
  final AdminDeliveryDetail detail;
  @override
  Widget build(BuildContext context) => _Panel(
    title: 'Assignment',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Info(label: 'State', value: _assignmentLabel(detail.assignmentState)),
        if (detail.currentAssignment != null)
          _AssignmentInfo(
            label: 'Current assignment',
            assignment: detail.currentAssignment!,
          ),
        if (detail.lastAssignment != null &&
            detail.lastAssignment?.id != detail.currentAssignment?.id)
          _AssignmentInfo(
            label: 'Last assignment',
            assignment: detail.lastAssignment!,
          ),
      ],
    ),
  );
}

class _IncidentSummaryCard extends StatelessWidget {
  const _IncidentSummaryCard({required this.detail, required this.onTab});
  final AdminDeliveryDetail detail;
  final ValueChanged<String> onTab;
  @override
  Widget build(BuildContext context) {
    final incident = detail.primaryIncident!;
    return _Panel(
      title: 'Incident summary',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Info(label: 'Reason', value: humanizeEnum(incident.reasonCode)),
          _Info(label: AdminL10n.of(context).status, value: humanizeEnum(incident.status)),
          _Info(label: 'Workflow', value: humanizeEnum(incident.workflowType)),
          _Info(
            label: 'Operational state',
            value: humanizeEnum(incident.operationalState),
          ),
          if (detail.availableLinks.contains(DeliveryLink.openIncident))
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: OutlinedButton(
                onPressed: () => onTab('Incident'),
                child: const Text('View incident'),
              ),
            ),
        ],
      ),
    );
  }
}

class _GroupSummaryCard extends StatelessWidget {
  const _GroupSummaryCard({required this.detail, required this.onTab});
  final AdminDeliveryDetail detail;
  final ValueChanged<String> onTab;
  @override
  Widget build(BuildContext context) => _Panel(
    title: 'Group summary',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Info(label: 'Items', value: '${detail.group!.itemCount}'),
        _Info(label: AdminL10n.of(context).status, value: humanizeEnum(detail.group!.status)),
        OutlinedButton(
          onPressed: () => onTab('Group'),
          child: const Text('View group'),
        ),
      ],
    ),
  );
}

class _TimelineTab extends StatelessWidget {
  const _TimelineTab({required this.detail});

  final AdminDeliveryDetail detail;

  @override
  Widget build(BuildContext context) => _Panel(
    title: 'Operational timeline',
    child: detail.timeline.isEmpty
        ? const Text('No timeline events recorded.')
        : Column(
            children: detail.timeline
                .map(
                  (event) => ListTile(
                    leading: const Icon(Icons.circle_outlined, size: 18),
                    title: Text(
                      event.label.isEmpty
                          ? humanizeEnum(event.key)
                          : event.label,
                    ),
                    subtitle: Text(
                      [
                        if (event.timestamp != null)
                          formatAdminDateTime(event.timestamp) ??
                              event.timestamp!,
                        if (event.note?.trim().isNotEmpty == true)
                          event.note!.trim(),
                      ].join('\n'),
                    ),
                  ),
                )
                .toList(),
          ),
  );
}

class _AssignmentsTab extends StatelessWidget {
  const _AssignmentsTab({required this.detail});
  final AdminDeliveryDetail detail;
  @override
  Widget build(BuildContext context) => _Panel(
    title: 'Assignment history',
    child: detail.assignmentHistory.isEmpty
        ? const Text('No assignment history recorded.')
        : Column(
            children: detail.assignmentHistory
                .map(
                  (item) => _AssignmentInfo(
                    label: humanizeEnum(item.status),
                    assignment: item,
                  ),
                )
                .toList(),
          ),
  );
}

class _GroupTab extends StatelessWidget {
  const _GroupTab({required this.detail});
  final AdminDeliveryDetail detail;
  @override
  Widget build(BuildContext context) {
    final group = detail.group;
    if (group == null) return const SizedBox.shrink();
    final items = group.items;
    return _Panel(
      title: 'Group items (${group.itemCount})',
      child: items.isEmpty
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final (index, reservation) in group.reservations.indexed)
                  _Info(
                    label: '${context.l10n.checkoutOrderIdLabel} ${index + 1}',
                    value: humanizeEnum(reservation.status),
                  ),
                if (group.hasMoreItems)
                  const Text('Additional group items are available.'),
              ],
            )
          : Column(
              children: [
                for (final item in items) _GroupItem(item: item),
                if (group.hasMoreItems)
                  Text('Showing ${items.length} of ${group.itemCount} items'),
              ],
            ),
    );
  }
}

class _IncidentTab extends StatelessWidget {
  const _IncidentTab({required this.detail});
  final AdminDeliveryDetail detail;
  @override
  Widget build(BuildContext context) {
    final incidents = [
      if (detail.primaryIncident != null) detail.primaryIncident!,
      ...detail.linkedIncidents.where(
        (item) => item.id != detail.primaryIncident?.id,
      ),
    ];
    return _Panel(
      title: 'Incidents (${detail.incidentCount})',
      child: Column(
        children: [
          for (final incident in incidents) _IncidentCard(incident: incident),
          if (detail.hasMoreLinkedIncidents)
            const Text('Additional incidents are available.'),
        ],
      ),
    );
  }
}

class _TrackingTab extends StatelessWidget {
  const _TrackingTab({required this.detail});
  final AdminDeliveryDetail detail;
  @override
  Widget build(BuildContext context) {
    final tracking = detail.tracking;
    final pings = tracking?.locationPings.isNotEmpty == true
        ? tracking!.locationPings
        : detail.locationHistory.items;
    return _Panel(
      title: 'Tracking',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Info(
            label: 'Tracking availability',
            value: tracking?.availability == null
                ? 'Not available'
                : humanizeEnum(tracking!.availability!),
          ),
          _Info(
            label: 'Live tracking',
            value: tracking?.isLiveTracking == true
                ? 'Available'
                : 'Not available',
          ),
          _Info(
            label: 'Background tracking',
            value: tracking?.isBackgroundTracking == true
                ? 'Available'
                : 'Not available',
          ),
          if (tracking?.eta?.trim().isNotEmpty == true)
            _Info(label: 'ETA', value: tracking!.eta!),
          const SizedBox(height: 8),
          if (pings.isEmpty)
            const Text('No route/location updates recorded')
          else ...[
            Text(
              'Latest update: ${formatAdminDateTime(pings.first.capturedAt) ?? pings.first.capturedAt}',
            ),
            for (final ping in pings)
              _Info(
                label: 'Location update',
                value: formatAdminDateTime(ping.capturedAt) ?? ping.capturedAt,
              ),
          ],
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: child,
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.title, required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AdminTypography.sectionTitle(palette)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _Info extends StatelessWidget {
  const _Info({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 132,
            child: Text(label, style: AdminTypography.kpiHelper(palette)),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? '—' : value,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}

class _Person extends StatelessWidget {
  const _Person({required this.role, required this.person});
  final String role;
  final AdminDeliveryPerson person;
  @override
  Widget build(BuildContext context) => _Info(
    label: role,
    value: displayPersonLabel(person.displayName, person.email),
  );
}

class _Location extends StatelessWidget {
  const _Location({
    required this.title,
    required this.detail,
    required this.window,
    this.note,
  });
  final String title;
  final AdminDeliveryLocationDetail detail;
  final String window;
  final String? note;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(title, style: Theme.of(context).textTheme.titleSmall),
      const SizedBox(height: 6),
      Text(_location(detail)),
      Text(window),
      if (note?.trim().isNotEmpty == true)
        Text(note!.trim(), maxLines: 2, overflow: TextOverflow.ellipsis),
    ],
  );
}

class _AssignmentInfo extends StatelessWidget {
  const _AssignmentInfo({required this.label, required this.assignment});
  final String label;
  final AdminDeliveryAssignment assignment;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.titleSmall),
        Text(
          displayPersonLabel(
            assignment.driver?.displayName ?? '',
            assignment.driver?.email ?? '',
          ),
        ),
        Text(humanizeEnum(assignment.status)),
        if (assignment.acceptedAt != null)
          Text(
            'Accepted: ${formatAdminDateTime(assignment.acceptedAt) ?? assignment.acceptedAt}',
          ),
        if (assignment.releasedAt != null)
          Text(
            'Released: ${formatAdminDateTime(assignment.releasedAt) ?? assignment.releasedAt}',
          ),
        if (assignment.releaseReason?.trim().isNotEmpty == true)
          Text(assignment.releaseReason!.trim()),
      ],
    ),
  );
}

class _GroupItem extends StatelessWidget {
  const _GroupItem({required this.item});
  final AdminDeliveryGroupItem item;
  @override
  Widget build(BuildContext context) => ListTile(
    title: Text(
      item.materialTitle?.isNotEmpty == true
          ? item.materialTitle!
          : context.l10n.reservationDetailsTitle,
    ),
    subtitle: Text(
      '${item.learnerName ?? '—'} · ${item.quantity == null ? '—' : '${item.quantity} ${item.unit ?? ''}'}',
    ),
    trailing: Text(humanizeEnum(item.status)),
  );
}

class _IncidentCard extends StatelessWidget {
  const _IncidentCard({required this.incident});
  final AdminDeliveryIncidentSummary incident;
  @override
  Widget build(BuildContext context) => ListTile(
    leading: const Icon(Icons.report_outlined),
    title: Text(humanizeEnum(incident.reasonCode)),
    subtitle: Text(
      '${humanizeEnum(incident.workflowType)} · ${humanizeEnum(incident.operationalState)}',
    ),
    trailing: Text(humanizeEnum(incident.status)),
  );
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.tone});
  final String label;
  final AppStatusTone tone;
  @override
  Widget build(BuildContext context) =>
      AppStatusBadge(label: label, tone: tone);
}

class _DetailSkeleton extends StatelessWidget {
  const _DetailSkeleton();
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: const [
      SizedBox(height: 90),
      SizedBox(height: 16),
      _SkeletonBlock(height: 82),
      SizedBox(height: 16),
      _SkeletonBlock(height: 300),
    ],
  );
}

class _SkeletonBlock extends StatelessWidget {
  const _SkeletonBlock({required this.height});
  final double height;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: palette.primaryTeal.withValues(alpha: .08),
        borderRadius: BorderRadius.circular(14),
      ),
    );
  }
}

class _DetailFailure extends StatelessWidget {
  const _DetailFailure({
    required this.notFound,
    required this.onRetry,
    required this.onBack,
  });
  final bool notFound;
  final VoidCallback onRetry;
  final VoidCallback onBack;
  @override
  Widget build(BuildContext context) => Center(
    child: _Card(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(notFound ? Icons.search_off : Icons.error_outline, size: 32),
          const SizedBox(height: 10),
          Text(notFound ? 'Delivery not found' : 'Could not load delivery'),
          const SizedBox(height: 6),
          Text(
            notFound
                ? 'This delivery may have been removed or is no longer available.'
                : 'Try again or return to Deliveries.',
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            children: [
              if (!notFound)
                OutlinedButton(
                  onPressed: onRetry,
                  child: Text(AdminL10n.of(context).retry),
                ),
              FilledButton(
                onPressed: onBack,
                child: const Text('Back to Deliveries'),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

String _phaseLabel(LifecyclePhase value) => switch (value) {
  LifecyclePhase.waitingAssignment => 'Waiting assignment',
  LifecyclePhase.prePickup => 'Pre-pickup',
  LifecyclePhase.inTransit => 'In transit',
  LifecyclePhase.completed => 'Completed',
  LifecyclePhase.recoveryRequired => 'Recovery required',
  LifecyclePhase.recoveryInProgress => 'Recovery in progress',
  LifecyclePhase.terminalFailure => 'Terminal failure',
  LifecyclePhase.cancelled => 'Cancelled',
  LifecyclePhase.unknown => '—',
};
String _attentionLabel(AdminAttentionState value) => switch (value) {
  AdminAttentionState.none => 'No admin action',
  AdminAttentionState.actionRequired => 'Action required',
  AdminAttentionState.waitingExternalParty => 'Waiting external party',
  AdminAttentionState.unknown => '—',
};
String _assignmentLabel(AssignmentState value) => switch (value) {
  AssignmentState.unassigned => 'Unassigned',
  AssignmentState.active => 'Active',
  AssignmentState.released => 'Released',
  AssignmentState.historical => 'Historical',
  AssignmentState.unknown => '—',
};
String _window(String? start, String? end) {
  if (start == null && end == null) return 'Not confirmed';
  return '${formatAdminDateTime(start) ?? start ?? '—'} – ${formatAdminDateTime(end) ?? end ?? '—'}';
}

String _location(AdminDeliveryLocationDetail value) =>
    [value.label, value.area, value.city, value.addressLine]
        .whereType<String>()
        .where((item) => item.trim().isNotEmpty)
        .toSet()
        .join(', ')
        .isEmpty
    ? '—'
    : [value.label, value.area, value.city, value.addressLine]
          .whereType<String>()
          .where((item) => item.trim().isNotEmpty)
          .toSet()
          .join(', ');
int _progressIndex(String status) =>
    const {
      'WAITING_FOR_DRIVER': 0,
      'DRIVER_ASSIGNED': 1,
      'ARRIVED_PICKUP': 2,
      'PICKED_UP': 3,
      'ON_THE_WAY': 4,
      'ARRIVED_DROPOFF': 5,
      'DELIVERED': 6,
    }[status] ??
    0;
String _recoveryCopy(AdminDeliveryDetail detail) =>
    detail.adminAttentionState == AdminAttentionState.waitingExternalParty
    ? 'Recovery is in progress and waiting for an external party.'
    : detail.adminAttentionState == AdminAttentionState.actionRequired
    ? 'Delivery requires operational resolution.'
    : 'This delivery has a terminal operational outcome.';
