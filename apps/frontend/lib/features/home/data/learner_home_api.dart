import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import '../domain/learner_home_models.dart';
import 'learner_home_item_mapper.dart';

class LearnerHomeApi {
  const LearnerHomeApi(this._client);

  final Dio _client;

  Future<LearnerHomeFeed> fetchHomeFeed() async {
    return _guarded(() {
      return unwrapApiResponse(
        _client.get<Map<String, dynamic>>('/api/learner/home'),
        _mapFeed,
      );
    });
  }

  Future<LearnerHomeSectionDetails> fetchSectionDetails(
    LearnerHomeSectionKey sectionKey, {
    int limit = 20,
    int offset = 0,
  }) async {
    return _guarded(() {
      return unwrapApiResponse(
        _client.get<Map<String, dynamic>>(
          '/api/learner/home/sections/${sectionKey.apiValue}',
          queryParameters: {
            'limit': limit,
            if (offset > 0) 'offset': offset,
          },
        ),
        _mapSectionDetails,
      );
    });
  }

  Future<T> _guarded<T>(Future<T> Function() request) async {
    try {
      return await request();
    } catch (error, stackTrace) {
      Error.throwWithStackTrace(classifyLearnerHomeError(error), stackTrace);
    }
  }

  LearnerHomeFeed _mapFeed(Map<String, dynamic> json) {
    final sectionsJson = json['sections'];

    return LearnerHomeFeed(
      profileCompletion: LearnerHomeProfileCompletion.fromJson(
        json['profileCompletion'] as Map<String, dynamic>?,
      ),
      sections: sectionsJson is List
          ? sectionsJson
                .whereType<Map>()
                .map(
                  (section) => _mapSection(Map<String, dynamic>.from(section)),
                )
                .whereType<LearnerHomeSection>()
                .toList(growable: false)
          : const [],
    );
  }

  LearnerHomeSectionDetails _mapSectionDetails(Map<String, dynamic> json) {
    final key = LearnerHomeSectionKey.fromApiValue(json['key'] as String?);
    if (key == null) {
      throw const FormatException('Unsupported learner home section key.');
    }

    final itemsJson = json['items'];

    return LearnerHomeSectionDetails(
      key: key,
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String? ?? '',
      emptyState: json['emptyState'] as String? ?? '',
      nextCursor: json['nextCursor'] as String?,
      nextOffset: (json['nextOffset'] as num?)?.toInt(),
      hasMore: json['hasMore'] == true,
      items: itemsJson is List
          ? itemsJson
                .whereType<Map>()
                .map((item) => _mapItem(Map<String, dynamic>.from(item)))
                .whereType<LearnerHomeItem>()
                .toList(growable: false)
          : const [],
    );
  }

  LearnerHomeSection? _mapSection(Map<String, dynamic> json) {
    final key = LearnerHomeSectionKey.fromApiValue(json['key'] as String?);
    if (key == null) {
      return null;
    }

    final itemsJson = json['items'];

    return LearnerHomeSection(
      key: key,
      title: json['title'] as String? ?? '',
      emptyState: json['emptyState'] as String? ?? '',
      items: _mapItems(itemsJson),
    );
  }

  List<LearnerHomeItem> _mapItems(Object? itemsJson) {
    if (itemsJson is! List) {
      return const [];
    }

    return itemsJson
        .whereType<Map>()
        .map((item) => _mapItem(Map<String, dynamic>.from(item)))
        .whereType<LearnerHomeItem>()
        .toList(growable: false);
  }

  LearnerHomeItem? _mapItem(Map<String, dynamic> json) {
    return LearnerHomeItemMapper.fromJson(json);
  }
}

enum LearnerHomeErrorKind {
  sessionExpired,
  networkUnavailable,
  server,
  parsing,
}

class LearnerHomeFailure implements Exception {
  const LearnerHomeFailure({
    required this.kind,
    required this.message,
    this.cause,
  });

  final LearnerHomeErrorKind kind;
  final String message;
  final Object? cause;

  String get title {
    switch (kind) {
      case LearnerHomeErrorKind.sessionExpired:
        return 'Session expired';
      case LearnerHomeErrorKind.networkUnavailable:
        return 'Backend unavailable';
      case LearnerHomeErrorKind.server:
        return 'Something went wrong';
      case LearnerHomeErrorKind.parsing:
        return 'Unexpected recommendations response';
    }
  }

  String get description {
    switch (kind) {
      case LearnerHomeErrorKind.sessionExpired:
        return 'Please sign in again to continue.';
      case LearnerHomeErrorKind.networkUnavailable:
        return 'We could not reach the backend. Check your connection and try again.';
      case LearnerHomeErrorKind.server:
        return 'The server could not load your home feed. Please try again.';
      case LearnerHomeErrorKind.parsing:
        return 'The server returned an unexpected home-feed response.';
    }
  }

  @override
  String toString() => 'LearnerHomeFailure(${kind.name})';
}

LearnerHomeFailure classifyLearnerHomeError(Object error) {
  if (error is LearnerHomeFailure) {
    return error;
  }

  if (error is ApiException) {
    if (error.statusCode == 401 ||
        error.statusCode == 403 ||
        error.code == 'SESSION_EXPIRED' ||
        error.code == 'UNAUTHENTICATED' ||
        error.code == 'FORBIDDEN') {
      return LearnerHomeFailure(
        kind: LearnerHomeErrorKind.sessionExpired,
        message: 'Your session has expired.',
        cause: error,
      );
    }

    if (error.code == 'NETWORK_ERROR' || error.code == 'TIMEOUT') {
      return LearnerHomeFailure(
        kind: LearnerHomeErrorKind.networkUnavailable,
        message: 'The backend is unavailable.',
        cause: error,
      );
    }

    if (error.statusCode != null && error.statusCode! >= 500) {
      return LearnerHomeFailure(
        kind: LearnerHomeErrorKind.server,
        message: 'The server could not load the home feed.',
        cause: error,
      );
    }
  }

  return LearnerHomeFailure(
    kind: LearnerHomeErrorKind.parsing,
    message: 'The home-feed response could not be read.',
    cause: error,
  );
}
