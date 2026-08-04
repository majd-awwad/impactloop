import 'package:flutter/material.dart';

import '../../core/errors/api_exception.dart';
import '../../l10n/app_localizations.dart';

void showErrorSnackBar(
  BuildContext context,
  Object error, {
  AppLocalizations? l10n,
  String? message,
}) {
  _showFeedbackSnackBar(
    context,
    message:
        message ??
        (l10n == null
            ? userFriendlyErrorMessage(error)
            : localizedApiErrorMessage(error, l10n)),
    backgroundColor: Theme.of(context).colorScheme.errorContainer,
    foregroundColor: Theme.of(context).colorScheme.onErrorContainer,
  );
}

void showInfoSnackBar(BuildContext context, String message) {
  _showFeedbackSnackBar(
    context,
    message: message,
    backgroundColor: Theme.of(context).colorScheme.inverseSurface,
    foregroundColor: Theme.of(context).colorScheme.onInverseSurface,
  );
}

void _showFeedbackSnackBar(
  BuildContext context, {
  required String message,
  required Color backgroundColor,
  required Color foregroundColor,
}) {
  final messenger = ScaffoldMessenger.of(context);

  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        backgroundColor: backgroundColor,
        margin: const EdgeInsets.all(16),
        showCloseIcon: true,
        closeIconColor: foregroundColor,
      ),
    );
}
