class LearningProjectStepText {
  const LearningProjectStepText._();

  static final RegExp _stepPrefixPattern = RegExp(
    r'^(?:step\s*)?\d+\s*(?:[:\).\-\u2013\u2014]|$)\s*',
    caseSensitive: false,
  );

  static String formatStepsForEditing(
    Iterable<({String title, String description})> steps,
  ) {
    final lines = <String>[];
    var index = 0;

    for (final step in steps) {
      final description = step.description.trim();
      final title = step.title.trim();
      final body = description.isNotEmpty
          ? stripStepPrefix(description)
          : (title.isEmpty ? '' : stripStepPrefix(title));
      if (body.isEmpty) {
        continue;
      }
      index += 1;
      lines.add('$index. $body');
    }

    return lines.join('\n');
  }

  static String stripStepPrefix(String value) {
    var cleaned = value.trim();
    while (cleaned.isNotEmpty) {
      final next = cleaned.replaceFirst(_stepPrefixPattern, '').trim();
      if (next == cleaned) {
        break;
      }
      cleaned = next;
    }
    return cleaned;
  }

  static List<Map<String, dynamic>> parseStepsFromText(String raw) {
    final lines = raw
        .split('\n')
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty);
    final steps = <Map<String, dynamic>>[];
    var index = 0;

    for (final line in lines) {
      index += 1;
      final description = stripStepPrefix(line);
      steps.add({
        'title': 'Step $index',
        'description': description.isEmpty ? line : description,
      });
    }

    return steps;
  }
}
