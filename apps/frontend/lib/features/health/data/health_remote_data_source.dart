import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final healthRemoteDataSourceProvider = Provider<HealthRemoteDataSource>((ref) {
  return HealthRemoteDataSource(ref.watch(apiClientProvider));
});

class HealthRemoteDataSource {
  const HealthRemoteDataSource(this._client);

  final Dio _client;

  Future<HealthStatus> fetchHealth() async {
    final response = await _client.get<Map<String, dynamic>>('/health');
    final body = response.data;

    if (body == null || body['success'] != true || body['data'] is! Map) {
      throw const FormatException('Unexpected health response format.');
    }

    return HealthStatus.fromJson(
      Map<String, dynamic>.from(body['data'] as Map),
    );
  }
}

class HealthStatus {
  const HealthStatus({
    required this.status,
    required this.uptime,
    required this.timestamp,
  });

  final String status;
  final double uptime;
  final DateTime timestamp;

  factory HealthStatus.fromJson(Map<String, dynamic> json) {
    return HealthStatus(
      status: json['status'] as String? ?? 'unknown',
      uptime: (json['uptime'] as num?)?.toDouble() ?? 0,
      timestamp:
          DateTime.tryParse(json['timestamp'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}
