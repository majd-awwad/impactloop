import 'package:flutter/material.dart';

import '../../domain/models/learning_project.dart';

extension LearningHubLocalizedTextX on LocalizedText {
  String resolve(BuildContext context) {
    final languageCode = Localizations.localeOf(context).languageCode;
    return languageCode == 'ar' ? ar : en;
  }
}
