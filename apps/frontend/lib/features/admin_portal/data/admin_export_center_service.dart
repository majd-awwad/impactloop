import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../presentation/widgets/admin_monitoring_utils.dart';
import 'admin_deliveries_api.dart';
import 'admin_export_center_models.dart';
import 'admin_materials_api.dart';
import 'admin_no_show_reports_api.dart';
import 'admin_people_api.dart';
import 'admin_reservations_api.dart';

/// Contract used by Export Center UI — fakes implement this in tests.
abstract class AdminExportCenterGateway {
  Future<AdminExportCenterPreflight> preview({
    required AdminExportDomainKey domain,
    required ReservationsExportCenterFilters reservations,
    required MaterialsExportCenterFilters materials,
    required MaterialReportsExportCenterFilters materialReports,
    required DeliveriesExportCenterFilters deliveries,
    required UsersExportCenterFilters users,
    required IncidentReportsExportCenterFilters incidents,
  });

  Future<void> download({
    required AdminExportDomainKey domain,
    required String format,
    required ReservationsExportCenterFilters reservations,
    required MaterialsExportCenterFilters materials,
    required MaterialReportsExportCenterFilters materialReports,
    required DeliveriesExportCenterFilters deliveries,
    required UsersExportCenterFilters users,
    required IncidentReportsExportCenterFilters incidents,
  });
}

/// Dispatches to existing domain export APIs. Never builds URLs from free text.
class AdminExportCenterService implements AdminExportCenterGateway {
  AdminExportCenterService(this._ref);

  final Ref _ref;

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
    switch (domain) {
      case AdminExportDomainKey.reservations:
        final dates = resolveDateRange(
          timeRange: reservations.timeRange,
          customDateFrom: reservations.customDateFrom,
          customDateTo: reservations.customDateTo,
        );
        if (dates.error != null) {
          throw StateError(dates.error!);
        }
        final result = await _ref
            .read(adminReservationsApiProvider)
            .preflightExport(
              search: reservations.search,
              status: reservations.status,
              hasDelivery: reservations.hasDelivery,
              dateFrom: dates.dateFrom,
              dateTo: dates.dateTo,
            );
        return AdminExportCenterPreflight(
          count: result.count,
          filters: result.filters,
          formats: result.formats,
        );

      case AdminExportDomainKey.materials:
        final result = await _ref
            .read(adminMaterialsApiProvider)
            .preflightExport(
              search: materials.search,
              status: materials.status,
              reportStatus: materials.reportStatus,
              isFree: materials.isFree,
            );
        return AdminExportCenterPreflight(
          count: result.count,
          filters: result.filters,
          formats: result.formats,
        );

      case AdminExportDomainKey.materialReports:
        final result = await _ref
            .read(adminMaterialsApiProvider)
            .preflightReportsExport(
              search: materialReports.search,
              status: materialReports.status,
              reason: materialReports.reason,
            );
        return AdminExportCenterPreflight(
          count: result.count,
          filters: result.filters,
          formats: result.formats,
        );

      case AdminExportDomainKey.deliveries:
        final dates = resolveDateRange(
          timeRange: deliveries.timeRange,
          customDateFrom: deliveries.customDateFrom,
          customDateTo: deliveries.customDateTo,
        );
        if (dates.error != null) {
          throw StateError(dates.error!);
        }
        final result = await _ref
            .read(adminDeliveriesApiProvider)
            .preflightExport(
              search: deliveries.search,
              status: deliveries.status,
              assignment: deliveries.assignment,
              scope: deliveries.scope,
              incidentState: deliveries.incidentState,
              dateFrom: dates.dateFrom,
              dateTo: dates.dateTo,
            );
        return AdminExportCenterPreflight(
          count: result.count,
          filters: result.filters,
          formats: result.formats,
        );

      case AdminExportDomainKey.users:
        final result = await _ref
            .read(adminPeopleApiProvider)
            .preflightExport(
              tab: users.tab,
              search: users.search,
              status: users.status,
            );
        return AdminExportCenterPreflight(
          count: result.count,
          filters: result.filters,
          formats: result.formats,
        );

      case AdminExportDomainKey.incidentReports:
        final result = await _ref
            .read(adminNoShowReportsApiProvider)
            .preflightExport(
              search: incidents.search,
              status: incidents.status == 'ALL' ? null : incidents.status,
              workflow: incidents.workflow == 'ALL' ? null : incidents.workflow,
              targetRole: incidents.targetRole == 'ALL'
                  ? null
                  : incidents.targetRole,
              operationalState: incidents.operationalState == 'ALL'
                  ? null
                  : incidents.operationalState,
              dateFrom: incidents.dateFrom,
              dateTo: incidents.dateTo,
            );
        return AdminExportCenterPreflight(
          count: result.count,
          filters: result.filters,
          formats: result.formats,
        );
    }
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
    switch (domain) {
      case AdminExportDomainKey.reservations:
        final dates = resolveDateRange(
          timeRange: reservations.timeRange,
          customDateFrom: reservations.customDateFrom,
          customDateTo: reservations.customDateTo,
        );
        if (dates.error != null) {
          throw StateError(dates.error!);
        }
        await _ref
            .read(adminReservationsApiProvider)
            .downloadExport(
              format: format,
              search: reservations.search,
              status: reservations.status,
              hasDelivery: reservations.hasDelivery,
              dateFrom: dates.dateFrom,
              dateTo: dates.dateTo,
            );

      case AdminExportDomainKey.materials:
        await _ref
            .read(adminMaterialsApiProvider)
            .downloadExport(
              format: format,
              search: materials.search,
              status: materials.status,
              reportStatus: materials.reportStatus,
              isFree: materials.isFree,
            );

      case AdminExportDomainKey.materialReports:
        await _ref
            .read(adminMaterialsApiProvider)
            .downloadReportsExport(
              format: format,
              search: materialReports.search,
              status: materialReports.status,
              reason: materialReports.reason,
            );

      case AdminExportDomainKey.deliveries:
        final dates = resolveDateRange(
          timeRange: deliveries.timeRange,
          customDateFrom: deliveries.customDateFrom,
          customDateTo: deliveries.customDateTo,
        );
        if (dates.error != null) {
          throw StateError(dates.error!);
        }
        await _ref
            .read(adminDeliveriesApiProvider)
            .downloadExport(
              format: format,
              search: deliveries.search,
              status: deliveries.status,
              assignment: deliveries.assignment,
              scope: deliveries.scope,
              incidentState: deliveries.incidentState,
              dateFrom: dates.dateFrom,
              dateTo: dates.dateTo,
            );

      case AdminExportDomainKey.users:
        await _ref
            .read(adminPeopleApiProvider)
            .downloadExport(
              format: format,
              tab: users.tab,
              search: users.search,
              status: users.status,
            );

      case AdminExportDomainKey.incidentReports:
        await _ref
            .read(adminNoShowReportsApiProvider)
            .downloadExport(
              format: format,
              search: incidents.search,
              status: incidents.status == 'ALL' ? null : incidents.status,
              workflow: incidents.workflow == 'ALL' ? null : incidents.workflow,
              targetRole: incidents.targetRole == 'ALL'
                  ? null
                  : incidents.targetRole,
              operationalState: incidents.operationalState == 'ALL'
                  ? null
                  : incidents.operationalState,
              dateFrom: incidents.dateFrom,
              dateTo: incidents.dateTo,
            );
    }
  }
}

final adminExportCenterServiceProvider = Provider<AdminExportCenterGateway>((
  ref,
) {
  return AdminExportCenterService(ref);
});
