import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../data/admin_export_center_models.dart';
import '../../data/admin_export_center_service.dart';
import '../../data/admin_reservations_api.dart' show AdminExportFormatEligibility;
import '../l10n/admin_l10n.dart';
import '../controllers/admin_export_center_controller.dart';
import '../theme/admin_decoration_set.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;
import '../widgets/admin_monitoring_utils.dart';

class AdminExportCenterPage extends ConsumerStatefulWidget {
  const AdminExportCenterPage({super.key});

  @override
  ConsumerState<AdminExportCenterPage> createState() =>
      _AdminExportCenterPageState();
}

class _AdminExportCenterPageState extends ConsumerState<AdminExportCenterPage> {
  AdminExportCenterController? _controller;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!kIsWeb) return;
    _controller ??= AdminExportCenterController(
      service: ref.read(adminExportCenterServiceProvider),
    )..addListener(_onControllerChanged);
  }

  @override
  void dispose() {
    _controller?.removeListener(_onControllerChanged);
    _controller?.dispose();
    super.dispose();
  }

  void _onControllerChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _export() async {
    final controller = _controller;
    if (controller == null) return;
    final ok = await controller.export();
    if (!mounted || !ok) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${controller.domain.label} ${controller.format.toUpperCase()} '
          'export downloaded.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!kIsWeb) {
      return const _ExportCenterUnavailable();
    }

    final controller = _controller;
    if (controller == null) {
      return const Center(child: CircularProgressIndicator());
    }
    final palette = context.adminPalette;
    final wide = MediaQuery.sizeOf(context).width >= 1100;

    return ColoredBox(
      color: Colors.transparent,
      child: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.fromSTEB(
          AppSpacing.lg,
          AppSpacing.md,
          AppSpacing.lg,
          AppSpacing.lg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Create safe exports from existing Admin datasets using '
              'server-side filters.',
              style: AdminTypography.pageSubtitle(palette),
            ),
            const SizedBox(height: AppSpacing.lg),
            if (wide)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 280,
                    child: _DomainList(controller: controller),
                  ),
                  const SizedBox(width: AppSpacing.lg),
                  Expanded(
                    child: Column(
                      children: [
                        _FilterPanel(controller: controller),
                        const SizedBox(height: AppSpacing.lg),
                        _SummaryPanel(
                          controller: controller,
                          onPreview: controller.preview,
                          onExport: _export,
                        ),
                      ],
                    ),
                  ),
                ],
              )
            else ...[
              _DomainList(controller: controller),
              const SizedBox(height: AppSpacing.lg),
              _FilterPanel(controller: controller),
              const SizedBox(height: AppSpacing.lg),
              _SummaryPanel(
                controller: controller,
                onPreview: controller.preview,
                onExport: _export,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ExportCenterUnavailable extends StatelessWidget {
  const _ExportCenterUnavailable();

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Text(
        'Export Center is available on Admin Web only.',
        style: AdminTypography.pageSubtitle(palette),
      ),
    );
  }
}

class _DomainList extends StatelessWidget {
  const _DomainList({required this.controller});

  final AdminExportCenterController controller;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Text(
              'Domains',
              style: AdminTypography.sectionTitle(palette),
            ),
          ),
          for (final domain in AdminExportDomainKey.values)
            _DomainTile(
              domain: domain,
              selected: controller.domain == domain,
              enabled: !controller.isExporting,
              onTap: () => controller.selectDomain(domain),
            ),
        ],
      ),
    );
  }
}

