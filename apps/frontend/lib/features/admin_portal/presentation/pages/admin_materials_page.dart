import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/config/api_config.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_detail.dart';
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
    final pageTint = palette.isDark
        ? palette.pageBackground
        : palette.primaryTeal.withValues(alpha: 0.04);

    return ColoredBox(
      color: pageTint,
      child: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.fromSTEB(28, 20, 28, 28),
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
              data: (summary) => _MaterialsKpiRow(summary: summary),
            ),
            const SizedBox(height: 16),
            _MaterialsTabSwitch(
              value: filters.tab,
              onChanged: (value) =>
                  ref.read(_materialsFiltersProvider.notifier).setTab(value),
            ),
            const SizedBox(height: 16),
            _FiltersPanel(
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
                onViewDetails: (id) => _showMaterialDetails(id),
                onHide: (item) => _showHideDialog(item),
                onUnavailable: (item) => _showUnavailableDialog(item),
                onRestore: (item) => _showRestoreDialog(item),
              )
            else
              _ReportsTab(
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

/// Balanced 5-up KPI row on wide desktop; wraps to fewer columns on
/// medium/narrow widths without leaving an oversized trailing card.
class _MaterialsKpiRow extends StatelessWidget {
  const _MaterialsKpiRow({required this.summary});

  final AdminMaterialsSummary summary;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    final cards = <_KpiCard>[
      _KpiCard(
        icon: Icons.inventory_2_outlined,
        label: 'Total materials',
        value: summary.total,
        hint: 'All materials in system',
        accent: palette.primaryTeal,
      ),
      _KpiCard(
        icon: Icons.check_circle_outline,
        label: 'Available',
        value: summary.available,
        hint: 'Ready to reserve',
        accent: palette.green,
      ),
      _KpiCard(
        icon: Icons.payments_outlined,
        label: 'Paid',
        value: summary.paid,
        hint: 'Paid materials',
        accent: palette.purple,
      ),
      _KpiCard(
        icon: Icons.visibility_off_outlined,
        label: 'Unavailable',
        value: summary.unavailable,
        hint: 'Not available',
        accent: palette.textMuted,
      ),
      _KpiCard(
        icon: Icons.flag_outlined,
        label: 'Reported',
        value: summary.reported,
        hint: 'Flagged by users',
        accent: palette.amber,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final columns = width >= 1000
            ? 5
            : width >= 720
            ? 3
            : width >= 480
            ? 2
            : 1;
        const spacing = 14.0;

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
                    for (var j = 0; j < columns; j++) ...[
                      if (j > 0) const SizedBox(width: spacing),
                      Expanded(
                        child: j < chunk.length
                            ? chunk[j]
                            : const SizedBox.shrink(),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        }

        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
      },
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.hint,
    required this.accent,
  });

  final IconData icon;
  final String label;
  final int value;
  final String hint;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: palette.cardBorder),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(icon, color: accent, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AdminTypography.kpiHelper(
                    palette,
                  ).copyWith(fontWeight: FontWeight.w700, color: palette.textSecondary),
                ),
                const SizedBox(height: 4),
                Text('$value', style: AdminTypography.kpiValue(palette)),
                const SizedBox(height: 3),
                Text(
                  hint,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AdminTypography.kpiHelper(palette),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact left-aligned Materials/Reported switch matching the reference —
/// a bordered pill container with a solid green fill on the active segment.
class _MaterialsTabSwitch extends StatelessWidget {
  const _MaterialsTabSwitch({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  static const _preferredWidth = 410.0;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth < _preferredWidth
            ? constraints.maxWidth
            : _preferredWidth;
        return Align(
          alignment: AlignmentDirectional.centerStart,
          child: Container(
            width: width,
            height: 42,
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: palette.cardBackground,
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: palette.cardBorder),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _TabSegment(
                    label: 'Materials',
                    icon: Icons.grid_view_rounded,
                    selected: value == 'MATERIALS',
                    onTap: () => onChanged('MATERIALS'),
                  ),
                ),
                Expanded(
                  child: _TabSegment(
                    label: 'Reported',
                    icon: Icons.flag_outlined,
                    selected: value == 'REPORTS',
                    onTap: () => onChanged('REPORTS'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _TabSegment extends StatelessWidget {
  const _TabSegment({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? palette.primaryTeal : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: selected ? Colors.white : palette.textSecondary),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: selected ? Colors.white : palette.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Dense rounded filter panel: search + supported dropdowns on one row,
/// Reset/Refresh on a second row. Category/Location controls are omitted —
/// they are not wired to the current materials API/filters state.
class _FiltersPanel extends StatelessWidget {
  const _FiltersPanel({
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
    final compact = MediaQuery.sizeOf(context).width < 900;

    final searchField = TextField(
      controller: searchController,
      decoration: InputDecoration(
        isDense: true,
        filled: true,
        fillColor: palette.cardBackground,
        hintText: 'Search materials, suppliers, categories...',
        prefixIcon: Icon(Icons.search, size: 19, color: palette.textSecondary),
        contentPadding: const EdgeInsets.symmetric(vertical: 13, horizontal: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: palette.cardBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: palette.primaryTeal, width: 1.4),
        ),
      ),
      onSubmitted: onSearch,
      onChanged: onSearch,
    );

    final statusField = _FilterField(
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
    );
    final priceField = _FilterField(
      label: 'Price',
      value: filters.priceFilter,
      options: const {'ALL': 'All', 'FREE': 'Free', 'PAID': 'Paid'},
      onChanged: onPriceFilterChanged,
    );
    final reportsField = _FilterField(
      label: 'Reports',
      value: filters.reportStatus,
      options: const {
        'ALL': 'All',
        'PENDING': 'Has pending reports',
        'HAS_REPORTS': 'Reported',
        'NONE': 'No reports',
      },
      onChanged: onReportStatusChanged,
    );

    final resetButton = OutlinedButton.icon(
      onPressed: onReset,
      icon: const Icon(Icons.filter_alt_off_outlined, size: 17),
      label: const Text('Reset'),
      style: OutlinedButton.styleFrom(
        foregroundColor: palette.textSecondary,
        side: BorderSide(color: palette.cardBorder),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
    final refreshButton = FilledButton.icon(
      onPressed: onRefresh,
      icon: const Icon(Icons.refresh, size: 17),
      label: const Text('Refresh'),
      style: FilledButton.styleFrom(
        backgroundColor: palette.primaryTeal,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );

    return Container(
      padding: const EdgeInsets.all(16),
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
          if (!showMaterialFilters)
            searchField
          else if (compact)
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                searchField,
                const SizedBox(height: 10),
                statusField,
                const SizedBox(height: 10),
                priceField,
                const SizedBox(height: 10),
                reportsField,
              ],
            )
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: searchField),
                const SizedBox(width: 12),
                SizedBox(width: 168, child: statusField),
                const SizedBox(width: 12),
                SizedBox(width: 130, child: priceField),
                const SizedBox(width: 12),
                SizedBox(width: 190, child: reportsField),
              ],
            ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [resetButton, refreshButton],
          ),
        ],
      ),
    );
  }
}

class _FilterField extends StatelessWidget {
  const _FilterField({
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
    final palette = context.adminPalette;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: AdminTypography.kpiHelper(
            palette,
          ).copyWith(fontWeight: FontWeight.w700, color: palette.textSecondary),
        ),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          key: ValueKey('$label-$value'),
          initialValue: value,
          isExpanded: true,
          icon: Icon(Icons.keyboard_arrow_down, size: 18, color: palette.textSecondary),
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: palette.textPrimary,
          ),
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: palette.cardBackground,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: palette.cardBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: palette.primaryTeal, width: 1.4),
            ),
          ),
          items: options.entries
              .map(
                (entry) => DropdownMenuItem(
                  value: entry.key,
                  child: Text(entry.value, overflow: TextOverflow.ellipsis),
                ),
              )
              .toList(),
          onChanged: (selected) {
            if (selected != null) onChanged(selected);
          },
        ),
      ],
    );
  }
}

