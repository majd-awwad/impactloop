import 'package:flutter/material.dart';

import '../domain/models/learning_project.dart';

class LearningHubApiMapper {
  const LearningHubApiMapper._();

  static LearningProject fromListItemJson(Map<String, dynamic> json) {
    return _mapProject(json, includeDetailFields: false);
  }

  static LearningProject fromDetailJson(Map<String, dynamic> json) {
    return _mapProject(json, includeDetailFields: true);
  }

  static LearningProject _mapProject(
    Map<String, dynamic> json, {
    required bool includeDetailFields,
  }) {
    final categoryJson = _asMap(json['category']);
    final categoryNameEn = _stringOrFallback(
      categoryJson?['nameEn'],
      fallback: 'Projects',
    );
    final categoryNameAr = _stringOrFallback(
      categoryJson?['nameAr'],
      fallback: categoryNameEn,
    );
    final title = _stringOrFallback(
      json['title'],
      fallback: 'Untitled project',
    );
    final shortDescription = _stringOrFallback(
      json['shortDescription'],
      fallback: 'No description available.',
    );
    final description = _stringOrFallback(
      json['description'],
      fallback: shortDescription,
    );
    final id = _stringOrFallback(json['id'], fallback: '');
    final difficultyKey = _stringOrFallback(
      json['difficulty'],
      fallback: 'BEGINNER',
    );
    final durationMinutes = _intFromDynamic(json['estimatedDurationMinutes']);
    final coverImageUrl = _nullableString(json['coverImageUrl']);
    final rating = _parseRatingSummary(json['ratingSummary']);
    final likesCount = _intFromDynamic(json['likesCount']) ?? 0;
    final isLiked = json['isLiked'] == true;
    final isSaved = json['isSaved'] == true;
    final followersCount = _intFromDynamic(json['followersCount']) ?? 0;
    final isFollowing = json['isFollowing'] == true;
    final isFeatured =
        json['isFeatured'] == true || json['isSpotlight'] == true;
    final tags = _mapTags(json['tags']);
    final recentReviews = includeDetailFields
        ? _mapProjectReviews(json['recentReviews'])
        : const <ProjectReviewItem>[];
    final viewerReview = includeDetailFields
        ? _mapProjectReview(json['viewerReview'])
        : null;

    final components = includeDetailFields
        ? _mapComponents(json['requiredComponents'])
        : const <LocalizedText>[];
    final steps = includeDetailFields
        ? _mapSteps(json['steps'])
        : const <ProjectStep>[];
    final links = includeDetailFields
        ? _mapLinks(json['links'])
        : const <ProjectLinkItem>[];

    final imageUrl =
        coverImageUrl ??
        (includeDetailFields ? _firstImageUrl(json['images']) : null);

    final componentCount = includeDetailFields ? components.length : 0;
    final componentCountLabel = componentCount == 0
        ? const LocalizedText(en: '', ar: '')
        : LocalizedText(
            en: formatComponentCount(componentCount),
            ar: formatComponentCount(componentCount),
          );

    return LearningProject(
      id: id,
      category: LocalizedText(en: categoryNameEn, ar: categoryNameAr),
      title: LocalizedText(en: title, ar: title),
      summary: LocalizedText(en: shortDescription, ar: shortDescription),
      longDescription: includeDetailFields
          ? LocalizedText(en: description, ar: description)
          : null,
      difficulty: mapDifficultyLabel(difficultyKey),
      duration: LocalizedText(
        en: formatDurationMinutes(durationMinutes),
        ar: formatDurationMinutes(durationMinutes),
      ),
      ratingLabel: const LocalizedText(en: 'learners', ar: 'متعلم'),
      ratingValue: rating.value,
      ratingCount: rating.count,
      hasRatings: rating.hasRatings,
      componentCountLabel: componentCountLabel,
      components: components,
      steps: steps,
      links: links,
      imageUrl: imageUrl,
      heroIconData: heroIconForCategory(categoryNameEn, id: id),
      cardGradient: gradientForCategory(categoryNameEn, id: id),
      isFeatured: isFeatured,
      likesCount: likesCount,
      isLiked: isLiked,
      isSaved: isSaved,
      followersCount: followersCount,
      isFollowing: isFollowing,
      recentReviews: recentReviews,
      viewerReview: viewerReview,
      tags: tags,
    );
  }

  static LocalizedText mapDifficultyLabel(String difficulty) {
    switch (difficulty.trim().toUpperCase()) {
      case 'BEGINNER':
        return const LocalizedText(en: 'Easy', ar: 'سهل');
      case 'ADVANCED':
        return const LocalizedText(en: 'Advanced', ar: 'متقدم');
      case 'INTERMEDIATE':
      default:
        return const LocalizedText(en: 'Medium', ar: 'متوسط');
    }
  }

  static String formatDurationMinutes(int? minutes) {
    if (minutes == null || minutes <= 0) {
      return 'Flexible timing';
    }

    if (minutes < 60) {
      return '$minutes min';
    }

    final hours = minutes ~/ 60;
    final remainder = minutes % 60;
    final hourLabel = hours == 1 ? '1 hr' : '$hours hrs';

    if (remainder == 0) {
      return hourLabel;
    }

    return '$hourLabel $remainder min';
  }

  static String formatComponentCount(int count) {
    if (count == 1) {
      return '1 component';
    }

    return '$count components';
  }

  static List<LocalizedText> _mapComponents(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<Map>()
        .map((item) {
          final name = _stringOrFallback(
            item['componentName'],
            fallback: 'Component',
          );
          return LocalizedText(en: name, ar: name);
        })
        .toList(growable: false);
  }

