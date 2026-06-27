import 'package:flutter/material.dart';

import '../../core/errors/api_exception.dart';

void showErrorSnackBar(BuildContext context, Object error) {
  _showFeedbackSnackBar(
    context,
    message: userFriendlyErrorMessage(error),
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
