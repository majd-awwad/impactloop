import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../../data/models/supplier_pickup_schedule_item.dart';
import '../controllers/supplier_pickup_schedule_providers.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/reservation_follow_up_flow.dart';
import '../widgets/supplier_delivery_incident_flow.dart';
import '../widgets/supplier_pickup_completion_flow.dart';
import '../../../../l10n/l10n.dart';

const _contentMaxWidth = 1440.0;
const _defaultPageSize = 5;

class SupplierPickupSchedulePage extends ConsumerStatefulWidget {
  const SupplierPickupSchedulePage({super.key});

  @override
  ConsumerState<SupplierPickupSchedulePage> createState() =>
      _SupplierPickupSchedulePageState();
}

class _SupplierPickupSchedulePageState
    extends ConsumerState<SupplierPickupSchedulePage> {
  late DateTime _rangeStart;
  late DateTime _rangeEnd;
  String? _category;
  String _scope = 'ACTIVE';
  String? _search;
  String? _fulfillmentMethod;
  bool? _needsAttention;
  var _page = 1;
  var _limit = _defaultPageSize;
  final _searchController = TextEditingController();
  Timer? _searchDebounce;

  SupplierScheduleQuery get _query {
    // The backend requires this absolute boundary pair for active
    // classification, and it is safe to include it for history queries too.
    final dayStart = SupplierScheduleDateBoundaries.forLocalDate(
      _rangeStart,
    ).dayStart;
    final dayEnd = SupplierScheduleDateBoundaries.forLocalDate(
      _rangeEnd,
    ).dayEnd;
    return SupplierScheduleQuery(
      page: _page,
      limit: _limit,
      scope: _scope,
      category: _category,
      needsAttention: _needsAttention,
      fulfillmentMethod: _fulfillmentMethod,
      search: _search,
      rangeStart: SupplierScheduleDateBoundaries.forLocalDate(
        _rangeStart,
      ).dayStart,
      rangeEnd: SupplierScheduleDateBoundaries.forLocalDate(_rangeEnd).dayEnd,
      dayStart: dayStart,
      dayEnd: dayEnd,
      selectedDay: _rangeStart,
    );
  }

  @override
  void initState() {
    super.initState();
    final today = _dateOnly(DateTime.now());
    _rangeStart = today.subtract(const Duration(days: 6));
    _rangeEnd = today;
    _category = 'TODAY';
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _query;
    final scheduleAsync = ref.watch(pickupSchedulePageProvider(query));
    final compact = MediaQuery.sizeOf(context).width < 1040;

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _contentMaxWidth),
        child: SingleChildScrollView(
          padding: context.supplierDecorations.pagePadding(compact: compact),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _ScheduleControlRow(
                rangeStart: _rangeStart,
                rangeEnd: _rangeEnd,
                selectedCategory: _category,
                onPickRange: _pickRange,
                onCategory: _selectCategory,
                onRefresh: () =>
                    ref.invalidate(pickupSchedulePageProvider(query)),
              ),
              const SizedBox(height: AppSpacing.md),
              scheduleAsync.when(
                loading: () => const _ScheduleLoading(),
                error: (error, _) => _ScheduleError(
                  error: error,
                  onRetry: () =>
                      ref.invalidate(pickupSchedulePageProvider(query)),
                ),
                data: (result) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _SummaryGrid(summary: result.summary),
                    const SizedBox(height: AppSpacing.md),
                    _FilterToolbar(
                      searchController: _searchController,
                      category: _category,
                      fulfillmentMethod: _fulfillmentMethod,
                      needsAttention: _needsAttention,
                      scope: _scope,
                      activeFilterCount: _activeFilterCount,
                      onSearchChanged: _onSearchChanged,
                      onCategory: _selectCategory,
                      onFulfillment: _selectFulfillment,
                      onAttention: _selectAttention,
                      onScope: _selectScope,
                      onReset: _resetFilters,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    if (result.items.isEmpty)
                      _ScheduleEmpty(
                        category: _category,
                        hasFilters: _hasActiveFilters,
                        onReset: _resetFilters,
                        onOpenRequests: () =>
                            context.go('/supplier/reservations'),
                      )
                    else
                      _ScheduleResults(
                        entries: result.items,
                        pagination: result.pagination,
                        onView: (entry) => _openRequest(entry),
                        onAction: (entry, action) =>
                            _handleAction(context, entry, action),
                        onPage: _selectPage,
                        onPageSize: _selectPageSize,
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  int get _activeFilterCount => [
    _search != null,
    _category != null && _category != 'TODAY' && _category != 'UPCOMING',
    _fulfillmentMethod != null,
    _needsAttention != null,
    _scope != 'ACTIVE',
  ].where((value) => value).length;

  bool get _hasActiveFilters =>
      _search != null ||
      _fulfillmentMethod != null ||
      _needsAttention != null ||
      (_category != null && _category != 'TODAY' && _category != 'UPCOMING');

  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 320), () {
      if (!mounted) return;
      setState(() {
        _search = value.trim().isEmpty ? null : value.trim();
        _page = 1;
      });
    });
  }

  Future<void> _pickRange() async {
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(2035),
      initialDateRange: DateTimeRange(start: _rangeStart, end: _rangeEnd),
      helpText: context.s.selectScheduleRange,
      saveText: context.s.applyLabel,
    );
    if (!mounted || range == null) return;
    setState(() {
      _rangeStart = _dateOnly(range.start);
      _rangeEnd = _dateOnly(range.end);
      _page = 1;
    });
  }

  void _selectCategory(String? category) {
    setState(() {
      _category = category;
      _scope = category == 'COMPLETED' || category == 'CLOSED'
          ? 'HISTORY'
          : category == null
          ? 'ALL'
          : 'ACTIVE';
      _page = 1;
    });
  }

  void _selectFulfillment(String? fulfillment) {
    setState(() {
      _fulfillmentMethod = fulfillment;
      _page = 1;
    });
  }

  void _selectAttention(bool? attention) {
    setState(() {
      _needsAttention = attention;
      _page = 1;
    });
  }

  void _selectScope(String scope) {
    setState(() {
      _scope = scope;
      _page = 1;
    });
  }

  void _resetFilters() {
    _searchDebounce?.cancel();
    _searchController.clear();
    setState(() {
      _category = null;
      _scope = 'ALL';
      _search = null;
      _fulfillmentMethod = null;
      _needsAttention = null;
      _page = 1;
    });
  }

  void _selectPage(int page) => setState(() => _page = page);

  void _selectPageSize(int size) => setState(() {
    _limit = size;
    _page = 1;
  });

  void _openRequest(SupplierScheduleApiEntry entry) {
    final id = entry.representativeReservationId.trim();
    if (id.isNotEmpty) {
      context.push('/supplier/reservations/${Uri.encodeComponent(id)}');
    }
  }

  Future<void> _handleAction(
    BuildContext context,
    SupplierScheduleApiEntry entry,
    SupplierAvailableAction action,
  ) async {
    final reservationId = entry.representativeReservationId;
    final item = entry.toCompatibilityItem();
    if (item == null) return;

    switch (action.value) {
      case SupplierReservationAction.completeSelfPickup:
        try {
          final completed = await runSupplierPickupCompletionFlow(
            context,
            ref,
            reservationId: reservationId,
            showSuccessSnackBar: false,
          );
          if (!completed && context.mounted) return;
        } catch (error) {
          if (context.mounted) {
            _showActionError(context, error);
          }
        }
      case SupplierReservationAction.acceptLearnerReschedule:
        await handleAcceptLearnerReschedule(
          context,
          ref,
          reservationId: reservationId,
        );
      case SupplierReservationAction.proposeReschedule:
        await handleRequestReschedulePickup(
          context,
          ref,
          reservationId: reservationId,
          materialTitle: item.materialTitle,
          learnerName: item.learnerName,
        );
      case SupplierReservationAction.submitRecoveryPickupWindow:
        await handleSubmitNoDriverPickupWindow(
          context,
          ref,
          reservationId: reservationId,
          materialTitle: item.materialTitle,
          learnerName: item.learnerName,
        );
      case SupplierReservationAction.closeReservation:
        await handleCloseOverduePickup(
          context,
          ref,
          reservationId: reservationId,
        );
      case SupplierReservationAction.markLearnerNoShow ||
          SupplierReservationAction.reportIncident:
        await handleReportToAdminAndClose(
          context,
          ref,
          reservationId: reservationId,
        );
      case SupplierReservationAction.reportNoDriver:
        await handleReportNoDriverAvailable(
          context,
          ref,
          reservationId: reservationId,
        );
      case SupplierReservationAction.markDeliveryPickupExpired:
        await handleMarkDeliveryPickupExpired(
          context,
          ref,
          reservationId: reservationId,
        );
      case SupplierReservationAction.reportDriverNoShow:
        final deliveryId = entry.delivery?.deliveryId;
        if (deliveryId != null && deliveryId.isNotEmpty) {
          await handleReportDriverNoShow(context, ref, deliveryId: deliveryId);
        }
      case SupplierReservationAction.accept ||
          SupplierReservationAction.decline ||
          SupplierReservationAction.sendMessage ||
          SupplierReservationAction.unknown:
        return;
    }
    if (mounted) ref.invalidate(pickupSchedulePageProvider(_query));
  }

  void _showActionError(BuildContext context, Object error) {
    final message = error is ApiException
        ? localizedApiErrorMessage(error, context.l10n)
        : context.s.actionCouldNotComplete;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _ScheduleControlRow extends StatelessWidget {
  const _ScheduleControlRow({
    required this.rangeStart,
    required this.rangeEnd,
    required this.selectedCategory,
    required this.onPickRange,
    required this.onCategory,
    required this.onRefresh,
  });

  final DateTime rangeStart;
  final DateTime rangeEnd;
  final String? selectedCategory;
  final VoidCallback onPickRange;
  final ValueChanged<String?> onCategory;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 720;
    final controls = Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        _OutlinedControl(
          icon: Icons.calendar_month_outlined,
          label: _rangeLabel(context, rangeStart, rangeEnd),
          onTap: onPickRange,
          minWidth: compact ? 0 : 216,
        ),
        _TopCategoryButton(
          label: context.s.filterToday,
          selected: selectedCategory == 'TODAY',
          tone: AppStatusTone.success,
          onTap: () => onCategory('TODAY'),
        ),
        _TopCategoryButton(
          label: context.s.filterUpcoming,
          selected: selectedCategory == 'UPCOMING',
          tone: AppStatusTone.info,
          onTap: () => onCategory('UPCOMING'),
        ),
        _TopCategoryButton(
          label: context.s.filterOverdue,
          selected: selectedCategory == 'OVERDUE',
          tone: AppStatusTone.warning,
          onTap: () => onCategory('OVERDUE'),
        ),
        _TopCategoryButton(
          label: context.s.filterAll,
          selected: selectedCategory == null,
          tone: AppStatusTone.neutral,
          onTap: () => onCategory(null),
        ),
      ],
    );

    if (compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          controls,
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: _OutlinedControl(
              icon: Icons.refresh_rounded,
              label: context.s.refreshLabel,
              onTap: onRefresh,
            ),
          ),
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(child: controls),
        const SizedBox(width: AppSpacing.md),
        _OutlinedControl(
          icon: Icons.refresh_rounded,
          label: context.s.refreshLabel,
          onTap: onRefresh,
        ),
      ],
    );
  }
}

