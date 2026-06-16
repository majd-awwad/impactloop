import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/supplier_profile.dart';
import '../../data/supplier_profile_repository.dart';

final supplierProfileProvider = FutureProvider<SupplierProfileResponse>((ref) {
  return ref.watch(supplierProfileRepositoryProvider).fetchProfile();
});