class _MaterialsTab extends ConsumerWidget {
  const _MaterialsTab({
    required this.onViewDetails,
    required this.onHide,
    required this.onUnavailable,
    required this.onRestore,
  });

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
        return LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxWidth < 900;
            return _ListShell(
              rows: [
                for (var i = 0; i < items.length; i++)
                  _MaterialRow(
                    item: items[i],
                    compact: compact,
                    showDivider: i < items.length - 1,
                    onDetails: () => onViewDetails(items[i].materialId),
                    onHide: () => onHide(items[i]),
                    onUnavailable: () => onUnavailable(items[i]),
                    onRestore: () => onRestore(items[i]),
                  ),
              ],
            );
          },
        );
      },
    );
  }
}

class _ReportsTab extends ConsumerWidget {
  const _ReportsTab({
    required this.onAction,
    required this.onViewMaterial,
    required this.onReject,
    required this.onHideFromReport,
  });

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
        return LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxWidth < 900;
            return _ListShell(
              rows: [
                for (var i = 0; i < items.length; i++)
                  _ReportRow(
                    report: items[i],
                    compact: compact,
                    showDivider: i < items.length - 1,
                    onViewMaterial: () => onViewMaterial(items[i].materialId),
                    onResolve: () => onAction(
                      () => ref
                          .read(adminMaterialsApiProvider)
                          .resolveReport(id: items[i].reportId),
                      successMessage: 'Report resolved.',
                    ),
                    onReject: () => onReject(items[i]),
                    onHideMaterial: () => onHideFromReport(items[i]),
                  ),
              ],
            );
          },
        );
      },
    );
  }
}

/// Single rounded white container that wraps every row — replaces the old
/// stack of separately-shadowed cards with subtle in-list dividers.
class _ListShell extends StatelessWidget {
  const _ListShell({required this.rows});

  final List<Widget> rows;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
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
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows),
    );
  }
}

/// One compact horizontal row on desktop (image | identity | metrics+actions);
/// stacks into a compact card on narrow widths.
class _MaterialRow extends StatefulWidget {
  const _MaterialRow({
    required this.item,
    required this.compact,
    required this.showDivider,
    required this.onDetails,
    required this.onHide,
    required this.onUnavailable,
    required this.onRestore,
  });

  final AdminMaterialListItem item;
  final bool compact;
  final bool showDivider;
  final VoidCallback onDetails;
  final VoidCallback onHide;
  final VoidCallback onUnavailable;
  final VoidCallback onRestore;

  @override
  State<_MaterialRow> createState() => _MaterialRowState();
}

class _MaterialRowState extends State<_MaterialRow> {
  var _hovered = false;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final item = widget.item;
    final moderation = AdminMaterialModerationPolicy.actionsFor(item.status);

