import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/errors/api_exception.dart';
import '../../data/admin_deliveries_api.dart';
import '../../data/models/admin_deliveries_models.dart';
import '../theme/admin_decoration_set.dart';
import '../theme/admin_palette.dart';
import '../widgets/admin_audit_stat_card.dart';
import '../widgets/admin_empty_state.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;
import '../widgets/admin_monitoring_filters.dart';
import '../widgets/admin_monitoring_utils.dart';

class _DeliveryFilters {
  const _DeliveryFilters({
    required this.page,
    required this.search,
    required this.status,
    required this.assignment,
    required this.timeRange,
    this.customDateFrom,
    this.customDateTo,
  });

  final int page;
  final String search;
  final String status;
  final String assignment;
  final String timeRange;
  final String? customDateFrom;
  final String? customDateTo;

  static const limit = 20;

  _DeliveryFilters copyWith({
    int? page,
    String? search,
    String? status,
    String? assignment,
    String? timeRange,
    String? customDateFrom,
    String? customDateTo,
    bool clearCustomDates = false,
  }) {
    return _DeliveryFilters(
      page: page ?? this.page,
      search: search ?? this.search,
      status: status ?? this.status,
      assignment: assignment ?? this.assignment,
      timeRange: timeRange ?? this.timeRange,
      customDateFrom:
          clearCustomDates ? null : (customDateFrom ?? this.customDateFrom),
      customDateTo: clearCustomDates ? null : (customDateTo ?? this.customDateTo),
    );
  }

