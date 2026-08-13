import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_section_card.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/admin_reservations_api.dart';
import '../../data/models/admin_reservations_models.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../../reservations/presentation/learner_reservation_ui_helpers.dart';
import '../l10n/admin_l10n.dart';
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

/// Short, non-truncating labels for the fixed-width table Status column.
/// Full wording remains available via tooltip.
String _conciseReservationStatusLabel(String status) {
  switch (status.toUpperCase()) {
    case 'PENDING':
      return 'Pending';
    case 'AWAITING_LEARNER_CONFIRMATION':
      return 'Waiting for learner';
    case 'AWAITING_SUPPLIER_CONFIRMATION':
      return 'Waiting for supplier';
    case 'AWAITING_RESOLUTION':
      return 'Pending admin review';
    case 'ACCEPTED':
      return 'Accepted';
    case 'COMPLETED':
      return 'Completed';
    case 'EXPIRED':
      return 'Expired';
    case 'CANCELLED':
      return 'Cancelled';
    case 'REJECTED':
      return 'Rejected';
    case 'NO_SHOW':
      return 'Pickup missed';
    case 'FULFILLMENT_FAILED':
      return 'Fulfillment failed';
    default:
      return _statusLabel(status);
  }
}

AppStatusTone _reservationStatusTone(
  String status, {
  bool isDelivery = false,
}) => isDelivery
    ? deliveryStatusAppTone(status)
    : learnerReservationStatusTone(status);

/// Semantic status badge that never truncates: the visible label is a
/// concise, human-readable form and the full wording is available on hover.
class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status, this.isDelivery = false});

  final String status;
  final bool isDelivery;

  @override
  Widget build(BuildContext context) {
    final full = _statusLabel(status);
    final concise = isDelivery ? full : _conciseReservationStatusLabel(status);
    final badge = AppStatusBadge(
      label: concise,
      tone: _reservationStatusTone(status, isDelivery: isDelivery),
    );
    if (concise == full) return badge;
    return Tooltip(message: full, child: badge);
  }
}

String _formatQuantity(num quantity, String unit) {
  final qty = quantity == quantity.roundToDouble()
      ? quantity.toInt().toString()
      : quantity.toString();
  final trimmedUnit = unit.trim();
  return trimmedUnit.isEmpty ? qty : '$qty $trimmedUnit';
}

class AdminReservationsPage extends ConsumerStatefulWidget {
  const AdminReservationsPage({super.key});

  @override
  ConsumerState<AdminReservationsPage> createState() =>
      _AdminReservationsPageState();
}

class _AdminReservationsPageState extends ConsumerState<AdminReservationsPage> {
  final _searchController = TextEditingController();
  bool _isPreflightLoading = false;
  bool _isDialogOpen = false;

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

