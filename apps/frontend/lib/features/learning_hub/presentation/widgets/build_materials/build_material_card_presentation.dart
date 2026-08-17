import 'package:flutter/material.dart';

import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../domain/models/project_build.dart';
import '../../../domain/project_build_acquisition_state.dart';
import '../../l10n/learning_project_build_l10n.dart';
import '../project_build_item_display.dart';
import 'build_material_warning_copy.dart';

enum BuildMaterialActionKind {
  findMatching,
  browseMatching,
  browseAll,
  iHaveThis,
  requestComponent,
  useAlternative,
  changeStatus,
  viewReservation,
  viewMaterial,
  viewAlternative,
  changeAlternative,
  reserve,
  unlink,
  removeFromComponent,
  useAnother,
  editNote,
}

class BuildMaterialCardAction {
  const BuildMaterialCardAction({
    required this.kind,
    required this.label,
    required this.icon,
    this.outlined = false,
  });

  final BuildMaterialActionKind kind;
  final LocalizedText label;
  final IconData icon;
  final bool outlined;
}

class BuildMaterialCardPresentation {
  const BuildMaterialCardPresentation({
    required this.badgeLabel,
    required this.badgeIcon,
    required this.badgeTone,
    required this.description,
    required this.quantityLabel,
    this.primary,
    this.secondary,
    this.menuItems = const [],
    this.warningDescription = false,
    this.learnerNote,
  });

  final LocalizedText badgeLabel;
  final IconData badgeIcon;
  final AppStatusTone badgeTone;
  final LocalizedText description;
  final LocalizedText quantityLabel;
  final BuildMaterialCardAction? primary;
  final BuildMaterialCardAction? secondary;
  final List<BuildMaterialCardAction> menuItems;
  final bool warningDescription;
  final String? learnerNote;

  factory BuildMaterialCardPresentation.fromItem(
    ProjectBuildItem item, {
    required bool isEditingLocked,
  }) {
    final displayMeta = ProjectBuildItemDisplayMeta.forItem(item);
    final acquisitionState =
        ProjectBuildAcquisitionState.resolveAcquisitionState(item);
    final canMutate = !isEditingLocked;
    final hasLinkedMaterial = item.linkedMaterial != null;
    final hasReservation = item.linkedReservation != null;
    final isAcquired = ProjectBuildAcquisitionState.isAcquired(item);
    final isAwaitingResolution =
        ProjectBuildAcquisitionState.isAwaitingResolution(item);
    final hasSelectedMaterial =
        ProjectBuildAcquisitionState.hasSelectedMaterial(item);
    final canRemoveAcquired =
        ProjectBuildAcquisitionState.canRemoveAcquiredAllocation(item);

    final badge = _badgeFor(
      item: item,
      displayMeta: displayMeta,
      acquisitionState: acquisitionState,
    );
    final description = _descriptionFor(
      item: item,
      displayMeta: displayMeta,
      acquisitionState: acquisitionState,
      isAwaitingResolution: isAwaitingResolution,
      hasSelectedMaterial: hasSelectedMaterial,
    );
    final linkedMaterial = item.linkedMaterial;
    final warningDescription =
        isAwaitingResolution ||
        ProjectBuildAcquisitionState.hasInsufficientQuantity(item) ||
        ProjectBuildAcquisitionState.hasIncompatibleAcquiredAllocation(item) ||
        (linkedMaterial != null &&
            ProjectBuildAcquisitionState.shouldShowAvailabilityWarning(
              material: linkedMaterial,
              linkedReservation: item.linkedReservation,
            ));

    final primary = _primaryFor(
      item: item,
      canMutate: canMutate,
      acquisitionState: acquisitionState,
      hasLinkedMaterial: hasLinkedMaterial,
      hasReservation: hasReservation,
      isAcquired: isAcquired,
      isAwaitingResolution: isAwaitingResolution,
      hasSelectedMaterial: hasSelectedMaterial,
    );
    final secondary = _secondaryFor(
      item: item,
      canMutate: canMutate,
      acquisitionState: acquisitionState,
      hasLinkedMaterial: hasLinkedMaterial,
      primary: primary,
    );

    return BuildMaterialCardPresentation(
      badgeLabel: badge.label,
      badgeIcon: badge.icon,
      badgeTone: badge.tone,
      description: description,
      quantityLabel: LearningProjectBuildL10n.quantityWithLocalizedUnit(
        quantity: item.component.quantity,
        unit: item.component.unit,
      ),
      primary: primary,
      secondary: secondary,
      menuItems: _menuItemsFor(
        item: item,
        canMutate: canMutate,
        hasLinkedMaterial: hasLinkedMaterial,
        isAcquired: isAcquired,
        canRemoveAcquired: canRemoveAcquired,
        hasSelectedMaterial: hasSelectedMaterial,
        primary: primary,
        secondary: secondary,
      ),
      warningDescription: warningDescription,
      learnerNote: item.learnerNote?.trim().isEmpty == true
          ? null
          : item.learnerNote,
    );
  }
}

