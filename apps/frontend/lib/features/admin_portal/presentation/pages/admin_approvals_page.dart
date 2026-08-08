import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_close_button.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/review_status_presentation.dart';
import '../../../materials/application/material_listing_providers.dart';
import '../../data/admin_approvals_api.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import '../theme/admin_palette.dart';
import '../widgets/admin_empty_state.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;
import '../widgets/category_request_approval_dialog.dart';

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
    final l = AdminL10n.of(context);
    final filters = ref.watch(_approvalsFiltersProvider);

    return ListView(
      padding: const EdgeInsetsDirectional.only(bottom: 24),
      children: [
        Text(
          l.t('Approvals', 'الموافقات'),
          style: AdminTypography.pageTitle(palette),
        ),
        const SizedBox(height: 6),
        Text(
          l.t(
            'Review supplier requests for new categories and price approvals before they affect the marketplace.',
            'راجع طلبات الموردين للفئات الجديدة وموافقات الأسعار قبل أن تؤثر في المنصة.',
          ),
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
    final l = AdminL10n.of(context);
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
              child: Text(AdminL10n.of(context).retry),
            ),
          ],
        ),
      ),
      data: (summary) {
        final tiles = [
          _ApprovalKpiTile(
            label: l.t('All pending approvals', 'جميع الموافقات المعلّقة'),
            value: summary.pendingTotal,
            icon: Icons.outlined_flag,
            color: palette.amber,
          ),
          _ApprovalKpiTile(
            label: l.t('Approved', 'تمت الموافقة'),
            value: summary.approvedTotal,
            icon: Icons.check_circle_outline,
            color: palette.green,
          ),
          _ApprovalKpiTile(
            label: l.t('Rejected', 'مرفوضة'),
            value: summary.rejectedTotal,
            icon: Icons.cancel_outlined,
            color: palette.red,
          ),
          _ApprovalKpiTile(
            label: l.t('Pending category requests', 'طلبات الفئات المعلّقة'),
            value: summary.categoryPending,
            icon: Icons.sell_outlined,
            color: palette.blue,
          ),
          _ApprovalKpiTile(
            label: l.t('Pending price requests', 'طلبات الأسعار المعلّقة'),
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
    final l = AdminL10n.of(context);

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
                    Text(
                      l.t('Requests', 'طلبات'),
                      style: AdminTypography.kpiHelper(palette),
                    ),
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
    final l = AdminL10n.of(context);

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
              label: l.t('Category requests', 'طلبات الفئات'),
              icon: Icons.category_outlined,
              isSelected: selected == 'CATEGORY',
              onTap: () => select('CATEGORY'),
            ),
          ),
          Container(width: 1, height: 26, color: palette.cardBorder),
          Expanded(
            child: _ApprovalsTabItem(
              label: l.t('Price requests', 'طلبات الأسعار'),
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
    final l = AdminL10n.of(context);
    final filters = ref.watch(_approvalsFiltersProvider);
    final compact = MediaQuery.sizeOf(context).width < 640;

    final searchField = TextField(
      controller: _controller,
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.search),
        hintText: l.t(
          'Search by supplier or material…',
          'ابحث حسب المورد أو المادة…',
        ),
        border: const OutlineInputBorder(),
        isDense: true,
      ),
      onSubmitted: (value) =>
          ref.read(_approvalsFiltersProvider.notifier).setSearch(value),
    );

    final statusField = DropdownButtonFormField<String>(
      isExpanded: true,
      initialValue: filters.status,
      items: [
        DropdownMenuItem(
          value: 'PENDING',
          child: Text(l.t('Pending', 'معلّق')),
        ),
        DropdownMenuItem(
          value: 'APPROVED',
          child: Text(l.t('Approved', 'تمت الموافقة')),
        ),
        DropdownMenuItem(
          value: 'REJECTED',
          child: Text(l.t('Rejected', 'مرفوض')),
        ),
        DropdownMenuItem(value: 'ALL', child: Text(l.t('All', 'الكل'))),
      ],
      decoration: InputDecoration(
        labelText: l.status,
        border: const OutlineInputBorder(),
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
      label: Text(l.t('Reset', 'إعادة ضبط')),
      style: OutlinedButton.styleFrom(foregroundColor: palette.textSecondary),
    );

    final refreshButton = OutlinedButton.icon(
      onPressed: () {
        ref.invalidate(adminApprovalsSummaryProvider);
        ref.invalidate(adminApprovalsCategoryRequestsProvider);
        ref.invalidate(adminApprovalsPriceRequestsProvider);
      },
      icon: Icon(Icons.refresh, size: 18, color: palette.primaryTeal),
      label: Text(
        l.t('Refresh', 'تحديث'),
        style: TextStyle(color: palette.primaryTeal),
      ),
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
              child: Text(AdminL10n.of(context).retry),
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
              child: Text(AdminL10n.of(context).retry),
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
    final l = AdminL10n.of(context);
    final dateFormat = DateFormat.yMMMd();
    final supplierLabel = _supplierLabel(
      item.supplierOrganization,
      item.supplierName,
      item.supplierEmail,
    );
    final suggested = item.suggestedCategory;
    final suggestedCategory = suggested == null
        ? l.noSimilarCategories
        : (l.isArabic ? suggested.nameAr : suggested.nameEn);

    final keyFacts = <Widget>[
      if (item.materialTitle?.trim().isNotEmpty == true)
        _ApprovalKeyFact(label: l.material, value: item.materialTitle!),
      _ApprovalKeyFact(
        label: l.suggestedExistingCategory,
        value: suggestedCategory,
        onTap: suggested == null ? null : onApprove,
        actionLabel: suggested == null
            ? l.t('Unavailable', 'غير متاحة')
            : l.useThisCategory,
      ),
    ];

    final reason = item.categoryRequestReason?.trim();

    return _ApprovalCard(
      cardKey: Key('category-request-card-${item.id}'),
      icon: Icons.category_outlined,
      iconColor: palette.blue,
      title: item.requestedName,
      typeLabel: l.categoryRequest,
      typeColor: palette.blue,
      submittedLabel: dateFormat.format(item.createdAt),
      supplierLabel: supplierLabel,
      status: item.status,
      keyFacts: keyFacts,
      secondaryLine: reason?.isNotEmpty == true
          ? '${l.reason}: ${_truncate(reason, 140)}'
          : null,
      onDetails: onDetails,
      onApprove: onApprove,
      onReject: onReject,
      approveLabel: l.resolveCategoryRequest,
      rejectLabel: l.reject,
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
    this.cardKey,
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

  final Key? cardKey;
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
      key: cardKey,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
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
            width: 46,
            height: 46,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: palette.isDark ? 0.2 : 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, size: 24, color: iconColor),
          ),
          const SizedBox(width: 12),
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
                  const SizedBox(height: 9),
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
                const SizedBox(height: 10),
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
  const _ApprovalKeyFact({
    required this.label,
    required this.value,
    this.onTap,
    this.actionLabel,
  });

  final String label;
  final String value;
  final VoidCallback? onTap;
  final String? actionLabel;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final content = Container(
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
          if (actionLabel != null) ...[
            const SizedBox(width: 6),
            Text(
              actionLabel!,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: onTap == null ? palette.textMuted : palette.primaryTeal,
              ),
            ),
          ],
        ],
      ),
    );
    return onTap == null
        ? content
        : InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(10),
            child: content,
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
) => _openCategoryDetails(context, ref, item);

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
    builder: (dialogContext) {
      final l = AdminL10n.of(dialogContext);
      return AppDialogShell(
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
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: Text(l.cancel),
        ),
        primaryAction: FilledButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          style: AppStatusButtonStyle.filled(dialogContext, AppStatusTone.danger),
          child: Text(l.reject),
        ),
      ),
    );
    },
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
          child: Text(AdminL10n.of(context).cancel),
        ),
        primaryAction: FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: AppStatusButtonStyle.filled(context, AppStatusTone.success),
          child: Text(AdminL10n.of(context).approve),
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
          child: Text(AdminL10n.of(context).cancel),
        ),
        primaryAction: FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
          child: Text(AdminL10n.of(context).reject),
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

  await showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (context) {
      return CategoryRequestApprovalDialog(
        item: item,
        api: api,
        onCompleted: () {
          ref.invalidate(adminApprovalsSummaryProvider);
          ref.invalidate(adminApprovalsCategoryRequestsProvider);
          ref.invalidate(materialCategoriesProvider);
          ref.invalidate(adminMaterialCategoryOptionsProvider);
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

class _MetaDivider extends StatelessWidget {
  const _MetaDivider({required this.palette});

  final AdminPalette palette;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Container(width: 1, height: 36, color: palette.cardBorder),
    );
  }
}

/// Icon tile + muted label + value used by the metadata strip and the
/// request summary card.
class _MetadataItem extends StatelessWidget {
  const _MetadataItem({
    required this.icon,
    required this.tone,
    required this.label,
    this.value,
    this.valueWidget,
  });

  final IconData icon;
  final AppStatusTone tone;
  final String label;
  final String? value;
  final Widget? valueWidget;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final style = AppStatusStyle.of(context, tone);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: style.background,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 17, color: style.foreground),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(label, style: AdminTypography.kpiHelper(palette)),
              const SizedBox(height: 4),
              valueWidget ??
                  Text(
                    value ?? '—',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: palette.textPrimary,
                      height: 1.35,
                    ),
                  ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DialogSectionCard extends StatelessWidget {
  const _DialogSectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AdminTypography.sectionTitle(palette)),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

/// Compact label/value row for the Request details card. When [pillTone]
/// is provided (and the value is not a missing-value dash), the value is
/// rendered as a small semantic pill instead of plain text.
class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.isLast = false,
    this.pillTone,
  });

  final String label;
  final String value;
  final bool isLast;
  final AppStatusTone? pillTone;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final showPill = pillTone != null && value.trim() != '—';

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 11),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : Border(
                bottom: BorderSide(
                  color: palette.cardBorder.withValues(alpha: 0.6),
                ),
              ),
      ),
      child: Row(
        children: [
          Text(
            label,
            style: AdminTypography.kpiHelper(palette).copyWith(fontSize: 13),
          ),
          const Spacer(),
          Flexible(
            child: Align(
              alignment: AlignmentDirectional.centerEnd,
              child: showPill
                  ? _InlinePricePill(label: value, tone: pillTone!)
                  : Text(
                      value,
                      textAlign: TextAlign.right,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: palette.textPrimary,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Small pill used to highlight important price/condition values inside
/// label/value rows (e.g. "Used", "22.50 NIS").
class _InlinePricePill extends StatelessWidget {
  const _InlinePricePill({required this.label, required this.tone});

  final String label;
  final AppStatusTone tone;

  @override
  Widget build(BuildContext context) {
    final style = AppStatusStyle.of(context, tone);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: style.border),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w800,
          color: style.foreground,
        ),
      ),
    );
  }
}

String _dashOr(String? value) {
  final trimmed = value?.trim() ?? '';
  return trimmed.isEmpty ? '—' : trimmed;
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
            child: Text(AdminL10n.of(context).cancel),
          ),
          primaryAction: FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: AppStatusButtonStyle.filled(context, AppStatusTone.danger),
            child: Text(AdminL10n.of(context).reject),
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

  void _closeDialog() {
    if (_submitting) return;
    Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final colors = AppThemeColors.of(context);
    final item = widget.item;
    final supplierLabel = _supplierLabel(
      item.supplierOrganization,
      item.supplierName,
      item.supplierEmail,
    );
    final screenSize = MediaQuery.sizeOf(context);
    final maxDialogWidth = (screenSize.width - 48).clamp(280.0, 940.0);

    return Dialog(
      backgroundColor: palette.cardBackground,
      elevation: 12,
      shadowColor: colors.shadow,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
        side: BorderSide(color: palette.cardBorder),
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: maxDialogWidth,
          maxHeight: screenSize.height * 0.88,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _PriceDialogHeader(item: item, onClose: _closeDialog),
            const SizedBox(height: 20),
            _PriceMetadataStrip(item: item, supplierLabel: supplierLabel),
            const SizedBox(height: 18),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(32, 0, 32, 4),
                child: _PriceDialogBody(
                  item: item,
                  supplierLabel: supplierLabel,
                ),
              ),
            ),
            const SizedBox(height: 4),
            _PriceDialogFooter(
              submitting: _submitting,
              canDecide: item.status.toUpperCase() == 'PENDING',
              onClose: _closeDialog,
              onReject: _reject,
              onApprove: _approve,
            ),
          ],
        ),
      ),
    );
  }
}

