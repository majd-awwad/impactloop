import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/config/api_config.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_close_button.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/review_status_presentation.dart';
import '../../../../shared/widgets/supplier_verification_status_presentation.dart';
import '../../data/admin_materials_api.dart';
import '../theme/admin_decoration_set.dart';
import '../theme/admin_palette.dart';
import '../utils/admin_material_moderation_policy.dart';
import '../widgets/admin_empty_state.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;

enum _BadgeTone { neutral, success, info, warning, danger, paid, teal, muted }

class _MaterialsFilters {
  const _MaterialsFilters({
    required this.tab,
    required this.search,
    required this.status,
    required this.reportStatus,
    required this.priceFilter,
  });

  final String tab;
  final String search;
  final String status;
  final String reportStatus;
  final String priceFilter;

  _MaterialsFilters copyWith({
    String? tab,
    String? search,
    String? status,
    String? reportStatus,
    String? priceFilter,
  }) {
    return _MaterialsFilters(
      tab: tab ?? this.tab,
      search: search ?? this.search,
      status: status ?? this.status,
      reportStatus: reportStatus ?? this.reportStatus,
      priceFilter: priceFilter ?? this.priceFilter,
    );
  }
}

class _MaterialsFiltersNotifier extends Notifier<_MaterialsFilters> {
  @override
  _MaterialsFilters build() {
    return const _MaterialsFilters(
      tab: 'MATERIALS',
      search: '',
      status: 'ALL',
      reportStatus: 'ALL',
      priceFilter: 'ALL',
    );
  }

  void setTab(String tab) => state = state.copyWith(tab: tab);
  void setSearch(String search) => state = state.copyWith(search: search);
  void setStatus(String status) => state = state.copyWith(status: status);
  void setReportStatus(String reportStatus) =>
      state = state.copyWith(reportStatus: reportStatus);
  void setPriceFilter(String priceFilter) =>
      state = state.copyWith(priceFilter: priceFilter);
  void reset() => state = build();
}

final _materialsFiltersProvider =
    NotifierProvider<_MaterialsFiltersNotifier, _MaterialsFilters>(
      _MaterialsFiltersNotifier.new,
    );

final adminMaterialsSummaryProvider = FutureProvider.autoDispose((ref) {
  return ref.watch(adminMaterialsApiProvider).fetchSummary();
});

final adminMaterialsListProvider = FutureProvider.autoDispose((ref) async {
  final filters = ref.watch(_materialsFiltersProvider);
  return ref
      .watch(adminMaterialsApiProvider)
      .fetchMaterials(
        search: filters.search,
        status: filters.status,
        reportStatus: filters.reportStatus,
        isFree: filters.priceFilter == 'FREE'
            ? true
            : filters.priceFilter == 'PAID'
            ? false
            : null,
      );
});

final adminMaterialReportsProvider = FutureProvider.autoDispose((ref) async {
  final filters = ref.watch(_materialsFiltersProvider);
  return ref
      .watch(adminMaterialsApiProvider)
      .fetchReports(
        search: filters.search,
        status: filters.tab == 'REPORTS' ? 'PENDING' : null,
      );
});

String _formatReportReason(String reason) {
  switch (reason) {
    case 'MISLEADING_INFORMATION':
      return 'Misleading information';
    case 'WRONG_CATEGORY':
      return 'Wrong category';
    case 'WRONG_PRICE':
      return 'Wrong price';
    case 'INAPPROPRIATE':
      return 'Inappropriate material';
    case 'ITEM_NOT_AVAILABLE':
      return 'Item not available';
    case 'SUSPICIOUS_SUPPLIER':
      return 'Suspicious supplier';
    case 'OTHER':
      return 'Other';
    default:
      return reason.replaceAll('_', ' ').toLowerCase();
  }
}

String _formatStatusLabel(String status) =>
    status.replaceAll('_', ' ').toLowerCase();

Color _toneColor(AdminPalette palette, _BadgeTone tone) {
  switch (tone) {
    case _BadgeTone.success:
      return palette.green;
    case _BadgeTone.info:
      return palette.purple;
    case _BadgeTone.warning:
      return palette.amber;
    case _BadgeTone.danger:
      return palette.red;
    case _BadgeTone.paid:
      return palette.blue;
    case _BadgeTone.teal:
      return palette.brightTeal;
    case _BadgeTone.muted:
      return palette.textMuted;
    case _BadgeTone.neutral:
      return palette.textSecondary;
  }
}

Color _cardAccent(BuildContext context, AdminMaterialListItem item) =>
    AppStatusStyle.of(
      context,
      materialLifecycleStatusTone(item.status).appStatusTone,
    ).foreground;

class AdminMaterialsPage extends ConsumerStatefulWidget {
  const AdminMaterialsPage({super.key, this.initialStatus});

  final String? initialStatus;

  @override
  ConsumerState<AdminMaterialsPage> createState() => _AdminMaterialsPageState();
}

class _AdminMaterialsPageState extends ConsumerState<AdminMaterialsPage> {
  final _searchController = TextEditingController();
  var _appliedInitialStatus = false;

