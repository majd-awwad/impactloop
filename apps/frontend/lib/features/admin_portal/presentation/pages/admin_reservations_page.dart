import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/config/api_config.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/admin_reservations_api.dart';
import '../../data/models/admin_reservations_models.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../../reservations/presentation/learner_reservation_ui_helpers.dart';
import '../theme/admin_decoration_set.dart';
import '../theme/admin_palette.dart';
import '../widgets/admin_empty_state.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;
import '../widgets/admin_monitoring_filters.dart';
import '../widgets/admin_monitoring_utils.dart';

class _ReservationFilters {
  const _ReservationFilters({
    required this.page,
    required this.search,
    required this.status,
    required this.hasDelivery,
    required this.timeRange,
    this.customDateFrom,
    this.customDateTo,
  });

  final int page;
  final String search;
  final String status;
  final String hasDelivery;
  final String timeRange;
  final String? customDateFrom;
  final String? customDateTo;

  static const limit = 20;

  _ReservationFilters copyWith({
    int? page,
    String? search,
    String? status,
    String? hasDelivery,
    String? timeRange,
    String? customDateFrom,
    String? customDateTo,
    bool clearCustomDates = false,
  }) {
    return _ReservationFilters(
      page: page ?? this.page,
      search: search ?? this.search,
      status: status ?? this.status,
      hasDelivery: hasDelivery ?? this.hasDelivery,
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
      hasDelivery != 'ALL' ||
      timeRange != kTimeRangeAll ||
      (customDateFrom != null && customDateFrom!.isNotEmpty) ||
      (customDateTo != null && customDateTo!.isNotEmpty);
}

class _ReservationFiltersNotifier extends Notifier<_ReservationFilters> {
  @override
  _ReservationFilters build() => const _ReservationFilters(
    page: 1,
    search: '',
    status: 'ALL',
    hasDelivery: 'ALL',
    timeRange: kTimeRangeAll,
  );

  void setPage(int page) => state = state.copyWith(page: page);
  void setSearch(String search) =>
      state = state.copyWith(page: 1, search: search);
  void setStatus(String status) =>
      state = state.copyWith(page: 1, status: status);
  void setHasDelivery(String hasDelivery) =>
      state = state.copyWith(page: 1, hasDelivery: hasDelivery);
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

final _reservationFiltersProvider =
    NotifierProvider<_ReservationFiltersNotifier, _ReservationFilters>(
      _ReservationFiltersNotifier.new,
    );

final adminReservationsListProvider = FutureProvider.autoDispose((ref) async {
  final filters = ref.watch(_reservationFiltersProvider);
  final resolved = resolveDateRange(
    timeRange: filters.timeRange,
    customDateFrom: filters.customDateFrom,
    customDateTo: filters.customDateTo,
  );
  final skipDates =
      filters.timeRange == kTimeRangeCustom && resolved.error != null;

  return ref
      .read(adminReservationsApiProvider)
      .fetchReservations(
        page: filters.page,
        limit: _ReservationFilters.limit,
        search: filters.search,
        status: filters.status,
        hasDelivery: filters.hasDelivery,
        dateFrom: skipDates ? null : resolved.dateFrom,
        dateTo: skipDates ? null : resolved.dateTo,
      );
});

final _adminReservationDetailProvider = FutureProvider.autoDispose
    .family<AdminReservationDetail, String>(
      (ref, id) =>
          ref.read(adminReservationsApiProvider).fetchReservationDetail(id),
    );

String _statusLabel(String status) => monitoringStatusLabel(status);

bool _reservationDeliveryStatusesMatch({
  required String reservationStatus,
  required String? deliveryStatus,
}) {
  final normalizedDelivery = deliveryStatus?.trim();
  if (normalizedDelivery == null || normalizedDelivery.isEmpty) {
    return false;
  }
  return reservationStatus.toUpperCase() == normalizedDelivery.toUpperCase();
}

String _statusBadgeText(String status, {String? scope}) {
  final label = _statusLabel(status);
  if (scope == null || scope.isEmpty) return label;
  return '$scope · $label';
}

AppStatusTone _reservationStatusTone(
  String status, {
  bool isDelivery = false,
}) => isDelivery
    ? deliveryStatusAppTone(status)
    : learnerReservationStatusTone(status);

Color _reservationStatusAccent(BuildContext context, String status) =>
    AppStatusStyle.of(context, _reservationStatusTone(status)).foreground;

class _ReservationStatusBadge extends StatelessWidget {
  const _ReservationStatusBadge({
    required this.status,
    this.isDelivery = false,
    this.scope,
  });

  final String status;
  final bool isDelivery;
  final String? scope;

  @override
  Widget build(BuildContext context) => AppStatusBadge(
    label: _statusBadgeText(status, scope: scope),
    tone: _reservationStatusTone(status, isDelivery: isDelivery),
  );
}

class _ReservationSummaryCard extends StatelessWidget {
  const _ReservationSummaryCard({
    required this.label,
    required this.value,
    required this.helper,
    required this.icon,
    required this.accent,
  });

  final String label;
  final String value;
  final String helper;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Container(
      constraints: const BoxConstraints(minHeight: 96),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: accent.withValues(alpha: palette.isDark ? 0.45 : 0.28),
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ColoredBox(color: accent, child: const SizedBox(width: 4)),
              Expanded(
                child: Padding(
                  padding: const EdgeInsetsDirectional.fromSTEB(12, 10, 12, 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: accent.withValues(
                            alpha: palette.isDark ? 0.22 : 0.14,
                          ),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(icon, size: 17, color: accent),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              label,
                              style: AdminTypography.kpiLabel(palette),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              value,
                              style: AdminTypography.kpiValue(
                                palette,
                              ).copyWith(fontSize: 17, color: accent),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              helper,
                              style: AdminTypography.kpiHelper(palette),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _formatQuantity(num quantity, String unit) {
  final qty = quantity == quantity.roundToDouble()
      ? quantity.toInt().toString()
      : quantity.toString();
  final trimmedUnit = unit.trim();
  return trimmedUnit.isEmpty ? qty : '$qty $trimmedUnit';
}

String _formatPrice(AdminReservationMaterialDetail material) {
  if (material.isFree) return 'Free';
  if (material.price == null) return 'Paid';
  final currency = material.currency?.trim();
  final price = material.price!.toString();
  return currency == null || currency.isEmpty ? price : '$currency $price';
}

class AdminReservationsPage extends ConsumerStatefulWidget {
  const AdminReservationsPage({super.key});

  @override
  ConsumerState<AdminReservationsPage> createState() =>
      _AdminReservationsPageState();
}

class _AdminReservationsPageState extends ConsumerState<AdminReservationsPage> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _refresh() => ref.invalidate(adminReservationsListProvider);

  void _applySearch() {
    ref
        .read(_reservationFiltersProvider.notifier)
        .setSearch(_searchController.text.trim());
  }

  Future<void> _showDetails(String reservationId) async {
    await showDialog<void>(
      context: context,
      builder: (context) =>
          _ReservationDetailDialog(reservationId: reservationId),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final filters = ref.watch(_reservationFiltersProvider);
    final reservationsAsync = ref.watch(adminReservationsListProvider);
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
            Text('Reservations', style: AdminTypography.pageTitle(palette)),
            const SizedBox(height: 4),
            Text(
              'Monitor material reservations across learners and suppliers.',
              style: AdminTypography.pageSubtitle(palette),
            ),
            const SizedBox(height: 20),
            reservationsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (error, _) => AdminMonitoringErrorPanel(
                title: 'Could not load reservations.',
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
                        .read(_reservationFiltersProvider.notifier)
                        .setStatus(value),
                    onHasDeliveryChanged: (value) => ref
                        .read(_reservationFiltersProvider.notifier)
                        .setHasDelivery(value),
                    onTimeRangeChanged: (value) => ref
                        .read(_reservationFiltersProvider.notifier)
                        .setTimeRange(value),
                    onCustomDateFromChanged: (value) => ref
                        .read(_reservationFiltersProvider.notifier)
                        .setCustomDateFrom(value),
                    onCustomDateToChanged: (value) => ref
                        .read(_reservationFiltersProvider.notifier)
                        .setCustomDateTo(value),
                    onReset: () {
                      _searchController.clear();
                      ref.read(_reservationFiltersProvider.notifier).reset();
                    },
                    onRefresh: _refresh,
                  ),
                  const SizedBox(height: 16),
                  if (data.items.isEmpty)
                    AdminEmptyState(
                      icon: Icons.event_note_outlined,
                      title: filters.hasActiveFilters
                          ? 'No reservations match these filters.'
                          : 'No reservations recorded yet.',
                      subtitle: filters.hasActiveFilters
                          ? 'Try adjusting filters or reset to see all reservations.'
                          : 'Learner material reservations will appear here as they are created.',
                    )
                  else ...[
                    _ReservationsList(
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
                                .read(_reservationFiltersProvider.notifier)
                                .setPage(data.pagination.page - 1)
                          : null,
                      onNext: data.pagination.page < data.pagination.totalPages
                          ? () => ref
                                .read(_reservationFiltersProvider.notifier)
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

  final AdminReservationsSummary summary;
  final AdminPalette palette;

  @override
  Widget build(BuildContext context) {
    final stats = [
      (
        'Total',
        summary.total.toString(),
        'All reservations',
        Icons.event_note_outlined,
        palette.blue,
      ),
      (
        'Pending',
        summary.pending.toString(),
        'Awaiting supplier response',
        Icons.hourglass_empty_outlined,
        palette.amber,
      ),
      (
        'Accepted / active',
        summary.acceptedActive.toString(),
        'Accepted and in progress',
        Icons.check_circle_outline,
        palette.green,
      ),
      (
        'Completed',
        summary.completed.toString(),
        'Finished reservations',
        Icons.task_alt_outlined,
        palette.purple,
      ),
      (
        'With delivery',
        summary.withDelivery.toString(),
        'Linked to internal delivery',
        Icons.local_shipping_outlined,
        palette.primaryTeal,
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
                  child: _ReservationSummaryCard(
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

class _FiltersPanel extends StatefulWidget {
  const _FiltersPanel({
    required this.compact,
    required this.searchController,
    required this.filters,
    required this.statuses,
    required this.onSearch,
    required this.onStatusChanged,
    required this.onHasDeliveryChanged,
    required this.onTimeRangeChanged,
    required this.onCustomDateFromChanged,
    required this.onCustomDateToChanged,
    required this.onReset,
    required this.onRefresh,
    this.dateRangeError,
  });

  final bool compact;
  final TextEditingController searchController;
  final _ReservationFilters filters;
  final List<String> statuses;
  final String? dateRangeError;
  final VoidCallback onSearch;
  final ValueChanged<String> onStatusChanged;
  final ValueChanged<String> onHasDeliveryChanged;
  final ValueChanged<String> onTimeRangeChanged;
  final ValueChanged<String?> onCustomDateFromChanged;
  final ValueChanged<String?> onCustomDateToChanged;
  final VoidCallback onReset;
  final VoidCallback onRefresh;

  @override
  State<_FiltersPanel> createState() => _FiltersPanelState();
}

class _FiltersPanelState extends State<_FiltersPanel> {
  bool _advancedOpen = false;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final dropdownWidth = widget.compact ? double.infinity : 170.0;
    final statusValue =
        safeDropdownValue(widget.filters.status, widget.statuses) ?? 'ALL';

    final statusEntries = [
      const DropdownMenuEntry(value: 'ALL', label: 'All statuses'),
      ...widget.statuses.map(
        (status) =>
            DropdownMenuEntry(value: status, label: _statusLabel(status)),
      ),
    ];
    const hasDeliveryEntries = [
      DropdownMenuEntry(value: 'ALL', label: 'All reservations'),
      DropdownMenuEntry(value: 'YES', label: 'With delivery'),
      DropdownMenuEntry(value: 'NO', label: 'Without delivery'),
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
        hintText: 'Search material, learner, or supplier…',
        border: const OutlineInputBorder(),
        isDense: true,
        suffixIcon: IconButton(
          icon: const Icon(Icons.search, size: 20),
          tooltip: 'Search',
          onPressed: widget.onSearch,
        ),
      ),
      onSubmitted: (_) => widget.onSearch(),
    );

    final statusFilter = AdminCompactFilterDropdown(
      label: 'Status',
      value: statusValue,
      width: dropdownWidth,
      enabled: widget.statuses.isNotEmpty,
      entries: statusEntries,
      onSelected: widget.onStatusChanged,
    );

    final hasDeliveryFilter = AdminCompactFilterDropdown(
      label: 'Delivery',
      value: widget.filters.hasDelivery,
      width: dropdownWidth,
      entries: hasDeliveryEntries,
      onSelected: widget.onHasDeliveryChanged,
    );

    final timeFilter = AdminCompactFilterDropdown(
      label: 'Time range',
      value: widget.filters.timeRange,
      width: dropdownWidth,
      entries: timeEntries,
      onSelected: widget.onTimeRangeChanged,
    );

    final refreshButton = IconButton.filledTonal(
      onPressed: widget.onRefresh,
      tooltip: 'Refresh',
      icon: const Icon(Icons.sync, size: 20),
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
          if (widget.compact) ...[
            searchField,
            const SizedBox(height: 10),
            statusFilter,
            const SizedBox(height: 10),
            hasDeliveryFilter,
            const SizedBox(height: 10),
            timeFilter,
            const SizedBox(height: 10),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: refreshButton,
            ),
          ] else
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 3, child: searchField),
                const SizedBox(width: 10),
                statusFilter,
                const SizedBox(width: 10),
                hasDeliveryFilter,
                const SizedBox(width: 10),
                timeFilter,
                const SizedBox(width: 6),
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: refreshButton,
                ),
              ],
            ),
          if (widget.filters.timeRange == kTimeRangeCustom) ...[
            const SizedBox(height: 10),
            if (widget.compact)
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
          const SizedBox(height: 8),
          InkWell(
            onTap: () => setState(() => _advancedOpen = !_advancedOpen),
            borderRadius: BorderRadius.circular(6),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _advancedOpen ? Icons.expand_less : Icons.expand_more,
                    size: 20,
                    color: palette.textMuted,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Advanced filters',
                    style: AdminTypography.kpiLabel(palette),
                  ),
                ],
              ),
            ),
          ),
          if (_advancedOpen) ...[
            const SizedBox(height: 8),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: OutlinedButton.icon(
                onPressed: widget.onReset,
                style: AppStatusButtonStyle.outlined(
                  context,
                  AppStatusTone.neutral,
                ),
                icon: const Icon(Icons.filter_alt_off, size: 18),
                label: const Text('Reset'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ReservationsList extends StatelessWidget {
  const _ReservationsList({
    required this.items,
    required this.compact,
    required this.onDetails,
  });

  final List<AdminReservationListItem> items;
  final bool compact;
  final ValueChanged<String> onDetails;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    if (compact) {
      return Column(
        children: items
            .map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _ReservationRow(
                  item: item,
                  onTap: () => onDetails(item.id),
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
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(14),
              ),
              border: Border(bottom: BorderSide(color: palette.cardBorder)),
            ),
            child: Row(
              children: [
                Expanded(
                  flex: 4,
                  child: Text(
                    'Material',
                    style: AdminTypography.kpiLabel(palette),
                  ),
                ),
                Expanded(
                  flex: 3,
                  child: Text(
                    'Learner',
                    style: AdminTypography.kpiLabel(palette),
                  ),
                ),
                Expanded(
                  flex: 3,
                  child: Text(
                    'Supplier',
                    style: AdminTypography.kpiLabel(palette),
                  ),
                ),
                SizedBox(
                  width: 96,
                  child: Text(
                    'Status',
                    style: AdminTypography.kpiLabel(palette),
                  ),
                ),
                SizedBox(
                  width: 72,
                  child: Text('Qty', style: AdminTypography.kpiLabel(palette)),
                ),
                SizedBox(
                  width: 120,
                  child: Text(
                    'Created',
                    style: AdminTypography.kpiLabel(palette),
                  ),
                ),
                SizedBox(
                  width: 100,
                  child: Text(
                    'Delivery',
                    style: AdminTypography.kpiLabel(palette),
                  ),
                ),
              ],
            ),
          ),
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) Divider(height: 1, color: palette.cardBorder),
            _ReservationRow(
              item: items[i],
              dense: true,
              onTap: () => onDetails(items[i].id),
            ),
          ],
        ],
      ),
    );
  }
}

class _ReservationRow extends StatelessWidget {
  const _ReservationRow({
    required this.item,
    required this.onTap,
    this.dense = false,
  });

  final AdminReservationListItem item;
  final VoidCallback onTap;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final created = formatAdminDateTime(item.createdAt) ?? item.createdAt;
    final learnerLabel = displayPersonLabel(
      item.learner.displayName,
      item.learner.email,
    );
    final supplierLabel = displayPersonLabel(
      item.supplier.displayName,
      item.supplier.email,
    );
    final deliveryStatus = item.delivery?.status;
    final statusesMatch = _reservationDeliveryStatusesMatch(
      reservationStatus: item.status,
      deliveryStatus: deliveryStatus,
    );
    final deliveryLabel = deliveryStatus != null && deliveryStatus.isNotEmpty
        ? _statusLabel(deliveryStatus)
        : item.hasDelivery
        ? 'Linked'
        : '—';
    final statusAccent = _reservationStatusAccent(context, item.status);

    final inner = InkWell(
      onTap: onTap,
      child: dense
          ? Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(14, 10, 14, 10),
              child: _buildDenseRow(
                palette,
                learnerLabel,
                supplierLabel,
                created,
                deliveryLabel,
                statusesMatch,
              ),
            )
          : _buildCard(
              palette,
              learnerLabel,
              supplierLabel,
              created,
              deliveryLabel,
              statusesMatch,
            ),
    );

    return ClipRRect(
      borderRadius: dense ? BorderRadius.zero : BorderRadius.circular(14),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ColoredBox(color: statusAccent, child: const SizedBox(width: 3)),
            Expanded(child: inner),
          ],
        ),
      ),
    );
  }

  Widget _buildDenseRow(
    AdminPalette palette,
    String learnerLabel,
    String supplierLabel,
    String created,
    String deliveryLabel,
    bool statusesMatch,
  ) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 4,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _MaterialThumb(imageUrl: item.material.imageUrl, size: 40),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  item.material.title,
                  style: AdminTypography.sectionTitle(
                    palette,
                  ).copyWith(fontSize: 13),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          flex: 3,
          child: Text(
            learnerLabel,
            style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 13),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        Expanded(
          flex: 3,
          child: Text(
            supplierLabel,
            style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 13),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        SizedBox(
          width: 96,
          child: _ReservationStatusBadge(
            status: item.status,
            scope: statusesMatch ? 'Reservation' : null,
          ),
        ),
        SizedBox(
          width: 72,
          child: Text(
            _formatQuantity(item.quantityRequested, item.unit),
            style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 13),
          ),
        ),
        SizedBox(
          width: 120,
          child: Text(
            created,
            style: AdminTypography.kpiHelper(palette),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        SizedBox(
          width: 100,
          child: item.delivery != null && item.delivery!.status.isNotEmpty
              ? _ReservationStatusBadge(
                  status: item.delivery!.status,
                  isDelivery: true,
                  scope: statusesMatch ? 'Delivery' : null,
                )
              : Text(deliveryLabel, style: AdminTypography.kpiHelper(palette)),
        ),
      ],
    );
  }

