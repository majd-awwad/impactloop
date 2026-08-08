import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_dialog_detail.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/supplier_verification_status_presentation.dart';
import '../../data/admin_supplier_verifications_api.dart';
import '../../data/admin_verification_document_open.dart';
import '../../data/models/admin_supplier_verifications_models.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import '../widgets/admin_empty_state.dart';
import '../widgets/admin_kpi_card.dart' show AdminKpiCard, AdminTypography;

class AdminSupplierVerificationPage extends ConsumerWidget {
  const AdminSupplierVerificationPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final asyncData = ref.watch(adminSupplierVerificationsProvider);

    return asyncData.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
            AdminL10n.of(context).localizedError(error),
              style: AdminTypography.pageSubtitle(palette),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () =>
                  ref.invalidate(adminSupplierVerificationsProvider),
              child: Text(l.retry),
            ),
          ],
        ),
      ),
      data: (response) => _VerificationBody(response: response),
    );
  }
}

class _VerificationBody extends ConsumerStatefulWidget {
  const _VerificationBody({required this.response});

  final AdminSupplierVerificationListResponse response;

  @override
  ConsumerState<_VerificationBody> createState() => _VerificationBodyState();
}

class _VerificationBodyState extends ConsumerState<_VerificationBody> {
  final _searchController = TextEditingController();
  final _cityController = TextEditingController();
  String _statusFilter = 'ALL';
  String _typeFilter = 'ALL';

  @override
  void initState() {
    super.initState();
    final filters = ref.read(adminSupplierVerificationFiltersProvider);
    _searchController.text = filters.search;
    _cityController.text = filters.city;
    _statusFilter = filters.status;
    _typeFilter = filters.supplierType;
  }

  @override
  void dispose() {
    _searchController.dispose();
    _cityController.dispose();
    super.dispose();
  }

  void _applyFilters() {
    ref
        .read(adminSupplierVerificationFiltersProvider.notifier)
        .updateFilters(
          AdminSupplierVerificationFilters(
            search: _searchController.text,
            status: _statusFilter,
            supplierType: _typeFilter,
            city: _cityController.text,
            page: 1,
          ),
        );
  }

  void _resetFilters() {
    setState(() {
      _searchController.clear();
      _cityController.clear();
      _statusFilter = 'ALL';
      _typeFilter = 'ALL';
    });
    ref
        .read(adminSupplierVerificationFiltersProvider.notifier)
        .updateFilters(const AdminSupplierVerificationFilters());
  }

  Future<void> _openDetails(AdminSupplierVerificationListItem item) async {
    await showDialog<void>(
      context: context,
      builder: (context) => _VerificationDetailsDialog(
        supplierProfileId: item.supplierProfileId,
        onActionCompleted: () {
          ref.invalidate(adminSupplierVerificationsProvider);
        },
      ),
    );
  }

  Future<void> _runQuickAction({
    required AdminSupplierVerificationListItem item,
    required String action,
  }) async {
    try {
      if (action == 'approve') {
        final confirmed = await _confirmApprove(context);
        if (!confirmed || !mounted) return;

        final api = ref.read(adminSupplierVerificationsApiProvider);
        await api.approveVerification(id: item.supplierProfileId);
        if (!mounted) return;
        ref.invalidate(adminSupplierVerificationsProvider);
        await ref.read(adminSupplierVerificationsProvider.future);
        _showSnack('Supplier verification approved.');
        return;
      }

      final note = await _promptAdminNote(
        context,
        title: action == 'reject' ? 'Reject verification' : 'Request changes',
        required: true,
        tone: action == 'reject' ? AppStatusTone.danger : AppStatusTone.warning,
      );
      if (note == null || !mounted) return;

      final api = ref.read(adminSupplierVerificationsApiProvider);
      if (action == 'reject') {
        await api.rejectVerification(
          id: item.supplierProfileId,
          adminNote: note,
        );
        if (!mounted) return;
        _showSnack('Supplier verification rejected.');
      } else {
        await api.requestChanges(id: item.supplierProfileId, adminNote: note);
        if (!mounted) return;
        _showSnack('Changes requested from supplier.');
      }

      ref.invalidate(adminSupplierVerificationsProvider);
      await ref.read(adminSupplierVerificationsProvider.future);
    } on ApiException catch (error) {
      if (!mounted) return;
      _showSnack(AdminL10n.of(context).localizedError(error), isError: true);
    } catch (error) {
      if (!mounted) return;
      _showSnack(AdminL10n.of(context).localizedError(error), isError: true);
    }
  }

  void _showSnack(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Theme.of(context).colorScheme.error : null,
      ),
    );
  }

  void _goToPage(int page) {
    final current = ref.read(adminSupplierVerificationFiltersProvider);
    ref
        .read(adminSupplierVerificationFiltersProvider.notifier)
        .updateFilters(current.copyWith(page: page));
  }

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final items = widget.response.items;
    final summary = widget.response.summary;
    final pagination = widget.response.pagination;

    return ListView(
      padding: const EdgeInsetsDirectional.only(bottom: 24),
      children: [
        // The admin top bar already renders the "Supplier Verification"
        // title for this route — only the descriptive subtitle belongs here
        // to avoid showing the same heading twice.
        Text(
          l.t(
            'Review official supplier accounts before they publish as verified organizations.',
            'راجع حسابات الموردين الرسمية قبل نشرها كمؤسسات موثّقة.',
          ),
          style: AdminTypography.pageSubtitle(palette),
        ),
        const SizedBox(height: 16),
        _VerificationKpiRow(summary: summary, l: l),
        const SizedBox(height: 16),
        _FiltersBar(
          searchController: _searchController,
          cityController: _cityController,
          statusFilter: _statusFilter,
          typeFilter: _typeFilter,
          onStatusChanged: (value) => setState(() => _statusFilter = value),
          onTypeChanged: (value) => setState(() => _typeFilter = value),
          onApply: _applyFilters,
          onReset: _resetFilters,
        ),
        const SizedBox(height: 16),
        _SupplierListContainer(
          items: items,
          pagination: pagination,
          onPageChanged: _goToPage,
          onViewDetails: _openDetails,
          onApprove: (item) => _runQuickAction(item: item, action: 'approve'),
          onReject: (item) => _runQuickAction(item: item, action: 'reject'),
          onRequestChanges: (item) =>
              _runQuickAction(item: item, action: 'request-changes'),
        ),
      ],
    );
  }
}

