import 'package:flutter/widgets.dart';

class LocalizedText {
  const LocalizedText({required this.en, required this.ar});

  final String en;
  final String ar;
}

extension LocalizedTextX on LocalizedText {
  String resolve(BuildContext context) {
    final languageCode = Localizations.localeOf(context).languageCode;
    return languageCode == 'ar' ? ar : en;
  }
}