  Widget _buildCard(
    AdminPalette palette,
    String learnerLabel,
    String supplierLabel,
    String created,
    String deliveryLabel,
    bool statusesMatch,
  ) {
    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 14, 12),
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
              _MaterialThumb(imageUrl: item.material.imageUrl),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.material.title,
                      style: AdminTypography.sectionTitle(
                        palette,
                      ).copyWith(fontSize: 14),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        _ReservationStatusBadge(
                          status: item.status,
                          scope: statusesMatch ? 'Reservation' : null,
                        ),
                        Text(
                          _formatQuantity(item.quantityRequested, item.unit),
                          style: AdminTypography.kpiHelper(palette),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _CardMetaRow(label: 'Learner', value: learnerLabel, palette: palette),
          const SizedBox(height: 4),
          _CardMetaRow(
            label: 'Supplier',
            value: supplierLabel,
            palette: palette,
          ),
          const SizedBox(height: 4),
          _CardMetaRow(label: 'Created', value: created, palette: palette),
          if (item.hasDelivery) ...[
            const SizedBox(height: 4),
            _CardMetaRow(
              label: 'Delivery',
              value: item.delivery != null && item.delivery!.status.isNotEmpty
                  ? '—'
                  : deliveryLabel,
              palette: palette,
              trailing:
                  item.delivery != null && item.delivery!.status.isNotEmpty
                  ? _ReservationStatusBadge(
                      status: item.delivery!.status,
                      isDelivery: true,
                      scope: statusesMatch ? 'Delivery' : null,
                    )
                  : null,
            ),
          ],
        ],
      ),
    );
  }
}