class _FiltersBar extends StatelessWidget {
  const _FiltersBar({
    required this.searchController,
    required this.cityController,
    required this.statusFilter,
    required this.typeFilter,
    required this.onStatusChanged,
    required this.onTypeChanged,
    required this.onApply,
    required this.onReset,
  });

  final TextEditingController searchController;
  final TextEditingController cityController;
  final String statusFilter;
  final String typeFilter;
  final ValueChanged<String> onStatusChanged;
  final ValueChanged<String> onTypeChanged;
  final VoidCallback onApply;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final compact = MediaQuery.sizeOf(context).width < 720;

    Widget field(Widget child) {
      if (compact) {
        return SizedBox(width: double.infinity, child: child);
      }
      return child;
    }

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
                field(_searchField(l)),
                const SizedBox(height: 10),
                field(_cityField(l)),
                const SizedBox(height: 10),
                field(_statusField(l)),
                const SizedBox(height: 10),
                field(_typeField(l)),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _applyButton(l)),
                    const SizedBox(width: 10),
                    Expanded(child: _resetButton(l)),
                  ],
                ),
              ],
            )
          : Wrap(
              spacing: 10,
              runSpacing: 10,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(width: 320, child: _searchField(l)),
                SizedBox(width: 170, child: _cityField(l)),
                SizedBox(width: 170, child: _statusField(l)),
                SizedBox(width: 190, child: _typeField(l)),
                _applyButton(l),
                _resetButton(l),
              ],
            ),
    );
  }

  static const _fieldBorderRadius = BorderRadius.all(
    Radius.circular(AppRadius.md),
  );

  Widget _searchField(AdminL10n l) => TextField(
    controller: searchController,
    decoration: InputDecoration(
      isDense: true,
      hintText: l.t(
        'Search by supplier, owner, email',
        'بحث بالمورد أو المالك أو البريد',
      ),
      prefixIcon: const Icon(Icons.search, size: 18),
      border: const OutlineInputBorder(borderRadius: _fieldBorderRadius),
    ),
  );

  Widget _cityField(AdminL10n l) => TextField(
    controller: cityController,
    decoration: InputDecoration(
      isDense: true,
      hintText: l.t('City or area', 'المدينة أو المنطقة'),
      prefixIcon: const Icon(Icons.location_on_outlined, size: 18),
      border: const OutlineInputBorder(borderRadius: _fieldBorderRadius),
    ),
  );

  Widget _statusField(AdminL10n l) => DropdownButtonFormField<String>(
    key: ValueKey('verification-status-$statusFilter'),
    initialValue: statusFilter,
    isExpanded: true,
    decoration: const InputDecoration(
      isDense: true,
      border: OutlineInputBorder(borderRadius: _fieldBorderRadius),
    ),
    items: [
      DropdownMenuItem(
        value: 'ALL',
        child: Text(l.t('All statuses', 'كل الحالات')),
      ),
      DropdownMenuItem(
        value: 'PENDING',
        child: Text(l.t('Pending', 'قيد الانتظار')),
      ),
      DropdownMenuItem(
        value: 'APPROVED',
        child: Text(l.t('Approved', 'موافق عليه')),
      ),
      DropdownMenuItem(
        value: 'REJECTED',
        child: Text(l.t('Rejected', 'مرفوض')),
      ),
      DropdownMenuItem(
        value: 'CHANGES_REQUESTED',
        child: Text(l.t('Changes requested', 'طلب تعديلات')),
      ),
    ],
    onChanged: (value) {
      if (value != null) onStatusChanged(value);
    },
  );

  Widget _typeField(AdminL10n l) => DropdownButtonFormField<String>(
    key: ValueKey('verification-type-$typeFilter'),
    initialValue: typeFilter,
    isExpanded: true,
    decoration: const InputDecoration(
      isDense: true,
      border: OutlineInputBorder(borderRadius: _fieldBorderRadius),
    ),
    items: [
      DropdownMenuItem(
        value: 'ALL',
        child: Text(l.t('All types', 'كل الأنواع')),
      ),
      DropdownMenuItem(value: 'WORKSHOP', child: Text(l.t('Workshop', 'ورشة'))),
      DropdownMenuItem(value: 'FACTORY', child: Text(l.t('Factory', 'مصنع'))),
      DropdownMenuItem(
        value: 'EDUCATIONAL_INSTITUTION',
        child: Text(l.t('Educational institution', 'مؤسسة تعليمية')),
      ),
    ],
    onChanged: (value) {
      if (value != null) onTypeChanged(value);
    },
  );

  Widget _applyButton(AdminL10n l) => FilledButton.icon(
    onPressed: onApply,
    icon: const Icon(Icons.filter_alt_outlined, size: 18),
    label: Text(l.t('Apply filters', 'تطبيق الفلاتر')),
  );

  Widget _resetButton(AdminL10n l) => OutlinedButton.icon(
    onPressed: onReset,
    icon: const Icon(Icons.restart_alt_outlined, size: 18),
    label: Text(l.reset),
  );
}

/// Balanced KPI summary row — reuses the shared [AdminKpiCard] primitive.
class _VerificationKpiRow extends StatelessWidget {
  const _VerificationKpiRow({required this.summary, required this.l});

  final AdminSupplierVerificationSummary summary;
  final AdminL10n l;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final total =
        summary.pending +
        summary.approved +
        summary.rejected +
        summary.changesRequested;