  String _activeFilterSummary(_ReservationFilters filters) {
    final parts = <String>[];
    if (filters.search.trim().isNotEmpty) {
      parts.add('Search: ${filters.search.trim()}');
    }
    if (filters.status != 'ALL') {
      parts.add('Status: ${filters.status}');
    }
    if (filters.hasDelivery != 'ALL') {
      parts.add('Has delivery: ${filters.hasDelivery}');
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
    return parts.isEmpty ? 'No filters (all reservations)' : parts.join(' · ');
  }

  Future<void> _exportReservations() async {
    if (!kIsWeb) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AdminL10n.of(context).exportWebOnly)),
      );
      return;
    }
    if (_isPreflightLoading || _isDialogOpen) return;

    final filters = ref.read(_reservationFiltersProvider);
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
    final api = ref.read(adminReservationsApiProvider);

    try {
      final preflight = await api.preflightExport(
        search: filters.search,
        status: filters.status,
        hasDelivery: filters.hasDelivery,
        dateFrom: resolved.dateFrom,
        dateTo: resolved.dateTo,
      );

      if (!mounted) return;

      if (preflight.count == 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AdminL10n.of(context).noReservationsMatchFilters),
          ),
        );
        return;
      }

      _isDialogOpen = true;
      final selectedFormat = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => AdminReservationsExportDialog(
          count: preflight.count,
          filterSummary: _activeFilterSummary(filters),
          formats: preflight.formats,
          onDownload: (format) => api.downloadExport(
            format: format,
            search: filters.search,
            status: filters.status,
            hasDelivery: filters.hasDelivery,
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
            'Reservation ${selectedFormat.toUpperCase()} export downloaded.',
          ),
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AdminL10n.of(context).localizedError(error))),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AdminL10n.of(context).localizedError(error))),
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
        padding: const EdgeInsetsDirectional.fromSTEB(24, 24, 24, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Reservations',
              style: AdminTypography.pageTitle(palette).copyWith(fontSize: 24),
            ),
            const SizedBox(height: 4),
            Text(
              'Monitor material reservations across learners and suppliers.',
              style: AdminTypography.pageSubtitle(palette),
            ),
            const SizedBox(height: 24),
            reservationsAsync.when(
              loading: () => const _ReservationsSkeleton(),
              error: (error, _) => AdminMonitoringErrorPanel(
                title: 'Could not load reservations.',
                message: AdminL10n.of(context).localizedError(error),
                onRetry: _refresh,
              ),
              data: (data) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _KpiRow(summary: data.summary),
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
                    onExport: kIsWeb ? _exportReservations : null,
                    exportLoading: _isPreflightLoading,
                  ),
                  const SizedBox(height: 16),
                  if (data.items.isEmpty)
                    _ReservationsEmptyState(
                      hasActiveFilters: filters.hasActiveFilters,
                      onReset: () {
                        _searchController.clear();
                        ref.read(_reservationFiltersProvider.notifier).reset();
                      },
                    )
                  else ...[
                    _ReservationsResults(
                      items: data.items,
                      compact: compact,
                      onDetails: _showDetails,
                      pagination: data.pagination,
                      onPageChanged: (page) => ref
                          .read(_reservationFiltersProvider.notifier)
                          .setPage(page),
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

/// ---------------------------------------------------------------------------
/// KPI row
/// ---------------------------------------------------------------------------

class _KpiRow extends StatelessWidget {
  const _KpiRow({required this.summary});

  final AdminReservationsSummary summary;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
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
        'Awaiting confirmation',
        Icons.hourglass_empty_outlined,
        palette.amber,
      ),
      (
        'Accepted / active',
        summary.acceptedActive.toString(),
        'Accepted or under resolution',
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
        const gap = 16.0;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: stats
              .map(
                (stat) => SizedBox(
                  width: columns == 1
                      ? double.infinity
                      : (constraints.maxWidth - (columns - 1) * gap) / columns,
                  child: _KpiCard(
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

class _KpiCard extends StatelessWidget {
  const _KpiCard({
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
      constraints: const BoxConstraints(minHeight: 132),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.cardBorder),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: palette.isDark ? 0.2 : 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 18, color: accent),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style: AdminTypography.kpiLabel(palette),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            value,
            style: AdminTypography.kpiValue(palette).copyWith(fontSize: 26),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            helper,
            style: AdminTypography.kpiHelper(palette),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

/// ---------------------------------------------------------------------------
/// Export dialog
/// ---------------------------------------------------------------------------

/// Public for widget tests; used by Admin Reservations export flow.
class AdminReservationsExportDialog extends StatefulWidget {
  const AdminReservationsExportDialog({
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
  State<AdminReservationsExportDialog> createState() =>
      _AdminReservationsExportDialogState();
}

class _AdminReservationsExportDialogState
    extends State<AdminReservationsExportDialog> {
  String _selectedFormat = 'xlsx';
  bool _isDownloading = false;
  String? _error;

  AdminExportFormatEligibility? get _selectedEligibility =>
      widget.formats[_selectedFormat];

  bool get _canExport =>
      !_isDownloading && (_selectedEligibility?.allowed ?? false);

  String get _formatDescription {
    switch (_selectedFormat) {
      case 'pdf':
        return 'Formatted administrative report';
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
        _error = AdminL10n.of(context).localizedError(error);
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _isDownloading = false;
        _error = AdminL10n.of(context).localizedError(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final adminL10n = AdminL10n.of(context);
    final pdfEligibility = widget.formats['pdf'];
    final pdfSelectable = pdfEligibility?.allowed ?? false;
    final limitMessage = (_selectedEligibility?.exceedsLimit ?? false)
        ? (_selectedFormat == 'pdf'
              ? 'This PDF report is limited to ${pdfEligibility?.maxAllowed ?? 500} reservations. Narrow the filters or select Excel/CSV.'
              : 'This export matches ${widget.count} reservations, which exceeds the limit of ${_selectedEligibility?.maxAllowed ?? 0}. Narrow your filters and try again.')
        : null;

    return AppDialogShell(
      title: Text(adminL10n.exportReservations),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Export ${widget.count} matching reservation${widget.count == 1 ? '' : 's'} (newest first).',
          ),
          const SizedBox(height: 8),
          Text(
            widget.filterSummary,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          Text(adminL10n.format),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: [
              ButtonSegment(value: 'xlsx', label: Text(adminL10n.excel)),
              ButtonSegment(
                value: 'pdf',
                label: Text(adminL10n.pdf),
                enabled: pdfSelectable,
              ),
              ButtonSegment(value: 'csv', label: Text(adminL10n.csv)),
            ],
            selected: {_selectedFormat},
            onSelectionChanged: _isDownloading
                ? null
                : (values) {
                    if (values.isEmpty) return;
                    final next = values.first;
                    // Disable PDF only when preflight marks it over limit.
                    if (next == 'pdf' && !pdfSelectable) return;
                    setState(() => _selectedFormat = next);
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
          child: Text(adminL10n.cancel),
        ),
        primaryAction: FilledButton(
          onPressed: _canExport ? _confirm : null,
          child: _isDownloading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(adminL10n.exportAction),
        ),
      ),
    );
  }
}

/// ---------------------------------------------------------------------------
/// Filters panel
/// ---------------------------------------------------------------------------

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
    this.onExport,
    this.exportLoading = false,
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
  final VoidCallback? onExport;
  final bool exportLoading;

  @override
  State<_FiltersPanel> createState() => _FiltersPanelState();
}

class _FiltersPanelState extends State<_FiltersPanel> {
  bool _advancedOpen = false;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final adminL10n = AdminL10n.of(context);
    final dropdownWidth = widget.compact ? double.infinity : 176.0;
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

    final searchField = SizedBox(
      height: 50,
      child: TextField(
        controller: widget.searchController,
        style: Theme.of(context).textTheme.bodyMedium,
        decoration: InputDecoration(
          filled: true,
          fillColor: palette.isDark
              ? palette.cardBackground
              : const Color(0xFFF9FAFB),
          prefixIcon: Icon(Icons.search, size: 20, color: palette.textMuted),
          hintText: 'Search material, learner, or supplier...',
          hintStyle: AdminTypography.pageSubtitle(
            palette,
          ).copyWith(fontSize: 14, color: palette.textMuted),
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(vertical: 14),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: palette.cardBorder),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: palette.cardBorder),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide(color: palette.primaryTeal, width: 1.4),
          ),
          suffixIcon: IconButton(
            icon: const Icon(Icons.search, size: 20),
            tooltip: adminL10n.search,
            onPressed: widget.onSearch,
          ),
        ),
        onSubmitted: (_) => widget.onSearch(),
      ),
    );

    final statusFilter = AdminCompactFilterDropdown(
      label: adminL10n.status,
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

    final refreshButton = SizedBox(
      width: 48,
      height: 48,
      child: IconButton(
        onPressed: widget.onRefresh,
        tooltip: 'Refresh',
        style: IconButton.styleFrom(
          backgroundColor: palette.primaryTeal.withValues(
            alpha: palette.isDark ? 0.2 : 0.1,
          ),
          foregroundColor: palette.primaryTeal,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        icon: const Icon(Icons.sync, size: 20),
      ),
    );

    final exportButton = widget.onExport == null
        ? null
        : SizedBox(
            height: 48,
            child: OutlinedButton.icon(
              onPressed: widget.exportLoading ? null : widget.onExport,
              style: OutlinedButton.styleFrom(
                foregroundColor: palette.primaryTeal,
                side: BorderSide(color: palette.cardBorder),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              icon: widget.exportLoading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.download_outlined, size: 18),
              label: Text(widget.exportLoading ? 'Preparing…' : adminL10n.exportAction),
            ),
          );

    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(16, 16, 16, 16),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.cardBorder),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.compact) ...[
            searchField,
            const SizedBox(height: 12),
            statusFilter,
            const SizedBox(height: 12),
            hasDeliveryFilter,
            const SizedBox(height: 12),
            timeFilter,
            const SizedBox(height: 12),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (exportButton != null) ...[
                    exportButton,
                    const SizedBox(width: 8),
                  ],
                  refreshButton,
                ],
              ),
            ),
          ] else
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 3, child: searchField),
                const SizedBox(width: 14),
                statusFilter,
                const SizedBox(width: 14),
                hasDeliveryFilter,
                const SizedBox(width: 14),
                timeFilter,
                if (exportButton != null) ...[
                  const SizedBox(width: 14),
                  exportButton,
                ],
                const SizedBox(width: 8),
                refreshButton,
              ],
            ),
          if (widget.filters.timeRange == kTimeRangeCustom) ...[
            const SizedBox(height: 12),
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
                spacing: 14,
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
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: widget.onReset,
                  style: AppStatusButtonStyle.outlined(
                    context,
                    AppStatusTone.neutral,
                  ),
                  icon: const Icon(Icons.filter_alt_off, size: 18),
                  label: Text(adminL10n.reset),
                ),
                if (widget.onExport != null)
                  OutlinedButton.icon(
                    onPressed: widget.exportLoading ? null : widget.onExport,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: palette.primaryTeal,
                      side: BorderSide(color: palette.cardBorder),
                    ),
                    icon: const Icon(Icons.download_outlined, size: 18),
                    label: Text(adminL10n.exportAction),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// ---------------------------------------------------------------------------
/// Results: table container + footer (pagination)
/// ---------------------------------------------------------------------------

/// Shared column proportions used identically by the header and every row so
/// columns can never drift between them.
abstract final class _Cols {
  static const materialFlex = 30;
  static const learnerFlex = 20;
  static const supplierFlex = 24;
  static const statusWidth = 165.0;
  static const qtyWidth = 90.0;
  static const createdWidth = 175.0;
  static const deliveryWidth = 150.0;
  static const actionsWidth = 76.0;
  static const gap = 12.0;
}

Widget _tableRowLayout({
  required Widget material,
  required Widget learner,
  required Widget supplier,
  required Widget status,
  required Widget qty,
  required Widget created,
  required Widget delivery,
  required Widget actions,
}) {
  return Row(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      Expanded(flex: _Cols.materialFlex, child: material),
      const SizedBox(width: _Cols.gap),
      Expanded(flex: _Cols.learnerFlex, child: learner),
      const SizedBox(width: _Cols.gap),
      Expanded(flex: _Cols.supplierFlex, child: supplier),
      const SizedBox(width: _Cols.gap),
      SizedBox(width: _Cols.statusWidth, child: status),
      const SizedBox(width: _Cols.gap),
      SizedBox(width: _Cols.qtyWidth, child: qty),
      const SizedBox(width: _Cols.gap),
      SizedBox(width: _Cols.createdWidth, child: created),
      const SizedBox(width: _Cols.gap),
      SizedBox(width: _Cols.deliveryWidth, child: delivery),
      const SizedBox(width: _Cols.gap),
      SizedBox(width: _Cols.actionsWidth, child: actions),
    ],
  );
}

