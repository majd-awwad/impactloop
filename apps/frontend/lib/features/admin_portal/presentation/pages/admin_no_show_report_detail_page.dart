import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_section_card.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/app_back_action.dart';
import '../../../../app/router/navigation_extensions.dart';
import '../../../../shared/widgets/incident_report_status_presentation.dart';
import '../../data/admin_no_show_reports_api.dart';
import '../l10n/admin_l10n.dart';
import '../widgets/admin_monitoring_utils.dart';

final adminNoShowReportDetailProvider = FutureProvider.autoDispose
    .family<AdminNoShowReportDetail, String>((ref, reportId) {
      return ref
          .watch(adminNoShowReportsApiProvider)
          .fetchReportDetail(reportId);
    });

class AdminNoShowReportDetailPage extends ConsumerStatefulWidget {
  const AdminNoShowReportDetailPage({super.key, required this.reportId});

  final String reportId;

  @override
  ConsumerState<AdminNoShowReportDetailPage> createState() =>
      _AdminNoShowReportDetailPageState();
}

class _AdminNoShowReportDetailPageState
    extends ConsumerState<AdminNoShowReportDetailPage> {
  String? _busyAction;

  void _goBack() => context.popOrGo('/admin/no-show-reports');

  void _refresh() {
    ref.invalidate(adminNoShowReportDetailProvider(widget.reportId));
  }

  Future<void> _performAction(
    AdminNoShowReportDetail report,
    String action,
  ) async {
    if (_busyAction != null) return;
    final confirmed = await _confirmAction(context, report, action);
    if (confirmed != true || !mounted) return;

    setState(() => _busyAction = action);
    try {
      final api = ref.read(adminNoShowReportsApiProvider);
      switch (action) {
        case 'VERIFY':
          await api.verifyReport(report.id);
          break;
        case 'REJECT':
          await api.rejectReport(report.id);
          break;
        case 'RESOLVE_WITHOUT_STRIKE':
          await api.resolveReport(report.id);
          break;
        case 'REQUEST_SUPPLIER_RESCHEDULE':
          await api.requestSupplierReschedule(report.id);
          break;
        case 'CANCEL_AND_RELEASE_HOLD':
          await api.cancelAndReleaseHold(report.id);
          break;
        default:
          return;
      }
      ref.invalidate(adminNoShowReportDetailProvider(widget.reportId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${_actionLabel(action)} completed.')),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AdminL10n.of(context).localizedError(error))),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update this incident.')),
        );
      }
    } finally {
      if (mounted) setState(() => _busyAction = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detailAsync = ref.watch(
      adminNoShowReportDetailProvider(widget.reportId),
    );
    return detailAsync.when(
      loading: () => _DetailScaffold(
        onBack: _goBack,
        child: const _IncidentDetailSkeleton(),
      ),
      error: (error, _) => _DetailScaffold(
        onBack: _goBack,
        child: _DetailFailure(
          notFound: error is ApiException && error.statusCode == 404,
          onRetry: _refresh,
          onBack: _goBack,
        ),
      ),
      data: (report) => _DetailScaffold(
        onBack: _goBack,
        child: _IncidentWorkspace(
          report: report,
          busyAction: _busyAction,
          onBack: _goBack,
          onAction: (action) => _performAction(report, action),
        ),
      ),
    );
  }
}

class _DetailScaffold extends StatelessWidget {
  const _DetailScaffold({required this.onBack, required this.child});

  final VoidCallback onBack;
  final Widget child;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
    child: child,
  );
}

class _IncidentWorkspace extends StatelessWidget {
  const _IncidentWorkspace({
    required this.report,
    required this.busyAction,
    required this.onBack,
    required this.onAction,
  });

  final AdminNoShowReportDetail report;
  final String? busyAction;
  final VoidCallback onBack;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _IncidentHeader(
          report: report,
          busyAction: busyAction,
          onBack: onBack,
          onAction: onAction,
        ),
        const SizedBox(height: AppSpacing.md),
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              child: _IncidentGrid(report: report, width: constraints.maxWidth),
            ),
          ),
        ),
      ],
    );
  }
}

class _IncidentHeader extends StatelessWidget {
  const _IncidentHeader({
    required this.report,
    required this.busyAction,
    required this.onBack,
    required this.onAction,
  });