    final cards = <AdminKpiCard>[
      AdminKpiCard(
        label: l.t('Pending', 'قيد الانتظار'),
        value: '${summary.pending}',
        helper: l.t('Awaiting review', 'في انتظار المراجعة'),
        icon: Icons.schedule_outlined,
        accent: palette.amber,
        helperMaxLines: 1,
      ),
      AdminKpiCard(
        label: l.t('Approved', 'موافق عليه'),
        value: '${summary.approved}',
        helper: l.t('Verified suppliers', 'موردون موثّقون'),
        icon: Icons.verified_outlined,
        accent: palette.green,
        helperMaxLines: 1,
      ),
      AdminKpiCard(
        label: l.t('Rejected', 'مرفوض'),
        value: '${summary.rejected}',
        helper: l.t('Not approved', 'غير موافق عليه'),
        icon: Icons.cancel_outlined,
        accent: palette.red,
        helperMaxLines: 1,
      ),
      AdminKpiCard(
        label: l.t('Changes requested', 'طلب تعديلات'),
        value: '${summary.changesRequested}',
        helper: l.t('Need updates', 'تحتاج إلى تحديث'),
        icon: Icons.edit_note_outlined,
        accent: palette.amber,
        helperMaxLines: 1,
      ),
      AdminKpiCard(
        label: l.t('Total suppliers', 'إجمالي الموردين'),
        value: '$total',
        helper: l.t('Across all statuses', 'عبر جميع الحالات'),
        icon: Icons.apartment_outlined,
        accent: palette.primaryTeal,
        helperMaxLines: 1,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final columns = width >= 1180
            ? 5
            : width >= 760
            ? 3
            : width >= 480
            ? 2
            : 1;
        const spacing = 10.0;

        final rows = <Widget>[];
        for (var i = 0; i < cards.length; i += columns) {
          final chunk = cards.skip(i).take(columns).toList();
          rows.add(
            Padding(
              padding: EdgeInsets.only(
                bottom: i + columns < cards.length ? spacing : 0,
              ),
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var j = 0; j < chunk.length; j++) ...[
                      if (j > 0) const SizedBox(width: spacing),
                      Expanded(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(
                            minHeight: _kKpiCardMinHeight,
                          ),
                          child: chunk[j],
                        ),
                      ),
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
  }
}

const double _kSupplierActionsWidth = 188;
const double _kSupplierRowBreakpoint = 900;
const double _kSupplierRowMinHeight = 100;
const double _kKpiCardMinHeight = 104;

/// One large rounded container holding the result header, column
/// header, and every supplier row/card — replaces the old floating cards.
class _SupplierListContainer extends StatelessWidget {
  const _SupplierListContainer({
    required this.items,
    required this.pagination,
    required this.onPageChanged,
    required this.onViewDetails,
    required this.onApprove,
    required this.onReject,
    required this.onRequestChanges,
  });

  final List<AdminSupplierVerificationListItem> items;
  final AdminSupplierVerificationPagination pagination;
  final ValueChanged<int> onPageChanged;
  final ValueChanged<AdminSupplierVerificationListItem> onViewDetails;
  final ValueChanged<AdminSupplierVerificationListItem> onApprove;
  final ValueChanged<AdminSupplierVerificationListItem> onReject;
  final ValueChanged<AdminSupplierVerificationListItem> onRequestChanges;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;

    return Container(
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(16, 14, 16, 14),
            child: _SupplierListHeaderBar(
              itemCount: items.length,
              pagination: pagination,
              onPageChanged: onPageChanged,
              l: l,
            ),
          ),
          Divider(height: 1, color: palette.cardBorder),
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: AdminEmptyState(
                icon: Icons.verified_user_outlined,
                title: l.t(
                  'No supplier verification requests yet',
                  'لا توجد طلبات تحقق من الموردين بعد',
                ),
                subtitle: l.t(
                  'Official supplier submissions will appear here for review.',
                  'ستظهر طلبات الموردين الرسمية هنا للمراجعة.',
                ),
              ),
            )
          else
            LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxWidth < _kSupplierRowBreakpoint;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (!compact) const _SupplierColumnHeaderRow(),
                    for (var i = 0; i < items.length; i++)
                      _SupplierRow(
                        item: items[i],
                        compact: compact,
                        showDivider: i < items.length - 1,
                        onViewDetails: () => onViewDetails(items[i]),
                        onApprove: () => onApprove(items[i]),
                        onReject: () => onReject(items[i]),
                        onRequestChanges: () => onRequestChanges(items[i]),
                      ),
                  ],
                );
              },
            ),
        ],
      ),
    );
  }
}

class _SupplierListHeaderBar extends StatelessWidget {
  const _SupplierListHeaderBar({
    required this.itemCount,
    required this.pagination,
    required this.onPageChanged,
    required this.l,
  });

  final int itemCount;
  final AdminSupplierVerificationPagination pagination;
  final ValueChanged<int> onPageChanged;
  final AdminL10n l;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final total = pagination.total;
    final rangeStart = total == 0
        ? 0
        : (pagination.page - 1) * pagination.limit + 1;
    final rangeEnd = total == 0
        ? 0
        : ((pagination.page - 1) * pagination.limit + itemCount).clamp(
            0,
            total,
          );
    final totalPages = total == 0 ? 1 : (total / pagination.limit).ceil();

    final trailing = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (total > 0)
          Text(
            '$rangeStart–$rangeEnd ${l.t('of', 'من')} $total',
            style: AdminTypography.kpiHelper(palette),
          ),
        if (totalPages > 1) ...[
          const SizedBox(width: 12),
          _PageArrowButton(
            icon: Icons.chevron_left,
            tooltip: l.t('Previous page', 'الصفحة السابقة'),
            onPressed: pagination.page > 1
                ? () => onPageChanged(pagination.page - 1)
                : null,
          ),
          const SizedBox(width: 6),
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: palette.primaryTeal,
              borderRadius: AppRadius.smAll,
            ),
            child: Text(
              '${pagination.page}',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 6),
          _PageArrowButton(
            icon: Icons.chevron_right,
            tooltip: l.t('Next page', 'الصفحة التالية'),
            onPressed: pagination.page < totalPages
                ? () => onPageChanged(pagination.page + 1)
                : null,
          ),
        ],
      ],
    );

    return Wrap(
      spacing: 12,
      runSpacing: 8,
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text(
          total == 1
              ? l.t('1 supplier', 'مورد واحد')
              : l.t('$total suppliers', '$total من الموردين'),
          style: AdminTypography.sectionTitle(palette),
        ),
        trailing,
      ],
    );
  }
}

