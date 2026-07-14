import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/incident_report_status_presentation.dart';
import '../../data/admin_no_show_reports_api.dart';
import '../theme/admin_decoration_set.dart';
import '../widgets/admin_empty_state.dart';
import '../widgets/admin_kpi_card.dart';

const _pageSize = 10;
const _tableBreakpoint = 1180.0;
const _tableFlexes = <int>[37, 21, 23, 15, 15, 8];

class _IncidentQuery {
  const _IncidentQuery({required this.status, required this.page});

  final String? status;
  final int page;

  @override
  bool operator ==(Object other) =>
      other is _IncidentQuery && other.status == status && other.page == page;

  @override
  int get hashCode => Object.hash(status, page);
}

final _incidentReportsProvider = FutureProvider.autoDispose
    .family<AdminNoShowReportsListResponse, _IncidentQuery>((ref, query) {
  return ref.watch(adminNoShowReportsApiProvider).fetchReports(
        status: query.status,
        page: query.page,
        limit: _pageSize,
      );
});

final _incidentSummaryProvider = FutureProvider.autoDispose
    .family<_IncidentSummary, String?>((ref, selectedStatus) async {
  final api = ref.watch(adminNoShowReportsApiProvider);
  if (selectedStatus != null) {
    final response = await api.fetchReports(status: selectedStatus, limit: 100);
    return _IncidentSummary.fromScopedResponse(response, selectedStatus);
  }
  final responses = await Future.wait([
    api.fetchReports(status: 'PENDING_REVIEW', limit: 1),
    api.fetchReports(status: 'VERIFIED', limit: 1),
    api.fetchReports(status: 'REJECTED', limit: 1),
    api.fetchReports(status: 'RESOLVED_NO_STRIKE', limit: 1),
    api.fetchReports(limit: 100),
  ]);
  return _IncidentSummary.fromAllResponses(responses);
});

class _IncidentSummary {
  const _IncidentSummary({
    required this.total,
    required this.pending,
    required this.resolved,
    required this.operationalRequired,
  });

  final int total;
  final int pending;
  final int resolved;
  final int? operationalRequired;

  factory _IncidentSummary.fromScopedResponse(
    AdminNoShowReportsListResponse response,
    String status,
  ) {
    final complete = response.total <= response.items.length;
    return _IncidentSummary(
      total: response.total,
      pending: status == 'PENDING_REVIEW' ? response.total : 0,
      resolved: status == 'PENDING_REVIEW' ? 0 : response.total,
      operationalRequired: complete
          ? response.items
              .where((item) => item.operationalState == 'REQUIRES_RESOLUTION')
              .length
          : null,
    );
  }

  factory _IncidentSummary.fromAllResponses(
    List<AdminNoShowReportsListResponse> responses,
  ) {
    final total = responses
        .take(4)
        .fold<int>(0, (sum, response) => sum + response.total);
    final allReports = responses[4];
    final complete = allReports.total <= allReports.items.length;
    return _IncidentSummary(
      total: total,
      pending: responses.first.total,
      resolved: (total - responses.first.total).clamp(0, total),
      operationalRequired: complete
          ? allReports.items
              .where((item) => item.operationalState == 'REQUIRES_RESOLUTION')
              .length
          : null,
    );
  }
}

class AdminNoShowReportsPage extends ConsumerStatefulWidget {
  const AdminNoShowReportsPage({super.key, this.initialOpenReportId});

  final String? initialOpenReportId;

  @override
  ConsumerState<AdminNoShowReportsPage> createState() =>
      _AdminNoShowReportsPageState();
}

