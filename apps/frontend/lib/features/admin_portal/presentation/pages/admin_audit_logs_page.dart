import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../shared/widgets/app_dialog_detail.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/admin_audit_logs_api.dart';
import '../../data/models/admin_audit_logs_models.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import '../theme/admin_palette.dart';
import '../widgets/admin_audit_stat_card.dart';
import '../widgets/admin_empty_state.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;

const _kTimeRangeAll = 'ALL';
const _kTimeRangeToday = 'TODAY';
const _kTimeRangeLast7 = 'LAST_7';
const _kTimeRangeLast30 = 'LAST_30';
const _kTimeRangeCustom = 'CUSTOM';

class _AuditLogFilters {
  const _AuditLogFilters({
    required this.page,
    required this.search,
    required this.action,
    required this.targetType,
    required this.actorId,
    required this.timeRange,
    this.customDateFrom,
    this.customDateTo,
  });

  final int page;
  final String search;
  final String action;
  final String targetType;
  final String actorId;
  final String timeRange;
  final String? customDateFrom;
  final String? customDateTo;

  static const limit = 20;

  _AuditLogFilters copyWith({
    int? page,
    String? search,
    String? action,
    String? targetType,
    String? actorId,
    String? timeRange,
    String? customDateFrom,
    String? customDateTo,
    bool clearCustomDates = false,
  }) {
    return _AuditLogFilters(
      page: page ?? this.page,
      search: search ?? this.search,
      action: action ?? this.action,
      targetType: targetType ?? this.targetType,
      actorId: actorId ?? this.actorId,
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
      action != 'ALL' ||
      targetType != 'ALL' ||
      actorId != 'ALL' ||
      timeRange != _kTimeRangeAll ||
      (customDateFrom != null && customDateFrom!.isNotEmpty) ||
      (customDateTo != null && customDateTo!.isNotEmpty);
}

class _ResolvedDateRange {
  const _ResolvedDateRange({this.dateFrom, this.dateTo, this.error});

  final String? dateFrom;
  final String? dateTo;
  final String? error;
}

String _formatIsoDate(DateTime date) {
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year}-$month-$day';
}

_ResolvedDateRange _resolveDateRange(_AuditLogFilters filters) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);

  switch (filters.timeRange) {
    case _kTimeRangeToday:
      final iso = _formatIsoDate(today);
      return _ResolvedDateRange(dateFrom: iso, dateTo: iso);
    case _kTimeRangeLast7:
      return _ResolvedDateRange(
        dateFrom: _formatIsoDate(today.subtract(const Duration(days: 6))),
        dateTo: _formatIsoDate(today),
      );
    case _kTimeRangeLast30:
      return _ResolvedDateRange(
        dateFrom: _formatIsoDate(today.subtract(const Duration(days: 29))),
        dateTo: _formatIsoDate(today),
      );
    case _kTimeRangeCustom:
      final from = filters.customDateFrom?.trim();
      final to = filters.customDateTo?.trim();
      if (from == null || from.isEmpty || to == null || to.isEmpty) {
        return const _ResolvedDateRange(
          error: 'Select both From and To dates.',
        );
      }
      if (from.compareTo(to) > 0) {
        return const _ResolvedDateRange(
          error: 'From date must be on or before To date.',
        );
      }
      return _ResolvedDateRange(dateFrom: from, dateTo: to);
    case _kTimeRangeAll:
    default:
      return const _ResolvedDateRange();
  }
}

class _AuditLogFiltersNotifier extends Notifier<_AuditLogFilters> {
  @override
  _AuditLogFilters build() => const _AuditLogFilters(
    page: 1,
    search: '',
    action: 'ALL',
    targetType: 'ALL',
    actorId: 'ALL',
    timeRange: _kTimeRangeAll,
  );

  void setPage(int page) => state = state.copyWith(page: page);
  void setSearch(String search) =>
      state = state.copyWith(page: 1, search: search);
  void setAction(String action) =>
      state = state.copyWith(page: 1, action: action);
  void setTargetType(String targetType) =>
      state = state.copyWith(page: 1, targetType: targetType);
  void setActorId(String actorId) =>
      state = state.copyWith(page: 1, actorId: actorId);
  void setTimeRange(String timeRange) => state = state.copyWith(
    page: 1,
    timeRange: timeRange,
    clearCustomDates: timeRange != _kTimeRangeCustom,
  );
  void setCustomDateFrom(String? value) =>
      state = state.copyWith(page: 1, customDateFrom: value);
  void setCustomDateTo(String? value) =>
      state = state.copyWith(page: 1, customDateTo: value);
  void reset() => state = build();
}

