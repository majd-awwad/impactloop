import 'package:flutter_riverpod/flutter_riverpod.dart';

final accessTokenHolderProvider = Provider<AccessTokenHolder>((ref) {
  return AccessTokenHolder();
});

class AccessTokenHolder {
  String? accessToken;
}