class _AdminNoShowReportsPageState
    extends ConsumerState<AdminNoShowReportsPage> {
  final _searchController = TextEditingController();
  String _status = 'ALL';
  String _workflow = 'ALL';
  String _target = 'ALL';
  String _operational = 'ALL';
  DateTimeRange? _dateRange;
  int _page = 1;
  var _initialOpenHandled = false;

  @override
  void initState() {
    super.initState();
    final reportId = widget.initialOpenReportId?.trim();
    if (reportId != null && reportId.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_initialOpenHandled || !mounted) return;
        _initialOpenHandled = true;
        _openIncident(reportId, replace: true);
      });
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  _IncidentQuery get _query => _IncidentQuery(
        status: _status == 'ALL' ? null : _status,
        page: _page,
      );

  String? get _summaryStatus => _status == 'ALL' ? null : _status;

  bool get _hasLocalFilters =>
      _searchController.text.trim().isNotEmpty ||
      _workflow != 'ALL' ||
      _target != 'ALL' ||
      _operational != 'ALL' ||
      _dateRange != null;

  bool get _hasActiveFilters => _hasLocalFilters || _status != 'ALL';

  void _resetFilters() {
    setState(() {
      _searchController.clear();
      _status = 'ALL';
      _workflow = 'ALL';
      _target = 'ALL';
      _operational = 'ALL';
      _dateRange = null;
      _page = 1;
    });
  }

  void _refresh() {
    ref.invalidate(_incidentReportsProvider(_query));
    ref.invalidate(_incidentSummaryProvider(_summaryStatus));
  }

  Future<void> _pickDateRange() async {
    final range = await showDateRangePicker(
      context: context,
      initialDateRange: _dateRange,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (range != null && mounted) setState(() => _dateRange = range);
  }

  void _openIncident(String id, {bool replace = false}) {
    final location = '/admin/no-show-reports/${Uri.encodeComponent(id)}';
    if (replace) {
      context.go(location);
    } else {
      context.push(location);
    }
  }

  List<AdminNoShowReportItem> _filteredItems(
    List<AdminNoShowReportItem> reports,
  ) {
    final search = _searchController.text.trim().toLowerCase();
    return reports.where((report) {
      final searchable = [
        report.id,
        report.materialTitle,
        report.learnerName,
        report.supplierName,
        report.targetName,
      ].join(' ').toLowerCase();
      final date = report.createdAt.toLocal();
      final matchesDate = _dateRange == null ||
          (!date.isBefore(_dateRange!.start) &&
              date.isBefore(_dateRange!.end.add(const Duration(days: 1))));
      return (search.isEmpty || searchable.contains(search)) &&
          (_workflow == 'ALL' || report.workflowType == _workflow) &&
          (_target == 'ALL' || report.targetRole == _target) &&
          (_operational == 'ALL' ||
              report.operationalState == _operational) &&
          matchesDate;
    }).toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final isShellCompact = MediaQuery.sizeOf(context).width < 920;
    final reportsAsync = ref.watch(_incidentReportsProvider(_query));
    final summaryAsync = ref.watch(_incidentSummaryProvider(_summaryStatus));

    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        padding: EdgeInsetsDirectional.only(
          start: isShellCompact ? AppSpacing.lg : 0,
          end: isShellCompact ? AppSpacing.lg : 0,
          top: AppSpacing.lg,
          bottom: AppSpacing.lg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Review reservation and delivery incidents, determine accountability, and resolve blocked workflows.',
              style: AdminTypography.pageSubtitle(context.adminPalette),
            ),
            const SizedBox(height: AppSpacing.lg),
            _KpiSection(summary: summaryAsync, width: constraints.maxWidth),
            const SizedBox(height: AppSpacing.lg),
            _IncidentFilters(
              width: constraints.maxWidth,
              searchController: _searchController,
              status: _status,
              workflow: _workflow,
              target: _target,
              operational: _operational,
              dateRange: _dateRange,
              resetEnabled: _hasActiveFilters,
              onSearchChanged: (_) => setState(() {}),
              onStatusChanged: (value) => setState(() {
                _status = value;
                _page = 1;
              }),
              onWorkflowChanged: (value) => setState(() => _workflow = value),
              onTargetChanged: (value) => setState(() => _target = value),
              onOperationalChanged: (value) =>
                  setState(() => _operational = value),
              onDateRangePressed: _pickDateRange,
              onReset: _resetFilters,
            ),
            const SizedBox(height: AppSpacing.lg),
            reportsAsync.when(
              loading: () => const _IncidentTableSkeleton(),
              error: (error, stackTrace) => _ErrorPanel(onRetry: _refresh),
              data: (response) {
                final items = _filteredItems(response.items);
                if (items.isEmpty) {
                  return _IncidentEmptyState(
                    hasFilters: _hasActiveFilters,
                    onReset: _resetFilters,
                  );
                }
                return _IncidentResults(
                  items: items,
                  response: response,
                  localFiltersActive: _hasLocalFilters,
                  desktopTable: constraints.maxWidth >= _tableBreakpoint,
                  onView: _openIncident,
                  onPage: (page) => setState(() => _page = page),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _KpiSection extends StatelessWidget {
  const _KpiSection({required this.summary, required this.width});

  final AsyncValue<_IncidentSummary> summary;
  final double width;

  @override
  Widget build(BuildContext context) {
    final data = summary.asData?.value;
    final scheme = Theme.of(context).colorScheme;
    final cards = [
      _KpiData(
        'Total',
        data?.total.toString() ?? '—',
        'All incidents',
        Icons.inventory_2_outlined,
        scheme.primary,
      ),
      _KpiData(
        'Pending review',
        data?.pending.toString() ?? '—',
        'Awaiting action',
        Icons.pending_actions_outlined,
        scheme.tertiary,
      ),
      _KpiData(
        'Operational required',
        data?.operationalRequired?.toString() ?? '—',
        data?.operationalRequired == null ? 'Unavailable in summary' : 'Need recovery action',
        Icons.health_and_safety_outlined,
        scheme.secondary,
      ),
      _KpiData(
        'Resolved',
        data?.resolved.toString() ?? '—',
        'No further action',
        Icons.task_alt_outlined,
        context.adminPalette.purple,
      ),
    ];
    final columns = width >= 980 ? 4 : width >= 520 ? 2 : 1;
    final cardWidth =
        (width - ((columns - 1) * AppSpacing.md)) / columns;
    return Wrap(
      spacing: AppSpacing.md,
      runSpacing: AppSpacing.md,
      children: cards
          .map(
            (data) => SizedBox(
              width: cardWidth,
              height: 104,
              child: _CompactKpiCard(data: data),
            ),
          )
          .toList(growable: false),
    );
  }
}

class _KpiData {
  const _KpiData(this.label, this.value, this.helper, this.icon, this.accent);
  final String label;
  final String value;
  final String helper;
  final IconData icon;
  final Color accent;
}

class _CompactKpiCard extends StatelessWidget {
  const _CompactKpiCard({required this.data});

  final _KpiData data;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(14, 14, 14, 14),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: data.accent.withValues(alpha: .24)),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: palette.isDark ? 7 : 9,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: data.accent.withValues(alpha: palette.isDark ? .18 : .12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(data.icon, color: data.accent, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(data.label, style: AdminTypography.kpiLabel(palette)),
                const SizedBox(height: 1),
                Text(
                  data.value,
                  style: AdminTypography.kpiValue(palette).copyWith(fontSize: 22),
                ),
                Text(
                  data.helper,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AdminTypography.kpiHelper(palette),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _IncidentFilters extends StatelessWidget {
  const _IncidentFilters({
    required this.width,
    required this.searchController,
    required this.status,
    required this.workflow,
    required this.target,
    required this.operational,
    required this.dateRange,
    required this.resetEnabled,
    required this.onSearchChanged,
    required this.onStatusChanged,
    required this.onWorkflowChanged,
    required this.onTargetChanged,
    required this.onOperationalChanged,
    required this.onDateRangePressed,
    required this.onReset,
  });

  final double width;
  final TextEditingController searchController;
  final String status;
  final String workflow;
  final String target;
  final String operational;
  final DateTimeRange? dateRange;
  final bool resetEnabled;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<String> onStatusChanged;
  final ValueChanged<String> onWorkflowChanged;
  final ValueChanged<String> onTargetChanged;
  final ValueChanged<String> onOperationalChanged;
  final VoidCallback onDateRangePressed;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final search = _SearchField(
      controller: searchController,
      onChanged: onSearchChanged,
    );
    final workflowField = _FilterDropdown(
      label: 'Workflow type',
      value: workflow,
      entries: const {
        'ALL': 'All types',
        'ACCOUNTABILITY': 'Accountability',
        'SYSTEM_RECOVERY': 'System recovery',
        'ACCOUNTABILITY_AND_RECOVERY': 'Accountability + recovery',
      },
      onChanged: onWorkflowChanged,
    );
    final statusField = _FilterDropdown(
      label: 'Status',
      value: status,
      entries: const {
        'ALL': 'All statuses',
        'PENDING_REVIEW': 'Pending review',
        'VERIFIED': 'Verified',
        'REJECTED': 'Rejected',
        'RESOLVED_NO_STRIKE': 'Resolved without strike',
      },
      onChanged: onStatusChanged,
    );
    final targetField = _FilterDropdown(
      label: 'Target',
      value: target,
      entries: const {
        'ALL': 'All targets',
        'LEARNER': 'Learner',
        'SUPPLIER': 'Supplier',
        'DRIVER': 'Driver',
        'SYSTEM': 'System',
      },
      onChanged: onTargetChanged,
    );
    final operationalField = _FilterDropdown(
      label: 'Operational state',
      value: operational,
      entries: const {
        'ALL': 'All states',
        'NOT_REQUIRED': 'Not required',
        'REQUIRES_RESOLUTION': 'Requires resolution',
        'RESOLVED': 'Operationally resolved',
      },
      onChanged: onOperationalChanged,
    );
    final dateField = _DateRangeField(
      range: dateRange,
      onPressed: onDateRangePressed,
    );
    final reset = OutlinedButton.icon(
      onPressed: resetEnabled ? onReset : null,
      icon: const Icon(Icons.restart_alt, size: 17),
      label: const Text('Reset'),
    );

    Widget body;
    if (width >= 1220) {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(flex: 27, child: search),
              const SizedBox(width: 12),
              SizedBox(width: 176, child: workflowField),
              const SizedBox(width: 12),
              SizedBox(width: 156, child: statusField),
              const SizedBox(width: 12),
              SizedBox(width: 156, child: targetField),
              const SizedBox(width: 12),
              SizedBox(width: 184, child: operationalField),
              const SizedBox(width: 12),
              SizedBox(width: 166, child: dateField),
            ],
          ),
          const SizedBox(height: 10),
          reset,
        ],
      );
    } else if (width >= 720) {
      body = Column(
        children: [
          Row(
            children: [
              Expanded(child: search),
              const SizedBox(width: 12),
              SizedBox(width: 176, child: workflowField),
              const SizedBox(width: 12),
              SizedBox(width: 156, child: statusField),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: targetField),
              const SizedBox(width: 12),
              Expanded(child: operationalField),
              const SizedBox(width: 12),
              SizedBox(width: 166, child: dateField),
              const SizedBox(width: 12),
              reset,
            ],
          ),
        ],
      );
    } else {
      body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          search,
          const SizedBox(height: 10),
          workflowField,
          const SizedBox(height: 10),
          statusField,
          const SizedBox(height: 10),
          targetField,
          const SizedBox(height: 10),
          operationalField,
          const SizedBox(height: 10),
          dateField,
          const SizedBox(height: 10),
          Align(alignment: AlignmentDirectional.centerStart, child: reset),
        ],
      );
    }

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: context.adminPalette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.adminPalette.cardBorder),
      ),
      child: body,
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.onChanged});
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 52,
        child: TextField(
          controller: controller,
          onChanged: onChanged,
          maxLines: 1,
          decoration: const InputDecoration(
            hintText: 'Search by material, learner, supplier, or report ID...',
            prefixIcon: Icon(Icons.search),
            border: OutlineInputBorder(),
          ),
        ),
      );
}