class _DomainTile extends StatelessWidget {
  const _DomainTile({
    required this.domain,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final AdminExportDomainKey domain;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return InkWell(
      onTap: enabled ? onTap : null,
      child: Container(
        padding: const EdgeInsetsDirectional.fromSTEB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.md,
          AppSpacing.sm,
        ),
        color: selected
            ? palette.primaryTeal.withValues(alpha: 0.08)
            : Colors.transparent,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              domain.icon,
              size: 20,
              color: selected ? palette.primaryTeal : palette.textSecondary,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    domain.label,
                    style: AdminTypography.kpiLabel(palette).copyWith(
                      fontWeight: FontWeight.w700,
                      color: selected
                          ? palette.primaryTeal
                          : palette.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    domain.description,
                    style: AdminTypography.kpiHelper(palette),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Formats: ${domain.supportedFormats.map((f) => _formatLabel(AdminL10n.of(context), f)).join(', ')}',
                    style: AdminTypography.kpiHelper(palette).copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterPanel extends StatelessWidget {
  const _FilterPanel({required this.controller});

  final AdminExportCenterController controller;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${controller.domain.label} filters',
                  style: AdminTypography.sectionTitle(palette),
                ),
              ),
              TextButton(
                onPressed: controller.isExporting
                    ? null
                    : controller.resetCurrentFilters,
                child: Text(AdminL10n.of(context).resetFilters),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          switch (controller.domain) {
            AdminExportDomainKey.reservations => _ReservationsFilters(
              controller: controller,
            ),
            AdminExportDomainKey.materials => _MaterialsFilters(
              controller: controller,
            ),
            AdminExportDomainKey.materialReports => _MaterialReportsFilters(
              controller: controller,
            ),
            AdminExportDomainKey.deliveries => _DeliveriesFilters(
              controller: controller,
            ),
            AdminExportDomainKey.users => _UsersFilters(controller: controller),
            AdminExportDomainKey.incidentReports => _IncidentFilters(
              controller: controller,
            ),
          },
        ],
      ),
    );
  }
}

class _SummaryPanel extends StatelessWidget {
  const _SummaryPanel({
    required this.controller,
    required this.onPreview,
    required this.onExport,
  });

  final AdminExportCenterController controller;
  final VoidCallback onPreview;
  final VoidCallback onExport;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final adminL10n = AdminL10n.of(context);
    final preflight = controller.preflight;
    final eligibility = preflight?.eligibilityFor(controller.format);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Export summary', style: AdminTypography.sectionTitle(palette)),
          const SizedBox(height: AppSpacing.sm),
          Text('Domain: ${controller.domain.label}'),
          const SizedBox(height: 4),
          Text(
            controller.activeFilterSummary,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(AdminL10n.of(context).format, style: AdminTypography.kpiLabel(palette)),
          const SizedBox(height: AppSpacing.sm),
          SegmentedButton<String>(
            segments: [
              for (final format in controller.domain.supportedFormats)
                ButtonSegment(
                  value: format,
                  label: Text(_formatLabel(adminL10n, format)),
                  enabled: !controller.isExporting,
                ),
            ],
            selected: {controller.format},
            onSelectionChanged: controller.isExporting
                ? null
                : (values) {
                    if (values.isEmpty) return;
                    controller.selectFormat(values.first);
                  },
          ),
          const SizedBox(height: 8),
          Text(
            _formatDescription(controller.format),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: AppSpacing.md),
          if (controller.isPreviewLoading)
            const LinearProgressIndicator()
          else if (preflight == null || controller.previewStale)
            Text(
              controller.previewStale && preflight != null
                  ? 'Filters changed. Preview again before exporting.'
                  : 'Choose a domain and filters, then preview the export.',
              style: AdminTypography.kpiHelper(palette),
            )
          else if (preflight.count == 0)
            Text(
              'No records match the selected filters.',
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            )
          else ...[
            Text('Matching records: ${preflight.count}'),
            if (eligibility != null) ...[
              const SizedBox(height: 4),
              Text(
                'Limit for ${_formatLabel(adminL10n, controller.format)}: '
                '${eligibility.maxAllowed}',
              ),
              if (eligibility.exceedsLimit)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    _limitMessage(
                      l10n: adminL10n,
                      domain: controller.domain,
                      format: controller.format,
                      count: preflight.count,
                      eligibility: eligibility,
                    ),
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
            ],
          ],
          if (controller.error != null) ...[
            const SizedBox(height: 12),
            Text(
              controller.error is String
                  ? controller.error! as String
                  : adminL10n.localizedError(controller.error!),
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              OutlinedButton(
                onPressed: controller.canPreview ? onPreview : null,
                child: controller.isPreviewLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Preview export'),
              ),
              FilledButton(
                onPressed: controller.canExport ? onExport : null,
                child: controller.isExporting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(AdminL10n.of(context).exportAction),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

String _formatLabel(AdminL10n l10n, String format) => switch (format) {
  'xlsx' => l10n.excel,
  'pdf' => l10n.pdf,
  'csv' => l10n.csv,
  _ => format.toUpperCase(),
};

String _formatDescription(String format) => switch (format) {
  'pdf' => 'Formatted administrative report',
  'csv' => 'Raw data',
  _ => 'Detailed editable data',
};

String _limitMessage({
  required AdminL10n l10n,
  required AdminExportDomainKey domain,
  required String format,
  required int count,
  required AdminExportFormatEligibility eligibility,
}) {
  if (domain == AdminExportDomainKey.reservations && format == 'pdf') {
    return 'The PDF report limit is ${eligibility.maxAllowed} reservations. '
        'Narrow the filters or select Excel/CSV.';
  }
  return 'This export matches $count records, which exceeds the '
      '${_formatLabel(l10n, format)} limit of ${eligibility.maxAllowed}. '
      'Narrow your filters and try again.';
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.value,
    required this.onChanged,
    this.enabled = true,
  });

  final String value;
  final ValueChanged<String> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      key: ValueKey('search-$value'),
      initialValue: value,
      enabled: enabled,
      decoration: InputDecoration(
        labelText: AdminL10n.of(context).search,
        border: const OutlineInputBorder(),
        isDense: true,
      ),
      onChanged: onChanged,
    );
  }
}

class _DropdownField extends StatelessWidget {
  const _DropdownField({
    required this.label,
    required this.value,
    required this.entries,
    required this.onChanged,
    this.enabled = true,
  });

