import 'package:flutter/foundation.dart';

import '../../../../core/errors/api_exception.dart';
import '../../data/admin_export_center_models.dart';
import '../../data/admin_export_center_service.dart';
import '../widgets/admin_monitoring_utils.dart';

/// Mutable Export Center state with stale-preview and race-safe preview tokens.
class AdminExportCenterController extends ChangeNotifier {
  AdminExportCenterController({
    required AdminExportCenterGateway service,
    AdminExportDomainKey initialDomain = AdminExportDomainKey.reservations,
  }) : _service = service,
       _domain = initialDomain,
       _format = initialDomain.defaultFormat;

  final AdminExportCenterGateway _service;

  AdminExportDomainKey _domain;
  String _format;
  ReservationsExportCenterFilters _reservations =
      ReservationsExportCenterFilters.empty;
  MaterialsExportCenterFilters _materials = MaterialsExportCenterFilters.empty;
  MaterialReportsExportCenterFilters _materialReports =
      MaterialReportsExportCenterFilters.empty;
  DeliveriesExportCenterFilters _deliveries =
      DeliveriesExportCenterFilters.empty;
  UsersExportCenterFilters _users = UsersExportCenterFilters.empty;
  IncidentReportsExportCenterFilters _incidents =
      IncidentReportsExportCenterFilters.empty;

  AdminExportCenterPreflight? _preflight;
  bool _previewStale = true;
  bool _isPreviewLoading = false;
  bool _isExporting = false;
  Object? _error;
  int _previewGeneration = 0;

  AdminExportDomainKey get domain => _domain;
  String get format => _format;
  ReservationsExportCenterFilters get reservations => _reservations;
  MaterialsExportCenterFilters get materials => _materials;
  MaterialReportsExportCenterFilters get materialReports => _materialReports;
  DeliveriesExportCenterFilters get deliveries => _deliveries;
  UsersExportCenterFilters get users => _users;
  IncidentReportsExportCenterFilters get incidents => _incidents;
  AdminExportCenterPreflight? get preflight => _preflight;
  bool get previewStale => _previewStale;
  bool get isPreviewLoading => _isPreviewLoading;
  bool get isExporting => _isExporting;
  Object? get error => _error;
  int get previewGeneration => _previewGeneration;

  bool get canPreview => !_isPreviewLoading && !_isExporting;

  bool get canExport {
    if (_isExporting || _isPreviewLoading || _previewStale) return false;
    final result = _preflight;
    if (result == null || result.count <= 0) return false;
    final eligibility = result.eligibilityFor(_format);
    return eligibility?.allowed == true;
  }

  String get activeFilterSummary {
    switch (_domain) {
      case AdminExportDomainKey.reservations:
        return _summarizeReservations();
      case AdminExportDomainKey.materials:
        return _summarizeMaterials();
      case AdminExportDomainKey.materialReports:
        return _summarizeMaterialReports();
      case AdminExportDomainKey.deliveries:
        return _summarizeDeliveries();
      case AdminExportDomainKey.users:
        return _summarizeUsers();
      case AdminExportDomainKey.incidentReports:
        return _summarizeIncidents();
    }
  }

  void selectDomain(AdminExportDomainKey next) {
    if (_isExporting) return;
    if (next == _domain) return;
    _domain = next;
    _format = next.defaultFormat;
    _preflight = null;
    _previewStale = true;
    _error = null;
    _previewGeneration += 1;
    notifyListeners();
  }

  void selectFormat(String format) {
    if (!_domain.supportedFormats.contains(format)) return;
    if (_format == format) return;
    _format = format;
    notifyListeners();
  }

  void updateReservations(ReservationsExportCenterFilters filters) {
    _reservations = filters;
    _markFiltersChanged();
  }

  void updateMaterials(MaterialsExportCenterFilters filters) {
    _materials = filters;
    _markFiltersChanged();
  }

  void updateMaterialReports(MaterialReportsExportCenterFilters filters) {
    _materialReports = filters;
    _markFiltersChanged();
  }

