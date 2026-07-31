import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/admin_deliveries_api.dart';
import '../../data/admin_reservations_api.dart' show AdminExportFormatEligibility;
import '../../data/models/admin_deliveries_models.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../theme/admin_decoration_set.dart';
import '../theme/admin_palette.dart';
import '../widgets/admin_empty_state.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;
import '../widgets/admin_monitoring_filters.dart';
import '../widgets/admin_monitoring_utils.dart';

class _DeliveryFilters {
  const _DeliveryFilters({
    required this.page,
    required this.search,
    required this.status,
    required this.scope,
    required this.assignment,
    required this.incidentState,
    required this.timeRange,
    this.customDateFrom,
    this.customDateTo,
  });

  final int page;
  final String search;
  final String status;
  final String scope;
  final String assignment;
  final String incidentState;
  final String timeRange;
  final String? customDateFrom;
  final String? customDateTo;

  static const limit = 20;

  _DeliveryFilters copyWith({
    int? page,
    String? search,
    String? status,
    String? scope,
    String? assignment,
    String? incidentState,
    String? timeRange,
    String? customDateFrom,
    String? customDateTo,
    bool clearCustomDates = false,
  }) {
    return _DeliveryFilters(
      page: page ?? this.page,
      search: search ?? this.search,
      status: status ?? this.status,
      scope: scope ?? this.scope,
      assignment: assignment ?? this.assignment,
      incidentState: incidentState ?? this.incidentState,
      timeRange: timeRange ?? this.timeRange,
      customDateFrom: clearCustomDates
          ? null
          : (customDateFrom ?? this.customDateFrom),
      customDateTo: clearCustomDates
          ? null
          : (customDateTo ?? this.customDateTo),
    );
  }

  bool get hasActiveFilters =>
      search.isNotEmpty ||
      status != 'ALL' ||
      scope != 'ALL' ||
      assignment != 'ALL' ||
      incidentState != 'ALL' ||
      timeRange != kTimeRangeAll ||
      (customDateFrom != null && customDateFrom!.isNotEmpty) ||
      (customDateTo != null && customDateTo!.isNotEmpty);
}

class _DeliveryFiltersNotifier extends Notifier<_DeliveryFilters> {
  @override
  _DeliveryFilters build() => const _DeliveryFilters(
    page: 1,
    search: '',
    status: 'ALL',
    scope: 'ALL',
    assignment: 'ALL',
    incidentState: 'ALL',
    timeRange: kTimeRangeAll,
  );

  void setPage(int page) => state = state.copyWith(page: page);
  void setSearch(String search) =>
      state = state.copyWith(page: 1, search: search);
  void setStatus(String status) =>
      state = state.copyWith(page: 1, status: status);
  void setScope(String scope) => state = state.copyWith(page: 1, scope: scope);
  void setAssignment(String assignment) =>
      state = state.copyWith(page: 1, assignment: assignment);
  void setIncidentState(String incidentState) =>
      state = state.copyWith(page: 1, incidentState: incidentState);
  void setTimeRange(String timeRange) => state = state.copyWith(
    page: 1,
    timeRange: timeRange,
    clearCustomDates: timeRange != kTimeRangeCustom,
  );
  void setCustomDateFrom(String? value) =>
      state = state.copyWith(page: 1, customDateFrom: value);
  void setCustomDateTo(String? value) =>
      state = state.copyWith(page: 1, customDateTo: value);
  void reset() => state = build();
}

final _deliveryFiltersProvider =
    NotifierProvider<_DeliveryFiltersNotifier, _DeliveryFilters>(
      _DeliveryFiltersNotifier.new,
    );

final adminDeliveriesListProvider = FutureProvider.autoDispose((ref) async {
  final filters = ref.watch(_deliveryFiltersProvider);
  final resolved = resolveDateRange(
    timeRange: filters.timeRange,
    customDateFrom: filters.customDateFrom,
    customDateTo: filters.customDateTo,
  );
  final skipDates =
      filters.timeRange == kTimeRangeCustom && resolved.error != null;

  return ref
      .read(adminDeliveriesApiProvider)
      .fetchDeliveries(
        page: filters.page,
        limit: _DeliveryFilters.limit,
        search: filters.search,
        status: filters.status,
        scope: filters.scope,
        assignment: filters.assignment,
        incidentState: filters.incidentState,
        dateFrom: skipDates ? null : resolved.dateFrom,
        dateTo: skipDates ? null : resolved.dateTo,
      );
});

String _formatLocationDetail(AdminDeliveryLocationDetail location) {
  final label = location.label?.trim();
  if (label != null && label.isNotEmpty) return label;
  final parts = [location.area, location.city, location.country]
      .map((part) => part?.trim())
      .whereType<String>()
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isNotEmpty) return parts.join(', ');
  final address = location.addressLine?.trim();
  if (address != null && address.isNotEmpty) return address;
  return '—';
}

String _formatCoords(num? latitude, num? longitude) {
  if (latitude == null || longitude == null) return '—';
  return '${latitude.toStringAsFixed(5)}, ${longitude.toStringAsFixed(5)}';
}

String _formatRouteLabel(AdminDeliveryListItem item) {
  final pickup = item.pickupArea?.trim();
  final dropoff = item.dropoffArea?.trim();
  final hasPickup = pickup != null && pickup.isNotEmpty;
  final hasDropoff = dropoff != null && dropoff.isNotEmpty;
  if (!hasPickup && !hasDropoff) return '—';
  return '${hasPickup ? pickup : '—'} → ${hasDropoff ? dropoff : '—'}';
}

class AdminDeliveriesPage extends ConsumerStatefulWidget {
  const AdminDeliveriesPage({super.key, this.initialOpenDeliveryId});

  final String? initialOpenDeliveryId;

  @override
  ConsumerState<AdminDeliveriesPage> createState() =>
      _AdminDeliveriesPageState();
}

class _AdminDeliveriesPageState extends ConsumerState<AdminDeliveriesPage> {
  final _searchController = TextEditingController();
  var _initialOpenHandled = false;
  var _isPreflightLoading = false;
  var _isDialogOpen = false;