class _ReservationsResults extends StatelessWidget {
  const _ReservationsResults({
    required this.items,
    required this.compact,
    required this.onDetails,
    required this.pagination,
    required this.onPageChanged,
  });

  final List<AdminReservationListItem> items;
  final bool compact;
  final ValueChanged<String> onDetails;
  final AdminReservationsPagination pagination;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final rangeStart = pagination.total == 0
        ? 0
        : (pagination.page - 1) * pagination.limit + 1;
    final rangeEndRaw = pagination.page * pagination.limit;
    final rangeEnd = rangeEndRaw > pagination.total
        ? pagination.total
        : rangeEndRaw;

    return Container(
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.cardBorder),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (compact)
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
                child: Column(
                  children: items
                      .map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: _ReservationMobileCard(
                            item: item,
                            onTap: () => onDetails(item.id),
                          ),
                        ),
                      )
                      .toList(),
                ),
              )
            else ...[
              _TableHeader(palette: palette),
              for (var i = 0; i < items.length; i++) ...[
                if (i > 0) Divider(height: 1, color: palette.cardBorder),
                _ReservationTableRow(
                  item: items[i],
                  onTap: () => onDetails(items[i].id),
                ),
              ],
            ],
            Divider(height: 1, color: palette.cardBorder),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              child: _ResultsFooter(
                rangeStart: rangeStart,
                rangeEnd: rangeEnd,
                total: pagination.total,
                page: pagination.page,
                totalPages: pagination.totalPages,
                onPageChanged: onPageChanged,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TableHeader extends StatelessWidget {
  const _TableHeader({required this.palette});

  final AdminPalette palette;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final adminL10n = AdminL10n.of(context);
    Widget label(String text, {TextAlign align = TextAlign.start}) => Text(
      text,
      textAlign: align,
      style: AdminTypography.kpiLabel(
        palette,
      ).copyWith(fontSize: 12, color: palette.textSecondary),
    );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      decoration: BoxDecoration(
        color: palette.isDark
            ? palette.cardBackground
            : const Color(0xFFF9FAFB),
        border: Border(bottom: BorderSide(color: palette.cardBorder)),
      ),
      child: _tableRowLayout(
        material: label('Material'),
        learner: label('Learner'),
        supplier: label('Supplier'),
        status: label(adminL10n.status),
        qty: label('Qty'),
        created: label('Created'),
        delivery: label('Delivery'),
        actions: label(adminL10n.actions, align: TextAlign.center),
      ),
    );
  }
}

