import 'package:dio/browser.dart';
import 'package:dio/dio.dart';

void configureDioPlatformAdapter(Dio dio) {
  dio.httpClientAdapter = BrowserHttpClientAdapter(withCredentials: true);
}