class _SummaryGrid extends StatelessWidget {
  const _SummaryGrid({required this.summary});

  final SupplierScheduleApiSummary summary;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 1200
        ? 6
        : width >= 720
        ? 3
        : 2;
    final items = [
      _SummaryItem(
        'Today',
        summary.today,
        Icons.calendar_today_outlined,
        AppStatusTone.success,
      ),
      _SummaryItem(
        'Upcoming',
        summary.upcoming,
        Icons.schedule_outlined,
        AppStatusTone.info,
      ),
      _SummaryItem(
        'Overdue',
        summary.overdue,
        Icons.warning_amber_rounded,
        AppStatusTone.warning,
      ),
      _SummaryItem(
        'Needs attention',
        summary.needsAttention,
        Icons.priority_high_rounded,
        AppStatusTone.warning,
      ),
      _SummaryItem(
        'Completed',
        summary.completed,
        Icons.check_circle_outline,
        AppStatusTone.success,
      ),
      _SummaryItem(
        'Closed',
        summary.closed,
        Icons.cancel_outlined,
        AppStatusTone.neutral,
      ),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: items.length,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: columns,
        mainAxisExtent: 106,
        crossAxisSpacing: AppSpacing.md,
        mainAxisSpacing: AppSpacing.md,
      ),
      itemBuilder: (context, index) => _SummaryCard(item: items[index]),
    );
  }
}

