import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/supplier_dashboard.dart';
import '../../data/supplier_dashboard_repository.dart';
import '../../application/supplier_portal_session.dart';

final supplierDashboardProvider = FutureProvider<SupplierDashboard>((ref) {
  watchSupplierPortalSessionFromRef(ref);
  return ref.watch(supplierDashboardRepositoryProvider).fetchDashboard();
});
