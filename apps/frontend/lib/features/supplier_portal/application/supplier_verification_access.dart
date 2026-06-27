import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/application/auth_controller.dart';
import '../data/supplier_verification_api.dart';
import 'supplier_verification_gate.dart';

export 'supplier_verification_gate.dart';

/// Refreshes auth + verification status and returns the route gate for navigation.
Future<String?> refreshSupplierVerificationGate(WidgetRef ref) async {
  await ref.read(authControllerProvider.notifier).refreshCurrentUser();
  ref.invalidate(supplierVerificationStatusProvider);

  final status = await ref.read(supplierVerificationStatusProvider.future);
  final profile = ref.read(authControllerProvider).user?.supplierProfile;

  return supplierVerificationGateRoute(
    supplierType: profile?.supplierType ?? status.supplierType,
    verificationStatus: status.verificationStatus,
  );
}