  static const _validStatusFilters = {
    'AVAILABLE',
    'REUSED',
    'UNAVAILABLE',
    'RESERVED',
    'PENDING_RESERVATION',
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _applyInitialStatusIfNeeded(),
    );
  }

  @override
  void didUpdateWidget(AdminMaterialsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialStatus != widget.initialStatus) {
      _appliedInitialStatus = false;
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _applyInitialStatusIfNeeded(),
      );
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _refresh() {
    ref.invalidate(adminMaterialsSummaryProvider);
    ref.invalidate(adminMaterialsListProvider);
    ref.invalidate(adminMaterialReportsProvider);
  }

  void _applyInitialStatusIfNeeded() {
    if (!mounted || _appliedInitialStatus) return;
    final raw = widget.initialStatus?.trim().toUpperCase();
    if (raw == null || raw.isEmpty) return;
    _appliedInitialStatus = true;
    if (!_validStatusFilters.contains(raw)) return;
    ref.read(_materialsFiltersProvider.notifier).setStatus(raw);
  }

  Future<void> _runAction(
    Future<void> Function() action, {
    String successMessage = 'Action completed successfully.',
  }) async {
    try {
      await action();
      if (!mounted) return;
      _refresh();
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(successMessage)));
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.displayMessage)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final filters = ref.watch(_materialsFiltersProvider);
    final summaryAsync = ref.watch(adminMaterialsSummaryProvider);
    final compact = MediaQuery.sizeOf(context).width < 900;
    final pageTint = palette.isDark
        ? palette.pageBackground
        : palette.primaryTeal.withValues(alpha: 0.04);

    return ColoredBox(
      color: pageTint,
      child: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.fromSTEB(20, 16, 20, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Materials', style: AdminTypography.pageTitle(palette)),
            const SizedBox(height: 4),
            Text(
              'Review and moderate supplier materials across the platform.',
              style: AdminTypography.pageSubtitle(palette),
            ),
            const SizedBox(height: 20),
            summaryAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (_, _) => const SizedBox.shrink(),
              data: (summary) => LayoutBuilder(
                builder: (context, constraints) {
                  final cardWidth = compact
                      ? constraints.maxWidth
                      : (constraints.maxWidth - 48) / 5;
                  return Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      _SummaryMetricCard(
                        width: cardWidth.clamp(140, 220),
                        label: 'Total materials',
                        value: summary.total,
                        icon: Icons.inventory_2_outlined,
                        accent: palette.primaryTeal,
                      ),
                      _SummaryMetricCard(
                        width: cardWidth.clamp(140, 220),
                        label: 'Available',
                        value: summary.available,
                        icon: Icons.check_circle_outline,
                        accent: palette.green,
                      ),
                      _SummaryMetricCard(
                        width: cardWidth.clamp(140, 220),
                        label: 'Paid',
                        value: summary.paid,
                        icon: Icons.payments_outlined,
                        accent: palette.purple,
                      ),
                      _SummaryMetricCard(
                        width: cardWidth.clamp(140, 220),
                        label: 'Unavailable',
                        value: summary.unavailable,
                        icon: Icons.visibility_off_outlined,
                        accent: palette.textMuted,
                      ),
                      _SummaryMetricCard(
                        width: cardWidth.clamp(140, 220),
                        label: 'Reported',
                        value: summary.reported,
                        icon: Icons.flag_outlined,
                        accent: palette.amber,
                        highlight: summary.reported > 0,
                      ),
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: 20),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                  value: 'MATERIALS',
                  label: Text('Materials'),
                  icon: Icon(Icons.inventory_2_outlined, size: 18),
                ),
                ButtonSegment(
                  value: 'REPORTS',
                  label: Text('Reported'),
                  icon: Icon(Icons.flag_outlined, size: 18),
                ),
              ],
              selected: {filters.tab},
              onSelectionChanged: (value) {
                ref
                    .read(_materialsFiltersProvider.notifier)
                    .setTab(value.first);
              },
            ),
            const SizedBox(height: 16),
            _FiltersBar(
              searchController: _searchController,
              filters: filters,
              onSearch: (value) =>
                  ref.read(_materialsFiltersProvider.notifier).setSearch(value),
              onStatusChanged: (value) =>
                  ref.read(_materialsFiltersProvider.notifier).setStatus(value),
              onReportStatusChanged: (value) => ref
                  .read(_materialsFiltersProvider.notifier)
                  .setReportStatus(value),
              onPriceFilterChanged: (value) => ref
                  .read(_materialsFiltersProvider.notifier)
                  .setPriceFilter(value),
              onReset: () {
                _searchController.clear();
                ref.read(_materialsFiltersProvider.notifier).reset();
                context.go('/admin/materials');
              },
              onRefresh: _refresh,
              showMaterialFilters: filters.tab == 'MATERIALS',
            ),
            const SizedBox(height: 16),
            if (filters.tab == 'MATERIALS')
              _MaterialsTab(
                compact: compact,
                onAction: _runAction,
                onViewDetails: (id) => _showMaterialDetails(id),
                onHide: (item) => _showHideDialog(item),
                onUnavailable: (item) => _showUnavailableDialog(item),
                onRestore: (item) => _showRestoreDialog(item),
              )
            else
              _ReportsTab(
                compact: compact,
                onAction: _runAction,
                onViewMaterial: (id) => _showMaterialDetails(id),
                onReject: (report) => _showRejectReportDialog(report),
                onHideFromReport: (report) => _showHideFromReportDialog(report),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _showMaterialDetails(String id) async {
    final api = ref.read(adminMaterialsApiProvider);
    try {
      final detail = await api.fetchMaterialDetail(id);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) {
          final status = detail['status'] as String? ?? '';
          final actions = AdminMaterialModerationPolicy.actionsFromJson(
            detail['allowedActions'] as Map<String, dynamic>?,
            status,
          );
          return _MaterialDetailDialog(
            detail: detail,
            moderation: actions,
            onHide: actions.canHide
                ? () {
                    Navigator.pop(dialogContext);
                    _showHideDialogFromDetail(detail);
                  }
                : null,
            onUnavailable: actions.canMarkUnavailable
                ? () {
                    Navigator.pop(dialogContext);
                    _showUnavailableDialogFromDetail(detail);
                  }
                : null,
            onRestore: actions.canRestore
                ? () {
                    Navigator.pop(dialogContext);
                    _showRestoreDialogFromDetail(detail);
                  }
                : null,
          );
        },
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.displayMessage)));
    }
  }

  void _showHideDialog(AdminMaterialListItem item) {
    _showReasonDialog(
      title: 'Hide material',
      warning: 'This material will no longer appear in public discovery.',
      materialTitle: item.title,
      reasonLabel: 'Reason for hiding',
      reasonRequired: true,
      confirmLabel: 'Hide material',
      confirmTone: AppStatusTone.danger,
      onConfirm: (reason) => ref
          .read(adminMaterialsApiProvider)
          .hideMaterial(id: item.materialId, reason: reason),
      successMessage: 'Material hidden.',
    );
  }

  void _showHideDialogFromDetail(Map<String, dynamic> detail) {
    _showReasonDialog(
      title: 'Hide material',
      warning: 'This material will no longer appear in public discovery.',
      materialTitle: detail['title'] as String? ?? 'Material',
      reasonLabel: 'Reason for hiding',
      reasonRequired: true,
      confirmLabel: 'Hide material',
      confirmTone: AppStatusTone.danger,
      onConfirm: (reason) => ref
          .read(adminMaterialsApiProvider)
          .hideMaterial(id: detail['id'] as String, reason: reason),
      successMessage: 'Material hidden.',
    );
  }

  void _showUnavailableDialog(AdminMaterialListItem item) {
    _showReasonDialog(
      title: 'Mark unavailable',
      warning:
          'This will mark the material as unavailable and remove it from public discovery.',
      materialTitle: item.title,
      reasonLabel: 'Reason (optional)',
      reasonRequired: false,
      confirmLabel: 'Mark unavailable',
      confirmTone: AppStatusTone.danger,
      onConfirm: (reason) => ref
          .read(adminMaterialsApiProvider)
          .markUnavailable(
            id: item.materialId,
            reason: reason.isEmpty ? null : reason,
          ),
      successMessage: 'Material marked unavailable.',
    );
  }

  void _showUnavailableDialogFromDetail(Map<String, dynamic> detail) {
    _showReasonDialog(
      title: 'Mark unavailable',
      warning:
          'This will mark the material as unavailable and remove it from public discovery.',
      materialTitle: detail['title'] as String? ?? 'Material',
      reasonLabel: 'Reason (optional)',
      reasonRequired: false,
      confirmLabel: 'Mark unavailable',
      confirmTone: AppStatusTone.danger,
      onConfirm: (reason) => ref
          .read(adminMaterialsApiProvider)
          .markUnavailable(
            id: detail['id'] as String,
            reason: reason.isEmpty ? null : reason,
          ),
      successMessage: 'Material marked unavailable.',
    );
  }

  void _showRestoreDialog(AdminMaterialListItem item) {
    _showConfirmDialog(
      title: 'Restore material',
      message:
          'This will make the material visible again if it is safe to restore.',
      materialTitle: item.title,
      confirmLabel: 'Restore material',
      confirmTone: AppStatusTone.primary,
      onConfirm: () =>
          ref.read(adminMaterialsApiProvider).restoreMaterial(item.materialId),
      successMessage: 'Material restored.',
    );
  }

  void _showRestoreDialogFromDetail(Map<String, dynamic> detail) {
    _showConfirmDialog(
      title: 'Restore material',
      message:
          'This will make the material visible again if it is safe to restore.',
      materialTitle: detail['title'] as String? ?? 'Material',
      confirmLabel: 'Restore material',
      confirmTone: AppStatusTone.primary,
      onConfirm: () => ref
          .read(adminMaterialsApiProvider)
          .restoreMaterial(detail['id'] as String),
      successMessage: 'Material restored.',
    );
  }

  void _showRejectReportDialog(AdminMaterialReportListItem report) {
    _showReasonDialog(
      title: 'Reject report',
      warning: 'The material will remain visible. An admin note is required.',
      materialTitle: report.materialTitle,
      reasonLabel: 'Admin note',
      reasonRequired: true,
      confirmLabel: 'Reject report',
      confirmTone: AppStatusTone.danger,
      onConfirm: (note) => ref
          .read(adminMaterialsApiProvider)
          .rejectReport(id: report.reportId, adminNote: note),
      successMessage: 'Report rejected.',
    );
  }

  void _showHideFromReportDialog(AdminMaterialReportListItem report) {
    _showReasonDialog(
      title: 'Hide material from report',
      warning:
          'The material will be hidden and this report will be marked resolved.',
      materialTitle: report.materialTitle,
      reasonLabel: 'Admin note',
      reasonRequired: true,
      confirmLabel: 'Hide material',
      confirmTone: AppStatusTone.danger,
      onConfirm: (note) => ref
          .read(adminMaterialsApiProvider)
          .hideMaterialFromReport(id: report.reportId, adminNote: note),
      successMessage: 'Material hidden and report resolved.',
    );
  }

  Future<void> _showReasonDialog({
    required String title,
    required String warning,
    required String materialTitle,
    required String reasonLabel,
    required bool reasonRequired,
    required String confirmLabel,
    required AppStatusTone confirmTone,
    required Future<void> Function(String reason) onConfirm,
    required String successMessage,
  }) async {
    final controller = TextEditingController();
    var submitting = false;
    String? errorText;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AppDialogShell(
              title: Text(title),
              maxWidth: 460,
              closeEnabled: !submitting,
              content: SizedBox(
                width: 420,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(warning),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: context.adminPalette.bannerBackground,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: context.adminPalette.cardBorder,
                        ),
                      ),
                      child: Text(
                        materialTitle,
                        style: AdminTypography.sectionTitle(
                          context.adminPalette,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: controller,
                      maxLines: 4,
                      enabled: !submitting,
                      decoration: InputDecoration(
                        labelText: reasonLabel,
                        errorText: errorText,
                      ),
                    ),
                  ],
                ),
              ),
              footer: AppDialogFooter.decision(
                secondaryAction: TextButton(
                  onPressed: submitting
                      ? null
                      : () => Navigator.pop(dialogContext),
                  child: const Text('Cancel'),
                ),
                primaryAction: FilledButton(
                  style: AppStatusButtonStyle.filled(context, confirmTone),
                  onPressed: submitting
                      ? null
                      : () async {
                          final reason = controller.text.trim();
                          if (reasonRequired && reason.length < 3) {
                            setState(() {
                              errorText = 'Please enter at least 3 characters.';
                            });
                            return;
                          }
                          setState(() {
                            submitting = true;
                            errorText = null;
                          });
                          try {
                            await onConfirm(reason);
                            if (!mounted) return;
                            _refresh();
                            if (dialogContext.mounted) {
                              Navigator.pop(dialogContext);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(successMessage)),
                              );
                            }
                          } on ApiException catch (error) {
                            setState(() {
                              submitting = false;
                              errorText = error.displayMessage;
                            });
                          } catch (_) {
                            setState(() {
                              submitting = false;
                              errorText = 'Request failed. Please try again.';
                            });
                          }
                        },
                  child: submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(confirmLabel),
                ),
              ),
            );
          },
        );
      },
    );
    controller.dispose();
  }

  Future<void> _showConfirmDialog({
    required String title,
    required String message,
    required String materialTitle,
    required String confirmLabel,
    required AppStatusTone confirmTone,
    required Future<void> Function() onConfirm,
    required String successMessage,
  }) async {
    var submitting = false;
    String? errorText;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AppDialogShell(
              title: Text(title),
              maxWidth: 440,
              closeEnabled: !submitting,
              content: SizedBox(
                width: 400,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(message),
                    const SizedBox(height: 12),
                    Text(
                      materialTitle,
                      style: AdminTypography.sectionTitle(context.adminPalette),
                    ),
                    if (errorText != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        errorText!,
                        style: TextStyle(color: context.adminPalette.red),
                      ),
                    ],
                  ],
                ),
              ),
              footer: AppDialogFooter.decision(
                secondaryAction: TextButton(
                  onPressed: submitting
                      ? null
                      : () => Navigator.pop(dialogContext),
                  child: const Text('Cancel'),
                ),
                primaryAction: FilledButton(
                  style: AppStatusButtonStyle.filled(context, confirmTone),
                  onPressed: submitting
                      ? null
                      : () async {
                          setState(() => submitting = true);
                          try {
                            await onConfirm();
                            if (!mounted) return;
                            _refresh();
                            if (dialogContext.mounted) {
                              Navigator.pop(dialogContext);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(successMessage)),
                              );
                            }
                          } on ApiException catch (error) {
                            setState(() {
                              submitting = false;
                              errorText = error.displayMessage;
                            });
                          } catch (_) {
                            setState(() {
                              submitting = false;
                              errorText = 'Request failed. Please try again.';
                            });
                          }
                        },
                  child: submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(confirmLabel),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _SummaryMetricCard extends StatelessWidget {
  const _SummaryMetricCard({
    required this.width,
    required this.label,
    required this.value,
    required this.icon,
    required this.accent,
    this.highlight = false,
  });

  final double width;
  final String label;
  final int value;
  final IconData icon;
  final Color accent;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      width: width,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: highlight
              ? accent.withValues(alpha: 0.55)
              : palette.cardBorder,
          width: highlight ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: accent, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: AdminTypography.kpiHelper(palette)),
                Text('$value', style: AdminTypography.kpiValue(palette)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FiltersBar extends StatelessWidget {
  const _FiltersBar({
    required this.searchController,
    required this.filters,
    required this.onSearch,
    required this.onStatusChanged,
    required this.onReportStatusChanged,
    required this.onPriceFilterChanged,
    required this.onReset,
    required this.onRefresh,
    required this.showMaterialFilters,
  });

  final TextEditingController searchController;
  final _MaterialsFilters filters;
  final ValueChanged<String> onSearch;
  final ValueChanged<String> onStatusChanged;
  final ValueChanged<String> onReportStatusChanged;
  final ValueChanged<String> onPriceFilterChanged;
  final VoidCallback onReset;
  final VoidCallback onRefresh;
  final bool showMaterialFilters;

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
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: searchController,
            decoration: InputDecoration(
              filled: true,
              fillColor: palette.bannerBackground,
              hintText: 'Search materials, suppliers, categories...',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(
                icon: const Icon(Icons.clear),
                onPressed: () {
                  searchController.clear();
                  onSearch('');
                },
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: palette.cardBorder),
              ),
            ),
            onSubmitted: onSearch,
            onChanged: onSearch,
          ),
          if (showMaterialFilters) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _FilterDropdown(
                  key: ValueKey('status-${filters.status}'),
                  label: 'Status',
                  value: filters.status,
                  options: const {
                    'ALL': 'All statuses',
                    'AVAILABLE': 'Available',
                    'UNAVAILABLE': 'Unavailable',
                    'RESERVED': 'Reserved',
                    'REUSED': 'Reused',
                  },
                  onChanged: onStatusChanged,
                ),
                _FilterDropdown(
                  key: ValueKey('price-${filters.priceFilter}'),
                  label: 'Price',
                  value: filters.priceFilter,
                  options: const {'ALL': 'All', 'FREE': 'Free', 'PAID': 'Paid'},
                  onChanged: onPriceFilterChanged,
                ),
                _FilterDropdown(
                  key: ValueKey('reports-${filters.reportStatus}'),
                  label: 'Reports',
                  value: filters.reportStatus,
                  options: const {
                    'ALL': 'All',
                    'PENDING': 'Has pending reports',
                    'HAS_REPORTS': 'Reported',
                    'NONE': 'No reports',
                  },
                  onChanged: onReportStatusChanged,
                ),
              ],
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: onReset,
                icon: const Icon(Icons.filter_alt_off, size: 18),
                label: const Text('Reset'),
              ),
              FilledButton.tonalIcon(
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FilterDropdown extends StatelessWidget {
  const _FilterDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final String value;
  final Map<String, String> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownMenu<String>(
      label: Text(label),
      initialSelection: value,
      dropdownMenuEntries: options.entries
          .map(
            (entry) => DropdownMenuEntry(value: entry.key, label: entry.value),
          )
          .toList(),
      onSelected: (selected) {
        if (selected != null) onChanged(selected);
      },
    );
  }
}

