import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_dialog_detail.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/review_status_presentation.dart';
import '../../../materials/application/material_listing_providers.dart';
import '../../../materials/data/models/category.dart';
import '../../data/admin_approvals_api.dart';
import '../theme/admin_decoration_set.dart';
import '../widgets/admin_empty_state.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;

const _kApprovalsPageSize = 10;

class _ApprovalsFilters {
  const _ApprovalsFilters({
    required this.tab,
    required this.status,
    required this.search,
    required this.page,
  });

  final String tab; // CATEGORY | PRICE
  final String status; // PENDING | APPROVED | REJECTED | ALL
  final String search;
  final int page;

  _ApprovalsFilters copyWith({
    String? tab,
    String? status,
    String? search,
    int? page,
  }) {
    return _ApprovalsFilters(
      tab: tab ?? this.tab,
      status: status ?? this.status,
      search: search ?? this.search,
      page: page ?? this.page,
    );
  }
}

class _ApprovalsFiltersNotifier extends Notifier<_ApprovalsFilters> {
  @override
  _ApprovalsFilters build() {
    return const _ApprovalsFilters(
      tab: 'CATEGORY',
      status: 'PENDING',
      search: '',
      page: 1,
    );
  }

  void setTab(String tab) =>
      state = state.copyWith(tab: tab, search: '', page: 1);
  void setStatus(String status) =>
      state = state.copyWith(status: status, page: 1);
  void setSearch(String search) =>
      state = state.copyWith(search: search, page: 1);
  void setPage(int page) => state = state.copyWith(page: page);
  void reset() => state = const _ApprovalsFilters(
    tab: 'CATEGORY',
    status: 'PENDING',
    search: '',
    page: 1,
  );
}

final _approvalsFiltersProvider =
    NotifierProvider<_ApprovalsFiltersNotifier, _ApprovalsFilters>(
      _ApprovalsFiltersNotifier.new,
    );

final adminApprovalsSummaryProvider = FutureProvider.autoDispose((ref) {
  return ref.watch(adminApprovalsApiProvider).fetchSummary();
});

final adminApprovalsCategoryRequestsProvider = FutureProvider.autoDispose((
  ref,
) {
  final filters = ref.watch(_approvalsFiltersProvider);
  return ref
      .watch(adminApprovalsApiProvider)
      .fetchCategoryRequests(
        status: filters.status,
        search: filters.search,
        page: filters.page,
        limit: _kApprovalsPageSize,
      );
});

final adminApprovalsPriceRequestsProvider = FutureProvider.autoDispose((ref) {
  final filters = ref.watch(_approvalsFiltersProvider);
  return ref
      .watch(adminApprovalsApiProvider)
      .fetchPriceRequests(
        status: filters.status,
        search: filters.search,
        page: filters.page,
        limit: _kApprovalsPageSize,
      );
});

class AdminApprovalsPage extends ConsumerStatefulWidget {
  const AdminApprovalsPage({super.key, this.initialStatus});

  final String? initialStatus;

  @override
  ConsumerState<AdminApprovalsPage> createState() => _AdminApprovalsPageState();
}

class _AdminApprovalsPageState extends ConsumerState<AdminApprovalsPage> {
  var _appliedInitialStatus = false;

  static const _validStatusFilters = {'PENDING', 'APPROVED', 'REJECTED', 'ALL'};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _applyInitialStatusIfNeeded(),
    );
  }

  @override
  void didUpdateWidget(AdminApprovalsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialStatus != widget.initialStatus) {
      _appliedInitialStatus = false;
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _applyInitialStatusIfNeeded(),
      );
    }
  }

  void _applyInitialStatusIfNeeded() {
    if (!mounted || _appliedInitialStatus) return;
    final raw = widget.initialStatus?.trim().toUpperCase();
    if (raw == null || raw.isEmpty) return;
    _appliedInitialStatus = true;
    if (!_validStatusFilters.contains(raw)) return;
    ref.read(_approvalsFiltersProvider.notifier).setStatus(raw);
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final filters = ref.watch(_approvalsFiltersProvider);

    return ListView(
      padding: const EdgeInsetsDirectional.only(bottom: 24),
      children: [
        Text('Approvals', style: AdminTypography.pageTitle(palette)),
        const SizedBox(height: 6),
        Text(
          'Review supplier requests for new categories and price approvals before they affect the marketplace.',
          style: AdminTypography.pageSubtitle(palette),
        ),
        const SizedBox(height: 18),
        const _ApprovalsSummaryStrip(),
        const SizedBox(height: 18),
        _ApprovalsSegmentedTabs(selected: filters.tab),
        const SizedBox(height: 14),
        _ApprovalsFilterBar(
          key: ValueKey('${filters.tab}|${filters.status}|${filters.search}'),
        ),
        const SizedBox(height: 18),
        if (filters.tab == 'CATEGORY') const _CategoryRequestsPanel(),
        if (filters.tab == 'PRICE') const _PriceRequestsPanel(),
      ],
    );
  }
}

/// Compact KPI strip — one icon-tile card per approval metric.
class _ApprovalsSummaryStrip extends ConsumerWidget {
  const _ApprovalsSummaryStrip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.adminPalette;
    final asyncSummary = ref.watch(adminApprovalsSummaryProvider);