  @override
  void initState() {
    super.initState();
    final openId = widget.initialOpenDeliveryId?.trim();
    if (openId != null && openId.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_initialOpenHandled) return;
        _initialOpenHandled = true;
        context.go('/admin/deliveries/${Uri.encodeComponent(openId)}');
      });
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _refresh() => ref.invalidate(adminDeliveriesListProvider);

  void _applySearch() {
    ref
        .read(_deliveryFiltersProvider.notifier)
        .setSearch(_searchController.text.trim());
  }

  void _showDetails(AdminDeliveryListItem item) =>
      context.push('/admin/deliveries/${Uri.encodeComponent(item.id)}');

  String _activeFilterSummary(_DeliveryFilters filters) {
    final parts = <String>[];
    if (filters.search.trim().isNotEmpty) {
      parts.add('Search: ${filters.search.trim()}');
    }
    if (filters.status != 'ALL') {
      parts.add('Status: ${filters.status}');
    }
    if (filters.scope != 'ALL') {
      parts.add('Scope: ${filters.scope}');
    }
    if (filters.assignment != 'ALL') {
      parts.add('Assignment: ${filters.assignment}');
    }
    if (filters.incidentState != 'ALL') {
      parts.add('Incident: ${filters.incidentState}');
    }
    if (filters.timeRange != kTimeRangeAll) {
      final resolved = resolveDateRange(
        timeRange: filters.timeRange,
        customDateFrom: filters.customDateFrom,
        customDateTo: filters.customDateTo,
      );
      if (resolved.dateFrom != null || resolved.dateTo != null) {
        parts.add(
          'Dates: ${resolved.dateFrom ?? '…'} → ${resolved.dateTo ?? '…'}',
        );
      } else {
        parts.add('Time range: ${filters.timeRange}');
      }
    }
    return parts.isEmpty ? 'No filters (all deliveries)' : parts.join(' · ');
  }

  Future<void> _exportDeliveries() async {
    if (!kIsWeb) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Export is available on Admin Web only.'),
        ),
      );
      return;
    }
    if (_isPreflightLoading || _isDialogOpen) return;

    final filters = ref.read(_deliveryFiltersProvider);
    final resolved = resolveDateRange(
      timeRange: filters.timeRange,
      customDateFrom: filters.customDateFrom,
      customDateTo: filters.customDateTo,
    );
    if (filters.timeRange == kTimeRangeCustom && resolved.error != null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(resolved.error!)),
      );
      return;
    }

    setState(() => _isPreflightLoading = true);
    final api = ref.read(adminDeliveriesApiProvider);

    try {
      final preflight = await api.preflightExport(
        search: filters.search,
        status: filters.status,
        assignment: filters.assignment,
        scope: filters.scope,
        incidentState: filters.incidentState,
        dateFrom: resolved.dateFrom,
        dateTo: resolved.dateTo,
      );

      if (!mounted) return;

      if (preflight.count == 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No deliveries match the current filters.'),
          ),
        );
        return;
      }

      _isDialogOpen = true;
      final selectedFormat = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => AdminDeliveriesExportDialog(
          count: preflight.count,
          filterSummary: _activeFilterSummary(filters),
          formats: preflight.formats,
          onDownload: (format) => api.downloadExport(
            format: format,
            search: filters.search,
            status: filters.status,
            assignment: filters.assignment,
            scope: filters.scope,
            incidentState: filters.incidentState,
            dateFrom: resolved.dateFrom,
            dateTo: resolved.dateTo,
          ),
        ),
      );
      _isDialogOpen = false;

      if (!mounted) return;
      if (selectedFormat == null) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Deliveries ${selectedFormat.toUpperCase()} export downloaded.',
          ),
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.displayMessage)),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isPreflightLoading = false;
          _isDialogOpen = false;
        });
      } else {
        _isPreflightLoading = false;
        _isDialogOpen = false;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final filters = ref.watch(_deliveryFiltersProvider);
    final deliveriesAsync = ref.watch(adminDeliveriesListProvider);
    final compact = MediaQuery.sizeOf(context).width < 1240;
    final dateRangeError = resolveDateRange(
      timeRange: filters.timeRange,
      customDateFrom: filters.customDateFrom,
      customDateTo: filters.customDateTo,
    ).error;

    return ColoredBox(
      color: palette.pageBackground,
      child: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.fromSTEB(20, 16, 20, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Monitor and manage material deliveries across assignment, pickup, transit, recovery, and completion.',
              style: AdminTypography.pageSubtitle(palette),
            ),
            const SizedBox(height: 20),
            deliveriesAsync.when(
              loading: () => const _DeliveriesLoadingSkeleton(),
              error: (error, _) => AdminMonitoringErrorPanel(
                title: 'Could not load deliveries.',
                message: error is ApiException
                    ? error.displayMessage
                    : error.toString(),
                onRetry: _refresh,
              ),
              data: (data) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _SummaryRow(summary: data.summary),
                  const SizedBox(height: 16),
                  _FiltersPanel(
                    searchController: _searchController,
                    filters: filters,
                    statuses: data.statuses,
                    dateRangeError: dateRangeError,
                    onSearch: _applySearch,
                    onStatusChanged: (value) => ref
                        .read(_deliveryFiltersProvider.notifier)
                        .setStatus(value),
                    onScopeChanged: (value) => ref
                        .read(_deliveryFiltersProvider.notifier)
                        .setScope(value),
                    onAssignmentChanged: (value) => ref
                        .read(_deliveryFiltersProvider.notifier)
                        .setAssignment(value),
                    onIncidentStateChanged: (value) => ref
                        .read(_deliveryFiltersProvider.notifier)
                        .setIncidentState(value),
                    onTimeRangeChanged: (value) => ref
                        .read(_deliveryFiltersProvider.notifier)
                        .setTimeRange(value),
                    onCustomDateFromChanged: (value) => ref
                        .read(_deliveryFiltersProvider.notifier)
                        .setCustomDateFrom(value),
                    onCustomDateToChanged: (value) => ref
                        .read(_deliveryFiltersProvider.notifier)
                        .setCustomDateTo(value),
                    onReset: () {
                      _searchController.clear();
                      ref.read(_deliveryFiltersProvider.notifier).reset();
                    },
                    onExport: kIsWeb ? _exportDeliveries : null,
                    exportLoading: _isPreflightLoading,
                  ),
                  const SizedBox(height: 16),
                  _ResultsHeader(total: data.pagination.total),
                  const SizedBox(height: 8),
                  if (data.items.isEmpty)
                    AdminEmptyState(
                      icon: Icons.local_shipping_outlined,
                      title: 'No deliveries found',
                      subtitle: 'No deliveries match the selected filters.',
                    )
                  else ...[
                    _DeliveriesTable(
                      items: data.items,
                      compact: compact,
                      onDetails: _showDetails,
                    ),
                    const SizedBox(height: 12),
                    _PaginationRow(
                      page: data.pagination.page,
                      totalPages: data.pagination.totalPages,
                      total: data.pagination.total,
                      limit: data.pagination.limit,
                      onPage: (page) => ref
                          .read(_deliveryFiltersProvider.notifier)
                          .setPage(page),
                      onPrevious: data.pagination.page > 1
                          ? () => ref
                                .read(_deliveryFiltersProvider.notifier)
                                .setPage(data.pagination.page - 1)
                          : null,
                      onNext: data.pagination.page < data.pagination.totalPages
                          ? () => ref
                                .read(_deliveryFiltersProvider.notifier)
                                .setPage(data.pagination.page + 1)
                          : null,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.summary});

  final AdminDeliveriesSummary summary;

  @override
  Widget build(BuildContext context) {
    Color accentFor(AppStatusTone tone) =>
        AppStatusStyle.of(context, tone).foreground;

    final stats = [
      ('Total', summary.total, Icons.inventory_2_outlined, AppStatusTone.info),
      (
        'Waiting for driver',
        summary.waitingForDriver,
        Icons.hourglass_empty_outlined,
        AppStatusTone.warning,
      ),
      (
        'Active / in progress',
        summary.activeInProgress,
        Icons.local_shipping_outlined,
        AppStatusTone.info,
      ),
      (
        'Needs admin review',
        summary.needsAdminReview,
        Icons.warning_amber_rounded,
        AppStatusTone.warning,
      ),
      (
        'Delivered',
        summary.delivered,
        Icons.check_circle_outline,
        AppStatusTone.success,
      ),
      (
        'Failed / cancelled',
        summary.failedCancelled,
        Icons.cancel_outlined,
        AppStatusTone.danger,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 1280
            ? 6
            : constraints.maxWidth >= 720
            ? 3
            : constraints.maxWidth >= 480
            ? 2
            : 1;
        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: stats
              .map(
                (stat) => SizedBox(
                  width: columns == 1
                      ? double.infinity
                      : (constraints.maxWidth - (columns - 1) * 10) / columns,
                  child: _DeliverySummaryCard(
                    label: stat.$1,
                    count: stat.$2,
                    icon: stat.$3,
                    accent: accentFor(stat.$4),
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _DeliverySummaryCard extends StatelessWidget {
  const _DeliverySummaryCard({
    required this.label,
    required this.count,
    required this.icon,
    required this.accent,
  });
  final String label;
  final int count;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      height: 84,
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(
          color: accent.withValues(alpha: palette.isDark ? .36 : .24),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, size: 18, color: accent),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '$count',
                  style: AdminTypography.kpiValue(
                    palette,
                  ).copyWith(fontSize: 23),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: AdminTypography.kpiLabel(palette),
                  maxLines: 2,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FiltersPanel extends StatefulWidget {
  const _FiltersPanel({
    required this.searchController,
    required this.filters,
    required this.statuses,
    required this.onSearch,
    required this.onStatusChanged,
    required this.onScopeChanged,
    required this.onAssignmentChanged,
    required this.onIncidentStateChanged,
    required this.onTimeRangeChanged,
    required this.onCustomDateFromChanged,
    required this.onCustomDateToChanged,
    required this.onReset,
    this.onExport,
    this.exportLoading = false,
    this.dateRangeError,
  });

  final TextEditingController searchController;
  final _DeliveryFilters filters;
  final List<String> statuses;
  final String? dateRangeError;
  final VoidCallback onSearch;
  final ValueChanged<String> onStatusChanged;
  final ValueChanged<String> onScopeChanged;
  final ValueChanged<String> onAssignmentChanged;
  final ValueChanged<String> onIncidentStateChanged;
  final ValueChanged<String> onTimeRangeChanged;
  final ValueChanged<String?> onCustomDateFromChanged;
  final ValueChanged<String?> onCustomDateToChanged;
  final VoidCallback onReset;
  final VoidCallback? onExport;
  final bool exportLoading;
  @override
  State<_FiltersPanel> createState() => _FiltersPanelState();
}

class _FiltersPanelState extends State<_FiltersPanel> {
  var _showMore = false;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) =>
        _buildFilters(context, constraints.maxWidth),
  );

  Widget _buildFilters(BuildContext context, double maxWidth) {
    final widget = this.widget;
    final palette = context.adminPalette;
    final boundedWidth = maxWidth.isFinite
        ? maxWidth
        : MediaQuery.sizeOf(context).width;
    final stacked = boundedWidth < 1060;
    final controlWidth = stacked ? boundedWidth - 28 : 170.0;
    final statusValue =
        safeDropdownValue(widget.filters.status, widget.statuses) ?? 'ALL';

    final statusEntries = [
      const DropdownMenuEntry(value: 'ALL', label: 'All statuses'),
      ...widget.statuses.map(
        (status) =>
            DropdownMenuEntry(value: status, label: humanizeEnum(status)),
      ),
    ];
    const scopeEntries = [
      DropdownMenuEntry(value: 'ALL', label: 'All scopes'),
      DropdownMenuEntry(value: 'SINGLE', label: 'Single'),
      DropdownMenuEntry(value: 'GROUPED', label: 'Grouped'),
    ];
    const assignmentEntries = [
      DropdownMenuEntry(value: 'ALL', label: 'All assignment states'),
      DropdownMenuEntry(value: 'UNASSIGNED', label: 'Unassigned'),
      DropdownMenuEntry(value: 'ACTIVE', label: 'Active'),
      DropdownMenuEntry(value: 'RELEASED', label: 'Released'),
      DropdownMenuEntry(value: 'HISTORICAL', label: 'Historical'),
    ];
    const attentionEntries = [
      DropdownMenuEntry(value: 'ALL', label: 'All attention states'),
      DropdownMenuEntry(value: 'PENDING_REVIEW', label: 'Pending review'),
      DropdownMenuEntry(value: 'VERIFIED', label: 'Verified'),
      DropdownMenuEntry(value: 'REJECTED', label: 'Rejected'),
      DropdownMenuEntry(
        value: 'RESOLVED_NO_STRIKE',
        label: 'Resolved without strike',
      ),
    ];
    const incidentEntries = [
      DropdownMenuEntry(value: 'ALL', label: 'All incident states'),
      DropdownMenuEntry(value: 'PENDING_REVIEW', label: 'Pending review'),
      DropdownMenuEntry(value: 'VERIFIED', label: 'Verified'),
      DropdownMenuEntry(value: 'REJECTED', label: 'Rejected'),
      DropdownMenuEntry(
        value: 'RESOLVED_NO_STRIKE',
        label: 'Resolved without strike',
      ),
    ];
    const timeEntries = [
      DropdownMenuEntry(value: kTimeRangeAll, label: 'All time'),
      DropdownMenuEntry(value: kTimeRangeToday, label: 'Today'),
      DropdownMenuEntry(value: kTimeRangeLast7, label: 'Last 7 days'),
      DropdownMenuEntry(value: kTimeRangeLast30, label: 'Last 30 days'),
      DropdownMenuEntry(value: kTimeRangeCustom, label: 'Custom range'),
    ];

    final searchField = TextField(
      controller: widget.searchController,
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.search, size: 20),
        hintText: 'Search delivery, reservation, material, or person...',
        border: const OutlineInputBorder(),
        isDense: true,
        suffixIcon: widget.searchController.text.isEmpty
            ? null
            : IconButton(
                icon: const Icon(Icons.clear, size: 20),
                tooltip: 'Clear search',
                onPressed: () {
                  widget.searchController.clear();
                  widget.onSearch();
                },
              ),
      ),
      onSubmitted: (_) => widget.onSearch(),
    );

    final statusFilter = AdminCompactFilterDropdown(
      label: 'Status',
      value: statusValue,
      width: controlWidth,
      enabled: widget.statuses.isNotEmpty,
      entries: statusEntries,
      onSelected: widget.onStatusChanged,
    );

    final scopeFilter = AdminCompactFilterDropdown(
      label: 'Scope',
      value: widget.filters.scope,
      width: controlWidth,
      entries: scopeEntries,
      onSelected: widget.onScopeChanged,
    );

    final assignmentFilter = AdminCompactFilterDropdown(
      label: 'Assignment',
      value: widget.filters.assignment,
      width: controlWidth,
      entries: assignmentEntries,
      onSelected: widget.onAssignmentChanged,
    );

    final attentionFilter = AdminCompactFilterDropdown(
      label: 'Attention',
      value: widget.filters.incidentState,
      width: controlWidth,
      entries: attentionEntries,
      onSelected: widget.onIncidentStateChanged,
    );

    final incidentFilter = AdminCompactFilterDropdown(
      label: 'Incident',
      value: widget.filters.incidentState,
      width: controlWidth,
      entries: incidentEntries,
      onSelected: widget.onIncidentStateChanged,
    );

    final timeFilter = AdminCompactFilterDropdown(
      label: 'Date range',
      value: widget.filters.timeRange,
      width: controlWidth,
      entries: timeEntries,
      onSelected: widget.onTimeRangeChanged,
    );

    final resetButton = IconButton(
      onPressed: widget.filters.hasActiveFilters ? widget.onReset : null,
      style: AppStatusButtonStyle.outlined(context, AppStatusTone.neutral),
      icon: const Icon(Icons.filter_alt_off, size: 19),
      tooltip: 'Reset filters',
    );
    final exportButton = widget.onExport == null
        ? null
        : OutlinedButton.icon(
            onPressed: widget.exportLoading ? null : widget.onExport,
            style: AppStatusButtonStyle.outlined(context, AppStatusTone.neutral),
            icon: widget.exportLoading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.download_outlined, size: 18),
            label: Text(widget.exportLoading ? 'Preparing…' : 'Export'),
          );
    final secondaryCount = [
      widget.filters.scope != 'ALL',
      widget.filters.assignment != 'ALL',
      widget.filters.incidentState != 'ALL',
    ].where((selected) => selected).length;
    final moreButton = OutlinedButton.icon(
      onPressed: () => setState(() => _showMore = !_showMore),
      style: AppStatusButtonStyle.outlined(context, AppStatusTone.neutral),
      icon: Icon(_showMore ? Icons.expand_less : Icons.tune, size: 18),
      label: Text(
        secondaryCount == 0 ? 'More filters' : 'More filters ($secondaryCount)',
      ),
    );

    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (stacked) ...[
            searchField,
            const SizedBox(height: 10),
            statusFilter,
            const SizedBox(height: 10),
            attentionFilter,
            const SizedBox(height: 10),
            timeFilter,
            const SizedBox(height: 10),
            Row(
              children: [
                moreButton,
                const SizedBox(width: 4),
                if (exportButton != null) ...[
                  exportButton,
                  const SizedBox(width: 4),
                ],
                resetButton,
              ],
            ),
          ] else
            Row(
              children: [
                Expanded(flex: 3, child: searchField),
                const SizedBox(width: 10),
                statusFilter,
                const SizedBox(width: 10),
                attentionFilter,
                const SizedBox(width: 10),
                timeFilter,
                const SizedBox(width: 10),
                moreButton,
                const SizedBox(width: 4),
                if (exportButton != null) ...[
                  exportButton,
                  const SizedBox(width: 4),
                ],
                resetButton,
              ],
            ),
          if (_showMore) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [scopeFilter, assignmentFilter, incidentFilter],
            ),
          ],
          if (widget.filters.timeRange == kTimeRangeCustom) ...[
            const SizedBox(height: 10),
            if (stacked)
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  AdminCompactDateField(
                    label: 'From',
                    value: widget.filters.customDateFrom,
                    onChanged: widget.onCustomDateFromChanged,
                  ),
                  const SizedBox(height: 8),
                  AdminCompactDateField(
                    label: 'To',
                    value: widget.filters.customDateTo,
                    onChanged: widget.onCustomDateToChanged,
                  ),
                ],
              )
            else
              Wrap(
                spacing: 10,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  AdminCompactDateField(
                    label: 'From',
                    value: widget.filters.customDateFrom,
                    width: 150,
                    onChanged: widget.onCustomDateFromChanged,
                  ),
                  AdminCompactDateField(
                    label: 'To',
                    value: widget.filters.customDateTo,
                    width: 150,
                    onChanged: widget.onCustomDateToChanged,
                  ),
                ],
              ),
            if (widget.dateRangeError != null) ...[
              const SizedBox(height: 6),
              Text(
                widget.dateRangeError!,
                style: AdminTypography.kpiHelper(
                  palette,
                ).copyWith(color: palette.red),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _ResultsHeader extends StatelessWidget {
  const _ResultsHeader({required this.total});

  final int total;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Row(
      children: [
        Text('Deliveries', style: AdminTypography.sectionTitle(palette)),
        const SizedBox(width: 8),
        Text('$total results', style: AdminTypography.kpiHelper(palette)),
      ],
    );
  }
}

class _DeliveriesTable extends StatelessWidget {
  const _DeliveriesTable({
    required this.items,
    required this.compact,
    required this.onDetails,
  });

  final List<AdminDeliveryListItem> items;
  final bool compact;
  final ValueChanged<AdminDeliveryListItem> onDetails;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    if (compact) {
      return LayoutBuilder(
        builder: (context, constraints) {
          final twoColumns = constraints.maxWidth >= 720;
          return Wrap(
            spacing: 12,
            runSpacing: 12,
            children: items
                .map(
                  (item) => SizedBox(
                    width: twoColumns
                        ? (constraints.maxWidth - 12) / 2
                        : constraints.maxWidth,
                    child: _DeliveryCard(
                      item: item,
                      onDetails: () => onDetails(item),
                    ),
                  ),
                )
                .toList(),
          );
        },
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Column(
        children: [
          const _DeliveryTableHeader(),
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) Divider(height: 1, color: palette.cardBorder),
            _DeliveryRow(item: items[i], onDetails: () => onDetails(items[i])),
          ],
        ],
      ),
    );
  }
}

class _DeliveryRow extends StatelessWidget {
  const _DeliveryRow({required this.item, required this.onDetails});

  final AdminDeliveryListItem item;
  final VoidCallback onDetails;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        hoverColor: palette.primaryTeal.withValues(alpha: .035),
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 14, 8),
          child: SizedBox(
            height: 72,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(flex: 32, child: _DeliveryColumn(item: item)),
                const SizedBox(width: 10),
                Expanded(flex: 25, child: _JourneyCell(item: item)),
                const SizedBox(width: 10),
                SizedBox(width: 205, child: _StateCell(item: item)),
                const SizedBox(width: 10),
                SizedBox(width: 165, child: _AttentionCell(item: item)),
                const SizedBox(width: 10),
                SizedBox(width: 135, child: _TimelineCell(item: item)),
                const SizedBox(width: 10),
                SizedBox(
                  width: 60,
                  child: _DetailsButton(onPressed: onDetails),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DeliveryTableHeader extends StatelessWidget {
  const _DeliveryTableHeader();
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    Widget label(String value) =>
        Text(value, style: AdminTypography.kpiLabel(palette));
    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 14, 12),
      decoration: BoxDecoration(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
        border: Border(bottom: BorderSide(color: palette.cardBorder)),
      ),
      child: Row(
        children: [
          Expanded(flex: 32, child: label('Delivery')),
          const SizedBox(width: 10),
          Expanded(flex: 25, child: label('Journey')),
          const SizedBox(width: 10),
          SizedBox(width: 205, child: label('Progress')),
          const SizedBox(width: 10),
          SizedBox(width: 165, child: label('Attention')),
          const SizedBox(width: 10),
          SizedBox(width: 135, child: label('Updated')),
          const SizedBox(width: 10),
          SizedBox(width: 60, child: label('Action')),
        ],
      ),
    );
  }
}

class _DeliveryColumn extends StatelessWidget {
  const _DeliveryColumn({required this.item});
  final AdminDeliveryListItem item;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final title = item.material.title.trim().isEmpty
        ? 'Untitled material'
        : item.material.title.trim();
    final itemCount = item.scope == DeliveryScope.grouped
        ? (item.group?.reservationCount ?? item.itemCount)
        : item.itemCount;
    final detail =
        '${_shortDeliveryId(item.id)} · $itemCount ${itemCount == 1 ? 'item' : 'items'}${item.hasMoreItems ? ' · + more' : ''}';
    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: palette.primaryTeal.withValues(alpha: .08),
            borderRadius: BorderRadius.circular(9),
          ),
          child: Icon(
            Icons.inventory_2_outlined,
            size: 20,
            color: palette.primaryTeal,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Tooltip(
            message: title,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  // Row height is intentionally capped for the operational list.
                  // The full title remains available through the surrounding tooltip.
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AdminTypography.sectionTitle(
                    palette,
                  ).copyWith(fontSize: 14),
                ),
                const SizedBox(height: 3),
                Tooltip(
                  message: item.id,
                  child: Text(
                    detail,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AdminTypography.kpiHelper(palette),
                  ),
                ),
                if (item.scope == DeliveryScope.grouped) ...[
                  const SizedBox(height: 4),
                  const _MiniBadge(label: 'Grouped', tone: AppStatusTone.info),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _JourneyCell extends StatelessWidget {
  const _JourneyCell({required this.item});
  final AdminDeliveryListItem item;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final route = _formatRouteLabel(item);
    final people =
        '${displayPersonLabel(item.learner.displayName, item.learner.email)} → ${displayPersonLabel(item.supplier.displayName, item.supplier.email)}';
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Tooltip(
          message: route,
          child: Text(
            route,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AdminTypography.sectionTitle(palette).copyWith(fontSize: 13),
          ),
        ),
        const SizedBox(height: 4),
        Tooltip(
          message: people,
          child: Text(
            people,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AdminTypography.kpiHelper(palette),
          ),
        ),
      ],
    );
  }
}