  final AdminNoShowReportDetail report;
  final String? busyAction;
  final VoidCallback onBack;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final title = _reportTitle(report);
    return AppSectionCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final heading = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppBackAction(onBack: onBack),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  AppStatusBadge(
                    label: adminIncidentReportStatusLabel(report.status),
                    tone: incidentReportStatusTone(report.status),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.md,
                runSpacing: AppSpacing.xs,
                children: [
                  _HeaderMeta(
                    icon: Icons.schedule_outlined,
                    text: 'Created: ${_formatDateTime(report.createdAt)}',
                  ),
                  _HeaderMeta(
                    icon: Icons.person_outline_rounded,
                    text: 'Reporter: ${report.reporterName}',
                  ),
                  if (report.targetRole.toUpperCase() != 'SYSTEM')
                    _HeaderMeta(
                      icon: Icons.person_pin_outlined,
                      text:
                          'Target: ${report.hasIndividualTarget ? report.targetName : 'Unavailable'}',
                    ),
                ],
              ),
            ],
          );
          final actions = _IncidentActions(
            actions: report.availableActions,
            busyAction: busyAction,
            onAction: onAction,
          );
          if (constraints.maxWidth < 940) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                heading,
                const SizedBox(height: AppSpacing.md),
                actions,
              ],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: heading),
              const SizedBox(width: AppSpacing.md),
              actions,
            ],
          );
        },
      ),
    );
  }
}

class _HeaderMeta extends StatelessWidget {
  const _HeaderMeta({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(
        icon,
        size: 15,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
      const SizedBox(width: AppSpacing.xs),
      Text(text, style: Theme.of(context).textTheme.bodySmall),
    ],
  );
}

class _IncidentActions extends StatelessWidget {
  const _IncidentActions({
    required this.actions,
    required this.busyAction,
    required this.onAction,
  });

  final List<String> actions;
  final String? busyAction;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final valid = actions.where(_supportedAction).toList(growable: false);
    if (valid.isEmpty) return const SizedBox.shrink();
    final primary = valid
        .where(
          (action) => action != 'REJECT' && action != 'RESOLVE_WITHOUT_STRIKE',
        )
        .toList(growable: false);
    final inline = primary.isEmpty
        ? valid.take(2).toList(growable: false)
        : primary;
    final overflow = valid
        .where((action) => !inline.contains(action))
        .toList(growable: false);
    return Wrap(
      alignment: WrapAlignment.end,
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        if (overflow.isNotEmpty)
          PopupMenuButton<String>(
            onSelected: onAction,
            itemBuilder: (_) => overflow
                .map(
                  (action) => PopupMenuItem(
                    value: action,
                    child: Text(_actionLabel(action)),
                  ),
                )
                .toList(growable: false),
            child: IgnorePointer(
              child: OutlinedButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.keyboard_arrow_down_rounded),
                label: const Text('More actions'),
              ),
            ),
          ),
        ...inline.map(
          (action) => _ActionButton(
            action: action,
            busy: busyAction == action,
            onPressed: busyAction == action ? null : () => onAction(action),
          ),
        ),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.action,
    required this.busy,
    required this.onPressed,
  });

  final String action;
  final bool busy;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final label = busy
        ? const SizedBox.square(
            dimension: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : Text(_actionLabel(action));
    return switch (action) {
      'VERIFY' => FilledButton(
        onPressed: onPressed,
        style: AppStatusButtonStyle.filled(context, AppStatusTone.success),
        child: label,
      ),
      'REQUEST_SUPPLIER_RESCHEDULE' => FilledButton(
        onPressed: onPressed,
        style: AppStatusButtonStyle.filled(context, AppStatusTone.warning),
        child: label,
      ),
      'CANCEL_AND_RELEASE_HOLD' => OutlinedButton(
        onPressed: onPressed,
        style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger),
        child: label,
      ),
      'REJECT' => OutlinedButton(
        onPressed: onPressed,
        style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger),
        child: label,
      ),
      _ => OutlinedButton(onPressed: onPressed, child: label),
    };
  }
}

class _IncidentGrid extends StatelessWidget {
  const _IncidentGrid({required this.report, required this.width});

  final AdminNoShowReportDetail report;
  final double width;

