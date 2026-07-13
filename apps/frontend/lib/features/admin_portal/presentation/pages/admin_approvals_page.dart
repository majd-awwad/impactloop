import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/errors/api_exception.dart';
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

class _ApprovalsFilters {
  const _ApprovalsFilters({
    required this.tab,
    required this.status,
    required this.search,
  });

  final String tab; // CATEGORY | PRICE
  final String status; // PENDING | APPROVED | REJECTED | ALL
  final String search;

  _ApprovalsFilters copyWith({String? tab, String? status, String? search}) {
    return _ApprovalsFilters(
      tab: tab ?? this.tab,
      status: status ?? this.status,
      search: search ?? this.search,
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
    );
  }

  void setTab(String tab) => state = state.copyWith(tab: tab, search: '');
  void setStatus(String status) => state = state.copyWith(status: status);
  void setSearch(String search) => state = state.copyWith(search: search);
  void reset() => state = const _ApprovalsFilters(
    tab: 'CATEGORY',
    status: 'PENDING',
    search: '',
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
        page: 1,
        limit: 50,
      );
});

final adminApprovalsPriceRequestsProvider = FutureProvider.autoDispose((ref) {
  final filters = ref.watch(_approvalsFiltersProvider);
  return ref
      .watch(adminApprovalsApiProvider)
      .fetchPriceRequests(
        status: filters.status,
        search: filters.search,
        page: 1,
        limit: 50,
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
        const SizedBox(height: 16),
        _SummaryRow(),
        const SizedBox(height: 18),
        _TabsRow(selected: filters.tab),
        const SizedBox(height: 12),
        _FiltersRow(
          key: ValueKey('${filters.tab}|${filters.status}|${filters.search}'),
        ),
        const SizedBox(height: 12),
        if (filters.tab == 'CATEGORY') const _CategoryRequestsPanel(),
        if (filters.tab == 'PRICE') const _PriceRequestsPanel(),
      ],
    );
  }
}

class _SummaryRow extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.adminPalette;
    final asyncSummary = ref.watch(adminApprovalsSummaryProvider);

    return asyncSummary.when(
      loading: () => const SizedBox(
        height: 64,
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
        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            _SummaryChip(
              label: 'Pending',
              count: summary.pendingTotal,
              color: AppStatusStyle.of(
                context,
                reviewStatusTone('PENDING'),
              ).foreground,
            ),
            _SummaryChip(
              label: 'Approved',
              count: summary.approvedTotal,
              color: AppStatusStyle.of(
                context,
                reviewStatusTone('APPROVED'),
              ).foreground,
            ),
            _SummaryChip(
              label: 'Rejected',
              count: summary.rejectedTotal,
              color: AppStatusStyle.of(
                context,
                reviewStatusTone('REJECTED'),
              ).foreground,
            ),
            _SummaryChip(
              label: 'Category',
              count: summary.categoryPending,
              color: palette.blue,
            ),
            _SummaryChip(
              label: 'Price',
              count: summary.pricePending,
              color: palette.purple,
            ),
          ],
        );
      },
    );
  }
}

class _SummaryChip extends StatelessWidget {
  const _SummaryChip({
    required this.label,
    required this.count,
    required this.color,
  });

  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: 14,
        vertical: 10,
      ),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text(
            '$count',
            style: AdminTypography.kpiValue(palette).copyWith(fontSize: 18),
          ),
          const SizedBox(width: 6),
          Text(label, style: AdminTypography.kpiHelper(palette)),
        ],
      ),
    );
  }
}

class _TabsRow extends ConsumerWidget {
  const _TabsRow({required this.selected});
  final String selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      width: double.infinity,
      child: SegmentedButton<String>(
        segments: const [
          ButtonSegment(
            value: 'CATEGORY',
            label: Text('Category Requests'),
            icon: Icon(Icons.category_outlined),
          ),
          ButtonSegment(
            value: 'PRICE',
            label: Text('Price Requests'),
            icon: Icon(Icons.price_check_outlined),
          ),
        ],
        selected: {selected},
        onSelectionChanged: (value) {
          ref.read(_approvalsFiltersProvider.notifier).setTab(value.first);
        },
      ),
    );
  }
}

class _FiltersRow extends ConsumerStatefulWidget {
  const _FiltersRow({super.key});

  @override
  ConsumerState<_FiltersRow> createState() => _FiltersRowState();
}

