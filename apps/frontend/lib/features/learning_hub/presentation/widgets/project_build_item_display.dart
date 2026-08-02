import 'package:flutter/material.dart';

import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../domain/models/project_build.dart';
import '../l10n/learning_project_build_l10n.dart';
import 'project_build_acquisition_state.dart';

class ProjectBuildItemDisplayMeta {
  const ProjectBuildItemDisplayMeta({
    required this.label,
    required this.icon,
    required this.tone,
  });

  final LocalizedText label;
  final IconData icon;
  final AppStatusTone tone;

  static ProjectBuildItemDisplayMeta forItem(ProjectBuildItem item) {
    if (ProjectBuildAcquisitionState.isAcquiredViaCompletedReservation(item)) {
      return ProjectBuildItemDisplayMeta(
        label: LearningProjectBuildL10n.acquired,
        icon: Icons.check_circle_outline,
        tone: AppStatusTone.success,
      );
    }

    if (item.isReadyForBuild &&
        item.status != ProjectBuildItemStatus.missing) {
      return _checklistStatusMeta(item.status);
    }

    if (item.linkedReservation != null && !item.isReadyForBuild) {
      return ProjectBuildItemDisplayMeta(
        label: LearningProjectBuildL10n.inProgress,
        icon: Icons.lock_clock_rounded,
        tone: AppStatusTone.info,
      );
    }

    return _checklistStatusMeta(item.status);
  }

  static ProjectBuildItemDisplayMeta _checklistStatusMeta(
    ProjectBuildItemStatus status,
  ) {
    return switch (status) {
      ProjectBuildItemStatus.available => ProjectBuildItemDisplayMeta(
        label: const LocalizedText(en: 'Available', ar: 'متوفرة'),
        icon: Icons.inventory_2_outlined,
        tone: AppStatusTone.primary,
      ),
      ProjectBuildItemStatus.missing => ProjectBuildItemDisplayMeta(
        label: const LocalizedText(en: 'Missing', ar: 'مفقودة'),
        icon: Icons.search_off_rounded,
        tone: AppStatusTone.warning,
      ),
      ProjectBuildItemStatus.alternative => ProjectBuildItemDisplayMeta(
        label: const LocalizedText(en: 'Alternative', ar: 'بديل'),
        icon: Icons.swap_horiz_rounded,
        tone: AppStatusTone.primary,
      ),
      ProjectBuildItemStatus.alreadyOwned => ProjectBuildItemDisplayMeta(
        label: const LocalizedText(en: 'Already owned', ar: 'مملوكة مسبقاً'),
        icon: Icons.home_repair_service_outlined,
        tone: AppStatusTone.primary,
      ),
      ProjectBuildItemStatus.reserved => ProjectBuildItemDisplayMeta(
        label: const LocalizedText(en: 'Reserved', ar: 'محجوزة'),
        icon: Icons.lock_clock_rounded,
        tone: AppStatusTone.info,
      ),
    };
  }
}
