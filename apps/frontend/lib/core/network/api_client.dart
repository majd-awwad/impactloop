import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/access_token_holder.dart';
import '../auth/auth_interceptor.dart';
import '../auth/auth_session_refresh.dart';
import '../config/api_config.dart';
import 'dio_platform_adapter.dart';

final apiClientProvider = Provider<Dio>((ref) {
  final accessTokenHolder = ref.watch(accessTokenHolderProvider);
  final sessionRefresher = ref.watch(authSessionRefresherProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Accept': 'application/json'},
    ),
  );

  configureDioPlatformAdapter(dio);

  dio.interceptors.add(
    AuthInterceptor(
      getAccessToken: () => accessTokenHolder.accessToken,
      refreshSession: sessionRefresher,
      retryClient: dio,
      onSessionExpired: (error) {
        ref.read(authSessionExpiryProvider.notifier).expire(error);
      },
    ),
  );

  return dio;
});