class _SummaryItem {
  const _SummaryItem(this.label, this.count, this.icon, this.tone);

  final String label;
  final int count;
  final IconData icon;
  final AppStatusTone tone;
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.item});

  final _SummaryItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final status = AppStatusStyle.of(context, item.tone);
    return _Surface(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: status.background,
              borderRadius: AppRadius.mdAll,
            ),
            child: Icon(item.icon, color: status.foreground, size: 22),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  context.s.scheduleSummaryLabel(item.label),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.supplierLabel().copyWith(
                    color: colors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${item.count}',
                  style: context.supplierTitle().copyWith(
                    color: item.count == 0
                        ? colors.textSecondary
                        : status.foreground,
                    fontSize: 22,
                    height: 1.05,
                  ),
                ),
                Text(
                  context.s.handovers,
                  style: context.supplierBody().copyWith(
                    color: colors.textMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterToolbar extends StatelessWidget {
  const _FilterToolbar({
    required this.searchController,
    required this.category,
    required this.fulfillmentMethod,
    required this.needsAttention,
    required this.scope,
    required this.activeFilterCount,
    required this.onSearchChanged,
    required this.onCategory,
    required this.onFulfillment,
    required this.onAttention,
    required this.onScope,
    required this.onReset,
  });

  final TextEditingController searchController;
  final String? category;
  final String? fulfillmentMethod;
  final bool? needsAttention;
  final String scope;
  final int activeFilterCount;
  final ValueChanged<String> onSearchChanged;
  final ValueChanged<String?> onCategory;
  final ValueChanged<String?> onFulfillment;
  final ValueChanged<bool?> onAttention;
  final ValueChanged<String> onScope;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 1080;
    final search = SizedBox(
      height: 44,
      child: TextField(
        controller: searchController,
        onChanged: onSearchChanged,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: context.s.searchScheduleHint,
          prefixIcon: const Icon(Icons.search_rounded, size: 20),
          filled: true,
          fillColor: context.supplierColors.surface,
          contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          border: _fieldBorder(context),
          enabledBorder: _fieldBorder(context),
          focusedBorder: _fieldBorder(context, focused: true),
        ),
      ),
    );
    final fields = [
      _DropdownControl<String?>(
        value: category,
        hint: context.s.filterAllCategories,
        items: _categoryOptions(context),
        onChanged: onCategory,
      ),
      _DropdownControl<String?>(
        value: fulfillmentMethod,
        hint: context.s.allFulfillment,
        items: [
          _DropdownItem(null, context.s.allFulfillment),
          _DropdownItem('PICKUP', context.s.selfPickup),
          _DropdownItem(
            'DELIVERY',
            context.s.deliveryPickup,
          ),
        ],
        onChanged: onFulfillment,
      ),
      _DropdownControl<bool?>(
        value: needsAttention,
        hint: context.s.allAttention,
        items: [
          _DropdownItem(
            null,
            context.s.allAttention,
          ),
          _DropdownItem(true, context.s.needsAttention),
          _DropdownItem(
            false,
            context.s.noAttention,
          ),
        ],
        onChanged: onAttention,
      ),
    ];
    final more = _MoreFilters(
      scope: scope,
      activeFilterCount: activeFilterCount,
      onScope: onScope,
      onReset: onReset,
    );

    return _Surface(
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: wide
          ? Row(
              children: [
                Expanded(flex: 5, child: search),
                const SizedBox(width: AppSpacing.sm),
                for (final field in fields) ...[
                  Expanded(flex: 2, child: field),
                  const SizedBox(width: AppSpacing.sm),
                ],
                more,
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                search,
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    for (final field in fields)
                      SizedBox(width: 190, child: field),
                    more,
                  ],
                ),
              ],
            ),
    );
  }
}

