import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/landing_public_api.dart';
import '../domain/landing_public_content.dart';

final landingPublicRepositoryProvider = Provider<LandingPublicRepository>((
  ref,
) {
  return ApiLandingPublicRepository(ref.watch(apiClientProvider));
});

final landingPublicContentProvider =
    FutureProvider.autoDispose<LandingPublicContent>((ref) {
      return ref.watch(landingPublicRepositoryProvider).fetchLanding();
    });