    return asyncSummary.when(
      loading: () => const SizedBox(
        height: 84,
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: palette.cardBackground,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: palette.cardBorder),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                error.toString(),
                style: AdminTypography.pageSubtitle(palette),
              ),
            ),
            const SizedBox(width: 10),
            FilledButton(
              onPressed: () => ref.invalidate(adminApprovalsSummaryProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (summary) {
        final tiles = [
          _ApprovalKpiTile(
            label: 'Pending',
            value: summary.pendingTotal,
            icon: Icons.outlined_flag,
            color: palette.amber,
          ),
          _ApprovalKpiTile(
            label: 'Approved',
            value: summary.approvedTotal,
            icon: Icons.check_circle_outline,
            color: palette.green,
          ),
          _ApprovalKpiTile(
            label: 'Rejected',
            value: summary.rejectedTotal,
            icon: Icons.cancel_outlined,
            color: palette.red,
          ),
          _ApprovalKpiTile(
            label: 'Category',
            value: summary.categoryPending,
            icon: Icons.sell_outlined,
            color: palette.blue,
          ),
          _ApprovalKpiTile(
            label: 'Price',
            value: summary.pricePending,
            icon: Icons.attach_money,
            color: palette.purple,
          ),
        ];

        return LayoutBuilder(
          builder: (context, constraints) {
            final columns = constraints.maxWidth >= 900
                ? 5
                : constraints.maxWidth >= 560
                ? 3
                : constraints.maxWidth >= 360
                ? 2
                : 1;
            const spacing = 12.0;

            final rows = <Widget>[];
            for (var i = 0; i < tiles.length; i += columns) {
              final chunk = tiles.skip(i).take(columns).toList();
              rows.add(
                Padding(
                  padding: EdgeInsets.only(
                    bottom: i + columns < tiles.length ? spacing : 0,
                  ),
                  child: IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (var j = 0; j < chunk.length; j++) ...[
                          if (j > 0) const SizedBox(width: spacing),
                          Expanded(child: chunk[j]),
                        ],
                      ],
                    ),
                  ),
                ),
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: rows,
            );
          },
        );
      },
    );
  }
}

class _ApprovalKpiTile extends StatelessWidget {
  const _ApprovalKpiTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final int value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.cardBorder),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: palette.isDark ? 12 : 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: AdminTypography.kpiHelper(palette)),
          const SizedBox(height: 10),
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: palette.isDark ? 0.2 : 0.12),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(icon, size: 19, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('$value', style: AdminTypography.kpiValue(palette)),
                    Text('Requests', style: AdminTypography.kpiHelper(palette)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Full-width segmented tab bar with an underline indicator on the active tab.
class _ApprovalsSegmentedTabs extends ConsumerWidget {
  const _ApprovalsSegmentedTabs({required this.selected});
  final String selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.adminPalette;

    void select(String tab) =>
        ref.read(_approvalsFiltersProvider.notifier).setTab(tab);

    return Container(
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Row(
        children: [
          Expanded(
            child: _ApprovalsTabItem(
              label: 'Category Requests',
              icon: Icons.category_outlined,
              isSelected: selected == 'CATEGORY',
              onTap: () => select('CATEGORY'),
            ),
          ),
          Container(width: 1, height: 26, color: palette.cardBorder),
          Expanded(
            child: _ApprovalsTabItem(
              label: 'Price Requests',
              icon: Icons.price_check_outlined,
              isSelected: selected == 'PRICE',
              onTap: () => select('PRICE'),
            ),
          ),
        ],
      ),
    );
  }
}

class _ApprovalsTabItem extends StatelessWidget {
  const _ApprovalsTabItem({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final color = isSelected ? palette.textPrimary : palette.textSecondary;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isSelected ? palette.primaryTeal : Colors.transparent,
                width: 3,
              ),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 8),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ApprovalsFilterBar extends ConsumerStatefulWidget {
  const _ApprovalsFilterBar({super.key});

  @override
  ConsumerState<_ApprovalsFilterBar> createState() =>
      _ApprovalsFilterBarState();
}

class _ApprovalsFilterBarState extends ConsumerState<_ApprovalsFilterBar> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: ref.read(_approvalsFiltersProvider).search,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final filters = ref.watch(_approvalsFiltersProvider);
    final compact = MediaQuery.sizeOf(context).width < 640;

    final searchField = TextField(
      controller: _controller,
      decoration: const InputDecoration(
        prefixIcon: Icon(Icons.search),
        hintText: 'Search by supplier or material...',
        border: OutlineInputBorder(),
        isDense: true,
      ),
      onSubmitted: (value) =>
          ref.read(_approvalsFiltersProvider.notifier).setSearch(value),
    );

    final statusField = DropdownButtonFormField<String>(
      initialValue: filters.status,
      items: const [
        DropdownMenuItem(value: 'PENDING', child: Text('Pending')),
        DropdownMenuItem(value: 'APPROVED', child: Text('Approved')),
        DropdownMenuItem(value: 'REJECTED', child: Text('Rejected')),
        DropdownMenuItem(value: 'ALL', child: Text('All')),
      ],
      decoration: const InputDecoration(
        labelText: 'Status',
        border: OutlineInputBorder(),
        isDense: true,
      ),
      onChanged: (value) {
        if (value == null) return;
        ref.read(_approvalsFiltersProvider.notifier).setStatus(value);
      },
    );

    final resetButton = OutlinedButton.icon(
      onPressed: () {
        _controller.clear();
        ref.read(_approvalsFiltersProvider.notifier).reset();
        ref.invalidate(adminApprovalsCategoryRequestsProvider);
        ref.invalidate(adminApprovalsPriceRequestsProvider);
        context.go('/admin/approvals');
      },
      icon: const Icon(Icons.restart_alt, size: 18),
      label: const Text('Reset'),
      style: OutlinedButton.styleFrom(foregroundColor: palette.textSecondary),
    );

    final refreshButton = OutlinedButton.icon(
      onPressed: () {
        ref.invalidate(adminApprovalsSummaryProvider);
        ref.invalidate(adminApprovalsCategoryRequestsProvider);
        ref.invalidate(adminApprovalsPriceRequestsProvider);
      },
      icon: Icon(Icons.refresh, size: 18, color: palette.primaryTeal),
      label: Text('Refresh', style: TextStyle(color: palette.primaryTeal)),
      style: OutlinedButton.styleFrom(
        side: BorderSide(color: palette.primaryTeal.withValues(alpha: 0.5)),
      ),
    );

    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.cardBorder),
      ),
      child: compact
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                searchField,
                const SizedBox(height: 10),
                statusField,
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: resetButton),
                    const SizedBox(width: 10),
                    Expanded(child: refreshButton),
                  ],
                ),
              ],
            )
          : Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(child: searchField),
                const SizedBox(width: 12),
                SizedBox(width: 180, child: statusField),
                const SizedBox(width: 10),
                resetButton,
                const SizedBox(width: 10),
                refreshButton,
              ],
            ),
    );
  }
}

