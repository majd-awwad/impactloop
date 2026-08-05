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

  static String resolveAcquisitionState(ProjectBuildItem item) {
    final state = item.acquisitionState?.trim();
    if (state != null && state.isNotEmpty) {
      return state;
    }

    if (item.linkedReservation?.status.toUpperCase() == 'COMPLETED') {
      return 'acquired';
    }

    if (item.linkedReservation?.status.toUpperCase() == 'AWAITING_RESOLUTION') {
      return 'needs_attention';
    }

    if (hasActiveLinkedReservation(item)) {
      return 'reserved';
    }

    if (item.linkedMaterial != null) {
      return 'selected';
    }

    if (item.status == ProjectBuildItemStatus.alreadyOwned) {
      return 'already_owned';
    }

    return 'missing';
  }

  static String? resolveAllocationResult(ProjectBuildItem item) {
    final result = item.allocationResult?.trim();
    if (result != null && result.isNotEmpty) {
      return result;
    }

    return switch (item.quantityAllocation?.outcome) {
      'allocation_sufficient' => 'sufficient',
      'allocation_partial' || 'insufficient_quantity' => 'insufficient_quantity',
      'incompatible_unit' => 'incompatible_unit',
      'unknown_quantity' => 'unknown_quantity',
      'conflict' => 'historical_conflict',
      'not_applicable' => 'not_applicable',
      _ => null,
    };
  }

  static bool isAcquired(ProjectBuildItem item) =>
      resolveAcquisitionState(item) == 'acquired';

  static bool isAcquiredViaCompletedReservation(ProjectBuildItem item) =>
      isAcquired(item) && resolveAllocationResult(item) == 'sufficient';

  static bool isPartiallyAcquired(ProjectBuildItem item) =>
      isAcquired(item) &&
      resolveAllocationResult(item) == 'insufficient_quantity';

  static bool hasIncompatibleAcquiredAllocation(ProjectBuildItem item) =>
      isAcquired(item) &&
      resolveAllocationResult(item) == 'incompatible_unit';

  static bool hasInsufficientQuantity(ProjectBuildItem item) {
    if (isAcquired(item)) {
      return resolveAllocationResult(item) == 'insufficient_quantity';
    }

    final allocation = item.quantityAllocation;
    if (allocation == null) {
      return false;
    }

    return allocation.outcome == 'insufficient_quantity' &&
        !hasActiveLinkedReservation(item);
  }

  static bool isAwaitingResolution(ProjectBuildItem item) =>
      resolveAcquisitionState(item) == 'needs_attention';

  static bool hasActiveLinkedReservation(ProjectBuildItem item) {
    final reservation = item.linkedReservation;
    if (reservation == null) {
      return false;
    }

    final status = reservation.status.toUpperCase();
    if (status == 'COMPLETED' || _terminalReservationStatuses.contains(status)) {
      return false;
    }

    return _activeReservationStatuses.contains(status);
  }

  static bool hasSelectedMaterial(ProjectBuildItem item) =>
      resolveAcquisitionState(item) == 'selected';

  static bool isAlreadyOwnedClassification(ProjectBuildItem item) =>
      resolveAcquisitionState(item) == 'already_owned';

  static bool canRemoveAcquiredAllocation(ProjectBuildItem item) =>
      isAcquired(item);

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

    if (build.status != ProjectBuildStatus.inProgress) {
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
    final state = resolveAcquisitionState(item);
    return state == 'missing';
  }
}
