import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../learning_hub/domain/models/project_build.dart';
import '../../application/open_learner_help_session_entry.dart';
import '../l10n/project_help_sessions_l10n.dart';

class BuildHelpSessionIconButton extends ConsumerStatefulWidget {
  const BuildHelpSessionIconButton({
    super.key,
    required this.buildId,
    required this.projectId,
    required this.status,
  });

  final String buildId;
  final String projectId;
  final ProjectBuildStatus status;

  @override
  ConsumerState<BuildHelpSessionIconButton> createState() =>
      _BuildHelpSessionIconButtonState();
}

class _BuildHelpSessionIconButtonState
    extends ConsumerState<BuildHelpSessionIconButton> {
  bool _busy = false;

  Future<void> _handleTap() async {
    if (_busy) {
      return;
    }
    setState(() => _busy = true);
    try {
      await openLearnerHelpSessionEntry(
        context: context,
        ref: ref,
        buildId: widget.buildId,
        projectId: widget.projectId,
        onLookupsComplete: () {
          if (mounted) {
            setState(() => _busy = false);
          }
        },
      );
    } finally {
      if (mounted && _busy) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!isLearnerHelpSessionBuildEligible(widget.status)) {
      return const SizedBox.shrink();
    }
    final label = ProjectHelpSessionsL10n.listTitle.resolve(context);
    return IconButton(
      key: const Key('build-help-session-icon'),
      tooltip: label,
      onPressed: _busy ? null : _handleTap,
      icon: _busy
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Icon(Icons.support_agent_outlined),
    );
  }
}
