import '../../domain/models/project_build.dart';
import '../../domain/models/project_build_material_link.dart';

const _terminalReservationStatuses = <String>{
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
  'FULFILLMENT_FAILED',
};

const _activeReservationStatuses = <String>{
  'PENDING',
  'AWAITING_LEARNER_CONFIRMATION',
  'AWAITING_SUPPLIER_CONFIRMATION',
  'ACCEPTED',
  'AWAITING_RESOLUTION',
};

class ProjectBuildAcquisitionState {
  const ProjectBuildAcquisitionState._();

  static bool isAcquiredViaCompletedReservation(ProjectBuildItem item) {
    return item.isReadyForBuild &&
        item.linkedReservation?.status.toUpperCase() == 'COMPLETED';
  }

  static bool itemNeedsActiveRefresh(ProjectBuildItem item) {
    if (isAcquiredViaCompletedReservation(item)) {
      return false;
    }

    final reservation = item.linkedReservation;
    if (reservation != null) {
      final status = reservation.status.toUpperCase();
      if (_terminalReservationStatuses.contains(status)) {
        return false;
      }
      if (_activeReservationStatuses.contains(status)) {
        return true;
      }
      return !item.isReadyForBuild;
    }

    if (item.linkedMaterial != null && !item.isReadyForBuild) {
      return true;
    }

    return false;
  }

  static bool buildNeedsActiveRefresh(ProjectBuild? build) {
    if (build == null) {
      return false;
    }

    return build.items.any(itemNeedsActiveRefresh);
  }

  static bool shouldShowAvailabilityWarning({
    required LinkedMaterialSummary material,
    LinkedReservationSummary? linkedReservation,
  }) {
    if (material.availabilityWarning == null) {
      return false;
    }

    if (linkedReservation?.status.toUpperCase() == 'COMPLETED') {
      return false;
    }

    return true;
  }

  static bool shouldShowClassificationControls(ProjectBuildItem item) {
    return !isAcquiredViaCompletedReservation(item);
  }
}