  final String label;
  final String value;
  final List<DropdownMenuEntry<String>> entries;
  final ValueChanged<String> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return DropdownMenu<String>(
      key: ValueKey('$label-$value'),
      label: Text(label),
      initialSelection: value,
      enabled: enabled,
      dropdownMenuEntries: entries,
      onSelected: enabled
          ? (next) {
              if (next != null) onChanged(next);
            }
          : null,
    );
  }
}

Widget _wrapFilters(List<Widget> children) {
  return Wrap(
    spacing: AppSpacing.md,
    runSpacing: AppSpacing.md,
    children: [
      for (final child in children)
        ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 180, maxWidth: 280),
          child: child,
        ),
    ],
  );
}

class _ReservationsFilters extends StatelessWidget {
  const _ReservationsFilters({required this.controller});
  final AdminExportCenterController controller;

  @override
  Widget build(BuildContext context) {
    final f = controller.reservations;
    final enabled = !controller.isExporting;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _wrapFilters([
          _SearchField(
            value: f.search,
            enabled: enabled,
            onChanged: (value) =>
                controller.updateReservations(f.copyWith(search: value)),
          ),
          _DropdownField(
            label: AdminL10n.of(context).status,
            value: f.status,
            enabled: enabled,
            entries: [
              const DropdownMenuEntry(value: 'ALL', label: 'All statuses'),
              ...AdminExportCenterOptions.reservationStatuses.map(
                (s) => DropdownMenuEntry(value: s, label: humanizeEnum(s)),
              ),
            ],
            onChanged: (value) =>
                controller.updateReservations(f.copyWith(status: value)),
          ),
          _DropdownField(
            label: 'Has delivery',
            value: f.hasDelivery,
            enabled: enabled,
            entries: const [
              DropdownMenuEntry(value: 'ALL', label: 'All'),
              DropdownMenuEntry(value: 'YES', label: 'Yes'),
              DropdownMenuEntry(value: 'NO', label: 'No'),
            ],
            onChanged: (value) =>
                controller.updateReservations(f.copyWith(hasDelivery: value)),
          ),
          _DropdownField(
            label: 'Time range',
            value: f.timeRange,
            enabled: enabled,
            entries: const [
              DropdownMenuEntry(value: kTimeRangeAll, label: 'All time'),
              DropdownMenuEntry(value: kTimeRangeToday, label: 'Today'),
              DropdownMenuEntry(value: kTimeRangeLast7, label: 'Last 7 days'),
              DropdownMenuEntry(value: kTimeRangeLast30, label: 'Last 30 days'),
              DropdownMenuEntry(value: kTimeRangeCustom, label: 'Custom'),
            ],
            onChanged: (value) => controller.updateReservations(
              f.copyWith(
                timeRange: value,
                clearCustomDates: value != kTimeRangeCustom,
              ),
            ),
          ),
        ]),
        if (f.timeRange == kTimeRangeCustom) ...[
          const SizedBox(height: AppSpacing.md),
          _CustomDateRow(
            from: f.customDateFrom,
            to: f.customDateTo,
            enabled: enabled,
            onChanged: (from, to) => controller.updateReservations(
              f.copyWith(customDateFrom: from, customDateTo: to),
            ),
          ),
        ],
      ],
    );
  }
}