class _ScheduleResults extends StatelessWidget {
  const _ScheduleResults({
    required this.entries,
    required this.pagination,
    required this.onView,
    required this.onAction,
    required this.onPage,
    required this.onPageSize,
  });

  final List<SupplierScheduleApiEntry> entries;
  final SupplierScheduleApiPagination pagination;
  final ValueChanged<SupplierScheduleApiEntry> onView;
  final void Function(SupplierScheduleApiEntry, SupplierAvailableAction)
  onAction;
  final ValueChanged<int> onPage;
  final ValueChanged<int> onPageSize;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 1040;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (wide)
          _ScheduleTable(entries: entries, onView: onView, onAction: onAction)
        else
          _ScheduleCardList(
            entries: entries,
            onView: onView,
            onAction: onAction,
          ),
        const SizedBox(height: AppSpacing.sm),
        _Pagination(
          pagination: pagination,
          onPage: onPage,
          onPageSize: onPageSize,
        ),
      ],
    );
  }
}

class _ScheduleTable extends StatelessWidget {
  const _ScheduleTable({
    required this.entries,
    required this.onView,
    required this.onAction,
  });

  final List<SupplierScheduleApiEntry> entries;
  final ValueChanged<SupplierScheduleApiEntry> onView;
  final void Function(SupplierScheduleApiEntry, SupplierAvailableAction)
  onAction;

