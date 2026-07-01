import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/application/auth_controller.dart';

void watchSupplierPortalSession(WidgetRef ref) {
  ref.watch(authControllerProvider.select((state) => state.user?.id));
  ref.watch(authControllerProvider.select((state) => state.accessToken));
  ref.watch(authControllerProvider.select((state) => state.user?.activeRole));
}

void watchSupplierPortalSessionFromRef(Ref ref) {
  ref.watch(authControllerProvider.select((state) => state.user?.id));
  ref.watch(authControllerProvider.select((state) => state.accessToken));
  ref.watch(authControllerProvider.select((state) => state.user?.activeRole));
}