  @override
  Widget build(BuildContext context) {
    final overview = _IncidentOverviewCard(report: report);
    final happened = _WhatHappenedCard(report: report);
    final messages = _MessagesCard(messages: report.messages);
    final reservation = _ReservationStatusCard(report: report);
    final activity = _TimelineCard(
      title: 'Activity timeline',
      entries: report.activityHistory,
      emptyText: 'No activity recorded',
      delivery: false,
    );
    final delivery = report.deliveryId == null
        ? null
        : _TimelineCard(
            title: 'Linked delivery timeline',
            entries: report.deliveryTimeline,
            emptyText: 'No delivery activity recorded',
            delivery: true,
          );

    if (width >= 1360) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 20, child: overview),
          const SizedBox(width: AppSpacing.sm),
          Expanded(flex: 31, child: _StackedCards(cards: [happened, messages])),
          const SizedBox(width: AppSpacing.sm),
          Expanded(flex: 22, child: reservation),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            flex: 27,
            child: _StackedCards(cards: [activity, ?delivery]),
          ),
        ],
      );
    }
    if (width >= 760) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: _StackedCards(cards: [overview, reservation, messages]),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: _StackedCards(cards: [happened, activity, ?delivery]),
          ),
        ],
      );
    }
    return _StackedCards(
      cards: [overview, happened, reservation, messages, activity, ?delivery],
    );
  }
}

class _StackedCards extends StatelessWidget {
  const _StackedCards({required this.cards});

  final List<Widget> cards;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children:
        cards
            .expand((card) => [card, const SizedBox(height: AppSpacing.sm)])
            .toList()
          ..removeLast(),
  );
}

class _WorkspaceCard extends StatelessWidget {
  const _WorkspaceCard({required this.title, required this.child, this.icon});

  final String title;
  final Widget child;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => AppSectionCard(
    padding: const EdgeInsets.all(AppSpacing.md),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            if (icon != null) ...[
              Icon(icon, size: 17),
              const SizedBox(width: AppSpacing.xs),
            ],
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        child,
      ],
    ),
  );
}

class _IncidentOverviewCard extends StatelessWidget {
  const _IncidentOverviewCard({required this.report});
  final AdminNoShowReportDetail report;

  @override
  Widget build(BuildContext context) => _WorkspaceCard(
    title: 'Incident overview',
    icon: Icons.report_outlined,
    child: Column(
      children: [
        _KeyValue(
          label: 'Workflow type',
          value: incidentWorkflowLabel(report.workflowType),
        ),
        _KeyValue(
          label: 'Target',
          value: report.targetRole.toUpperCase() == 'SYSTEM'
              ? 'System · no individual target'
              : report.hasIndividualTarget
              ? '${report.targetName} · ${_label(report.targetRole)}'
              : 'Target unavailable',
        ),
        _KeyValue(label: 'Strike impact', value: _strikeLabel(report)),
        _KeyValue(
          label: 'Operational state',
          value: incidentOperationalStateLabel(report.operationalState),
        ),
        _KeyValue(
          label: 'Reviewed',
          value: report.reviewedAt == null
              ? 'Not reviewed'
              : '${report.reviewedByName?.trim().isNotEmpty == true ? report.reviewedByName : 'Admin'} · ${_formatDateTime(report.reviewedAt!)}',
        ),
        _KeyValue(
          label: 'Delivery',
          value: report.deliveryId == null ? '—' : context.l10n.viewDelivery,
          link: report.deliveryId == null
              ? null
              : () => context.push(
                  '/admin/deliveries?open=${Uri.encodeComponent(report.deliveryId!)}',
                ),
        ),
        _KeyValue(label: 'Material', value: report.materialTitle),
        _KeyValue(
          label: 'Quantity',
          value: report.quantityStatus == null
              ? '—'
              : '${_quantity(report.quantityStatus!.heldQuantity)} held',
          last: true,
        ),
      ],
    ),
  );
}

class _KeyValue extends StatelessWidget {
  const _KeyValue({
    required this.label,
    required this.value,
    this.link,
    this.last = false,
  });
  final String label;
  final String value;
  final VoidCallback? link;
  final bool last;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
    margin: EdgeInsetsDirectional.only(bottom: last ? 0 : AppSpacing.sm),
    decoration: last
        ? null
        : BoxDecoration(
            border: Border(
              bottom: BorderSide(color: Theme.of(context).dividerColor),
            ),
          ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(label, style: Theme.of(context).textTheme.labelSmall),
        ),
        const SizedBox(width: AppSpacing.sm),
        Flexible(
          child: link == null
              ? Text(
                  value,
                  textAlign: TextAlign.end,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
                )
              : TextButton(
                  onPressed: link,
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(value, textAlign: TextAlign.end),
                ),
        ),
      ],
    ),
  );
}