class _StateCell extends StatelessWidget {
  const _StateCell({required this.item, this.showStatus = true});
  final AdminDeliveryListItem item;
  final bool showStatus;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final current = item.currentDriver;
    final last = item.lastAssignedDriver;
    final assignment = current != null
        ? displayPersonLabel(current.displayName, current.email)
        : last != null
        ? 'Last driver: ${displayPersonLabel(last.displayName, last.email)}'
        : item.assignmentState == AssignmentState.unassigned
        ? 'Unassigned'
        : item.assignmentState == AssignmentState.released
        ? 'Assignment released'
        : _assignmentLabel(item.assignmentState);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showStatus) ...[
          AppStatusBadge(
            label: deliveryStatusLabel(item.status),
            tone: deliveryStatusAppTone(item.status),
          ),
          const SizedBox(height: 5),
        ],
        Text(
          _lifecycleLabel(item.lifecyclePhase),
          style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 12),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        Text(
          assignment,
          style: AdminTypography.kpiHelper(palette),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

class _TimelineCell extends StatelessWidget {
  const _TimelineCell({required this.item});
  final AdminDeliveryListItem item;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    String event;
    String timestamp;
    if (item.deliveredAt != null) {
      event = 'Delivered';
      timestamp = formatAdminDateTime(item.deliveredAt) ?? item.deliveredAt!;
    } else if (item.pickedUpAt != null) {
      event = 'Picked up';
      timestamp = formatAdminDateTime(item.pickedUpAt) ?? item.pickedUpAt!;
    } else {
      event = item.adminAttentionState == AdminAttentionState.actionRequired
          ? 'Recovery requested'
          : 'Requested';
      timestamp = formatAdminDateTime(item.requestedAt) ?? item.requestedAt;
    }
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          event,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 12),
        ),
        const SizedBox(height: 3),
        Text(
          timestamp,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AdminTypography.kpiHelper(palette),
        ),
      ],
    );
  }
}