class _CardMetaRow extends StatelessWidget {
  const _CardMetaRow({
    required this.label,
    required this.value,
    required this.palette,
    this.trailing,
  });

  final String label;
  final String value;
  final AdminPalette palette;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 72,
          child: Text(label, style: AdminTypography.kpiHelper(palette)),
        ),
        Expanded(
          child:
              trailing ??
              Text(
                value,
                style: AdminTypography.pageSubtitle(
                  palette,
                ).copyWith(fontSize: 13),
              ),
        ),
      ],
    );
  }
}

class _MaterialThumb extends StatelessWidget {
  const _MaterialThumb({this.imageUrl, this.size = 56});

  final String? imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final resolved = imageUrl == null || imageUrl!.isEmpty
        ? null
        : ApiConfig.resolveMediaUrl(imageUrl!);

    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: size,
        height: size,
        color: palette.bannerBackground,
        child: resolved == null
            ? Icon(
                Icons.image_outlined,
                color: palette.textMuted,
                size: size * 0.4,
              )
            : Image.network(
                resolved,
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Icon(
                  Icons.broken_image_outlined,
                  color: palette.textMuted,
                  size: size * 0.4,
                ),
              ),
      ),
    );
  }
}

class _ReservationDetailDialog extends ConsumerWidget {
  const _ReservationDetailDialog({required this.reservationId});

