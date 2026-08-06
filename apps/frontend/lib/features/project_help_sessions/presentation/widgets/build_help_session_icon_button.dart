import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../learning_hub/application/learning_hub_providers.dart';
import '../../../learning_hub/domain/models/project_build.dart';
import '../../application/project_help_sessions_providers.dart';
import '../l10n/project_help_sessions_l10n.dart';
import 'help_session_request_flow.dart';

class BuildHelpSessionIconButton extends ConsumerWidget {
  const BuildHelpSessionIconButton({
    super.key,
    required this.buildId,
    required this.projectId,
    required this.status,
  });

  final String buildId;
  final String projectId;
  final ProjectBuildStatus status;

  bool get _eligible =>
      status == ProjectBuildStatus.inProgress ||
      status == ProjectBuildStatus.paused;

  Future<void> _handleTap(BuildContext context, WidgetRef ref) async {
    final activeSession =
        await ref.read(activeHelpSessionForBuildProvider(buildId).future);
    if (!context.mounted) {
      return;
    }
    if (activeSession != null) {
      context.push(learnerHelpSessionDetailRoute(activeSession.id));
      return;
    }
    final build = await ref.read(projectBuildProvider(projectId).future);
    if (build == null || !context.mounted) {
      return;
    }
    final availability = await ref
        .read(projectHelpSessionAvailabilityProvider(projectId).future);
    if (!context.mounted || !availability.available) {
      return;
    }
    final session = await showProjectHelpSessionRequestFlow(
      context: context,
      ref: ref,
      build: build,
      availability: availability,
    );
    if (session != null && context.mounted) {
      context.push(learnerHelpSessionDetailRoute(session.id));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!_eligible) {
      return const SizedBox.shrink();
    }
    final label = ProjectHelpSessionsL10n.listTitle.resolve(context);
    return IconButton(
      tooltip: label,
      onPressed: () => _handleTap(context, ref),
      icon: const Icon(Icons.support_agent_outlined),
    );
  }
}
