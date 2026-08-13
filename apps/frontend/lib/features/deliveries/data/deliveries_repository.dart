import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'deliveries_api.dart';
import 'models/learner_delivery.dart';
import 'models/learner_delivery_tracking.dart';
import 'models/request_delivery_request.dart';
import 'models/delivery_handover_credential.dart';

final deliveriesApiProvider = Provider<DeliveriesApi>((ref) {
  return DeliveriesApi(ref.watch(apiClientProvider));
});

final deliveriesRepositoryProvider = Provider<DeliveriesRepository>((ref) {
  return DeliveriesRepository(ref.watch(deliveriesApiProvider));
});

class DeliveriesRepository {
  const DeliveriesRepository(this._api);

  final DeliveriesApi _api;

  Future<LearnerDelivery> requestDelivery(
    String reservationId,
    RequestDeliveryRequest request,
  ) {
    return _api.requestDelivery(reservationId, request);
  }

  Future<List<LearnerDelivery>> fetchMyDeliveries() {
    return _api.fetchMyDeliveries();
  }

  Future<LearnerDelivery> fetchDelivery(String deliveryId) {
    return _api.fetchDelivery(deliveryId);
  }

  Future<LearnerDeliveryTracking> fetchDeliveryTracking(String deliveryId) {
    return _api.fetchDeliveryTracking(deliveryId);
  }

  Future<DeliveryHandoverCredential> issueDeliveryHandoverCredential(
    String deliveryId,
  ) {
    return _api.issueDeliveryHandoverCredential(deliveryId);
  }
}