  bool get hasActiveFilters =>
      search.isNotEmpty ||
      status != 'ALL' ||
      assignment != 'ALL' ||
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
        assignment: 'ALL',
        timeRange: kTimeRangeAll,
      );

  void setPage(int page) => state = state.copyWith(page: page);
  void setSearch(String search) => state = state.copyWith(page: 1, search: search);
  void setStatus(String status) => state = state.copyWith(page: 1, status: status);
  void setAssignment(String assignment) =>
      state = state.copyWith(page: 1, assignment: assignment);
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

  return ref.read(adminDeliveriesApiProvider).fetchDeliveries(
        page: filters.page,
        limit: _DeliveryFilters.limit,
        search: filters.search,
        status: filters.status,
        assignment: filters.assignment,
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

  @override
  void initState() {
    super.initState();
    final openId = widget.initialOpenDeliveryId?.trim();
    if (openId != null && openId.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (_initialOpenHandled) return;
        _initialOpenHandled = true;
        await _openDeliveryById(openId);
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

  Future<void> _openDeliveryById(String deliveryId) async {
    try {
      final detail = await ref
          .read(adminDeliveriesApiProvider)
          .fetchDeliveryDetail(deliveryId);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => _DeliveryDetailDialog(detail: detail),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.displayMessage)),
      );
    }
  }

  Future<void> _showDetails(AdminDeliveryListItem item) async {
    await _openDeliveryById(item.id);
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final filters = ref.watch(_deliveryFiltersProvider);
    final deliveriesAsync = ref.watch(adminDeliveriesListProvider);
    final compact = MediaQuery.sizeOf(context).width < 1000;
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
            Text('Deliveries', style: AdminTypography.pageTitle(palette)),
            const SizedBox(height: 4),
            Text(
              'Monitor internal delivery requests, assignments, and completion.',
              style: AdminTypography.pageSubtitle(palette),
            ),
            const SizedBox(height: 20),
            deliveriesAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: CircularProgressIndicator()),
              ),
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
                  _SummaryRow(summary: data.summary, palette: palette),
                  const SizedBox(height: 16),
                  _FiltersPanel(
                    compact: compact,
                    searchController: _searchController,
                    filters: filters,
                    statuses: data.statuses,
                    dateRangeError: dateRangeError,
                    onSearch: _applySearch,
                    onStatusChanged: (value) => ref
                        .read(_deliveryFiltersProvider.notifier)
                        .setStatus(value),
                    onAssignmentChanged: (value) => ref
                        .read(_deliveryFiltersProvider.notifier)
                        .setAssignment(value),
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
                    onRefresh: _refresh,
                  ),
                  const SizedBox(height: 16),
                  if (data.items.isEmpty)
                    AdminEmptyState(
                      icon: Icons.local_shipping_outlined,
                      title: filters.hasActiveFilters
                          ? 'No deliveries match these filters.'
                          : 'No deliveries recorded yet.',
                      subtitle: filters.hasActiveFilters
                          ? 'Try adjusting filters or reset to see all delivery activity.'
                          : 'Delivery requests from reservations will appear here once learners opt in.',
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
  const _SummaryRow({required this.summary, required this.palette});

  final AdminDeliveriesSummary summary;
  final AdminPalette palette;

  @override
  Widget build(BuildContext context) {
    final stats = [
      (
        'Total',
        summary.total.toString(),
        'All delivery records',
        Icons.local_shipping_outlined,
        palette.blue,
      ),
      (
        'Pending / unassigned',
        summary.pendingUnassigned.toString(),
        'Waiting for driver',
        Icons.hourglass_empty_outlined,
        palette.amber,
      ),
      (
        'Assigned / in progress',
        summary.assignedInProgress.toString(),
        'Active deliveries',
        Icons.delivery_dining_outlined,
        palette.primaryTeal,
      ),
      (
        'Delivered',
        summary.delivered.toString(),
        'Completed successfully',
        Icons.check_circle_outline,
        palette.green,
      ),
      (
        'Failed / cancelled',
        summary.failedCancelled.toString(),
        'Did not complete',
        Icons.cancel_outlined,
        palette.red,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 1100
            ? 5
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
                  child: AdminAuditStatCard(
                    label: stat.$1,
                    value: stat.$2,
                    helper: stat.$3,
                    icon: stat.$4,
                    accent: stat.$5,
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _FiltersPanel extends StatelessWidget {
  const _FiltersPanel({
    required this.compact,
    required this.searchController,
    required this.filters,
    required this.statuses,
    required this.onSearch,
    required this.onStatusChanged,
    required this.onAssignmentChanged,
    required this.onTimeRangeChanged,
    required this.onCustomDateFromChanged,
    required this.onCustomDateToChanged,
    required this.onReset,
    required this.onRefresh,
    this.dateRangeError,
  });

  final bool compact;
  final TextEditingController searchController;
  final _DeliveryFilters filters;
  final List<String> statuses;
  final String? dateRangeError;
  final VoidCallback onSearch;
  final ValueChanged<String> onStatusChanged;
  final ValueChanged<String> onAssignmentChanged;
  final ValueChanged<String> onTimeRangeChanged;
  final ValueChanged<String?> onCustomDateFromChanged;
  final ValueChanged<String?> onCustomDateToChanged;
  final VoidCallback onReset;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final dropdownWidth = compact ? double.infinity : 170.0;
    final statusValue =
        safeDropdownValue(filters.status, statuses) ?? 'ALL';

    final statusEntries = [
      const DropdownMenuEntry(value: 'ALL', label: 'All statuses'),
      ...statuses.map(
        (status) => DropdownMenuEntry(
          value: status,
          label: humanizeEnum(status),
        ),
      ),
    ];
    const assignmentEntries = [
      DropdownMenuEntry(value: 'ALL', label: 'All assignments'),
      DropdownMenuEntry(value: 'ASSIGNED', label: 'Assigned'),
      DropdownMenuEntry(value: 'UNASSIGNED', label: 'Unassigned'),
    ];
    const timeEntries = [
      DropdownMenuEntry(value: kTimeRangeAll, label: 'All time'),
      DropdownMenuEntry(value: kTimeRangeToday, label: 'Today'),
      DropdownMenuEntry(value: kTimeRangeLast7, label: 'Last 7 days'),
      DropdownMenuEntry(value: kTimeRangeLast30, label: 'Last 30 days'),
      DropdownMenuEntry(value: kTimeRangeCustom, label: 'Custom range'),
    ];

    final searchField = TextField(
      controller: searchController,
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.search, size: 20),
        hintText: 'Search material, learner, supplier, or driver…',
        border: const OutlineInputBorder(),
        isDense: true,
        suffixIcon: IconButton(
          icon: const Icon(Icons.search, size: 20),
          tooltip: 'Search',
          onPressed: onSearch,
        ),
      ),
      onSubmitted: (_) => onSearch(),
    );

    final statusFilter = AdminCompactFilterDropdown(
      label: 'Status',
      value: statusValue,
      width: dropdownWidth,
      enabled: statuses.isNotEmpty,
      entries: statusEntries,
      onSelected: onStatusChanged,
    );

    final assignmentFilter = AdminCompactFilterDropdown(
      label: 'Assignment',
      value: filters.assignment,
      width: dropdownWidth,
      entries: assignmentEntries,
      onSelected: onAssignmentChanged,
    );

    final timeFilter = AdminCompactFilterDropdown(
      label: 'Time range',
      value: filters.timeRange,
      width: dropdownWidth,
      entries: timeEntries,
      onSelected: onTimeRangeChanged,
    );

    final refreshButton = IconButton.filledTonal(
      onPressed: onRefresh,
      tooltip: 'Refresh',
      icon: const Icon(Icons.sync, size: 20),
    );

    final resetButton = OutlinedButton.icon(
      onPressed: onReset,
      icon: const Icon(Icons.filter_alt_off, size: 18),
      label: const Text('Reset'),
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
          if (compact) ...[
            searchField,
            const SizedBox(height: 10),
            statusFilter,
            const SizedBox(height: 10),
            assignmentFilter,
            const SizedBox(height: 10),
            timeFilter,
            const SizedBox(height: 10),
            Row(
              children: [
                refreshButton,
                const SizedBox(width: 8),
                Expanded(child: resetButton),
              ],
            ),
          ] else
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 3, child: searchField),
                const SizedBox(width: 10),
                statusFilter,
                const SizedBox(width: 10),
                assignmentFilter,
                const SizedBox(width: 10),
                timeFilter,
                const SizedBox(width: 6),
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: refreshButton,
                ),
                const SizedBox(width: 6),
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: resetButton,
                ),
              ],
            ),
          if (filters.timeRange == kTimeRangeCustom) ...[
            const SizedBox(height: 10),
            if (compact)
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  AdminCompactDateField(
                    label: 'From',
                    value: filters.customDateFrom,
                    onChanged: onCustomDateFromChanged,
                  ),
                  const SizedBox(height: 8),
                  AdminCompactDateField(
                    label: 'To',
                    value: filters.customDateTo,
                    onChanged: onCustomDateToChanged,
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
                    value: filters.customDateFrom,
                    width: 150,
                    onChanged: onCustomDateFromChanged,
                  ),
                  AdminCompactDateField(
                    label: 'To',
                    value: filters.customDateTo,
                    width: 150,
                    onChanged: onCustomDateToChanged,
                  ),
                ],
              ),
            if (dateRangeError != null) ...[
              const SizedBox(height: 6),
              Text(
                dateRangeError!,
                style: AdminTypography.kpiHelper(palette).copyWith(
                  color: palette.red,
                ),
              ),
            ],
          ],
        ],
      ),
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
      return Column(
        children: items
            .map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _DeliveryRow(
                  item: item,
                  onDetails: () => onDetails(item),
                ),
              ),
            )
            .toList(),
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
          Container(
            padding: const EdgeInsetsDirectional.fromSTEB(14, 10, 14, 10),
            decoration: BoxDecoration(
              color: palette.isDark
                  ? palette.cardBackground
                  : const Color(0xFFF9FAFB),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(14)),
              border: Border(bottom: BorderSide(color: palette.cardBorder)),
            ),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: Text(
                    'Material',
                    style: AdminTypography.kpiLabel(palette),
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: Text(
                    'People',
                    style: AdminTypography.kpiLabel(palette),
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: Text(
                    'Route',
                    style: AdminTypography.kpiLabel(palette),
                  ),
                ),
                Expanded(
                  flex: 2,
                  child: Text(
                    'Timeline',
                    style: AdminTypography.kpiLabel(palette),
                  ),
                ),
                const SizedBox(width: 88, child: Text('')),
              ],
            ),
          ),
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) Divider(height: 1, color: palette.cardBorder),
            _DeliveryRow(
              item: items[i],
              onDetails: () => onDetails(items[i]),
              dense: true,
            ),
          ],
        ],
      ),
    );
  }
}