class _CategoryRequestsPanel extends ConsumerWidget {
  const _CategoryRequestsPanel();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(adminApprovalsCategoryRequestsProvider);

    return asyncData.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AdminEmptyState(
            icon: Icons.error_outline,
            title: 'Could not load category requests',
            subtitle: error.toString(),
          ),
          const SizedBox(height: 10),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: OutlinedButton(
              onPressed: () =>
                  ref.invalidate(adminApprovalsCategoryRequestsProvider),
              child: const Text('Retry'),
            ),
          ),
        ],
      ),
      data: (response) {
        if (response.items.isEmpty) {
          return const AdminEmptyState(
            icon: Icons.category_outlined,
            title: 'No category requests',
            subtitle: 'No requests match the current filters.',
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final item in response.items)
              _CategoryRequestCard(
                item: item,
                onDetails: () => _openCategoryDetails(context, ref, item),
                onApprove: () => _quickApproveCategory(context, ref, item),
                onReject: () => _quickRejectCategory(context, ref, item),
              ),
            const SizedBox(height: 4),
            _ApprovalsPaginationBar(
              itemCount: response.items.length,
              pagination: response.pagination,
              onPageChanged: (page) =>
                  ref.read(_approvalsFiltersProvider.notifier).setPage(page),
            ),
          ],
        );
      },
    );
  }
}

class _PriceRequestsPanel extends ConsumerWidget {
  const _PriceRequestsPanel();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(adminApprovalsPriceRequestsProvider);

    return asyncData.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AdminEmptyState(
            icon: Icons.error_outline,
            title: 'Could not load price requests',
            subtitle: error.toString(),
          ),
          const SizedBox(height: 10),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: OutlinedButton(
              onPressed: () =>
                  ref.invalidate(adminApprovalsPriceRequestsProvider),
              child: const Text('Retry'),
            ),
          ),
        ],
      ),
      data: (response) {
        if (response.items.isEmpty) {
          return const AdminEmptyState(
            icon: Icons.price_check_outlined,
            title: 'No price requests',
            subtitle: 'No requests match the current filters.',
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final item in response.items)
              _PriceRequestCard(
                item: item,
                onDetails: () => _openPriceDetails(context, ref, item),
                onApprove: () => _quickApprovePrice(context, ref, item),
                onReject: () => _quickRejectPrice(context, ref, item),
              ),
            const SizedBox(height: 4),
            _ApprovalsPaginationBar(
              itemCount: response.items.length,
              pagination: response.pagination,
              onPageChanged: (page) =>
                  ref.read(_approvalsFiltersProvider.notifier).setPage(page),
            ),
          ],
        );
      },
    );
  }
}

/// "Showing X of Y requests" footer with a compact pager.
class _ApprovalsPaginationBar extends StatelessWidget {
  const _ApprovalsPaginationBar({
    required this.itemCount,
    required this.pagination,
    required this.onPageChanged,
  });