class _FiltersRowState extends ConsumerState<_FiltersRow> {
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
    final compact = MediaQuery.sizeOf(context).width < 560;

    final searchField = TextField(
      controller: _controller,
      decoration: const InputDecoration(
        prefixIcon: Icon(Icons.search),
        hintText: 'Search by supplier, material, category...',
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

    final resetButton = OutlinedButton(
      onPressed: () {
        _controller.clear();
        ref.read(_approvalsFiltersProvider.notifier).reset();
        ref.invalidate(adminApprovalsCategoryRequestsProvider);
        ref.invalidate(adminApprovalsPriceRequestsProvider);
        context.go('/admin/approvals');
      },
      child: const Text('Reset'),
    );

    final refreshButton = OutlinedButton.icon(
      onPressed: () {
        ref.invalidate(adminApprovalsSummaryProvider);
        ref.invalidate(adminApprovalsCategoryRequestsProvider);
        ref.invalidate(adminApprovalsPriceRequestsProvider);
      },
      icon: const Icon(Icons.refresh, size: 18),
      label: const Text('Refresh'),
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
          : Wrap(
              spacing: 10,
              runSpacing: 10,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(width: 280, child: searchField),
                SizedBox(width: 200, child: statusField),
                resetButton,
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
          children: [
            for (final item in response.items)
              _CategoryRequestCard(
                item: item,
                onDetails: () => _openCategoryDetails(context, ref, item),
                onApprove: () => _quickApproveCategory(context, ref, item),
                onReject: () => _quickRejectCategory(context, ref, item),
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
          children: [
            for (final item in response.items)
              _PriceRequestCard(
                item: item,
                onDetails: () => _openPriceDetails(context, ref, item),
                onApprove: () => _quickApprovePrice(context, ref, item),
                onReject: () => _quickRejectPrice(context, ref, item),
              ),
          ],
        );
      },
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
    final similarHint = item.similarCategories.isEmpty
        ? 'No suggested existing category'
        : 'Similar existing categories: ${item.similarCategories.join(', ')}';

    return _ApprovalCardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ApprovalCardHeader(
            title: item.requestedName,
            status: item.status,
            submittedLabel: dateFormat.format(item.createdAt),
            typeLabel: 'Category request',
            typeColor: palette.blue,
          ),
          const SizedBox(height: 10),
          Text(supplierLabel, style: AdminTypography.pageSubtitle(palette)),
          const SizedBox(height: 12),
          _InfoBlock(
            rows: [
              _InfoRow('Material', item.materialTitle ?? '—'),
              _InfoRow('Description', _truncate(item.materialDescription, 180)),
              _InfoRow(
                'Quantity',
                item.quantity == null
                    ? '—'
                    : '${_formatQuantity(item.quantity!)} ${item.unit ?? ''}'
                          .trim(),
              ),
              _InfoRow('Condition', _formatCondition(item.condition)),
              _InfoRow('Location', item.locationLabel ?? '—'),
              _InfoRow('Reason', item.categoryRequestReason ?? '—'),
            ],
          ),
          const SizedBox(height: 10),
          Text(similarHint, style: AdminTypography.kpiHelper(palette)),
          if (item.adminNote?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(
              'Admin note: ${item.adminNote!.trim()}',
              style: AdminTypography.kpiHelper(palette),
            ),
          ],
          const SizedBox(height: 12),
          _ApprovalActionRow(
            isPending: item.status.toUpperCase() == 'PENDING',
            onDetails: onDetails,
            onReject: onReject,
            onApprove: onApprove,
            rejectLabel: 'Reject',
            approveLabel: 'Approve',
          ),
        ],
      ),
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
    final supplierPrice = item.supplierPriceNis == null
        ? '—'
        : '${item.supplierPriceNis!.toStringAsFixed(2)} NIS per $unit';
    final aiSuggested = item.aiSuggestedMaxUnitPriceNis == null
        ? 'AI/base suggestion unavailable'
        : '${item.aiSuggestedMaxUnitPriceNis!.toStringAsFixed(2)} NIS max per $unit (base)';
    final multiplierLabel = item.conditionMultiplier == null
        ? '—'
        : '${(item.conditionMultiplier! * 100).toStringAsFixed(0)}%';
    final adjustedMax = item.adjustedMaxUnitPriceNis == null
        ? '—'
        : '${item.adjustedMaxUnitPriceNis!.toStringAsFixed(2)} NIS max per $unit';

    return _ApprovalCardShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ApprovalCardHeader(
            title: item.materialTitle ?? 'Unknown material',
            status: item.status,
            submittedLabel: dateFormat.format(item.createdAt),
            typeLabel: 'Price request',
            typeColor: palette.purple,
          ),
          const SizedBox(height: 10),
          Text(supplierLabel, style: AdminTypography.pageSubtitle(palette)),
          const SizedBox(height: 12),
          _InfoBlock(
            rows: [
              _InfoRow('Supplier price', supplierPrice),
              _InfoRow('AI/base suggested price', aiSuggested),
              _InfoRow('Condition multiplier', multiplierLabel),
              _InfoRow('Adjusted suggested/max price', adjustedMax),
              _InfoRow(
                'Quantity',
                item.quantity == null
                    ? '—'
                    : '${_formatQuantity(item.quantity!)} ${item.unit ?? ''}'
                          .trim(),
              ),
              _InfoRow('Condition', _formatCondition(item.condition)),
              _InfoRow('Category', item.categoryName ?? '—'),
            ],
          ),
          if (item.adminNote?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(
              'Admin note: ${item.adminNote!.trim()}',
              style: AdminTypography.kpiHelper(palette),
            ),
          ],
          const SizedBox(height: 12),
          _ApprovalActionRow(
            isPending: item.status.toUpperCase() == 'PENDING',
            onDetails: onDetails,
            onReject: onReject,
            onApprove: onApprove,
            rejectLabel: 'Reject price',
            approveLabel: 'Approve price',
          ),
        ],
      ),
    );
  }
}