    final image = _RowImage(imageUrl: item.imageUrl);
    final identity = _MaterialIdentityBlock(item: item, moderation: moderation);
    final summary = _MaterialManagementSummary(item: item);
    final actions = _MaterialActionArea(
      moderation: moderation,
      onDetails: widget.onDetails,
      onHide: widget.onHide,
      onUnavailable: widget.onUnavailable,
      onRestore: widget.onRestore,
    );

    final content = widget.compact
        ? Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    image,
                    const SizedBox(width: AppSpacing.md),
                    Expanded(child: identity),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                summary,
                const SizedBox(height: AppSpacing.sm),
                actions,
              ],
            ),
          )
        : Padding(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                image,
                const SizedBox(width: AppSpacing.md),
                Expanded(child: identity),
                const SizedBox(width: AppSpacing.md),
                Container(
                  width: 1,
                  height: 88,
                  color: colors.borderSubtle.withValues(alpha: 0.6),
                ),
                const SizedBox(width: AppSpacing.lg),
                ConstrainedBox(
                  constraints: const BoxConstraints(minWidth: 280, maxWidth: 340),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      summary,
                      const SizedBox(height: AppSpacing.sm + 4),
                      actions,
                    ],
                  ),
                ),
              ],
            ),
          );

    final row = Container(
      decoration: BoxDecoration(
        color: _hovered ? colors.surfaceMuted.withValues(alpha: 0.5) : Colors.transparent,
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

/// Fixed-size image tile shared by both tabs so rows stay visually aligned.
class _RowImage extends StatelessWidget {
  const _RowImage({this.imageUrl});

  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final resolved = imageUrl == null || imageUrl!.isEmpty
        ? null
        : ApiConfig.resolveMediaUrl(imageUrl!);

    return ClipRRect(
      borderRadius: BorderRadius.circular(11),
      child: Container(
        width: 140,
        height: 96,
        color: colors.surfaceMuted,
        alignment: Alignment.center,
        child: resolved == null
            ? Icon(Icons.image_outlined, color: colors.textMuted, size: 26)
            : Image.network(
                resolved,
                width: 140,
                height: 96,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) =>
                    Icon(Icons.broken_image_outlined, color: colors.textMuted, size: 26),
              ),
      ),
    );
  }
}

class _MaterialIdentityBlock extends StatelessWidget {
  const _MaterialIdentityBlock({required this.item, required this.moderation});

  final AdminMaterialListItem item;
  final AdminMaterialModerationActions moderation;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final date = DateFormat.yMMMd().format(item.createdAt);
    final location = [
      item.city,
      if (item.area != null && item.area!.trim().isNotEmpty) item.area,
    ].whereType<String>().where((value) => value.trim().isNotEmpty).join(', ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          item.title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '${item.supplierName}  •  ${item.categoryName}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: colors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        _MaterialBadgeRow(item: item),
        const SizedBox(height: 8),
        _MetadataLine(
          location: location,
          quantity: '${_formatQuantity(item.quantity)} ${item.unit}'.trim(),
          condition: item.condition,
          date: date,
        ),
        if (moderation.listLockNote != null) ...[
          const SizedBox(height: 6),
          const _LockIndicator(),
        ],
      ],
    );
  }
}

String _formatQuantity(double value) {
  return value == value.roundToDouble()
      ? value.toStringAsFixed(0)
      : value.toString();
}

/// One compact muted metadata row: location · quantity · condition · date.
/// Condition is intentionally plain text (no chip/border) so it reads as
/// metadata rather than another status pill.
class _MetadataLine extends StatelessWidget {
  const _MetadataLine({
    required this.location,
    required this.quantity,
    required this.condition,
    required this.date,
  });

  final String location;
  final String quantity;
  final String condition;
  final String date;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final style = Theme.of(
      context,
    ).textTheme.bodySmall?.copyWith(color: colors.textMuted, height: 1.3);

    Widget chip(IconData icon, String text) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: colors.textMuted),
        const SizedBox(width: 4),
        Text(text, style: style),
      ],
    );

    Widget dot() => Text('·', style: style);

    final parts = <Widget>[
      if (location.isNotEmpty) chip(Icons.location_on_outlined, location),
      if (quantity.trim().isNotEmpty) chip(Icons.inventory_2_outlined, quantity),
      if (condition.trim().isNotEmpty) Text(_displayEnum(condition), style: style),
      chip(Icons.calendar_today_outlined, date),
    ];

    return Wrap(
      spacing: 8,
      runSpacing: 4,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        for (var i = 0; i < parts.length; i++) ...[
          if (i > 0) dot(),
          parts[i],
        ],
      ],
    );
  }
}

/// Strict 3-badge cap: workflow status, Free/Paid, price when paid.
/// Condition moved to the metadata line; supplier verification (moderation)
/// status is shown once, in the right-hand management summary only —
/// duplicating it here would repeat the same fact twice on one row.
class _MaterialBadgeRow extends StatelessWidget {
  const _MaterialBadgeRow({required this.item});

  final AdminMaterialListItem item;

  @override
  Widget build(BuildContext context) {
    final priceLabel = item.isFree
        ? null
        : '${item.price?.toStringAsFixed(0) ?? '—'} ${item.currency}';

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        MaterialStatusBadge(
          label: _displayEnum(item.status),
          tone: materialLifecycleStatusTone(item.status),
        ),
        _SemanticBadge(
          label: item.isFree ? 'Free' : 'Paid',
          tone: item.isFree ? _BadgeTone.teal : _BadgeTone.paid,
        ),
        if (priceLabel != null)
          _SemanticBadge(label: priceLabel, tone: _BadgeTone.paid),
      ],
    );
  }
}

