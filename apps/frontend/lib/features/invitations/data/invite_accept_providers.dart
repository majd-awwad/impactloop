import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'invite_accept_api.dart';
import 'invite_accept_repository.dart';
import 'models/invite_accept_models.dart';

final inviteAcceptApiProvider = Provider<InviteAcceptApi>((ref) {
  return InviteAcceptApi(ref.watch(apiClientProvider));
});

final inviteAcceptRepositoryProvider = Provider<InviteAcceptRepository>((ref) {
  return InviteAcceptRepository(api: ref.watch(inviteAcceptApiProvider));
});

final inviteValidationProvider = FutureProvider.autoDispose
    .family<InviteValidationResult, String>((ref, token) {
      return ref.watch(inviteAcceptRepositoryProvider).validateToken(token);
    });
