import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/config/api_config.dart';

void main() {
  test('debug baseUrl targets local backend on port 4000', () {
    expect(ApiConfig.baseUrl, endsWith(':4000'));
    expect(ApiConfig.baseUrl, startsWith('http://'));
  });

  test('resolveMediaUrl joins relative paths against the backend origin', () {
    expect(
      ApiConfig.resolveMediaUrl('/uploads/materials/photo.jpg'),
      '${ApiConfig.backendOrigin}/uploads/materials/photo.jpg',
    );
  });

  test('resolveMediaUrl keeps absolute URLs unchanged', () {
    expect(
      ApiConfig.resolveMediaUrl('https://cdn.example.com/photo.jpg'),
      'https://cdn.example.com/photo.jpg',
    );
  });

  test('resolveApiAssetUrl returns null for blank values', () {
    expect(ApiConfig.resolveApiAssetUrl(null), isNull);
    expect(ApiConfig.resolveApiAssetUrl('   '), isNull);
    expect(ApiConfig.resolveApiAssetUrl(''), isNull);
  });

  test('resolveMediaUrlAgainst maps demo-assets to origin, not /api', () {
    expect(
      ApiConfig.resolveMediaUrlAgainst(
        'http://192.0.2.10:4000/api',
        '/demo-assets/community-materials/materials/pi.jpg',
      ),
      'http://192.0.2.10:4000/demo-assets/community-materials/materials/pi.jpg',
    );
  });

  test('resolveMediaUrlAgainst accepts paths without a leading slash', () {
    expect(
      ApiConfig.resolveMediaUrlAgainst(
        'http://192.0.2.10:4000',
        'demo-assets/community-materials/materials/pi.jpg',
      ),
      'http://192.0.2.10:4000/demo-assets/community-materials/materials/pi.jpg',
    );
  });

  test('completion photo API paths resolve against the device backend origin', () {
    expect(
      ApiConfig.resolveMediaUrlAgainst(
        'http://192.168.1.20:4000',
        '/api/learner/builds/build-1/completion-story/photos/photo-1/content',
      ),
      'http://192.168.1.20:4000/api/learner/builds/build-1/completion-story/photos/photo-1/content',
    );
    expect(
      ApiConfig.resolveMediaUrlAgainst(
        'http://192.168.1.20:4000',
        '/api/learner/builds/build-1/completion-story/photos/photo-1/content',
      ),
      isNot(contains('localhost')),
    );
  });

  test('backendOriginFrom strips an /api path prefix', () {
    expect(
      ApiConfig.backendOriginFrom('http://192.0.2.10:4000/api').toString(),
      'http://192.0.2.10:4000',
    );
  });
}