class _PageArrowButton extends StatelessWidget {
  const _PageArrowButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onPressed,
        borderRadius: AppRadius.smAll,
        child: Container(
          width: 28,
          height: 28,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: AppRadius.smAll,
            border: Border.all(color: colors.borderSubtle),
          ),
          child: Icon(
            icon,
            size: 18,
            color: onPressed != null
                ? colors.textPrimary
                : colors.textMuted.withValues(alpha: 0.4),
          ),
        ),
      ),
    );
  }
}

/// Desktop-only column header aligned with [_SupplierRow]'s flex columns.
class _SupplierColumnHeaderRow extends StatelessWidget {
  const _SupplierColumnHeaderRow();

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l = AdminL10n.of(context);
    final labelStyle = Theme.of(context).textTheme.labelSmall?.copyWith(
      color: colors.textMuted,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.2,
    );

    Widget label(String text) => Text(text, style: labelStyle);

    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(flex: 6, child: label(l.t('SUPPLIER', 'المورد'))),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            flex: 4,
            child: label(l.t('TYPE & LOCATION', 'النوع والموقع')),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(flex: 4, child: label(l.t('CONTACT', 'التواصل'))),
          const SizedBox(width: AppSpacing.md),
          Expanded(flex: 3, child: label(l.t('SUBMITTED', 'تاريخ التقديم'))),
          const SizedBox(width: AppSpacing.md),
          Expanded(flex: 3, child: label(l.t('REVIEWED', 'تاريخ المراجعة'))),
          const SizedBox(width: AppSpacing.md),
          Expanded(flex: 3, child: label(l.t('STATUS', 'الحالة'))),
          const SizedBox(width: AppSpacing.sm),
          SizedBox(
            width: _kSupplierActionsWidth,
            child: Text(
              l.t('ACTIONS', 'الإجراءات'),
              textAlign: TextAlign.end,
              style: labelStyle,
            ),
          ),
        ],
      ),
    );
  }
}

/// One compact horizontal row on desktop; stacks cleanly on narrow widths.
class _SupplierRow extends StatefulWidget {
  const _SupplierRow({
    required this.item,
    required this.compact,
    required this.showDivider,
    required this.onViewDetails,
    required this.onApprove,
    required this.onReject,
    required this.onRequestChanges,
  });

  final AdminSupplierVerificationListItem item;
  final bool compact;
  final bool showDivider;
  final VoidCallback onViewDetails;
  final VoidCallback onApprove;
  final VoidCallback onReject;
  final VoidCallback onRequestChanges;

  @override
  State<_SupplierRow> createState() => _SupplierRowState();
}

class _SupplierRowState extends State<_SupplierRow> {
  var _hovered = false;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final item = widget.item;

    final identity = _SupplierIdentityBlock(item: item);
    final typeLocation = _SupplierTypeLocationBlock(item: item);
    final contact = _SupplierContactBlock(item: item);
    final submitted = _SupplierDateBlock(date: item.submittedAt);
    final reviewed = _SupplierDateBlock(date: item.reviewedAt);
    final status = _StatusBadge(status: item.verificationStatus);
    final actions = _SupplierActionArea(
      status: item.verificationStatus,
      compact: widget.compact,
      onViewDetails: widget.onViewDetails,
      onApprove: widget.onApprove,
      onReject: widget.onReject,
      onRequestChanges: widget.onRequestChanges,
    );

    final content = widget.compact
        ? Padding(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: identity),
                    const SizedBox(width: AppSpacing.sm),
                    status,
                  ],
                ),
                const SizedBox(height: AppSpacing.sm + 2),
                typeLocation,
                const SizedBox(height: AppSpacing.sm),
                contact,
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(child: submitted),
                    Expanded(child: reviewed),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm + 2),
                actions,
              ],
            ),
          )
        : ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: _kSupplierRowMinHeight,
            ),
            child: Padding(
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.md,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(flex: 6, child: identity),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(flex: 4, child: typeLocation),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(flex: 4, child: contact),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(flex: 3, child: submitted),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(flex: 3, child: reviewed),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    flex: 3,
                    child: Align(
                      alignment: AlignmentDirectional.center,
                      child: status,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  SizedBox(width: _kSupplierActionsWidth, child: actions),
                ],
              ),
            ),
          );

    final row = Container(
      decoration: BoxDecoration(
        color: _hovered && !widget.compact
            ? colors.surfaceMuted.withValues(alpha: 0.5)
            : Colors.transparent,
        border: widget.showDivider
            ? Border(bottom: BorderSide(color: colors.borderSubtle))
            : null,
      ),
      child: content,
    );

    if (widget.compact) return row;

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: row,
    );
  }
}

class _SupplierAvatarTile extends StatelessWidget {
  const _SupplierAvatarTile();

  @override
  Widget build(BuildContext context) {
    final style = AppStatusStyle.of(context, AppStatusTone.primary);

    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: AppRadius.mdAll,
      ),
      child: Icon(Icons.storefront_outlined, size: 20, color: style.foreground),
    );
  }
}

class _SupplierIdentityBlock extends StatelessWidget {
  const _SupplierIdentityBlock({required this.item});