class _AttentionCell extends StatelessWidget {
  const _AttentionCell({required this.item});
  final AdminDeliveryListItem item;
  @override
  Widget build(BuildContext context) {
    final state = item.adminAttentionState;
    final label = switch (state) {
      AdminAttentionState.actionRequired => 'Action required',
      AdminAttentionState.waitingExternalParty => 'Waiting external party',
      AdminAttentionState.none => 'No admin action',
      AdminAttentionState.unknown => '—',
    };
    final tone = state == AdminAttentionState.actionRequired
        ? AppStatusTone.warning
        : state == AdminAttentionState.none
        ? AppStatusTone.success
        : AppStatusTone.neutral;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _MiniBadge(
          label: label,
          tone: tone,
          icon: state == AdminAttentionState.actionRequired
              ? Icons.warning_amber_rounded
              : null,
        ),
        if (item.incidentCount > 0) ...[
          const SizedBox(height: 5),
          Text(
            '${item.incidentCount} ${item.incidentCount == 1 ? 'incident' : 'incidents'}',
            style: Theme.of(context).textTheme.labelSmall,
          ),
        ],
      ],
    );
  }
}

class _MiniBadge extends StatelessWidget {
  const _MiniBadge({required this.label, required this.tone, this.icon});
  final String label;
  final AppStatusTone tone;
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    final style = AppStatusStyle.of(context, tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: style.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: style.foreground),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: style.foreground,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailsButton extends StatelessWidget {
  const _DetailsButton({required this.onPressed});
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => Tooltip(
    message: 'View delivery',
    child: IconButton(
      onPressed: onPressed,
      style: AppStatusButtonStyle.outlined(context, AppStatusTone.neutral),
      icon: const Icon(Icons.visibility_outlined, size: 19),
    ),
  );
}

class _DeliveryCard extends StatelessWidget {
  const _DeliveryCard({required this.item, required this.onDetails});
  final AdminDeliveryListItem item;
  final VoidCallback onDetails;
  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _DeliveryColumn(item: item)),
              const SizedBox(width: 10),
              AppStatusBadge(
                label: deliveryStatusLabel(item.status),
                tone: deliveryStatusAppTone(item.status),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _JourneyCell(item: item),
          const SizedBox(height: 10),
          _StateCell(item: item, showStatus: false),
          const SizedBox(height: 10),
          _AttentionCell(item: item),
          const SizedBox(height: 10),
          _TimelineCell(item: item),
          const SizedBox(height: 12),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: FilledButton.icon(
              onPressed: onDetails,
              icon: const Icon(Icons.visibility_outlined, size: 18),
              label: const Text('View delivery'),
            ),
          ),
        ],
      ),
    );
  }
}