class _MaterialsTab extends ConsumerWidget {
  const _MaterialsTab({
    required this.compact,
    required this.onAction,
    required this.onViewDetails,
    required this.onHide,
    required this.onUnavailable,
    required this.onRestore,
  });

  final bool compact;
  final Future<void> Function(
    Future<void> Function() action, {
    String successMessage,
  })
  onAction;
  final void Function(String id) onViewDetails;
  final void Function(AdminMaterialListItem item) onHide;
  final void Function(AdminMaterialListItem item) onUnavailable;
  final void Function(AdminMaterialListItem item) onRestore;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final materialsAsync = ref.watch(adminMaterialsListProvider);
    return materialsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => AdminEmptyState(
        icon: Icons.inventory_2_outlined,
        title: 'Could not load materials',
        subtitle: error.toString(),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const AdminEmptyState(
            icon: Icons.inventory_2_outlined,
            title: 'No materials found',
            subtitle: 'Try adjusting your filters or refresh the list.',
          );
        }
        return Column(
          children: items
              .map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _MaterialCard(
                    item: item,
                    onDetails: () => onViewDetails(item.materialId),
                    onHide: () => onHide(item),
                    onUnavailable: () => onUnavailable(item),
                    onRestore: () => onRestore(item),
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _ReportsTab extends ConsumerWidget {
  const _ReportsTab({
    required this.compact,
    required this.onAction,
    required this.onViewMaterial,
    required this.onReject,
    required this.onHideFromReport,
  });

  final bool compact;
  final Future<void> Function(
    Future<void> Function() action, {
    String successMessage,
  })
  onAction;
  final void Function(String materialId) onViewMaterial;
  final void Function(AdminMaterialReportListItem report) onReject;
  final void Function(AdminMaterialReportListItem report) onHideFromReport;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportsAsync = ref.watch(adminMaterialReportsProvider);
    return reportsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => AdminEmptyState(
        icon: Icons.flag_outlined,
        title: 'Could not load reports',
        subtitle: error.toString(),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const AdminEmptyState(
            icon: Icons.flag_outlined,
            title: 'No reports yet',
            subtitle: 'Reported materials will appear here for admin review.',
          );
        }
        return Column(
          children: items
              .map(
                (report) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _ReportCard(
                    report: report,
                    onViewMaterial: () => onViewMaterial(report.materialId),
                    onResolve: () => onAction(
                      () => ref
                          .read(adminMaterialsApiProvider)
                          .resolveReport(id: report.reportId),
                      successMessage: 'Report resolved.',
                    ),
                    onReject: () => onReject(report),
                    onHideMaterial: () => onHideFromReport(report),
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

enum _CardActionVariant { neutral, hide, unavailable, restore }

class _CardActionButton extends StatelessWidget {
  const _CardActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    required this.variant,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final _CardActionVariant variant;

  static const _height = 36.0;
  static const _radius = 8.0;
  static const _iconSize = 16.0;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final labelStyle = AdminTypography.kpiHelper(
      palette,
    ).copyWith(fontSize: 13, fontWeight: FontWeight.w600);

    switch (variant) {
      case _CardActionVariant.restore:
        return FilledButton.icon(
          onPressed: onPressed,
          icon: Icon(icon, size: _iconSize),
          label: Text(label, style: labelStyle.copyWith(color: Colors.white)),
          style: FilledButton.styleFrom(
            minimumSize: const Size(0, _height),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            backgroundColor: palette.green,
            foregroundColor: Colors.white,
            visualDensity: VisualDensity.compact,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(_radius),
            ),
          ),
        );
      case _CardActionVariant.neutral:
        return OutlinedButton.icon(
          onPressed: onPressed,
          icon: Icon(icon, size: _iconSize, color: palette.textSecondary),
          label: Text(
            label,
            style: labelStyle.copyWith(color: palette.textSecondary),
          ),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, _height),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            foregroundColor: palette.textSecondary,
            side: BorderSide(color: palette.cardBorder),
            visualDensity: VisualDensity.compact,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(_radius),
            ),
          ),
        );
      case _CardActionVariant.hide:
        return OutlinedButton.icon(
          onPressed: onPressed,
          icon: Icon(icon, size: _iconSize, color: palette.amber),
          label: Text(label, style: labelStyle.copyWith(color: palette.amber)),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, _height),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            foregroundColor: palette.amber,
            backgroundColor: palette.amber.withValues(alpha: 0.1),
            side: BorderSide(color: palette.amber.withValues(alpha: 0.45)),
            visualDensity: VisualDensity.compact,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(_radius),
            ),
          ),
        );
      case _CardActionVariant.unavailable:
        return OutlinedButton.icon(
          onPressed: onPressed,
          icon: Icon(icon, size: _iconSize, color: palette.textPrimary),
          label: Text(
            label,
            style: labelStyle.copyWith(color: palette.textPrimary),
          ),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, _height),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            foregroundColor: palette.textPrimary,
            backgroundColor: palette.textMuted.withValues(alpha: 0.12),
            side: BorderSide(color: palette.textMuted.withValues(alpha: 0.55)),
            visualDensity: VisualDensity.compact,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(_radius),
            ),
          ),
        );
    }
  }
}

