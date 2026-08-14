import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/models/project_build.dart';
import '../domain/project_build_acquisition_state.dart';
import 'learning_hub_providers.dart';

const projectBuildRefreshInterval = Duration(seconds: 10);

bool projectBuildNeedsActiveRefresh(ProjectBuild? build) {
  return ProjectBuildAcquisitionState.buildNeedsActiveRefresh(build);
}

typedef ProjectBuildRefreshCallback = FutureOr<void> Function();

class ProjectBuildRefreshController {
  ProjectBuildRefreshController({
    required this.onRefresh,
    this.interval = projectBuildRefreshInterval,
  });

  final ProjectBuildRefreshCallback onRefresh;
  final Duration interval;

  Timer? _timer;
  bool _pollingActive = false;
  bool _paused = false;
  bool _disposed = false;
  bool _inFlight = false;
  ProjectBuild? _lastBuild;

  bool get isPollingActive => _pollingActive && !_paused && !_disposed;

  bool get isRefreshInFlight => _inFlight;

  void setPaused(bool paused) {
    if (_disposed || _paused == paused) {
      return;
    }

    _paused = paused;
    if (_paused) {
      _timer?.cancel();
      _timer = null;
      return;
    }

    _applyPollingState();
  }

  void syncPolling(ProjectBuild? build) {
    if (_disposed) {
      return;
    }
    _lastBuild = build;
    _applyPollingState();
  }

  void _applyPollingState() {
    final shouldPoll =
        !_disposed && !_paused && projectBuildNeedsActiveRefresh(_lastBuild);
    if (shouldPoll == _pollingActive && (_timer != null || !shouldPoll)) {
      return;
    }

    _pollingActive = shouldPoll;
    _timer?.cancel();
    _timer = null;

    if (!shouldPoll) {
      return;
    }

    _timer = Timer.periodic(interval, (_) {
      unawaited(_runRefreshTick());
    });
  }

  Future<void> _runRefreshTick() async {
    if (_disposed || _paused || _inFlight) {
      return;
    }

    _inFlight = true;
    try {
      await Future<void>.sync(onRefresh);
    } catch (_) {
      // Provider / page surfaces errors.
    } finally {
      _inFlight = false;
    }
  }

  void dispose() {
    _disposed = true;
    _timer?.cancel();
    _timer = null;
    _pollingActive = false;
    _paused = false;
    _lastBuild = null;
  }
}

class ProjectBuildRefreshCoordinator {
  ProjectBuildRefreshCoordinator({required this.onRefresh});

  final ProjectBuildRefreshCallback onRefresh;

  bool _inFlight = false;

  bool get isRefreshInFlight => _inFlight;

  void requestRefresh() {
    if (_inFlight) {
      return;
    }

    _inFlight = true;
    try {
      onRefresh();
    } finally {
      _inFlight = false;
    }
  }

  Future<void> requestRefreshAsync(Future<void> Function() refresh) async {
    if (_inFlight) {
      return;
    }

    _inFlight = true;
    try {
      await refresh();
    } finally {
      _inFlight = false;
    }
  }
}

String? projectBuildRefreshTargetId(String? projectId) {
  final trimmed = projectId?.trim();
  if (trimmed == null || trimmed.isEmpty) {
    return null;
  }

  return trimmed;
}

typedef ProjectBuildInvalidator = void Function(
  FutureProvider<ProjectBuild?> provider,
);

void refreshProjectBuildWith(
  ProjectBuildInvalidator invalidate,
  String? projectId,
) {
  final targetId = projectBuildRefreshTargetId(projectId);
  if (targetId == null) {
    return;
  }

  invalidate(projectBuildProvider(targetId));
}

extension ProjectBuildRefreshRefX on Ref {
  void refreshLinkedProjectBuild(String? projectId) {
    refreshProjectBuildWith(invalidate, projectId);
  }
}

extension ProjectBuildRefreshWidgetRefX on WidgetRef {
  void refreshLinkedProjectBuild(String? projectId) {
    refreshProjectBuildWith(invalidate, projectId);
  }

  void refreshSmartBuildPlan(String? projectId) {
    final targetId = projectBuildRefreshTargetId(projectId);
    if (targetId == null) {
      return;
    }

    invalidate(smartBuildPlanProvider(targetId));
  }
}
