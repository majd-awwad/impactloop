import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../learning_hub/domain/models/project_build.dart';
import '../../application/help_session_mutation_feedback.dart';
import '../../application/project_help_session_timezone.dart';
import '../../application/project_help_sessions_providers.dart';
import '../../data/models/project_help_session_models.dart';
import '../l10n/project_help_sessions_l10n.dart';
import 'help_session_request_form.dart';

Future<ProjectHelpSession?> showProjectHelpSessionRequestFlow({
  required BuildContext context,
  required WidgetRef ref,
  required ProjectBuild build,
  required ProjectHelpSessionAvailability availability,
}) async {
  final hostContext = context;
  try {
    final existing =
        await ref.read(activeHelpSessionForBuildProvider(build.id).future);
    if (existing != null && hostContext.mounted) {
      showHelpSessionMutationSuccess(
        hostContext,
        ProjectHelpSessionsL10n.requestAlreadySubmitted.resolve(hostContext),
      );
      return existing;
    }
  } catch (_) {
    // Fall through to the request form when the active-session lookup fails.
  }

  if (!hostContext.mounted) {
    return null;
  }

  final isCompact = MediaQuery.sizeOf(hostContext).width < 720;

  Widget buildForm(BuildContext modalContext) {
    return ProjectHelpSessionRequestForm(
      hostContext: hostContext,
      build: build,
      availability: availability,
      isCompact: isCompact,
    );
  }

  if (isCompact) {
    return showModalBottomSheet<ProjectHelpSession>(
      context: hostContext,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (modalContext) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(modalContext).bottom,
        ),
        child: SizedBox(
          height: MediaQuery.sizeOf(modalContext).height * 0.92,
          child: buildForm(modalContext),
        ),
      ),
    );
  }

  return showDialog<ProjectHelpSession>(
    context: hostContext,
    builder: (modalContext) {
      final maxHeight = MediaQuery.sizeOf(modalContext).height * 0.85;
      return Dialog(
        insetPadding: const EdgeInsets.all(AppSpacing.lg),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: 720,
            maxHeight: maxHeight,
          ),
          child: buildForm(modalContext),
        ),
      );
    },
  );
}

Future<void> handleHelpSessionRequestError(
  BuildContext context,
  Object error,
) {
  final isArabic = Localizations.localeOf(context).languageCode == 'ar';
  showErrorSnackBar(
    context,
    error,
    message: resolveProjectHelpSessionErrorFromObject(
      error,
      isArabic: isArabic,
    ),
  );
  return Future.value();
}
