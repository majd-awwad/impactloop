class LearnerInterestOption {
  const LearnerInterestOption({
    required this.key,
    required this.label,
  });

  final String key;
  final String label;

  factory LearnerInterestOption.fromJson(Map<String, dynamic> json) {
    return LearnerInterestOption(
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? '',
    );
  }
}

class LearnerInterestGroup {
  const LearnerInterestGroup({
    required this.key,
    required this.label,
    required this.items,
  });

  final String key;
  final String label;
  final List<LearnerInterestOption> items;

  factory LearnerInterestGroup.fromJson(Map<String, dynamic> json) {
    return LearnerInterestGroup(
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? '',
      items: (json['items'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(LearnerInterestOption.fromJson)
          .where((item) => item.key.isNotEmpty)
          .toList(growable: false),
    );
  }
}

class LearnerInterestOptionsResponse {
  const LearnerInterestOptionsResponse({required this.groups});

  final List<LearnerInterestGroup> groups;

  factory LearnerInterestOptionsResponse.fromJson(Map<String, dynamic> json) {
    return LearnerInterestOptionsResponse(
      groups: (json['groups'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(LearnerInterestGroup.fromJson)
          .where((group) => group.items.isNotEmpty)
          .toList(growable: false),
    );
  }

  Map<String, String> get labelByKey {
    final labels = <String, String>{};
    for (final group in groups) {
      for (final item in group.items) {
        labels[item.key] = item.label;
      }
    }
    return labels;
  }

  List<LearnerInterestOption> get flatItems {
    return groups.expand((group) => group.items).toList(growable: false);
  }
}

const fallbackLearnerInterestOptions = LearnerInterestOptionsResponse(
  groups: [
    LearnerInterestGroup(
      key: 'electronics',
      label: 'Electronics',
      items: [
        LearnerInterestOption(key: 'electronics', label: 'Electronics'),
        LearnerInterestOption(key: 'arduino', label: 'Arduino'),
        LearnerInterestOption(key: 'robotics', label: 'Robotics'),
        LearnerInterestOption(key: 'sensors', label: 'Sensors'),
        LearnerInterestOption(key: 'circuits', label: 'Circuits'),
        LearnerInterestOption(key: 'displays', label: 'Displays'),
        LearnerInterestOption(
          key: 'wires_connectors',
          label: 'Wires & Connectors',
        ),
        LearnerInterestOption(key: 'audio_media', label: 'Audio & Media'),
      ],
    ),
    LearnerInterestGroup(
      key: 'woodworking',
      label: 'Woodworking',
      items: [
        LearnerInterestOption(key: 'woodworking', label: 'Woodworking'),
      ],
    ),
    LearnerInterestGroup(
      key: 'fabric_textiles',
      label: 'Fabric & Textiles',
      items: [
        LearnerInterestOption(
          key: 'fabric_textiles',
          label: 'Fabric & Textiles',
        ),
      ],
    ),
    LearnerInterestGroup(
      key: 'art_crafts',
      label: 'Art & Crafts',
      items: [
        LearnerInterestOption(key: 'art_crafts', label: 'Art & Crafts'),
      ],
    ),
    LearnerInterestGroup(
      key: 'recycling',
      label: 'Recycling',
      items: [
        LearnerInterestOption(key: 'recycling', label: 'Recycling'),
      ],
    ),
    LearnerInterestGroup(
      key: 'home_diy',
      label: 'Home DIY',
      items: [
        LearnerInterestOption(key: 'home_diy', label: 'Home DIY'),
      ],
    ),
  ],
);

const learnerCustomInterestPrefix = 'custom:';

bool isCustomInterestKey(String value) {
  return value.trim().toLowerCase().startsWith(learnerCustomInterestPrefix);
}

String? customInterestKeyFromText(String text) {
  final normalized = text
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'[^\w\s-]'), '')
      .replaceAll(RegExp(r'\s+'), '_')
      .replaceAll(RegExp(r'_+'), '_')
      .replaceAll(RegExp(r'^_|_$'), '');

  if (normalized.length < 2 || normalized.length > 80) {
    return null;
  }

  return '$learnerCustomInterestPrefix$normalized';
}

Iterable<String> customInterestKeys(Iterable<String> keys) {
  return keys.where(isCustomInterestKey);
}

String learnerInterestLabel(
  String keyOrLabel, {
  Map<String, String>? labelByKey,
}) {
  final normalized = keyOrLabel.trim();
  if (normalized.isEmpty) {
    return normalized;
  }

  if (isCustomInterestKey(normalized)) {
    final suffix = normalized.substring(learnerCustomInterestPrefix.length);
    return suffix
        .split('_')
        .where((part) => part.isNotEmpty)
        .map(
          (part) => part.length == 1
              ? part.toUpperCase()
              : '${part[0].toUpperCase()}${part.substring(1)}',
        )
        .join(' ');
  }

  final mapped = labelByKey?[normalized];
  if (mapped != null && mapped.isNotEmpty) {
    return mapped;
  }

  for (final group in fallbackLearnerInterestOptions.groups) {
    for (final item in group.items) {
      if (item.key == normalized) {
        return item.label;
      }
    }
  }

  return normalized
      .replaceAll('_', ' ')
      .split(' ')
      .map(
        (part) => part.isEmpty
            ? part
            : '${part[0].toUpperCase()}${part.substring(1)}',
      )
      .join(' ');
}

Set<String> normalizeSelectedInterestKeys(
  Iterable<String> values, {
  Map<String, String>? labelByKey,
}) {
  final keys = <String>{};
  final labels = labelByKey ?? fallbackLearnerInterestOptions.labelByKey;
  final labelEntries = labels.entries.toList();

  for (final value in values) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      continue;
    }

    if (isCustomInterestKey(trimmed)) {
      final customKey = customInterestKeyFromText(trimmed);
      if (customKey != null) {
        keys.add(customKey);
      }
      continue;
    }

    if (labels.containsKey(trimmed)) {
      keys.add(trimmed);
      continue;
    }

    final byLabel = labelEntries.where((entry) => entry.value == trimmed);
    if (byLabel.isNotEmpty) {
      keys.add(byLabel.first.key);
      continue;
    }

    final normalized = trimmed.toLowerCase().replaceAll(' & ', ' and ');
    final aliasMatch = labelEntries.where(
      (entry) => entry.value.toLowerCase() == normalized,
    );
    if (aliasMatch.isNotEmpty) {
      keys.add(aliasMatch.first.key);
      continue;
    }

    final customKey = customInterestKeyFromText(trimmed);
    if (customKey != null) {
      keys.add(customKey);
    }
  }

  return keys;
}

List<String> mergeInterestSelection({
  required Set<String> selectedKeys,
  required String customInterestText,
}) {
  final merged = {...selectedKeys};
  final customKey = customInterestKeyFromText(customInterestText);
  if (customKey != null) {
    merged.add(customKey);
  }
  return merged.toList();
}