String _shortDeliveryId(String id) {
  final trimmed = id.trim();
  if (trimmed.toUpperCase().startsWith('DLV-')) return trimmed;
  final compact = trimmed.replaceAll(RegExp(r'[^A-Za-z0-9]'), '');
  return compact.isEmpty
      ? 'Delivery'
      : 'DLV-${compact.substring(0, compact.length.clamp(0, 7)).toUpperCase()}';
}

String _lifecycleLabel(LifecyclePhase phase) => switch (phase) {
  LifecyclePhase.waitingAssignment => 'Waiting for assignment',
  LifecyclePhase.prePickup => 'Pre-pickup',
  LifecyclePhase.inTransit => 'Active / in progress',
  LifecyclePhase.completed => 'Completed',
  LifecyclePhase.recoveryRequired => 'Recovery required',
  LifecyclePhase.recoveryInProgress => 'Recovery in progress',
  LifecyclePhase.terminalFailure => 'Terminal failure',
  LifecyclePhase.cancelled => 'Cancelled',
  LifecyclePhase.unknown => '—',
};

String _assignmentLabel(AssignmentState state) => switch (state) {
  AssignmentState.unassigned => 'Unassigned',
  AssignmentState.active => 'Active',
  AssignmentState.released => 'Released',
  AssignmentState.historical => 'Historical',
  AssignmentState.unknown => '—',
};