class _BadgeCopy {
  const _BadgeCopy({
    required this.label,
    required this.icon,
    required this.tone,
  });

  final LocalizedText label;
  final IconData icon;
  final AppStatusTone tone;
}

_BadgeCopy _badgeFor({
  required ProjectBuildItem item,
  required ProjectBuildItemDisplayMeta displayMeta,
  required String acquisitionState,
}) {
  final compact = switch (acquisitionState) {
    'acquired' => _BadgeCopy(
      label: LearningProjectBuildL10n.acquired,
      icon: Icons.check_circle_outline,
      tone: AppStatusTone.success,
    ),
    'needs_attention' => _BadgeCopy(
      label: LearningProjectBuildL10n.needsAttention,
      icon: Icons.warning_amber_rounded,
      tone: AppStatusTone.warning,
    ),
    'reserved' => _BadgeCopy(
      label: LearningProjectBuildL10n.compactReserved,
      icon: Icons.bookmark_rounded,
      tone: AppStatusTone.primary,
    ),
    'selected' => _BadgeCopy(
      label: LearningProjectBuildL10n.compactAvailable,
      icon: Icons.inventory_2_outlined,
      tone: AppStatusTone.primary,
    ),
    'already_owned' => _BadgeCopy(
      label: LearningProjectBuildL10n.compactOwned,
      icon: Icons.home_repair_service_outlined,
      tone: AppStatusTone.primary,
    ),
    _ => switch (item.status) {
      ProjectBuildItemStatus.available => _BadgeCopy(
        label: LearningProjectBuildL10n.compactAvailable,
        icon: Icons.check_rounded,
        tone: AppStatusTone.primary,
      ),
      ProjectBuildItemStatus.alternative => _BadgeCopy(
        label: LearningProjectBuildL10n.compactAlternative,
        icon: Icons.swap_horiz_rounded,
        tone: AppStatusTone.primary,
      ),
      ProjectBuildItemStatus.alreadyOwned => _BadgeCopy(
        label: LearningProjectBuildL10n.compactOwned,
        icon: Icons.home_repair_service_outlined,
        tone: AppStatusTone.primary,
      ),
      ProjectBuildItemStatus.reserved => _BadgeCopy(
        label: LearningProjectBuildL10n.compactReserved,
        icon: Icons.bookmark_rounded,
        tone: AppStatusTone.primary,
      ),
      ProjectBuildItemStatus.missing => _BadgeCopy(
        label: LearningProjectBuildL10n.compactMissing,
        icon: Icons.search_rounded,
        tone: AppStatusTone.warning,
      ),
    },
  };

  return _BadgeCopy(
    label: compact.label,
    icon: compact.icon,
    tone: displayMeta.tone == AppStatusTone.info
        ? compact.tone
        : displayMeta.tone == AppStatusTone.success ||
              displayMeta.tone == AppStatusTone.warning
        ? displayMeta.tone
        : compact.tone,
  );
}

