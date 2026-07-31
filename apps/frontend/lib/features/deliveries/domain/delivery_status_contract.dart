/// Delivery lifecycle values returned by the backend `DeliveryStatus` enum.
const learnerDeliveryStatuses = <String>{
  'WAITING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'DELIVERED',
  'CANCELLED',
  'FAILED_PICKUP',
  'FAILED_DELIVERY',
  'DRIVER_NO_SHOW',
  'LEARNER_NO_SHOW',
  'AWAITING_RESOLUTION',
};

const activeLearnerDeliveryStatuses = <String>{
  'WAITING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
};

const terminalLearnerDeliveryStatuses = <String>{
  'DELIVERED',
  'CANCELLED',
  'FAILED_PICKUP',
  'FAILED_DELIVERY',
  'DRIVER_NO_SHOW',
  'LEARNER_NO_SHOW',
  'AWAITING_RESOLUTION',
};

String normalizeDeliveryStatus(String? status) =>
    status?.trim().toUpperCase() ?? '';

bool isActiveLearnerDeliveryStatus(String status) =>
    activeLearnerDeliveryStatuses.contains(normalizeDeliveryStatus(status));

bool isTerminalLearnerDeliveryStatus(String status) =>
    terminalLearnerDeliveryStatuses.contains(normalizeDeliveryStatus(status));

bool isSuccessfulLearnerDeliveryStatus(String? status) =>
    normalizeDeliveryStatus(status) == 'DELIVERED';
