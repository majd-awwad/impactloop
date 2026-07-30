import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../auth/application/auth_controller.dart';
import '../../home/application/home_suggested_materials_provider.dart';
import '../../profile/application/profile_providers.dart';
import '../domain/liked_materials_result.dart';
import 'material_discovery_providers.dart';

const likedMaterialsPageSize = 20;

Duration? _noAutomaticLikedMaterialsRetry(int retryCount, Object error) => null;

typedef _LikedMaterialsAuthKey = (
  AuthStatus status,
  String? userId,
  bool hasLearnerRole,
);

_LikedMaterialsAuthKey _authKey(AuthState authState) => (
  authState.status,
  authState.user?.id,
  authState.user?.hasRole('LEARNER') == true,
);

class LikedMaterialsState {
  const LikedMaterialsState({
    required this.items,
    required this.page,
    required this.totalPages,
    required this.total,
    this.isLoadingMore = false,
    this.isRefreshing = false,
    this.hasLoadMoreError = false,
    this.hasRefreshError = false,
    this.pendingUnlikeIds = const <String>{},
  });

  final List<LikedMaterialItem> items;
  final int page;
  final int totalPages;
  final int total;
  final bool isLoadingMore;
  final bool isRefreshing;
  final bool hasLoadMoreError;
  final bool hasRefreshError;
  final Set<String> pendingUnlikeIds;

  bool get hasMore => page < totalPages;

  LikedMaterialsState copyWith({
    List<LikedMaterialItem>? items,
    int? page,
    int? totalPages,
    int? total,
    bool? isLoadingMore,
    bool? isRefreshing,
    bool? hasLoadMoreError,
    bool? hasRefreshError,
    Set<String>? pendingUnlikeIds,
  }) {
    return LikedMaterialsState(
      items: items ?? this.items,
      page: page ?? this.page,
      totalPages: totalPages ?? this.totalPages,
      total: total ?? this.total,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      hasLoadMoreError: hasLoadMoreError ?? this.hasLoadMoreError,
      hasRefreshError: hasRefreshError ?? this.hasRefreshError,
      pendingUnlikeIds: pendingUnlikeIds ?? this.pendingUnlikeIds,
    );
  }
}

final likedMaterialsControllerProvider =
    AsyncNotifierProvider.autoDispose<
      LikedMaterialsController,
      LikedMaterialsState
    >(LikedMaterialsController.new, retry: _noAutomaticLikedMaterialsRetry);

enum _PageOneReadOutcome { applied, stale, failed }

class LikedMaterialsController extends AsyncNotifier<LikedMaterialsState> {
  final Set<String> _unlikeInFlight = <String>{};
  final Set<String> _confirmedUnlikeIds = <String>{};
  int _revision = 0;
  int _activeExplicitReads = 0;
  bool _reconciliationRequested = false;
  bool _reconciliationRunning = false;

  @override
  Future<LikedMaterialsState> build() async {
    final auth = ref.watch(authControllerProvider.select(_authKey));
    if (auth.$1 == AuthStatus.unknown) {
      throw const ApiException(
        message: 'Checking your session…',
        code: 'AUTH_PENDING',
      );
    }
    if (auth.$1 != AuthStatus.authenticated || auth.$2 == null) {
      throw const ApiException(
        message: 'Sign in to view liked materials.',
        code: 'UNAUTHENTICATED',
      );
    }
    if (!auth.$3) {
      throw const ApiException(
        message: 'Learner access is required.',
        code: 'FORBIDDEN',
      );
    }

    return _fetchPage(1);
  }

  Future<LikedMaterialsState> _fetchPage(int page) async {
    final result = await ref
        .read(likedMaterialsRepositoryProvider)
        .fetchLikedMaterials(page: page, limit: likedMaterialsPageSize);
    return LikedMaterialsState(
      items: result.items,
      page: result.pagination.page,
      totalPages: result.pagination.totalPages,
      total: result.pagination.total,
    );
  }

  LikedMaterialsState _applyServerResult(LikedMaterialsState result) {
    return result.copyWith(
      items: result.items
          .where((item) => !_confirmedUnlikeIds.contains(item.material.id))
          .toList(growable: false),
      isLoadingMore: false,
      isRefreshing: false,
      hasLoadMoreError: false,
      hasRefreshError: false,
      pendingUnlikeIds: Set<String>.unmodifiable(_unlikeInFlight),
    );
  }

  Future<void> refresh() async {
    final current = state.value;
    if (current == null) {
      ref.invalidateSelf();
      return;
    }

    _activeExplicitReads += 1;
    try {
      await _readPageOne(rethrowFailure: true);
    } finally {
      _activeExplicitReads -= 1;
      _kickReconciliation();
    }
  }