class _FilterDropdown extends StatelessWidget {
  const _FilterDropdown({
    required this.label,
    required this.value,
    required this.entries,
    required this.onChanged,
  });
  final String label;
  final String value;
  final Map<String, String> entries;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 52,
        child: DropdownButtonFormField<String>(
          key: ValueKey('$label:$value'),
          initialValue: value,
          isExpanded: true,
          decoration: InputDecoration(
            labelText: label,
            border: const OutlineInputBorder(),
          ),
          items: entries.entries
              .map(
                (entry) => DropdownMenuItem(
                  value: entry.key,
                  child: Text(entry.value, overflow: TextOverflow.ellipsis),
                ),
              )
              .toList(growable: false),
          onChanged: (next) {
            if (next != null) onChanged(next);
          },
        ),
      );
}

class _DateRangeField extends StatelessWidget {
  const _DateRangeField({required this.range, required this.onPressed});
  final DateTimeRange? range;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final label = range == null
        ? 'All time'
        : '${DateFormat.MMMd().format(range!.start)} – ${DateFormat.MMMd().format(range!.end)}';
    return SizedBox(
      height: 52,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(4),
        child: InputDecorator(
          decoration: const InputDecoration(
            labelText: 'Date range',
            border: OutlineInputBorder(),
            suffixIcon: Icon(Icons.calendar_today_outlined, size: 18),
          ),
          child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
      ),
    );
  }
}

