import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../auth/application/auth_controller.dart';
import '../data/learner_material_requests_api.dart';
import '../data/models/learner_material_request.dart';

/// Mirrors `watchSupplierPortalSessionFromRef` for the learner material
/// requests feature: re-runs dependent providers when the signed-in
/// learner or their access token changes.
void watchLearnerMaterialRequestsSessionFromRef(Ref ref) {
  ref.watch(authControllerProvider.select((state) => state.user?.id));
  ref.watch(authControllerProvider.select((state) => state.accessToken));
  ref.watch(authControllerProvider.select((state) => state.user?.activeRole));
}

final learnerMaterialRequestsApiProvider =
    Provider<LearnerMaterialRequestsApi>((ref) {
      return LearnerMaterialRequestsApi(ref.watch(apiClientProvider));
    });

class LearnerMaterialRequestsQuery {
  const LearnerMaterialRequestsQuery({this.status, this.page = 1});

  final String? status;
  final int page;

  LearnerMaterialRequestsQuery copyWith({
    String? status,
    bool clearStatus = false,
    int? page,
  }) {
    return LearnerMaterialRequestsQuery(
      status: clearStatus ? null : status ?? this.status,
      page: page ?? this.page,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is LearnerMaterialRequestsQuery &&
        other.status == status &&
        other.page == page;
  }

  @override
  int get hashCode => Object.hash(status, page);
}

class LearnerMaterialRequestsQueryNotifier
    extends Notifier<LearnerMaterialRequestsQuery> {
  @override
  LearnerMaterialRequestsQuery build() => const LearnerMaterialRequestsQuery();

  void setStatus(String? status) {
    state = state.copyWith(status: status, clearStatus: status == null);
  }
}

final learnerMaterialRequestsQueryProvider = NotifierProvider<
  LearnerMaterialRequestsQueryNotifier,
  LearnerMaterialRequestsQuery
>(LearnerMaterialRequestsQueryNotifier.new);

final learnerMaterialRequestsProvider = FutureProvider.autoDispose<
  LearnerMaterialRequestListResult
>((ref) async {
  watchLearnerMaterialRequestsSessionFromRef(ref);
  final query = ref.watch(learnerMaterialRequestsQueryProvider);
  return ref
      .read(learnerMaterialRequestsApiProvider)
      .fetchRequests(status: query.status, page: query.page, limit: 20);
});

final learnerMaterialRequestDetailProvider = FutureProvider.autoDispose
    .family<LearnerMaterialRequest, String>((ref, id) async {
      watchLearnerMaterialRequestsSessionFromRef(ref);
      return ref.read(learnerMaterialRequestsApiProvider).fetchRequest(id);
    });

void invalidateLearnerMaterialRequests(WidgetRef ref) {
  ref.invalidate(learnerMaterialRequestsProvider);
}

Future<LearnerMaterialRequest> createLearnerMaterialRequest(
  WidgetRef ref,
  CreateLearnerMaterialRequestPayload payload, {
  required String idempotencyKey,
}) async {
  final created = await ref
      .read(learnerMaterialRequestsApiProvider)
      .createRequest(payload, idempotencyKey: idempotencyKey);
  invalidateLearnerMaterialRequests(ref);
  return created;
}

Future<LearnerMaterialRequest> updateLearnerMaterialRequest(
  WidgetRef ref,
  String id,
  UpdateLearnerMaterialRequestPayload payload,
) async {
  final updated = await ref
      .read(learnerMaterialRequestsApiProvider)
      .updateRequest(id, payload);
  invalidateLearnerMaterialRequests(ref);
  ref.invalidate(learnerMaterialRequestDetailProvider(id));
  return updated;
}

Future<LearnerMaterialRequest> cancelLearnerMaterialRequest(
  WidgetRef ref,
  String id,
) async {
  final updated = await ref
      .read(learnerMaterialRequestsApiProvider)
      .cancelRequest(id);
  invalidateLearnerMaterialRequests(ref);
  ref.invalidate(learnerMaterialRequestDetailProvider(id));
  return updated;
}

Future<LearnerMaterialRequest> fulfillLearnerMaterialRequest(
  WidgetRef ref,
  String id,
) async {
  final updated = await ref
      .read(learnerMaterialRequestsApiProvider)
      .fulfillRequest(id);
  invalidateLearnerMaterialRequests(ref);
  ref.invalidate(learnerMaterialRequestDetailProvider(id));
  return updated;
}

Future<LearnerMaterialRequest> duplicateLearnerMaterialRequest(
  WidgetRef ref,
  String id,
) async {
  final duplicated = await ref
      .read(learnerMaterialRequestsApiProvider)
      .duplicateRequest(id);
  invalidateLearnerMaterialRequests(ref);
  return duplicated;
}

Future<LearnerMaterialRequest> dismissLearnerMaterialRequestMatch(
  WidgetRef ref,
  String matchId, {
  required String requestId,
}) async {
  final updated = await ref
      .read(learnerMaterialRequestsApiProvider)
      .dismissMatch(matchId);
  ref.invalidate(learnerMaterialRequestDetailProvider(requestId));
  invalidateLearnerMaterialRequests(ref);
  return updated;
}