class _MaterialCard extends StatelessWidget {
  const _MaterialCard({
    required this.item,
    required this.onDetails,
    required this.onHide,
    required this.onUnavailable,
    required this.onRestore,
  });

  final AdminMaterialListItem item;
  final VoidCallback onDetails;
  final VoidCallback onHide;
  final VoidCallback onUnavailable;
  final VoidCallback onRestore;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final accent = _cardAccent(context, item);
    final date = DateFormat.yMMMd().format(item.createdAt);
    final priceLabel = item.isFree
        ? 'Free'
        : '${item.price?.toStringAsFixed(0) ?? '—'} ${item.currency}';
    final moderation = AdminMaterialModerationPolicy.actionsFor(item.status);

    return Container(
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.cardBorder),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border(left: BorderSide(color: accent, width: 4)),
        ),
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _MaterialThumb(imageUrl: item.imageUrl),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        style: AdminTypography.sectionTitle(palette),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.supplierName,
                        style: AdminTypography.pageSubtitle(palette),
                      ),
                      Text(
                        item.categoryName,
                        style: AdminTypography.kpiHelper(palette),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                MaterialStatusBadge(
                  label: _formatStatusLabel(item.status),
                  tone: materialLifecycleStatusTone(item.status),
                ),
                _SemanticBadge(
                  label: item.isFree ? 'Free' : 'Paid',
                  tone: item.isFree ? _BadgeTone.teal : _BadgeTone.paid,
                ),
                _SemanticBadge(
                  label: priceLabel,
                  tone: item.isFree ? _BadgeTone.teal : _BadgeTone.paid,
                ),
                _SemanticBadge(
                  label: item.condition.replaceAll('_', ' '),
                  tone: _BadgeTone.neutral,
                ),
                AppStatusBadge(
                  label: _formatStatusLabel(item.supplierVerificationStatus),
                  tone: supplierVerificationStatusTone(
                    item.supplierVerificationStatus,
                  ),
                ),
                if (item.pendingReportCount > 0)
                  _SemanticBadge(
                    label:
                        '${item.pendingReportCount} pending report${item.pendingReportCount == 1 ? '' : 's'}',
                    tone: _BadgeTone.warning,
                  )
                else if (item.reportCount > 0)
                  _SemanticBadge(
                    label: '${item.reportCount} report(s)',
                    tone: _BadgeTone.warning,
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '${item.city}${item.area == null ? '' : ', ${item.area}'} • ${item.quantity} ${item.unit} • $date',
              style: AdminTypography.kpiHelper(palette),
            ),
            const SizedBox(height: 12),
            if (moderation.listLockNote != null) ...[
              Text(
                moderation.listLockNote!,
                style: AdminTypography.kpiHelper(palette).copyWith(
                  color: palette.textMuted,
                  fontStyle: FontStyle.italic,
                ),
              ),
              const SizedBox(height: 8),
            ],
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _CardActionButton(
                  label: 'Details',
                  icon: Icons.visibility_outlined,
                  onPressed: onDetails,
                  variant: _CardActionVariant.neutral,
                ),
                if (moderation.canHide)
                  _CardActionButton(
                    label: 'Hide',
                    icon: Icons.visibility_off_outlined,
                    onPressed: onHide,
                    variant: _CardActionVariant.hide,
                  ),
                if (moderation.canMarkUnavailable)
                  _CardActionButton(
                    label: 'Mark unavailable',
                    icon: Icons.block_outlined,
                    onPressed: onUnavailable,
                    variant: _CardActionVariant.unavailable,
                  ),
                if (moderation.canRestore)
                  _CardActionButton(
                    label: 'Restore',
                    icon: Icons.restore,
                    onPressed: onRestore,
                    variant: _CardActionVariant.restore,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MaterialThumb extends StatelessWidget {
  const _MaterialThumb({this.imageUrl});

  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final resolved = imageUrl == null || imageUrl!.isEmpty
        ? null
        : ApiConfig.resolveMediaUrl(imageUrl!);

    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: 72,
        height: 72,
        color: palette.bannerBackground,
        child: resolved == null
            ? Icon(Icons.image_outlined, color: palette.textMuted)
            : Image.network(
                resolved,
                width: 72,
                height: 72,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) =>
                    Icon(Icons.broken_image_outlined, color: palette.textMuted),
              ),
      ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({
    required this.report,
    required this.onViewMaterial,
    required this.onResolve,
    required this.onReject,
    required this.onHideMaterial,
  });

  final AdminMaterialReportListItem report;
  final VoidCallback onViewMaterial;
  final VoidCallback onResolve;
  final VoidCallback onReject;
  final VoidCallback onHideMaterial;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final created = DateFormat.yMMMd().add_jm().format(report.createdAt);
    final canHideMaterial = AdminMaterialModerationPolicy.canHide(
      report.materialStatus,
    );

    return Container(
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.amber.withValues(alpha: 0.35)),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ColoredBox(color: palette.amber, child: const SizedBox(width: 4)),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        report.materialTitle,
                        style: AdminTypography.sectionTitle(palette),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${report.supplierName} • reported by ${report.reporterName}',
                        style: AdminTypography.pageSubtitle(palette),
                      ),
                      Text(
                        report.reporterEmail,
                        style: AdminTypography.kpiHelper(palette),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          _SemanticBadge(
                            label: _formatReportReason(report.reason),
                            tone: _BadgeTone.warning,
                          ),
                          AppStatusBadge(
                            label: _formatStatusLabel(report.status),
                            tone: reviewStatusTone(report.status),
                          ),
                        ],
                      ),
                      if (report.note != null &&
                          report.note!.trim().isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          report.note!,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: AdminTypography.pageSubtitle(palette),
                        ),
                      ],
                      const SizedBox(height: 6),
                      Text(
                        'Submitted $created',
                        style: AdminTypography.kpiHelper(palette),
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          OutlinedButton.icon(
                            onPressed: onViewMaterial,
                            style: AppStatusButtonStyle.outlined(
                              context,
                              AppStatusTone.neutral,
                            ),
                            icon: const Icon(Icons.open_in_new, size: 18),
                            label: const Text('View material'),
                          ),
                          FilledButton.icon(
                            onPressed: onResolve,
                            style: AppStatusButtonStyle.filled(
                              context,
                              AppStatusTone.success,
                            ),
                            icon: const Icon(
                              Icons.check_circle_outline,
                              size: 18,
                            ),
                            label: const Text('Resolve'),
                          ),
                          OutlinedButton.icon(
                            onPressed: onReject,
                            style: AppStatusButtonStyle.outlined(
                              context,
                              AppStatusTone.danger,
                            ),
                            icon: const Icon(Icons.cancel_outlined, size: 18),
                            label: const Text('Reject'),
                          ),
                          if (canHideMaterial)
                            OutlinedButton.icon(
                              onPressed: onHideMaterial,
                              style: AppStatusButtonStyle.outlined(
                                context,
                                AppStatusTone.danger,
                              ),
                              icon: const Icon(
                                Icons.visibility_off_outlined,
                                size: 18,
                              ),
                              label: const Text('Hide material'),
                            ),
                        ],
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

