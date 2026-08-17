import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/utils/content_text_direction.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../domain/models/project_build.dart';
import '../../l10n/learning_project_build_l10n.dart';
import '../../l10n/project_build_page_l10n.dart';
import '../../theme/learning_ui_palette.dart';
import '../build_materials/build_material_actions_menu.dart';
import '../build_materials/build_material_candidate_card.dart';
import '../build_materials/build_material_card_presentation.dart';
import '../build_materials/build_material_status_badge.dart';
import '../build_materials/build_material_warning_copy.dart';
import 'build_prepare_material_semantics.dart';

class BuildPrepareMaterialCard extends StatelessWidget {
  const BuildPrepareMaterialCard({
    super.key,
    required this.item,
    required this.isUpdating,
    required this.isEditingLocked,
    required this.onAction,
  });

  final ProjectBuildItem item;
  final bool isUpdating;
  final bool isEditingLocked;
  final ValueChanged<BuildMaterialActionKind> onAction;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final semantics = BuildPrepareMaterialSemantics.fromItem(
      item,
      isEditingLocked: isEditingLocked,
    );
    final style = AppStatusStyle.of(context, semantics.tone);
    final density = semantics.density;
    final thumbnailSize = density == BuildPrepareCardDensity.mini ? 48.0 : 52.0;
    final body = _prepareCardBody(context, item: item, semantics: semantics);
    final primaryLabel = _preparePrimaryLabel(semantics.primaryAction);
    final secondaryLabel = semantics.secondaryAction?.label;
    final hasActionPair =
        semantics.primaryAction != null && semantics.secondaryAction != null;
    final compactButtonStyle = ButtonStyle(
      minimumSize: const WidgetStatePropertyAll(Size(0, 44)),
      maximumSize: const WidgetStatePropertyAll(Size(double.infinity, 44)),
      padding: const WidgetStatePropertyAll(
        EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      ),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      visualDensity: VisualDensity.standard,
    );