class _ReservationTableRow extends StatelessWidget {
  const _ReservationTableRow({required this.item, required this.onTap});

  final AdminReservationListItem item;
  final VoidCallback onTap;

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

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        child: _tableRowLayout(
          material: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _MaterialThumb(imageUrl: item.material.imageUrl, size: 40),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  item.material.title,
                  style: AdminTypography.sectionTitle(
                    palette,
                  ).copyWith(fontSize: 13.5, fontWeight: FontWeight.w700),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          learner: Text(
            learnerLabel,
            style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 13),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          supplier: Text(
            supplierLabel,
            style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 13),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          status: Align(
            alignment: AlignmentDirectional.centerStart,
            child: _StatusBadge(status: item.status),
          ),
          qty: Text(
            _formatQuantity(item.quantityRequested, item.unit),
            style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 13),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          created: Text(
            created,
            style: AdminTypography.kpiHelper(palette).copyWith(fontSize: 12.5),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          delivery: Align(
            alignment: AlignmentDirectional.centerStart,
            child: deliveryStatus != null && deliveryStatus.isNotEmpty
                ? _StatusBadge(status: deliveryStatus, isDelivery: true)
                : Text('—', style: AdminTypography.kpiHelper(palette)),
          ),
          actions: Center(
            child: IconButton(
              onPressed: onTap,
              tooltip: AdminL10n.of(context).reservationDetails,
              visualDensity: VisualDensity.compact,
              icon: Icon(
                Icons.visibility_outlined,
                size: 19,
                color: palette.textSecondary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ReservationMobileCard extends StatelessWidget {
  const _ReservationMobileCard({required this.item, required this.onTap});

  final AdminReservationListItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final adminL10n = AdminL10n.of(context);
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

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
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
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                _MaterialThumb(imageUrl: item.material.imageUrl, size: 44),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    item.material.title,
                    style: AdminTypography.sectionTitle(
                      palette,
                    ).copyWith(fontSize: 14),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            _StatusBadge(status: item.status),
            const SizedBox(height: 10),
            _MobileMetaRow(label: 'Learner', value: learnerLabel),
            const SizedBox(height: 4),
            _MobileMetaRow(label: 'Supplier', value: supplierLabel),
            const SizedBox(height: 4),
            _MobileMetaRow(
              label: 'Qty',
              value: _formatQuantity(item.quantityRequested, item.unit),
            ),
            const SizedBox(height: 4),
            _MobileMetaRow(label: 'Created', value: created),
            const SizedBox(height: 4),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                SizedBox(
                  width: 72,
                  child: Text(
                    'Delivery',
                    style: AdminTypography.kpiHelper(palette),
                  ),
                ),
                Expanded(
                  child: deliveryStatus != null && deliveryStatus.isNotEmpty
                      ? Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: _StatusBadge(
                            status: deliveryStatus,
                            isDelivery: true,
                          ),
                        )
                      : Text(
                          '—',
                          style: AdminTypography.pageSubtitle(
                            palette,
                          ).copyWith(fontSize: 13),
                        ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: OutlinedButton.icon(
                onPressed: onTap,
                style: AppStatusButtonStyle.outlined(
                  context,
                  AppStatusTone.neutral,
                ),
                icon: const Icon(Icons.visibility_outlined, size: 17),
                label: Text(adminL10n.viewDetails),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MobileMetaRow extends StatelessWidget {
  const _MobileMetaRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 72,
          child: Text(label, style: AdminTypography.kpiHelper(palette)),
        ),
        Expanded(
          child: Text(
            value,
            style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 13),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

class _MaterialThumb extends StatelessWidget {
  const _MaterialThumb({this.imageUrl, this.size = 40});

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
                size: size * 0.45,
              )
            : Image.network(
                resolved,
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Icon(
                  Icons.broken_image_outlined,
                  color: palette.textMuted,
                  size: size * 0.45,
                ),
              ),
      ),
    );
  }
}

/// ---------------------------------------------------------------------------
/// Footer: result range + numbered pagination
/// ---------------------------------------------------------------------------

class _ResultsFooter extends StatelessWidget {
  const _ResultsFooter({
    required this.rangeStart,
    required this.rangeEnd,
    required this.total,
    required this.page,
    required this.totalPages,
    required this.onPageChanged,
  });

  final int rangeStart;
  final int rangeEnd;
  final int total;
  final int page;
  final int totalPages;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 12,
      runSpacing: 8,
      children: [
        Text(
          'Showing $rangeStart to $rangeEnd of $total results',
          style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 13),
        ),
        _Pagination(
          page: page,
          totalPages: totalPages,
          onPageChanged: onPageChanged,
        ),
      ],
    );
  }
}

class _Pagination extends StatelessWidget {
  const _Pagination({
    required this.page,
    required this.totalPages,
    required this.onPageChanged,
  });

  final int page;
  final int totalPages;
  final ValueChanged<int> onPageChanged;

  List<Object> _visiblePages() {
    final safeTotalPages = totalPages < 1 ? 1 : totalPages;
    final pages = <int>{1, safeTotalPages};
    for (var p = page - 1; p <= page + 1; p++) {
      if (p >= 1 && p <= safeTotalPages) pages.add(p);
    }
    final sorted = pages.toList()..sort();
    final items = <Object>[];
    int? previous;
    for (final p in sorted) {
      if (previous != null && p - previous > 1) items.add('…');
      items.add(p);
      previous = p;
    }
    return items;
  }

  @override
  Widget build(BuildContext context) {
    final adminL10n = AdminL10n.of(context);
    final neutralStyle =
        AppStatusButtonStyle.outlined(context, AppStatusTone.neutral).copyWith(
          minimumSize: const WidgetStatePropertyAll(Size(0, 40)),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: 14),
          ),
        );

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        OutlinedButton(
          onPressed: page > 1 ? () => onPageChanged(page - 1) : null,
          style: neutralStyle,
          child: Text(adminL10n.previous),
        ),
        for (final item in _visiblePages())
          if (item == '…')
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              child: Text('…'),
            )
          else
            _PageNumberButton(
              number: item as int,
              selected: item == page,
              onTap: () => onPageChanged(item),
            ),
        OutlinedButton(
          onPressed: page < totalPages ? () => onPageChanged(page + 1) : null,
          style: neutralStyle,
          child: Text(adminL10n.next),
        ),
      ],
    );
  }
}