/// Header: purple price-tag icon tile + "Price request" title + close
/// button, followed by the material title and its status badge inline.
class _PriceDialogHeader extends StatelessWidget {
  const _PriceDialogHeader({required this.item, required this.onClose});

  final AdminPriceRequestListItem item;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 28, 32, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 52,
                height: 52,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: palette.purple.withValues(
                    alpha: palette.isDark ? 0.2 : 0.12,
                  ),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Icon(
                  Icons.sell_outlined,
                  size: 24,
                  color: palette.purple,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  'Price request',
                  style: AdminTypography.sectionTitle(
                    palette,
                  ).copyWith(fontSize: 18),
                ),
              ),
              AppCloseButton(onPressed: onClose, tooltip: 'Close'),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 10,
            runSpacing: 6,
            children: [
              Text(
                item.materialTitle ?? 'Unknown material',
                style: AdminTypography.pageTitle(
                  palette,
                ).copyWith(fontSize: 21),
              ),
              AppStatusBadge(
                label: _formatApprovalStatus(item.status),
                tone: reviewStatusTone(item.status),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Horizontal three-section strip: Status | Supplier | Material category.
class _PriceMetadataStrip extends StatelessWidget {
  const _PriceMetadataStrip({required this.item, required this.supplierLabel});

  final AdminPriceRequestListItem item;
  final String supplierLabel;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final l = AdminL10n.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        decoration: BoxDecoration(
          color: palette.cardBackground,
          borderRadius: BorderRadius.circular(15),
          border: Border.all(color: palette.cardBorder),
          boxShadow: [
            BoxShadow(
              color: palette.cardShadow,
              blurRadius: palette.isDark ? 12 : 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final items = [
              _MetadataItem(
                icon: Icons.access_time_rounded,
                tone: AppStatusTone.warning,
                label: l.status,
                valueWidget: AppStatusBadge(
                  label: _formatApprovalStatus(item.status),
                  tone: reviewStatusTone(item.status),
                ),
              ),
              _MetadataItem(
                icon: Icons.storefront_outlined,
                tone: AppStatusTone.info,
                label: 'Supplier',
                value: supplierLabel,
              ),
              _MetadataItem(
                icon: Icons.widgets_outlined,
                tone: AppStatusTone.success,
                label: 'Material category',
                value: _dashOr(item.categoryName),
              ),
            ];

            if (constraints.maxWidth < 480) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var i = 0; i < items.length; i++) ...[
                    if (i > 0) const SizedBox(height: 14),
                    items[i],
                  ],
                ],
              );
            }

            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: items[0]),
                _MetaDivider(palette: palette),
                Expanded(child: items[1]),
                _MetaDivider(palette: palette),
                Expanded(child: items[2]),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Real-value-only comparison between the supplier's requested price and
/// the admin-adjusted suggested maximum for this condition.
class _PriceComparison {
  const _PriceComparison({this.supplierPrice, this.adjustedMax});

  final double? supplierPrice;
  final double? adjustedMax;

  factory _PriceComparison.fromItem(AdminPriceRequestListItem item) {
    return _PriceComparison(
      supplierPrice: item.supplierPriceNis,
      adjustedMax: item.adjustedMaxUnitPriceNis,
    );
  }

  bool get hasComparison =>
      supplierPrice != null && adjustedMax != null && adjustedMax! > 0;

  double? get difference =>
      hasComparison ? supplierPrice! - adjustedMax! : null;

  bool get exceedsMax => hasComparison && difference! > 0;

  double? get percentAboveMax =>
      hasComparison ? (difference! / adjustedMax!) * 100 : null;

  double? get fillRatio {
    if (!hasComparison || supplierPrice! <= 0) return null;
    return (adjustedMax! / supplierPrice!).clamp(0.0, 1.0);
  }
}

/// Two-column desktop body: Price details/comparison/guidance on the left,
/// Request summary/warning/decision risk on the right. Stacks on narrow
/// widths.
class _PriceDialogBody extends StatelessWidget {
  const _PriceDialogBody({required this.item, required this.supplierLabel});

  final AdminPriceRequestListItem item;
  final String supplierLabel;

  @override
  Widget build(BuildContext context) {
    final unit = item.unit?.trim();
    final quantityValue = item.quantity == null
        ? '—'
        : '${_formatQuantity(item.quantity!)}${unit != null && unit.isNotEmpty ? ' $unit' : ''}';
    final comparison = _PriceComparison.fromItem(item);

    final leftColumn = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _DialogSectionCard(
          title: 'Price details',
          child: Column(
            children: [
              _DetailRow(
                label: 'Supplier price',
                value: _formatMoney(item.supplierPriceNis),
                pillTone: AppStatusTone.neutral,
              ),
              _DetailRow(
                label: 'AI / base suggested price',
                value: item.aiSuggestedMaxUnitPriceNis == null
                    ? '—'
                    : '${_formatMoney(item.aiSuggestedMaxUnitPriceNis)} (max unit)',
              ),
              _DetailRow(
                label: 'Condition',
                value: _formatCondition(item.condition),
                pillTone: AppStatusTone.neutral,
              ),
              _DetailRow(
                label: 'Condition multiplier',
                value: item.conditionMultiplier == null
                    ? '—'
                    : '${(item.conditionMultiplier! * 100).toStringAsFixed(0)}%',
              ),
              _DetailRow(
                label: 'Adjusted suggested / max price',
                value: _formatMoney(item.adjustedMaxUnitPriceNis),
                pillTone: AppStatusTone.success,
              ),
              _DetailRow(label: 'Quantity', value: quantityValue, isLast: true),
              const SizedBox(height: 18),
              _PriceComparisonSection(comparison: comparison),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const _PriceAdminGuidanceCard(),
      ],
    );

    final rightColumn = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PriceRequestSummaryCard(item: item, supplierLabel: supplierLabel),
        if (comparison.hasComparison) ...[
          const SizedBox(height: 16),
          _PriceWarningCard(comparison: comparison),
          const SizedBox(height: 16),
          _DecisionRiskCard(comparison: comparison),
        ],
      ],
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 700) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [leftColumn, const SizedBox(height: 16), rightColumn],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(flex: 11, child: leftColumn),
            const SizedBox(width: 18),
            Expanded(flex: 10, child: rightColumn),
          ],
        );
      },
    );
  }
}