  final AdminSupplierVerificationListItem item;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const _SupplierAvatarTile(),
        const SizedBox(width: AppSpacing.sm + 2),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                item.organizationName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w700,
                  height: 1.3,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                item.ownerEmail,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colors.textMuted,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SupplierTypeLocationBlock extends StatelessWidget {
  const _SupplierTypeLocationBlock({required this.item});

  final AdminSupplierVerificationListItem item;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          _formatSupplierType(item.supplierType),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w600,
            height: 1.3,
          ),
        ),
        const SizedBox(height: 5),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.location_on_outlined, size: 14, color: colors.textMuted),
            const SizedBox(width: 4),
            Expanded(
              child: Text(
                _locationLabel(item.city, item.area),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colors.textMuted,
                  height: 1.3,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _SupplierContactBlock extends StatelessWidget {
  const _SupplierContactBlock({required this.item});

  final AdminSupplierVerificationListItem item;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final rowStyle = Theme.of(
      context,
    ).textTheme.bodySmall?.copyWith(color: colors.textSecondary, height: 1.3);

    Widget line(IconData icon, String text) => Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 14, color: colors.textMuted),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: rowStyle,
          ),
        ),
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        line(Icons.person_outline, item.ownerName),
        const SizedBox(height: 5),
        line(Icons.mail_outline, item.ownerEmail),
      ],
    );
  }
}

class _SupplierDateBlock extends StatelessWidget {
  const _SupplierDateBlock({required this.date});

  final DateTime? date;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    if (date == null) {
      return Text(
        '—',
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: colors.textMuted),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          DateFormat.yMMMd().format(date!),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w600,
            height: 1.3,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          DateFormat.jm().format(date!),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: colors.textMuted, height: 1.3),
        ),
      ],
    );
  }
}

/// Compact "View details" button + overflow menu. Hides the quick action
/// that matches the item's current status to avoid a redundant re-click;
/// full moderation controls remain available via the details dialog.
class _SupplierActionArea extends StatelessWidget {
  const _SupplierActionArea({
    required this.status,
    required this.compact,
    required this.onViewDetails,
    required this.onApprove,
    required this.onReject,
    required this.onRequestChanges,
  });

  final String status;
  final bool compact;
  final VoidCallback onViewDetails;
  final VoidCallback onApprove;
  final VoidCallback onReject;
  final VoidCallback onRequestChanges;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final normalized = status.toUpperCase();

    final detailsButton = OutlinedButton.icon(
      onPressed: onViewDetails,
      icon: const Icon(Icons.visibility_outlined, size: 16),
      label: Text(l.viewDetails),
      style: AppStatusButtonStyle.outlined(context, AppStatusTone.primary)
          .merge(
            OutlinedButton.styleFrom(
              visualDensity: VisualDensity.compact,
              textStyle: Theme.of(
                context,
              ).textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w600),
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.sm + 2,
                vertical: AppSpacing.xs,
              ),
            ),
          ),
    );

    final overflowItems = <PopupMenuEntry<VoidCallback>>[
      if (normalized != 'APPROVED')
        PopupMenuItem<VoidCallback>(
          value: onApprove,
          child: _OverflowMenuLabel(
            icon: Icons.check_circle_outline,
            label: l.approve,
            tone: AppStatusTone.success,
          ),
        ),
      if (normalized != 'CHANGES_REQUESTED')
        PopupMenuItem<VoidCallback>(
          value: onRequestChanges,
          child: _OverflowMenuLabel(
            icon: Icons.edit_note_outlined,
            label: l.requestChanges,
            tone: AppStatusTone.warning,
          ),
        ),
      if (normalized != 'REJECTED')
        PopupMenuItem<VoidCallback>(
          value: onReject,
          child: _OverflowMenuLabel(
            icon: Icons.cancel_outlined,
            label: l.reject,
            tone: AppStatusTone.danger,
          ),
        ),
    ];

    final overflowButton = PopupMenuButton<VoidCallback>(
      tooltip: 'More actions',
      icon: Icon(
        Icons.more_vert,
        size: 18,
        color: AppThemeColors.of(context).textMuted,
      ),
      padding: EdgeInsets.zero,
      onSelected: (action) => action(),
      itemBuilder: (menuContext) => overflowItems,
    );

    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        compact ? Expanded(child: detailsButton) : detailsButton,
        const SizedBox(width: AppSpacing.xs + 2),
        overflowButton,
      ],
    );
  }
}

class _OverflowMenuLabel extends StatelessWidget {
  const _OverflowMenuLabel({
    required this.icon,
    required this.label,
    required this.tone,
  });

  final IconData icon;
  final String label;
  final AppStatusTone tone;

  @override
  Widget build(BuildContext context) {
    final style = AppStatusStyle.of(context, tone);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18, color: style.foreground),
        const SizedBox(width: AppSpacing.sm),
        Text(
          label,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: style.foreground,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) => AppStatusBadge(
    label: _formatStatusLabel(status),
    tone: supplierVerificationStatusTone(status),
  );
}

class _VerificationDetailsDialog extends ConsumerStatefulWidget {
  const _VerificationDetailsDialog({
    required this.supplierProfileId,
    required this.onActionCompleted,
  });

  final String supplierProfileId;
  final VoidCallback onActionCompleted;

  @override
  ConsumerState<_VerificationDetailsDialog> createState() =>
      _VerificationDetailsDialogState();
}