final _auditLogFiltersProvider =
    NotifierProvider<_AuditLogFiltersNotifier, _AuditLogFilters>(
      _AuditLogFiltersNotifier.new,
    );

final adminAuditLogsListProvider = FutureProvider.autoDispose((ref) async {
  final filters = ref.watch(_auditLogFiltersProvider);
  final resolved = _resolveDateRange(filters);
  final skipDates =
      filters.timeRange == _kTimeRangeCustom && resolved.error != null;

  return ref
      .read(adminAuditLogsApiProvider)
      .fetchAuditLogs(
        page: filters.page,
        limit: _AuditLogFilters.limit,
        search: filters.search,
        action: filters.action,
        targetType: filters.targetType,
        actorId: filters.actorId,
        dateFrom: skipDates ? null : resolved.dateFrom,
        dateTo: skipDates ? null : resolved.dateTo,
      );
});

String? _formatDateTime(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) return raw;
  return DateFormat.yMMMd().add_jm().format(parsed.toLocal());
}

String _formatMetadataValue(dynamic value) {
  if (value == null) return '—';
  if (value is String) return value.isEmpty ? '—' : value;
  if (value is num || value is bool) return value.toString();
  if (value is Map || value is List) return value.toString();
  return value.toString();
}

String _humanizeKey(String key) {
  return key
      .replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}')
      .replaceAll('_', ' ')
      .toLowerCase()
      .split(' ')
      .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');
}

List<MapEntry<String, String>> _metadataRows(Map<String, dynamic>? metadata) {
  if (metadata == null || metadata.isEmpty) return const [];
  return metadata.entries
      .map((e) => MapEntry(_humanizeKey(e.key), _formatMetadataValue(e.value)))
      .toList();
}

String? _safeDropdownValue(String selected, Iterable<String> allowed) {
  if (selected == 'ALL') return 'ALL';
  return allowed.contains(selected) ? selected : 'ALL';
}

class AdminAuditLogsPage extends ConsumerStatefulWidget {
  const AdminAuditLogsPage({super.key});

  @override
  ConsumerState<AdminAuditLogsPage> createState() => _AdminAuditLogsPageState();
}

