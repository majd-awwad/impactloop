import 'package:flutter/material.dart';

import 'admin_reservations_api.dart' show AdminExportFormatEligibility;

/// Allowlisted Export Center domain keys — never construct URLs from free text.
enum AdminExportDomainKey {
  reservations,
  materials,
  materialReports,
  deliveries,
  users,
  incidentReports,
}

extension AdminExportDomainKeyX on AdminExportDomainKey {
  String get id => switch (this) {
    AdminExportDomainKey.reservations => 'reservations',
    AdminExportDomainKey.materials => 'materials',
    AdminExportDomainKey.materialReports => 'material_reports',
    AdminExportDomainKey.deliveries => 'deliveries',
    AdminExportDomainKey.users => 'users',
    AdminExportDomainKey.incidentReports => 'incident_reports',
  };

  String get label => switch (this) {
    AdminExportDomainKey.reservations => 'Reservations',
    AdminExportDomainKey.materials => 'Materials',
    AdminExportDomainKey.materialReports => 'Material Reports',
    AdminExportDomainKey.deliveries => 'Deliveries',
    AdminExportDomainKey.users => 'Users',
    AdminExportDomainKey.incidentReports => 'Incident Reports',
  };

  String get description => switch (this) {
    AdminExportDomainKey.reservations =>
      'Reservation workflow, learner, supplier, delivery, and status data.',
    AdminExportDomainKey.materials =>
      'Published material records, suppliers, pricing, location summary, and report state.',
    AdminExportDomainKey.materialReports =>
      'Material moderation reports and review metadata.',
    AdminExportDomainKey.deliveries =>
      'Delivery workflow, assignment, incident, driver, and status data.',
    AdminExportDomainKey.users =>
      'Administrative user, role, account-status, profile summary, and activity data.',
    AdminExportDomainKey.incidentReports =>
      'No-show and operational incident reports with strike-impact information.',
  };

  IconData get icon => switch (this) {
    AdminExportDomainKey.reservations => Icons.event_note_outlined,
    AdminExportDomainKey.materials => Icons.inventory_2_outlined,
    AdminExportDomainKey.materialReports => Icons.flag_outlined,
    AdminExportDomainKey.deliveries => Icons.local_shipping_outlined,
    AdminExportDomainKey.users => Icons.people_outline,
    AdminExportDomainKey.incidentReports => Icons.report_outlined,
  };

  /// Formats supported by the existing domain export endpoints.
  List<String> get supportedFormats => switch (this) {
    AdminExportDomainKey.reservations => const ['xlsx', 'pdf', 'csv'],
    _ => const ['xlsx', 'csv'],
  };

  String get defaultFormat => 'xlsx';
}

class AdminExportCenterPreflight {
  const AdminExportCenterPreflight({
    required this.count,
    required this.filters,
    required this.formats,
  });

  final int count;
  final Map<String, dynamic> filters;
  final Map<String, AdminExportFormatEligibility> formats;

  AdminExportFormatEligibility? eligibilityFor(String format) =>
      formats[format];
}

class ReservationsExportCenterFilters {
  const ReservationsExportCenterFilters({
    this.search = '',
    this.status = 'ALL',
    this.hasDelivery = 'ALL',
    this.timeRange = 'ALL',
    this.customDateFrom,
    this.customDateTo,
  });

  final String search;
  final String status;
  final String hasDelivery;
  final String timeRange;
  final String? customDateFrom;
  final String? customDateTo;

  ReservationsExportCenterFilters copyWith({
    String? search,
    String? status,
    String? hasDelivery,
    String? timeRange,
    String? customDateFrom,
    String? customDateTo,
    bool clearCustomDates = false,
  }) {
    return ReservationsExportCenterFilters(
      search: search ?? this.search,
      status: status ?? this.status,
      hasDelivery: hasDelivery ?? this.hasDelivery,
      timeRange: timeRange ?? this.timeRange,
      customDateFrom: clearCustomDates
          ? null
          : (customDateFrom ?? this.customDateFrom),
      customDateTo: clearCustomDates
          ? null
          : (customDateTo ?? this.customDateTo),
    );
  }

