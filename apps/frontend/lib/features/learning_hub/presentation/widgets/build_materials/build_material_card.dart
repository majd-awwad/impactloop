import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../domain/models/project_build.dart';
import '../../theme/learning_ui_palette.dart';
import '../smart_build_plan/smart_build_plan_material_thumbnail.dart';
import 'build_material_actions_menu.dart';
import 'build_material_card_presentation.dart';
import 'build_material_status_badge.dart';

class BuildMaterialCard extends StatelessWidget {
  const BuildMaterialCard({
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
    final presentation = BuildMaterialCardPresentation.fromItem(
      item,
      isEditingLocked: isEditingLocked,
    );
    final name = item.component.name.resolve(context);
    final quantity = presentation.quantityLabel.resolve(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md - AppSpacing.xs),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _BuildMaterialThumbnail(item: item),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.subtitle(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w700,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      quantity,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary, fontSize: 12),
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
              else
                BuildMaterialActionsMenu(
                  actions: presentation.menuItems,
                  enabled: !isUpdating,
                  onSelected: onAction,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: BuildMaterialStatusBadge(
              label: presentation.badgeLabel.resolve(context),
              icon: presentation.badgeIcon,
              tone: presentation.badgeTone,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            presentation.description.resolve(context),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.body(context).copyWith(
              color: presentation.warningDescription
                  ? AppStatusStyle.of(context, AppStatusTone.warning).foreground
                  : palette.textSecondary,
              height: 1.35,
              fontSize: 13,
            ),
          ),
          if (presentation.learnerNote != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              presentation.learnerNote!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.body(context).copyWith(
                color: palette.textSecondary,
                fontSize: 12,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
          if (presentation.primary != null) ...[
            const SizedBox(height: AppSpacing.sm),
            _PrimaryActionButton(
              action: presentation.primary!,
              enabled: !isUpdating,
              onPressed: () => onAction(presentation.primary!.kind),
            ),
          ],
          if (presentation.secondary != null) ...[
            const SizedBox(height: 2),
            Center(
              child: TextButton(
                onPressed: isUpdating
                    ? null
                    : () => onAction(presentation.secondary!.kind),
                style: TextButton.styleFrom(
                  foregroundColor: palette.lime,
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                ),
                child: Text(
                  presentation.secondary!.label.resolve(context),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PrimaryActionButton extends StatelessWidget {
  const _PrimaryActionButton({
    required this.action,
    required this.enabled,
    required this.onPressed,
  });

  final BuildMaterialCardAction action;
  final bool enabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final label = Text(
      action.label.resolve(context),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
    final icon = Icon(action.icon, size: 18);
    final minimumSize = const Size.fromHeight(42);

    if (action.outlined) {
      return OutlinedButton.icon(
        onPressed: enabled ? onPressed : null,
        icon: icon,
        label: label,
        style: OutlinedButton.styleFrom(
          foregroundColor: palette.lime,
          side: BorderSide(color: palette.lime.withValues(alpha: 0.55)),
          minimumSize: minimumSize,
          visualDensity: VisualDensity.compact,
        ),
      );
    }

    return FilledButton.icon(
      onPressed: enabled ? onPressed : null,
      icon: icon,
      label: label,
      style: FilledButton.styleFrom(
        minimumSize: minimumSize,
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}

class _BuildMaterialThumbnail extends StatelessWidget {
  const _BuildMaterialThumbnail({required this.item});

  final ProjectBuildItem item;

  @override
  Widget build(BuildContext context) {
    final material = item.linkedMaterial;
    if (material != null) {
      return SmartBuildPlanMaterialThumbnail(
        materialId: material.id,
        imageUrl: material.imageUrl,
        size: 48,
      );
    }

    final palette = LearningUiPalette.of(context);
    return ClipRRect(
      borderRadius: AppRadius.mdAll,
      child: Container(
        width: 48,
        height: 48,
        color: palette.mutedChip,
        child: Icon(
          Icons.inventory_2_outlined,
          color: palette.textSecondary,
          size: 22,
        ),
      ),
    );
  }
}