class _AdminAuditLogsPageState extends ConsumerState<AdminAuditLogsPage> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _refresh() => ref.invalidate(adminAuditLogsListProvider);

  void _applySearch() {
    ref
        .read(_auditLogFiltersProvider.notifier)
        .setSearch(_searchController.text.trim());
  }

  Future<void> _showDetails(
    AdminAuditLogItem item,
    List<AdminAuditLogFilterOption> targetTypes,
  ) async {
    await showDialog<void>(
      context: context,
      builder: (context) => _AuditLogDetailDialog(
        item: item,
        targetTypeLabel: _targetTypeLabel(item.targetType, targetTypes),
      ),
    );
  }

  String _targetTypeLabel(
    String value,
    List<AdminAuditLogFilterOption> options,
  ) {
    for (final option in options) {
      if (option.value == value) return option.label;
    }
    return value.replaceAll('_', ' ').toLowerCase();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final filters = ref.watch(_auditLogFiltersProvider);
    final logsAsync = ref.watch(adminAuditLogsListProvider);
    final compact = MediaQuery.sizeOf(context).width < 1000;
    final dateRangeError = _resolveDateRange(filters).error;

    return ColoredBox(
      color: palette.pageBackground,
      child: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.fromSTEB(20, 16, 20, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Audit Logs', style: AdminTypography.pageTitle(palette)),
            const SizedBox(height: 4),
            Text(
              'Track important admin actions across the platform.',
              style: AdminTypography.pageSubtitle(palette),
            ),
            const SizedBox(height: 20),
            logsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (error, _) => _ErrorPanel(
                title: 'Could not load audit logs.',
                message: AdminL10n.of(context).localizedError(error),
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
                    filterOptions: data.filterOptions,
                    dateRangeError: dateRangeError,
                    onSearch: _applySearch,
                    onActionChanged: (value) => ref
                        .read(_auditLogFiltersProvider.notifier)
                        .setAction(value),
                    onTimeRangeChanged: (value) => ref
                        .read(_auditLogFiltersProvider.notifier)
                        .setTimeRange(value),
                    onCustomDateFromChanged: (value) => ref
                        .read(_auditLogFiltersProvider.notifier)
                        .setCustomDateFrom(value),
                    onCustomDateToChanged: (value) => ref
                        .read(_auditLogFiltersProvider.notifier)
                        .setCustomDateTo(value),
                    onTargetTypeChanged: (value) => ref
                        .read(_auditLogFiltersProvider.notifier)
                        .setTargetType(value),
                    onActorChanged: (value) => ref
                        .read(_auditLogFiltersProvider.notifier)
                        .setActorId(value),
                    onReset: () {
                      _searchController.clear();
                      ref.read(_auditLogFiltersProvider.notifier).reset();
                    },
                    onRefresh: _refresh,
                  ),
                  const SizedBox(height: 16),
                  if (data.items.isEmpty)
                    AdminEmptyState(
                      icon: Icons.receipt_long_outlined,
                      title: filters.hasActiveFilters
                          ? 'No logs match these filters.'
                          : 'No audit logs recorded yet.',
                      subtitle: filters.hasActiveFilters
                          ? 'Try adjusting filters or reset to see all recorded admin actions.'
                          : 'Admin actions such as suspensions, invitations, and moderation decisions will appear here.',
                    )
                  else ...[
                    _AuditLogTable(
                      items: data.items,
                      compact: compact,
                      targetTypes: data.filterOptions.targetTypes,
                      onDetails: (item) =>
                          _showDetails(item, data.filterOptions.targetTypes),
                    ),
                    const SizedBox(height: 12),
                    _PaginationRow(
                      page: data.pagination.page,
                      totalPages: data.pagination.totalPages,
                      total: data.pagination.total,
                      onPrevious: data.pagination.page > 1
                          ? () => ref
                                .read(_auditLogFiltersProvider.notifier)
                                .setPage(data.pagination.page - 1)
                          : null,
                      onNext: data.pagination.page < data.pagination.totalPages
                          ? () => ref
                                .read(_auditLogFiltersProvider.notifier)
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

  final AdminAuditLogSummary summary;
  final AdminPalette palette;

  @override
  Widget build(BuildContext context) {
    final mostRecent = _formatDateTime(summary.mostRecentAt) ?? '—';
    final stats = [
      (
        'Total logs',
        summary.total.toString(),
        'All recorded admin actions',
        Icons.receipt_long_outlined,
        palette.blue,
      ),
      (
        'Today',
        summary.today.toString(),
        'Logged since midnight',
        Icons.today_outlined,
        palette.green,
      ),
      (
        'This week',
        summary.thisWeek.toString(),
        'Last 7 days',
        Icons.date_range_outlined,
        palette.purple,
      ),
      (
        'Most recent',
        mostRecent,
        'Latest event timestamp',
        Icons.schedule_outlined,
        palette.amber,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 900
            ? 4
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

class _CompactFilterDropdown extends StatelessWidget {
  const _CompactFilterDropdown({
    required this.label,
    required this.value,
    required this.entries,
    required this.onSelected,
    this.enabled = true,
    this.width = 180,
  });

  final String label;
  final String value;
  final List<DropdownMenuEntry<String>> entries;
  final ValueChanged<String> onSelected;
  final bool enabled;
  final double width;

  @override
  Widget build(BuildContext context) {
    final safeValue = entries.any((entry) => entry.value == value)
        ? value
        : entries.first.value;

    return SizedBox(
      width: width,
      child: DropdownMenu<String>(
        key: ValueKey('$label-$safeValue'),
        enabled: enabled,
        label: Text(label),
        initialSelection: safeValue,
        width: width,
        menuHeight: 280,
        dropdownMenuEntries: entries,
        inputDecorationTheme: const InputDecorationTheme(
          isDense: true,
          border: OutlineInputBorder(),
        ),
        onSelected: (selected) {
          if (selected != null) onSelected(selected);
        },
      ),
    );
  }
}

class _CompactDateField extends StatelessWidget {
  const _CompactDateField({
    required this.label,
    required this.value,
    required this.onChanged,
    this.width = 150,
  });

  final String label;
  final String? value;
  final ValueChanged<String?> onChanged;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final display = value == null || value!.isEmpty
        ? 'Select date'
        : DateFormat.yMMMd().format(DateTime.parse(value!));

    final field = InkWell(
      onTap: () async {
        final initial = value != null && value!.isNotEmpty
            ? DateTime.tryParse(value!)
            : null;
        final picked = await showDatePicker(
          context: context,
          initialDate: initial ?? DateTime.now(),
          firstDate: DateTime(2020),
          lastDate: DateTime.now().add(const Duration(days: 1)),
        );
        if (picked != null) {
          onChanged(_formatIsoDate(picked));
        }
      },
      borderRadius: BorderRadius.circular(4),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          isDense: true,
          suffixIcon: value != null && value!.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, size: 18),
                  onPressed: () => onChanged(null),
                  tooltip: 'Clear',
                )
              : const Icon(Icons.calendar_today_outlined, size: 18),
        ),
        child: Text(
          display,
          style: Theme.of(context).textTheme.bodySmall,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );

    if (width == null) return field;
    return SizedBox(width: width, child: field);
  }
}

class _FiltersPanel extends StatefulWidget {
  const _FiltersPanel({
    required this.compact,
    required this.searchController,
    required this.filters,
    required this.filterOptions,
    required this.onSearch,
    required this.onActionChanged,
    required this.onTimeRangeChanged,
    required this.onCustomDateFromChanged,
    required this.onCustomDateToChanged,
    required this.onTargetTypeChanged,
    required this.onActorChanged,
    required this.onReset,
    required this.onRefresh,
    this.dateRangeError,
  });

  final bool compact;
  final TextEditingController searchController;
  final _AuditLogFilters filters;
  final AdminAuditLogFilterOptions filterOptions;
  final String? dateRangeError;
  final VoidCallback onSearch;
  final ValueChanged<String> onActionChanged;
  final ValueChanged<String> onTimeRangeChanged;
  final ValueChanged<String?> onCustomDateFromChanged;
  final ValueChanged<String?> onCustomDateToChanged;
  final ValueChanged<String> onTargetTypeChanged;
  final ValueChanged<String> onActorChanged;
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
    final dropdownWidth = widget.compact ? double.infinity : 180.0;
    final actionValue = _safeDropdownValue(
      widget.filters.action,
      widget.filterOptions.actions.map((option) => option.value),
    );
    final targetValue = _safeDropdownValue(
      widget.filters.targetType,
      widget.filterOptions.targetTypes.map((option) => option.value),
    );
    final actorValue = _safeDropdownValue(
      widget.filters.actorId,
      widget.filterOptions.actors.map((actor) => actor.id),
    );

    final actionEntries = [
      const DropdownMenuEntry(value: 'ALL', label: 'All actions'),
      ...widget.filterOptions.actions.map(
        (option) => DropdownMenuEntry(value: option.value, label: option.label),
      ),
    ];
    final timeEntries = const [
      DropdownMenuEntry(value: _kTimeRangeAll, label: 'All time'),
      DropdownMenuEntry(value: _kTimeRangeToday, label: 'Today'),
      DropdownMenuEntry(value: _kTimeRangeLast7, label: 'Last 7 days'),
      DropdownMenuEntry(value: _kTimeRangeLast30, label: 'Last 30 days'),
      DropdownMenuEntry(value: _kTimeRangeCustom, label: 'Custom range'),
    ];
    final targetEntries = [
      const DropdownMenuEntry(value: 'ALL', label: 'All targets'),
      ...widget.filterOptions.targetTypes.map(
        (option) => DropdownMenuEntry(value: option.value, label: option.label),
      ),
    ];
    final actorEntries = [
      const DropdownMenuEntry(value: 'ALL', label: 'All actors'),
      ...widget.filterOptions.actors.map(
        (actor) => DropdownMenuEntry(value: actor.id, label: actor.label),
      ),
    ];

    final searchField = TextField(
      controller: widget.searchController,
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.search, size: 20),
        hintText: 'Search action, actor, or target…',
        border: const OutlineInputBorder(),
        isDense: true,
        suffixIcon: IconButton(
          icon: const Icon(Icons.search, size: 20),
          tooltip: AdminL10n.of(context).search,
          onPressed: widget.onSearch,
        ),
      ),
      onSubmitted: (_) => widget.onSearch(),
    );

    final actionFilter = _CompactFilterDropdown(
      label: 'Action',
      value: actionValue ?? 'ALL',
      width: dropdownWidth,
      enabled: widget.filterOptions.actions.isNotEmpty,
      entries: actionEntries,
      onSelected: widget.onActionChanged,
    );

    final timeFilter = _CompactFilterDropdown(
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
            actionFilter,
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
                actionFilter,
                const SizedBox(width: 10),
                timeFilter,
                const SizedBox(width: 6),
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: refreshButton,
                ),
              ],
            ),
          if (widget.filters.timeRange == _kTimeRangeCustom) ...[
            const SizedBox(height: 10),
            if (widget.compact)
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _CompactDateField(
                    label: 'From',
                    value: widget.filters.customDateFrom,
                    onChanged: widget.onCustomDateFromChanged,
                  ),
                  const SizedBox(height: 8),
                  _CompactDateField(
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
                  _CompactDateField(
                    label: 'From',
                    value: widget.filters.customDateFrom,
                    width: 150,
                    onChanged: widget.onCustomDateFromChanged,
                  ),
                  _CompactDateField(
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
            if (widget.compact) ...[
              _CompactFilterDropdown(
                label: 'Target type',
                value: targetValue ?? 'ALL',
                width: dropdownWidth,
                enabled: widget.filterOptions.targetTypes.isNotEmpty,
                entries: targetEntries,
                onSelected: widget.onTargetTypeChanged,
              ),
              const SizedBox(height: 10),
              _CompactFilterDropdown(
                label: 'Actor',
                value: actorValue ?? 'ALL',
                width: dropdownWidth,
                enabled: widget.filterOptions.actors.isNotEmpty,
                entries: actorEntries,
                onSelected: widget.onActorChanged,
              ),
            ] else
              Wrap(
                spacing: 10,
                runSpacing: 10,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  _CompactFilterDropdown(
                    label: 'Target type',
                    value: targetValue ?? 'ALL',
                    width: 180,
                    enabled: widget.filterOptions.targetTypes.isNotEmpty,
                    entries: targetEntries,
                    onSelected: widget.onTargetTypeChanged,
                  ),
                  _CompactFilterDropdown(
                    label: 'Actor',
                    value: actorValue ?? 'ALL',
                    width: 200,
                    enabled: widget.filterOptions.actors.isNotEmpty,
                    entries: actorEntries,
                    onSelected: widget.onActorChanged,
                  ),
                  OutlinedButton.icon(
                    onPressed: widget.onReset,
                    style: AppStatusButtonStyle.outlined(
                      context,
                      AppStatusTone.neutral,
                    ),
                    icon: const Icon(Icons.filter_alt_off, size: 18),
                    label: Text(AdminL10n.of(context).reset),
                  ),
                ],
              ),
            if (widget.compact) ...[
              const SizedBox(height: 10),
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
        ],
      ),
    );
  }
}