  static List<ProjectStep> _mapSteps(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    final steps = raw.whereType<Map>().toList(growable: false);
    steps.sort((a, b) {
      final left = _intFromDynamic(a['stepNumber']) ?? 0;
      final right = _intFromDynamic(b['stepNumber']) ?? 0;
      return left.compareTo(right);
    });

    return steps
        .map((item) {
          final title = _stringOrFallback(item['title'], fallback: 'Step');
          return ProjectStep(
            title: LocalizedText(en: title, ar: title),
          );
        })
        .toList(growable: false);
  }

  static List<ProjectLinkItem> _mapLinks(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<Map>()
        .map((item) {
          final url = _stringOrFallback(item['url'], fallback: '');
          final title = _nullableString(item['title']);
          final sourceName = _nullableString(item['sourceName']);
          final labelText = title ?? sourceName ?? url;
          return ProjectLinkItem(
            label: LocalizedText(en: labelText, ar: labelText),
            urlLabel: LocalizedText(en: url, ar: url),
            url: url,
          );
        })
        .toList(growable: false);
  }

  static List<String> _mapTags(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<String>()
        .map((tag) => tag.trim())
        .where((tag) => tag.isNotEmpty)
        .toSet()
        .toList(growable: false);
  }

  static ({bool hasRatings, double value, int count}) _parseRatingSummary(
    Object? raw,
  ) {
    if (raw is! Map) {
      return (hasRatings: false, value: 0, count: 0);
    }

    final average = _numberFromDynamic(raw['average'] ?? raw['rating']);
    final count = _intFromDynamic(raw['count']) ?? 0;

    if (average == null || count <= 0) {
      return (hasRatings: false, value: 0, count: 0);
    }

    return (hasRatings: true, value: average, count: count);
  }

  static List<ProjectReviewItem> _mapProjectReviews(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<Map>()
        .map(_mapProjectReview)
        .whereType<ProjectReviewItem>()
        .toList(growable: false);
  }

  static ProjectReviewItem? _mapProjectReview(Object? raw) {
    final json = _asMap(raw);
    if (json == null) {
      return null;
    }

    final id = _stringOrFallback(json['id'], fallback: '');
    final projectId = _stringOrFallback(json['projectId'], fallback: '');
    final rating = _intFromDynamic(json['rating']) ?? 0;

    if (id.isEmpty || projectId.isEmpty || rating <= 0) {
      return null;
    }

    return ProjectReviewItem(
      id: id,
      projectId: projectId,
      reviewerName: _stringOrFallback(
        json['reviewerName'],
        fallback: 'Learner',
      ),
      rating: rating,
      comment: _nullableString(json['comment']),
      isViewerReview: json['isViewerReview'] == true,
      createdAt: _dateTimeFromDynamic(json['createdAt']),
      updatedAt: _dateTimeFromDynamic(json['updatedAt']),
    );
  }

  static String? _firstImageUrl(Object? raw) {
    if (raw is! List || raw.isEmpty) {
      return null;
    }

    for (final item in raw) {
      if (item is Map) {
        final url = _nullableString(item['imageUrl']);
        if (url != null) {
          return url;
        }
      }
    }

    return null;
  }

  static IconData heroIconForCategory(
    String categoryName, {
    required String id,
  }) {
    switch (categoryName.toLowerCase()) {
      case 'robotics':
        return Icons.smart_toy_outlined;
      case 'electronics':
        return Icons.memory_rounded;
      case 'energy':
        return Icons.bolt_outlined;
      case 'handmade':
      case 'wood & panels':
      case 'wood':
        return Icons.handyman_outlined;
      case 'agriculture':
        return Icons.eco_outlined;
      case 'internet of things':
      case 'iot':
        return Icons.sensors_outlined;
      default:
        return Icons.school_outlined;
    }
  }

  static List<int> gradientForCategory(
    String categoryName, {
    required String id,
  }) {
    switch (categoryName.toLowerCase()) {
      case 'robotics':
        return [0xFF1F2937, 0xFF243B53];
      case 'electronics':
        return [0xFF1C3F66, 0xFF121E2D];
      case 'energy':
        return [0xFF35596C, 0xFF173038];
      case 'handmade':
      case 'wood & panels':
      case 'wood':
        return [0xFF2E4738, 0xFF17211B];
      case 'agriculture':
        return [0xFF2F5A43, 0xFF173024];
      case 'internet of things':
      case 'iot':
        return [0xFF39506B, 0xFF1C2432];
      default:
        final hash = id.hashCode.abs();
        return [0xFF200000 + (hash % 0x003F00), 0xFF120000 + (hash % 0x001F00)];
    }
  }

  static Map<String, dynamic>? _asMap(Object? value) {
    if (value is Map<String, dynamic>) {
      return value;
    }

    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }

    return null;
  }

  static String _stringOrFallback(Object? value, {required String fallback}) {
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }

    return fallback;
  }

  static String? _nullableString(Object? value) {
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }

    return null;
  }

  static int? _intFromDynamic(Object? value) {
    if (value is int) {
      return value;
    }

    if (value is num) {
      return value.toInt();
    }

    if (value is String) {
      return int.tryParse(value);
    }

    return null;
  }

  static double? _numberFromDynamic(Object? value) {
    if (value is num) {
      return value.toDouble();
    }

    if (value is String) {
      return double.tryParse(value);
    }

    return null;
  }

  static DateTime? _dateTimeFromDynamic(Object? value) {
    if (value is String && value.trim().isNotEmpty) {
      return DateTime.tryParse(value.trim());
    }

    return null;
  }
}