LocalizedText _descriptionFor({
  required ProjectBuildItem item,
  required ProjectBuildItemDisplayMeta displayMeta,
  required String acquisitionState,
  required bool isAwaitingResolution,
  required bool hasSelectedMaterial,
}) {
  final warning = item.linkedMaterial?.availabilityWarning?.trim();
  if (warning != null &&
      warning.isNotEmpty &&
      ProjectBuildAcquisitionState.shouldShowAvailabilityWarning(
        material: item.linkedMaterial!,
        linkedReservation: item.linkedReservation,
      )) {
    return BuildMaterialWarningCopy.localizeRaw(warning);
  }

  final allocationDetail = BuildMaterialWarningCopy.allocationDetail(item);
  if (allocationDetail != null &&
      (ProjectBuildAcquisitionState.hasInsufficientQuantity(item) ||
          ProjectBuildAcquisitionState.hasIncompatibleAcquiredAllocation(
            item,
          ) ||
          ProjectBuildAcquisitionState.resolveAllocationResult(item) ==
              'incompatible_unit' ||
          ProjectBuildAcquisitionState.resolveAllocationResult(item) ==
              'insufficient_quantity')) {
    return allocationDetail;
  }

  if (displayMeta.detail != null) {
    return displayMeta.detail!;
  }

  if (isAwaitingResolution) {
    return LearningProjectBuildL10n.reservationRequiresResolution;
  }

  if (hasSelectedMaterial) {
    return LearningProjectBuildL10n.availableDescription;
  }

  return switch (acquisitionState) {
    'acquired' => LearningProjectBuildL10n.ownedDescription,
    'reserved' => LearningProjectBuildL10n.reservedDescription,
    'already_owned' => LearningProjectBuildL10n.ownedDescription,
    _ => switch (item.status) {
      ProjectBuildItemStatus.available =>
        LearningProjectBuildL10n.availableDescription,
      ProjectBuildItemStatus.alternative =>
        LearningProjectBuildL10n.alternativeDescription,
      ProjectBuildItemStatus.alreadyOwned =>
        LearningProjectBuildL10n.ownedDescription,
      ProjectBuildItemStatus.reserved =>
        LearningProjectBuildL10n.reservedDescription,
      ProjectBuildItemStatus.missing =>
        LearningProjectBuildL10n.missingDescription,
    },
  };
}

