import 'package:dio/dio.dart';

import '../../reservations/data/models/learner_reservation.dart';
import 'discovery_material.dart';
import 'material_discovery_result.dart';

class MaterialViewerState {
  const MaterialViewerState({
    required this.materialId,
    required this.isLiked,
    required this.supplierFollowed,
    required this.isOwnMaterial,
    required this.canReserve,
    this.reserveBlockReason,
    this.reservation,
  });

  final String materialId;
  final bool isLiked;
  final bool supplierFollowed;
  final bool isOwnMaterial;
  final bool canReserve;
  final String? reserveBlockReason;
  final LearnerReservation? reservation;

  factory MaterialViewerState.fromJson(Map<String, dynamic> json) {
    final reservation = json['reservation'];
    return MaterialViewerState(
      materialId: json['materialId'] as String? ?? '',
      isLiked: json['isLiked'] == true,
      supplierFollowed: json['supplierFollowed'] == true,
      isOwnMaterial: json['isOwnMaterial'] == true,
      canReserve: json['canReserve'] == true,
      reserveBlockReason: json['reserveBlockReason'] as String?,
      reservation: reservation is Map
          ? LearnerReservation.fromJson(Map<String, dynamic>.from(reservation))
          : null,
    );
  }
}

class RelatedMaterialsResult {
  const RelatedMaterialsResult({
    this.category = const [],
    this.nearby = const [],
  });

  final List<DiscoveryMaterial> category;
  final List<DiscoveryMaterial> nearby;
}

class SupplierViewerState {
  const SupplierViewerState({required this.isFollowedByViewer});

  final bool isFollowedByViewer;

  factory SupplierViewerState.fromJson(Map<String, dynamic> json) =>
      SupplierViewerState(
        isFollowedByViewer: json['isFollowedByViewer'] == true,
      );
}

abstract class MaterialDetailsPerformanceRepository {
  Future<DiscoveryMaterial?> getPublicMaterialById(
    String id, {
    CancelToken? cancelToken,
  });

  Future<MaterialViewerState> getMaterialViewerState(
    String id, {
    CancelToken? cancelToken,
  });

  Future<void> recordMaterialView(
    String id, {
    required String operationKey,
    String? recommendationImpressionId,
  });

  Future<RelatedMaterialsResult> fetchRelatedMaterials(
    String id, {
    int limit = 4,
    CancelToken? cancelToken,
  });
}

abstract class PublicSupplierPerformanceRepository {
  Future<PublicSupplier?> fetchPublicSupplierCore(
    String supplierProfileId, {
    CancelToken? cancelToken,
  });

  Future<SupplierViewerState> fetchSupplierViewerState(
    String supplierProfileId, {
    CancelToken? cancelToken,
  });

  Future<MaterialDiscoveryResult> fetchSupplierMaterialsPage(
    String supplierProfileId, {
    required int page,
    required int limit,
    CancelToken? cancelToken,
  });
}
