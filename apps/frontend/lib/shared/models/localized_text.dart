import 'package:flutter/widgets.dart';

class LocalizedText {
  const LocalizedText({required this.en, required this.ar});

  final String en;
  final String ar;
}

extension LocalizedTextX on LocalizedText {
  String resolve(BuildContext context) {
    return resolveFor(Localizations.localeOf(context).languageCode);
  }

  String resolveFor(String languageCode) {
    return languageCode == 'ar' ? ar : en;
  }
}