class _WhatHappenedCard extends StatefulWidget {
  const _WhatHappenedCard({required this.report});
  final AdminNoShowReportDetail report;
  @override
  State<_WhatHappenedCard> createState() => _WhatHappenedCardState();
}

class _WhatHappenedCardState extends State<_WhatHappenedCard> {
  var _expanded = false;

  @override
  Widget build(BuildContext context) {
    final report = widget.report;
    final note = report.note?.trim().isNotEmpty == true
        ? report.note!.trim()
        : 'No description recorded.';
    return _WorkspaceCard(
      title: 'What happened',
      icon: Icons.info_outline_rounded,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            note,
            maxLines: _expanded ? null : 4,
            overflow: _expanded ? null : TextOverflow.ellipsis,
          ),
          if (report.reviewNote?.trim().isNotEmpty == true) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Review note: ${report.reviewNote!.trim()}',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (note.length > 180)
            TextButton(
              onPressed: () => setState(() => _expanded = !_expanded),
              child: Text(_expanded ? 'Show less' : 'Read more'),
            ),
          const SizedBox(height: AppSpacing.sm),
          LayoutBuilder(
            builder: (context, constraints) {
              final vertical = constraints.maxWidth < 460;
              final items = [
                _MetaTile(label: 'Pickup window', value: _pickupWindow(report)),
                _MetaTile(
                  label: 'Fulfillment',
                  value: _fulfillmentLabel(report.fulfillmentMethod),
                ),
                _MetaTile(
                  label: 'Reported reason',
                  value: humanizeEnum(report.reasonCode),
                ),
              ];
              return vertical
                  ? Column(children: items)
                  : Row(
                      children: items
                          .map((item) => Expanded(child: item))
                          .toList(growable: false),
                    );
            },
          ),
        ],
      ),
    );
  }
}

class _MetaTile extends StatelessWidget {
  const _MetaTile({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsetsDirectional.only(
      end: AppSpacing.sm,
      top: AppSpacing.sm,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.labelSmall),
        const SizedBox(height: AppSpacing.xs),
        Text(
          value,
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
        ),
      ],
    ),
  );
}

class _MessagesCard extends StatelessWidget {
  const _MessagesCard({required this.messages});
  final List<AdminNoShowReportMessage> messages;
  @override
  Widget build(BuildContext context) => _WorkspaceCard(
    title: 'Messages',
    icon: Icons.chat_bubble_outline_rounded,
    child: messages.isEmpty
        ? Text(
            'No messages recorded',
            style: Theme.of(context).textTheme.bodySmall,
          )
        : Column(
            children: messages
                .take(5)
                .map(
                  (message) => Padding(
                    padding: const EdgeInsetsDirectional.only(
                      bottom: AppSpacing.md,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                message.senderName,
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(fontWeight: FontWeight.w800),
                              ),
                            ),
                            Text(
                              _formatDateTime(message.createdAt),
                              style: Theme.of(context).textTheme.labelSmall,
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          message.body,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                )
                .toList(growable: false),
          ),
  );
}

class _ReservationStatusCard extends StatelessWidget {
  const _ReservationStatusCard({required this.report});
  final AdminNoShowReportDetail report;
  @override
  Widget build(BuildContext context) => _WorkspaceCard(
    title: 'Reservation status',
    icon: Icons.inventory_2_outlined,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppStatusBadge(
          label: monitoringStatusLabel(report.reservationStatus),
          tone: _reservationTone(report.reservationStatus),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          _reservationExplanation(report),
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: AppSpacing.md),
        _KeyValue(
          label: 'Pending reschedule',
          value: _pendingReschedule(report.pendingReschedule),
        ),
        _KeyValue(
          label: 'Hold status',
          value: report.quantityStatus == null
              ? '—'
              : '${_quantity(report.quantityStatus!.heldQuantity)} held · ${_quantity(report.quantityStatus!.availableQuantity)} available',
        ),
        _KeyValue(
          label: 'Fulfillment method',
          value: _fulfillmentLabel(report.fulfillmentMethod),
        ),
        _KeyValue(
          label: 'Assigned driver',
          value: report.assignedDriverName?.trim().isNotEmpty == true
              ? report.assignedDriverName!
              : '—',
          last: true,
        ),
      ],
    ),
  );
}

class _TimelineCard extends StatelessWidget {
  const _TimelineCard({
    required this.title,
    required this.entries,
    required this.emptyText,
    required this.delivery,
  });
  final String title;
  final List<AdminNoShowReportActivityEntry> entries;
  final String emptyText;
  final bool delivery;