class _PageNumberButton extends StatelessWidget {
  const _PageNumberButton({
    required this.number,
    required this.selected,
    required this.onTap,
  });

  final int number;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    if (selected) {
      return SizedBox(
        width: 40,
        height: 40,
        child: FilledButton(
          onPressed: onTap,
          style: FilledButton.styleFrom(
            backgroundColor: palette.primaryTeal,
            foregroundColor: Colors.white,
            padding: EdgeInsets.zero,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          child: Text('$number'),
        ),
      );
    }

    return SizedBox(
      width: 40,
      height: 40,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          foregroundColor: palette.textSecondary,
          side: BorderSide(color: palette.cardBorder),
          padding: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        child: Text('$number'),
      ),
    );
  }
}

/// ---------------------------------------------------------------------------
/// Empty and loading states
/// ---------------------------------------------------------------------------

class _ReservationsEmptyState extends StatelessWidget {
  const _ReservationsEmptyState({
    required this.hasActiveFilters,
    required this.onReset,
  });

  final bool hasActiveFilters;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final adminL10n = AdminL10n.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 24),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Column(
            children: [
              AdminEmptyState(
                icon: Icons.event_note_outlined,
                title: 'No reservations found',
                subtitle: hasActiveFilters
                    ? 'Try adjusting filters or reset to see all reservations.'
                    : 'Learner material reservations will appear here as they are created.',
              ),
              if (hasActiveFilters) ...[
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: onReset,
                  style: AppStatusButtonStyle.outlined(
                    context,
                    AppStatusTone.neutral,
                  ),
                  icon: const Icon(Icons.filter_alt_off, size: 18),
                  label: Text(adminL10n.resetFilters),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ReservationsSkeleton extends StatelessWidget {
  const _ReservationsSkeleton();

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final blockColor = palette.isDark
        ? palette.cardBorder.withValues(alpha: 0.3)
        : const Color(0xFFEEF0EC);

    Widget block({double? width, required double height, double radius = 10}) =>
        Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            color: blockColor,
            borderRadius: BorderRadius.circular(radius),
          ),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            const gap = 16.0;
            final columns = constraints.maxWidth >= 1100 ? 5 : 2;
            final width =
                (constraints.maxWidth - (columns - 1) * gap) / columns;
            return Wrap(
              spacing: gap,
              runSpacing: gap,
              children: List.generate(
                5,
                (_) => SizedBox(
                  width: width,
                  child: block(height: 132, radius: 16),
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 16),
        block(height: 82, radius: 16),
        const SizedBox(height: 16),
        Container(
          decoration: BoxDecoration(
            color: palette.cardBackground,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: palette.cardBorder),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            children: List.generate(
              5,
              (index) => Padding(
                padding: EdgeInsets.only(bottom: index == 4 ? 0 : 12),
                child: block(height: 56, radius: 12),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// ---------------------------------------------------------------------------
/// Reservation details dialog (unchanged presentation, out of visual scope)
/// ---------------------------------------------------------------------------

/// Distinct soft icon tones for reservation-detail metadata and section cards.
///
/// This intentionally goes beyond [AppStatusTone] (which has no purple/teal
/// entries) so each section card can carry a visually distinct, theme-derived
/// accent as required by the reservation-details layout.
enum _AccentTone { info, success, warning, danger, neutral, purple, teal }

(Color, Color) _accentColors(AppThemeColors colors, _AccentTone tone) {
  switch (tone) {
    case _AccentTone.info:
      return (colors.info.withValues(alpha: 0.14), colors.info);
    case _AccentTone.success:
      return (colors.successSoft, colors.success);
    case _AccentTone.warning:
      return (colors.warningSoft, colors.warningText);
    case _AccentTone.danger:
      return (colors.dangerSoft, colors.danger);
    case _AccentTone.purple:
      return (colors.purpleStart.withValues(alpha: 0.14), colors.purpleStart);
    case _AccentTone.teal:
      return (colors.accentMint.withValues(alpha: 0.16), colors.accentMint);
    case _AccentTone.neutral:
      return (colors.surfaceMuted, colors.textSecondary);
  }
}

_AccentTone _fromStatusTone(AppStatusTone tone) {
  switch (tone) {
    case AppStatusTone.primary:
    case AppStatusTone.success:
      return _AccentTone.success;
    case AppStatusTone.warning:
      return _AccentTone.warning;
    case AppStatusTone.danger:
      return _AccentTone.danger;
    case AppStatusTone.info:
      return _AccentTone.info;
    case AppStatusTone.neutral:
      return _AccentTone.neutral;
  }
}

String _linkedContextLabel(AdminReservationDetail detail) {
  final delivery = detail.delivery;
  if (delivery != null && delivery.status.isNotEmpty) {
    return deliveryStatusLabel(delivery.status);
  }
  final report = detail.linkedReport;
  if (report != null) {
    return '${humanizeEnum(report.reasonCode)} reported';
  }
  return 'No linked delivery';
}

_AccentTone _linkedContextTone(AdminReservationDetail detail) {
  final delivery = detail.delivery;
  if (delivery != null && delivery.status.isNotEmpty) {
    return _fromStatusTone(deliveryStatusAppTone(delivery.status));
  }
  if (detail.linkedReport != null) {
    return _AccentTone.warning;
  }
  return _AccentTone.neutral;
}

class _ReservationDetailDialog extends ConsumerWidget {
  const _ReservationDetailDialog({required this.reservationId});

  final String reservationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final adminL10n = AdminL10n.of(context);
    final detailAsync = ref.watch(
      _adminReservationDetailProvider(reservationId),
    );

    return AppDialogShell(
      title: Text(adminL10n.reservationDetails),
      maxWidth: 1020,
      borderRadius: AppRadius.xlAll,
      content: detailAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.symmetric(vertical: 48),
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (error, _) => AdminMonitoringErrorPanel(
          title: 'Could not load reservation details.',
          message: AdminL10n.of(context).localizedError(error),
          onRetry: () =>
              ref.invalidate(_adminReservationDetailProvider(reservationId)),
        ),
        data: (detail) => _ReservationDetailBody(detail: detail),
      ),
      footer: AppDialogFooter.decision(
        secondaryAction: OutlinedButton(
          onPressed: () => Navigator.of(context).maybePop(),
          style: OutlinedButton.styleFrom(minimumSize: const Size(100, 44)),
          child: Text(adminL10n.close),
        ),
        primaryAction: FilledButton(
          onPressed: () => Navigator.of(context).maybePop(),
          style: FilledButton.styleFrom(minimumSize: const Size(100, 44)),
          child: Text(adminL10n.done),
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
    final adminL10n = AdminL10n.of(context);
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
    final isDelivery = detail.fulfillmentMethod.toUpperCase() == 'DELIVERY';
    final acceptedLabel = formatAdminDateTime(detail.acceptedAt) ?? '—';
    final incidentStatus = detail.linkedReport?.status;
    final statusTone = learnerReservationStatusTone(
      detail.status,
      incidentReviewStatus: incidentStatus,
    );

    final metaStrip = _MetaStrip(
      items: [
        _MetaItem(
          icon: Icons.hourglass_bottom_rounded,
          tone: _fromStatusTone(statusTone),
          label: adminL10n.status,
          valueWidget: AppStatusBadge(
            label: _statusLabel(detail.status),
            tone: statusTone,
          ),
        ),
        _MetaItem(
          icon: Icons.inventory_2_outlined,
          tone: _AccentTone.teal,
          label: 'Quantity',
          value: _formatQuantity(detail.quantityRequested, detail.unit),
        ),
        _MetaItem(
          icon: Icons.calendar_today_outlined,
          tone: _AccentTone.neutral,
          label: 'Created',
          value: formatAdminDateTime(detail.createdAt) ?? detail.createdAt,
        ),
        _MetaItem(
          icon: isDelivery
              ? Icons.local_shipping_outlined
              : Icons.storefront_outlined,
          tone: _AccentTone.purple,
          label: 'Fulfillment',
          value: isDelivery ? 'Delivery' : 'Pickup',
        ),
        _MetaItem(
          icon: Icons.link_rounded,
          tone: _linkedContextTone(detail),
          label: 'Linked delivery',
          value: _linkedContextLabel(detail),
        ),
      ],
    );

    final summaryCard = _ReservationSectionCard(
      icon: Icons.assignment_outlined,
      tone: _AccentTone.info,
      title: 'Reservation summary',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _NoteField(
            label: 'Learner message',
            value: (detail.message?.trim().isNotEmpty ?? false)
                ? detail.message!.trim()
                : '—',
          ),
          const SizedBox(height: AppSpacing.md),
          _TwoColRow(
            leftLabel: 'Last updated',
            leftValue:
                formatAdminDateTime(detail.updatedAt) ?? detail.updatedAt,
            rightLabel: 'Accepted',
            rightValue: acceptedLabel,
          ),
        ],
      ),
    );

    final learnerCard = _ReservationSectionCard(
      icon: Icons.person_outline,
      tone: _AccentTone.success,
      title: 'Learner',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AdminDetailRow(label: 'Name', value: learnerLabel),
          AdminDetailRow(
            label: 'Email',
            value: detail.learner.email.isEmpty ? '—' : detail.learner.email,
          ),
        ],
      ),
    );

    final supplierCard = _ReservationSectionCard(
      icon: Icons.storefront_outlined,
      tone: _AccentTone.purple,
      title: 'Supplier',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AdminDetailRow(label: 'Name', value: supplierLabel),
          _NoteField(
            label: 'Supplier note',
            value: (detail.supplierNote?.trim().isNotEmpty ?? false)
                ? detail.supplierNote!.trim()
                : '—',
          ),
        ],
      ),
    );

    final pickupCard = _ReservationSectionCard(
      icon: Icons.local_shipping_outlined,
      tone: _AccentTone.info,
      title: 'Pickup / delivery',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _NoteField(
            label: isDelivery ? 'Delivery window' : 'Pickup window',
            value: pickupWindow ?? 'No window scheduled',
            maxLines: 2,
          ),
          const SizedBox(height: AppSpacing.md),
          _TwoColRow(
            leftLabel: 'Fulfillment',
            leftValue: isDelivery ? 'Delivery' : 'Pickup',
            rightLabel: 'Accepted',
            rightValue: acceptedLabel,
          ),
        ],
      ),
    );

    Widget? reportCard;
    final report = detail.linkedReport;
    if (report != null) {
      reportCard = _ReservationSectionCard(
        icon: Icons.warning_amber_rounded,
        tone: _AccentTone.warning,
        title: 'Linked report',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _TwoColRow(
              leftLabel: 'Reason',
              leftValue: humanizeEnum(report.reasonCode),
              rightLabel: adminL10n.status,
              rightValue: adminIncidentReportStatusLabel(report.status),
            ),
            const SizedBox(height: AppSpacing.md),
            OutlinedButton.icon(
              onPressed: () {
                final reportId = report.id;
                Navigator.pop(context);
                if (reportId.isNotEmpty) {
                  context.push(
                    '/admin/no-show-reports/${Uri.encodeComponent(reportId)}',
                  );
                } else {
                  context.push('/admin/no-show-reports');
                }
              },
              style: AppStatusButtonStyle.outlined(context, AppStatusTone.info),
              icon: const Icon(Icons.open_in_new_rounded, size: 16),
              label: Text(adminL10n.openReport),
            ),
          ],
        ),
      );
    }

    Widget? deliveryCard;
    final delivery = detail.delivery;
    if (delivery != null) {
      deliveryCard = _ReservationSectionCard(
        icon: Icons.link_rounded,
        tone: _AccentTone.teal,
        title: 'Linked delivery',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _TwoColRow(
              leftLabel: 'Driver',
              leftValue: delivery.driver != null
                  ? displayPersonLabel(
                      delivery.driver!.displayName,
                      delivery.driver!.email,
                    )
                  : '—',
              rightLabel: 'Status',
              rightValue: deliveryStatusLabel(delivery.status),
            ),
            const SizedBox(height: AppSpacing.md),
            OutlinedButton.icon(
              onPressed: () {
                final deliveryId = delivery.id;
                Navigator.pop(context);
                if (deliveryId.isNotEmpty) {
                  context.push(
                    '/admin/deliveries/${Uri.encodeComponent(deliveryId)}',
                  );
                } else {
                  context.push('/admin/deliveries');
                }
              },
              style: AppStatusButtonStyle.outlined(
                context,
                AppStatusTone.neutral,
              ),
              icon: const Icon(Icons.open_in_new_rounded, size: 16),
              label: Text(adminL10n.openDelivery),
            ),
          ],
        ),
      );
    }

    Widget? thirdRow;
    if (reportCard != null && deliveryCard != null) {
      thirdRow = _DetailCardRow(left: reportCard, right: deliveryCard);
    } else if (reportCard != null) {
      thirdRow = reportCard;
    } else if (deliveryCard != null) {
      thirdRow = deliveryCard;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        metaStrip,
        const SizedBox(height: AppSpacing.md),
        _DetailCardRow(left: summaryCard, right: learnerCard),
        const SizedBox(height: AppSpacing.md),
        _DetailCardRow(left: supplierCard, right: pickupCard),
        if (thirdRow != null) ...[
          const SizedBox(height: AppSpacing.md),
          thirdRow,
        ],
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

/// Lays out two reservation-detail section cards side by side on wide
/// dialogs and stacks them on narrow ones. When [right] is omitted, [left]
/// fills the full row width (used for single-card conditional rows).
class _DetailCardRow extends StatelessWidget {
  const _DetailCardRow({required this.left, this.right});

  final Widget left;
  final Widget? right;

  @override
  Widget build(BuildContext context) {
    if (right == null) {
      return left;
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 640) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              left,
              const SizedBox(height: AppSpacing.md),
              right!,
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: left),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: right!),
          ],
        );
      },
    );
  }
}