BuildMaterialCardAction? _primaryFor({
  required ProjectBuildItem item,
  required bool canMutate,
  required String acquisitionState,
  required bool hasLinkedMaterial,
  required bool hasReservation,
  required bool isAcquired,
  required bool isAwaitingResolution,
  required bool hasSelectedMaterial,
}) {
  if (isAwaitingResolution || acquisitionState == 'reserved') {
    return const BuildMaterialCardAction(
      kind: BuildMaterialActionKind.viewReservation,
      label: LearningProjectBuildL10n.viewReservation,
      icon: Icons.calendar_today_outlined,
      outlined: true,
    );
  }

  if (isAcquired) {
    return const BuildMaterialCardAction(
      kind: BuildMaterialActionKind.viewMaterial,
      label: LearningProjectBuildL10n.viewMaterial,
      icon: Icons.open_in_new_rounded,
      outlined: true,
    );
  }

  if (hasSelectedMaterial) {
    if (!canMutate) {
      return const BuildMaterialCardAction(
        kind: BuildMaterialActionKind.viewMaterial,
        label: LearningProjectBuildL10n.viewMaterial,
        icon: Icons.open_in_new_rounded,
        outlined: true,
      );
    }
    return const BuildMaterialCardAction(
      kind: BuildMaterialActionKind.reserve,
      label: LearningProjectBuildL10n.reserveThisMaterial,
      icon: Icons.event_available_outlined,
    );
  }

  if (!canMutate) {
    if (hasReservation) {
      return const BuildMaterialCardAction(
        kind: BuildMaterialActionKind.viewReservation,
        label: LearningProjectBuildL10n.viewReservation,
        icon: Icons.calendar_today_outlined,
        outlined: true,
      );
    }
    if (hasLinkedMaterial) {
      return const BuildMaterialCardAction(
        kind: BuildMaterialActionKind.viewMaterial,
        label: LearningProjectBuildL10n.viewMaterial,
        icon: Icons.open_in_new_rounded,
        outlined: true,
      );
    }
    return null;
  }

  return switch (item.status) {
    ProjectBuildItemStatus.missing => const BuildMaterialCardAction(
      kind: BuildMaterialActionKind.findMatching,
      label: LearningProjectBuildL10n.findMatchingMaterial,
      icon: Icons.search_rounded,
    ),
    ProjectBuildItemStatus.available => const BuildMaterialCardAction(
      kind: BuildMaterialActionKind.browseMatching,
      label: LearningProjectBuildL10n.browseMatchingMaterials,
      icon: Icons.inventory_2_outlined,
    ),
    ProjectBuildItemStatus.alreadyOwned => null,
    ProjectBuildItemStatus.alternative => BuildMaterialCardAction(
      kind: hasLinkedMaterial
          ? BuildMaterialActionKind.viewAlternative
          : BuildMaterialActionKind.changeAlternative,
      label: hasLinkedMaterial
          ? LearningProjectBuildL10n.viewAlternative
          : LearningProjectBuildL10n.changeAlternative,
      icon: hasLinkedMaterial
          ? Icons.open_in_new_rounded
          : Icons.swap_horiz_rounded,
    ),
    ProjectBuildItemStatus.reserved => const BuildMaterialCardAction(
      kind: BuildMaterialActionKind.viewReservation,
      label: LearningProjectBuildL10n.viewReservation,
      icon: Icons.calendar_today_outlined,
      outlined: true,
    ),
  };
}

BuildMaterialCardAction? _secondaryFor({
  required ProjectBuildItem item,
  required bool canMutate,
  required String acquisitionState,
  required bool hasLinkedMaterial,
  required BuildMaterialCardAction? primary,
}) {
  if (!canMutate) {
    return null;
  }

  BuildMaterialCardAction? action;
  if (acquisitionState == 'reserved' ||
      item.status == ProjectBuildItemStatus.reserved) {
    action = const BuildMaterialCardAction(
      kind: BuildMaterialActionKind.changeStatus,
      label: LearningProjectBuildL10n.changeStatus,
      icon: Icons.swap_horiz_rounded,
    );
  } else if (hasLinkedMaterial &&
      primary?.kind == BuildMaterialActionKind.reserve) {
    action = const BuildMaterialCardAction(
      kind: BuildMaterialActionKind.browseMatching,
      label: LearningProjectBuildL10n.browseMatchingMaterials,
      icon: Icons.inventory_2_outlined,
    );
  } else {
    action = switch (item.status) {
      ProjectBuildItemStatus.missing => const BuildMaterialCardAction(
        kind: BuildMaterialActionKind.iHaveThis,
        label: LearningProjectBuildL10n.iHaveThisComponent,
        icon: Icons.home_repair_service_outlined,
      ),
      ProjectBuildItemStatus.available => const BuildMaterialCardAction(
        kind: BuildMaterialActionKind.browseAll,
        label: LearningProjectBuildL10n.viewAllMaterials,
        icon: Icons.travel_explore_rounded,
      ),
      ProjectBuildItemStatus.alreadyOwned => null,
      ProjectBuildItemStatus.alternative => const BuildMaterialCardAction(
        kind: BuildMaterialActionKind.changeStatus,
        label: LearningProjectBuildL10n.changeStatus,
        icon: Icons.swap_horiz_rounded,
      ),
      ProjectBuildItemStatus.reserved => const BuildMaterialCardAction(
        kind: BuildMaterialActionKind.changeStatus,
        label: LearningProjectBuildL10n.changeStatus,
        icon: Icons.swap_horiz_rounded,
      ),
    };
  }

  if (action == null || action.kind == primary?.kind) {
    return null;
  }
  return action;
}

