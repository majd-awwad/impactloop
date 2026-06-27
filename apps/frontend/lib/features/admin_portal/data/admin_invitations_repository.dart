import 'admin_invitations_api.dart';
import 'models/admin_invitations_models.dart';

class AdminInvitationsRepository {
  const AdminInvitationsRepository({required AdminInvitationsApi api}) : _api = api;

  final AdminInvitationsApi _api;

  Future<List<AdminInvitationItem>> fetchInvitations() => _api.fetchInvitations();

  Future<AdminInvitationCreateResult> createInvitation(
    AdminInvitationCreateRequest request,
  ) =>
      _api.createInvitation(request);

  Future<AdminInvitationCreateResult> resendInvitation(String id) =>
      _api.resendInvitation(id);

  Future<AdminInvitationItem> revokeInvitation(String id) =>
      _api.revokeInvitation(id);
}