class _AuditLogTable extends StatelessWidget {
  const _AuditLogTable({
    required this.items,
    required this.compact,
    required this.targetTypes,
    required this.onDetails,
  });

  final List<AdminAuditLogItem> items;
  final bool compact;
  final List<AdminAuditLogFilterOption> targetTypes;
  final ValueChanged<AdminAuditLogItem> onDetails;

  String _targetLabel(String value) {
    for (final option in targetTypes) {
      if (option.value == value) return option.label;
    }
    return value.replaceAll('_', ' ').toLowerCase();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    if (compact) {
      return Column(
        children: items
            .map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _AuditLogRow(
                  item: item,
                  targetTypeLabel: _targetLabel(item.targetType),
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
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(14),
              ),
              border: Border(bottom: BorderSide(color: palette.cardBorder)),
            ),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: Text(
                    'Action',
                    style: AdminTypography.kpiLabel(palette),
                  ),
                ),
                Expanded(
                  flex: 3,
                  child: Text(
                    'Actor',
                    style: AdminTypography.kpiLabel(palette),
                  ),
                ),
                Expanded(
                  flex: 3,
                  child: Text(
                    'Target',
                    style: AdminTypography.kpiLabel(palette),
                  ),
                ),
                const SizedBox(width: 88, child: Text('')),
              ],
            ),
          ),
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) Divider(height: 1, color: palette.cardBorder),
            _AuditLogRow(
              item: items[i],
              targetTypeLabel: _targetLabel(items[i].targetType),
              onDetails: () => onDetails(items[i]),
              dense: true,
            ),
          ],
        ],
      ),
    );
  }
}

