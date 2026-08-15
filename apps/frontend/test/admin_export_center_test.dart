import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/admin_portal/data/admin_export_center_models.dart';
import 'package:frontend/features/admin_portal/data/admin_export_center_service.dart';
import 'package:frontend/features/admin_portal/data/admin_reservations_api.dart';
import 'package:frontend/features/admin_portal/presentation/controllers/admin_export_center_controller.dart';
import 'package:frontend/features/admin_portal/presentation/l10n/admin_l10n.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_export_center_page.dart';
import 'package:frontend/features/admin_portal/presentation/widgets/admin_top_bar.dart';

class _FakeExportCenterGateway implements AdminExportCenterGateway {
  final List<AdminExportDomainKey> previewCalls = [];
  final List<(AdminExportDomainKey, String)> downloadCalls = [];
  AdminExportCenterPreflight Function(AdminExportDomainKey domain)? onPreview;
  Duration previewDelay = Duration.zero;
  Object? previewError;
  Object? downloadError;

  @override
  Future<AdminExportCenterPreflight> preview({
    required AdminExportDomainKey domain,
    required ReservationsExportCenterFilters reservations,
    required MaterialsExportCenterFilters materials,
    required MaterialReportsExportCenterFilters materialReports,
    required DeliveriesExportCenterFilters deliveries,
    required UsersExportCenterFilters users,
    required IncidentReportsExportCenterFilters incidents,
  }) async {
    previewCalls.add(domain);
    if (previewDelay > Duration.zero) {
      await Future<void>.delayed(previewDelay);
    }
    if (previewError != null) {
      final error = previewError!;
      previewError = null;
      throw error;
    }
    return onPreview?.call(domain) ??
        AdminExportCenterPreflight(
          count: 12,
          filters: const {},
          formats: {
            for (final format in domain.supportedFormats)
              format: const AdminExportFormatEligibility(
                maxAllowed: 10000,
                exceedsLimit: false,
                allowed: true,
              ),
          },
        );
  }

  @override
  Future<void> download({
    required AdminExportDomainKey domain,
    required String format,
    required ReservationsExportCenterFilters reservations,
    required MaterialsExportCenterFilters materials,
    required MaterialReportsExportCenterFilters materialReports,
    required DeliveriesExportCenterFilters deliveries,
    required UsersExportCenterFilters users,
    required IncidentReportsExportCenterFilters incidents,
  }) async {
    downloadCalls.add((domain, format));
    if (downloadError != null) {
      final error = downloadError!;
      downloadError = null;
      throw error;
    }
  }
}

