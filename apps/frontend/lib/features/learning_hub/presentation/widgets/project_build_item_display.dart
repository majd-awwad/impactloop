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

    if (ProjectBuildAcquisitionState.isAwaitingResolution(item)) {
      return ProjectBuildItemDisplayMeta(
        label: LearningProjectBuildL10n.needsAttention,
        icon: Icons.warning_amber_rounded,
        tone: AppStatusTone.warning,
      );
    }

    if (ProjectBuildAcquisitionState.hasActiveLinkedReservation(item)) {
      return ProjectBuildItemDisplayMeta(
        label: LearningProjectBuildL10n.reserved,
        icon: Icons.lock_clock_rounded,
        tone: AppStatusTone.info,
      );
    }

    if (ProjectBuildAcquisitionState.hasSelectedMaterial(item)) {
      return ProjectBuildItemDisplayMeta(
        label: LearningProjectBuildL10n.selected,
        icon: Icons.check_circle_outline,
        tone: AppStatusTone.primary,
      );
    }

    if (ProjectBuildAcquisitionState.isAlreadyOwnedClassification(item)) {
      return ProjectBuildItemDisplayMeta(
        label: LearningProjectBuildL10n.alreadyOwned,
        icon: Icons.home_repair_service_outlined,
        tone: AppStatusTone.primary,
      );
    }

    if (item.isReadyForBuild) {
      return _checklistStatusMeta(item.status);
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
        label: LearningProjectBuildL10n.alreadyOwned,
        icon: Icons.home_repair_service_outlined,
        tone: AppStatusTone.primary,
      ),
      ProjectBuildItemStatus.reserved => ProjectBuildItemDisplayMeta(
        label: LearningProjectBuildL10n.reserved,
        icon: Icons.lock_clock_rounded,
        tone: AppStatusTone.info,
      ),
    };
  }
}