/// Compact moderation-lock indicator: just an icon and short text, no
/// box/border, so it never meaningfully increases row height. The full
/// explanation is available via tooltip/semantics on hover or long-press.
class _LockIndicator extends StatelessWidget {
  const _LockIndicator();

  static const _fullReason =
      'Moderation actions are locked due to the current reservation or reuse status.';

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Tooltip(
      message: _fullReason,
      child: Semantics(
        label: _fullReason,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock_outline, size: 13, color: colors.warningText),
            const SizedBox(width: 4),
            Text(
              'Moderation locked',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: colors.warningText,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Top level of the management cluster: an optional reports metric on the
/// left (only rendered when there is something real to report) and the
/// moderation status pinned to the right — shown once, not repeated in the
/// left badge row. Views are not exposed by the current admin materials
/// list API.
class _MaterialManagementSummary extends StatelessWidget {
  const _MaterialManagementSummary({required this.item});

  final AdminMaterialListItem item;

  @override
  Widget build(BuildContext context) {
    final verificationTone = supplierVerificationStatusTone(item.supplierVerificationStatus);
    final verificationStyle = AppStatusStyle.of(context, verificationTone);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        if (item.reportCount > 0) _ReportsMetric(item: item),
        const Spacer(),
        Icon(Icons.verified_outlined, size: 14, color: verificationStyle.foreground),
        const SizedBox(width: 6),
        AppStatusBadge(
          label: _displayEnum(item.supplierVerificationStatus),
          tone: verificationTone,
        ),
      ],
    );
  }
}

/// Compact reports metric — only ever rendered when `reportCount > 0`, so
/// a row with no reports never reserves a metric column. Prioritizes the
/// pending (unresolved) count, since that is the actionable figure; the
/// warning tone is reserved for rows that actually have pending reports.
class _ReportsMetric extends StatelessWidget {
  const _ReportsMetric({required this.item});

  final AdminMaterialListItem item;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final hasPending = item.pendingReportCount > 0;
    final count = hasPending ? item.pendingReportCount : item.reportCount;
    final tone = hasPending ? colors.warningText : colors.textSecondary;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.flag_outlined, size: 15, color: tone),
        const SizedBox(width: 6),
        Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$count',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: tone,
                fontWeight: FontWeight.w800,
                height: 1,
              ),
            ),
            Text(
              'Reports',
              style: Theme.of(
                context,
              ).textTheme.labelSmall?.copyWith(color: colors.textMuted, height: 1),
            ),
          ],
        ),
      ],
    );
  }
}

/// View details + overflow menu with the direct Hide/Mark
/// unavailable/Restore shortcuts. The overflow already surfaces every real,
/// currently-valid moderation action, so a separate "Review" button (which
/// only reopened the same details dialog) is intentionally not shown.
class _MaterialActionArea extends StatelessWidget {
  const _MaterialActionArea({
    required this.moderation,
    required this.onDetails,
    required this.onHide,
    required this.onUnavailable,
    required this.onRestore,
  });

  final AdminMaterialModerationActions moderation;
  final VoidCallback onDetails;
  final VoidCallback onHide;
  final VoidCallback onUnavailable;
  final VoidCallback onRestore;

