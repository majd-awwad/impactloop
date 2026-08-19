import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../learning_hub/domain/models/project_build.dart';
import '../../application/open_learner_help_session_entry.dart';
import '../l10n/project_help_sessions_l10n.dart';

/// Compact secondary action that opens the existing help-session flow.
///
/// Does not watch providers during build so existing Build page tests remain
/// stable; active vs new-request is resolved on tap.
class BuildHelpSessionCompactAction extends ConsumerStatefulWidget {
  const BuildHelpSessionCompactAction({
    super.key,
    required this.buildRecord,
  });

  final ProjectBuild buildRecord;

  @override
  ConsumerState<BuildHelpSessionCompactAction> createState() =>
      _BuildHelpSessionCompactActionState();
}

class _BuildHelpSessionCompactActionState
    extends ConsumerState<BuildHelpSessionCompactAction> {
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
        buildId: widget.buildRecord.id,
        projectId: widget.buildRecord.projectId,
        build: widget.buildRecord,
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
    if (!isLearnerHelpSessionBuildEligible(widget.buildRecord.status)) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.md),
      child: Align(
        alignment: AlignmentDirectional.center,
        child: TextButton(
          key: const Key('build-help-session-compact-action'),
          onPressed: _busy ? null : _handleTap,
          child: Text(
            ProjectHelpSessionsL10n.requestHelpAction.resolve(context),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ),
    );
  }
}

/// Build-tools sheet tile that reuses the same compact secondary-action pattern.
class BuildHelpSessionToolsTile extends ConsumerWidget {
  const BuildHelpSessionToolsTile({
    super.key,
    required this.buildRecord,
    required this.hostContext,
  });

  final ProjectBuild buildRecord;
  final BuildContext hostContext;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!isLearnerHelpSessionBuildEligible(buildRecord.status)) {
      return const SizedBox.shrink();
    }

    return ListTile(
      key: const Key('build-help-session-tools-tile'),
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.support_agent_outlined),
      title: Text(
        ProjectHelpSessionsL10n.requestHelpAction.resolve(context),
      ),
      onTap: () {
        Navigator.of(context).pop();
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!hostContext.mounted) {
            return;
          }
          openLearnerHelpSessionEntry(
            context: hostContext,
            ref: ref,
            buildId: buildRecord.id,
            projectId: buildRecord.projectId,
            build: buildRecord,
          );
        });
      },
    );
  }
}
