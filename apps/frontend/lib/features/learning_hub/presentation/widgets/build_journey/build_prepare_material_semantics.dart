import 'package:flutter/material.dart';

import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../domain/models/project_build.dart';
import '../../../domain/models/project_material_coverage.dart';
import '../../../domain/project_build_acquisition_state.dart';
import '../../l10n/learning_project_build_l10n.dart';
import '../../l10n/project_build_page_l10n.dart';
import '../build_materials/build_material_card_presentation.dart';
import '../build_materials/build_material_warning_copy.dart';

enum BuildPrepareMaterialGroup { needsAction, inProgress, ready }

enum BuildPrepareCardDensity { prominent, compact, mini }

enum BuildPrepareMaterialKind {
  readyOwned,
  readyAcquired,
  reserved,
  selected,
  alternative,
  needsAttention,
  needsUpdate,
  insufficientQuantity,
  incompatibleUnit,
  matchesAvailable,
  missing,
}

class BuildPrepareMaterialSemantics {
  const BuildPrepareMaterialSemantics({
    required this.item,
    required this.kind,
    required this.group,
    required this.statusLabel,
    required this.subtitle,
    required this.icon,
    required this.tone,
    required this.quantityLabel,
    required this.density,
    required this.filledPrimary,
    required this.menuItems,
    this.primaryAction,
    this.secondaryAction,
  });

  final ProjectBuildItem item;
  final BuildPrepareMaterialKind kind;
  final BuildPrepareMaterialGroup group;
  final LocalizedText statusLabel;
  final LocalizedText subtitle;
  final IconData icon;
  final AppStatusTone tone;
  final LocalizedText quantityLabel;
  final BuildPrepareCardDensity density;
  final bool filledPrimary;
  final List<BuildMaterialCardAction> menuItems;
  final BuildMaterialCardAction? primaryAction;
  final BuildMaterialCardAction? secondaryAction;

  factory BuildPrepareMaterialSemantics.fromItem(
    ProjectBuildItem item, {
    required bool isEditingLocked,
  }) {
    final presentation = BuildMaterialCardPresentation.fromItem(
      item,
      isEditingLocked: isEditingLocked,
    );
    final kind = resolveKind(item);
    final group = groupFor(kind, item);
    final copy = _copyFor(item, kind);
    final density = densityFor(kind, item);
    final primary = isEditingLocked
        ? null
        : _primaryActionFor(item: item, kind: kind, presentation: presentation);
    final secondaryRaw = _secondaryActionFor(item: item, kind: kind);
    final secondary = isEditingLocked &&
            secondaryRaw?.kind != BuildMaterialActionKind.viewMaterial
        ? null
        : secondaryRaw;
    final menu = _menuItemsFor(
      kind: kind,
      item: item,
      source: presentation.menuItems,
    ).where((action) {
      return action.kind != primary?.kind && action.kind != secondary?.kind;
    }).toList();

    return BuildPrepareMaterialSemantics(
      item: item,
      kind: kind,
      group: group,
      statusLabel: copy.statusLabel,
      subtitle: copy.subtitle,
      icon: copy.icon,
      tone: copy.tone,
      quantityLabel: presentation.quantityLabel,
      density: density,
      filledPrimary: _filledPrimaryFor(kind),
      menuItems: menu,
      primaryAction: primary,
      secondaryAction: secondary,
    );
  }

  static BuildPrepareCardDensity densityFor(
    BuildPrepareMaterialKind kind,
    ProjectBuildItem item,
  ) {
    return switch (kind) {
      BuildPrepareMaterialKind.readyOwned ||
      BuildPrepareMaterialKind.readyAcquired => BuildPrepareCardDensity.mini,
      BuildPrepareMaterialKind.reserved ||
      BuildPrepareMaterialKind.selected => BuildPrepareCardDensity.compact,
      BuildPrepareMaterialKind.alternative =>
        item.linkedMaterial != null
            ? BuildPrepareCardDensity.compact
            : BuildPrepareCardDensity.prominent,
      BuildPrepareMaterialKind.needsAttention ||
      BuildPrepareMaterialKind.needsUpdate ||
      BuildPrepareMaterialKind.insufficientQuantity ||
      BuildPrepareMaterialKind.incompatibleUnit ||
      BuildPrepareMaterialKind.matchesAvailable ||
      BuildPrepareMaterialKind.missing => BuildPrepareCardDensity.prominent,
    };
  }