class _IncidentResults extends StatelessWidget {
  const _IncidentResults({
    required this.items,
    required this.response,
    required this.localFiltersActive,
    required this.desktopTable,
    required this.onView,
    required this.onPage,
  });
  final List<AdminNoShowReportItem> items;
  final AdminNoShowReportsListResponse response;
  final bool localFiltersActive;
  final bool desktopTable;
  final ValueChanged<String> onView;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) => Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: context.adminPalette.cardBackground,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: context.adminPalette.cardBorder),
        ),
        child: Column(
          children: [
            if (desktopTable) ...[
              const _TableHeader(),
              ...items.map(
                (report) => _TableRow(report: report, onView: onView),
              ),
            ] else
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: items
                      .map(
                        (report) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _IncidentCard(report: report, onView: onView),
                        ),
                      )
                      .toList(growable: false),
                ),
              ),
            _PaginationFooter(
              response: response,
              shown: items.length,
              locallyRefined: localFiltersActive,
              onPage: onPage,
            ),
          ],
        ),
      );
}

List<Widget> _tableCells(List<Widget> children) => List.generate(
      children.length,
      (index) => Expanded(
        flex: _tableFlexes[index],
        child: Padding(
          padding: const EdgeInsetsDirectional.only(end: 10),
          child: children[index],
        ),
      ),
    );