  Future<_PageOneReadOutcome> _readPageOne({
    required bool rethrowFailure,
  }) async {
    final current = state.value;
    if (current == null) return _PageOneReadOutcome.stale;

    final requestRevision = ++_revision;
    state = AsyncData(
      current.copyWith(
        isRefreshing: true,
        isLoadingMore: false,
        hasRefreshError: false,
      ),
    );
    try {
      final refreshed = await _fetchPage(1);
      if (!ref.mounted || requestRevision != _revision) {
        return _PageOneReadOutcome.stale;
      }

      state = AsyncData(_applyServerResult(refreshed));
      return _PageOneReadOutcome.applied;
    } catch (_) {
      if (!ref.mounted || requestRevision != _revision) {
        return _PageOneReadOutcome.stale;
      }

      final latest = state.value ?? current;
      state = AsyncData(
        latest.copyWith(isRefreshing: false, hasRefreshError: true),
      );
      if (rethrowFailure) rethrow;
      return _PageOneReadOutcome.failed;
    }
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.isLoadingMore) return;

    _activeExplicitReads += 1;
    final requestRevision = ++_revision;
    state = AsyncData(
      current.copyWith(
        isLoadingMore: true,
        isRefreshing: false,
        hasLoadMoreError: false,
      ),
    );
    try {
      final next = await _fetchPage(current.page + 1);
      if (!ref.mounted || requestRevision != _revision) return;

      final latest = state.value ?? current;
      final byId = <String, LikedMaterialItem>{
        for (final item in latest.items) item.material.id: item,
        for (final item in next.items)
          if (!_confirmedUnlikeIds.contains(item.material.id))
            item.material.id: item,
      };
      state = AsyncData(
        latest.copyWith(
          items: List<LikedMaterialItem>.unmodifiable(byId.values),
          page: next.page,
          totalPages: next.totalPages,
          total: next.total,
          isLoadingMore: false,
          hasLoadMoreError: false,
          pendingUnlikeIds: Set<String>.unmodifiable(_unlikeInFlight),
        ),
      );
    } catch (_) {
      if (ref.mounted && requestRevision == _revision) {
        state = AsyncData(
          (state.value ?? current).copyWith(
            isLoadingMore: false,
            hasLoadMoreError: true,
          ),
        );
        rethrow;
      }
    } finally {
      _activeExplicitReads -= 1;
      _kickReconciliation();
    }
  }

  Future<void> unlike(String materialId) async {
    final current = state.value;
    if (current == null || !_unlikeInFlight.add(materialId)) {
      return;
    }

    _revision += 1;
    state = AsyncData(
      current.copyWith(
        isLoadingMore: false,
        isRefreshing: false,
        pendingUnlikeIds: Set<String>.unmodifiable(_unlikeInFlight),
      ),
    );
    try {
      await ref
          .read(likedMaterialsRepositoryProvider)
          .unlikeMaterial(materialId);
      _unlikeInFlight.remove(materialId);
      if (!ref.mounted) return;

      _confirmedUnlikeIds.add(materialId);
      _revision += 1;
      final latest = state.value ?? current;
      final wasPresent = latest.items.any(
        (item) => item.material.id == materialId,
      );
      final nextTotal = wasPresent && latest.total > 0
          ? latest.total - 1
          : latest.total;
      final nextTotalPages = nextTotal == 0
          ? 0
          : (nextTotal / likedMaterialsPageSize).ceil();
      state = AsyncData(
        latest.copyWith(
          items: latest.items
              .where((item) => item.material.id != materialId)
              .toList(growable: false),
          total: nextTotal,
          totalPages: nextTotalPages,
          isLoadingMore: false,
          isRefreshing: false,
          pendingUnlikeIds: Set<String>.unmodifiable(_unlikeInFlight),
        ),
      );
      ref.invalidate(homeSuggestedMaterialsProvider);
      invalidateLearnerProfileSummaryProvider(ref);
      _reconciliationRequested = true;
    } catch (_) {
      _unlikeInFlight.remove(materialId);
      if (ref.mounted) {
        final latest = state.value ?? current;
        state = AsyncData(
          latest.copyWith(
            pendingUnlikeIds: Set<String>.unmodifiable(_unlikeInFlight),
          ),
        );
      }
      rethrow;
    } finally {
      _kickReconciliation();
    }
  }

  void _kickReconciliation() {
    if (!ref.mounted ||
        !_reconciliationRequested ||
        _reconciliationRunning ||
        _unlikeInFlight.isNotEmpty ||
        _activeExplicitReads > 0) {
      return;
    }

    unawaited(_runReconciliation());
  }

  Future<void> _runReconciliation() async {
    if (_reconciliationRunning) return;
    _reconciliationRunning = true;
    try {
      while (ref.mounted &&
          _reconciliationRequested &&
          _unlikeInFlight.isEmpty &&
          _activeExplicitReads == 0) {
        _reconciliationRequested = false;
        final outcome = await _readPageOne(rethrowFailure: false);
        if (outcome == _PageOneReadOutcome.stale) {
          _reconciliationRequested = true;
          break;
        }
        if (outcome == _PageOneReadOutcome.failed) break;
      }
    } finally {
      _reconciliationRunning = false;
      if (_reconciliationRequested &&
          _unlikeInFlight.isEmpty &&
          _activeExplicitReads == 0) {
        scheduleMicrotask(_kickReconciliation);
      }
    }
  }
}
