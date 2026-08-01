part of 'category_request_approval_dialog.dart';

enum _CategoryNameLanguage { english, arabic }

class _NameAssessment {
  const _NameAssessment({this.error, this.warnings = const []});
  final String? error;
  final List<String> warnings;
}

final _latinLetters = RegExp(r'[A-Za-z\u00C0-\u024F]');
final _arabicLetters = RegExp(
  r'[\u0621-\u063A\u0641-\u064A\u066E-\u06D3\u06FA-\u06FC]',
);
final _controlCharacters = RegExp(
  r'[\x00-\x1F\x7F-\x9F\u200B-\u200F\u202A-\u202E\u2060-\u206F]',
);
final _boundaryPunctuation = RegExp(
  r'''^[.,;:!?…،؛؟'"()\[\]{}<>/\\_+\-=*#@&%$]|[.,;:!?…،؛؟'"()\[\]{}<>/\\_+\-=*#@&%$]$''',
);
final _sharedTechnicalToken = RegExp(r'^[A-Z0-9][A-Z0-9.+-]{1,11}$');
const _reviewedSharedTechnicalTerms = {
  'arduino',
  'raspberry pi',
  '3d printing',
};

String _normalizeCategoryDisplayName(String value) =>
    value.trim().replaceAll(RegExp(r'\s+'), ' ');

bool _isPlausibleSharedTechnicalTerm(String value) {
  final displayValue = _normalizeCategoryDisplayName(value);
  final uppercaseLatinCount = RegExp(r'[A-Z]').allMatches(displayValue).length;
  return (_sharedTechnicalToken.hasMatch(displayValue) &&
          uppercaseLatinCount >= 2) ||
      _reviewedSharedTechnicalTerms.contains(displayValue.toLowerCase());
}

bool _isAllowedIdenticalTechnicalTerm(String nameEn, String nameAr) {
  final english = _normalizeCategoryDisplayName(nameEn);
  final arabic = _normalizeCategoryDisplayName(nameAr);
  return english.toLowerCase() == arabic.toLowerCase() &&
      _isPlausibleSharedTechnicalTerm(english);
}

int _matchCount(RegExp expression, String value) =>
    expression.allMatches(value).length;

bool _primarilyArabic(String value) =>
    _matchCount(_arabicLetters, value) > _matchCount(_latinLetters, value);

_NameAssessment _assessCategoryName({
  required String value,
  required _CategoryNameLanguage language,
  required AdminL10n l,
  required AdminCategoryRequestListItem item,
  bool allowSharedTechnicalTerm = false,
}) {
  final displayValue = _normalizeCategoryDisplayName(value);
  final length = displayValue.runes.length;
  final latinCount = _matchCount(_latinLetters, displayValue);
  final arabicCount = _matchCount(_arabicLetters, displayValue);
  final requiredMessage = language == _CategoryNameLanguage.english
      ? l.englishNameRequired
      : l.arabicNameRequired;
  if (length < 2 || length > 120) {
    return _NameAssessment(error: requiredMessage);
  }
  if (_controlCharacters.hasMatch(displayValue)) {
    return _NameAssessment(error: l.nameControlCharacters);
  }
  if (_boundaryPunctuation.hasMatch(displayValue)) {
    return _NameAssessment(error: l.namePunctuationBoundary);
  }
  final words = displayValue
      .toLowerCase()
      .split(' ')
      .map(
        (word) => word.replaceAll(
          RegExp(r'''^[.,;:!?…،؛؟'"()\[\]{}]+|[.,;:!?…،؛؟'"()\[\]{}]+$'''),
          '',
        ),
      )
      .where((word) => word.isNotEmpty)
      .toList();
  if (words.indexed.any(
    (entry) => entry.$1 > 0 && entry.$2 == words[entry.$1 - 1],
  )) {
    return _NameAssessment(error: l.nameRepeatedWords);
  }
  if (displayValue.runes.length > 80 || words.length > 12) {
    return _NameAssessment(error: l.nameDescriptionLike);
  }
  if (language == _CategoryNameLanguage.english) {
    if (latinCount < 2 || arabicCount > 3 || arabicCount >= latinCount) {
      return _NameAssessment(error: l.englishNameWrongScript);
    }
  } else if (!allowSharedTechnicalTerm &&
      (arabicCount < 2 || latinCount > 6 || latinCount > arabicCount)) {
    return _NameAssessment(error: l.arabicNameWrongScript);
  }

  final warnings = <String>[];
  if (value.contains(RegExp(r'\s{2,}|[\t\r\n]'))) {
    warnings.add(l.repeatedWhitespaceWarning);
  }
  if (displayValue.runes.length > 60) warnings.add(l.nameUnusuallyLong);
  if (language == _CategoryNameLanguage.english) {
    final lettersOnly = displayValue.replaceAll(RegExp(r'[^A-Za-z]'), '');
    if (words.length > 1 &&
        lettersOnly.length > 3 &&
        (lettersOnly == lettersOnly.toUpperCase() ||
            lettersOnly == lettersOnly.toLowerCase())) {
      warnings.add(l.englishNameCasingWarning);
    }
  }
  if (_normalizeCategoryDisplayName(item.materialTitle ?? '').toLowerCase() ==
      displayValue.toLowerCase()) {
    warnings.add(l.materialTitleWarning);
  }
  final suggested = item.suggestedCategory;
  if (suggested != null) {
    final existing = language == _CategoryNameLanguage.english
        ? suggested.nameEn
        : suggested.nameAr;
    final normalizedExisting = _normalizeCategoryDisplayName(
      existing,
    ).toLowerCase();
    final normalizedProposed = displayValue.toLowerCase();
    if (normalizedProposed.length >= 8 &&
        (normalizedExisting.contains(normalizedProposed) ||
            normalizedProposed.contains(normalizedExisting))) {
      warnings.add(l.similarWordingWarning);
    }
  }
  return _NameAssessment(warnings: warnings);
}