  static BuildPrepareMaterialKind resolveKind(ProjectBuildItem item) {
    if (item.isReadyForBuild) {
      if (ProjectBuildAcquisitionState.isAlreadyOwnedClassification(item) ||
          item.status == ProjectBuildItemStatus.alreadyOwned) {
        return BuildPrepareMaterialKind.readyOwned;
      }
      return BuildPrepareMaterialKind.readyAcquired;
    }

    final allocationResult =
        ProjectBuildAcquisitionState.resolveAllocationResult(item);
    final hasLinkedMaterial = item.linkedMaterial != null;
    final hasActiveReservation =
        ProjectBuildAcquisitionState.hasActiveLinkedReservation(item);
    final reservationNeedsAction = item.linkedReservation?.needsAction == true;
    final awaitingResolution =
        ProjectBuildAcquisitionState.isAwaitingResolution(item) ||
        item.linkedReservation?.status.toUpperCase() == 'AWAITING_RESOLUTION';

    if (allocationResult == 'incompatible_unit' ||
        BuildMaterialWarningCopy.looksLikeIncompatibleUnit(
          item.quantityAllocation?.warning,
        )) {
      return BuildPrepareMaterialKind.incompatibleUnit;
    }

    if (allocationResult == 'insufficient_quantity') {
      return BuildPrepareMaterialKind.insufficientQuantity;
    }

    if (awaitingResolution || reservationNeedsAction) {
      return BuildPrepareMaterialKind.needsAttention;
    }

    if (hasActiveReservation) {
      return BuildPrepareMaterialKind.reserved;
    }

    if (hasLinkedMaterial) {
      if (item.status == ProjectBuildItemStatus.alternative) {
        return BuildPrepareMaterialKind.alternative;
      }
      return BuildPrepareMaterialKind.selected;
    }

    // ALREADY_OWNED is ready on the backend when the payload is consistent.
    // A not-ready owned item with no link is transitional/inconsistent — do
    // not present it as Missing or Ready.
    if (ProjectBuildAcquisitionState.isAlreadyOwnedClassification(item) ||
        item.status == ProjectBuildItemStatus.alreadyOwned) {
      return BuildPrepareMaterialKind.needsUpdate;
    }

    if (item.status == ProjectBuildItemStatus.alternative) {
      return BuildPrepareMaterialKind.alternative;
    }

    if (item.status == ProjectBuildItemStatus.available ||
        item.component.publicAvailabilityStatus ==
            ComponentPublicAvailabilityStatus.available ||
        item.component.publicAvailabilityStatus ==
            ComponentPublicAvailabilityStatus.partial) {
      return BuildPrepareMaterialKind.matchesAvailable;
    }

    return BuildPrepareMaterialKind.missing;
  }

  static BuildPrepareMaterialGroup groupFor(
    BuildPrepareMaterialKind kind,
    ProjectBuildItem item,
  ) {
    return switch (kind) {
      BuildPrepareMaterialKind.readyOwned ||
      BuildPrepareMaterialKind.readyAcquired => BuildPrepareMaterialGroup.ready,
      BuildPrepareMaterialKind.reserved ||
      BuildPrepareMaterialKind.selected => BuildPrepareMaterialGroup.inProgress,
      BuildPrepareMaterialKind.alternative =>
        item.linkedMaterial != null
            ? BuildPrepareMaterialGroup.inProgress
            : BuildPrepareMaterialGroup.needsAction,
      BuildPrepareMaterialKind.needsAttention ||
      BuildPrepareMaterialKind.needsUpdate ||
      BuildPrepareMaterialKind.insufficientQuantity ||
      BuildPrepareMaterialKind.incompatibleUnit ||
      BuildPrepareMaterialKind.matchesAvailable ||
      BuildPrepareMaterialKind.missing => BuildPrepareMaterialGroup.needsAction,
    };
  }

  static List<ProjectBuildItem> itemsInGroup(
    List<ProjectBuildItem> items,
    BuildPrepareMaterialGroup group,
  ) {
    return items
        .where((item) => groupFor(resolveKind(item), item) == group)
        .toList(growable: false);
  }
}

class _PrepareCopy {
  const _PrepareCopy({
    required this.statusLabel,
    required this.subtitle,
    required this.icon,
    required this.tone,
  });

  final LocalizedText statusLabel;
  final LocalizedText subtitle;
  final IconData icon;
  final AppStatusTone tone;
}