void main() {
  test('domain registry covers six domains with expected formats', () {
    expect(AdminExportDomainKey.values, hasLength(6));
    expect(
      AdminExportDomainKey.reservations.supportedFormats,
      ['xlsx', 'pdf', 'csv'],
    );
    for (final domain in AdminExportDomainKey.values.where(
      (d) => d != AdminExportDomainKey.reservations,
    )) {
      expect(domain.supportedFormats, ['xlsx', 'csv']);
      expect(domain.defaultFormat, 'xlsx');
    }
    expect(
      AdminExportDomainKey.values.map((d) => d.id).toSet(),
      {
        'reservations',
        'materials',
        'material_reports',
        'deliveries',
        'users',
        'incident_reports',
      },
    );
  });

  test('reservation status options match backend export validation', () {
    expect(AdminExportCenterOptions.reservationStatuses, [
      'PENDING',
      'ACCEPTED',
      'REJECTED',
      'CANCELLED',
      'COMPLETED',
      'EXPIRED',
    ]);
    expect(
      AdminExportCenterOptions.reservationStatuses.contains(
        'AWAITING_RESOLUTION',
      ),
      isFalse,
    );
  });

  test('adminPageTitle maps /admin/exports', () {
    final l = AdminL10n.forTest('en');
    expect(adminPageTitle(l, '/admin/exports'), 'Export Center');
    expect(l.navExportCenter, 'Export Center');
  });

  test('switching domain resets format to Excel and clears preview', () async {
    final service = _FakeExportCenterGateway();
    final controller = AdminExportCenterController(service: service);

    controller.selectFormat('pdf');
    expect(controller.format, 'pdf');
    await controller.preview();
    expect(controller.preflight?.count, 12);
    expect(controller.previewStale, isFalse);

    controller.selectDomain(AdminExportDomainKey.materials);
    expect(controller.domain, AdminExportDomainKey.materials);
    expect(controller.format, 'xlsx');
    expect(controller.preflight, isNull);
    expect(controller.previewStale, isTrue);
    expect(controller.domain.supportedFormats.contains('pdf'), isFalse);
  });

  test('filter change marks preview stale and blocks export', () async {
    final service = _FakeExportCenterGateway();
    final controller = AdminExportCenterController(service: service);
    await controller.preview();
    expect(controller.canExport, isTrue);

    controller.updateReservations(
      controller.reservations.copyWith(search: 'wood'),
    );
    expect(controller.previewStale, isTrue);
    expect(controller.canExport, isFalse);
  });

  test('zero results block export', () async {
    final service = _FakeExportCenterGateway()
      ..onPreview = (_) => const AdminExportCenterPreflight(
        count: 0,
        filters: {},
        formats: {
          'xlsx': AdminExportFormatEligibility(
            maxAllowed: 10000,
            exceedsLimit: false,
            allowed: true,
          ),
          'csv': AdminExportFormatEligibility(
            maxAllowed: 10000,
            exceedsLimit: false,
            allowed: true,
          ),
          'pdf': AdminExportFormatEligibility(
            maxAllowed: 500,
            exceedsLimit: false,
            allowed: true,
          ),
        },
      );
    final controller = AdminExportCenterController(service: service);
    await controller.preview();
    expect(controller.canExport, isFalse);
  });

  test('over-limit format cannot export', () async {
    final service = _FakeExportCenterGateway()
      ..onPreview = (_) => const AdminExportCenterPreflight(
        count: 800,
        filters: {},
        formats: {
          'xlsx': AdminExportFormatEligibility(
            maxAllowed: 10000,
            exceedsLimit: false,
            allowed: true,
          ),
          'pdf': AdminExportFormatEligibility(
            maxAllowed: 500,
            exceedsLimit: true,
            allowed: false,
          ),
          'csv': AdminExportFormatEligibility(
            maxAllowed: 10000,
            exceedsLimit: false,
            allowed: true,
          ),
        },
      );
    final controller = AdminExportCenterController(service: service);
    await controller.preview();
    controller.selectFormat('pdf');
    expect(controller.canExport, isFalse);
    controller.selectFormat('xlsx');
    expect(controller.canExport, isTrue);
  });

  test('late preview from previous domain is ignored', () async {
    final service = _FakeExportCenterGateway()
      ..previewDelay = const Duration(milliseconds: 40);
    final controller = AdminExportCenterController(service: service);

    final first = controller.preview();
    controller.selectDomain(AdminExportDomainKey.users);
    await first;
    await Future<void>.delayed(const Duration(milliseconds: 60));

    expect(controller.domain, AdminExportDomainKey.users);
    expect(controller.preflight, isNull);
    expect(controller.previewStale, isTrue);
  });

  test('preview and download dispatch to selected domain', () async {
    final service = _FakeExportCenterGateway();
    final controller = AdminExportCenterController(service: service);
    controller.selectDomain(AdminExportDomainKey.deliveries);
    await controller.preview();
    expect(service.previewCalls.last, AdminExportDomainKey.deliveries);

    final ok = await controller.export();
    expect(ok, isTrue);
    expect(service.downloadCalls.single.$1, AdminExportDomainKey.deliveries);
    expect(service.downloadCalls.single.$2, 'xlsx');
  });

  test('download failure restores state with error', () async {
    final service = _FakeExportCenterGateway()
      ..downloadError = const ApiException(
        message: 'Backend offline',
        code: 'NETWORK',
      );
    final controller = AdminExportCenterController(service: service);
    await controller.preview();
    final ok = await controller.export();
    expect(ok, isFalse);
    expect(controller.isExporting, isFalse);
    expect(controller.error, isA<ApiException>());
    expect((controller.error! as ApiException).message, 'Backend offline');
    expect(controller.canExport, isTrue);
  });

  test('duplicate export while exporting is blocked', () async {
    final service = _FakeExportCenterGateway();
    final controller = AdminExportCenterController(service: service);
    await controller.preview();

    final first = controller.export();
    final second = controller.export();
    await Future.wait([first, second]);
    expect(service.downloadCalls, hasLength(1));
  });

  test('reset clears only current domain filters', () {
    final service = _FakeExportCenterGateway();
    final controller = AdminExportCenterController(service: service);
    controller.updateReservations(
      controller.reservations.copyWith(search: 'res'),
    );
    controller.selectDomain(AdminExportDomainKey.materials);
    controller.updateMaterials(controller.materials.copyWith(search: 'mat'));
    controller.resetCurrentFilters();
    expect(controller.materials.search, '');
    controller.selectDomain(AdminExportDomainKey.reservations);
    expect(controller.reservations.search, 'res');
  });

  test('incident and material-report filter summaries omit page/limit', () {
    final service = _FakeExportCenterGateway();
    final controller = AdminExportCenterController(service: service);
    controller.selectDomain(AdminExportDomainKey.incidentReports);
    controller.updateIncidents(
      controller.incidents.copyWith(
        search: 'wood',
        status: 'PENDING_REVIEW',
        workflow: 'ACCOUNTABILITY',
      ),
    );
    expect(controller.activeFilterSummary.contains('page'), isFalse);
    expect(controller.activeFilterSummary.contains('limit'), isFalse);

    controller.selectDomain(AdminExportDomainKey.materialReports);
    controller.updateMaterialReports(
      controller.materialReports.copyWith(reason: 'OTHER'),
    );
    expect(controller.activeFilterSummary, contains('Reason: OTHER'));
  });

  testWidgets('Export Center page shows web-only message in tests', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: AdminExportCenterPage())),
    );
    expect(find.textContaining('Admin Web only'), findsOneWidget);
  });
}
