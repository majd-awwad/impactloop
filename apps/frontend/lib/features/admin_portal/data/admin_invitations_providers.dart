import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'admin_invitations_api.dart';
import 'admin_invitations_repository.dart';
import 'models/admin_invitations_models.dart';

final adminInvitationsApiProvider = Provider<AdminInvitationsApi>((ref) {
  return AdminInvitationsApi(ref.watch(apiClientProvider));
});

final adminInvitationsRepositoryProvider = Provider<AdminInvitationsRepository>(
  (ref) {
    return AdminInvitationsRepository(
      api: ref.watch(adminInvitationsApiProvider),
    );
  },
);

final adminInvitationsProvider =
    FutureProvider.autoDispose<List<AdminInvitationItem>>((ref) {
      return ref.watch(adminInvitationsRepositoryProvider).fetchInvitations();
    });
