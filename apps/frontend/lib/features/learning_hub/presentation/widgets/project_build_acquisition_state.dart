import '../../domain/models/project_build.dart';

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

  static bool isAwaitingResolution(ProjectBuildItem item) {
    return item.linkedReservation?.status.toUpperCase() == 'AWAITING_RESOLUTION';
  }

  static bool hasActiveLinkedReservation(ProjectBuildItem item) {
    final reservation = item.linkedReservation;
    if (reservation == null) {
      return false;
    }

    final status = reservation.status.toUpperCase();
    if (status == 'COMPLETED' ||
        _terminalReservationStatuses.contains(status)) {
      return false;
    }

    return _activeReservationStatuses.contains(status);
  }

  static bool hasSelectedMaterial(ProjectBuildItem item) {
    return item.linkedMaterial != null &&
        !isAcquiredViaCompletedReservation(item) &&
        !isAwaitingResolution(item) &&
        !hasActiveLinkedReservation(item);
  }

  static bool isAlreadyOwnedClassification(ProjectBuildItem item) {
    return item.status == ProjectBuildItemStatus.alreadyOwned;
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
    return !isAcquiredViaCompletedReservation(item) &&
        !isAwaitingResolution(item) &&
        !hasActiveLinkedReservation(item) &&
        !hasSelectedMaterial(item);
  }
}