  @override
  Widget build(BuildContext context) {
    return _Surface(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          _GridRow(
            isHeader: true,
            children: [
              _HeaderCell(context.s.scheduleColumnSchedule),
              _HeaderCell(context.s.scheduleColumnMaterialLearner),
              _HeaderCell(context.s.scheduleColumnFulfillment),
              _HeaderCell(context.s.scheduleColumnWindow),
              _HeaderCell(context.s.statusLabel),
              _HeaderCell(context.s.scheduleColumnNextActor),
              _HeaderCell(context.s.scheduleColumnActions),
            ],
          ),
          for (final entry in entries)
            _GridRow(
              children: [
                _ScheduleCell(entry: entry),
                _MaterialCell(entry: entry),
                _FulfillmentCell(entry: entry),
                _WindowCell(entry: entry),
                _StatusCell(entry: entry),
                _ActorCell(entry: entry),
                _ActionCell(
                  entry: entry,
                  onView: () => onView(entry),
                  onAction: (action) => onAction(entry, action),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class _ScheduleCardList extends StatelessWidget {
  const _ScheduleCardList({
    required this.entries,
    required this.onView,
    required this.onAction,
  });

  final List<SupplierScheduleApiEntry> entries;
  final ValueChanged<SupplierScheduleApiEntry> onView;
  final void Function(SupplierScheduleApiEntry, SupplierAvailableAction)
  onAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var index = 0; index < entries.length; index++) ...[
          if (index > 0) const SizedBox(height: AppSpacing.sm),
          _Surface(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _ScheduleCell(entry: entries[index]),
                const SizedBox(height: AppSpacing.sm),
                _MaterialCell(entry: entries[index]),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: _FulfillmentCell(entry: entries[index])),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(child: _WindowCell(entry: entries[index])),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: _StatusCell(entry: entries[index])),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(child: _ActorCell(entry: entries[index])),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                _ActionCell(
                  entry: entries[index],
                  fullWidth: true,
                  onView: () => onView(entries[index]),
                  onAction: (action) => onAction(entries[index], action),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _GridRow extends StatelessWidget {
  const _GridRow({required this.children, this.isHeader = false});

  final List<Widget> children;
  final bool isHeader;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: isHeader ? colors.surface.withValues(alpha: 0.55) : null,
        border: Border(
          bottom: BorderSide(color: colors.border.withValues(alpha: 0.55)),
        ),
      ),
      child: Padding(
        padding: EdgeInsetsDirectional.fromSTEB(
          AppSpacing.md,
          isHeader ? AppSpacing.sm : AppSpacing.md,
          AppSpacing.md,
          isHeader ? AppSpacing.sm : AppSpacing.md,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(flex: 12, child: children[0]),
            Expanded(flex: 22, child: children[1]),
            Expanded(flex: 14, child: children[2]),
            Expanded(flex: 15, child: children[3]),
            Expanded(flex: 14, child: children[4]),
            Expanded(flex: 11, child: children[5]),
            Expanded(flex: 12, child: children[6]),
          ],
        ),
      ),
    );
  }
}

class _HeaderCell extends StatelessWidget {
  const _HeaderCell(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Text(
    label,
    maxLines: 1,
    overflow: TextOverflow.ellipsis,
    style: context.supplierLabel().copyWith(
      color: context.supplierColors.textMuted,
      fontWeight: FontWeight.w700,
    ),
  );
}

class _ScheduleCell extends StatelessWidget {
  const _ScheduleCell({required this.entry});

  final SupplierScheduleApiEntry entry;

  @override
  Widget build(BuildContext context) {
    final semantic = _categorySemantic(context, entry.category.value);
    final label = _categoryLabel(context, entry.category.value);
    final timestamp = entry.effectiveWindow?.start ?? entry.historyTimestamp;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          Icons.calendar_month_outlined,
          size: 19,
          color: semantic.foreground,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.supplierLabel().copyWith(
                  color: semantic.foreground,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                timestamp == null
                    ? context.s.noConfirmedWindow
                    : _windowShortLabel(context, entry, timestamp),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: context.supplierBody().copyWith(
                  color: context.supplierColors.textSecondary,
                  fontSize: 12,
                  height: 1.25,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MaterialCell extends StatelessWidget {
  const _MaterialCell({required this.entry});

  final SupplierScheduleApiEntry entry;

  @override
  Widget build(BuildContext context) {
    final group = entry.group;
    final quantity = _quantityLabel(entry.quantity);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _MaterialThumbnail(url: entry.material.imageUrl),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                entry.material.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: context.supplierTitle().copyWith(
                  fontSize: 14,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                entry.learner.displayName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.supplierBody().copyWith(fontSize: 12),
              ),
              const SizedBox(height: 2),
              Text(
                group?.grouped == true
                    ? context.s.groupReservationsQuantity(group!.itemCount, quantity)
                    : quantity,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.supplierBody().copyWith(
                  fontSize: 11,
                  color: context.supplierColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _FulfillmentCell extends StatelessWidget {
  const _FulfillmentCell({required this.entry});

  final SupplierScheduleApiEntry entry;

  @override
  Widget build(BuildContext context) {
    final delivery = entry.fulfillmentMethod.toUpperCase() == 'DELIVERY';
    final grouped = entry.group?.grouped == true;
    final label = delivery
        ? context.s.deliveryPickup
        : context.s.selfPickup;
    final detail = grouped
        ? context.s.groupReservationsCount(entry.group!.itemCount)
        : delivery
        ? _deliveryLabel(context, entry.delivery?.status)
        : context.s.confirmedLabel;
    return _LabeledStack(
      title: label,
      detail: detail,
      icon: delivery ? Icons.local_shipping_outlined : Icons.handshake_outlined,
    );
  }
}

class _WindowCell extends StatelessWidget {
  const _WindowCell({required this.entry});

  final SupplierScheduleApiEntry entry;

  @override
  Widget build(BuildContext context) {
    final window = entry.effectiveWindow;
    if (window == null) {
      return _LabeledStack(
        title: context.s.noConfirmedWindow,
        detail: null,
        icon: Icons.event_busy_outlined,
      );
    }
    return _LabeledStack(
      title: _mediumDate(context, window.start),
      detail:
          '${_time(context, window.start)} – ${_time(context, window.end)}\n${_windowType(context, window.type)}',
      icon: Icons.schedule_outlined,
    );
  }
}

class _StatusCell extends StatelessWidget {
  const _StatusCell({required this.entry});

  final SupplierScheduleApiEntry entry;

  @override
  Widget build(BuildContext context) {
    final category = _categoryLabel(context, entry.category.value);
    final semantic = _categorySemantic(context, entry.category.value);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppStatusBadge(label: category, tone: semantic.tone),
        const SizedBox(height: 4),
        Text(
          _operationalLabel(context, entry),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: context.supplierBody().copyWith(fontSize: 12),
        ),
      ],
    );
  }
}

class _ActorCell extends StatelessWidget {
  const _ActorCell({required this.entry});

  final SupplierScheduleApiEntry entry;

  @override
  Widget build(BuildContext context) {
    final actor = _nextActorLabel(context, entry.nextActor);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          Icons.person_outline_rounded,
          size: 18,
          color: context.supplierColors.textMuted,
        ),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Text(
            actor,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: context.supplierBody().copyWith(fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}

class _ActionCell extends StatelessWidget {
  const _ActionCell({
    required this.entry,
    required this.onView,
    required this.onAction,
    this.fullWidth = false,
  });

  final SupplierScheduleApiEntry entry;
  final VoidCallback onView;
  final ValueChanged<SupplierAvailableAction> onAction;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final actions = entry.availableActions
        .where((item) => item.isExecutable)
        .toList();
    final view = OutlinedButton.icon(
      onPressed: onView,
      icon: const Icon(Icons.visibility_outlined, size: 17),
      label: Text(context.s.viewLabel),
      style: OutlinedButton.styleFrom(
        minimumSize: Size(fullWidth ? double.infinity : 0, 42),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
        side: BorderSide(color: context.supplierColors.border),
      ),
    );
    if (actions.isEmpty) return view;
    final menu = PopupMenuButton<SupplierAvailableAction>(
      tooltip: context.s.moreActions,
      onSelected: onAction,
      itemBuilder: (context) => [
        for (final action in actions)
          PopupMenuItem(
            value: action,
            child: Text(_actionLabel(context, action.value)),
          ),
      ],
      child: const SizedBox(
        width: 42,
        height: 42,
        child: Icon(Icons.keyboard_arrow_down_rounded),
      ),
    );
    return Row(
      mainAxisSize: fullWidth ? MainAxisSize.max : MainAxisSize.min,
      children: [
        Expanded(child: view),
        Container(
          height: 42,
          decoration: BoxDecoration(
            border: Border.all(color: context.supplierColors.border),
            borderRadius: const BorderRadiusDirectional.only(
              topEnd: Radius.circular(10),
              bottomEnd: Radius.circular(10),
            ),
          ),
          child: menu,
        ),
      ],
    );
  }
}

class _Pagination extends StatelessWidget {
  const _Pagination({
    required this.pagination,
    required this.onPage,
    required this.onPageSize,
  });

  final SupplierScheduleApiPagination pagination;
  final ValueChanged<int> onPage;
  final ValueChanged<int> onPageSize;

  @override
  Widget build(BuildContext context) {
    final total = pagination.total;
    final first = total == 0
        ? 0
        : ((pagination.page - 1) * pagination.limit) + 1;
    final last = total == 0
        ? 0
        : (first + pagination.limit - 1).clamp(0, total);
    final hasPages = pagination.totalPages > 1;
    final pageNumbers = _pageNumbers(pagination.page, pagination.totalPages);
    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(horizontal: AppSpacing.sm),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        runSpacing: AppSpacing.sm,
        spacing: AppSpacing.md,
        children: [
          Text(
            context.s.showingHandoversRange(first, last, total),
            style: context.supplierBody().copyWith(
              color: context.supplierColors.textMuted,
              fontSize: 12,
            ),
          ),
          if (hasPages)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _PageButton(
                  icon: Icons.chevron_left_rounded,
                  tooltip: context.s.previousPage,
                  enabled: pagination.page > 1,
                  onPressed: () => onPage(pagination.page - 1),
                ),
                for (final page in pageNumbers)
                  _PageNumber(
                    page: page,
                    selected: page == pagination.page,
                    onPressed: () => onPage(page),
                  ),
                _PageButton(
                  icon: Icons.chevron_right_rounded,
                  tooltip: context.s.nextPage,
                  enabled: pagination.page < pagination.totalPages,
                  onPressed: () => onPage(pagination.page + 1),
                ),
              ],
            ),
          if (hasPages)
            _PageSizeSelector(value: pagination.limit, onChanged: onPageSize),
        ],
      ),
    );
  }
}

class _PageButton extends StatelessWidget {
  const _PageButton({
    required this.icon,
    required this.tooltip,
    required this.enabled,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final bool enabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => IconButton(
    onPressed: enabled ? onPressed : null,
    tooltip: tooltip,
    icon: Icon(icon, size: 20),
    visualDensity: VisualDensity.compact,
  );
}

class _PageNumber extends StatelessWidget {
  const _PageNumber({
    required this.page,
    required this.selected,
    required this.onPressed,
  });

  final int page;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 36,
    height: 36,
    child: selected
        ? FilledButton(
            onPressed: onPressed,
            style: FilledButton.styleFrom(padding: EdgeInsets.zero),
            child: Text('$page'),
          )
        : TextButton(
            onPressed: onPressed,
            style: TextButton.styleFrom(padding: EdgeInsets.zero),
            child: Text('$page'),
          ),
  );
}

class _PageSizeSelector extends StatelessWidget {
  const _PageSizeSelector({required this.value, required this.onChanged});

  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) => _DropdownControl<int>(
    value: value,
    width: 118,
    hint: context.s.rowsPerPage,
    items: [
      for (final size in [5, 10, 20, 50]) _DropdownItem(size, '$size'),
    ],
    onChanged: (size) {
      if (size != null) onChanged(size);
    },
  );
}

class _ScheduleLoading extends StatelessWidget {
  const _ScheduleLoading();

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 1200
        ? 6
        : width >= 720
        ? 3
        : 2;
    return Column(
      children: [
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: 6,
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            mainAxisExtent: 106,
            crossAxisSpacing: AppSpacing.md,
            mainAxisSpacing: AppSpacing.md,
          ),
          itemBuilder: (_, _) => const _Skeleton(height: 106),
        ),
        const SizedBox(height: AppSpacing.md),
        const _Skeleton(height: 64),
        const SizedBox(height: AppSpacing.md),
        const _Skeleton(height: 360),
      ],
    );
  }
}

class _ScheduleError extends StatelessWidget {
  const _ScheduleError({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => _Surface(
    padding: const EdgeInsets.all(AppSpacing.lg),
    child: Row(
      children: [
        Icon(Icons.error_outline_rounded, color: context.supplierColors.error),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                context.s.pickupScheduleLoadFailedTitle,
                style: context.supplierTitle().copyWith(fontSize: 16),
              ),
              const SizedBox(height: 3),
              Text(
                error is ApiException
                    ? (error as ApiException).message
                    : context.s.pleaseTryAgain,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: context.supplierBody().copyWith(
                  color: context.supplierColors.textMuted,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        OutlinedButton(
          onPressed: onRetry,
          child: Text(context.s.tryAgain),
        ),
      ],
    ),
  );
}

class _ScheduleEmpty extends StatelessWidget {
  const _ScheduleEmpty({
    required this.category,
    required this.hasFilters,
    required this.onReset,
    required this.onOpenRequests,
  });

  final String? category;
  final bool hasFilters;
  final VoidCallback onReset;
  final VoidCallback onOpenRequests;

  @override
  Widget build(BuildContext context) {
    final title = hasFilters
        ? context.s.noHandoversMatchFilters
        : switch (category) {
            'TODAY' => context.s.noHandoversToday,
            'UPCOMING' => context.s.noHandoversUpcoming,
            'OVERDUE' => context.s.noHandoversOverdue,
            'COMPLETED' => context.s.noHandoversCompletedPeriod,
            'CLOSED' => context.s.noHandoversClosedPeriod,
            _ => context.s.noHandoversScheduled,
          };
    final copy = hasFilters
        ? context.s.resetFiltersToSeeMore
        : context.s.confirmedHandoversAppearHere;
    return _Surface(
      padding: const EdgeInsets.symmetric(
        vertical: AppSpacing.xl,
        horizontal: AppSpacing.lg,
      ),
      child: Column(
        children: [
          Icon(
            Icons.event_available_outlined,
            size: 42,
            color: context.supplierColors.textMuted,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            title,
            textAlign: TextAlign.center,
            style: context.supplierTitle().copyWith(fontSize: 17),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            copy,
            textAlign: TextAlign.center,
            style: context.supplierBody().copyWith(
              color: context.supplierColors.textMuted,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          OutlinedButton(
            onPressed: hasFilters ? onReset : onOpenRequests,
            child: Text(
              hasFilters
                  ? context.s.resetFilters
                  : context.s.openIncomingRequests,
            ),
          ),
        ],
      ),
    );
  }
}

class _LabeledStack extends StatelessWidget {
  const _LabeledStack({
    required this.title,
    required this.detail,
    required this.icon,
  });

  final String title;
  final String? detail;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(icon, size: 17, color: context.supplierColors.textMuted),
      const SizedBox(width: AppSpacing.xs),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: context.supplierBody().copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            if (detail != null) ...[
              const SizedBox(height: 3),
              Text(
                detail!,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: context.supplierBody().copyWith(
                  fontSize: 12,
                  color: context.supplierColors.textMuted,
                  height: 1.25,
                ),
              ),
            ],
          ],
        ),
      ),
    ],
  );
}

class _MaterialThumbnail extends StatelessWidget {
  const _MaterialThumbnail({required this.url});

  final String? url;

  @override
  Widget build(BuildContext context) {
    final size = 56.0;
    final imageUrl = url?.trim();
    return ClipRRect(
      borderRadius: AppRadius.smAll,
      child: SizedBox(
        width: size,
        height: size,
        child: imageUrl == null || imageUrl.isEmpty
            ? _placeholder(context, size)
            : Image.network(
                ApiConfig.resolveMediaUrl(imageUrl),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _placeholder(context, size),
              ),
      ),
    );
  }

  Widget _placeholder(BuildContext context, double size) => ColoredBox(
    color: context.supplierColors.accentSoft.withValues(alpha: 0.18),
    child: Icon(
      Icons.inventory_2_outlined,
      color: context.supplierColors.textMuted,
      size: size * .42,
    ),
  );
}

class _Surface extends StatelessWidget {
  const _Surface({required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) => Container(
    padding: padding,
    decoration: BoxDecoration(
      color: context.supplierColors.surfaceSolid,
      borderRadius: AppRadius.lgAll,
      border: Border.all(
        color: context.supplierColors.border.withValues(alpha: 0.72),
      ),
      boxShadow: [
        BoxShadow(
          color: context.supplierColors.cardShadow.withValues(alpha: 0.12),
          blurRadius: 12,
          offset: const Offset(0, 4),
        ),
      ],
    ),
    child: child,
  );
}

class _Skeleton extends StatelessWidget {
  const _Skeleton({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) => Container(
    height: height,
    decoration: BoxDecoration(
      color: context.supplierColors.surface.withValues(alpha: 0.72),
      borderRadius: AppRadius.lgAll,
    ),
  );
}

class _OutlinedControl extends StatelessWidget {
  const _OutlinedControl({
    required this.icon,
    required this.label,
    required this.onTap,
    this.minWidth = 0,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final double minWidth;

  @override
  Widget build(BuildContext context) => ConstrainedBox(
    constraints: BoxConstraints(minWidth: minWidth, minHeight: 44),
    child: OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 18),
      label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        side: BorderSide(color: context.supplierColors.border),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
      ),
    ),
  );
}

class _TopCategoryButton extends StatelessWidget {
  const _TopCategoryButton({
    required this.label,
    required this.selected,
    required this.tone,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final AppStatusTone tone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final style = AppStatusStyle.of(context, tone);
    return SizedBox(
      height: 44,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          backgroundColor: selected
              ? style.background
              : context.supplierColors.surfaceSolid,
          foregroundColor: selected
              ? style.foreground
              : context.supplierColors.textSecondary,
          side: BorderSide(
            color: selected ? style.border : context.supplierColors.border,
          ),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        ),
        child: Text(label),
      ),
    );
  }
}

class _DropdownItem<T> {
  const _DropdownItem(this.value, this.label);

  final T value;
  final String label;
}

class _DropdownControl<T> extends StatelessWidget {
  const _DropdownControl({
    required this.value,
    required this.hint,
    required this.items,
    required this.onChanged,
    this.width,
  });

  final T value;
  final String hint;
  final List<_DropdownItem<T>> items;
  final ValueChanged<T?> onChanged;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final dropdown = DropdownButtonHideUnderline(
      child: DropdownButton<T>(
        value: items.any((item) => item.value == value) ? value : null,
        isExpanded: true,
        hint: Text(hint, maxLines: 1, overflow: TextOverflow.ellipsis),
        icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 18),
        items: [
          for (final item in items)
            DropdownMenuItem<T>(
              value: item.value,
              child: Text(item.label, overflow: TextOverflow.ellipsis),
            ),
        ],
        onChanged: onChanged,
      ),
    );
    return Container(
      width: width,
      height: 44,
      padding: const EdgeInsetsDirectional.symmetric(horizontal: AppSpacing.sm),
      decoration: BoxDecoration(
        color: context.supplierColors.surface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: context.supplierColors.border),
      ),
      child: dropdown,
    );
  }
}

class _MoreFilters extends StatelessWidget {
  const _MoreFilters({
    required this.scope,
    required this.activeFilterCount,
    required this.onScope,
    required this.onReset,
  });