class _MaterialsFilters extends StatelessWidget {
  const _MaterialsFilters({required this.controller});
  final AdminExportCenterController controller;

  @override
  Widget build(BuildContext context) {
    final f = controller.materials;
    final enabled = !controller.isExporting;
    return _wrapFilters([
      _SearchField(
        value: f.search,
        enabled: enabled,
        onChanged: (value) =>
            controller.updateMaterials(f.copyWith(search: value)),
      ),
      _DropdownField(
        label: AdminL10n.of(context).status,
        value: f.status,
        enabled: enabled,
        entries: [
          const DropdownMenuEntry(value: 'ALL', label: 'All statuses'),
          ...AdminExportCenterOptions.materialStatuses.map(
            (s) => DropdownMenuEntry(value: s, label: humanizeEnum(s)),
          ),
        ],
        onChanged: (value) =>
            controller.updateMaterials(f.copyWith(status: value)),
      ),
      _DropdownField(
        label: 'Report status',
        value: f.reportStatus,
        enabled: enabled,
        entries: [
          const DropdownMenuEntry(value: 'ALL', label: 'All report states'),
          ...AdminExportCenterOptions.materialListReportStatuses.map(
            (s) => DropdownMenuEntry(value: s, label: humanizeEnum(s)),
          ),
        ],
        onChanged: (value) =>
            controller.updateMaterials(f.copyWith(reportStatus: value)),
      ),
      _DropdownField(
        label: 'Price',
        value: f.priceFilter,
        enabled: enabled,
        entries: const [
          DropdownMenuEntry(value: 'ALL', label: 'All'),
          DropdownMenuEntry(value: 'FREE', label: 'Free'),
          DropdownMenuEntry(value: 'PAID', label: 'Paid'),
        ],
        onChanged: (value) =>
            controller.updateMaterials(f.copyWith(priceFilter: value)),
      ),
    ]);
  }
}

class _MaterialReportsFilters extends StatelessWidget {
  const _MaterialReportsFilters({required this.controller});
  final AdminExportCenterController controller;

  @override
  Widget build(BuildContext context) {
    final f = controller.materialReports;
    final enabled = !controller.isExporting;
    return _wrapFilters([
      _SearchField(
        value: f.search,
        enabled: enabled,
        onChanged: (value) =>
            controller.updateMaterialReports(f.copyWith(search: value)),
      ),
      _DropdownField(
        label: AdminL10n.of(context).status,
        value: f.status,
        enabled: enabled,
        entries: [
          const DropdownMenuEntry(value: 'ALL', label: 'All statuses'),
          ...AdminExportCenterOptions.materialReportStatuses.map(
            (s) => DropdownMenuEntry(value: s, label: humanizeEnum(s)),
          ),
        ],
        onChanged: (value) =>
            controller.updateMaterialReports(f.copyWith(status: value)),
      ),
      _DropdownField(
        label: 'Reason',
        value: f.reason,
        enabled: enabled,
        entries: [
          const DropdownMenuEntry(value: 'ALL', label: 'All reasons'),
          ...AdminExportCenterOptions.materialReportReasons.map(
            (s) => DropdownMenuEntry(value: s, label: humanizeEnum(s)),
          ),
        ],
        onChanged: (value) =>
            controller.updateMaterialReports(f.copyWith(reason: value)),
      ),
    ]);
  }
}

class _DeliveriesFilters extends StatelessWidget {
  const _DeliveriesFilters({required this.controller});
  final AdminExportCenterController controller;