/// "Price comparison (per unit)" block: side-by-side values, a simple
/// proportional bar, and a difference line — all derived from real values.
class _PriceComparisonSection extends StatelessWidget {
  const _PriceComparisonSection({required this.comparison});

  final _PriceComparison comparison;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Price comparison (per unit)',
          style: AdminTypography.sectionTitle(palette).copyWith(fontSize: 13.5),
        ),
        const SizedBox(height: 14),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Supplier price',
                    style: AdminTypography.kpiHelper(palette),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _formatMoney(comparison.supplierPrice),
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: palette.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text('vs.', style: AdminTypography.kpiHelper(palette)),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'Suggested max price',
                    textAlign: TextAlign.right,
                    style: AdminTypography.kpiHelper(palette),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _formatMoney(comparison.adjustedMax),
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: palette.green,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _PriceComparisonBar(comparison: comparison),
        const SizedBox(height: 10),
        _PriceDifferenceLine(comparison: comparison),
      ],
    );
  }
}

/// Simple two-tone proportional bar (no chart package): the filled segment
/// represents the adjusted max as a share of the requested price, with the
/// remainder highlighted in danger tone when the request exceeds that max.
class _PriceComparisonBar extends StatelessWidget {
  const _PriceComparisonBar({required this.comparison});

  final _PriceComparison comparison;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final ratio = comparison.fillRatio;

    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: SizedBox(
        height: 8,
        child: ratio == null
            ? Container(color: palette.cardBorder)
            : Row(
                children: [
                  Expanded(
                    flex: (ratio * 1000).round().clamp(1, 1000),
                    child: Container(color: palette.green),
                  ),
                  if (comparison.exceedsMax)
                    Expanded(
                      flex: (1000 - (ratio * 1000).round()).clamp(1, 1000),
                      child: Container(color: palette.red),
                    ),
                ],
              ),
      ),
    );
  }
}