  static ButtonStyle _compactStyle(BuildContext context, AppStatusTone tone) {
    return AppStatusButtonStyle.outlined(context, tone).merge(
      OutlinedButton.styleFrom(
        minimumSize: const Size(0, 42),
        textStyle: Theme.of(
          context,
        ).textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w600),
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm + 4,
          vertical: AppSpacing.sm,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final detailsButton = OutlinedButton.icon(
      onPressed: onDetails,
      icon: const Icon(Icons.visibility_outlined, size: 16),
      label: const Text('View details'),
      style: _compactStyle(context, AppStatusTone.neutral),
    );

    final overflowItems = <PopupMenuEntry<VoidCallback>>[
      if (moderation.canHide)
        PopupMenuItem<VoidCallback>(
          value: onHide,
          child: const _OverflowMenuLabel(
            icon: Icons.visibility_off_outlined,
            label: 'Hide material',
            tone: AppStatusTone.danger,
          ),
        ),
      if (moderation.canMarkUnavailable)
        PopupMenuItem<VoidCallback>(
          value: onUnavailable,
          child: const _OverflowMenuLabel(
            icon: Icons.block_outlined,
            label: 'Mark unavailable',
            tone: AppStatusTone.warning,
          ),
        ),
      if (moderation.canRestore)
        PopupMenuItem<VoidCallback>(
          value: onRestore,
          child: const _OverflowMenuLabel(
            icon: Icons.restore,
            label: 'Restore',
            tone: AppStatusTone.primary,
          ),
        ),
    ];

    final overflowButton = overflowItems.isEmpty
        ? null
        : SizedBox(
            width: 42,
            height: 42,
            child: PopupMenuButton<VoidCallback>(
              tooltip: 'More actions',
              icon: Icon(
                Icons.more_vert,
                size: 18,
                color: AppThemeColors.of(context).textMuted,
              ),
              padding: EdgeInsets.zero,
              onSelected: (action) => action(),
              itemBuilder: (menuContext) => overflowItems,
            ),
          );

    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        detailsButton,
        if (overflowButton != null) const SizedBox(width: AppSpacing.sm),
        ?overflowButton,
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

/// One compact horizontal row for a reported material; reuses the same
/// image/identity/metrics/actions structure as [_MaterialRow].
class _ReportRow extends StatefulWidget {
  const _ReportRow({
    required this.report,
    required this.compact,
    required this.showDivider,
    required this.onViewMaterial,
    required this.onResolve,
    required this.onReject,
    required this.onHideMaterial,
  });

  final AdminMaterialReportListItem report;
  final bool compact;
  final bool showDivider;
  final VoidCallback onViewMaterial;
  final VoidCallback onResolve;
  final VoidCallback onReject;
  final VoidCallback onHideMaterial;

  @override
  State<_ReportRow> createState() => _ReportRowState();
}

class _ReportRowState extends State<_ReportRow> {
  var _hovered = false;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final report = widget.report;
    final canHideMaterial = AdminMaterialModerationPolicy.canHide(report.materialStatus);

    const image = _ReportThumb();
    final identity = _ReportIdentityBlock(report: report);
    final metrics = _ReportMetricsBlock(report: report);
    final actions = _ReportActionArea(
      canHideMaterial: canHideMaterial,
      onViewMaterial: widget.onViewMaterial,
      onResolve: widget.onResolve,
      onReject: widget.onReject,
      onHideMaterial: widget.onHideMaterial,
    );

    final content = widget.compact
        ? Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    image,
                    const SizedBox(width: AppSpacing.md),
                    Expanded(child: identity),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm + 2),
                metrics,
                const SizedBox(height: AppSpacing.sm + 2),
                actions,
              ],
            ),
          )
        : Padding(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm + 6,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                image,
                const SizedBox(width: AppSpacing.md),
                Expanded(child: identity),
                const SizedBox(width: AppSpacing.lg - 4),
                Container(
                  width: 1,
                  height: 92,
                  color: colors.borderSubtle.withValues(alpha: 0.55),
                ),
                const SizedBox(width: AppSpacing.lg - 4),
                SizedBox(
                  width: 310,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      metrics,
                      const SizedBox(height: AppSpacing.sm + 6),
                      actions,
                    ],
                  ),
                ),
              ],
            ),
          );

    final row = Container(
      decoration: BoxDecoration(
        color: _hovered ? colors.surfaceMuted.withValues(alpha: 0.5) : Colors.transparent,
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

/// Small report indicator tile — intentionally light, so it supports the
/// row instead of dominating it. Report list items don't carry a material
/// image, so this stays an icon tile rather than a photo.
class _ReportThumb extends StatelessWidget {
  const _ReportThumb();

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: 90,
        height: 90,
        color: colors.warningSoft,
        alignment: Alignment.center,
        child: Icon(Icons.flag_outlined, color: colors.warningText, size: 24),
      ),
    );
  }
}

/// Report-content hierarchy: title, supplier/reporter, reason + submitted
/// date, then the report note. Report/material *state* is deliberately
/// excluded here — it belongs only to the right management cluster, so it
/// is never shown twice on the same row.
class _ReportIdentityBlock extends StatelessWidget {
  const _ReportIdentityBlock({required this.report});

  final AdminMaterialReportListItem report;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final created = DateFormat.yMMMd().format(report.createdAt);
    final dateStyle = Theme.of(
      context,
    ).textTheme.bodySmall?.copyWith(color: colors.textMuted);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          report.materialTitle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '${report.supplierName} • Reported by ${report.reporterName}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: colors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            _SemanticBadge(label: _formatReportReason(report.reason), tone: _BadgeTone.warning),
            Text('·', style: dateStyle),
            Text('Submitted $created', style: dateStyle),
          ],
        ),
        if (report.note != null && report.note!.trim().isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            report.note!,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: colors.textPrimary.withValues(alpha: 0.82),
              height: 1.3,
            ),
          ),
        ],
      ],
    );
  }
}

/// The one and only place report/material state is shown on this row —
/// the left content area intentionally omits both, so nothing is
/// duplicated. Two single-line semantic badges, right-aligned and wrapped
/// tightly together.
class _ReportMetricsBlock extends StatelessWidget {
  const _ReportMetricsBlock({required this.report});

  final AdminMaterialReportListItem report;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.end,
      spacing: 8,
      runSpacing: 8,
      children: [
        _CompactStatusChip(
          icon: Icons.flag_outlined,
          label: _reportStatusLabel(report.status),
          tone: reviewStatusTone(report.status),
        ),
        _CompactStatusChip(
          icon: Icons.inventory_2_outlined,
          label: _displayEnum(report.materialStatus),
          tone: materialLifecycleStatusTone(report.materialStatus).appStatusTone,
        ),
      ],
    );
  }
}

/// Report-context label so "Pending" reads unambiguously against the
/// material status badge next to it, without inventing a new status value.
String _reportStatusLabel(String status) {
  switch (status.trim().toUpperCase()) {
    case 'PENDING':
      return 'Pending report';
    case 'APPROVED':
      return 'Resolved';
    default:
      return _displayEnum(status);
  }
}

/// One-line semantic status badge with a leading icon of the same tone —
/// reuses [AppStatusBadge]'s color system directly rather than inventing a
/// second status palette.
class _CompactStatusChip extends StatelessWidget {
  const _CompactStatusChip({
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
        Icon(icon, size: 13, color: style.foreground),
        const SizedBox(width: 4),
        AppStatusBadge(label: label, tone: tone),
      ],
    );
  }
}