  void updateDeliveries(DeliveriesExportCenterFilters filters) {
    _deliveries = filters;
    _markFiltersChanged();
  }

  void updateUsers(UsersExportCenterFilters filters) {
    _users = filters;
    _markFiltersChanged();
  }

  void updateIncidents(IncidentReportsExportCenterFilters filters) {
    _incidents = filters;
    _markFiltersChanged();
  }

  void resetCurrentFilters() {
    switch (_domain) {
      case AdminExportDomainKey.reservations:
        _reservations = ReservationsExportCenterFilters.empty;
      case AdminExportDomainKey.materials:
        _materials = MaterialsExportCenterFilters.empty;
      case AdminExportDomainKey.materialReports:
        _materialReports = MaterialReportsExportCenterFilters.empty;
      case AdminExportDomainKey.deliveries:
        _deliveries = DeliveriesExportCenterFilters.empty;
      case AdminExportDomainKey.users:
        _users = UsersExportCenterFilters.empty;
      case AdminExportDomainKey.incidentReports:
        _incidents = IncidentReportsExportCenterFilters.empty;
    }
    _markFiltersChanged();
  }

  Future<void> preview() async {
    if (!canPreview) return;

    if (_domain == AdminExportDomainKey.reservations) {
      final dates = resolveDateRange(
        timeRange: _reservations.timeRange,
        customDateFrom: _reservations.customDateFrom,
        customDateTo: _reservations.customDateTo,
      );
      if (dates.error != null) {
        _error = dates.error;
        notifyListeners();
        return;
      }
    }
    if (_domain == AdminExportDomainKey.deliveries) {
      final dates = resolveDateRange(
        timeRange: _deliveries.timeRange,
        customDateFrom: _deliveries.customDateFrom,
        customDateTo: _deliveries.customDateTo,
      );
      if (dates.error != null) {
        _error = dates.error;
        notifyListeners();
        return;
      }
    }

    final generation = ++_previewGeneration;
    final domainAtStart = _domain;
    _isPreviewLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await _service.preview(
        domain: domainAtStart,
        reservations: _reservations,
        materials: _materials,
        materialReports: _materialReports,
        deliveries: _deliveries,
        users: _users,
        incidents: _incidents,
      );
      if (generation != _previewGeneration || domainAtStart != _domain) {
        return;
      }
      _preflight = result;
      _previewStale = false;
      _error = null;
      if (!_domain.supportedFormats.contains(_format)) {
        _format = _domain.defaultFormat;
      }
    } on ApiException catch (error) {
      if (generation != _previewGeneration || domainAtStart != _domain) {
        return;
      }
      _preflight = null;
      _previewStale = true;
      _error = error;
    } catch (error) {
      if (generation != _previewGeneration || domainAtStart != _domain) {
        return;
      }
      _preflight = null;
      _previewStale = true;
      _error = error;
    } finally {
      if (generation == _previewGeneration) {
        _isPreviewLoading = false;
        notifyListeners();
      }
    }
  }

  Future<bool> export() async {
    if (!canExport) return false;

    final domainAtStart = _domain;
    final formatAtStart = _format;
    _isExporting = true;
    _error = null;
    notifyListeners();

    try {
      await _service.download(
        domain: domainAtStart,
        format: formatAtStart,
        reservations: _reservations,
        materials: _materials,
        materialReports: _materialReports,
        deliveries: _deliveries,
        users: _users,
        incidents: _incidents,
      );
      if (domainAtStart != _domain) return false;
      _error = null;
      return true;
    } on ApiException catch (error) {
      if (domainAtStart != _domain) return false;
      _error = error;
      return false;
    } catch (error) {
      if (domainAtStart != _domain) return false;
      _error = error;
      return false;
    } finally {
      _isExporting = false;
      notifyListeners();
    }
  }

  void _markFiltersChanged() {
    _previewStale = true;
    _error = null;
    notifyListeners();
  }

  String _summarizeReservations() {
    final parts = <String>[];
    if (_reservations.search.trim().isNotEmpty) {
      parts.add('Search: ${_reservations.search.trim()}');
    }
    if (_reservations.status != 'ALL') {
      parts.add('Status: ${_reservations.status}');
    }
    if (_reservations.hasDelivery != 'ALL') {
      parts.add('Has delivery: ${_reservations.hasDelivery}');
    }
    if (_reservations.timeRange != kTimeRangeAll) {
      parts.add('Time: ${_reservations.timeRange}');
    }
    return parts.isEmpty ? 'No filters (all reservations)' : parts.join(' · ');
  }

  String _summarizeMaterials() {
    final parts = <String>[];
    if (_materials.search.trim().isNotEmpty) {
      parts.add('Search: ${_materials.search.trim()}');
    }
    if (_materials.status != 'ALL') parts.add('Status: ${_materials.status}');
    if (_materials.reportStatus != 'ALL') {
      parts.add('Reports: ${_materials.reportStatus}');
    }
    if (_materials.priceFilter != 'ALL') {
      parts.add('Price: ${_materials.priceFilter}');
    }
    return parts.isEmpty ? 'No filters (all materials)' : parts.join(' · ');
  }

  String _summarizeMaterialReports() {
    final parts = <String>[];
    if (_materialReports.search.trim().isNotEmpty) {
      parts.add('Search: ${_materialReports.search.trim()}');
    }
    if (_materialReports.status != 'ALL') {
      parts.add('Status: ${_materialReports.status}');
    }
    if (_materialReports.reason != 'ALL') {
      parts.add('Reason: ${_materialReports.reason}');
    }
    return parts.isEmpty
        ? 'No filters (all material reports)'
        : parts.join(' · ');
  }

  String _summarizeDeliveries() {
    final parts = <String>[];
    if (_deliveries.search.trim().isNotEmpty) {
      parts.add('Search: ${_deliveries.search.trim()}');
    }
    if (_deliveries.status != 'ALL') parts.add('Status: ${_deliveries.status}');
    if (_deliveries.scope != 'ALL') parts.add('Scope: ${_deliveries.scope}');
    if (_deliveries.assignment != 'ALL') {
      parts.add('Assignment: ${_deliveries.assignment}');
    }
    if (_deliveries.incidentState != 'ALL') {
      parts.add('Incident: ${_deliveries.incidentState}');
    }
    if (_deliveries.timeRange != kTimeRangeAll) {
      parts.add('Time: ${_deliveries.timeRange}');
    }
    return parts.isEmpty ? 'No filters (all deliveries)' : parts.join(' · ');
  }

  String _summarizeUsers() {
    final parts = <String>[];
    if (_users.tab != 'ALL') parts.add('Tab: ${_users.tab}');
    if (_users.search.trim().isNotEmpty) {
      parts.add('Search: ${_users.search.trim()}');
    }
    if (_users.status != 'ALL') parts.add('Status: ${_users.status}');
    return parts.isEmpty ? 'No filters (all users)' : parts.join(' · ');
  }

  String _summarizeIncidents() {
    final parts = <String>[];
    if (_incidents.search.trim().isNotEmpty) {
      parts.add('Search: ${_incidents.search.trim()}');
    }
    if (_incidents.status != 'ALL') parts.add('Status: ${_incidents.status}');
    if (_incidents.workflow != 'ALL') {
      parts.add('Workflow: ${_incidents.workflow}');
    }
    if (_incidents.targetRole != 'ALL') {
      parts.add('Target role: ${_incidents.targetRole}');
    }
    if (_incidents.operationalState != 'ALL') {
      parts.add('Operational: ${_incidents.operationalState}');
    }
    if (_incidents.dateFrom != null || _incidents.dateTo != null) {
      parts.add(
        'Dates: ${_incidents.dateFrom ?? '…'} → ${_incidents.dateTo ?? '…'}',
      );
    }
    return parts.isEmpty
        ? 'No filters (all incident reports)'
        : parts.join(' · ');
  }
}