  final String scope;
  final int activeFilterCount;
  final ValueChanged<String> onScope;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) => PopupMenuButton<String>(
    tooltip: context.s.moreFilters,
    onSelected: (value) {
      if (value == 'RESET') {
        onReset();
      } else {
        onScope(value);
      }
    },
    itemBuilder: (context) => [
      PopupMenuItem(
        value: 'ACTIVE',
        child: Text(context.s.historyActive),
      ),
      PopupMenuItem(
        value: 'HISTORY',
        child: Text(context.s.historyTerminal),
      ),
      PopupMenuItem(value: 'ALL', child: Text(context.s.filterAll)),
      if (activeFilterCount > 0)
        PopupMenuItem(
          value: 'RESET',
          child: Text(context.s.resetFilters),
        ),
    ],
    child: OutlinedButton.icon(
      onPressed: null,
      icon: const Icon(Icons.tune_rounded, size: 18),
      label: Text(
        activeFilterCount > 0
            ? context.s.filtersCount(activeFilterCount)
            : context.s.filtersTitle,
      ),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(112, 44),
        side: BorderSide(color: context.supplierColors.border),
      ),
    ),
  );
}

List<_DropdownItem<String?>> _categoryOptions(BuildContext context) => [
  _DropdownItem(null, context.s.filterAllCategories),
  for (final code in const [
    'UNSCHEDULED_ACTION',
    'ADMIN_REVIEW',
    'OVERDUE',
    'IN_PROGRESS',
    'TODAY',
    'UPCOMING',
    'COMPLETED',
    'CLOSED',
  ])
    _DropdownItem(code, context.s.scheduleCategoryFilterLabel(code)),
];

