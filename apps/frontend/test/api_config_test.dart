import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/config/api_config.dart';

void main() {
  test('debug baseUrl targets local backend on port 4000', () {
    expect(ApiConfig.baseUrl, endsWith(':4000'));
    expect(ApiConfig.baseUrl, startsWith('http://'));
  });

  test('resolveMediaUrl joins relative paths against baseUrl', () {
    expect(
      ApiConfig.resolveMediaUrl('/uploads/materials/photo.jpg'),
      '${ApiConfig.baseUrl}/uploads/materials/photo.jpg',
    );
  });

  test('resolveMediaUrl keeps absolute URLs unchanged', () {
    expect(
      ApiConfig.resolveMediaUrl('https://cdn.example.com/photo.jpg'),
      'https://cdn.example.com/photo.jpg',
    );
  });
}
