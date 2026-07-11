import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import '../domain/learner_home_models.dart';
import 'learner_home_item_mapper.dart';

class LearnerHomeApi {
  const LearnerHomeApi(this._client);

  final Dio _client;

  Future<LearnerHomeFeed> fetchHomeFeed() async {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/learner/home'),
      _mapFeed,
    );
  }

  Future<LearnerHomeSectionDetails> fetchSectionDetails(
    LearnerHomeSectionKey sectionKey, {
    int limit = 20,
    int offset = 0,
  }) async {
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
