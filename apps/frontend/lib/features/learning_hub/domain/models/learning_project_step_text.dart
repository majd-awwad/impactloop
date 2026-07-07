class LearningProjectStepText {
  const LearningProjectStepText._();

  static final RegExp _stepPrefixPattern = RegExp(
    r'^(?:step\s*)?\d+\s*(?:[:\).\-\u2013\u2014]|$)\s*',
    caseSensitive: false,
  );

  static String formatStepsForEditing(
    Iterable<({String title, String description})> steps,
  ) {
    return steps
        .map((step) {
          final description = step.description.trim();
          if (description.isNotEmpty) {
            return description;
          }

          final title = step.title.trim();
          if (title.isEmpty) {
            return '';
          }

          return stripStepPrefix(title);
        })
        .where((line) => line.isNotEmpty)
        .join('\n');
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