    return Theme(
      data: Theme.of(context).copyWith(
        filledButtonTheme: FilledButtonThemeData(
          style: Theme.of(
            context,
          ).filledButtonTheme.style?.merge(compactButtonStyle),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: Theme.of(
            context,
          ).outlinedButtonTheme.style?.merge(compactButtonStyle),
        ),
      ),
      child: Container(
        padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 16, 12),
        decoration: BoxDecoration(
          color: switch (semantics.tone) {
            AppStatusTone.success => style.background.withValues(alpha: 0.45),
            AppStatusTone.danger => style.background,
            _ => palette.cardSurface,
          },
          borderRadius: AppRadius.lgAll,
          border: Border.all(
            color: switch (semantics.tone) {
              AppStatusTone.success => palette.lime.withValues(alpha: 0.42),
              AppStatusTone.danger => style.border,
              AppStatusTone.warning => style.border.withValues(alpha: 0.7),
              AppStatusTone.info => style.border.withValues(alpha: 0.55),
              _ => palette.lime.withValues(alpha: 0.22),
            },
          ),
          boxShadow: [
            BoxShadow(
              color: palette.cardShadow.withValues(alpha: 0.06),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CandidateMaterialImage(
                  imageUrl: item.linkedMaterial?.imageUrl,
                  size: thumbnailSize,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: ContentDirectionalText(
                              item.component.name.resolve(context),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.subtitle(context).copyWith(
                                color: palette.textPrimary,
                                fontWeight: FontWeight.w800,
                                fontSize:
                                    density == BuildPrepareCardDensity.mini
                                    ? 16
                                    : 17,
                                height: 1.25,
                              ),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 120),
                            child: BuildMaterialStatusBadge(
                              label: semantics.statusLabel.resolve(context),
                              icon: semantics.icon,
                              tone: semantics.tone,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        semantics.quantityLabel.resolve(context),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: palette.textSecondary, fontSize: 13),
                      ),
                    ],
                  ),
                ),
                if (isUpdating)
                  const Padding(
                    padding: EdgeInsetsDirectional.only(start: AppSpacing.xs),
                    child: SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                else if (!isEditingLocked && semantics.menuItems.isNotEmpty)
                  SizedBox(
                    width: 32,
                    height: 32,
                    child: BuildMaterialActionsMenu(
                      actions: semantics.menuItems,
                      enabled: !isUpdating,
                      compact: true,
                      onSelected: onAction,
                    ),
                  ),
              ],
            ),
            if (body.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                body,
                maxLines:
                    semantics.kind == BuildPrepareMaterialKind.needsAttention ||
                        semantics.kind ==
                            BuildPrepareMaterialKind.insufficientQuantity ||
                        semantics.kind ==
                            BuildPrepareMaterialKind.incompatibleUnit
                    ? 2
                    : 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.body(context).copyWith(
                  color: semantics.tone == AppStatusTone.danger
                      ? style.foreground
                      : palette.textSecondary,
                  height: 1.35,
                  fontSize: 14,
                ),
              ),
            ],
            if (semantics.primaryAction != null ||
                semantics.secondaryAction != null) ...[
              const SizedBox(height: AppSpacing.sm),
              if (hasActionPair)
                SizedBox(
                  height: 44,
                  child: _PrepareCardActionRow(
                    primary: semantics.primaryAction!,
                    primaryLabel: primaryLabel,
                    secondary: semantics.secondaryAction!,
                    secondaryLabel: secondaryLabel!,
                    filled: semantics.filledPrimary,
                    tone: semantics.tone,
                    enabled: !isUpdating && !isEditingLocked,
                    onPrimary: () => onAction(semantics.primaryAction!.kind),
                    onSecondary: isUpdating || isEditingLocked
                        ? null
                        : () => onAction(semantics.secondaryAction!.kind),
                  ),
                )
              else if (semantics.primaryAction != null)
                SizedBox(
                  height: 44,
                  child: _PrepareCardPrimaryButton(
                    label: primaryLabel.resolve(context),
                    filled: semantics.filledPrimary,
                    outlined: semantics.primaryAction!.outlined,
                    tone: semantics.tone,
                    enabled: !isUpdating && !isEditingLocked,
                    onPressed: () => onAction(semantics.primaryAction!.kind),
                  ),
                )
              else
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton(
                    onPressed: isUpdating || isEditingLocked
                        ? null
                        : () => onAction(semantics.secondaryAction!.kind),
                    style: TextButton.styleFrom(
                      foregroundColor: palette.lime,
                      minimumSize: const Size(48, 44),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm,
                      ),
                    ),
                    child: Text(
                      secondaryLabel!.resolve(context),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

String _prepareCardBody(
  BuildContext context, {
  required ProjectBuildItem item,
  required BuildPrepareMaterialSemantics semantics,
}) {
  switch (semantics.kind) {
    case BuildPrepareMaterialKind.missing:
      return ProjectBuildPageL10n.prepareMissingBody.resolve(context);
    case BuildPrepareMaterialKind.selected:
      return ProjectBuildPageL10n.prepareSelectedBody.resolve(context);
    case BuildPrepareMaterialKind.reserved:
      return ProjectBuildPageL10n.waitingForPickup.resolve(context);
    case BuildPrepareMaterialKind.needsAttention:
      final lines = <String>[
        LearningProjectBuildL10n.reservationRequiresResolution.resolve(context),
      ];
      final detail = BuildMaterialWarningCopy.allocationDetail(item);
      if (detail != null) {
        final resolved = detail.resolve(context);
        if (!lines.contains(resolved)) {
          lines.add(resolved);
        }
      }
      return lines.join('\n');
    case BuildPrepareMaterialKind.readyOwned:
    case BuildPrepareMaterialKind.readyAcquired:
    case BuildPrepareMaterialKind.alternative:
    case BuildPrepareMaterialKind.insufficientQuantity:
    case BuildPrepareMaterialKind.incompatibleUnit:
    case BuildPrepareMaterialKind.matchesAvailable:
    case BuildPrepareMaterialKind.needsUpdate:
      return semantics.subtitle.resolve(context);
  }
}

LocalizedText _preparePrimaryLabel(BuildMaterialCardAction? action) {
  if (action == null) {
    return const LocalizedText(en: '', ar: '');
  }
  return switch (action.kind) {
    BuildMaterialActionKind.findMatching =>
      ProjectBuildPageL10n.prepareFindMaterial,
    BuildMaterialActionKind.reserve =>
      ProjectBuildPageL10n.prepareReserveMaterial,
    _ => action.label,
  };
}

class _PrepareCardActionRow extends StatelessWidget {
  const _PrepareCardActionRow({
    required this.primary,
    required this.primaryLabel,
    required this.secondary,
    required this.secondaryLabel,
    required this.filled,
    required this.tone,
    required this.enabled,
    required this.onPrimary,
    required this.onSecondary,
  });

  final BuildMaterialCardAction primary;
  final LocalizedText primaryLabel;
  final BuildMaterialCardAction secondary;
  final LocalizedText secondaryLabel;
  final bool filled;
  final AppStatusTone tone;
  final bool enabled;
  final VoidCallback onPrimary;
  final VoidCallback? onSecondary;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final buttonTone = tone == AppStatusTone.danger
        ? AppStatusTone.danger
        : AppStatusTone.primary;

    return Row(
      children: [
        Expanded(
          flex: 3,
          child: filled && !primary.outlined
              ? FilledButton(
                  onPressed: enabled ? onPrimary : null,
                  style:
                      AppStatusButtonStyle.filled(
                        context,
                        buttonTone,
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                        ),
                      ).copyWith(
                        minimumSize: const WidgetStatePropertyAll(Size(48, 44)),
                        maximumSize: const WidgetStatePropertyAll(
                          Size(double.infinity, 44),
                        ),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        visualDensity: VisualDensity.standard,
                      ),
                  child: Text(
                    primaryLabel.resolve(context),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                )
              : OutlinedButton(
                  onPressed: enabled ? onPrimary : null,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: palette.lime,
                    side: BorderSide(
                      color: palette.lime.withValues(alpha: 0.55),
                    ),
                    minimumSize: const Size(48, 44),
                    maximumSize: const Size(double.infinity, 44),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.standard,
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                    ),
                  ),
                  child: Text(
                    primaryLabel.resolve(context),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          flex: 2,
          child: OutlinedButton(
            onPressed: onSecondary,
            style: OutlinedButton.styleFrom(
              foregroundColor: palette.lime,
              side: BorderSide(color: palette.lime.withValues(alpha: 0.4)),
              minimumSize: const Size(48, 44),
              maximumSize: const Size(double.infinity, 44),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              visualDensity: VisualDensity.standard,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
            ),
            child: Text(
              secondaryLabel.resolve(context),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
            ),
          ),
        ),
      ],
    );
  }
}

class _PrepareCardPrimaryButton extends StatelessWidget {
  const _PrepareCardPrimaryButton({
    required this.label,
    required this.filled,
    required this.outlined,
    required this.tone,
    required this.enabled,
    required this.onPressed,
  });

  final String label;
  final bool filled;
  final bool outlined;
  final AppStatusTone tone;
  final bool enabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final buttonTone = tone == AppStatusTone.danger
        ? AppStatusTone.danger
        : AppStatusTone.primary;
    final text = Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
    );

    if (!filled || outlined) {
      return OutlinedButton(
        onPressed: enabled ? onPressed : null,
        style: OutlinedButton.styleFrom(
          foregroundColor: palette.lime,
          side: BorderSide(color: palette.lime.withValues(alpha: 0.55)),
          minimumSize: const Size.fromHeight(44),
          maximumSize: const Size(double.infinity, 44),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          visualDensity: VisualDensity.standard,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        ),
        child: text,
      );
    }

    return FilledButton(
      onPressed: enabled ? onPressed : null,
      style:
          AppStatusButtonStyle.filled(
            context,
            buttonTone,
            visualDensity: VisualDensity.compact,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
          ).copyWith(
            minimumSize: const WidgetStatePropertyAll(Size.fromHeight(44)),
            maximumSize: const WidgetStatePropertyAll(
              Size(double.infinity, 44),
            ),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            visualDensity: VisualDensity.standard,
          ),
      child: text,
    );
  }
}