class _DeliveryRow extends StatelessWidget {
  const _DeliveryRow({
    required this.item,
    required this.onDetails,
    this.dense = false,
  });

  final AdminDeliveryListItem item;
  final VoidCallback onDetails;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final requestedAt = formatAdminDateTime(item.requestedAt);
    final pickedUpAt = formatAdminDateTime(item.pickedUpAt);
    final deliveredAt = formatAdminDateTime(item.deliveredAt);
    final driverLabel = item.driver == null
        ? 'Unassigned'
        : displayPersonLabel(item.driver!.displayName, item.driver!.email);

    final content = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 3,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.material.title.isEmpty ? 'Untitled material' : item.material.title,
                style: AdminTypography.sectionTitle(palette).copyWith(fontSize: 14),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 6),
              AdminStatusBadge(status: item.status),
            ],
          ),
        ),
        Expanded(
          flex: 2,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Learner: ${displayPersonLabel(item.learner.displayName, item.learner.email)}',
                style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 13),
              ),
              const SizedBox(height: 2),
              Text(
                'Supplier: ${displayPersonLabel(item.supplier.displayName, item.supplier.email)}',
                style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 13),
              ),
              const SizedBox(height: 2),
              Text(
                'Driver: $driverLabel',
                style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 13),
              ),
            ],
          ),
        ),
        Expanded(
          flex: 2,
          child: Text(
            _formatRouteLabel(item),
            style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 13),
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        Expanded(
          flex: 2,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (requestedAt != null)
                Text(
                  'Requested: $requestedAt',
                  style: AdminTypography.kpiHelper(palette).copyWith(
                    color: palette.textMuted,
                  ),
                ),
              if (pickedUpAt != null) ...[
                const SizedBox(height: 2),
                Text(
                  'Picked up: $pickedUpAt',
                  style: AdminTypography.kpiHelper(palette).copyWith(
                    color: palette.textMuted,
                  ),
                ),
              ],
              if (deliveredAt != null) ...[
                const SizedBox(height: 2),
                Text(
                  'Delivered: $deliveredAt',
                  style: AdminTypography.kpiHelper(palette).copyWith(
                    color: palette.textMuted,
                  ),
                ),
              ],
            ],
          ),
        ),
        SizedBox(
          width: 88,
          child: Align(
            alignment: AlignmentDirectional.centerEnd,
            child: TextButton(
              onPressed: onDetails,
              child: const Text('Details'),
            ),
          ),
        ),
      ],
    );

    if (dense) {
      return Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(14, 10, 14, 10),
        child: content,
      );
    }

    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: content,
    );
  }
}

