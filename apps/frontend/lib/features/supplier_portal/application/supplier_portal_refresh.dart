import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../presentation/controllers/supplier_dashboard_providers.dart';
import '../presentation/controllers/supplier_pickup_schedule_providers.dart';
import '../presentation/controllers/supplier_profile_providers.dart';
import '../presentation/controllers/supplier_requests_providers.dart';
import 'supplier_my_materials_providers.dart';

void invalidateSupplierPortalProviders(Ref ref) {
  ref.invalidate(supplierDashboardProvider);
  ref.invalidate(supplierProfileProvider);
  ref.invalidate(supplierMyMaterialsProvider);
  ref.invalidate(incomingRequestsProvider);
  ref.invalidate(pickupScheduleProvider);
  ref.invalidate(pickupScheduleSummaryProvider);
}