_PrepareCopy _copyFor(ProjectBuildItem item, BuildPrepareMaterialKind kind) {
  final allocationDetail = BuildMaterialWarningCopy.allocationDetail(item);

  return switch (kind) {
    BuildPrepareMaterialKind.readyOwned ||
    BuildPrepareMaterialKind.readyAcquired => const _PrepareCopy(
      statusLabel: ProjectBuildPageL10n.prepareReadyStatus,
      subtitle: ProjectBuildPageL10n.readyOnHandForUse,
      icon: Icons.check_rounded,
      tone: AppStatusTone.success,
    ),
    BuildPrepareMaterialKind.reserved => const _PrepareCopy(
      statusLabel: ProjectBuildPageL10n.prepareInProgressStatus,
      subtitle: ProjectBuildPageL10n.reservedMaterialBody,
      icon: Icons.schedule_rounded,
      tone: AppStatusTone.info,
    ),
    BuildPrepareMaterialKind.selected => const _PrepareCopy(
      statusLabel: ProjectBuildPageL10n.prepareSelectedStatus,
      subtitle: ProjectBuildPageL10n.selectedMaterialBody,
      icon: Icons.schedule_rounded,
      tone: AppStatusTone.info,
    ),
    BuildPrepareMaterialKind.alternative => const _PrepareCopy(
      statusLabel: ProjectBuildPageL10n.prepareAlternativeStatus,
      subtitle: LearningProjectBuildL10n.alternativeDescription,
      icon: Icons.swap_horiz_rounded,
      tone: AppStatusTone.primary,
    ),
    BuildPrepareMaterialKind.needsAttention => _PrepareCopy(
      statusLabel: ProjectBuildPageL10n.prepareNeedsActionStatus,
      subtitle:
          allocationDetail ??
          LearningProjectBuildL10n.reservationRequiresResolution,
      icon: Icons.priority_high_rounded,
      tone: AppStatusTone.danger,
    ),
    BuildPrepareMaterialKind.needsUpdate => const _PrepareCopy(
      statusLabel: ProjectBuildPageL10n.prepareNeedsUpdateStatus,
      subtitle: ProjectBuildPageL10n.ownedNeedsUpdateBody,
      icon: Icons.sync_problem_rounded,
      tone: AppStatusTone.warning,
    ),
    BuildPrepareMaterialKind.insufficientQuantity => _PrepareCopy(
      statusLabel: LearningProjectBuildL10n.insufficientQuantity,
      subtitle:
          allocationDetail ?? LearningProjectBuildL10n.insufficientQuantity,
      icon: Icons.priority_high_rounded,
      tone: AppStatusTone.danger,
    ),
    BuildPrepareMaterialKind.incompatibleUnit => _PrepareCopy(
      statusLabel: LearningProjectBuildL10n.incompatibleUnitTitle,
      subtitle:
          allocationDetail ?? LearningProjectBuildL10n.incompatibleUnitBody,
      icon: Icons.priority_high_rounded,
      tone: AppStatusTone.danger,
    ),
    BuildPrepareMaterialKind.matchesAvailable => const _PrepareCopy(
      statusLabel: ProjectBuildPageL10n.prepareOptionsStatus,
      subtitle: ProjectBuildPageL10n.matchesFound,
      icon: Icons.search_rounded,
      tone: AppStatusTone.warning,
    ),
    BuildPrepareMaterialKind.missing => const _PrepareCopy(
      statusLabel: ProjectBuildPageL10n.prepareMissingStatus,
      subtitle: ProjectBuildPageL10n.noMaterialChosen,
      icon: Icons.search_rounded,
      tone: AppStatusTone.warning,
    ),
  };
}

bool _filledPrimaryFor(BuildPrepareMaterialKind kind) {
  return switch (kind) {
    BuildPrepareMaterialKind.missing ||
    BuildPrepareMaterialKind.matchesAvailable ||
    BuildPrepareMaterialKind.selected ||
    BuildPrepareMaterialKind.alternative ||
    BuildPrepareMaterialKind.needsAttention ||
    BuildPrepareMaterialKind.needsUpdate ||
    BuildPrepareMaterialKind.insufficientQuantity ||
    BuildPrepareMaterialKind.incompatibleUnit => true,
    BuildPrepareMaterialKind.reserved ||
    BuildPrepareMaterialKind.readyOwned ||
    BuildPrepareMaterialKind.readyAcquired => false,
  };
}

