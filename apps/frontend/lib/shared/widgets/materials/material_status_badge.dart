import 'package:flutter/material.dart';

import '../app_status_badge.dart';

enum MaterialStatusBadgeTone {
  available,
  reserved,
  reused,
  draft,
  success,
  danger,
  info,
  neutral,
}

extension MaterialStatusBadgeToneX on MaterialStatusBadgeTone {
  AppStatusTone get appStatusTone => switch (this) {
    MaterialStatusBadgeTone.available => AppStatusTone.primary,
    MaterialStatusBadgeTone.reserved => AppStatusTone.warning,
    MaterialStatusBadgeTone.reused ||
    MaterialStatusBadgeTone.success => AppStatusTone.success,
    MaterialStatusBadgeTone.danger => AppStatusTone.danger,
    MaterialStatusBadgeTone.info => AppStatusTone.info,
    MaterialStatusBadgeTone.draft ||
    MaterialStatusBadgeTone.neutral => AppStatusTone.neutral,
  };
}

/// Maps material lifecycle values to the shared semantic status contract.
MaterialStatusBadgeTone materialLifecycleStatusTone(String status) {
  switch (status) {
    case 'AVAILABLE':
      return MaterialStatusBadgeTone.available;
    case 'PENDING_RESERVATION':
    case 'RESERVED':
      return MaterialStatusBadgeTone.reserved;
    case 'REUSED':
      return MaterialStatusBadgeTone.reused;
    case 'UNAVAILABLE':
      return MaterialStatusBadgeTone.danger;
    case 'DRAFT':
      return MaterialStatusBadgeTone.draft;
    default:
      return MaterialStatusBadgeTone.neutral;
  }
}

class MaterialStatusBadge extends StatelessWidget {
  const MaterialStatusBadge({
    super.key,
    required this.label,
    required this.tone,
  });

  final String label;
  final MaterialStatusBadgeTone tone;

  @override
  Widget build(BuildContext context) =>
      AppStatusBadge(label: label, tone: tone.appStatusTone);
}
