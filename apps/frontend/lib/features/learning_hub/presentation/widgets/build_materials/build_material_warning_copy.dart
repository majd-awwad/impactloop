import '../../../../../shared/models/localized_text.dart';
import '../../../domain/models/project_build.dart';
import '../../../domain/project_build_acquisition_state.dart';
import '../../l10n/learning_project_build_l10n.dart';

class BuildMaterialWarningCopy {
  const BuildMaterialWarningCopy._();

  static bool looksLikeIncompatibleUnit(String? text) {
    if (text == null || text.trim().isEmpty) {
      return false;
    }

    final lower = text.toLowerCase();
    return lower.contains('unit is not compatible') ||
        (lower.contains('incompatible') && lower.contains('unit'));
  }

  static bool looksLikeUnavailable(String? text) {
    if (text == null || text.trim().isEmpty) {
      return false;
    }

    return text.toLowerCase().contains('no longer available');
  }

  static LocalizedText localizeRaw(String warning) {
    if (looksLikeIncompatibleUnit(warning)) {
      return LearningProjectBuildL10n.incompatibleUnitBody;
    }

    if (looksLikeUnavailable(warning)) {
      return LearningProjectBuildL10n.materialNoLongerAvailable;
    }

    return LocalizedText(
      en: warning,
      ar: LearningProjectBuildL10n.needsAttention.ar,
    );
  }

  static LocalizedText? allocationDetail(ProjectBuildItem item) {
    final result = ProjectBuildAcquisitionState.resolveAllocationResult(item);
    final allocation = item.quantityAllocation;

    if (result == 'incompatible_unit' ||
        looksLikeIncompatibleUnit(allocation?.warning)) {
      return LearningProjectBuildL10n.incompatibleUnitBody;
    }

    if (result == 'insufficient_quantity') {
      final available =
          allocation?.availableQuantity ?? allocation?.acquiredQuantity;
      final required = allocation?.requiredQuantity ?? item.component.quantity;
      if (available != null) {
        return LearningProjectBuildL10n.quantityAvailableRequired(
          available: available,
          required: required,
        );
      }
      return LearningProjectBuildL10n.insufficientQuantity;
    }

    final warning = allocation?.warning?.trim();
    if (warning != null && warning.isNotEmpty) {
      return localizeRaw(warning);
    }

    return null;
  }
}
