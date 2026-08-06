import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../learning_hub/domain/models/project_build.dart';
import '../../application/project_help_session_timezone.dart';
import '../../data/models/project_help_session_models.dart';
import 'help_session_request_form.dart';

Future<ProjectHelpSession?> showProjectHelpSessionRequestFlow({
  required BuildContext context,
  required WidgetRef ref,
  required ProjectBuild build,
  required ProjectHelpSessionAvailability availability,
}) {
  final isCompact = MediaQuery.sizeOf(context).width < 720;
  if (isCompact) {
    return showModalBottomSheet<ProjectHelpSession>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: ProjectHelpSessionRequestForm(
          build: build,
          availability: availability,
        ),
      ),
    );
  }
  return showDialog<ProjectHelpSession>(
    context: context,
    builder: (context) => Dialog(
      insetPadding: const EdgeInsets.all(AppSpacing.lg),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720, maxHeight: 900),
        child: ProjectHelpSessionRequestForm(
          build: build,
          availability: availability,
        ),
      ),
    ),
  );
}

Future<void> handleHelpSessionRequestError(
  BuildContext context,
  Object error,
) {
  final isArabic = Localizations.localeOf(context).languageCode == 'ar';
  final code = error is ApiException ? error.code : null;
  final message = resolveProjectHelpSessionErrorMessage(
    code,
    isArabic: isArabic,
  );
  showErrorSnackBar(context, message);
  return Future.value();
}
