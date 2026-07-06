import 'driver_delivery.dart';

class DriverDeliveriesListMeta {
  const DriverDeliveriesListMeta({
    required this.activeDeliveryCount,
    required this.maxActiveDeliveries,
    required this.canAcceptMore,
    this.driverProfileCity,
    this.driverProfileArea,
    this.driverHasRecentLocation = false,
    this.nearbyAvailableCount,
    this.totalAvailableCount,
  });

  final int activeDeliveryCount;
  final int maxActiveDeliveries;
  final bool canAcceptMore;
  final String? driverProfileCity;
  final String? driverProfileArea;
  final bool driverHasRecentLocation;
  final int? nearbyAvailableCount;
  final int? totalAvailableCount;

  factory DriverDeliveriesListMeta.fromJson(Map<String, dynamic> json) {
    return DriverDeliveriesListMeta(
      activeDeliveryCount: json['activeDeliveryCount'] as int? ?? 0,
      maxActiveDeliveries: json['maxActiveDeliveries'] as int? ?? 3,
      canAcceptMore: json['canAcceptMore'] as bool? ?? true,
      driverProfileCity: json['driverProfileCity'] as String?,
      driverProfileArea: json['driverProfileArea'] as String?,
      driverHasRecentLocation: json['driverHasRecentLocation'] == true,
      nearbyAvailableCount: json['nearbyAvailableCount'] as int?,
      totalAvailableCount: json['totalAvailableCount'] as int?,
    );
  }
}

class DriverDeliveriesListResult {
  const DriverDeliveriesListResult({
    required this.deliveries,
    required this.meta,
  });

  final List<DriverDelivery> deliveries;
  final DriverDeliveriesListMeta meta;
}

class DriverAvailableJobsFilter {
  const DriverAvailableJobsFilter({
    this.city,
    this.area,
    this.maxDistanceKm,
    this.sortBy = 'newest',
  });

  final String? city;
  final String? area;
  final double? maxDistanceKm;
  final String sortBy;

  DriverAvailableJobsFilter copyWith({
    String? city,
    String? area,
    double? maxDistanceKm,
    String? sortBy,
    bool clearCity = false,
    bool clearArea = false,
    bool clearMaxDistanceKm = false,
  }) {
    return DriverAvailableJobsFilter(
      city: clearCity ? null : (city ?? this.city),
      area: clearArea ? null : (area ?? this.area),
      maxDistanceKm:
          clearMaxDistanceKm ? null : (maxDistanceKm ?? this.maxDistanceKm),
      sortBy: sortBy ?? this.sortBy,
    );
  }

  Map<String, dynamic> toQueryParameters() {
    return {
      if (city != null && city!.trim().isNotEmpty) 'city': city!.trim(),
      if (area != null && area!.trim().isNotEmpty) 'area': area!.trim(),
      if (maxDistanceKm != null) 'maxDistanceKm': maxDistanceKm,
      if (sortBy.isNotEmpty) 'sortBy': sortBy,
    };
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DriverAvailableJobsFilter &&
            city == other.city &&
            area == other.area &&
            maxDistanceKm == other.maxDistanceKm &&
            sortBy == other.sortBy;
  }

  @override
  int get hashCode => Object.hash(city, area, maxDistanceKm, sortBy);
}