  static const empty = ReservationsExportCenterFilters();
}

class MaterialsExportCenterFilters {
  const MaterialsExportCenterFilters({
    this.search = '',
    this.status = 'ALL',
    this.reportStatus = 'ALL',
    this.priceFilter = 'ALL',
  });

  final String search;
  final String status;
  final String reportStatus;
  final String priceFilter;

  bool? get isFree => switch (priceFilter) {
    'FREE' => true,
    'PAID' => false,
    _ => null,
  };

  MaterialsExportCenterFilters copyWith({
    String? search,
    String? status,
    String? reportStatus,
    String? priceFilter,
  }) {
    return MaterialsExportCenterFilters(
      search: search ?? this.search,
      status: status ?? this.status,
      reportStatus: reportStatus ?? this.reportStatus,
      priceFilter: priceFilter ?? this.priceFilter,
    );
  }

  static const empty = MaterialsExportCenterFilters();
}

class MaterialReportsExportCenterFilters {
  const MaterialReportsExportCenterFilters({
    this.search = '',
    this.status = 'ALL',
    this.reason = 'ALL',
  });

  final String search;
  final String status;
  final String reason;

  MaterialReportsExportCenterFilters copyWith({
    String? search,
    String? status,
    String? reason,
  }) {
    return MaterialReportsExportCenterFilters(
      search: search ?? this.search,
      status: status ?? this.status,
      reason: reason ?? this.reason,
    );
  }

  static const empty = MaterialReportsExportCenterFilters();
}

class DeliveriesExportCenterFilters {
  const DeliveriesExportCenterFilters({
    this.search = '',
    this.status = 'ALL',
    this.scope = 'ALL',
    this.assignment = 'ALL',
    this.incidentState = 'ALL',
    this.timeRange = 'ALL',
    this.customDateFrom,
    this.customDateTo,
  });

  final String search;
  final String status;
  final String scope;
  final String assignment;
  final String incidentState;
  final String timeRange;
  final String? customDateFrom;
  final String? customDateTo;

  DeliveriesExportCenterFilters copyWith({
    String? search,
    String? status,
    String? scope,
    String? assignment,
    String? incidentState,
    String? timeRange,
    String? customDateFrom,
    String? customDateTo,
    bool clearCustomDates = false,
  }) {
    return DeliveriesExportCenterFilters(
      search: search ?? this.search,
      status: status ?? this.status,
      scope: scope ?? this.scope,
      assignment: assignment ?? this.assignment,
      incidentState: incidentState ?? this.incidentState,
      timeRange: timeRange ?? this.timeRange,
      customDateFrom: clearCustomDates
          ? null
          : (customDateFrom ?? this.customDateFrom),
      customDateTo: clearCustomDates
          ? null
          : (customDateTo ?? this.customDateTo),
    );
  }

  static const empty = DeliveriesExportCenterFilters();
}

class UsersExportCenterFilters {
  const UsersExportCenterFilters({
    this.tab = 'ALL',
    this.search = '',
    this.status = 'ALL',
  });

  final String tab;
  final String search;
  final String status;

  UsersExportCenterFilters copyWith({
    String? tab,
    String? search,
    String? status,
  }) {
    return UsersExportCenterFilters(
      tab: tab ?? this.tab,
      search: search ?? this.search,
      status: status ?? this.status,
    );
  }

  static const empty = UsersExportCenterFilters();
}

class IncidentReportsExportCenterFilters {
  const IncidentReportsExportCenterFilters({
    this.search = '',
    this.status = 'ALL',
    this.workflow = 'ALL',
    this.targetRole = 'ALL',
    this.operationalState = 'ALL',
    this.dateFrom,
    this.dateTo,
  });

