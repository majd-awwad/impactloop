import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/api_config.dart';
import '../../../../shared/utils/profile_avatar_url.dart';
import '../../../auth/application/auth_controller.dart';
import 'supplier_profile_providers.dart';

/// Resolved supplier avatar URL: supplier `avatarImageUrl`, then user `profileImageUrl`.
final supplierDisplayAvatarUrlProvider = Provider<String?>((ref) {
  final profileAsync = ref.watch(supplierProfileProvider);
  final authUser = ref.watch(authControllerProvider).user;

  final raw = profileAsync.maybeWhen(
    data: (profile) =>
        profile.supplier?.avatarImageUrl ?? profile.user.profileImageUrl,
    orElse: () => authUser?.profileImageUrl,
  );

  final effectiveUrl = effectiveProfileAvatarUrl(raw);
  if (effectiveUrl == null) {
    return null;
  }

  return ApiConfig.resolveMediaUrl(effectiveUrl);
});