class _VerificationDetailsDialogState
    extends ConsumerState<_VerificationDetailsDialog> {
  late Future<AdminSupplierVerificationDetail> _detailFuture;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  void _loadDetail() {
    setState(() {
      _detailFuture = ref
          .read(adminSupplierVerificationsApiProvider)
          .fetchVerificationDetail(widget.supplierProfileId);
    });
  }

  Future<void> _runAction(
    Future<void> Function() action,
    String success,
  ) async {
    if (_isSubmitting) return;

    setState(() => _isSubmitting = true);
    try {
      await action();
      if (!mounted) return;
      widget.onActionCompleted();
      ref.invalidate(adminSupplierVerificationsProvider);
      await ref.read(adminSupplierVerificationsProvider.future);
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(success)));
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AdminL10n.of(context).localizedError(error)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AdminL10n.of(context).localizedError(error)),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  Future<void> _approve() async {
    final confirmed = await _confirmApprove(context);
    if (!confirmed || !mounted) return;

    final optionalNote = await _promptAdminNote(
      context,
      title: 'Approval note (optional)',
      required: false,
      tone: AppStatusTone.success,
    );
    if (!mounted) return;

    final api = ref.read(adminSupplierVerificationsApiProvider);
    await _runAction(
      () => api.approveVerification(
        id: widget.supplierProfileId,
        adminNote: optionalNote,
      ),
      'Supplier verification approved.',
    );
  }

  Future<void> _reject() async {
    final note = await _promptAdminNote(
      context,
      title: 'Rejection reason',
      required: true,
      tone: AppStatusTone.danger,
    );
    if (note == null || !mounted) return;

    final api = ref.read(adminSupplierVerificationsApiProvider);
    await _runAction(
      () =>
          api.rejectVerification(id: widget.supplierProfileId, adminNote: note),
      'Supplier verification rejected.',
    );
  }

  Future<void> _requestChanges() async {
    final note = await _promptAdminNote(
      context,
      title: 'Changes requested',
      required: true,
      tone: AppStatusTone.warning,
    );
    if (note == null || !mounted) return;

    final api = ref.read(adminSupplierVerificationsApiProvider);
    await _runAction(
      () => api.requestChanges(id: widget.supplierProfileId, adminNote: note),
      'Changes requested from supplier.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final dateFormat = DateFormat.yMMMd().add_jm();

    return AppDialogShell(
      title: FutureBuilder<AdminSupplierVerificationDetail>(
        future: _detailFuture,
        builder: (context, snapshot) => snapshot.hasData
            ? _VerificationHeader(detail: snapshot.data!)
            : Text(l.supplierVerificationDetails),
      ),
      maxWidth: 880,
      maxHeightFactor: 0.9,
      closeEnabled: !_isSubmitting,
      content: SizedBox(
        width: 840,
        child: FutureBuilder<AdminSupplierVerificationDetail>(
          future: _detailFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const SizedBox(
                height: 180,
                child: Center(child: CircularProgressIndicator()),
              );
            }

            if (snapshot.hasError) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(AdminL10n.of(context).localizedError(snapshot.error!)),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () => setState(_loadDetail),
                    child: Text(l.retry),
                  ),
                ],
              );
            }

            final detail = snapshot.data!;
            final organizationCard = _VerificationSectionCard(
              title: 'Organization',
              icon: Icons.storefront_outlined,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    detail.organizationName,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: AppThemeColors.of(context).textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  AppStatusBadge(
                    label: _formatSupplierType(detail.supplierType),
                    tone: AppStatusTone.neutral,
                  ),
                  if (detail.description?.trim().isNotEmpty ?? false) ...[
                    const SizedBox(height: AppSpacing.md),
                    _DetailNote(
                      title: 'Description',
                      note: detail.description!,
                    ),
                  ],
                ],
              ),
            );
            final contactCard = _VerificationSectionCard(
              title: 'Owner & contact',
              icon: Icons.person_outline,
              child: Column(
                children: [
                  _DetailInfoRow(
                    icon: Icons.person_outline,
                    label: 'Owner',
                    value: detail.owner.displayName,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _DetailInfoRow(
                    icon: Icons.mail_outline,
                    label: 'Email',
                    value: detail.owner.email,
                  ),
                  if (detail.owner.phone?.trim().isNotEmpty ?? false) ...[
                    const SizedBox(height: AppSpacing.md),
                    _DetailInfoRow(
                      icon: Icons.phone_outlined,
                      label: 'Phone',
                      value: detail.owner.phone,
                    ),
                  ],
                ],
              ),
            );
            final locationCard = _VerificationSectionCard(
              title: 'Location',
              icon: Icons.location_on_outlined,
              child: _DetailInfoRow(
                icon: Icons.place_outlined,
                label: 'Business location',
                value: _locationLabel(
                  detail.location.city,
                  detail.location.area,
                  detail.location.addressLine,
                ),
              ),
            );
            final historyCard = _VerificationSectionCard(
              title: 'Verification history',
              icon: Icons.verified_user_outlined,
              child: _VerificationHistory(
                detail: detail,
                dateFormat: dateFormat,
              ),
            );

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _VerificationMetaStrip(detail: detail, dateFormat: dateFormat),
                const SizedBox(height: AppSpacing.md),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final left = Column(
                      children: [
                        organizationCard,
                        const SizedBox(height: AppSpacing.md),
                        contactCard,
                        if (detail.verificationDocumentUrl?.isNotEmpty ??
                            false) ...[
                          const SizedBox(height: AppSpacing.md),
                          _VerificationDocumentCard(
                            verificationId: detail.supplierProfileId,
                            documentUrl: detail.verificationDocumentUrl!,
                            documentName: detail.verificationDocumentName,
                          ),
                        ],
                      ],
                    );
                    final right = Column(
                      children: [
                        locationCard,
                        const SizedBox(height: AppSpacing.md),
                        historyCard,
                      ],
                    );

                    if (constraints.maxWidth < 700) {
                      return Column(
                        children: [
                          left,
                          const SizedBox(height: AppSpacing.md),
                          right,
                        ],
                      );
                    }
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: left),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(child: right),
                      ],
                    );
                  },
                ),
                const SizedBox(height: AppSpacing.md),
              ],
            );
          },
        ),
      ),
      footer: AppDialogFooter.actions(
        actions: [
          OutlinedButton(
            onPressed: _isSubmitting ? null : _requestChanges,
            style: AppStatusButtonStyle.outlined(
              context,
              AppStatusTone.warning,
            ),
            child: Text(l.requestChanges),
          ),
          OutlinedButton(
            onPressed: _isSubmitting ? null : _reject,
            style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger),
            child: Text(l.reject),
          ),
          FilledButton(
            onPressed: _isSubmitting ? null : _approve,
            style: AppStatusButtonStyle.filled(context, AppStatusTone.success),
            child: _isSubmitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(l.approve),
          ),
        ],
      ),
    );
  }
}

class _VerificationHeader extends StatelessWidget {
  const _VerificationHeader({required this.detail});

  final AdminSupplierVerificationDetail detail;

