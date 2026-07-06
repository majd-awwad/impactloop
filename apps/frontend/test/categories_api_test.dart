import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/materials/data/categories_api.dart';

void main() {
  group('CategoriesApi', () {
    test('fetchProjectCategories delegates to PROJECT type query', () async {
      final dio = Dio();
      final adapter = _RecordingAdapter();
      dio.httpClientAdapter = adapter;

      final api = CategoriesApi(dio);
      await api.fetchProjectCategories();

      expect(adapter.lastQueryParameters, {
        'type': 'PROJECT',
        'rootOnly': true,
      });
    });

    test('fetchMaterialCategories passes discoveryOnly when requested', () async {
      final dio = Dio();
      final adapter = _RecordingAdapter();
      dio.httpClientAdapter = adapter;

      final api = CategoriesApi(dio);
      await api.fetchMaterialCategories(discoveryOnly: true);

      expect(adapter.lastQueryParameters, {
        'type': 'MATERIAL',
        'rootOnly': true,
        'discoveryOnly': true,
      });
    });
  });
}

class _RecordingAdapter implements HttpClientAdapter {
  Map<String, dynamic>? lastQueryParameters;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastQueryParameters = Map<String, dynamic>.from(
      options.queryParameters,
    );

    return ResponseBody.fromString(
      '''
{
  "success": true,
  "data": [
    {
      "id": "cat_1",
      "nameEn": "Electronics",
      "nameAr": "إلكترونيات",
      "categoryType": "MATERIAL"
    }
  ]
}
''',
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}