/// Compact section-card shell with a small semantic icon tile, used for every
/// card in the reservation-details grid so icons stay distinct per section.
class _ReservationSectionCard extends StatelessWidget {
  const _ReservationSectionCard({
    required this.icon,
    required this.tone,
    required this.title,
    required this.child,
  });

  final IconData icon;
  final _AccentTone tone;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return AppSectionCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      borderRadius: AppRadius.lgAll,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _SectionIconTile(icon: icon, tone: tone),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}

class _SectionIconTile extends StatelessWidget {
  const _SectionIconTile({required this.icon, required this.tone});

  final IconData icon;
  final _AccentTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final (background, foreground) = _accentColors(colors, tone);
    return Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadius.mdAll,
      ),
      child: Icon(icon, size: 18, color: foreground),
    );
  }
}

/// One horizontal metadata strip (status / quantity / created / fulfillment /
/// linked delivery). Renders as a five-way row on wide dialogs and wraps
/// into a balanced grid on medium/narrow widths.
class _MetaStrip extends StatelessWidget {
  const _MetaStrip({required this.items});

  final List<Widget> items;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth >= 760) {
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < items.length; i++) ...[
                  if (i > 0)
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm,
                      ),
                      child: SizedBox(
                        height: 34,
                        child: VerticalDivider(
                          color: colors.borderSubtle,
                          width: 1,
                        ),
                      ),
                    ),
                  Expanded(child: items[i]),
                ],
              ],
            );
          }

          return Wrap(
            spacing: AppSpacing.lg,
            runSpacing: AppSpacing.md,
            children: items,
          );
        },
      ),
    );
  }
}

