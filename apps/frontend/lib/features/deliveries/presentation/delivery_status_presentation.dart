import '../../../shared/widgets/materials/material_status_badge.dart';

String deliveryStatusLabel(String status) {
  switch (status) {
    case 'WAITING_FOR_DRIVER':
      return 'Waiting for driver';
    case 'DRIVER_ASSIGNED':
      return 'Driver assigned';
    case 'ARRIVED_PICKUP':
      return 'Driver at pickup';
    case 'PICKED_UP':
      return 'Picked up';
    case 'ON_THE_WAY':
      return 'On the way';
    case 'ARRIVED_DROPOFF':
      return 'Arrived at dropoff';
    case 'DELIVERED':
      return 'Delivered';
    case 'CANCELLED':
      return 'Delivery cancelled';
    case 'FAILED_PICKUP':
      return 'Pickup failed';
    case 'FAILED_DELIVERY':
      return 'Delivery failed';
    default:
      return status;
  }
}

MaterialStatusBadgeTone deliveryStatusTone(String status) {
  switch (status) {
    case 'WAITING_FOR_DRIVER':
    case 'DRIVER_ASSIGNED':
    case 'ARRIVED_PICKUP':
    case 'PICKED_UP':
    case 'ON_THE_WAY':
    case 'ARRIVED_DROPOFF':
      return MaterialStatusBadgeTone.reserved;
    case 'DELIVERED':
      return MaterialStatusBadgeTone.reused;
    case 'CANCELLED':
    case 'FAILED_PICKUP':
    case 'FAILED_DELIVERY':
    default:
      return MaterialStatusBadgeTone.draft;
  }
}