class _DeliveriesLoadingSkeleton extends StatelessWidget {
  const _DeliveriesLoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    Widget block({double? width, double height = 16}) => Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: palette.primaryTeal.withValues(
          alpha: palette.isDark ? .16 : .08,
        ),
        borderRadius: BorderRadius.circular(8),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LayoutBuilder(
          builder: (context, constraints) => Wrap(
            spacing: 10,
            runSpacing: 10,
            children: List.generate(
              6,
              (_) => SizedBox(
                width: (constraints.maxWidth - 50) / 6,
                child: block(height: 84),
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: palette.cardBackground,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: palette.cardBorder),
          ),
          child: Column(
            children: [
              block(width: double.infinity, height: 50),
              const SizedBox(height: 10),
              block(width: 340, height: 46),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: palette.cardBackground,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: palette.cardBorder),
          ),
          child: Column(
            children: [
              block(width: double.infinity, height: 20),
              const SizedBox(height: 14),
              ...List.generate(
                4,
                (_) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: block(width: double.infinity, height: 84),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DeliveryDetailDialog extends ConsumerStatefulWidget {
  const _DeliveryDetailDialog({required this.detail});

  final AdminDeliveryDetail detail;

  @override
  ConsumerState<_DeliveryDetailDialog> createState() =>
      _DeliveryDetailDialogState();
}

class _DeliveryDetailDialogState extends ConsumerState<_DeliveryDetailDialog> {
  late AdminDeliveryDetail detail;
  var _isReopening = false;

  @override
  void initState() {
    super.initState();
    detail = widget.detail;
  }

  Future<void> _reopenDriverAssignment() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AppDialogShell(
        title: const Text('Reopen to drivers?'),
        content: const Text(
          'The current driver will lose this assignment and the delivery will return to the available driver job pool. Reservation details, quantities, fees, and windows will stay unchanged.',
        ),
        footer: AppDialogFooter.decision(
          secondaryAction: TextButton(
            onPressed: () => Navigator.pop(context, false),
            style: AppStatusButtonStyle.text(context, AppStatusTone.neutral),
            child: const Text('Cancel'),
          ),
          primaryAction: FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: AppStatusButtonStyle.filled(context, AppStatusTone.warning),
            child: const Text('Reopen'),
          ),
        ),
      ),
    );

    if (confirmed != true || _isReopening) {
      return;
    }

    setState(() => _isReopening = true);

    try {
      final updated = await ref
          .read(adminDeliveriesApiProvider)
          .reopenDriverAssignment(detail.id);
      if (!mounted) return;
      setState(() {
        detail = updated;
        _isReopening = false;
      });
      ref.invalidate(adminDeliveriesListProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Delivery reopened to drivers.')),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _isReopening = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.displayMessage)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return AppDialogShell(
      title: Text(
        detail.material.title.isEmpty
            ? 'Delivery details'
            : detail.material.title,
      ),
      maxWidth: 600,
      closeEnabled: !_isReopening,
      content: SizedBox(
        width: 560,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AdminDetailSection(
              title: 'Delivery summary',
              children: [
                AdminDetailRow(
                  label: 'Status',
                  value: humanizeEnum(detail.status),
                ),
                AdminDetailRow(
                  label: 'Material',
                  value: detail.material.title.isEmpty
                      ? '—'
                      : detail.material.title,
                ),
                AdminDetailRow(
                  label: 'Reservation',
                  value: detail.reservation.id.isEmpty
                      ? '—'
                      : detail.reservation.id,
                  muted: true,
                ),
                AdminDetailRow(
                  label: 'Requested at',
                  value:
                      formatAdminDateTime(detail.requestedAt) ??
                      detail.requestedAt,
                ),
                if (detail.deliveredAt != null)
                  AdminDetailRow(
                    label: 'Delivered at',
                    value:
                        formatAdminDateTime(detail.deliveredAt) ??
                        detail.deliveredAt!,
                  ),
                if (detail.cancelledAt != null)
                  AdminDetailRow(
                    label: 'Cancelled at',
                    value:
                        formatAdminDateTime(detail.cancelledAt) ??
                        detail.cancelledAt!,
                  ),
                if (detail.failedAt != null)
                  AdminDetailRow(
                    label: 'Failed at',
                    value:
                        formatAdminDateTime(detail.failedAt) ??
                        detail.failedAt!,
                  ),
                if (detail.failureReason != null &&
                    detail.failureReason!.trim().isNotEmpty)
                  AdminDetailRow(
                    label: 'Failure reason',
                    value: detail.failureReason!.trim(),
                  ),
                if (detail.learnerNote != null &&
                    detail.learnerNote!.trim().isNotEmpty)
                  AdminDetailRow(
                    label: 'Learner note',
                    value: detail.learnerNote!.trim(),
                  ),
                if (detail.driverNote != null &&
                    detail.driverNote!.trim().isNotEmpty)
                  AdminDetailRow(
                    label: 'Driver note',
                    value: detail.driverNote!.trim(),
                  ),
              ],
            ),
            AdminDetailSection(
              title: 'Driver',
              children: detail.driver == null
                  ? const [
                      AdminDetailRow(
                        label: 'Assignment',
                        value: 'Not assigned yet',
                      ),
                    ]
                  : [
                      AdminDetailRow(
                        label: 'Name',
                        value: displayPersonLabel(
                          detail.driver!.displayName,
                          detail.driver!.email,
                        ),
                      ),
                      AdminDetailRow(
                        label: 'Email',
                        value: detail.driver!.email.isEmpty
                            ? '—'
                            : detail.driver!.email,
                      ),
                      AdminDetailRow(
                        label: 'Phone',
                        value: detail.driver!.phone?.trim().isNotEmpty == true
                            ? detail.driver!.phone!.trim()
                            : '—',
                      ),
                      if (detail.driver!.acceptedAt != null)
                        AdminDetailRow(
                          label: 'Accepted at',
                          value:
                              formatAdminDateTime(detail.driver!.acceptedAt) ??
                              detail.driver!.acceptedAt!,
                        ),
                    ],
            ),
            AdminDetailSection(
              title: 'Pickup info',
              children: [
                AdminDetailRow(
                  label: 'Supplier',
                  value: detail.pickup.supplierName?.trim().isNotEmpty == true
                      ? detail.pickup.supplierName!.trim()
                      : displayPersonLabel(
                          detail.supplier.displayName,
                          detail.supplier.email,
                        ),
                ),
                AdminDetailRow(
                  label: 'Location',
                  value: _formatLocationDetail(detail.pickup.location),
                ),
                if (detail.pickup.location.addressLine?.trim().isNotEmpty ==
                    true)
                  AdminDetailRow(
                    label: 'Address',
                    value: detail.pickup.location.addressLine!.trim(),
                    muted: true,
                  ),
                if (detail.pickup.pickupWindowStart != null ||
                    detail.pickup.pickupWindowEnd != null)
                  AdminDetailRow(
                    label: 'Pickup window',
                    value: _formatWindow(
                      detail.pickup.pickupWindowStart,
                      detail.pickup.pickupWindowEnd,
                    ),
                  ),
                if (detail.pickup.supplierNote?.trim().isNotEmpty == true)
                  AdminDetailRow(
                    label: 'Supplier note',
                    value: detail.pickup.supplierNote!.trim(),
                  ),
                if (detail.pickup.arrivedAt != null)
                  AdminDetailRow(
                    label: 'Driver arrived',
                    value:
                        formatAdminDateTime(detail.pickup.arrivedAt) ??
                        detail.pickup.arrivedAt!,
                  ),
                if (detail.pickup.pickedUpAt != null)
                  AdminDetailRow(
                    label: 'Picked up at',
                    value:
                        formatAdminDateTime(detail.pickup.pickedUpAt) ??
                        detail.pickup.pickedUpAt!,
                  ),
              ],
            ),
            AdminDetailSection(
              title: 'Dropoff info',
              children: [
                AdminDetailRow(
                  label: 'Learner',
                  value: detail.dropoff.learnerName?.trim().isNotEmpty == true
                      ? detail.dropoff.learnerName!.trim()
                      : displayPersonLabel(
                          detail.learner.displayName,
                          detail.learner.email,
                        ),
                ),
                AdminDetailRow(
                  label: 'Location',
                  value: _formatLocationDetail(detail.dropoff.location),
                ),
                if (detail.dropoff.location.addressLine?.trim().isNotEmpty ==
                    true)
                  AdminDetailRow(
                    label: 'Address',
                    value: detail.dropoff.location.addressLine!.trim(),
                    muted: true,
                  ),
                if (detail.dropoff.deliveryNotes?.trim().isNotEmpty == true)
                  AdminDetailRow(
                    label: 'Delivery notes',
                    value: detail.dropoff.deliveryNotes!.trim(),
                  ),
                if (detail.dropoff.arrivedAt != null)
                  AdminDetailRow(
                    label: 'Driver arrived',
                    value:
                        formatAdminDateTime(detail.dropoff.arrivedAt) ??
                        detail.dropoff.arrivedAt!,
                  ),
                if (detail.dropoff.deliveredAt != null)
                  AdminDetailRow(
                    label: 'Delivered at',
                    value:
                        formatAdminDateTime(detail.dropoff.deliveredAt) ??
                        detail.dropoff.deliveredAt!,
                  ),
              ],
            ),
            AdminDetailSection(
              title: 'Timeline',
              children: detail.timeline.isEmpty
                  ? const [
                      AdminDetailRow(
                        label: 'Events',
                        value: 'No timeline events recorded yet.',
                      ),
                    ]
                  : detail.timeline
                        .map(
                          (event) =>
                              _TimelineEntry(item: event, palette: palette),
                        )
                        .toList(),
            ),
            AdminDetailSection(
              title: 'Route / location history',
              children: [
                AdminDetailRow(
                  label: 'Recorded pings',
                  value: detail.locationHistory.count.toString(),
                ),
                if (detail.locationHistory.items.isEmpty)
                  const AdminDetailRow(
                    label: 'Updates',
                    value: 'No route/location updates recorded yet.',
                  )
                else
                  ...detail.locationHistory.items.map(
                    (ping) => _LocationPingEntry(ping: ping, palette: palette),
                  ),
              ],
            ),
          ],
        ),
      ),
      footer: detail.canShowReopenDriverAssignmentAction
          ? AppDialogFooter.form(
              primaryAction: FilledButton(
                onPressed: _isReopening ? null : _reopenDriverAssignment,
                style: AppStatusButtonStyle.filled(
                  context,
                  AppStatusTone.warning,
                ),
                child: _isReopening
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Reopen to drivers'),
              ),
            )
          : null,
    );
  }
}

String _formatWindow(String? start, String? end) {
  final startLabel = formatAdminDateTime(start);
  final endLabel = formatAdminDateTime(end);
  if (startLabel == null && endLabel == null) return '—';
  if (startLabel != null && endLabel != null) {
    return '$startLabel – $endLabel';
  }
  return startLabel ?? endLabel ?? '—';
}

class _TimelineEntry extends StatelessWidget {
  const _TimelineEntry({required this.item, required this.palette});

  final AdminDeliveryTimelineItem item;
  final AdminPalette palette;

  @override
  Widget build(BuildContext context) {
    final timestamp =
        formatAdminDateTime(item.timestamp) ?? item.timestamp ?? '—';

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.label, style: AdminTypography.kpiHelper(palette)),
          Text(
            timestamp,
            style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 13),
          ),
          if (item.note != null && item.note!.trim().isNotEmpty)
            Text(
              item.note!.trim(),
              style: AdminTypography.pageSubtitle(
                palette,
              ).copyWith(color: palette.textMuted, fontSize: 12),
            ),
        ],
      ),
    );
  }
}