class _ApprovalCardShell extends StatelessWidget {
  const _ApprovalCardShell({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: palette.cardBackground,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: palette.cardBorder),
        ),
        child: child,
      ),
    );
  }
}

class _ApprovalCardHeader extends StatelessWidget {
  const _ApprovalCardHeader({
    required this.title,
    required this.status,
    required this.submittedLabel,
    required this.typeLabel,
    required this.typeColor,
  });

  final String title;
  final String status;
  final String submittedLabel;
  final String typeLabel;
  final Color typeColor;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Column(
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
                ).copyWith(fontSize: 18),
              ),
            ),
            const SizedBox(width: 10),
            AppStatusBadge(
              label: status.toUpperCase(),
              tone: reviewStatusTone(status),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            _TypeBadge(label: typeLabel, color: typeColor),
            Text(
              'Submitted $submittedLabel',
              style: AdminTypography.kpiHelper(palette),
            ),
          ],
        ),
      ],
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

class _InfoRow {
  const _InfoRow(this.label, this.value);

  final String label;
  final String value;
}

class _InfoBlock extends StatelessWidget {
  const _InfoBlock({required this.rows});

  final List<_InfoRow> rows;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: palette.pageBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 108,
                  child: Text(
                    rows[i].label,
                    style: AdminTypography.kpiHelper(palette),
                  ),
                ),
                Expanded(
                  child: Text(
                    rows[i].value,
                    style: AdminTypography.pageSubtitle(palette),
                  ),
                ),
              ],
            ),
          ],
        ],
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
            Text(
              'Status: ${item.status}',
              style: AdminTypography.pageSubtitle(palette),
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
      footer: Wrap(
        alignment: WrapAlignment.end,
        spacing: 8,
        runSpacing: 8,
        children: [
          TextButton(
            onPressed: _submitting ? null : _reject,
            style: AppStatusButtonStyle.text(context, AppStatusTone.danger),
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
    final palette = context.adminPalette;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(label, style: AdminTypography.kpiHelper(palette)),
          ),
          Expanded(
            child: Text(value, style: AdminTypography.pageSubtitle(palette)),
          ),
        ],
      ),
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
            Text(
              'Status: ${item.status}',
              style: AdminTypography.pageSubtitle(palette),
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
      footer: Wrap(
        alignment: WrapAlignment.end,
        spacing: 8,
        runSpacing: 8,
        children: [
          TextButton(
            onPressed: _submitting ? null : _reject,
            style: AppStatusButtonStyle.text(context, AppStatusTone.danger),
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
    final palette = context.adminPalette;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 130,
            child: Text(label, style: AdminTypography.kpiHelper(palette)),
          ),
          Expanded(
            child: Text(value, style: AdminTypography.pageSubtitle(palette)),
          ),
        ],
      ),
    );
  }
}
