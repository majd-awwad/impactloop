import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/shared/utils/profile_avatar_url.dart';

void main() {
  group('isGeneratedProfileAvatarUrl', () {
    test('returns false for empty and local upload paths', () {
      expect(isGeneratedProfileAvatarUrl(null), isFalse);
      expect(isGeneratedProfileAvatarUrl(''), isFalse);
      expect(
        isGeneratedProfileAvatarUrl('/uploads/profiles/profile_test.webp'),
        isFalse,
      );
    });

    test('returns true for DiceBear URLs', () {
      expect(
        isGeneratedProfileAvatarUrl(
          'https://api.dicebear.com/9.x/initials/png?seed=Majd',
        ),
        isTrue,
      );
      expect(
        isGeneratedProfileAvatarUrl(
          'https://API.DICEBEAR.COM/9.x/initials/png?seed=test',
        ),
        isTrue,
      );
    });
  });

  group('effectiveProfileAvatarUrl', () {
    test('returns null for empty and generated URLs', () {
      expect(effectiveProfileAvatarUrl(null), isNull);
      expect(effectiveProfileAvatarUrl(''), isNull);
      expect(
        effectiveProfileAvatarUrl(
          'https://api.dicebear.com/9.x/initials/png?seed=test',
        ),
        isNull,
      );
    });

    test('returns trimmed real profile image URLs', () {
      expect(
        effectiveProfileAvatarUrl('  /uploads/profiles/avatar.webp  '),
        '/uploads/profiles/avatar.webp',
      );
      expect(
        effectiveProfileAvatarUrl('https://cdn.example.com/avatar.png'),
        'https://cdn.example.com/avatar.png',
      );
    });
  });
}