String _rangeLabel(BuildContext context, DateTime start, DateTime end) =>
    '${_mediumDate(context, start)} – ${_mediumDate(context, end)}';

String _mediumDate(BuildContext context, DateTime value) =>
    MaterialLocalizations.of(context).formatMediumDate(value);

String _time(BuildContext context, DateTime value) => MaterialLocalizations.of(
  context,
).formatTimeOfDay(TimeOfDay.fromDateTime(value));

String _windowShortLabel(
  BuildContext context,
  SupplierScheduleApiEntry entry,
  DateTime timestamp,
) {
  if (entry.effectiveWindow == null) {
    return '${_mediumDate(context, timestamp)} · ${_time(context, timestamp)}';
  }
  return '${_mediumDate(context, timestamp)}\n${_time(context, entry.effectiveWindow!.start)} – ${_time(context, entry.effectiveWindow!.end)}';
}

String _windowType(BuildContext context, String raw) =>
    context.s.scheduleWindowType(raw);

String _deliveryLabel(BuildContext context, String? raw) =>
    context.s.scheduleDeliveryLabel(raw);

String _operationalLabel(
  BuildContext context,
  SupplierScheduleApiEntry entry,
) => context.s.scheduleOperationalLabel(
  entry.category.value,
  entry.reservationStatus,
);