  @override
  Widget build(BuildContext context) => AppDialogTitleBlock(
    icon: Icons.storefront_outlined,
    title: detail.organizationName,
    badges: [
      AppStatusBadge(
        label: _formatStatusLabel(detail.verificationStatus),
        tone: supplierVerificationStatusTone(detail.verificationStatus),
      ),
      AppStatusBadge(
        label: _formatSupplierType(detail.supplierType),
        tone: AppStatusTone.neutral,
      ),
    ],
  );
}

class _VerificationMetaStrip extends StatelessWidget {
  const _VerificationMetaStrip({
    required this.detail,
    required this.dateFormat,
  });

  final AdminSupplierVerificationDetail detail;
  final DateFormat dateFormat;

  @override
  Widget build(BuildContext context) => AppDialogMetaStrip(
    items: [
      _MetaItem(
        icon: Icons.person_outline,
        label: 'Owner',
        value: detail.owner.displayName,
      ),
      _MetaItem(
        icon: Icons.mail_outline,
        label: 'Email',
        value: detail.owner.email,
      ),
      if (detail.submittedAt != null)
        _MetaItem(
          icon: Icons.calendar_today_outlined,
          label: 'Submitted',
          value: dateFormat.format(detail.submittedAt!),
        ),
      if (detail.reviewedAt != null)
        _MetaItem(
          icon: Icons.task_alt_outlined,
          label: 'Reviewed',
          value: dateFormat.format(detail.reviewedAt!),
        ),
    ],
  );
}

class _MetaItem extends StatelessWidget {
  const _MetaItem({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) =>
      AppDialogMetaItem(icon: icon, label: label, value: value);
}

class _VerificationSectionCard extends StatelessWidget {
  const _VerificationSectionCard({
    required this.title,
    required this.icon,
    required this.child,
  });

  final String title;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) =>
      AppDialogSection(title: title, icon: icon, child: child);
}

class _DetailInfoRow extends StatelessWidget {
  const _DetailInfoRow({required this.label, required this.value, this.icon});

  final String label;
  final String? value;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => AppDialogInfoRow(
    label: label,
    value: value?.trim().isNotEmpty ?? false ? value! : 'Not provided',
    icon: icon,
  );
}

class _DetailNote extends StatelessWidget {
  const _DetailNote({required this.title, required this.note});

  final String title;
  final String note;

  @override
  Widget build(BuildContext context) => AppDialogNote(title: title, note: note);
}

class _VerificationHistory extends StatelessWidget {
  const _VerificationHistory({required this.detail, required this.dateFormat});

  final AdminSupplierVerificationDetail detail;
  final DateFormat dateFormat;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _DetailInfoRow(
          label: 'Current status',
          value: _formatStatusLabel(detail.verificationStatus),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppStatusBadge(
          label: _formatStatusLabel(detail.verificationStatus),
          tone: supplierVerificationStatusTone(detail.verificationStatus),
        ),
        if (detail.submittedAt != null) ...[
          const SizedBox(height: AppSpacing.md),
          _DetailInfoRow(
            label: 'Submitted',
            value: dateFormat.format(detail.submittedAt!),
          ),
        ],
        if (detail.reviewedAt != null) ...[
          const SizedBox(height: AppSpacing.md),
          _DetailInfoRow(
            label: 'Reviewed',
            value: dateFormat.format(detail.reviewedAt!),
          ),
        ],
        if (detail.reviewedByName?.trim().isNotEmpty ?? false) ...[
          const SizedBox(height: AppSpacing.md),
          _DetailInfoRow(
            label: 'Reviewer',
            value: detail.reviewedByEmail?.trim().isNotEmpty ?? false
                ? '${detail.reviewedByName} · ${detail.reviewedByEmail}'
                : detail.reviewedByName,
          ),
        ],
        if (detail.adminNote?.trim().isNotEmpty ?? false) ...[
          const SizedBox(height: AppSpacing.md),
          _DetailNote(title: 'Review note', note: detail.adminNote!),
        ],
      ],
    );
  }
}

Future<bool> _confirmApprove(BuildContext context) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (dialogContext) {
      final l = AdminL10n.of(dialogContext);
      return AppDialogShell(
        title: Text(l.approveSupplierVerificationQuestion),
        content: Text(l.approveSupplierVerification),
        footer: AppDialogFooter.decision(
          secondaryAction: TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l.cancel),
          ),
          primaryAction: FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: AppStatusButtonStyle.filled(
              dialogContext,
              AppStatusTone.success,
            ),
            child: Text(l.approve),
          ),
        ),
      );
    },
  );

  return result ?? false;
}

Future<String?> _promptAdminNote(
  BuildContext context, {
  required String title,
  required bool required,
  required AppStatusTone tone,
}) {
  return showDialog<String?>(
    context: context,
    builder: (dialogContext) =>
        _AdminNoteDialog(title: title, required: required, tone: tone),
  );
}

class _AdminNoteDialog extends StatefulWidget {
  const _AdminNoteDialog({
    required this.title,
    required this.required,
    required this.tone,
  });

  final String title;
  final bool required;
  final AppStatusTone tone;

  @override
  State<_AdminNoteDialog> createState() => _AdminNoteDialogState();
}

class _AdminNoteDialogState extends State<_AdminNoteDialog> {
  final _controller = TextEditingController();
  String? _errorText;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final value = _controller.text.trim();
    if (widget.required && value.length < 3) {
      setState(() {
        _errorText = 'Reason must be at least 3 characters.';
      });
      return;
    }

    Navigator.of(context).pop(value.isEmpty ? null : value);
  }

  @override
  Widget build(BuildContext context) {
    final adminL10n = AdminL10n.of(context);
    return AppDialogShell(
      title: Text(widget.title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _controller,
            maxLines: 4,
            autofocus: true,
            decoration: InputDecoration(
              labelText: widget.required
                  ? adminL10n.reasonRequired
                  : 'Note (optional)',
              border: const OutlineInputBorder(),
              errorText: _errorText,
            ),
            onChanged: (_) {
              if (_errorText != null) {
                setState(() => _errorText = null);
              }
            },
          ),
        ],
      ),
      footer: AppDialogFooter.form(
        primaryAction: FilledButton(
          onPressed: _submit,
          style: AppStatusButtonStyle.filled(context, widget.tone),
          child: Text(adminL10n.confirm),
        ),
      ),
    );
  }
}