  final int itemCount;
  final AdminApprovalsPagination pagination;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final total = pagination.total;
    final totalPages = total == 0 ? 1 : (total / pagination.limit).ceil();

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 12,
        runSpacing: 8,
        children: [
          Text(
            'Showing $itemCount of $total request${total == 1 ? '' : 's'}',
            style: AdminTypography.kpiHelper(palette),
          ),
          if (totalPages > 1)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _PaginationArrow(
                  icon: Icons.chevron_left,
                  enabled: pagination.page > 1,
                  onTap: () => onPageChanged(pagination.page - 1),
                ),
                const SizedBox(width: 8),
                Container(
                  width: 28,
                  height: 28,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: palette.primaryTeal,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${pagination.page}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                _PaginationArrow(
                  icon: Icons.chevron_right,
                  enabled: pagination.page < totalPages,
                  onTap: () => onPageChanged(pagination.page + 1),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class _PaginationArrow extends StatelessWidget {
  const _PaginationArrow({
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: 28,
        height: 28,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: palette.cardBorder),
        ),
        child: Icon(
          icon,
          size: 18,
          color: enabled
              ? palette.textPrimary
              : palette.textMuted.withValues(alpha: 0.4),
        ),
      ),
    );
  }
}

class _CategoryRequestCard extends StatelessWidget {
  const _CategoryRequestCard({
    required this.item,
    required this.onDetails,
    required this.onApprove,
    required this.onReject,
  });

  final AdminCategoryRequestListItem item;
  final VoidCallback onDetails;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final dateFormat = DateFormat.yMMMd();
    final supplierLabel = _supplierLabel(
      item.supplierOrganization,
      item.supplierName,
      item.supplierEmail,
    );
    final suggestedCategory = item.similarCategories.isEmpty
        ? 'No suggested existing category'
        : item.similarCategories.first;

    final keyFacts = <Widget>[
      if (item.materialTitle?.trim().isNotEmpty == true)
        _ApprovalKeyFact(label: 'Material', value: item.materialTitle!),
      _ApprovalKeyFact(label: 'Suggested category', value: suggestedCategory),
    ];

    final reason = item.categoryRequestReason?.trim();

    return _ApprovalCard(
      icon: Icons.category_outlined,
      iconColor: palette.blue,
      title: item.requestedName,
      typeLabel: 'Category request',
      typeColor: palette.blue,
      submittedLabel: dateFormat.format(item.createdAt),
      supplierLabel: supplierLabel,
      status: item.status,
      keyFacts: keyFacts,
      secondaryLine: reason?.isNotEmpty == true
          ? 'Reason: ${_truncate(reason, 140)}'
          : null,
      onDetails: onDetails,
      onApprove: onApprove,
      onReject: onReject,
      approveLabel: 'Approve',
      rejectLabel: 'Reject',
    );
  }
}

class _PriceRequestCard extends StatelessWidget {
  const _PriceRequestCard({
    required this.item,
    required this.onDetails,
    required this.onApprove,
    required this.onReject,
  });

  final AdminPriceRequestListItem item;
  final VoidCallback onDetails;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final dateFormat = DateFormat.yMMMd();
    final supplierLabel = _supplierLabel(
      item.supplierOrganization,
      item.supplierName,
      item.supplierEmail,
    );
    final unit = item.unit ?? 'unit';

    final keyFacts = <Widget>[
      _ApprovalKeyFact(
        label: 'Requested',
        value: item.supplierPriceNis == null
            ? '—'
            : '${item.supplierPriceNis!.toStringAsFixed(2)} NIS',
      ),
      _ApprovalKeyFact(
        label: 'Suggested',
        value: item.aiSuggestedMaxUnitPriceNis == null
            ? '—'
            : '${item.aiSuggestedMaxUnitPriceNis!.toStringAsFixed(2)} NIS',
      ),
      if (item.adjustedMaxUnitPriceNis != null)
        _ApprovalKeyFact(
          label: 'Adjusted max',
          value: '${item.adjustedMaxUnitPriceNis!.toStringAsFixed(2)} NIS',
        ),
      if (item.quantity != null)
        _ApprovalKeyFact(
          label: 'Quantity',
          value: '${_formatQuantity(item.quantity!)} $unit'.trim(),
        ),
    ];

    final secondaryParts = <String>[
      'Condition: ${_formatCondition(item.condition)}',
      if (item.categoryName?.trim().isNotEmpty == true)
        'Category: ${item.categoryName!.trim()}',
    ];

    return _ApprovalCard(
      icon: Icons.sell_outlined,
      iconColor: palette.purple,
      title: item.materialTitle ?? 'Unknown material',
      typeLabel: 'Price request',
      typeColor: palette.purple,
      submittedLabel: dateFormat.format(item.createdAt),
      supplierLabel: supplierLabel,
      status: item.status,
      keyFacts: keyFacts,
      secondaryLine: secondaryParts.join('  ·  '),
      onDetails: onDetails,
      onApprove: onApprove,
      onReject: onReject,
      approveLabel: 'Approve price',
      rejectLabel: 'Reject price',
    );
  }
}