BuildMaterialCardAction? _primaryActionFor({
  required ProjectBuildItem item,
  required BuildPrepareMaterialKind kind,
  required BuildMaterialCardPresentation presentation,
}) {
  BuildMaterialCardAction action({
    required BuildMaterialActionKind actionKind,
    required LocalizedText label,
    required IconData icon,
    bool outlined = false,
  }) {
    return BuildMaterialCardAction(
      kind: actionKind,
      label: label,
      icon: icon,
      outlined: outlined,
    );
  }

  switch (kind) {
    case BuildPrepareMaterialKind.readyOwned:
    case BuildPrepareMaterialKind.readyAcquired:
      return null;
    case BuildPrepareMaterialKind.reserved:
      return action(
        actionKind: BuildMaterialActionKind.viewReservation,
        label: LearningProjectBuildL10n.viewReservation,
        icon: Icons.calendar_today_outlined,
        outlined: true,
      );
    case BuildPrepareMaterialKind.selected:
      return action(
        actionKind: BuildMaterialActionKind.reserve,
        label: LearningProjectBuildL10n.reserveThisMaterial,
        icon: Icons.event_available_outlined,
      );
    case BuildPrepareMaterialKind.alternative:
      return presentation.primary;
    case BuildPrepareMaterialKind.needsUpdate:
      return action(
        actionKind: BuildMaterialActionKind.changeStatus,
        label: LearningProjectBuildL10n.changeStatus,
        icon: Icons.tune_rounded,
      );
    case BuildPrepareMaterialKind.needsAttention:
      if (item.linkedReservation != null) {
        return action(
          actionKind: BuildMaterialActionKind.viewReservation,
          label: ProjectBuildPageL10n.fixIssue,
          icon: Icons.priority_high_rounded,
        );
      }
      return action(
        actionKind: BuildMaterialActionKind.browseMatching,
        label: ProjectBuildPageL10n.fixIssue,
        icon: Icons.priority_high_rounded,
      );
    case BuildPrepareMaterialKind.insufficientQuantity:
      return action(
        actionKind: item.linkedMaterial != null
            ? BuildMaterialActionKind.browseMatching
            : BuildMaterialActionKind.findMatching,
        label: ProjectBuildPageL10n.fixIssue,
        icon: Icons.priority_high_rounded,
      );
    case BuildPrepareMaterialKind.incompatibleUnit:
      return action(
        actionKind: item.linkedMaterial != null
            ? BuildMaterialActionKind.useAnother
            : BuildMaterialActionKind.findMatching,
        label: ProjectBuildPageL10n.chooseAnotherMaterial,
        icon: Icons.swap_horiz_rounded,
      );
    case BuildPrepareMaterialKind.matchesAvailable:
      return action(
        actionKind: BuildMaterialActionKind.browseMatching,
        label: ProjectBuildPageL10n.viewOptions,
        icon: Icons.search_rounded,
      );
    case BuildPrepareMaterialKind.missing:
      return action(
        actionKind: BuildMaterialActionKind.findMatching,
        label: LearningProjectBuildL10n.findMatchingMaterial,
        icon: Icons.search_rounded,
      );
  }
}

BuildMaterialCardAction? _secondaryActionFor({
  required ProjectBuildItem item,
  required BuildPrepareMaterialKind kind,
}) {
  switch (kind) {
    case BuildPrepareMaterialKind.missing:
    case BuildPrepareMaterialKind.matchesAvailable:
      return const BuildMaterialCardAction(
        kind: BuildMaterialActionKind.iHaveThis,
        label: LearningProjectBuildL10n.iHaveThisComponent,
        icon: Icons.home_repair_service_outlined,
      );
    case BuildPrepareMaterialKind.selected:
      if (item.linkedMaterial == null) {
        return null;
      }
      return const BuildMaterialCardAction(
        kind: BuildMaterialActionKind.viewMaterial,
        label: LearningProjectBuildL10n.viewMaterial,
        icon: Icons.open_in_new_rounded,
        outlined: true,
      );
    case BuildPrepareMaterialKind.readyOwned:
    case BuildPrepareMaterialKind.readyAcquired:
      if (item.linkedMaterial == null) {
        return null;
      }
      return const BuildMaterialCardAction(
        kind: BuildMaterialActionKind.viewMaterial,
        label: LearningProjectBuildL10n.viewMaterial,
        icon: Icons.open_in_new_rounded,
        outlined: true,
      );
    case BuildPrepareMaterialKind.needsUpdate:
      return const BuildMaterialCardAction(
        kind: BuildMaterialActionKind.iHaveThis,
        label: LearningProjectBuildL10n.iHaveThisComponent,
        icon: Icons.home_repair_service_outlined,
      );
    case BuildPrepareMaterialKind.reserved:
    case BuildPrepareMaterialKind.alternative:
    case BuildPrepareMaterialKind.needsAttention:
    case BuildPrepareMaterialKind.insufficientQuantity:
    case BuildPrepareMaterialKind.incompatibleUnit:
      return null;
  }
}

