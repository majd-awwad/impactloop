import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/models/project_build.dart';
import '../presentation/widgets/project_build_acquisition_state.dart';
import 'learning_hub_providers.dart';

const projectBuildRefreshInterval = Duration(seconds: 10);

bool projectBuildNeedsActiveRefresh(ProjectBuild? build) {
  return ProjectBuildAcquisitionState.buildNeedsActiveRefresh(build);
}

typedef ProjectBuildRefreshCallback = void Function();

class ProjectBuildRefreshController {
  ProjectBuildRefreshController({
    required this.onRefresh,
    this.interval = projectBuildRefreshInterval,
  });

  final ProjectBuildRefreshCallback onRefresh;
  final Duration interval;

  Timer? _timer;
  bool _pollingActive = false;

  bool get isPollingActive => _pollingActive;

  void syncPolling(ProjectBuild? build) {
    final shouldPoll = projectBuildNeedsActiveRefresh(build);
    if (shouldPoll == _pollingActive) {
      return;
    }

    _pollingActive = shouldPoll;
    _timer?.cancel();
    _timer = null;

    if (!shouldPoll) {
      return;
    }

    _timer = Timer.periodic(interval, (_) {
      onRefresh();
    });
  }

  void dispose() {
    _timer?.cancel();
    _timer = null;
    _pollingActive = false;
  }
}

void refreshProjectBuildProviders(WidgetRef ref, String projectId) {
  ref.invalidate(projectBuildProvider(projectId));
}