class _TableHeader extends StatelessWidget {
  const _TableHeader();
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    const labels = ['Incident', 'Target', 'Workflow', 'Status', 'Created', 'Actions'];
    return Container(
      height: 46,
      padding: const EdgeInsetsDirectional.fromSTEB(16, 0, 12, 0),
      decoration: BoxDecoration(
        color: palette.isDark
            ? palette.cardBackground
            : Theme.of(context).colorScheme.surfaceContainerLowest,
        border: Border(bottom: BorderSide(color: palette.cardBorder)),
      ),
      child: Row(
        children: _tableCells(
          labels
              .map(
                (label) => Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: Text(label, style: AdminTypography.kpiLabel(palette)),
                ),
              )
              .toList(growable: false),
        ),
      ),
    );
  }
}

class _TableRow extends StatelessWidget {
  const _TableRow({required this.report, required this.onView});
  final AdminNoShowReportItem report;
  final ValueChanged<String> onView;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: () => onView(report.id),
        child: Container(
          constraints: const BoxConstraints(minHeight: 72),
          padding: const EdgeInsetsDirectional.fromSTEB(16, 10, 12, 10),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: context.adminPalette.cardBorder)),
          ),
          child: Row(
            children: _tableCells([
              _IncidentIdentity(report: report),
              _TargetCell(report: report),
              _WorkflowCell(report: report),
              _StatusCell(status: report.status),
              _CreatedCell(createdAt: report.createdAt),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: IconButton(
                  tooltip: 'View incident',
                  onPressed: () => onView(report.id),
                  icon: const Icon(Icons.visibility_outlined),
                ),
              ),
            ]),
          ),
        ),
      );
}

