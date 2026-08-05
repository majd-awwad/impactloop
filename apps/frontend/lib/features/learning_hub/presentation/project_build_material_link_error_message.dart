import '../../../core/errors/api_exception.dart';
import '../../../l10n/app_localizations.dart';
import 'l10n/learning_project_build_l10n.dart';

String projectBuildMaterialLinkErrorMessage(
  Object error, {
  required String languageCode,
  AppLocalizations? l10n,
}) {
  if (error is ApiException && error.code == 'INSUFFICIENT_QUANTITY') {
    return formatInsufficientQuantityLinkError(
      error,
      languageCode: languageCode,
    );
  }

  if (error is ApiException) {
    if (l10n != null) {
      return localizedApiErrorMessage(error, l10n);
    }

    return error.displayMessage;
  }

  return l10n?.somethingWentWrong ??
      'Something went wrong. Please try again.';
}

String formatInsufficientQuantityLinkError(
  ApiException error, {
  required String languageCode,
}) {
  final details = error.details;
  final available = _parseQuantity(details?['availableQuantity']);
  final required = _parseQuantity(details?['requiredQuantity']);
  final isArabic = languageCode.toLowerCase() == 'ar';

  final title = isArabic
      ? LearningProjectBuildL10n.insufficientQuantity.ar
      : LearningProjectBuildL10n.insufficientQuantity.en;

  String? detailFromApi;
  if (details != null) {
    final raw = isArabic ? details['messageAr'] : details['messageEn'];
    final trimmed = raw?.toString().trim();
    if (trimmed != null && trimmed.isNotEmpty) {
      detailFromApi = trimmed;
    }
  }

  final detail = detailFromApi ??
      (available != null && required != null
            ? (isArabic
                  ? LearningProjectBuildL10n.quantityAvailableRequired(
                      available: available,
                      required: required,
                    ).ar
                  : LearningProjectBuildL10n.quantityAvailableRequired(
                      available: available,
                      required: required,
                    ).en)
            : null);

  if (detail != null) {
    return '$title\n$detail';
  }

  return title;
}

double? _parseQuantity(Object? value) {
  if (value is num) {
    return value.toDouble();
  }

  if (value is String) {
    return double.tryParse(value.trim());
  }

  return null;
}