class _ReportActionArea extends StatelessWidget {
  const _ReportActionArea({
    required this.canHideMaterial,
    required this.onViewMaterial,
    required this.onResolve,
    required this.onReject,
    required this.onHideMaterial,
  });

  final bool canHideMaterial;
  final VoidCallback onViewMaterial;
  final VoidCallback onResolve;
  final VoidCallback onReject;
  final VoidCallback onHideMaterial;

  static ButtonStyle _compactStyle(BuildContext context, AppStatusTone tone) {
    return AppStatusButtonStyle.outlined(context, tone).merge(
      OutlinedButton.styleFrom(
        minimumSize: const Size(0, 42),
        textStyle: Theme.of(
          context,
        ).textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w600),
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm + 4,
          vertical: AppSpacing.sm,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final detailsButton = OutlinedButton.icon(
      onPressed: onViewMaterial,
      icon: const Icon(Icons.visibility_outlined, size: 16),
      label: const Text('View material'),
      style: _compactStyle(context, AppStatusTone.neutral),
    );

    final resolveButton = OutlinedButton.icon(
      onPressed: onResolve,
      icon: const Icon(Icons.check_circle_outline, size: 16),
      label: const Text('Resolve'),
      style: _compactStyle(context, AppStatusTone.success),
    );

    final overflowItems = <PopupMenuEntry<VoidCallback>>[
      PopupMenuItem<VoidCallback>(
        value: onReject,
        child: const _OverflowMenuLabel(
          icon: Icons.cancel_outlined,
          label: 'Reject report',
          tone: AppStatusTone.danger,
        ),
      ),
      if (canHideMaterial)
        PopupMenuItem<VoidCallback>(
          value: onHideMaterial,
          child: const _OverflowMenuLabel(
            icon: Icons.visibility_off_outlined,
            label: 'Hide material',
            tone: AppStatusTone.danger,
          ),
        ),
    ];

    final overflowButton = overflowItems.isEmpty
        ? null
        : SizedBox(
            width: 42,
            height: 42,
            child: PopupMenuButton<VoidCallback>(
              tooltip: 'More actions',
              icon: Icon(
                Icons.more_vert,
                size: 18,
                color: AppThemeColors.of(context).textMuted,
              ),
              padding: EdgeInsets.zero,
              onSelected: (action) => action(),
              itemBuilder: (menuContext) => overflowItems,
            ),
          );

    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        detailsButton,
        const SizedBox(width: AppSpacing.sm),
        resolveButton,
        if (overflowButton != null) const SizedBox(width: AppSpacing.sm),
        ?overflowButton,
      ],
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
    final status = detail['status'] as String? ?? 'UNKNOWN';
    final hasModerationActions =
        onHide != null || onUnavailable != null || onRestore != null;
    final locationLabel = [
      location['city'] as String?,
      location['area'] as String?,
    ].whereType<String>().where((value) => value.trim().isNotEmpty).join(', ');

    return AppDialogShell(
      maxWidth: 1040,
      maxHeightFactor: 0.9,
      contentPadding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.lg,
        AppSpacing.sm,
        AppSpacing.lg,
        AppSpacing.lg,
      ),
      title: AppDialogTitleBlock(
        icon: Icons.inventory_2_outlined,
        title: detail['title'] as String? ?? 'Material details',
        badges: [
          AppStatusBadge(
            label: _displayEnum(status),
            tone: materialLifecycleStatusTone(status).appStatusTone,
          ),
          AppStatusBadge(
            label: isFree ? 'Free' : 'Paid',
            tone: isFree ? AppStatusTone.success : AppStatusTone.info,
          ),
          if ((category['nameEn'] as String?)?.trim().isNotEmpty ?? false)
            AppStatusBadge(
              label: category['nameEn'] as String,
              tone: AppStatusTone.neutral,
            ),
        ],
      ),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (moderation.detailLockMessage != null) ...[
            _ModerationLockNotice(message: moderation.detailLockMessage!),
            const SizedBox(height: AppSpacing.md),
          ],
          LayoutBuilder(
            builder: (context, constraints) {
              final leftColumn = Column(
                children: [
                  _DetailSection(
                    title: 'Images',
                    icon: Icons.photo_outlined,
                    child: _FeaturedMaterialImages(images: images),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _DetailSection(
                    title: 'Material overview',
                    icon: Icons.inventory_2_outlined,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if ((detail['description'] as String?)
                                ?.trim()
                                .isNotEmpty ??
                            false) ...[
                          Text(
                            detail['description'] as String,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(
                                  color: AppThemeColors.of(
                                    context,
                                  ).textSecondary,
                                ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                        ],
                        _DetailMetadataWrap(
                          entries: [
                            _DetailEntry('Category', category['nameEn']),
                            _DetailEntry(
                              'Condition',
                              detail['condition'],
                              enumValue: true,
                            ),
                            _DetailEntry(
                              'Source',
                              detail['sourceType'],
                              enumValue: true,
                            ),
                            _DetailEntry(
                              'Quantity',
                              '${detail['quantity'] ?? '—'} ${detail['unit'] ?? ''}'
                                  .trim(),
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
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _DetailSection(
                    title: 'Supplier',
                    icon: Icons.storefront_outlined,
                    child: _SupplierSummary(supplier: supplier),
                  ),
                ],
              );
              final rightColumn = Column(
                children: [
                  _DetailSection(
                    title: 'Location & fulfillment',
                    icon: Icons.location_on_outlined,
                    child: Column(
                      children: [
                        _DetailInfoRow(
                          icon: Icons.place_outlined,
                          label: 'Location',
                          value: locationLabel.isEmpty
                              ? 'Not provided'
                              : locationLabel,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        _DetailInfoRow(
                          icon: Icons.local_shipping_outlined,
                          label: 'Pickup allowed',
                          trailing: _YesNoBadge(
                            value: detail['pickupAllowed'] as bool? ?? false,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _DetailInfoRow(
                          icon: Icons.delivery_dining_outlined,
                          label: 'Delivery allowed',
                          trailing: _YesNoBadge(
                            value: detail['deliveryAllowed'] as bool? ?? false,
                          ),
                        ),
                        if ((detail['pickupNotes'] as String?)
                                ?.trim()
                                .isNotEmpty ??
                            false) ...[
                          const SizedBox(height: AppSpacing.md),
                          _DetailNote(
                            title: 'Pickup notes',
                            note: detail['pickupNotes'] as String,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _DetailSection(
                    title: 'Pricing',
                    icon: Icons.sell_outlined,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AppStatusBadge(
                          label: isFree ? 'Free' : 'Paid',
                          tone: isFree
                              ? AppStatusTone.success
                              : AppStatusTone.info,
                        ),
                        if (!isFree) ...[
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            '${detail['price'] ?? '—'} ${detail['currency'] ?? ''}'
                                .trim(),
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(
                                  color: AppThemeColors.of(context).textPrimary,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ],
                        if (detail['maxAllowedPriceAtCheck'] != null) ...[
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            'Price check limit: ${detail['maxAllowedPriceAtCheck']}',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: AppThemeColors.of(context).textMuted,
                                ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _DetailSection(
                    title: 'Reports',
                    icon: Icons.flag_outlined,
                    child: _ReportsSummary(
                      pendingCount: pendingCount,
                      totalReports: totalReports,
                      latestReports: latestReports,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _DetailSection(
                    title: 'Moderation',
                    icon: Icons.gavel_outlined,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _DetailInfoRow(
                          label: 'Current status',
                          trailing: AppStatusBadge(
                            label: _displayEnum(status),
                            tone: materialLifecycleStatusTone(
                              status,
                            ).appStatusTone,
                          ),
                        ),
                        if ((detail['moderationReason'] as String?)
                                ?.trim()
                                .isNotEmpty ??
                            false) ...[
                          const SizedBox(height: AppSpacing.md),
                          _DetailNote(
                            title: 'Moderation reason',
                            note: detail['moderationReason'] as String,
                          ),
                        ],
                        if (_formatDate(detail['moderatedAt'] as String?) !=
                            null) ...[
                          const SizedBox(height: AppSpacing.md),
                          _DetailInfoRow(
                            label: 'Last moderated',
                            value: _formatDate(
                              detail['moderatedAt'] as String?,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              );

              if (constraints.maxWidth < 760) {
                return Column(
                  children: [
                    leftColumn,
                    const SizedBox(height: AppSpacing.md),
                    rightColumn,
                  ],
                );
              }
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: leftColumn),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: rightColumn),
                ],
              );
            },
          ),
          const SizedBox(height: AppSpacing.md),
        ],
      ),
      footer: hasModerationActions
          ? AppDialogFooter.actions(
              actions: [
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
            )
          : null,
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
  const _DetailSection({
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

class _DetailEntry {
  const _DetailEntry(this.label, this.value, {this.enumValue = false});

  final String label;
  final dynamic value;
  final bool enumValue;
}

class _ModerationLockNotice extends StatelessWidget {
  const _ModerationLockNotice({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.warningSoft,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.warningBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lock_outline, color: colors.warningText, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: colors.warningText),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeaturedMaterialImages extends StatelessWidget {
  const _FeaturedMaterialImages({required this.images});

  final List<dynamic> images;

  @override
  Widget build(BuildContext context) {
    final imageUrls = images
        .whereType<Map>()
        .map((image) => image['imageUrl'] as String?)
        .whereType<String>()
        .where((url) => url.trim().isNotEmpty)
        .toList();
    final colors = AppThemeColors.of(context);

    if (imageUrls.isEmpty) {
      return Container(
        height: 180,
        width: double.infinity,
        decoration: BoxDecoration(
          color: colors.surfaceMuted,
          borderRadius: AppRadius.mdAll,
          border: Border.all(color: colors.borderSubtle),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.image_not_supported_outlined, color: colors.textMuted),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'No images provided',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: colors.textSecondary),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: AppRadius.mdAll,
          child: AspectRatio(
            aspectRatio: 16 / 10,
            child: Image.network(
              ApiConfig.resolveMediaUrl(imageUrls.first),
              width: double.infinity,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => Container(
                color: colors.surfaceMuted,
                alignment: Alignment.center,
                child: Text(
                  'Image unavailable',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: colors.textMuted),
                ),
              ),
            ),
          ),
        ),
        if (imageUrls.length > 1) ...[
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 56,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: imageUrls.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, index) => Container(
                padding: const EdgeInsets.all(AppSpacing.xs),
                decoration: BoxDecoration(
                  color: colors.cardSurface,
                  borderRadius: AppRadius.smAll,
                  border: Border.all(
                    color: index == 0 ? colors.primary : colors.borderSubtle,
                    width: index == 0 ? 2 : 1,
                  ),
                ),
                child: ClipRRect(
                  borderRadius: AppRadius.smAll,
                  child: Image.network(
                    ApiConfig.resolveMediaUrl(imageUrls[index]),
                    width: 48,
                    height: 48,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Container(
                      width: 48,
                      color: colors.surfaceMuted,
                      alignment: Alignment.center,
                      child: Icon(
                        Icons.broken_image_outlined,
                        color: colors.textMuted,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _DetailMetadataWrap extends StatelessWidget {
  const _DetailMetadataWrap({required this.entries});

  final List<_DetailEntry> entries;

  @override
  Widget build(BuildContext context) {
    final visible = entries
        .where(
          (entry) =>
              entry.value != null && entry.value.toString().trim().isNotEmpty,
        )
        .toList();
    if (visible.isEmpty) {
      return Text(
        'No details available.',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: AppThemeColors.of(context).textMuted,
        ),
      );
    }
    final colors = AppThemeColors.of(context);
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: visible
          .map(
            (entry) => Container(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.sm,
                AppSpacing.xs,
                AppSpacing.sm,
                AppSpacing.xs,
              ),
              decoration: BoxDecoration(
                color: colors.surfaceMuted,
                borderRadius: AppRadius.smAll,
                border: Border.all(color: colors.borderSubtle),
              ),
              child: Text(
                '${entry.label}: ${entry.enumValue ? _displayEnum(entry.value) : entry.value}',
                style: Theme.of(
                  context,
                ).textTheme.labelMedium?.copyWith(color: colors.textSecondary),
              ),
            ),
          )
          .toList(),
    );
  }
}

class _SupplierSummary extends StatelessWidget {
  const _SupplierSummary({required this.supplier});

  final Map<String, dynamic> supplier;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final organization = supplier['organization'] as Map?;
    final organizationName = organization?['organizationName'] as String?;
    final verification = supplier['verificationStatus'] as String?;
    final name = supplier['displayName'] as String? ?? 'Supplier';
    final email = supplier['email'] as String?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: colors.primarySoft,
                borderRadius: AppRadius.mdAll,
              ),
              child: Icon(
                organizationName?.trim().isNotEmpty ?? false
                    ? Icons.storefront_outlined
                    : Icons.person_outline,
                color: colors.primary,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (email?.trim().isNotEmpty ?? false) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      email!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (verification?.trim().isNotEmpty ?? false)
              AppStatusBadge(
                label: _displayEnum(verification),
                tone: supplierVerificationStatusTone(verification!),
              ),
          ],
        ),
        if (organizationName?.trim().isNotEmpty ?? false) ...[
          const SizedBox(height: AppSpacing.md),
          Divider(height: 1, color: colors.borderSubtle),
          const SizedBox(height: AppSpacing.md),
          _DetailInfoRow(
            icon: Icons.business_outlined,
            label: 'Organization',
            value: organizationName,
          ),
        ],
      ],
    );
  }
}

class _DetailInfoRow extends StatelessWidget {
  const _DetailInfoRow({
    required this.label,
    this.icon,
    this.value,
    this.trailing,
  });

  final String label;
  final IconData? icon;
  final String? value;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => AppDialogInfoRow(
    label: label,
    value: value,
    icon: icon,
    trailing: trailing,
  );
}

class _YesNoBadge extends StatelessWidget {
  const _YesNoBadge({required this.value});

  final bool value;

  @override
  Widget build(BuildContext context) => AppStatusBadge(
    label: value ? 'Yes' : 'No',
    tone: value ? AppStatusTone.success : AppStatusTone.neutral,
  );
}

class _DetailNote extends StatelessWidget {
  const _DetailNote({required this.title, required this.note});

  final String title;
  final String note;

  @override
  Widget build(BuildContext context) => AppDialogNote(title: title, note: note);
}

class _ReportsSummary extends StatelessWidget {
  const _ReportsSummary({
    required this.pendingCount,
    required this.totalReports,
    required this.latestReports,
  });

  final int pendingCount;
  final int totalReports;
  final List<dynamic> latestReports;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            AppStatusBadge(
              label: '$pendingCount pending',
              tone: pendingCount > 0
                  ? AppStatusTone.warning
                  : AppStatusTone.neutral,
            ),
            AppStatusBadge(
              label: '$totalReports total',
              tone: AppStatusTone.neutral,
            ),
          ],
        ),
        if (latestReports.isEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            pendingCount == 0
                ? 'No reports pending.'
                : 'No recent reports to display.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: colors.textMuted),
          ),
        ] else ...[
          const SizedBox(height: AppSpacing.md),
          for (final raw in latestReports.take(3))
            if (raw is Map) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: colors.surfaceMuted,
                  borderRadius: AppRadius.smAll,
                  border: Border.all(color: colors.borderSubtle),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _formatReportReason(raw['reason'] as String? ?? ''),
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if ((raw['note'] as String?)?.trim().isNotEmpty ??
                        false) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        raw['note'] as String,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
        ],
      ],
    );
  }
}

String _displayEnum(Object? value) {
  if (value == null) return 'Not provided';
  final raw = value.toString().trim();
  if (raw.isEmpty) return 'Not provided';
  return raw
      .replaceAll('_', ' ')
      .toLowerCase()
      .replaceFirstMapped(
        RegExp(r'^[a-z]'),
        (match) => match.group(0)!.toUpperCase(),
      );
}