  @override
  Widget build(BuildContext context) => _WorkspaceCard(
    title: title,
    icon: delivery ? Icons.local_shipping_outlined : Icons.timeline_rounded,
    child: entries.isEmpty
        ? Text(emptyText, style: Theme.of(context).textTheme.bodySmall)
        : Column(
            children: entries
                .map(
                  (entry) => _TimelineEntry(entry: entry, delivery: delivery),
                )
                .toList(growable: false),
          ),
  );
}

class _TimelineEntry extends StatelessWidget {
  const _TimelineEntry({required this.entry, required this.delivery});
  final AdminNoShowReportActivityEntry entry;
  final bool delivery;
  @override
  Widget build(BuildContext context) {
    final state = monitoringStatusLabel(entry.newStatus);
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Icon(_timelineIcon(entry.newStatus, delivery), size: 18),
              Container(
                width: 1,
                height: 32,
                color: Theme.of(context).dividerColor,
              ),
            ],
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  state,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                if (entry.note?.trim().isNotEmpty == true)
                  Text(
                    entry.note!.trim(),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${_formatDateTime(entry.createdAt)}${entry.changedByName?.trim().isNotEmpty == true ? ' · ${entry.changedByName}' : ''}',
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _IncidentDetailSkeleton extends StatelessWidget {
  const _IncidentDetailSkeleton();
  @override
  Widget build(BuildContext context) => Column(
    children: [
      const _SkeletonCard(height: 146),
      const SizedBox(height: AppSpacing.md),
      Expanded(
        child: LayoutBuilder(
          builder: (_, constraints) => SingleChildScrollView(
            child: constraints.maxWidth > 900
                ? const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: _SkeletonCard(height: 360)),
                      SizedBox(width: AppSpacing.sm),
                      Expanded(child: _SkeletonCard(height: 420)),
                      SizedBox(width: AppSpacing.sm),
                      Expanded(child: _SkeletonCard(height: 340)),
                      SizedBox(width: AppSpacing.sm),
                      Expanded(child: _SkeletonCard(height: 440)),
                    ],
                  )
                : const Column(
                    children: [
                      _SkeletonCard(height: 260),
                      SizedBox(height: AppSpacing.sm),
                      _SkeletonCard(height: 300),
                      SizedBox(height: AppSpacing.sm),
                      _SkeletonCard(height: 260),
                    ],
                  ),
          ),
        ),
      ),
    ],
  );
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard({required this.height});
  final double height;
  @override
  Widget build(BuildContext context) =>
      AppSectionCard(height: height, child: const SizedBox.shrink());
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
    child: AppSectionCard(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              notFound ? Icons.search_off_rounded : Icons.error_outline_rounded,
              size: 38,
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              notFound
                  ? 'Incident report not found'
                  : 'Could not load incident report',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              notFound
                  ? 'This report may have been removed or the link is incorrect.'
                  : 'Please retry or return to Incident Reports.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              children: [
                if (!notFound)
                  FilledButton(
                    onPressed: onRetry,
                    child: Text(AdminL10n.of(context).retry),
                  ),
                OutlinedButton(
                  onPressed: onBack,
                  child: const Text('Back to Incident Reports'),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}

Future<bool?> _confirmAction(
  BuildContext context,
  AdminNoShowReportDetail report,
  String action,
) {
  final impact = _strikeLabel(report);
  final content = switch (action) {
    'VERIFY' =>
      impact == 'No individual strike'
          ? 'Verify this report. No individual strike will be applied.'
          : 'Verify responsibility. ${impact.isEmpty ? '' : '$impact.'}',
    'REJECT' =>
      'Reject this report. The reported responsibility will not be verified.',
    'RESOLVE_WITHOUT_STRIKE' =>
      'Resolve this report without applying a strike.',
    'REQUEST_SUPPLIER_RESCHEDULE' =>
      'Ask the supplier to provide a new pickup window. The reservation remains in its returned operational state.',
    'CANCEL_AND_RELEASE_HOLD' =>
      'Cancel the linked reservation and release its material hold. This cannot be undone from this page.',
    _ => 'Continue with this incident action?',
  };
  final tone = action == 'CANCEL_AND_RELEASE_HOLD' || action == 'REJECT'
      ? AppStatusTone.danger
      : action == 'REQUEST_SUPPLIER_RESCHEDULE'
      ? AppStatusTone.warning
      : AppStatusTone.success;
  return showDialog<bool>(
    context: context,
    builder: (dialogContext) => AppDialogShell(
      title: Text('${_actionLabel(action)}?'),
      content: Text(content),
      footer: AppDialogFooter.decision(
        secondaryAction: TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: Text(AdminL10n.of(context).cancel),
        ),
        primaryAction: FilledButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          style: AppStatusButtonStyle.filled(dialogContext, tone),
          child: Text(_actionLabel(action)),
        ),
      ),
    ),
  );
}

