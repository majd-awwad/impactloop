import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/supplier_profile.dart';
import '../../data/supplier_profile_repository.dart';
import '../../application/supplier_portal_session.dart';

final supplierProfileProvider = FutureProvider<SupplierProfileResponse>((ref) {
  watchSupplierPortalSessionFromRef(ref);
  return ref.watch(supplierProfileRepositoryProvider).fetchProfile();
});

final supplierProfileManagementProvider =
    FutureProvider<SupplierProfileManagement>((ref) {
      watchSupplierPortalSessionFromRef(ref);
      return ref
          .watch(supplierProfileRepositoryProvider)
          .fetchManagementProfile();
    });
