import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../domain/models/learning_project_draft_component.dart';

class LearningProjectDraftData {
  const LearningProjectDraftData({
    required this.title,
    required this.summary,
    required this.components,
    required this.steps,
    required this.links,
    this.categoryId,
    required this.difficulty,
    required this.duration,
    this.fullDescription = '',
  });

  final String title;
  final String summary;
  final String fullDescription;
  final List<LearningProjectDraftComponent> components;
  final String steps;
  final String links;
  final String? categoryId;
  final String difficulty;
  final String duration;

  Map<String, dynamic> toJson() => {
    'title': title,
    'summary': summary,
    'fullDescription': fullDescription,
    'componentEntries': components
        .map((component) => component.toJson())
        .toList(),
    'steps': steps,
    'links': links,
    'categoryId': categoryId,
    'difficulty': difficulty,
    'duration': duration,
  };

  factory LearningProjectDraftData.fromJson(Map<String, dynamic> json) {
    final componentEntries = json['componentEntries'];
    final legacyComponents = json['components'];

    List<LearningProjectDraftComponent> components;
    if (componentEntries is List) {
      components = componentEntries
          .whereType<Map>()
          .map(
            (entry) => LearningProjectDraftComponent.fromJson(
              Map<String, dynamic>.from(entry),
            ),
          )
          .toList(growable: false);
    } else if (legacyComponents is String) {
      components = LearningProjectDraftComponent.fromLegacyCommaSeparated(
        legacyComponents,
      );
    } else {
      components = [LearningProjectDraftComponent.empty()];
    }

    if (components.isEmpty) {
      components = [LearningProjectDraftComponent.empty()];
    }

    return LearningProjectDraftData(
      title: json['title'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      fullDescription: json['fullDescription'] as String? ?? '',
      components: components,
      steps: json['steps'] as String? ?? '',
      links: json['links'] as String? ?? '',
      categoryId: json['categoryId'] as String?,
      difficulty: json['difficulty'] as String? ?? 'medium',
      duration: json['duration'] as String? ?? 'medium',
    );
  }
}

abstract class LearningProjectDraftStorage {
  Future<LearningProjectDraftData?> readDraft();

  Future<void> saveDraft(LearningProjectDraftData draft);

  Future<void> clearDraft();
}

class SecureLearningProjectDraftStorage implements LearningProjectDraftStorage {
  const SecureLearningProjectDraftStorage(this._storage);

  static const _draftKey = 'impactloop_learning_project_draft';

  final FlutterSecureStorage _storage;

  @override
  Future<LearningProjectDraftData?> readDraft() async {
    try {
      final raw = await _storage.read(key: _draftKey);
      if (raw == null || raw.trim().isEmpty) return null;
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return null;
      return LearningProjectDraftData.fromJson(decoded);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> saveDraft(LearningProjectDraftData draft) async {
    try {
      await _storage.write(key: _draftKey, value: jsonEncode(draft.toJson()));
    } catch (_) {}
  }

  @override
  Future<void> clearDraft() async {
    try {
      await _storage.delete(key: _draftKey);
    } catch (_) {}
  }
}

class MemoryLearningProjectDraftStorage implements LearningProjectDraftStorage {
  LearningProjectDraftData? _draft;

  @override
  Future<LearningProjectDraftData?> readDraft() async => _draft;

  @override
  Future<void> saveDraft(LearningProjectDraftData draft) async {
    _draft = draft;
  }

  @override
  Future<void> clearDraft() async {
    _draft = null;
  }
}

LearningProjectDraftStorage createLearningProjectDraftStorage() {
  final bindingName = WidgetsBinding.instance.runtimeType.toString();
  if (bindingName.contains('Test')) {
    return MemoryLearningProjectDraftStorage();
  }

  if (kIsWeb) {
    return const SecureLearningProjectDraftStorage(FlutterSecureStorage());
  }

  return const SecureLearningProjectDraftStorage(
    FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
    ),
  );
}