/// Shared horizontal approval card: icon tile + scannable main content
/// (title, badges, supplier, compact key facts) + status + actions.
class _ApprovalCard extends StatelessWidget {
  const _ApprovalCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.typeLabel,
    required this.typeColor,
    required this.submittedLabel,
    required this.supplierLabel,
    required this.status,
    required this.onDetails,
    required this.onApprove,
    required this.onReject,
    required this.approveLabel,
    required this.rejectLabel,
    this.keyFacts = const [],
    this.secondaryLine,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String typeLabel;
  final Color typeColor;
  final String submittedLabel;
  final String supplierLabel;
  final String status;
  final VoidCallback onDetails;
  final VoidCallback onApprove;
  final VoidCallback onReject;
  final String approveLabel;
  final String rejectLabel;
  final List<Widget> keyFacts;
  final String? secondaryLine;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final isPending = status.toUpperCase() == 'PENDING';

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: palette.cardBorder),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: palette.isDark ? 14 : 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: palette.isDark ? 0.2 : 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, size: 24, color: iconColor),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: AdminTypography.pageTitle(
                          palette,
                        ).copyWith(fontSize: 16),
                      ),
                    ),
                    const SizedBox(width: 10),
                    AppStatusBadge(
                      label: _formatApprovalStatus(status),
                      tone: reviewStatusTone(status),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _TypeBadge(label: typeLabel, color: typeColor),
                    Text(
                      'Submitted $submittedLabel',
                      style: AdminTypography.kpiHelper(palette),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  supplierLabel,
                  style: AdminTypography.pageSubtitle(
                    palette,
                  ).copyWith(fontSize: 13, fontWeight: FontWeight.w600),
                ),
                if (keyFacts.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(spacing: 8, runSpacing: 8, children: keyFacts),
                ],
                if (secondaryLine != null &&
                    secondaryLine!.trim().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    secondaryLine!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AdminTypography.kpiHelper(palette),
                  ),
                ],
                const SizedBox(height: 14),
                _ApprovalActionRow(
                  isPending: isPending,
                  onDetails: onDetails,
                  onReject: onReject,
                  onApprove: onApprove,
                  rejectLabel: rejectLabel,
                  approveLabel: approveLabel,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Small labeled pill used for compact "key facts" (e.g. price, quantity).
class _ApprovalKeyFact extends StatelessWidget {
  const _ApprovalKeyFact({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: palette.pageBackground,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('$label  ', style: AdminTypography.kpiHelper(palette)),
          Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: palette.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _TypeBadge extends StatelessWidget {
  const _TypeBadge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(8, 4, 8, 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Text(
        label,
        style: AdminTypography.kpiHelper(
          palette,
        ).copyWith(fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}

class _ApprovalActionRow extends StatelessWidget {
  const _ApprovalActionRow({
    required this.isPending,
    required this.onDetails,
    required this.onReject,
    required this.onApprove,
    required this.rejectLabel,
    required this.approveLabel,
  });

  final bool isPending;
  final VoidCallback onDetails;
  final VoidCallback onReject;
  final VoidCallback onApprove;
  final String rejectLabel;
  final String approveLabel;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: AlignmentDirectional.centerEnd,
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        alignment: WrapAlignment.end,
        children: [
          TextButton(onPressed: onDetails, child: const Text('Details')),
          if (isPending) ...[
            OutlinedButton(
              onPressed: onReject,
              style: AppStatusButtonStyle.outlined(
                context,
                AppStatusTone.danger,
              ),
              child: Text(rejectLabel),
            ),
            FilledButton(
              onPressed: onApprove,
              style: AppStatusButtonStyle.filled(
                context,
                AppStatusTone.success,
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
              ),
              child: Text(approveLabel),
            ),
          ],
        ],
      ),
    );
  }
}

String _supplierLabel(String? organization, String? name, String? email) {
  if (organization != null && organization.trim().isNotEmpty) {
    return organization.trim();
  }
  if (name != null && name.trim().isNotEmpty) {
    return name.trim();
  }
  if (email != null && email.trim().isNotEmpty) {
    return email.trim();
  }
  return 'Supplier';
}

String _truncate(String? value, int maxLength) {
  final text = value?.trim() ?? '';
  if (text.isEmpty) return '—';
  if (text.length <= maxLength) return text;
  return '${text.substring(0, maxLength)}…';
}

String _formatQuantity(double value) {
  return value % 1 == 0 ? value.toInt().toString() : value.toStringAsFixed(2);
}

String _formatCondition(String? value) {
  if (value == null || value.trim().isEmpty) return '—';
  return value.replaceAll('_', ' ');
}

String _formatApprovalStatus(String value) {
  return value
      .trim()
      .toLowerCase()
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}

Future<void> _quickApproveCategory(
  BuildContext context,
  WidgetRef ref,
  AdminCategoryRequestListItem item,
) async {
  final api = ref.read(adminApprovalsApiProvider);
  final controller = TextEditingController(text: item.requestedName);
  final finalName = await showDialog<String?>(
    context: context,
    builder: (context) => AppDialogShell(
      title: const Text('Approve category'),
      content: TextField(
        controller: controller,
        decoration: const InputDecoration(
          labelText: 'Final category name',
          border: OutlineInputBorder(),
        ),
      ),
      footer: AppDialogFooter.form(
        primaryAction: FilledButton(
          onPressed: () => Navigator.of(context).pop(controller.text.trim()),
          style: AppStatusButtonStyle.filled(context, AppStatusTone.success),
          child: const Text('Approve'),
        ),
      ),
    ),
  );
  controller.dispose();
  if (finalName == null || finalName.trim().isEmpty) return;

  try {
    await api.approveCategoryRequest(id: item.id, finalName: finalName);
    ref.invalidate(adminApprovalsSummaryProvider);
    ref.invalidate(adminApprovalsCategoryRequestsProvider);
    ref.invalidate(materialCategoriesProvider);
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Category approved.')));
    }
  } on ApiException catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.displayMessage),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }
}

Future<void> _quickRejectCategory(
  BuildContext context,
  WidgetRef ref,
  AdminCategoryRequestListItem item,
) async {
  final api = ref.read(adminApprovalsApiProvider);
  final categories = await ref.read(materialCategoriesProvider.future);
  final reasonController = TextEditingController();
  String? suggestedCategoryId;
  if (!context.mounted) {
    reasonController.dispose();
    return;
  }

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AppDialogShell(
      title: const Text('Reject category'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: reasonController,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Reason (required)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: suggestedCategoryId,
            items: [
              for (final c in categories)
                DropdownMenuItem(value: c.id, child: Text(c.nameEn)),
            ],
            onChanged: (value) => suggestedCategoryId = value,
            decoration: const InputDecoration(
              labelText: 'Suggested existing category (recommended)',
              border: OutlineInputBorder(),
            ),
          ),
        ],
      ),
      footer: AppDialogFooter.decision(
        secondaryAction: TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        primaryAction: FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
          child: const Text('Reject'),
        ),
      ),
    ),
  );

  final reason = reasonController.text.trim();
  reasonController.dispose();
  if (!context.mounted) return;
  if (confirmed != true) return;
  if (reason.length < 3) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Reason is required.'),
        backgroundColor: Theme.of(context).colorScheme.error,
      ),
    );
    return;
  }
  if (categories.isNotEmpty &&
      (suggestedCategoryId == null || suggestedCategoryId!.trim().isEmpty)) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Select a suggested existing category.'),
        backgroundColor: Theme.of(context).colorScheme.error,
      ),
    );
    return;
  }

  try {
    await api.rejectCategoryRequest(
      id: item.id,
      adminNote: reason,
      suggestedCategoryId: suggestedCategoryId,
    );
    ref.invalidate(adminApprovalsSummaryProvider);
    ref.invalidate(adminApprovalsCategoryRequestsProvider);
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Category rejected.')));
    }
  } on ApiException catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.displayMessage),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }
}

