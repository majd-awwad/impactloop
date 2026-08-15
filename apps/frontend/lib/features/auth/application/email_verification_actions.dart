import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import 'auth_providers.dart';
import '../data/auth_repository.dart';
import '../data/models/user.dart';

Future<void> resendEmailVerificationWithFeedback(
  BuildContext context,
  WidgetRef ref, {
  AuthRepository? repository,
}) async {
  final l10n = context.l10n;
  final messenger = ScaffoldMessenger.maybeOf(context);

  try {
    if (repository != null) {
      await repository.resendEmailVerification();
    } else {
      await ref.read(authRepositoryProvider).resendEmailVerification();
    }
    messenger?.showSnackBar(
      SnackBar(content: Text(l10n.emailVerificationResendSuccess)),
    );
  } on ApiException catch (error) {
    messenger?.showSnackBar(
      SnackBar(
        content: Text(localizedApiErrorMessage(error, l10n)),
      ),
    );
  } catch (_) {
    messenger?.showSnackBar(
      SnackBar(content: Text(l10n.somethingWentWrong)),
    );
  }
}

Future<void> showEmailVerificationRequiredDialog(
  BuildContext context,
  WidgetRef ref, {
  required String message,
}) async {
  final l10n = context.l10n;

  await showDialog<void>(
    context: context,
    builder: (dialogContext) {
      return AlertDialog(
        title: Text(l10n.emailVerificationRequiredTitle),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(l10n.close),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.of(dialogContext).pop();
              await resendEmailVerificationWithFeedback(context, ref);
            },
            child: Text(l10n.emailVerificationResendAction),
          ),
        ],
      );
    },
  );
}

bool isEmailVerificationRequiredError(ApiException error) {
  return error.code == 'EMAIL_VERIFICATION_REQUIRED';
}

bool userNeedsEmailVerificationNudge(User user) {
  return user.emailVerificationRequired && user.emailVerifiedAt == null;
}