class _MetaItem extends StatelessWidget {
  const _MetaItem({
    required this.icon,
    required this.tone,
    required this.label,
    this.value,
    this.valueWidget,
  });

  final IconData icon;
  final _AccentTone tone;
  final String label;
  final String? value;
  final Widget? valueWidget;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final (background, foreground) = _accentColors(colors, tone);
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 30,
          height: 30,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: background,
            borderRadius: AppRadius.mdAll,
          ),
          child: Icon(icon, size: 16, color: foreground),
        ),
        const SizedBox(width: AppSpacing.sm),
        Flexible(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 176),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(
                    context,
                  ).textTheme.labelSmall?.copyWith(color: colors.textMuted),
                ),
                const SizedBox(height: 2),
                if (valueWidget case final widget?)
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: AlignmentDirectional.centerStart,
                    child: widget,
                  )
                else
                  Text(
                    value?.isNotEmpty == true ? value! : '—',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// A short label/value block used for messages and notes that must stay
/// compact instead of growing the card to fit the full text.
class _NoteField extends StatelessWidget {
  const _NoteField({
    required this.label,
    required this.value,
    this.maxLines = 3,
  });

  final String label;
  final String value;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(
            context,
          ).textTheme.labelMedium?.copyWith(color: colors.textMuted),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          value,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: colors.textPrimary),
          maxLines: maxLines,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}

/// Two label/value fields side by side, used for each card's bottom
/// metadata row (e.g. Last updated / Accepted, Fulfillment / Accepted).
class _TwoColRow extends StatelessWidget {
  const _TwoColRow({
    required this.leftLabel,
    required this.leftValue,
    required this.rightLabel,
    required this.rightValue,
  });

  final String leftLabel;
  final String leftValue;
  final String rightLabel;
  final String rightValue;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: _MiniField(
            label: leftLabel,
            value: leftValue,
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: _MiniField(label: rightLabel, value: rightValue),
        ),
      ],
    );
  }
}

class _MiniField extends StatelessWidget {
  const _MiniField({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(
            context,
          ).textTheme.labelSmall?.copyWith(color: colors.textMuted),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}