Future<void> _quickApprovePrice(
  BuildContext context,
  WidgetRef ref,
  AdminPriceRequestListItem item,
) async {
  final api = ref.read(adminApprovalsApiProvider);
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AppDialogShell(
      title: const Text('Approve supplier price'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Supplier price: ${item.supplierPriceNis?.toStringAsFixed(2) ?? '—'} NIS',
          ),
          const SizedBox(height: 6),
          Text(
            item.aiSuggestedMaxUnitPriceNis == null
                ? 'AI/base suggested: unavailable'
                : 'AI/base suggested: ${item.aiSuggestedMaxUnitPriceNis!.toStringAsFixed(2)} NIS (max unit)',
          ),
          if (item.conditionMultiplier != null) ...[
            const SizedBox(height: 6),
            Text(
              'Condition: ${_formatCondition(item.condition)} · Multiplier: ${(item.conditionMultiplier! * 100).toStringAsFixed(0)}%',
            ),
          ],
          if (item.adjustedMaxUnitPriceNis != null) ...[
            const SizedBox(height: 6),
            Text(
              'Adjusted suggested/max price: ${item.adjustedMaxUnitPriceNis!.toStringAsFixed(2)} NIS',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ],
        ],
      ),
      footer: AppDialogFooter.decision(
        secondaryAction: TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        primaryAction: FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: AppStatusButtonStyle.filled(context, AppStatusTone.success),
          child: const Text('Approve'),
        ),
      ),
    ),
  );
  if (confirmed != true) return;

  try {
    await api.approvePriceRequest(id: item.id);
    ref.invalidate(adminApprovalsSummaryProvider);
    ref.invalidate(adminApprovalsPriceRequestsProvider);
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Price approved.')));
    }
  } on ApiException catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.displayMessage),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }
}

Future<void> _quickRejectPrice(
  BuildContext context,
  WidgetRef ref,
  AdminPriceRequestListItem item,
) async {
  final api = ref.read(adminApprovalsApiProvider);
  final reasonController = TextEditingController();
  final maxController = TextEditingController();

  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AppDialogShell(
      title: const Text('Reject price'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: reasonController,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Reason (required)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: maxController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Final allowed price for this condition (NIS)',
              helperText:
                  'This value is already condition-adjusted and will be sent to the supplier.',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Message preview: Maximum allowed price is <maxAllowedPrice> NIS.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
      footer: AppDialogFooter.decision(
        secondaryAction: TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        primaryAction: FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
          child: const Text('Reject'),
        ),
      ),
    ),
  );

  final reason = reasonController.text.trim();
  final maxRaw = maxController.text.trim();
  reasonController.dispose();
  maxController.dispose();
  if (!context.mounted) return;
  if (confirmed != true) return;
  final maxAllowed = double.tryParse(maxRaw);
  if (reason.length < 3 || maxAllowed == null || maxAllowed <= 0) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Reason and max allowed price are required.'),
        backgroundColor: Theme.of(context).colorScheme.error,
      ),
    );
    return;
  }

  try {
    await api.rejectPriceRequest(
      id: item.id,
      adminNote: reason,
      maxAllowedPrice: maxAllowed,
    );
    ref.invalidate(adminApprovalsSummaryProvider);
    ref.invalidate(adminApprovalsPriceRequestsProvider);
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Price rejected.')));
    }
  } on ApiException catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.displayMessage),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }
}

