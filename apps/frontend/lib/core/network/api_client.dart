import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/access_token_holder.dart';
import '../auth/auth_interceptor.dart';
import '../config/api_config.dart';
import 'dio_platform_adapter.dart';

final accessTokenHolderProvider = Provider<AccessTokenHolder>((ref) {
  return AccessTokenHolder();
});

final apiClientProvider = Provider<Dio>((ref) {
  final accessTokenHolder = ref.watch(accessTokenHolderProvider);

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
    AuthInterceptor(getAccessToken: () => accessTokenHolder.accessToken),
  );

  return dio;
});