/// "Difference: X.XX NIS (Y% higher/lower)" line, danger-toned only when
/// the requested price exceeds the adjusted maximum.
class _PriceDifferenceLine extends StatelessWidget {
  const _PriceDifferenceLine({required this.comparison});

  final _PriceComparison comparison;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    if (!comparison.hasComparison) {
      return Text('Difference: —', style: AdminTypography.kpiHelper(palette));
    }

    final diff = comparison.difference!.abs();
    final percent = comparison.percentAboveMax?.abs();
    final direction = comparison.exceedsMax ? 'higher' : 'lower';
    final percentLabel = percent == null
        ? ''
        : ' (${percent.toStringAsFixed(0)}% $direction)';
    final color = comparison.exceedsMax ? palette.red : palette.green;

    return RichText(
      text: TextSpan(
        style: AdminTypography.kpiHelper(palette),
        children: [
          const TextSpan(text: 'Difference: '),
          TextSpan(
            text: '${diff.toStringAsFixed(2)} NIS$percentLabel',
            style: TextStyle(fontWeight: FontWeight.w800, color: color),
          ),
        ],
      ),
    );
  }
}

/// Static moderation guidance — compact info-toned card.
class _PriceAdminGuidanceCard extends StatelessWidget {
  const _PriceAdminGuidanceCard();

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final style = AppStatusStyle.of(context, AppStatusTone.info);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.pageBackground,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: style.background,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(Icons.info_outline, size: 17, color: style.foreground),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Admin guidance',
                  style: AdminTypography.sectionTitle(
                    palette,
                  ).copyWith(fontSize: 13.5),
                ),
                const SizedBox(height: 6),
                Text(
                  'Approve if the requested price is justified by condition '
                  'and market context; reject if it significantly exceeds '
                  'the adjusted recommendation.',
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.4,
                    color: palette.textSecondary,
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

/// "Request summary" card: submitted-by/on plus the two key price values.
class _PriceRequestSummaryCard extends StatelessWidget {
  const _PriceRequestSummaryCard({
    required this.item,
    required this.supplierLabel,
  });

  final AdminPriceRequestListItem item;
  final String supplierLabel;

  @override
  Widget build(BuildContext context) {
    return _DialogSectionCard(
      title: 'Request summary',
      child: Column(
        children: [
          _DetailRow(label: 'Submitted by', value: supplierLabel),
          _DetailRow(
            label: 'Submitted on',
            value: DateFormat.yMMMd().add_jm().format(item.createdAt),
          ),
          _DetailRow(
            label: 'Requested price (per unit)',
            value: _formatMoney(item.supplierPriceNis),
            pillTone: AppStatusTone.neutral,
          ),
          _DetailRow(
            label: 'Adjusted suggested max',
            value: _formatMoney(item.adjustedMaxUnitPriceNis),
            pillTone: AppStatusTone.success,
            isLast: true,
          ),
        ],
      ),
    );
  }
}

/// Compact warning (or success, when within range) card summarizing
/// whether the requested price exceeds the adjusted maximum.
class _PriceWarningCard extends StatelessWidget {
  const _PriceWarningCard({required this.comparison});

  final _PriceComparison comparison;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final exceeds = comparison.exceedsMax;
    final tone = exceeds ? AppStatusTone.warning : AppStatusTone.success;
    final style = AppStatusStyle.of(context, tone);
    final diff = comparison.difference!.abs();
    final percent = comparison.percentAboveMax?.abs();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: style.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: style.background,
              shape: BoxShape.circle,
              border: Border.all(color: style.border),
            ),
            child: Icon(
              exceeds ? Icons.trending_up : Icons.check_circle_outline,
              size: 17,
              color: style.foreground,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  exceeds
                      ? 'Requested price exceeds recommended max'
                      : 'Requested price is within the recommended range',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: palette.textPrimary,
                  ),
                ),
                if (exceeds && percent != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    'by ${diff.toStringAsFixed(2)} NIS (${percent.toStringAsFixed(0)}%)',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: style.foreground,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          AppStatusBadge(
            label: exceeds ? 'Needs review' : 'Looks good',
            tone: tone,
          ),
        ],
      ),
    );
  }
}