Future<void> _openCategoryDetails(
  BuildContext context,
  WidgetRef ref,
  AdminCategoryRequestListItem item,
) async {
  final api = ref.read(adminApprovalsApiProvider);
  final categoriesAsync = ref.read(materialCategoriesProvider.future);

  await showDialog<void>(
    context: context,
    builder: (context) {
      return _CategoryRequestDialog(
        item: item,
        api: api,
        categoriesFuture: categoriesAsync,
        onCompleted: () {
          ref.invalidate(adminApprovalsSummaryProvider);
          ref.invalidate(adminApprovalsCategoryRequestsProvider);
          ref.invalidate(materialCategoriesProvider);
        },
      );
    },
  );
}

Future<void> _openPriceDetails(
  BuildContext context,
  WidgetRef ref,
  AdminPriceRequestListItem item,
) async {
  final api = ref.read(adminApprovalsApiProvider);
  await showDialog<void>(
    context: context,
    builder: (context) => _PriceRequestDialog(
      item: item,
      api: api,
      onCompleted: () {
        ref.invalidate(adminApprovalsSummaryProvider);
        ref.invalidate(adminApprovalsPriceRequestsProvider);
      },
    ),
  );
}

class _CategoryRequestDialog extends StatefulWidget {
  const _CategoryRequestDialog({
    required this.item,
    required this.api,
    required this.categoriesFuture,
    required this.onCompleted,
  });

  final AdminCategoryRequestListItem item;
  final AdminApprovalsApi api;
  final Future<List<MaterialCategory>> categoriesFuture;
  final VoidCallback onCompleted;

  @override
  State<_CategoryRequestDialog> createState() => _CategoryRequestDialogState();
}

class _CategoryRequestDialogState extends State<_CategoryRequestDialog> {
  bool _submitting = false;

  Future<void> _approve() async {
    final controller = TextEditingController(text: widget.item.requestedName);
    final result = await showDialog<String?>(
      context: context,
      builder: (context) => AppDialogShell(
        title: const Text('Approve category request'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Final category name',
            border: OutlineInputBorder(),
          ),
        ),
        footer: AppDialogFooter.form(
          primaryAction: FilledButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            style: AppStatusButtonStyle.filled(context, AppStatusTone.success),
            child: const Text('Approve'),
          ),
        ),
      ),
    );
    controller.dispose();
    if (result == null || result.trim().isEmpty) return;

    setState(() => _submitting = true);
    try {
      await widget.api.approveCategoryRequest(
        id: widget.item.id,
        finalName: result,
      );
      if (!mounted) return;
      widget.onCompleted();
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Category request approved.')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.displayMessage),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  Future<void> _reject() async {
    final reasonController = TextEditingController();
    String? selectedCategoryId;

    final categories = await widget.categoriesFuture;
    if (!mounted) {
      reasonController.dispose();
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AppDialogShell(
        title: const Text('Reject category request'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: reasonController,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Reason (required)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: selectedCategoryId,
              items: [
                for (final c in categories)
                  DropdownMenuItem(value: c.id, child: Text(c.nameEn)),
              ],
              onChanged: (value) => selectedCategoryId = value,
              decoration: const InputDecoration(
                labelText: 'Suggested existing category (recommended)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        footer: AppDialogFooter.decision(
          secondaryAction: TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          primaryAction: FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
            child: const Text('Reject'),
          ),
        ),
      ),
    );

    final reason = reasonController.text.trim();
    reasonController.dispose();
    if (!mounted) return;
    if (confirmed != true) return;
    if (reason.length < 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Reason is required.'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
      return;
    }
    if (categories.isNotEmpty &&
        (selectedCategoryId == null || selectedCategoryId!.trim().isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Select a suggested existing category.'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await widget.api.rejectCategoryRequest(
        id: widget.item.id,
        adminNote: reason,
        suggestedCategoryId: selectedCategoryId,
      );
      if (!mounted) return;
      widget.onCompleted();
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Category request rejected.')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.displayMessage),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final item = widget.item;
    final supplierLabel = _supplierLabel(
      item.supplierOrganization,
      item.supplierName,
      item.supplierEmail,
    );
    final similarHint = item.similarCategories.isEmpty
        ? 'No suggested existing category'
        : item.similarCategories.join(', ');

    return AppDialogShell(
      title: const Text('Category request'),
      maxWidth: 660,
      closeEnabled: !_submitting,
      content: SizedBox(
        width: 620,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(item.requestedName, style: AdminTypography.pageTitle(palette)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text('Status', style: AdminTypography.kpiHelper(palette)),
                AppStatusBadge(
                  label: _formatApprovalStatus(item.status),
                  tone: reviewStatusTone(item.status),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _dialogKv('Supplier', supplierLabel),
            _dialogKv('Material', item.materialTitle ?? '—'),
            _dialogKv('Description', item.materialDescription ?? '—'),
            _dialogKv(
              'Quantity',
              item.quantity == null
                  ? '—'
                  : '${_formatQuantity(item.quantity!)} ${item.unit ?? ''}'
                        .trim(),
            ),
            _dialogKv('Condition', _formatCondition(item.condition)),
            _dialogKv('Location', item.locationLabel ?? '—'),
            _dialogKv('Reason', item.categoryRequestReason ?? '—'),
            _dialogKv('Similar categories', similarHint),
            if (item.adminNote?.trim().isNotEmpty == true) ...[
              const SizedBox(height: 8),
              Text('Admin note', style: AdminTypography.kpiHelper(palette)),
              const SizedBox(height: 4),
              Text(item.adminNote!.trim()),
            ],
          ],
        ),
      ),
      footer: AppDialogFooter.actions(
        actions: [
          OutlinedButton(
            onPressed: _submitting ? null : _reject,
            style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger),
            child: const Text('Reject'),
          ),
          FilledButton(
            onPressed: (_submitting || item.status.toUpperCase() != 'PENDING')
                ? null
                : _approve,
            style: AppStatusButtonStyle.filled(
              context,
              AppStatusTone.success,
              visualDensity: VisualDensity.compact,
            ),
            child: _submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Approve'),
          ),
        ],
      ),
    );
  }

  Widget _dialogKv(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: AppDialogInfoRow(label: label, value: value),
    );
  }
}

