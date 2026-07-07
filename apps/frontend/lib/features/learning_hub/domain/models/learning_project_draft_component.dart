class LearningProjectDraftComponent {
  const LearningProjectDraftComponent({
    this.name = '',
    this.quantity = 1,
    this.unit = 'piece',
    this.role = LearningProjectComponentRole.material,
    this.materialCategoryId,
    this.materialTypeHint = '',
    this.keywords = const <String>[],
    this.keywordDraft = '',
    this.canBeSubstituted = false,
    this.notes = '',
    this.showAdvanced = false,
  });

  final String name;
  final double quantity;
  final String unit;
  final LearningProjectComponentRole role;
  final String? materialCategoryId;
  final String materialTypeHint;
  final List<String> keywords;
  final String keywordDraft;
  final bool canBeSubstituted;
  final String notes;
  final bool showAdvanced;

  static const String noMaterialCategoryValue = '';

  static final RegExp _uuidPattern = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    caseSensitive: false,
  );

  static String? normalizeMaterialCategoryId(String? value) {
    final trimmed = value?.trim();
    if (trimmed == null || trimmed.isEmpty) {
      return null;
    }

    final lowered = trimmed.toLowerCase();
    if (lowered == 'none' || lowered == 'null') {
      return null;
    }

    if (!_uuidPattern.hasMatch(trimmed)) {
      return null;
    }

    return trimmed;
  }

  static String materialCategoryDropdownValue(String? categoryId) {
    return normalizeMaterialCategoryId(categoryId) ?? noMaterialCategoryValue;
  }

  static const List<String> unitOptions = [
    'piece',
    'pieces',
    'kg',
    'g',
    'm',
    'cm',
    'set',
    'pack',
    'roll',
    'other',
  ];

  LearningProjectDraftComponent copyWith({
    String? name,
    double? quantity,
    String? unit,
    LearningProjectComponentRole? role,
    String? materialCategoryId,
    bool clearMaterialCategoryId = false,
    String? materialTypeHint,
    List<String>? keywords,
    String? keywordDraft,
    bool? canBeSubstituted,
    String? notes,
    bool? showAdvanced,
  }) {
    return LearningProjectDraftComponent(
      name: name ?? this.name,
      quantity: quantity ?? this.quantity,
      unit: unit ?? this.unit,
      role: role ?? this.role,
      materialCategoryId: clearMaterialCategoryId
          ? null
          : (materialCategoryId ?? this.materialCategoryId),
      materialTypeHint: materialTypeHint ?? this.materialTypeHint,
      keywords: keywords ?? this.keywords,
      keywordDraft: keywordDraft ?? this.keywordDraft,
      canBeSubstituted: canBeSubstituted ?? this.canBeSubstituted,
      notes: notes ?? this.notes,
      showAdvanced: showAdvanced ?? this.showAdvanced,
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'quantity': quantity,
    'unit': unit,
    'role': role.apiValue,
    if (normalizeMaterialCategoryId(materialCategoryId) != null)
      'materialCategoryId': normalizeMaterialCategoryId(materialCategoryId),
    'materialTypeHint': materialTypeHint,
    'keywords': keywords,
    'keywordDraft': keywordDraft,
    'canBeSubstituted': canBeSubstituted,
    'notes': notes,
    'showAdvanced': showAdvanced,
  };

  factory LearningProjectDraftComponent.fromJson(Map<String, dynamic> json) {
    return LearningProjectDraftComponent(
      name: json['name'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toDouble() ?? 1,
      unit: json['unit'] as String? ?? 'piece',
      role: LearningProjectComponentRole.fromApiValue(
        json['role'] as String? ?? '',
      ),
      materialCategoryId: normalizeMaterialCategoryId(
        json['materialCategoryId'] as String?,
      ),
      materialTypeHint: json['materialTypeHint'] as String? ?? '',
      keywords: (json['keywords'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(growable: false),
      keywordDraft: json['keywordDraft'] as String? ?? '',
      canBeSubstituted: json['canBeSubstituted'] as bool? ?? false,
      notes: json['notes'] as String? ?? '',
      showAdvanced: json['showAdvanced'] as bool? ?? false,
    );
  }

  factory LearningProjectDraftComponent.empty() {
    return const LearningProjectDraftComponent();
  }

  static List<LearningProjectDraftComponent> fromLegacyCommaSeparated(
    String raw,
  ) {
    final names = raw
        .split(',')
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty)
        .toList(growable: false);

    if (names.isEmpty) {
      return [LearningProjectDraftComponent.empty()];
    }

    return names
        .map((name) => LearningProjectDraftComponent(name: name))
        .toList(growable: false);
  }

  List<String> resolvedKeywords() {
    final merged = <String>[];
    final seen = <String>{};

    void addKeyword(String value) {
      final trimmed = value.trim();
      if (trimmed.isEmpty || merged.length >= 5) {
        return;
      }

      final key = trimmed.toLowerCase();
      if (seen.contains(key)) {
        return;
      }

      seen.add(key);
      merged.add(trimmed);
    }

    for (final keyword in keywords) {
      addKeyword(keyword);
    }
    addKeyword(keywordDraft);

    return merged;
  }

  Map<String, dynamic> toSubmitPayload() {
    final payload = <String, dynamic>{
      'name': name.trim(),
      'quantity': quantity,
      'unit': unit.trim(),
      'componentRole': role.apiValue,
      'isRequired': true,
      'canBeSubstituted': canBeSubstituted,
    };

    final typeHint = materialTypeHint.trim();
    if (typeHint.isNotEmpty) {
      payload['materialType'] = typeHint;
    }

    final categoryId = normalizeMaterialCategoryId(materialCategoryId);
    if (categoryId != null) {
      payload['categoryId'] = categoryId;
    }

    final cleanedKeywords = resolvedKeywords();
    if (cleanedKeywords.isNotEmpty) {
      payload['searchKeywords'] = cleanedKeywords;
    }

    final trimmedNotes = notes.trim();
    if (trimmedNotes.isNotEmpty) {
      payload['notes'] = trimmedNotes;
    }

    return payload;
  }

  String? validate({required bool requireName}) {
    final trimmedName = name.trim();
    if (requireName && trimmedName.isEmpty) {
      return 'Component name is required.';
    }
    if (trimmedName.length > 200) {
      return 'Keep each component name under 200 characters.';
    }
    if (quantity <= 0) {
      return 'Quantity must be greater than zero.';
    }
    if (unit.trim().isEmpty || unit.trim().length > 50) {
      return 'Choose a valid unit.';
    }
    if (notes.trim().length > 1000) {
      return 'Keep notes under 1000 characters.';
    }
    if (resolvedKeywords().length > 5) {
      return 'Use up to 5 keywords per component.';
    }
    for (final keyword in resolvedKeywords()) {
      if (keyword.trim().length > 80) {
        return 'Keep each keyword under 80 characters.';
      }
    }
    if (materialCategoryId != null &&
        materialCategoryId!.trim().isNotEmpty &&
        normalizeMaterialCategoryId(materialCategoryId) == null) {
      return 'Choose a valid material category or leave it as None.';
    }
    return null;
  }
}

enum LearningProjectComponentRole {
  material('REQUIRED_MATERIAL'),
  tool('TOOL'),
  consumable('CONSUMABLE');

  const LearningProjectComponentRole(this.apiValue);

  final String apiValue;

  static LearningProjectComponentRole fromApiValue(String value) {
    return switch (value) {
      'TOOL' => LearningProjectComponentRole.tool,
      'CONSUMABLE' => LearningProjectComponentRole.consumable,
      _ => LearningProjectComponentRole.material,
    };
  }

  String labelEn() {
    return switch (this) {
      LearningProjectComponentRole.material => 'Material',
      LearningProjectComponentRole.tool => 'Tool',
      LearningProjectComponentRole.consumable => 'Consumable',
    };
  }

  String labelAr() {
    return switch (this) {
      LearningProjectComponentRole.material => 'مادة',
      LearningProjectComponentRole.tool => 'أداة',
      LearningProjectComponentRole.consumable => 'مستهلكات',
    };
  }
}

class LearningProjectSubmitSummary {
  const LearningProjectSubmitSummary({
    required this.componentCount,
    required this.toolCount,
    required this.stepCount,
  });

  final int componentCount;
  final int toolCount;
  final int stepCount;

  String resolveEn() {
    final parts = <String>[
      '$componentCount component${componentCount == 1 ? '' : 's'}',
      if (toolCount > 0) '$toolCount tool${toolCount == 1 ? '' : 's'}',
      '$stepCount step${stepCount == 1 ? '' : 's'}',
    ];
    return parts.join(', ');
  }

  String resolveAr() {
    return '$componentCount مكوّن، $toolCount أداة، $stepCount خطوة';
  }
}