class _IncidentCard extends StatelessWidget {
  const _IncidentCard({required this.report, required this.onView});
  final AdminNoShowReportItem report;
  final ValueChanged<String> onView;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          border: Border.all(color: context.adminPalette.cardBorder),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _IncidentIdentity(report: report),
            const SizedBox(height: 12),
            _WorkflowCell(report: report),
            const SizedBox(height: 12),
            _CardLine(label: 'Target', child: _TargetCell(report: report)),
            _CardLine(label: 'Status', child: _StatusCell(status: report.status)),
            _CardLine(label: 'Created', child: _CreatedCell(createdAt: report.createdAt)),
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: IconButton(
                tooltip: 'View incident',
                onPressed: () => onView(report.id),
                icon: const Icon(Icons.visibility_outlined),
              ),
            ),
          ],
        ),
      );
}

class _IncidentIdentity extends StatelessWidget {
  const _IncidentIdentity({required this.report});
  final AdminNoShowReportItem report;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final material = report.materialTitle.trim();
    final metadata = material.isEmpty
        ? shortIdentifier(report.id)
        : '${shortIdentifier(report.id)} · $material';
    return Row(
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primaryContainer,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            incidentReasonIcon(report.reasonCode),
            color: Theme.of(context).colorScheme.primary,
            size: 21,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                incidentReasonTitle(report.reasonCode),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AdminTypography.sectionTitle(palette).copyWith(fontSize: 14),
              ),
              const SizedBox(height: 2),
              Tooltip(
                message: '${report.id} · ${report.materialTitle}',
                child: Text(
                  metadata,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AdminTypography.kpiHelper(palette),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TargetCell extends StatelessWidget {
  const _TargetCell({required this.report});
  final AdminNoShowReportItem report;
  @override
  Widget build(BuildContext context) {
    final isSystem = report.targetRole == 'SYSTEM';
    final isAvailable = isSystem || report.hasIndividualTarget;
    final name = isSystem
        ? 'System'
        : isAvailable
            ? report.targetName
            : 'Target unavailable';
    final role = isSystem
        ? 'No individual target'
        : incidentTargetRoleLabel(report.targetRole);
    return Row(
      children: [
        CircleAvatar(
          radius: 16,
          backgroundColor: Theme.of(context).colorScheme.secondaryContainer,
          child: Text(name.isEmpty ? '?' : name.substring(0, 1).toUpperCase()),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AdminTypography.pageSubtitle(context.adminPalette)
                    .copyWith(fontSize: 13),
              ),
              Text(
                role,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AdminTypography.kpiHelper(context.adminPalette),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _WorkflowCell extends StatelessWidget {
  const _WorkflowCell({required this.report});
  final AdminNoShowReportItem report;
  @override
  Widget build(BuildContext context) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Tooltip(
            message: incidentWorkflowLabel(report.workflowType),
            child: AppStatusBadge(
              label: incidentWorkflowLabel(report.workflowType),
              tone: incidentWorkflowTone(report.workflowType),
            ),
          ),
          const SizedBox(height: 5),
          AppStatusBadge(
            label: incidentOperationalStateLabel(report.operationalState),
            tone: incidentOperationalStateTone(report.operationalState),
          ),
        ],
      );
}

class _StatusCell extends StatelessWidget {
  const _StatusCell({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) => Align(
        alignment: AlignmentDirectional.centerStart,
        child: AppStatusBadge(
          label: incidentReportStatusLabel(status),
          tone: incidentReportStatusTone(status),
        ),
      );
}

class _CreatedCell extends StatelessWidget {
  const _CreatedCell({required this.createdAt});
  final DateTime createdAt;
  @override
  Widget build(BuildContext context) {
    final date = createdAt.toLocal();
    final textStyle = AdminTypography.kpiHelper(context.adminPalette);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(DateFormat.yMMMd().format(date), style: textStyle),
        Text(DateFormat.jm().format(date), style: textStyle),
      ],
    );
  }
}

class _CardLine extends StatelessWidget {
  const _CardLine({required this.label, required this.child});
  final String label;
  final Widget child;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 88,
              child: Text(
                label,
                style: AdminTypography.kpiHelper(context.adminPalette),
              ),
            ),
            Expanded(child: child),
          ],
        ),
      );
}

class _PaginationFooter extends StatelessWidget {
  const _PaginationFooter({
    required this.response,
    required this.shown,
    required this.locallyRefined,
    required this.onPage,
  });
  final AdminNoShowReportsListResponse response;
  final int shown;
  final bool locallyRefined;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) {
    final totalPages = response.totalPages ??
        ((response.total + response.limit - 1) ~/ response.limit).clamp(1, 9999);
    final first = response.total == 0 ? 0 : (response.page - 1) * response.limit + 1;
    final last = (first + shown - 1).clamp(0, response.total);
    final pageNumbers = <int>{1, totalPages, response.page}
      ..addAll([
        if (response.page > 1) response.page - 1,
        if (response.page < totalPages) response.page + 1,
      ]);
    final sortedPages = pageNumbers.toList()..sort();
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        runSpacing: 8,
        children: [
          Text(
            locallyRefined
                ? 'Showing $shown matching results on page ${response.page}'
                : 'Showing $first to $last of ${response.total} results',
            style: AdminTypography.kpiHelper(context.adminPalette),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                onPressed: response.page > 1
                    ? () => onPage(response.page - 1)
                    : null,
                icon: const Icon(Icons.chevron_left),
              ),
              ...sortedPages.map(
                (page) => Padding(
                  padding: const EdgeInsetsDirectional.only(start: 4),
                  child: page == response.page
                      ? FilledButton(
                          onPressed: null,
                          style: FilledButton.styleFrom(
                            minimumSize: const Size(36, 36),
                            padding: EdgeInsets.zero,
                          ),
                          child: Text('$page'),
                        )
                      : OutlinedButton(
                          onPressed: () => onPage(page),
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(36, 36),
                            padding: EdgeInsets.zero,
                          ),
                          child: Text('$page'),
                        ),
                ),
              ),
              IconButton(
                onPressed: response.page < totalPages
                    ? () => onPage(response.page + 1)
                    : null,
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _IncidentTableSkeleton extends StatelessWidget {
  const _IncidentTableSkeleton();
  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: context.adminPalette.cardBorder),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: List.generate(
          6,
          (index) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              children: _tableCells(
                List.generate(
                  _tableFlexes.length,
                  (cell) => Container(
                    height: 38,
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(7),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _IncidentEmptyState extends StatelessWidget {
  const _IncidentEmptyState({required this.hasFilters, required this.onReset});
  final bool hasFilters;
  final VoidCallback onReset;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          border: Border.all(color: context.adminPalette.cardBorder),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            const AdminEmptyState(
              icon: Icons.report_outlined,
              title: 'No incident reports found',
              subtitle: 'Try adjusting the current filters or review incidents again later.',
            ),
            if (hasFilters)
              TextButton(onPressed: onReset, child: const Text('Reset filters')),
          ],
        ),
      );
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(color: Theme.of(context).colorScheme.error),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline),
            const SizedBox(width: 10),
            const Expanded(child: Text('Could not load incident reports.')),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      );
}

String shortIdentifier(String id) {
  final value = id.trim();
  if (value.isEmpty) return '—';
  return value.length <= 10
      ? value
      : '${value.substring(0, 4)}…${value.substring(value.length - 4)}';
}