class _PriceRequestDialog extends StatefulWidget {
  const _PriceRequestDialog({
    required this.item,
    required this.api,
    required this.onCompleted,
  });

  final AdminPriceRequestListItem item;
  final AdminApprovalsApi api;
  final VoidCallback onCompleted;

  @override
  State<_PriceRequestDialog> createState() => _PriceRequestDialogState();
}

class _PriceRequestDialogState extends State<_PriceRequestDialog> {
  bool _submitting = false;

  Future<void> _approve() async {
    setState(() => _submitting = true);
    try {
      await widget.api.approvePriceRequest(id: widget.item.id);
      if (!mounted) return;
      widget.onCompleted();
      Navigator.of(context).pop();
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Price request approved.')));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.displayMessage),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  Future<void> _reject() async {
    final reasonController = TextEditingController();
    final maxController = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AppDialogShell(
        title: const Text('Reject price request'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: reasonController,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Reason (required)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: maxController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Final allowed price for this condition (NIS)',
                helperText:
                    'This value is already condition-adjusted and will be sent to the supplier.',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        footer: AppDialogFooter.decision(
          secondaryAction: TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          primaryAction: FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
            child: const Text('Reject'),
          ),
        ),
      ),
    );

    final reason = reasonController.text.trim();
    final maxRaw = maxController.text.trim();
    reasonController.dispose();
    maxController.dispose();
    if (!mounted) return;
    if (confirmed != true) return;

    final maxAllowed = double.tryParse(maxRaw);
    if (reason.length < 3 || maxAllowed == null || maxAllowed <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Reason and max allowed price are required.'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await widget.api.rejectPriceRequest(
        id: widget.item.id,
        adminNote: reason,
        maxAllowedPrice: maxAllowed,
      );
      if (!mounted) return;
      widget.onCompleted();
      Navigator.of(context).pop();
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Price request rejected.')));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.displayMessage),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString()),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final item = widget.item;

    return AppDialogShell(
      title: const Text('Price request'),
      maxWidth: 600,
      closeEnabled: !_submitting,
      content: SizedBox(
        width: 560,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              item.materialTitle ?? 'Unknown material',
              style: AdminTypography.pageTitle(palette),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text('Status', style: AdminTypography.kpiHelper(palette)),
                AppStatusBadge(
                  label: _formatApprovalStatus(item.status),
                  tone: reviewStatusTone(item.status),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _kv(
              'Supplier price',
              item.supplierPriceNis == null
                  ? '—'
                  : '${item.supplierPriceNis!.toStringAsFixed(2)} NIS',
            ),
            _kv(
              'AI/base suggested price',
              item.aiSuggestedMaxUnitPriceNis == null
                  ? 'AI/base suggestion unavailable'
                  : '${item.aiSuggestedMaxUnitPriceNis!.toStringAsFixed(2)} NIS (max unit)',
            ),
            _kv('Condition', _formatCondition(item.condition)),
            _kv(
              'Condition multiplier',
              item.conditionMultiplier == null
                  ? '—'
                  : '${(item.conditionMultiplier! * 100).toStringAsFixed(0)}%',
            ),
            _kv(
              'Adjusted suggested/max price',
              item.adjustedMaxUnitPriceNis == null
                  ? '—'
                  : '${item.adjustedMaxUnitPriceNis!.toStringAsFixed(2)} NIS',
            ),
            if (item.adminNote?.trim().isNotEmpty == true) ...[
              const SizedBox(height: 12),
              Text('Admin note', style: AdminTypography.kpiHelper(palette)),
              const SizedBox(height: 4),
              Text(item.adminNote!.trim()),
            ],
          ],
        ),
      ),
      footer: AppDialogFooter.actions(
        actions: [
          OutlinedButton(
            onPressed: _submitting ? null : _reject,
            style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger),
            child: const Text('Reject'),
          ),
          FilledButton(
            onPressed: (_submitting || item.status.toUpperCase() != 'PENDING')
                ? null
                : _approve,
            style: AppStatusButtonStyle.filled(
              context,
              AppStatusTone.success,
              visualDensity: VisualDensity.compact,
            ),
            child: _submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Approve'),
          ),
        ],
      ),
    );
  }

  Widget _kv(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: AppDialogInfoRow(label: label, value: value),
    );
  }
}