  final String search;
  final String status;
  final String workflow;
  final String targetRole;
  final String operationalState;
  final String? dateFrom;
  final String? dateTo;

  IncidentReportsExportCenterFilters copyWith({
    String? search,
    String? status,
    String? workflow,
    String? targetRole,
    String? operationalState,
    String? dateFrom,
    String? dateTo,
    bool clearDates = false,
  }) {
    return IncidentReportsExportCenterFilters(
      search: search ?? this.search,
      status: status ?? this.status,
      workflow: workflow ?? this.workflow,
      targetRole: targetRole ?? this.targetRole,
      operationalState: operationalState ?? this.operationalState,
      dateFrom: clearDates ? null : (dateFrom ?? this.dateFrom),
      dateTo: clearDates ? null : (dateTo ?? this.dateTo),
    );
  }

  static const empty = IncidentReportsExportCenterFilters();
}

/// Static option lists matching existing Admin export/list contracts.
abstract final class AdminExportCenterOptions {
  static const reservationStatuses = <String>[
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'CANCELLED',
    'COMPLETED',
    'EXPIRED',
  ];

  static const materialStatuses = <String>[
    'AVAILABLE',
    'PENDING_RESERVATION',
    'RESERVED',
    'REUSED',
    'UNAVAILABLE',
  ];

  static const materialReportStatuses = <String>[
    'PENDING',
    'RESOLVED',
    'REJECTED',
  ];

  static const materialReportReasons = <String>[
    'MISLEADING_INFORMATION',
    'WRONG_CATEGORY',
    'WRONG_PRICE',
    'INAPPROPRIATE',
    'ITEM_NOT_AVAILABLE',
    'SUSPICIOUS_SUPPLIER',
    'OTHER',
  ];

  static const materialListReportStatuses = <String>[
    'PENDING',
    'HAS_REPORTS',
    'NONE',
  ];

  static const deliveryStatuses = <String>[
    'WAITING_FOR_DRIVER',
    'DRIVER_ASSIGNED',
    'ARRIVED_PICKUP',
    'PICKED_UP',
    'ON_THE_WAY',
    'ARRIVED_DROPOFF',
    'REDELIVERY_PENDING',
    'REDELIVERY_SCHEDULED',
    'RETURN_TO_SUPPLIER_REQUIRED',
    'RETURNED_TO_SUPPLIER',
    'DELIVERED',
    'CANCELLED',
    'FAILED_PICKUP',
    'FAILED_DELIVERY',
    'DRIVER_NO_SHOW',
    'LEARNER_NO_SHOW',
    'AWAITING_RESOLUTION',
  ];

  static const deliveryScopes = <String>['SINGLE', 'GROUPED'];

  static const deliveryAssignments = <String>[
    'ASSIGNED',
    'UNASSIGNED',
    'ACTIVE',
    'RELEASED',
    'HISTORICAL',
  ];

  static const incidentStates = <String>[
    'PENDING_REVIEW',
    'VERIFIED',
    'REJECTED',
    'RESOLVED_NO_STRIKE',
  ];

  static const userTabs = <String>[
    'ALL',
    'LEARNERS',
    'SUPPLIERS',
    'DRIVERS',
    'MODERATORS',
    'ADMINS',
  ];

  static const userStatuses = <String>[
    'PENDING_VERIFICATION',
    'ACTIVE',
    'SUSPENDED',
    'DISABLED',
  ];

  static const incidentWorkflows = <String>[
    'ACCOUNTABILITY',
    'SYSTEM_RECOVERY',
    'ACCOUNTABILITY_AND_RECOVERY',
  ];

  static const incidentTargetRoles = <String>[
    'LEARNER',
    'SUPPLIER',
    'DRIVER',
    'SYSTEM',
  ];

  static const incidentOperationalStates = <String>[
    'NOT_REQUIRED',
    'REQUIRES_RESOLUTION',
    'RESOLVED',
  ];

  static const incidentStatuses = incidentStates;
}