List<BuildMaterialCardAction> _menuItemsFor({
  required BuildPrepareMaterialKind kind,
  required ProjectBuildItem item,
  required List<BuildMaterialCardAction> source,
}) {
  final allowed = switch (kind) {
    BuildPrepareMaterialKind.reserved => const {
      BuildMaterialActionKind.viewReservation,
      BuildMaterialActionKind.viewMaterial,
      BuildMaterialActionKind.unlink,
      BuildMaterialActionKind.changeStatus,
      BuildMaterialActionKind.editNote,
    },
    BuildPrepareMaterialKind.readyOwned ||
    BuildPrepareMaterialKind.readyAcquired => const {
      BuildMaterialActionKind.viewMaterial,
      BuildMaterialActionKind.changeStatus,
      BuildMaterialActionKind.editNote,
      BuildMaterialActionKind.removeFromComponent,
      BuildMaterialActionKind.useAnother,
      BuildMaterialActionKind.unlink,
    },
    BuildPrepareMaterialKind.selected => const {
      BuildMaterialActionKind.viewMaterial,
      BuildMaterialActionKind.reserve,
      BuildMaterialActionKind.unlink,
      BuildMaterialActionKind.browseMatching,
      BuildMaterialActionKind.changeStatus,
      BuildMaterialActionKind.editNote,
    },
    BuildPrepareMaterialKind.alternative => const {
      BuildMaterialActionKind.viewAlternative,
      BuildMaterialActionKind.changeAlternative,
      BuildMaterialActionKind.viewMaterial,
      BuildMaterialActionKind.browseMatching,
      BuildMaterialActionKind.changeStatus,
      BuildMaterialActionKind.editNote,
      BuildMaterialActionKind.unlink,
    },
    BuildPrepareMaterialKind.needsUpdate => const {
      BuildMaterialActionKind.changeStatus,
      BuildMaterialActionKind.iHaveThis,
      BuildMaterialActionKind.editNote,
      BuildMaterialActionKind.findMatching,
      BuildMaterialActionKind.browseMatching,
      BuildMaterialActionKind.browseAll,
    },
    BuildPrepareMaterialKind.needsAttention ||
    BuildPrepareMaterialKind.insufficientQuantity ||
    BuildPrepareMaterialKind.incompatibleUnit => const {
      BuildMaterialActionKind.viewReservation,
      BuildMaterialActionKind.viewMaterial,
      BuildMaterialActionKind.browseMatching,
      BuildMaterialActionKind.unlink,
      BuildMaterialActionKind.changeStatus,
      BuildMaterialActionKind.editNote,
      BuildMaterialActionKind.useAnother,
      BuildMaterialActionKind.removeFromComponent,
    },
    BuildPrepareMaterialKind.matchesAvailable => const {
      BuildMaterialActionKind.browseMatching,
      BuildMaterialActionKind.browseAll,
      BuildMaterialActionKind.findMatching,
      BuildMaterialActionKind.requestComponent,
      BuildMaterialActionKind.iHaveThis,
      BuildMaterialActionKind.useAlternative,
      BuildMaterialActionKind.changeStatus,
      BuildMaterialActionKind.editNote,
    },
    BuildPrepareMaterialKind.missing => const {
      BuildMaterialActionKind.findMatching,
      BuildMaterialActionKind.browseMatching,
      BuildMaterialActionKind.browseAll,
      BuildMaterialActionKind.requestComponent,
      BuildMaterialActionKind.iHaveThis,
      BuildMaterialActionKind.useAlternative,
      BuildMaterialActionKind.changeStatus,
      BuildMaterialActionKind.editNote,
    },
  };

  return source.where((action) => allowed.contains(action.kind)).toList();
}