  final String reservationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(
      _adminReservationDetailProvider(reservationId),
    );

    return AppDialogShell(
      title: const Text('Reservation details'),
      maxWidth: 600,
      content: SizedBox(
        width: 560,
        child: detailAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (error, _) => AdminMonitoringErrorPanel(
            title: 'Could not load reservation details.',
            message: error is ApiException
                ? error.displayMessage
                : error.toString(),
            onRetry: () =>
                ref.invalidate(_adminReservationDetailProvider(reservationId)),
          ),
          data: (detail) => _ReservationDetailBody(detail: detail),
        ),
      ),
    );
  }
}

class _ReservationDetailBody extends StatelessWidget {
  const _ReservationDetailBody({required this.detail});

  final AdminReservationDetail detail;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final learnerLabel = displayPersonLabel(
      detail.learner.displayName,
      detail.learner.email,
    );
    final supplierLabel = displayPersonLabel(
      detail.supplier.displayName,
      detail.supplier.email,
    );
    final pickupWindow = _formatPickupWindow(
      detail.pickupWindowStart,
      detail.pickupWindowEnd,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AdminDetailSection(
          title: 'Reservation summary',
          children: [
            AdminDetailRow(label: 'Status', value: _statusLabel(detail.status)),
            AdminDetailRow(
              label: 'Quantity',
              value: _formatQuantity(detail.quantityRequested, detail.unit),
            ),
            if (detail.message != null && detail.message!.trim().isNotEmpty)
              AdminDetailRow(
                label: 'Learner message',
                value: detail.message!.trim(),
              ),
            AdminDetailRow(
              label: 'Created',
              value: formatAdminDateTime(detail.createdAt) ?? detail.createdAt,
            ),
            AdminDetailRow(
              label: 'Last updated',
              value: formatAdminDateTime(detail.updatedAt) ?? detail.updatedAt,
            ),
            if (detail.completedAt != null)
              AdminDetailRow(
                label: 'Completed',
                value:
                    formatAdminDateTime(detail.completedAt) ??
                    detail.completedAt!,
              ),
          ],
        ),
        AdminDetailSection(
          title: 'Learner',
          children: [
            AdminDetailRow(label: 'Name', value: learnerLabel),
            AdminDetailRow(label: 'Email', value: detail.learner.email),
            AdminDetailRow(
              label: 'User ID',
              value: detail.learner.id,
              muted: true,
            ),
          ],
        ),
        AdminDetailSection(
          title: 'Supplier',
          children: [
            AdminDetailRow(label: 'Name', value: supplierLabel),
            AdminDetailRow(label: 'Email', value: detail.supplier.email),
            if (detail.supplier.verificationStatus != null &&
                detail.supplier.verificationStatus!.isNotEmpty)
              AdminDetailRow(
                label: 'Verification',
                value: _statusLabel(detail.supplier.verificationStatus!),
              ),
            AdminDetailRow(
              label: 'User ID',
              value: detail.supplier.id,
              muted: true,
            ),
          ],
        ),
        AdminDetailSection(
          title: 'Material',
          children: [
            AdminDetailRow(label: 'Title', value: detail.material.title),
            AdminDetailRow(
              label: 'Category',
              value: detail.material.categoryName.isEmpty
                  ? '—'
                  : detail.material.categoryName,
            ),
            AdminDetailRow(
              label: 'Condition',
              value: detail.material.condition.isEmpty
                  ? '—'
                  : _statusLabel(detail.material.condition),
            ),
            AdminDetailRow(
              label: 'Price',
              value: _formatPrice(detail.material),
            ),
            AdminDetailRow(
              label: 'Pickup allowed',
              value: detail.material.pickupAllowed ? 'Yes' : 'No',
            ),
            AdminDetailRow(
              label: 'Delivery allowed',
              value: detail.material.deliveryAllowed ? 'Yes' : 'No',
            ),
            AdminDetailRow(
              label: 'Material ID',
              value: detail.material.id,
              muted: true,
            ),
          ],
        ),
        AdminDetailSection(
          title: 'Pickup / decision',
          children: [
            if (pickupWindow != null)
              AdminDetailRow(label: 'Pickup window', value: pickupWindow),
            AdminDetailRow(
              label: 'Fulfillment',
              value: _statusLabel(detail.fulfillmentMethod),
            ),
            if (detail.acceptedAt != null)
              AdminDetailRow(
                label: 'Accepted',
                value:
                    formatAdminDateTime(detail.acceptedAt) ??
                    detail.acceptedAt!,
              ),
            if (detail.rejectedAt != null)
              AdminDetailRow(
                label: 'Rejected',
                value:
                    formatAdminDateTime(detail.rejectedAt) ??
                    detail.rejectedAt!,
              ),
            if (detail.cancelledAt != null)
              AdminDetailRow(
                label: 'Cancelled',
                value:
                    formatAdminDateTime(detail.cancelledAt) ??
                    detail.cancelledAt!,
              ),
            if (detail.supplierNote != null &&
                detail.supplierNote!.trim().isNotEmpty)
              AdminDetailRow(
                label: 'Supplier note',
                value: detail.supplierNote!.trim(),
              ),
            if (detail.rejectionReason != null &&
                detail.rejectionReason!.trim().isNotEmpty)
              AdminDetailRow(
                label: 'Rejection reason',
                value: detail.rejectionReason!.trim(),
              ),
          ],
        ),
        if (detail.linkedReport != null)
          AdminDetailSection(
            title: 'Linked report',
            children: [
              AdminDetailRow(
                label: 'Reason',
                value: humanizeEnum(detail.linkedReport!.reasonCode),
              ),
              AdminDetailRow(
                label: 'Status',
                value: adminIncidentReportStatusLabel(
                  detail.linkedReport!.status,
                ),
              ),
              const SizedBox(height: 4),
              TextButton.icon(
                onPressed: () {
                  final reportId = detail.linkedReport!.id;
                  Navigator.pop(context);
                  if (reportId.isNotEmpty) {
                    context.push('/admin/no-show-reports?open=$reportId');
                  } else {
                    context.push('/admin/no-show-reports');
                  }
                },
                style: AppStatusButtonStyle.text(
                  context,
                  AppStatusTone.neutral,
                ),
                icon: const Icon(Icons.open_in_new_rounded, size: 18),
                label: const Text('Open report'),
              ),
              Text(
                'Opens Reservation reports where admins can review and resolve this incident.',
                style: AdminTypography.kpiHelper(palette),
              ),
            ],
          ),
        if (detail.delivery != null)
          AdminDetailSection(
            title: 'Linked delivery',
            children: [
              if (detail.delivery!.id.isNotEmpty) ...[
                AdminDetailRow(
                  label: 'Delivery ID',
                  value: detail.delivery!.id,
                  muted: true,
                ),
                if (detail.delivery!.status.isNotEmpty &&
                    !_reservationDeliveryStatusesMatch(
                      reservationStatus: detail.status,
                      deliveryStatus: detail.delivery!.status,
                    ))
                  AdminDetailRow(
                    label: 'Current status',
                    value: _statusLabel(detail.delivery!.status),
                  ),
                if (detail.delivery!.driver != null)
                  AdminDetailRow(
                    label: 'Driver',
                    value: displayPersonLabel(
                      detail.delivery!.driver!.displayName,
                      detail.delivery!.driver!.email,
                    ),
                  ),
                if (detail.delivery!.requestedAt.isNotEmpty)
                  AdminDetailRow(
                    label: 'Requested',
                    value:
                        formatAdminDateTime(detail.delivery!.requestedAt) ??
                        detail.delivery!.requestedAt,
                  ),
              ],
              const SizedBox(height: 4),
              TextButton.icon(
                onPressed: () {
                  final deliveryId = detail.delivery?.id;
                  Navigator.pop(context);
                  if (deliveryId != null && deliveryId.isNotEmpty) {
                    context.push('/admin/deliveries?open=$deliveryId');
                  } else {
                    context.push('/admin/deliveries');
                  }
                },
                style: AppStatusButtonStyle.text(
                  context,
                  AppStatusTone.neutral,
                ),
                icon: const Icon(Icons.local_shipping_outlined, size: 18),
                label: const Text('View delivery details'),
              ),
              Text(
                'Opens the deliveries monitor to review linked delivery records.',
                style: AdminTypography.kpiHelper(palette),
              ),
            ],
          ),
      ],
    );
  }

  String? _formatPickupWindow(String? start, String? end) {
    final startLabel = formatAdminDateTime(start);
    final endLabel = formatAdminDateTime(end);
    if (startLabel == null && endLabel == null) return null;
    if (startLabel != null && endLabel != null) {
      return '$startLabel – $endLabel';
    }
    return startLabel ?? endLabel;
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
    final buttonStyle = AppStatusButtonStyle.outlined(
      context,
      AppStatusTone.neutral,
    ).copyWith(
      minimumSize: const WidgetStatePropertyAll(Size(0, 42)),
    );

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        OutlinedButton(
          onPressed: onPrevious,
          style: buttonStyle,
          child: const Text('Previous'),
        ),
        OutlinedButton(
          onPressed: onNext,
          style: buttonStyle,
          child: const Text('Next'),
        ),
        Text(
          'Page $page of $totalPages · $total total',
          style: AdminTypography.kpiHelper(palette),
        ),
      ],
    );
  }
}