String _formatSupplierType(String value) {
  return switch (value.toUpperCase()) {
    'WORKSHOP' => 'Workshop',
    'FACTORY' => 'Factory',
    'EDUCATIONAL_INSTITUTION' => 'Educational institution',
    _ => value,
  };
}

String _formatStatusLabel(String value) {
  return switch (value.toUpperCase()) {
    'APPROVED' => 'Approved',
    'REJECTED' => 'Rejected',
    'CHANGES_REQUESTED' => 'Changes requested',
    'PENDING' => 'Pending',
    _ => value,
  };
}

String _locationLabel(String? city, String? area, [String? addressLine]) {
  final parts = <String>[
    if (city != null && city.isNotEmpty) city,
    if (area != null && area.isNotEmpty) area,
    if (addressLine != null && addressLine.isNotEmpty) addressLine,
  ];
  return parts.isEmpty ? '—' : parts.join(', ');
}

class _VerificationDocumentCard extends ConsumerStatefulWidget {
  const _VerificationDocumentCard({
    required this.verificationId,
    required this.documentUrl,
    this.documentName,
  });

  final String verificationId;
  final String documentUrl;
  final String? documentName;

  @override
  ConsumerState<_VerificationDocumentCard> createState() =>
      _VerificationDocumentCardState();
}

class _VerificationDocumentCardState
    extends ConsumerState<_VerificationDocumentCard> {
  bool _imagePreviewFailed = false;
  bool _isOpening = false;
  bool _isLoadingPreview = false;
  Uint8List? _previewBytes;
  String? _previewMimeType;

  bool get _isImage {
    final lower = widget.documentUrl.toLowerCase();
    final name = (widget.documentName ?? '').toLowerCase();
    return lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        name.endsWith('.png') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg');
  }

  bool get _isPdf {
    final lower = widget.documentUrl.toLowerCase();
    final name = (widget.documentName ?? '').toLowerCase();
    return lower.endsWith('.pdf') || name.endsWith('.pdf');
  }

  String get _displayName {
    if (widget.documentName != null && widget.documentName!.trim().isNotEmpty) {
      return widget.documentName!.trim();
    }
    return widget.documentUrl.split('/').last;
  }

  String get _typeLabel {
    if (_isPdf) {
      return 'PDF document';
    }
    if (_isImage) {
      return 'Image document';
    }
    return 'Document file';
  }

  IconData get _typeIcon {
    if (_isPdf) {
      return Icons.picture_as_pdf_outlined;
    }
    if (_isImage) {
      return Icons.image_outlined;
    }
    return Icons.insert_drive_file_outlined;
  }

  @override
  void initState() {
    super.initState();
    if (_isImage) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        unawaited(_loadImagePreview());
      });
    }
  }

  Future<AdminVerificationDocumentBytes> _downloadDocument() {
    return ref
        .read(adminSupplierVerificationsApiProvider)
        .downloadVerificationDocument(widget.verificationId);
  }

  Future<void> _loadImagePreview() async {
    if (!_isImage || _imagePreviewFailed || _isLoadingPreview) {
      return;
    }

    setState(() => _isLoadingPreview = true);

    try {
      final document = await _downloadDocument();
      if (!mounted) {
        return;
      }
      setState(() {
        _previewBytes = Uint8List.fromList(document.bytes);
        _previewMimeType = document.mimeType;
        _isLoadingPreview = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _imagePreviewFailed = true;
        _isLoadingPreview = false;
      });
    }
  }

  Future<void> _openDocument() async {
    if (_isOpening) {
      return;
    }

    setState(() => _isOpening = true);

    try {
      final document = _previewBytes != null
          ? AdminVerificationDocumentBytes(
              bytes: _previewBytes!,
              mimeType: _previewMimeType ?? 'application/octet-stream',
              filename: _displayName,
            )
          : await _downloadDocument();

      if (!mounted) {
        return;
      }

      openAdminVerificationDocumentBytes(
        bytes: document.bytes,
        mimeType: document.mimeType,
        filename: document.filename,
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      final message = AdminL10n.of(context).localizedError(error);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
    } finally {
      if (mounted) {
        setState(() => _isOpening = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final showImagePreview =
        _isImage && !_imagePreviewFailed && _previewBytes != null;

    return _VerificationSectionCard(
      title: 'Verification document',
      icon: Icons.file_present_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showImagePreview)
            ClipRRect(
              borderRadius: AppRadius.mdAll,
              child: Image.memory(
                _previewBytes!,
                height: 140,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted && !_imagePreviewFailed) {
                      setState(() => _imagePreviewFailed = true);
                    }
                  });
                  return _DocumentTypePreview(
                    icon: _typeIcon,
                    label: _typeLabel,
                  );
                },
              ),
            )
          else if (_isImage && _isLoadingPreview)
            Container(
              height: 120,
              width: double.infinity,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: colors.surfaceMuted,
                borderRadius: AppRadius.mdAll,
              ),
              child: const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else
            _DocumentTypePreview(icon: _typeIcon, label: _typeLabel),
          const SizedBox(height: AppSpacing.sm),
          Text(
            _displayName,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              OutlinedButton.icon(
                onPressed: _isOpening ? null : _openDocument,
                icon: _isOpening
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        _isPdf ? Icons.open_in_new : Icons.open_in_full_outlined,
                      ),
                label: Text(_isPdf ? 'Open PDF' : 'Open full image'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DocumentTypePreview extends StatelessWidget {
  const _DocumentTypePreview({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      height: 120,
      width: double.infinity,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: AppRadius.mdAll,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 40, color: colors.primary),
          const SizedBox(height: AppSpacing.sm),
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}