class _AuditLogRow extends StatelessWidget {
  const _AuditLogRow({
    required this.item,
    required this.targetTypeLabel,
    required this.onDetails,
    this.dense = false,
  });

  final AdminAuditLogItem item;
  final String targetTypeLabel;
  final VoidCallback onDetails;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    final content = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 3,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.actionLabel,
                style: AdminTypography.sectionTitle(
                  palette,
                ).copyWith(fontSize: 14),
              ),
              const SizedBox(height: 4),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  Chip(
                    label: Text(targetTypeLabel),
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                  ),
                  if (_formatDateTime(item.createdAt) != null)
                    Text(
                      _formatDateTime(item.createdAt)!,
                      style: AdminTypography.kpiHelper(
                        palette,
                      ).copyWith(color: palette.textMuted),
                    ),
                ],
              ),
            ],
          ),
        ),
        Expanded(
          flex: 3,
          child: Text(
            item.actorName.trim().isEmpty || item.actorName == 'Unknown admin'
                ? (item.actorEmail.isEmpty ? 'Unknown admin' : item.actorEmail)
                : '${item.actorName}\n${item.actorEmail}',
            style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 13),
          ),
        ),
        Expanded(
          flex: 3,
          child: Text(
            item.targetLabel,
            style: AdminTypography.pageSubtitle(palette).copyWith(fontSize: 13),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        SizedBox(
          width: 88,
          child: Align(
            alignment: AlignmentDirectional.centerEnd,
            child: TextButton(
              onPressed: onDetails,
              style: AppStatusButtonStyle.text(context, AppStatusTone.neutral),
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

class _AuditLogDetailDialog extends StatelessWidget {
  const _AuditLogDetailDialog({
    required this.item,
    required this.targetTypeLabel,
  });

  final AdminAuditLogItem item;
  final String targetTypeLabel;

  @override
  Widget build(BuildContext context) {
    final metadataRows = _metadataRows(item.metadata);
    final actorLabel = item.actorName.trim().isEmpty
        ? item.actorEmail
        : '${item.actorName} (${item.actorEmail})';

    return AppDialogShell(
      title: AppDialogTitleBlock(
        title: item.actionLabel,
        icon: Icons.history_outlined,
      ),
      maxWidth: 560,
      content: SizedBox(
        width: 520,
        child: AppDialogSection(
          title: 'Audit entry',
          icon: Icons.receipt_long_outlined,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _DetailRow(label: 'Action', value: item.actionLabel),
              _DetailRow(
                label: 'Technical action',
                value: item.action,
                muted: true,
              ),
              _DetailRow(label: 'Actor', value: actorLabel),
              _DetailRow(label: 'Target type', value: targetTypeLabel),
              _DetailRow(label: 'Target', value: item.targetLabel),
              if (item.targetId != null && item.targetId!.isNotEmpty)
                _DetailRow(
                  label: 'Target ID',
                  value: item.targetId!,
                  muted: true,
                ),
              _DetailRow(
                label: 'Created at',
                value: _formatDateTime(item.createdAt) ?? item.createdAt,
              ),
              if (metadataRows.isEmpty)
                _DetailRow(label: 'Details', value: 'No extra details')
              else
                ...metadataRows.map(
                  (row) => _DetailRow(label: row.key, value: row.value),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.muted = false,
  });

  final String label;
  final String value;
  final bool muted;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: AppDialogInfoRow(label: label, value: value, muted: muted),
  );
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
    ).copyWith(minimumSize: const WidgetStatePropertyAll(Size(0, 42)));

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        OutlinedButton(
          onPressed: onPrevious,
          style: buttonStyle,
          child: Text(AdminL10n.of(context).previous),
        ),
        OutlinedButton(
          onPressed: onNext,
          style: buttonStyle,
          child: Text(AdminL10n.of(context).next),
        ),
        Text(
          'Page $page of $totalPages · $total total',
          style: AdminTypography.kpiHelper(palette),
        ),
      ],
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.title, required this.message, this.onRetry});

  final String title;
  final String message;
  final VoidCallback? onRetry;

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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AdminTypography.sectionTitle(palette)),
          const SizedBox(height: 8),
          Text(message, style: AdminTypography.pageSubtitle(palette)),
          if (onRetry != null) ...[
            const SizedBox(height: 12),
            FilledButton(
              onPressed: onRetry,
              style: AppStatusButtonStyle.filled(
                context,
                AppStatusTone.primary,
              ),
              child: Text(AdminL10n.of(context).retry),
            ),
          ],
        ],
      ),
    );
  }
}
