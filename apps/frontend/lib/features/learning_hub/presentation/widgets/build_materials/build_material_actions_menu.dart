import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/app_close_button.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../domain/models/project_build.dart';
import '../../l10n/learning_project_build_l10n.dart';
import '../../theme/learning_ui_palette.dart';
import 'build_material_card_presentation.dart';

class BuildMaterialActionsMenu extends StatelessWidget {
  const BuildMaterialActionsMenu({
    super.key,
    required this.actions,
    required this.enabled,
    required this.onSelected,
    this.compact = false,
  });

  final List<BuildMaterialCardAction> actions;
  final bool enabled;
  final ValueChanged<BuildMaterialActionKind> onSelected;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (actions.isEmpty) {
      return const SizedBox.shrink();
    }

    final palette = LearningUiPalette.of(context);
    final label = LearningProjectBuildL10n.moreActions.resolve(context);

    return PopupMenuButton<BuildMaterialActionKind>(
      enabled: enabled,
      tooltip: label,
      padding: EdgeInsets.zero,
      splashRadius: compact ? 16 : 24,
      iconSize: compact ? 18 : 24,
      style: compact
          ? const ButtonStyle(
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              visualDensity: VisualDensity.compact,
              minimumSize: WidgetStatePropertyAll(Size(32, 32)),
              padding: WidgetStatePropertyAll(EdgeInsets.zero),
            )
          : null,
      onSelected: onSelected,
      icon: Icon(Icons.more_horiz_rounded, color: palette.textSecondary),
      itemBuilder: (context) => [
        for (final action in actions)
          PopupMenuItem(
            value: action.kind,
            child: Row(
              children: [
                Icon(action.icon, size: 18, color: palette.textSecondary),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    action.label.resolve(context),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class BuildMaterialStatusSheet {
  const BuildMaterialStatusSheet._();

  static Future<ProjectBuildItemStatus?> show(
    BuildContext context, {
    required ProjectBuildItemStatus current,
  }) {
    return showModalBottomSheet<ProjectBuildItemStatus>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        final palette = LearningUiPalette.of(context);

        return SafeArea(
          child: Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.sm,
              0,
              AppSpacing.sm,
              AppSpacing.md,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.sm,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          LearningProjectBuildL10n.changeStatus.resolve(
                            context,
                          ),
                          style: AppTextStyles.title(
                            context,
                          ).copyWith(color: palette.textPrimary, fontSize: 18),
                        ),
                      ),
                      AppCloseButton(
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                for (final status in ProjectBuildItemStatus.values)
                  _StatusOptionTile(
                    status: status,
                    selected: status == current,
                    onTap: () => Navigator.of(context).pop(status),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _StatusOptionTile extends StatelessWidget {
  const _StatusOptionTile({
    required this.status,
    required this.selected,
    required this.onTap,
  });

  final ProjectBuildItemStatus status;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final visual = _statusVisual(status);
    final style = AppStatusStyle.of(context, visual.tone);
    final palette = LearningUiPalette.of(context);

    return ListTile(
      onTap: onTap,
      selected: selected,
      leading: Icon(visual.icon, color: style.foreground),
      title: Text(
        visual.label.resolve(context),
        style: AppTextStyles.subtitle(context).copyWith(
          color: palette.textPrimary,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
        ),
      ),
      trailing: selected
          ? Icon(Icons.check_rounded, color: style.foreground)
          : null,
      selectedTileColor: style.background,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
    );
  }
}

({LocalizedText label, IconData icon, AppStatusTone tone}) _statusVisual(
  ProjectBuildItemStatus status,
) {
  return switch (status) {
    ProjectBuildItemStatus.missing => (
      label: LearningProjectBuildL10n.compactMissing,
      icon: Icons.search_rounded,
      tone: AppStatusTone.warning,
    ),
    ProjectBuildItemStatus.available => (
      label: LearningProjectBuildL10n.compactAvailable,
      icon: Icons.check_rounded,
      tone: AppStatusTone.primary,
    ),
    ProjectBuildItemStatus.reserved => (
      label: LearningProjectBuildL10n.compactReserved,
      icon: Icons.bookmark_rounded,
      tone: AppStatusTone.primary,
    ),
    ProjectBuildItemStatus.alreadyOwned => (
      label: LearningProjectBuildL10n.iHaveThisComponent,
      icon: Icons.home_repair_service_outlined,
      tone: AppStatusTone.primary,
    ),
    ProjectBuildItemStatus.alternative => (
      label: LearningProjectBuildL10n.compactAlternative,
      icon: Icons.swap_horiz_rounded,
      tone: AppStatusTone.primary,
    ),
  };
}
