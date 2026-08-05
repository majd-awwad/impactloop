import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../../auth/application/auth_controller.dart';
import '../../home/application/learner_home_provider.dart';
import '../../learning_hub/application/learning_hub_providers.dart';
import '../../learning_hub/domain/models/project_build.dart';
import '../data/learner_builds_api.dart';
import '../data/models/learner_build_models.dart';

Future<void> ensureLearnerBuildsSessionReady(Ref ref) async {
  if (!ref.read(authControllerProvider).hasBootstrapped) {
    await ref.read(authControllerProvider.notifier).bootstrapSession();
  }
}

void watchLearnerBuildsSessionFromRef(Ref ref) {
  ref.watch(authControllerProvider.select((state) => state.user?.id));
}

void requireAuthenticatedLearner(Ref ref) {
  if (!ref.read(authControllerProvider).isAuthenticated) {
    throw const ApiException(
      message: 'Authentication required',
      code: 'UNAUTHENTICATED',
    );
  }
}

final learnerBuildsApiProvider = Provider<LearnerBuildsApi>((ref) {
  return LearnerBuildsApi(ref.watch(apiClientProvider));
});

class LearnerBuildsQuery {
  const LearnerBuildsQuery({this.status, this.page = 1});

  final String? status;
  final int page;

  LearnerBuildsQuery copyWith({
    String? status,
    bool clearStatus = false,
    int? page,
  }) {
    return LearnerBuildsQuery(
      status: clearStatus ? null : status ?? this.status,
      page: page ?? this.page,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is LearnerBuildsQuery &&
        other.status == status &&
        other.page == page;
  }

  @override
  int get hashCode => Object.hash(status, page);
}

class LearnerBuildsQueryNotifier extends Notifier<LearnerBuildsQuery> {
  @override
  LearnerBuildsQuery build() => const LearnerBuildsQuery(status: 'ACTIVE');

  void setStatus(String? status) {
    state = LearnerBuildsQuery(status: status, page: 1);
  }
}

final learnerBuildsQueryProvider =
    NotifierProvider<LearnerBuildsQueryNotifier, LearnerBuildsQuery>(
      LearnerBuildsQueryNotifier.new,
    );

final learnerBuildsListProvider = FutureProvider.autoDispose<LearnerBuildListResult>(
  (ref) async {
    await ensureLearnerBuildsSessionReady(ref);
    requireAuthenticatedLearner(ref);
    watchLearnerBuildsSessionFromRef(ref);
    final query = ref.watch(learnerBuildsQueryProvider);
    return ref.read(learnerBuildsApiProvider).fetchBuilds(
      status: query.status,
      page: query.page,
      limit: 20,
    );
  },
);

class LearnerPortfolioQuery {
  const LearnerPortfolioQuery({this.page = 1});

  final int page;

  @override
  bool operator ==(Object other) {
    return other is LearnerPortfolioQuery && other.page == page;
  }

  @override
  int get hashCode => page.hashCode;
}

class LearnerPortfolioQueryNotifier extends Notifier<LearnerPortfolioQuery> {
  @override
  LearnerPortfolioQuery build() => const LearnerPortfolioQuery();

  void setPage(int page) {
    state = LearnerPortfolioQuery(page: page);
  }
}

final learnerPortfolioQueryProvider =
    NotifierProvider<LearnerPortfolioQueryNotifier, LearnerPortfolioQuery>(
      LearnerPortfolioQueryNotifier.new,
    );

final learnerPortfolioProvider =
    FutureProvider<LearnerBuildListResult>((ref) async {
      await ensureLearnerBuildsSessionReady(ref);
      requireAuthenticatedLearner(ref);
      final query = ref.watch(learnerPortfolioQueryProvider);
      return ref.read(learnerBuildsApiProvider).fetchPortfolio(
        page: query.page,
        limit: 20,
      );
    });

void invalidateLearnerBuildsLists(WidgetRef ref) {
  ref.invalidate(learnerBuildsListProvider);
  ref.invalidate(learnerPortfolioProvider);
}

void invalidateLearnerBuildsAndHome(WidgetRef ref) {
  invalidateLearnerBuildsLists(ref);
  ref.invalidate(learnerHomeFeedProvider);
  ref.invalidate(learnerHomeSectionDetailsProvider);
}

Future<ProjectBuild> pauseLearnerBuild(WidgetRef ref, String buildId) async {
  final build = await ref.read(learnerBuildsApiProvider).pauseBuild(buildId);
  invalidateLearnerBuildsAndHome(ref);
  ref.invalidate(projectBuildProvider(build.projectId));
  return build;
}

Future<ProjectBuild> resumeLearnerBuild(WidgetRef ref, String buildId) async {
  final build = await ref.read(learnerBuildsApiProvider).resumeBuild(buildId);
  invalidateLearnerBuildsAndHome(ref);
  ref.invalidate(projectBuildProvider(build.projectId));
  return build;
}

Future<ProjectBuild> archiveLearnerBuild(WidgetRef ref, String buildId) async {
  final build = await ref.read(learnerBuildsApiProvider).archiveBuild(buildId);
  invalidateLearnerBuildsAndHome(ref);
  ref.invalidate(projectBuildProvider(build.projectId));
  return build;
}

Future<ProjectBuild> buildProjectAgain(WidgetRef ref, String projectId) async {
  final build = await ref.read(learningHubRepositoryProvider).buildAgain(
    projectId,
  );
  invalidateLearnerBuildsAndHome(ref);
  ref.invalidate(projectBuildProvider(projectId));
  return build;
}
