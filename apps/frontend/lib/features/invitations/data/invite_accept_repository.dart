import 'invite_accept_api.dart';

import 'models/invite_accept_models.dart';

class InviteAcceptRepository {
  const InviteAcceptRepository({required InviteAcceptApi api}) : _api = api;

  final InviteAcceptApi _api;

  Future<InviteValidationResult> validateToken(String token) =>
      _api.validateToken(token);

  Future<InviteAcceptResult> acceptInvitation(InviteAcceptRequest request) =>
      _api.acceptInvitation(request);

  Future<InviteExistingAcceptResult> acceptExistingInvitation(
    InviteExistingAcceptRequest request,
  ) => _api.acceptExistingInvitation(request);
}