/// Compact card explaining the approval risk implied by the price
/// comparison. Text only — omits any non-functional "Learn more" action.
class _DecisionRiskCard extends StatelessWidget {
  const _DecisionRiskCard({required this.comparison});

  final _PriceComparison comparison;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final percent = comparison.percentAboveMax;
    final AppStatusTone tone;
    final String message;

    if (!comparison.exceedsMax) {
      tone = AppStatusTone.success;
      message =
          'The requested price is within the recommended range, which '
          'keeps approval risk low.';
    } else if (percent != null && percent > 20) {
      tone = AppStatusTone.warning;
      message =
          'Approving a price significantly above the adjusted '
          'recommendation may increase costs and set an unfavorable '
          'precedent.';
    } else {
      tone = AppStatusTone.neutral;
      message =
          'The requested price is close to the recommended maximum — '
          'review the condition and market context before approving.';
    }

    final style = AppStatusStyle.of(context, tone);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: style.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: style.background,
              shape: BoxShape.circle,
              border: Border.all(color: style.border),
            ),
            child: Icon(
              Icons.shield_outlined,
              size: 17,
              color: style.foreground,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Decision risk',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: palette.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  message,
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.4,
                    color: palette.textSecondary,
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

/// Fixed footer: Close, Reject price, and Approve price actions aligned to
/// the end (stacked on very narrow widths).
class _PriceDialogFooter extends StatelessWidget {
  const _PriceDialogFooter({
    required this.submitting,
    required this.canDecide,
    required this.onClose,
    required this.onReject,
    required this.onApprove,
  });

  final bool submitting;
  final bool canDecide;
  final VoidCallback onClose;
  final VoidCallback onReject;
  final VoidCallback onApprove;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final colors = AppThemeColors.of(context);
    final dangerColor = AppStatusStyle.of(
      context,
      AppStatusTone.danger,
    ).foreground;

    final l = AdminL10n.of(context);
    final closeButton = SizedBox(
      height: 46,
      child: OutlinedButton(
        onPressed: submitting ? null : onClose,
        style: OutlinedButton.styleFrom(
          foregroundColor: palette.textSecondary,
          side: BorderSide(color: palette.cardBorder),
          padding: const EdgeInsets.symmetric(horizontal: 22),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        child: Text(l.close),
      ),
    );

    final rejectButton = SizedBox(
      height: 46,
      child: OutlinedButton.icon(
        onPressed: (submitting || !canDecide) ? null : onReject,
        icon: Icon(Icons.close, size: 16, color: dangerColor),
        label: const Text('Reject price'),
        style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger)
            .copyWith(
              padding: WidgetStateProperty.all(
                const EdgeInsets.symmetric(horizontal: 20),
              ),
              shape: WidgetStateProperty.all(
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
      ),
    );

    final approveButton = SizedBox(
      height: 46,
      child: FilledButton(
        onPressed: (submitting || !canDecide) ? null : onApprove,
        style: AppStatusButtonStyle.filled(context, AppStatusTone.success)
            .copyWith(
              padding: WidgetStateProperty.all(
                const EdgeInsets.symmetric(horizontal: 20),
              ),
              shape: WidgetStateProperty.all(
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
        child: submitting
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: colors.textOnPrimary,
                ),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check, size: 16, color: colors.textOnPrimary),
                  const SizedBox(width: 6),
                  const Text('Approve price'),
                ],
              ),
      ),
    );

    return Container(
      padding: const EdgeInsets.fromLTRB(24, 18, 24, 20),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: palette.cardBorder)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth < 520) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                approveButton,
                const SizedBox(height: 10),
                rejectButton,
                const SizedBox(height: 10),
                closeButton,
              ],
            );
          }

          return Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              closeButton,
              const SizedBox(width: 12),
              rejectButton,
              const SizedBox(width: 12),
              approveButton,
            ],
          );
        },
      ),
    );
  }
}

String _formatMoney(double? value) {
  if (value == null) return '—';
  return '${value.toStringAsFixed(2)} NIS';
}
