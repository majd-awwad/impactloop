import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/polling/lifecycle_polling_controller.dart';
import '../../../../core/polling/lifecycle_polling_host.dart';
import '../../application/project_help_sessions_providers.dart';
import '../../data/models/project_help_session_models.dart';

/// Keeps open detail pages in sync when the other party mutates the session.
class HelpSessionLiveRefresh extends ConsumerStatefulWidget {
  const HelpSessionLiveRefresh({
    super.key,
    required this.sessionId,
    required this.authorView,
    required this.status,
    required this.child,
    this.interval = const Duration(seconds: 15),
  });

  final String sessionId;
  final bool authorView;
  final ProjectHelpSessionStatus status;
  final Duration interval;
  final Widget child;

  @override
  ConsumerState<HelpSessionLiveRefresh> createState() =>
      _HelpSessionLiveRefreshState();
}

class _HelpSessionLiveRefreshState extends ConsumerState<HelpSessionLiveRefresh>
    with WidgetsBindingObserver, LifecyclePollingHost<HelpSessionLiveRefresh> {
  late final LifecyclePollingController _pollController =
      LifecyclePollingController(
        interval: widget.interval,
        onRefresh: _invalidateDetail,
      );

  @override
  LifecyclePollingController get lifecyclePollingController => _pollController;

  @override
  void initState() {
    super.initState();
    initLifecyclePollingHost();
    _schedulePolling();
  }

  @override
  void didUpdateWidget(covariant HelpSessionLiveRefresh oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.status != widget.status ||
        oldWidget.sessionId != widget.sessionId ||
        oldWidget.authorView != widget.authorView) {
      _schedulePolling();
    }
  }

  @override
  void dispose() {
    disposeLifecyclePollingHost();
    super.dispose();
  }

  @override
  void onLifecyclePollingRouteVisible() {
    _invalidateDetail();
  }

  @override
  void onLifecyclePollingAppResumed() {
    _invalidateDetail();
  }

  void _schedulePolling() {
    _pollController.syncEnabled(widget.status.isActive);
  }

  void _invalidateDetail() {
    if (!mounted || !widget.status.isActive) {
      return;
    }
    if (widget.authorView) {
      ref.invalidate(authorHelpSessionDetailProvider(widget.sessionId));
      return;
    }
    ref.invalidate(learnerHelpSessionDetailProvider(widget.sessionId));
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