  @override
  Widget build(BuildContext context) {
    final f = controller.deliveries;
    final enabled = !controller.isExporting;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _wrapFilters([
          _SearchField(
            value: f.search,
            enabled: enabled,
            onChanged: (value) =>
                controller.updateDeliveries(f.copyWith(search: value)),
          ),
          _DropdownField(
            label: AdminL10n.of(context).status,
            value: f.status,
            enabled: enabled,
            entries: [
              const DropdownMenuEntry(value: 'ALL', label: 'All statuses'),
              ...AdminExportCenterOptions.deliveryStatuses.map(
                (s) => DropdownMenuEntry(value: s, label: humanizeEnum(s)),
              ),
            ],
            onChanged: (value) =>
                controller.updateDeliveries(f.copyWith(status: value)),
          ),
          _DropdownField(
            label: 'Scope',
            value: f.scope,
            enabled: enabled,
            entries: [
              const DropdownMenuEntry(value: 'ALL', label: 'All scopes'),
              ...AdminExportCenterOptions.deliveryScopes.map(
                (s) => DropdownMenuEntry(value: s, label: humanizeEnum(s)),
              ),
            ],
            onChanged: (value) =>
                controller.updateDeliveries(f.copyWith(scope: value)),
          ),
          _DropdownField(
            label: 'Assignment',
            value: f.assignment,
            enabled: enabled,
            entries: [
              const DropdownMenuEntry(value: 'ALL', label: 'All assignments'),
              ...AdminExportCenterOptions.deliveryAssignments.map(
                (s) => DropdownMenuEntry(value: s, label: humanizeEnum(s)),
              ),
            ],
            onChanged: (value) =>
                controller.updateDeliveries(f.copyWith(assignment: value)),
          ),
          _DropdownField(
            label: 'Incident',
            value: f.incidentState,
            enabled: enabled,
            entries: [
              const DropdownMenuEntry(value: 'ALL', label: 'All incidents'),
              ...AdminExportCenterOptions.incidentStates.map(
                (s) => DropdownMenuEntry(value: s, label: humanizeEnum(s)),
              ),
            ],
            onChanged: (value) =>
                controller.updateDeliveries(f.copyWith(incidentState: value)),
          ),
          _DropdownField(
            label: 'Time range',
            value: f.timeRange,
            enabled: enabled,
            entries: const [
              DropdownMenuEntry(value: kTimeRangeAll, label: 'All time'),
              DropdownMenuEntry(value: kTimeRangeToday, label: 'Today'),
              DropdownMenuEntry(value: kTimeRangeLast7, label: 'Last 7 days'),
              DropdownMenuEntry(value: kTimeRangeLast30, label: 'Last 30 days'),
              DropdownMenuEntry(value: kTimeRangeCustom, label: 'Custom'),
            ],
            onChanged: (value) => controller.updateDeliveries(
              f.copyWith(
                timeRange: value,
                clearCustomDates: value != kTimeRangeCustom,
              ),
            ),
          ),
        ]),
        if (f.timeRange == kTimeRangeCustom) ...[
          const SizedBox(height: AppSpacing.md),
          _CustomDateRow(
            from: f.customDateFrom,
            to: f.customDateTo,
            enabled: enabled,
            onChanged: (from, to) => controller.updateDeliveries(
              f.copyWith(customDateFrom: from, customDateTo: to),
            ),
          ),
        ],
      ],
    );
  }
}

class _UsersFilters extends StatelessWidget {
  const _UsersFilters({required this.controller});
  final AdminExportCenterController controller;

  @override
  Widget build(BuildContext context) {
    final f = controller.users;
    final enabled = !controller.isExporting;
    return _wrapFilters([
      _DropdownField(
        label: 'Tab',
        value: f.tab,
        enabled: enabled,
        entries: AdminExportCenterOptions.userTabs
            .map((s) => DropdownMenuEntry(value: s, label: humanizeEnum(s)))
            .toList(growable: false),
        onChanged: (value) => controller.updateUsers(f.copyWith(tab: value)),
      ),
      _SearchField(
        value: f.search,
        enabled: enabled,
        onChanged: (value) => controller.updateUsers(f.copyWith(search: value)),
      ),
      _DropdownField(
        label: 'Account status',
        value: f.status,
        enabled: enabled,
        entries: [
          const DropdownMenuEntry(value: 'ALL', label: 'All statuses'),
          ...AdminExportCenterOptions.userStatuses.map(
            (s) => DropdownMenuEntry(value: s, label: humanizeEnum(s)),
          ),
        ],
        onChanged: (value) => controller.updateUsers(f.copyWith(status: value)),
      ),
    ]);
  }
}

