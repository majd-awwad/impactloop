import 'package:flutter/material.dart';

import '../theme/admin_palette.dart';

/// Visual accent + icon for an admin activity action code.
class AdminActivityVisual {
  const AdminActivityVisual({required this.icon, required this.accent});

  final IconData icon;
  final Color accent;
}

AdminActivityVisual activityVisualForAction(
  String action,
  AdminPalette palette,
) {
  final normalized = action.toUpperCase();

  if (normalized.contains('SUSPEND') ||
      normalized.contains('DISABLE') ||
      normalized.contains('REJECT') ||
      normalized.contains('HIDE') ||
      normalized.contains('UNAVAILABLE')) {
    return AdminActivityVisual(icon: Icons.block_outlined, accent: palette.red);
  }
  if (normalized.contains('INVIT')) {
    return AdminActivityVisual(icon: Icons.mail_outline, accent: palette.blue);
  }
  if (normalized.contains('VERIF') ||
      normalized.contains('APPROV') ||
      normalized.contains('RESTORE')) {
    return AdminActivityVisual(
      icon: Icons.verified_outlined,
      accent: palette.primaryTeal,
    );
  }
  if (normalized.contains('MATERIAL') || normalized.contains('CATEGORY')) {
    return AdminActivityVisual(
      icon: Icons.inventory_2_outlined,
      accent: palette.purple,
    );
  }
  if (normalized.contains('REPORT')) {
    return AdminActivityVisual(
      icon: Icons.flag_outlined,
      accent: palette.amber,
    );
  }
  if (normalized.contains('USER') || normalized.contains('PEOPLE')) {
    return AdminActivityVisual(
      icon: Icons.person_outline,
      accent: palette.blue,
    );
  }

  return AdminActivityVisual(icon: Icons.history, accent: palette.purple);
}

String formatActivityActorLabel(String name, String email) {
  final trimmedName = name.trim();
  if (trimmedName.isNotEmpty && trimmedName != 'Unknown admin') {
    return trimmedName;
  }
  final trimmedEmail = email.trim();
  if (trimmedEmail.isNotEmpty) return trimmedEmail;
  return 'Unknown admin';
}

String formatActivityMetaLine(
  String actorName,
  String actorEmail,
  String targetLabel,
) {
  final actor = formatActivityActorLabel(actorName, actorEmail);
  final target = targetLabel.trim().isEmpty ? '—' : targetLabel.trim();
  return '$actor · $target';
}
