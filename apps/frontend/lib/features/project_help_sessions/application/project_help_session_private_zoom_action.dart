import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/application/auth_controller.dart';

typedef ProjectHelpSessionAuthSnapshot = ({String userId, String accessToken});

ProjectHelpSessionAuthSnapshot? captureProjectHelpSessionAuthSnapshot(
  WidgetRef ref,
) {
  final auth = ref.read(authControllerProvider);
  final user = auth.user;
  final accessToken = auth.accessToken;
  if (!auth.isAuthenticated || user == null || accessToken == null) {
    return null;
  }
  return (userId: user.id, accessToken: accessToken);
}

bool projectHelpSessionAuthSnapshotIsCurrent(
  WidgetRef ref,
  ProjectHelpSessionAuthSnapshot snapshot,
) {
  final current = captureProjectHelpSessionAuthSnapshot(ref);
  return current == snapshot;
}