class _DeliveryDetailDialog extends StatelessWidget {
  const _DeliveryDetailDialog({required this.detail});

  final AdminDeliveryDetail detail;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return AlertDialog(
      title: Text(detail.material.title.isEmpty ? 'Delivery details' : detail.material.title),
      content: SizedBox(
        width: 560,
        child: SingleChildScrollView(
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
                    value: formatAdminDateTime(detail.requestedAt) ??
                        detail.requestedAt,
                  ),
                  if (detail.deliveredAt != null)
                    AdminDetailRow(
                      label: 'Delivered at',
                      value: formatAdminDateTime(detail.deliveredAt) ??
                          detail.deliveredAt!,
                    ),
                  if (detail.cancelledAt != null)
                    AdminDetailRow(
                      label: 'Cancelled at',
                      value: formatAdminDateTime(detail.cancelledAt) ??
                          detail.cancelledAt!,
                    ),
                  if (detail.failedAt != null)
                    AdminDetailRow(
                      label: 'Failed at',
                      value:
                          formatAdminDateTime(detail.failedAt) ?? detail.failedAt!,
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
                            value: formatAdminDateTime(
                                  detail.driver!.acceptedAt,
                                ) ??
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
                      value: formatAdminDateTime(detail.pickup.arrivedAt) ??
                          detail.pickup.arrivedAt!,
                    ),
                  if (detail.pickup.pickedUpAt != null)
                    AdminDetailRow(
                      label: 'Picked up at',
                      value: formatAdminDateTime(detail.pickup.pickedUpAt) ??
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
                      value: formatAdminDateTime(detail.dropoff.arrivedAt) ??
                          detail.dropoff.arrivedAt!,
                    ),
                  if (detail.dropoff.deliveredAt != null)
                    AdminDetailRow(
                      label: 'Delivered at',
                      value: formatAdminDateTime(detail.dropoff.deliveredAt) ??
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
                          (event) => _TimelineEntry(item: event, palette: palette),
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
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Close'),
        ),
      ],
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
    final timestamp = formatAdminDateTime(item.timestamp) ?? item.timestamp ?? '—';

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
              style: AdminTypography.pageSubtitle(palette).copyWith(
                color: palette.textMuted,
                fontSize: 12,
              ),
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
    final capturedAt =
        formatAdminDateTime(ping.capturedAt) ?? ping.capturedAt;
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
            style: AdminTypography.pageSubtitle(palette).copyWith(
              color: palette.textMuted,
              fontSize: 12,
            ),
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
    required this.onPrevious,
    required this.onNext,
  });

  final int page;
  final int totalPages;
  final int total;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Row(
      children: [
        OutlinedButton(onPressed: onPrevious, child: const Text('Previous')),
        const SizedBox(width: 8),
        OutlinedButton(onPressed: onNext, child: const Text('Next')),
        const SizedBox(width: 12),
        Text(
          'Page $page of $totalPages · $total total',
          style: AdminTypography.kpiHelper(palette),
        ),
      ],
    );
  }
}