class _LocationPingEntry extends StatelessWidget {
  const _LocationPingEntry({required this.ping, required this.palette});

  final AdminDeliveryLocationPing ping;
  final AdminPalette palette;

  @override
  Widget build(BuildContext context) {
    final capturedAt = formatAdminDateTime(ping.capturedAt) ?? ping.capturedAt;
    final coords = _formatCoords(ping.latitude, ping.longitude);
    final accuracy = ping.accuracyMeters != null
        ? ' · ±${ping.accuracyMeters!.toStringAsFixed(0)} m'
        : '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(capturedAt, style: AdminTypography.kpiHelper(palette)),
          Text(
            '$coords$accuracy',
            style: AdminTypography.pageSubtitle(
              palette,
            ).copyWith(color: palette.textMuted, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _PaginationRow extends StatelessWidget {
  const _PaginationRow({
    required this.page,
    required this.totalPages,
    required this.total,
    required this.limit,
    required this.onPage,
    required this.onPrevious,
    required this.onNext,
  });

  final int page;
  final int totalPages;
  final int total;
  final int limit;
  final ValueChanged<int> onPage;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    final first = total == 0 ? 0 : (page - 1) * limit + 1;
    final last = total == 0 ? 0 : (page * limit).clamp(0, total);
    final pages = List<int>.generate(
      totalPages.clamp(0, 5),
      (index) => index + 1,
    );
    return LayoutBuilder(
      builder: (context, constraints) {
        final controls = Wrap(
          spacing: 4,
          children: [
            IconButton(
              onPressed: onPrevious,
              tooltip: 'Previous page',
              icon: const Icon(Icons.chevron_left),
            ),
            ...pages.map(
              (number) => SizedBox(
                width: 34,
                height: 34,
                child: number == page
                    ? FilledButton(
                        onPressed: null,
                        style: AppStatusButtonStyle.filled(
                          context,
                          AppStatusTone.primary,
                        ),
                        child: Text('$number'),
                      )
                    : TextButton(
                        onPressed: () => onPage(number),
                        child: Text('$number'),
                      ),
              ),
            ),
            IconButton(
              onPressed: onNext,
              tooltip: 'Next page',
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        );
        return Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          runSpacing: 8,
          children: [
            Text(
              'Showing $first–$last of $total results',
              style: AdminTypography.kpiHelper(palette),
            ),
            controls,
          ],
        );
      },
    );
  }
}

class AdminDeliveriesExportDialog extends StatefulWidget {
  const AdminDeliveriesExportDialog({
    super.key,
    required this.count,
    required this.filterSummary,
    required this.formats,
    required this.onDownload,
  });

  final int count;
  final String filterSummary;
  final Map<String, AdminExportFormatEligibility> formats;
  final Future<void> Function(String format) onDownload;

  @override
  State<AdminDeliveriesExportDialog> createState() =>
      _AdminDeliveriesExportDialogState();
}

class _AdminDeliveriesExportDialogState
    extends State<AdminDeliveriesExportDialog> {
  String _selectedFormat = 'xlsx';
  bool _isDownloading = false;
  String? _error;

  AdminExportFormatEligibility? get _selectedEligibility =>
      widget.formats[_selectedFormat];

  bool get _canExport =>
      !_isDownloading && (_selectedEligibility?.allowed ?? false);

  String get _formatDescription {
    switch (_selectedFormat) {
      case 'csv':
        return 'Raw data';
      case 'xlsx':
      default:
        return 'Detailed editable data';
    }
  }

  Future<void> _confirm() async {
    if (!_canExport) return;
    setState(() {
      _isDownloading = true;
      _error = null;
    });
    try {
      await widget.onDownload(_selectedFormat);
      if (!mounted) return;
      Navigator.of(context).pop(_selectedFormat);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _isDownloading = false;
        _error = error.displayMessage;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _isDownloading = false;
        _error = error.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final limitMessage = (_selectedEligibility?.exceedsLimit ?? false)
        ? 'This export matches ${widget.count} deliveries, which exceeds the '
              'limit of ${_selectedEligibility?.maxAllowed ?? 0}. Narrow your '
              'filters and try again.'
        : null;

    return AppDialogShell(
      title: const Text('Export deliveries'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Export all ${widget.count} matching deliveries, including results '
            'from all pages.',
          ),
          const SizedBox(height: 8),
          Text(
            widget.filterSummary,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          const Text('Format'),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'xlsx', label: Text('Excel')),
              ButtonSegment(value: 'csv', label: Text('CSV')),
            ],
            selected: {_selectedFormat},
            onSelectionChanged: _isDownloading
                ? null
                : (values) {
                    if (values.isEmpty) return;
                    setState(() => _selectedFormat = values.first);
                  },
          ),
          const SizedBox(height: 8),
          Text(
            _formatDescription,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (limitMessage != null) ...[
            const SizedBox(height: 12),
            Text(
              limitMessage,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
        ],
      ),
      footer: AppDialogFooter.decision(
        secondaryAction: TextButton(
          onPressed: _isDownloading
              ? null
              : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        primaryAction: FilledButton(
          onPressed: _canExport ? _confirm : null,
          child: _isDownloading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Export'),
        ),
      ),
    );
  }
}