String _categoryLabel(
  BuildContext context,
  SupplierScheduleCategory category,
) => context.s.scheduleCategoryLabel(category);

_CategorySemantic _categorySemantic(
  BuildContext context,
  SupplierScheduleCategory category,
) {
  final tone = switch (category) {
    SupplierScheduleCategory.today => AppStatusTone.success,
    SupplierScheduleCategory.upcoming => AppStatusTone.info,
    SupplierScheduleCategory.overdue => AppStatusTone.warning,
    SupplierScheduleCategory.unscheduledAction ||
    SupplierScheduleCategory.adminReview => AppStatusTone.warning,
    SupplierScheduleCategory.inProgress => AppStatusTone.info,
    SupplierScheduleCategory.completed => AppStatusTone.success,
    SupplierScheduleCategory.closed ||
    SupplierScheduleCategory.unknown => AppStatusTone.neutral,
  };
  final style = AppStatusStyle.of(context, tone);
  return _CategorySemantic(tone: tone, foreground: style.foreground);
}

class _CategorySemantic {
  const _CategorySemantic({required this.tone, required this.foreground});

  final AppStatusTone tone;
  final Color foreground;
}

String _nextActorLabel(BuildContext context, String raw) =>
    context.s.scheduleNextActorLabel(raw);

String _actionLabel(BuildContext context, SupplierReservationAction action) =>
    context.s.scheduleReservationActionLabel(action);

String _quantityLabel(SupplierScheduleQuantity quantity) {
  final value = quantity.value == quantity.value.roundToDouble()
      ? quantity.value.toInt().toString()
      : quantity.value.toString();
  return '$value ${quantity.unit}';
}

DateTime _dateOnly(DateTime value) =>
    DateTime(value.year, value.month, value.day);

List<int> _pageNumbers(int current, int total) {
  if (total <= 5) return [for (var page = 1; page <= total; page++) page];
  final start = current <= 3
      ? 1
      : current >= total - 2
      ? total - 4
      : current - 2;
  return [for (var page = start; page < start + 5; page++) page];
}

InputBorder _fieldBorder(BuildContext context, {bool focused = false}) =>
    OutlineInputBorder(
      borderRadius: AppRadius.mdAll,
      borderSide: BorderSide(
        color: focused
            ? context.supplierColors.borderFocused
            : context.supplierColors.border,
      ),
    );