class _SemanticBadge extends StatelessWidget {
  const _SemanticBadge({required this.label, required this.tone});

  final String label;
  final _BadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final color = _toneColor(palette, tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Text(
        label,
        style: AdminTypography.kpiHelper(
          palette,
        ).copyWith(color: color, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _MaterialDetailDialog extends StatelessWidget {
  const _MaterialDetailDialog({
    required this.detail,
    required this.moderation,
    this.onHide,
    this.onUnavailable,
    this.onRestore,
  });

  final Map<String, dynamic> detail;
  final AdminMaterialModerationActions moderation;
  final VoidCallback? onHide;
  final VoidCallback? onUnavailable;
  final VoidCallback? onRestore;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final supplier = detail['supplier'] as Map<String, dynamic>? ?? {};
    final category = detail['category'] as Map<String, dynamic>? ?? {};
    final location = detail['location'] as Map<String, dynamic>? ?? {};
    final reportSummary =
        detail['reportSummary'] as Map<String, dynamic>? ?? {};
    final images = detail['images'] as List<dynamic>? ?? [];
    final latestReports = detail['latestReports'] as List<dynamic>? ?? [];
    final isFree = detail['isFree'] as bool? ?? true;
    final pendingCount = (reportSummary['pendingCount'] as num?)?.toInt() ?? 0;
    final totalReports = (reportSummary['totalCount'] as num?)?.toInt() ?? 0;

    return AlertDialog(
      title: null,
      contentPadding: EdgeInsets.zero,
      content: SizedBox(
        width: 640,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.78,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 14),
                decoration: BoxDecoration(
                  color: palette.bannerBackground,
                  border: Border(bottom: BorderSide(color: palette.cardBorder)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            detail['title'] as String? ?? 'Material details',
                            style: AdminTypography.pageTitle(
                              palette,
                            ).copyWith(fontSize: 18),
                          ),
                        ),
                        AppCloseButton(
                          onPressed: () => Navigator.of(context).pop(),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        MaterialStatusBadge(
                          label: _formatStatusLabel(
                            detail['status'] as String? ?? 'UNKNOWN',
                          ),
                          tone: materialLifecycleStatusTone(
                            detail['status'] as String? ?? '',
                          ),
                        ),
                        _SemanticBadge(
                          label: isFree ? 'Free' : 'Paid',
                          tone: isFree ? _BadgeTone.success : _BadgeTone.paid,
                        ),
                        if (pendingCount > 0)
                          _SemanticBadge(
                            label: '$pendingCount pending report(s)',
                            tone: _BadgeTone.warning,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (moderation.detailLockMessage != null) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: palette.bannerBackground,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: palette.cardBorder),
                          ),
                          child: Text(
                            moderation.detailLockMessage!,
                            style: AdminTypography.pageSubtitle(
                              palette,
                            ).copyWith(color: palette.textMuted),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                      if (images.isNotEmpty) ...[
                        _DetailSection(
                          title: 'Images',
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: images.take(4).map((raw) {
                              final image = Map<String, dynamic>.from(
                                raw as Map,
                              );
                              final url = image['imageUrl'] as String?;
                              if (url == null) return const SizedBox.shrink();
                              return ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: Image.network(
                                  ApiConfig.resolveMediaUrl(url),
                                  width: 96,
                                  height: 96,
                                  fit: BoxFit.cover,
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ],
                      _DetailSection(
                        title: 'Material overview',
                        child: _DetailGrid(
                          entries: [
                            _DetailEntry('Description', detail['description']),
                            _DetailEntry('Category', category['nameEn']),
                            _DetailEntry('Condition', detail['condition']),
                            _DetailEntry('Source', detail['sourceType']),
                            _DetailEntry(
                              'Quantity',
                              '${detail['quantity']} ${detail['unit']}',
                            ),
                            _DetailEntry(
                              'Created',
                              _formatDate(detail['createdAt'] as String?),
                            ),
                            _DetailEntry(
                              'Updated',
                              _formatDate(detail['updatedAt'] as String?),
                            ),
                          ],
                        ),
                      ),
                      _DetailSection(
                        title: 'Supplier',
                        child: _DetailGrid(
                          entries: [
                            _DetailEntry('Name', supplier['displayName']),
                            _DetailEntry('Email', supplier['email']),
                            _DetailEntry(
                              'Verification',
                              supplier['verificationStatus'],
                            ),
                            if (supplier['organization'] is Map)
                              _DetailEntry(
                                'Organization',
                                (supplier['organization']
                                        as Map)['organizationName']
                                    as String?,
                              ),
                          ],
                        ),
                      ),
                      _DetailSection(
                        title: 'Location & fulfillment',
                        child: _DetailGrid(
                          entries: [
                            _DetailEntry(
                              'Location',
                              '${location['city'] ?? ''}${location['area'] == null ? '' : ', ${location['area']}'}',
                            ),
                            _DetailEntry(
                              'Pickup allowed',
                              '${detail['pickupAllowed'] ?? false}',
                            ),
                            _DetailEntry(
                              'Delivery allowed',
                              '${detail['deliveryAllowed'] ?? false}',
                            ),
                            _DetailEntry('Pickup notes', detail['pickupNotes']),
                          ],
                        ),
                      ),
                      _DetailSection(
                        title: 'Pricing',
                        child: _DetailGrid(
                          entries: [
                            _DetailEntry('Type', isFree ? 'Free' : 'Paid'),
                            if (!isFree)
                              _DetailEntry(
                                'Price',
                                '${detail['price']} ${detail['currency']}',
                              ),
                            _DetailEntry(
                              'Max at check',
                              detail['maxAllowedPriceAtCheck']?.toString(),
                            ),
                          ],
                        ),
                      ),
                      _DetailSection(
                        title: 'Reports',
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '$pendingCount pending • $totalReports total',
                              style: AdminTypography.pageSubtitle(palette),
                            ),
                            if (latestReports.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              ...latestReports.take(3).map((raw) {
                                final report = Map<String, dynamic>.from(
                                  raw as Map,
                                );
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: palette.bannerBackground,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: palette.cardBorder,
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          _formatReportReason(
                                            report['reason'] as String? ?? '',
                                          ),
                                          style: AdminTypography.kpiLabel(
                                            palette,
                                          ),
                                        ),
                                        if (report['note'] != null)
                                          Text(
                                            '${report['note']}',
                                            style: AdminTypography.kpiHelper(
                                              palette,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                );
                              }),
                            ],
                          ],
                        ),
                      ),
                      _DetailSection(
                        title: 'Moderation',
                        child: _DetailGrid(
                          entries: [
                            _DetailEntry('Status', detail['status']),
                            _DetailEntry(
                              'Moderation reason',
                              detail['moderationReason'],
                            ),
                            _DetailEntry(
                              'Moderated at',
                              _formatDate(detail['moderatedAt'] as String?),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: palette.cardBorder)),
                ),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  alignment: WrapAlignment.end,
                  children: [
                    if (onHide != null)
                      OutlinedButton(
                        onPressed: onHide,
                        style: AppStatusButtonStyle.outlined(
                          context,
                          AppStatusTone.danger,
                        ),
                        child: const Text('Hide'),
                      ),
                    if (onUnavailable != null)
                      OutlinedButton(
                        onPressed: onUnavailable,
                        style: AppStatusButtonStyle.outlined(
                          context,
                          AppStatusTone.danger,
                        ),
                        child: const Text('Mark unavailable'),
                      ),
                    if (onRestore != null)
                      FilledButton(
                        onPressed: onRestore,
                        style: AppStatusButtonStyle.filled(
                          context,
                          AppStatusTone.primary,
                        ),
                        child: const Text('Restore'),
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

  String? _formatDate(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    final parsed = DateTime.tryParse(iso);
    if (parsed == null) return iso;
    return DateFormat.yMMMd().add_jm().format(parsed);
  }
}

class _DetailSection extends StatelessWidget {
  const _DetailSection({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AdminTypography.sectionTitle(palette)),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: palette.bannerBackground,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: palette.cardBorder),
            ),
            child: child,
          ),
        ],
      ),
    );
  }
}

class _DetailEntry {
  const _DetailEntry(this.label, this.value);

  final String label;
  final dynamic value;
}

class _DetailGrid extends StatelessWidget {
  const _DetailGrid({required this.entries});

  final List<_DetailEntry> entries;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final visible = entries
        .where(
          (entry) =>
              entry.value != null && entry.value.toString().trim().isNotEmpty,
        )
        .toList();
    if (visible.isEmpty) {
      return Text(
        'No details available.',
        style: AdminTypography.kpiHelper(palette),
      );
    }
    return Column(
      children: visible
          .map(
            (entry) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 130,
                    child: Text(
                      entry.label,
                      style: AdminTypography.kpiHelper(palette),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      '${entry.value}',
                      style: AdminTypography.kpiLabel(palette),
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}
