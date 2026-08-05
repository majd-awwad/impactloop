import 'dart:math';

const notebookSchemaVersion = 1;
const notebookMaxPages = 20;
const notebookSupportedColors = [
  '#1F2937',
  '#22C55E',
  '#EF4444',
  '#3B82F6',
];
const notebookStrokeWidths = [1.0, 2.0, 4.0];

class NotebookPoint {
  const NotebookPoint({required this.x, required this.y});

  final double x;
  final double y;

  Map<String, dynamic> toJson() => {'x': x, 'y': y};

  factory NotebookPoint.fromJson(Map<String, dynamic> json) {
    return NotebookPoint(
      x: (json['x'] as num).toDouble(),
      y: (json['y'] as num).toDouble(),
    );
  }

  NotebookPoint copyWith({double? x, double? y}) {
    return NotebookPoint(x: x ?? this.x, y: y ?? this.y);
  }
}

class NotebookStroke {
  const NotebookStroke({
    required this.id,
    required this.color,
    required this.width,
    required this.points,
  });

  final String id;
  final String color;
  final double width;
  final List<NotebookPoint> points;

  Map<String, dynamic> toJson() => {
    'id': id,
    'color': color,
    'width': width,
    'points': points.map((point) => point.toJson()).toList(),
  };

  factory NotebookStroke.fromJson(Map<String, dynamic> json) {
    return NotebookStroke(
      id: json['id'] as String,
      color: json['color'] as String,
      width: (json['width'] as num).toDouble(),
      points: (json['points'] as List<dynamic>)
          .map((point) => NotebookPoint.fromJson(point as Map<String, dynamic>))
          .toList(),
    );
  }

  NotebookStroke copyWith({
    String? id,
    String? color,
    double? width,
    List<NotebookPoint>? points,
  }) {
    return NotebookStroke(
      id: id ?? this.id,
      color: color ?? this.color,
      width: width ?? this.width,
      points: points ?? this.points,
    );
  }
}

class NotebookPage {
  NotebookPage({
    required this.id,
    required this.title,
    required this.text,
    required this.strokes,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String title;
  final String text;
  final List<NotebookStroke> strokes;
  final DateTime createdAt;
  final DateTime updatedAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'text': text,
    'strokes': strokes.map((stroke) => stroke.toJson()).toList(),
    'createdAt': createdAt.toUtc().toIso8601String(),
    'updatedAt': updatedAt.toUtc().toIso8601String(),
  };

  factory NotebookPage.fromJson(Map<String, dynamic> json) {
    return NotebookPage(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      text: json['text'] as String? ?? '',
      strokes: (json['strokes'] as List<dynamic>? ?? [])
          .map((stroke) => NotebookStroke.fromJson(stroke as Map<String, dynamic>))
          .toList(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  NotebookPage copyWith({
    String? id,
    String? title,
    String? text,
    List<NotebookStroke>? strokes,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return NotebookPage(
      id: id ?? this.id,
      title: title ?? this.title,
      text: text ?? this.text,
      strokes: strokes ?? this.strokes,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class NotebookDocument {
  const NotebookDocument({required this.schemaVersion, required this.pages});

  final int schemaVersion;
  final List<NotebookPage> pages;

  Map<String, dynamic> toJson() => {
    'schemaVersion': schemaVersion,
    'pages': pages.map((page) => page.toJson()).toList(),
  };

  factory NotebookDocument.fromJson(Map<String, dynamic> json) {
    return NotebookDocument(
      schemaVersion: json['schemaVersion'] as int? ?? notebookSchemaVersion,
      pages: (json['pages'] as List<dynamic>? ?? [])
          .map((page) => NotebookPage.fromJson(page as Map<String, dynamic>))
          .toList(),
    );
  }

  NotebookDocument copyWith({int? schemaVersion, List<NotebookPage>? pages}) {
    return NotebookDocument(
      schemaVersion: schemaVersion ?? this.schemaVersion,
      pages: pages ?? this.pages,
    );
  }
}

class ProjectBuildNotebook {
  const ProjectBuildNotebook({
    required this.buildId,
    required this.buildStatus,
    required this.attemptNumber,
    required this.projectTitle,
    required this.readOnly,
    required this.persisted,
    required this.content,
    required this.createdAt,
    required this.updatedAt,
  });

  final String buildId;
  final String buildStatus;
  final int attemptNumber;
  final String projectTitle;
  final bool readOnly;
  final bool persisted;
  final NotebookDocument content;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory ProjectBuildNotebook.fromJson(Map<String, dynamic> json) {
    return ProjectBuildNotebook(
      buildId: json['buildId'] as String,
      buildStatus: json['buildStatus'] as String,
      attemptNumber: (json['attemptNumber'] as num).toInt(),
      projectTitle: json['projectTitle'] as String? ?? '',
      readOnly: json['readOnly'] as bool? ?? false,
      persisted: json['persisted'] as bool? ?? false,
      content: NotebookDocument.fromJson(
        json['content'] as Map<String, dynamic>,
      ),
      createdAt: json['createdAt'] == null
          ? null
          : DateTime.parse(json['createdAt'] as String),
      updatedAt: json['updatedAt'] == null
          ? null
          : DateTime.parse(json['updatedAt'] as String),
    );
  }
}

String createNotebookStableId() {
  final random = Random();
  return '${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}-${random.nextInt(0x7fffffff).toRadixString(36)}';
}

NotebookPage createDefaultNotebookPage({
  required String title,
  String? id,
}) {
  final now = DateTime.now().toUtc();
  return NotebookPage(
    id: id ?? createNotebookStableId(),
    title: title,
    text: '',
    strokes: const [],
    createdAt: now,
    updatedAt: now,
  );
}

NotebookDocument createDefaultNotebookDocument({required String defaultPageTitle}) {
  return NotebookDocument(
    schemaVersion: notebookSchemaVersion,
    pages: [createDefaultNotebookPage(title: defaultPageTitle)],
  );
}

String defaultNotebookPageTitle(String languageCode, int pageNumber) {
  if (languageCode == 'ar') {
    return 'صفحة $pageNumber';
  }
  return 'Page $pageNumber';
}
