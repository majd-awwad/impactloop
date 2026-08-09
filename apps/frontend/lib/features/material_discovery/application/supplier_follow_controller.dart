import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/discovery_material.dart';
import '../domain/material_discovery_repository.dart';

class SupplierFollowViewState {
  const SupplierFollowViewState({
    required this.followersCount,
    required this.isFollowedByViewer,
    this.isUpdating = false,
  });

  final int followersCount;
  final bool isFollowedByViewer;
  final bool isUpdating;

  SupplierFollowViewState copyWith({
    int? followersCount,
    bool? isFollowedByViewer,
    bool? isUpdating,
  }) {
    return SupplierFollowViewState(
      followersCount: followersCount ?? this.followersCount,
      isFollowedByViewer: isFollowedByViewer ?? this.isFollowedByViewer,
      isUpdating: isUpdating ?? this.isUpdating,
    );
  }
}

String supplierFollowStateKey({
  required String supplierProfileId,
  required String? viewerId,
}) {
  return '${viewerId?.trim().isNotEmpty == true ? viewerId!.trim() : 'guest'}::${supplierProfileId.trim()}';
}

class SupplierFollowController
    extends Notifier<Map<String, SupplierFollowViewState>> {
  @override
  Map<String, SupplierFollowViewState> build() => const {};

  SupplierFollowViewState? read({
    required String supplierProfileId,
    required String? viewerId,
  }) {
    return state[supplierFollowStateKey(
      supplierProfileId: supplierProfileId,
      viewerId: viewerId,
    )];
  }

  void seed({
    required String supplierProfileId,
    required String? viewerId,
    required int followersCount,
    required bool isFollowedByViewer,
  }) {
    final key = supplierFollowStateKey(
      supplierProfileId: supplierProfileId,
      viewerId: viewerId,
    );
    if (state.containsKey(key)) return;

    state = {
      ...state,
      key: SupplierFollowViewState(
        followersCount: _safeCount(followersCount),
        isFollowedByViewer: isFollowedByViewer,
      ),
    };
  }

  void setAuthoritative({
    required String supplierProfileId,
    required String? viewerId,
    required int followersCount,
    required bool isFollowedByViewer,
  }) {
    final key = supplierFollowStateKey(
      supplierProfileId: supplierProfileId,
      viewerId: viewerId,
    );
    final current = state[key];
    if (current?.isUpdating == true) return;

    state = {
      ...state,
      key: SupplierFollowViewState(
        followersCount: _safeCount(followersCount),
        isFollowedByViewer: isFollowedByViewer,
      ),
    };
  }

  void setAuthoritativeCount({
    required String supplierProfileId,
    required String? viewerId,
    required int followersCount,
    required bool fallbackIsFollowedByViewer,
  }) {
    final current = read(
      supplierProfileId: supplierProfileId,
      viewerId: viewerId,
    );
    setAuthoritative(
      supplierProfileId: supplierProfileId,
      viewerId: viewerId,
      followersCount: followersCount,
      isFollowedByViewer:
          current?.isFollowedByViewer ?? fallbackIsFollowedByViewer,
    );
  }

  void setAuthoritativeFollowing({
    required String supplierProfileId,
    required String? viewerId,
    required bool isFollowedByViewer,
    required int fallbackFollowersCount,
  }) {
    final current = read(
      supplierProfileId: supplierProfileId,
      viewerId: viewerId,
    );
    setAuthoritative(
      supplierProfileId: supplierProfileId,
      viewerId: viewerId,
      followersCount: current?.followersCount ?? fallbackFollowersCount,
      isFollowedByViewer: isFollowedByViewer,
    );
  }

  Future<SupplierFollowStatus?> toggle({
    required String supplierProfileId,
    required String? viewerId,
    required MaterialDiscoveryRepository repository,
    required int fallbackFollowersCount,
    required bool fallbackIsFollowedByViewer,
  }) async {
    final key = supplierFollowStateKey(
      supplierProfileId: supplierProfileId,
      viewerId: viewerId,
    );
    final previous =
        state[key] ??
        SupplierFollowViewState(
          followersCount: _safeCount(fallbackFollowersCount),
          isFollowedByViewer: fallbackIsFollowedByViewer,
        );
    if (previous.isUpdating) return null;

    final shouldFollow = !previous.isFollowedByViewer;
    state = {
      ...state,
      key: SupplierFollowViewState(
        followersCount: shouldFollow
            ? previous.followersCount + 1
            : _safeCount(previous.followersCount - 1),
        isFollowedByViewer: shouldFollow,
        isUpdating: true,
      ),
    };

    try {
      final result = shouldFollow
          ? await repository.followSupplier(supplierProfileId)
          : await repository.unfollowSupplier(supplierProfileId);
      state = {
        ...state,
        key: SupplierFollowViewState(
          followersCount: _safeCount(result.followersCount),
          isFollowedByViewer: result.isFollowedByViewer,
        ),
      };
      return result;
    } catch (_) {
      state = {...state, key: previous};
      rethrow;
    }
  }

  static int _safeCount(int value) => value < 0 ? 0 : value;
}

final supplierFollowControllerProvider =
    NotifierProvider<
      SupplierFollowController,
      Map<String, SupplierFollowViewState>
    >(SupplierFollowController.new);
