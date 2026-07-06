import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../home/application/home_suggested_materials_provider.dart';
import '../../reservations/application/learner_reservation_cache.dart';
import '../presentation/controllers/supplier_dashboard_providers.dart';
import '../presentation/controllers/supplier_notifications_providers.dart';
import '../presentation/controllers/supplier_pickup_schedule_providers.dart';
import '../presentation/controllers/supplier_requests_providers.dart';
import '../application/supplier_my_materials_providers.dart';

void invalidateReservationSyncProviders(WidgetRef ref) {
  ref.invalidate(incomingRequestsProvider);
  ref.invalidate(supplierNotificationsProvider);
  ref.invalidate(supplierDashboardProvider);
  ref.invalidate(pickupScheduleProvider);
  ref.invalidate(pickupScheduleSummaryProvider);
  ref.invalidate(supplierMyMaterialsProvider);
  invalidateLearnerReservationCaches(ref);
  ref.invalidate(homeSuggestedMaterialsProvider);
}