List<BuildMaterialCardAction> _menuItemsFor({
  required ProjectBuildItem item,
  required bool canMutate,
  required bool hasLinkedMaterial,
  required bool isAcquired,
  required bool canRemoveAcquired,
  required bool hasSelectedMaterial,
  required BuildMaterialCardAction? primary,
  required BuildMaterialCardAction? secondary,
}) {
  final used = <BuildMaterialActionKind>{
    if (primary != null) primary.kind,
    if (secondary != null) secondary.kind,
  };
  if (used.contains(BuildMaterialActionKind.findMatching) ||
      used.contains(BuildMaterialActionKind.browseMatching) ||
      used.contains(BuildMaterialActionKind.changeAlternative)) {
    used.addAll({
      BuildMaterialActionKind.findMatching,
      BuildMaterialActionKind.browseMatching,
      BuildMaterialActionKind.changeAlternative,
    });
  }
  final items = <BuildMaterialCardAction>[];

  void add(BuildMaterialCardAction action) {
    if (used.contains(action.kind)) {
      return;
    }
    used.add(action.kind);
    items.add(action);
  }

  if (hasLinkedMaterial) {
    add(
      const BuildMaterialCardAction(
        kind: BuildMaterialActionKind.viewMaterial,
        label: LearningProjectBuildL10n.viewMaterial,
        icon: Icons.open_in_new_rounded,
      ),
    );
  }

  if (canMutate) {
    add(
      const BuildMaterialCardAction(
        kind: BuildMaterialActionKind.browseAll,
        label: LearningProjectBuildL10n.viewAllMaterials,
        icon: Icons.travel_explore_rounded,
      ),
    );
    add(
      const BuildMaterialCardAction(
        kind: BuildMaterialActionKind.browseMatching,
        label: LearningProjectBuildL10n.browseMatchingMaterials,
        icon: Icons.inventory_2_outlined,
      ),
    );

    if (item.status == ProjectBuildItemStatus.missing) {
      add(
        const BuildMaterialCardAction(
          kind: BuildMaterialActionKind.requestComponent,
          label: LearningProjectBuildL10n.requestThisComponent,
          icon: Icons.campaign_outlined,
        ),
      );
      add(
        const BuildMaterialCardAction(
          kind: BuildMaterialActionKind.useAlternative,
          label: LearningProjectBuildL10n.useAlternative,
          icon: Icons.swap_horiz_rounded,
        ),
      );
    }

    add(
      const BuildMaterialCardAction(
        kind: BuildMaterialActionKind.changeStatus,
        label: LearningProjectBuildL10n.changeStatus,
        icon: Icons.tune_rounded,
      ),
    );

    if (hasSelectedMaterial || (hasLinkedMaterial && !isAcquired)) {
      add(
        const BuildMaterialCardAction(
          kind: BuildMaterialActionKind.unlink,
          label: LearningProjectBuildL10n.unlinkMaterial,
          icon: Icons.link_off_rounded,
        ),
      );
    }

    if (canRemoveAcquired) {
      add(
        const BuildMaterialCardAction(
          kind: BuildMaterialActionKind.removeFromComponent,
          label: LearningProjectBuildL10n.removeFromComponent,
          icon: Icons.layers_clear_outlined,
        ),
      );
      add(
        const BuildMaterialCardAction(
          kind: BuildMaterialActionKind.useAnother,
          label: LearningProjectBuildL10n.useAnotherMaterial,
          icon: Icons.swap_horiz_rounded,
        ),
      );
    }

    add(
      BuildMaterialCardAction(
        kind: BuildMaterialActionKind.editNote,
        label: item.learnerNote == null
            ? LearningProjectBuildL10n.addNote
            : LearningProjectBuildL10n.editNote,
        icon: Icons.edit_note_rounded,
      ),
    );
  }

  return items;
}