class _IncidentFilters extends StatelessWidget {
  const _IncidentFilters({required this.controller});
  final AdminExportCenterController controller;

  @override
  Widget build(BuildContext context) {
    final f = controller.incidents;
    final enabled = !controller.isExporting;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _wrapFilters([
          _SearchField(
            value: f.search,
            enabled: enabled,
            onChanged: (value) =>
                controller.updateIncidents(f.copyWith(search: value)),
          ),
          _DropdownField(
            label: AdminL10n.of(context).status,
            value: f.status,
            enabled: enabled,
            entries: [
              const DropdownMenuEntry(value: 'ALL', label: 'All statuses'),
              ...AdminExportCenterOptions.incidentStatuses.map(
                (s) => DropdownMenuEntry(value: s, label: humanizeEnum(s)),
              ),
            ],
            onChanged: (value) =>
                controller.updateIncidents(f.copyWith(status: value)),
          ),
          _DropdownField(
            label: 'Workflow',
            value: f.workflow,
            enabled: enabled,
            entries: [
              const DropdownMenuEntry(value: 'ALL', label: 'All workflows'),
              ...AdminExportCenterOptions.incidentWorkflows.map(
                (s) => DropdownMenuEntry(value: s, label: humanizeEnum(s)),
              ),
            ],
            onChanged: (value) =>
                controller.updateIncidents(f.copyWith(workflow: value)),
          ),
          _DropdownField(
            label: 'Target role',
            value: f.targetRole,
            enabled: enabled,
            entries: [
              const DropdownMenuEntry(value: 'ALL', label: 'All roles'),
              ...AdminExportCenterOptions.incidentTargetRoles.map(
                (s) => DropdownMenuEntry(value: s, label: humanizeEnum(s)),
              ),
            ],
            onChanged: (value) =>
                controller.updateIncidents(f.copyWith(targetRole: value)),
          ),
          _DropdownField(
            label: 'Operational state',
            value: f.operationalState,
            enabled: enabled,
            entries: [
              const DropdownMenuEntry(value: 'ALL', label: 'All states'),
              ...AdminExportCenterOptions.incidentOperationalStates.map(
                (s) => DropdownMenuEntry(value: s, label: humanizeEnum(s)),
              ),
            ],
            onChanged: (value) =>
                controller.updateIncidents(f.copyWith(operationalState: value)),
          ),
        ]),
        const SizedBox(height: AppSpacing.md),
        _CustomDateRow(
          from: f.dateFrom,
          to: f.dateTo,
          enabled: enabled,
          onChanged: (from, to) => controller.updateIncidents(
            f.copyWith(dateFrom: from, dateTo: to),
          ),
          onClear: () =>
              controller.updateIncidents(f.copyWith(clearDates: true)),
        ),
      ],
    );
  }
}

class _CustomDateRow extends StatelessWidget {
  const _CustomDateRow({
    required this.from,
    required this.to,
    required this.onChanged,
    this.onClear,
    this.enabled = true,
  });

  final String? from;
  final String? to;
  final void Function(String? from, String? to) onChanged;
  final VoidCallback? onClear;
  final bool enabled;

  Future<void> _pick(BuildContext context, {required bool isFrom}) async {
    final initial = DateTime.tryParse(isFrom ? (from ?? '') : (to ?? '')) ??
        DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (picked == null) return;
    final iso = formatIsoDate(picked);
    if (isFrom) {
      onChanged(iso, to);
    } else {
      onChanged(from, iso);
    }
  }

  @override
  Widget build(BuildContext context) {
    final formatter = DateFormat.yMMMd();
    String label(String? iso) {
      if (iso == null || iso.isEmpty) return 'Select';
      final parsed = DateTime.tryParse(iso);
      return parsed == null ? iso : formatter.format(parsed);
    }

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        OutlinedButton(
          onPressed: enabled ? () => _pick(context, isFrom: true) : null,
          child: Text('From: ${label(from)}'),
        ),
        OutlinedButton(
          onPressed: enabled ? () => _pick(context, isFrom: false) : null,
          child: Text('To: ${label(to)}'),
        ),
        if (onClear != null)
          TextButton(
            onPressed: enabled ? onClear : null,
            child: const Text('Clear dates'),
          ),
      ],
    );
  }
}
