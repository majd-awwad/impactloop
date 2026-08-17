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
    this.detail,
  });

  final LocalizedText label;
  final IconData icon;
  final AppStatusTone tone;
  final LocalizedText? detail;

  static ProjectBuildItemDisplayMeta forItem(ProjectBuildItem item) {
    final allocation = item.quantityAllocation;
    final acquisitionState =
        ProjectBuildAcquisitionState.resolveAcquisitionState(item);
    final allocationResult =
        ProjectBuildAcquisitionState.resolveAllocationResult(item);

    if (acquisitionState == 'acquired') {
      if (allocationResult == 'insufficient_quantity') {
        final acquired = allocation?.acquiredQuantity ?? 0;
        final required =
            allocation?.requiredQuantity ?? item.component.quantity;
        return ProjectBuildItemDisplayMeta(
          label: LearningProjectBuildL10n.acquired,
          icon: Icons.check_circle_outline,
          tone: AppStatusTone.success,
          detail: LearningProjectBuildL10n.partiallyAcquiredDetail(
            acquired: acquired,
            required: required,
          ),
        );
      }

      if (allocationResult == 'incompatible_unit') {
        return ProjectBuildItemDisplayMeta(
          label: LearningProjectBuildL10n.acquired,
          icon: Icons.check_circle_outline,
          tone: AppStatusTone.success,
          detail: LearningProjectBuildL10n.acquiredIncompatibleUnit,
        );
      }

      final acquired =
          allocation?.acquiredQuantity ??
          item.linkedReservation?.quantityRequested;
      final required = allocation?.requiredQuantity ?? item.component.quantity;

      return ProjectBuildItemDisplayMeta(
        label: LearningProjectBuildL10n.acquired,
        icon: Icons.check_circle_outline,
        tone: AppStatusTone.success,
        detail: acquired != null
            ? LearningProjectBuildL10n.quantityAcquiredRequired(
                acquired: acquired,
                required: required,
              )
            : null,
      );
    }

    if (acquisitionState == 'needs_attention') {
      return ProjectBuildItemDisplayMeta(
        label: LearningProjectBuildL10n.needsAttention,
        icon: Icons.warning_amber_rounded,
        tone: AppStatusTone.warning,
      );
    }

    if (acquisitionState == 'reserved') {
      return ProjectBuildItemDisplayMeta(
        label: LearningProjectBuildL10n.reserved,
        icon: Icons.lock_clock_rounded,
        tone: AppStatusTone.info,
      );
    }

    if (acquisitionState == 'selected') {
      if (allocationResult == 'insufficient_quantity' ||
          allocationResult == 'incompatible_unit' ||
          allocationResult == 'unknown_quantity') {
        final available = allocation?.availableQuantity;
        final required =
            allocation?.requiredQuantity ?? item.component.quantity;
        return ProjectBuildItemDisplayMeta(
          label: LearningProjectBuildL10n.selected,
          icon: Icons.check_circle_outline,
          tone: AppStatusTone.primary,
          detail:
              allocationResult == 'insufficient_quantity' && available != null
              ? LearningProjectBuildL10n.quantityAvailableRequired(
                  available: available,
                  required: required,
                )
              : allocationResult == 'incompatible_unit'
              ? LearningProjectBuildL10n.incompatibleUnitBody
              : allocation?.warning != null
              ? LocalizedText(
                  en: allocation!.warning!,
                  ar: LearningProjectBuildL10n.needsAttention.ar,
                )
              : null,
        );
      }

      return ProjectBuildItemDisplayMeta(
        label: LearningProjectBuildL10n.selected,
        icon: Icons.check_circle_outline,
        tone: AppStatusTone.primary,
      );
    }

    if (acquisitionState == 'already_owned') {
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
