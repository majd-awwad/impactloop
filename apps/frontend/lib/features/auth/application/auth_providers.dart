import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/token_storage.dart';
import '../../../core/network/api_client.dart';
import 'auth_controller.dart';
import '../data/auth_api.dart';
import '../data/auth_repository.dart';

final tokenStorageProvider = Provider<TokenStorage>((ref) {
  return createTokenStorage();
});

final authApiProvider = Provider<AuthApi>((ref) {
  return AuthApi(ref.watch(apiClientProvider));
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    api: ref.watch(authApiProvider),
    tokenStorage: ref.watch(tokenStorageProvider),
    accessTokenHolder: ref.watch(accessTokenHolderProvider),
  );
});

/// Ensures the shared Dio client is initialized with auth interceptors.
final authNetworkBootstrapProvider = Provider<void>((ref) {
  ref.watch(apiClientProvider);
  unawaited(
    Future<void>.microtask(
      () => ref.read(authControllerProvider.notifier).bootstrapSession(),
    ),
  );
});