bool _supportedAction(String action) => isSupportedIncidentAction(action);

String _actionLabel(String action) => incidentActionLabel(action);

String _reportTitle(AdminNoShowReportItem report) =>
    incidentReasonTitle(report.reasonCode);

String _strikeLabel(AdminNoShowReportItem report) => incidentStrikeLabel(
  report.strikeImpact,
  report.status,
  hasTargetUser:
      report.targetRole.toUpperCase() == 'SYSTEM' || report.hasIndividualTarget,
);

String _fulfillmentLabel(String? value) =>
    value == null || value.trim().isEmpty ? '—' : _label(value);

String _reservationExplanation(AdminNoShowReportDetail report) {
  switch (report.reservationStatus.toUpperCase()) {
    case 'AWAITING_RESOLUTION':
      return 'The reservation is blocked until this incident is resolved.';
    case 'AWAITING_SUPPLIER_CONFIRMATION':
      return 'The reservation is waiting for supplier confirmation of the next pickup window.';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'This reservation is no longer active.';
    default:
      return report.operationalState.toUpperCase() == 'NOT_REQUIRED'
          ? 'The reservation remains in its current operational state.'
          : 'Current reservation state is shown from the incident response.';
  }
}

String _pendingReschedule(AdminNoShowReportPendingReschedule? value) {
  if (value == null) return 'No pending reschedule';
  if (value.proposedPickupWindowStart != null &&
      value.proposedPickupWindowEnd != null) {
    return '${_formatDateTime(value.proposedPickupWindowStart!)} – ${_formatTime(value.proposedPickupWindowEnd!)}';
  }
  return value.note?.trim().isNotEmpty == true
      ? value.note!.trim()
      : 'Pending reschedule';
}

String _pickupWindow(AdminNoShowReportDetail report) {
  if (report.pickupWindowStart == null || report.pickupWindowEnd == null)
    return '—';
  return '${_formatDateTime(report.pickupWindowStart!)} – ${_formatTime(report.pickupWindowEnd!)}';
}

AppStatusTone _reservationTone(String status) {
  final normalized = status.toUpperCase();
  if (normalized.contains('AWAITING') || normalized.contains('PENDING'))
    return AppStatusTone.warning;
  if (normalized.contains('CANCEL') ||
      normalized.contains('EXPIRE') ||
      normalized.contains('FAIL'))
    return AppStatusTone.danger;
  if (normalized.contains('COMPLETE') || normalized.contains('ACCEPT'))
    return AppStatusTone.success;
  return AppStatusTone.neutral;
}

IconData _timelineIcon(String status, bool delivery) {
  final normalized = status.toUpperCase();
  if (normalized.contains('FAIL') || normalized.contains('CANCEL'))
    return Icons.error_outline_rounded;
  if (normalized.contains('COMPLETE') ||
      normalized.contains('DELIVER') ||
      normalized.contains('PICKED'))
    return Icons.check_circle_outline_rounded;
  if (normalized.contains('ASSIGN') || normalized.contains('SCHEDULE'))
    return delivery
        ? Icons.local_shipping_outlined
        : Icons.assignment_ind_outlined;
  return Icons.circle_outlined;
}

String _quantity(double value) => value == value.roundToDouble()
    ? value.toInt().toString()
    : value.toStringAsFixed(1);

String _label(String value) {
  final words = value
      .trim()
      .split(RegExp(r'[_\s]+'))
      .where((word) => word.isNotEmpty);
  return words
      .map(
        (word) => '${word[0].toUpperCase()}${word.substring(1).toLowerCase()}',
      )
      .join(' ');
}

String _formatDateTime(DateTime value) {
  final local = value.toLocal();
  const months = [
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
  return '${months[local.month - 1]} ${local.day}, ${local.year} ${_formatTime(local)}';
}

String _formatTime(DateTime value) {
  final local = value.toLocal();
  final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final minute = local.minute.toString().padLeft(2, '0');
  return '$hour:$minute ${local.hour >= 12 ? 'PM' : 'AM'}';
}
