import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/app_network_image.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../domain/models/project_build_material_link.dart';
import '../../l10n/learning_project_build_l10n.dart';
import '../../theme/learning_ui_palette.dart';

class BuildMaterialCandidateCard extends StatelessWidget {
  const BuildMaterialCandidateCard({
    super.key,
    required this.candidate,
    required this.isLinking,
    required this.onLink,
    required this.onView,
    this.compact = true,
  });

  final BuildMaterialCandidate candidate;
  final bool isLinking;
  final VoidCallback onLink;
  final VoidCallback onView;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final imageSize = compact ? 64.0 : 72.0;
    final padding = compact ? AppSpacing.sm + AppSpacing.xs : AppSpacing.md;

    return Container(
      padding: EdgeInsetsDirectional.all(padding),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CandidateMaterialImage(
                imageUrl: candidate.imageUrl,
                size: imageSize,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      candidate.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.subtitle(context).copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: compact ? 17 : 18,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _supplierLocationLine(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.body(context).copyWith(
                        color: palette.textSecondary,
                        fontSize: compact ? 13 : 14,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _priceConditionLine(context),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textPrimary,
                        fontSize: compact ? 13 : 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (candidate.matchHints.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            CandidateMatchReasonChips(reasons: candidate.matchHints),
          ],
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: compact ? 44 : 48,
            width: double.infinity,
            child: FilledButton(
              onPressed: isLinking ? null : onLink,
              style: AppStatusButtonStyle.filled(
                context,
                AppStatusTone.primary,
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              ),
              child: isLinking
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(
                      LearningProjectBuildL10n.linkToComponent.resolve(context),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
            ),
          ),
          Center(
            child: TextButton(
              onPressed: isLinking ? null : onView,
              style: TextButton.styleFrom(
                foregroundColor: palette.lime,
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: 0,
                ),
                minimumSize: const Size(0, 36),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(
                LearningProjectBuildL10n.viewMaterial.resolve(context),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _supplierLocationLine() {
    final parts = <String>[
      candidate.supplierName.trim(),
      candidate.city.trim(),
      if (candidate.area?.trim().isNotEmpty == true) candidate.area!.trim(),
    ].where((part) => part.isNotEmpty);
    return parts.join(' · ');
  }

  String _priceConditionLine(BuildContext context) {
    final price = candidate.isFree
        ? LearningProjectBuildL10n.free.resolve(context)
        : candidate.price == null
        ? LearningProjectBuildL10n.paid.resolve(context)
        : candidate.priceLabel;
    final condition = LearningProjectBuildL10n.conditionLabel(
      candidate.condition,
    ).resolve(context);
    return '$price · $condition';
  }
}

class CandidateMaterialImage extends StatelessWidget {
  const CandidateMaterialImage({super.key, this.imageUrl, this.size = 64});

  final String? imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return ClipRRect(
      borderRadius: AppRadius.mdAll,
      child: SizedBox(
        width: size,
        height: size,
        child: ColoredBox(
          color: palette.mutedChip,
          child: imageUrl == null || imageUrl!.trim().isEmpty
              ? Icon(
                  Icons.inventory_2_outlined,
                  color: palette.textSecondary,
                  size: size * 0.38,
                )
              : AppNetworkImage(
                  url: imageUrl,
                  fit: BoxFit.cover,
                  width: size,
                  height: size,
                  errorBuilder: (_, _, _) => Icon(
                    Icons.broken_image_outlined,
                    color: palette.textSecondary,
                    size: size * 0.38,
                  ),
                ),
        ),
      ),
    );
  }
}

class CandidateMatchReasonChips extends StatelessWidget {
  const CandidateMatchReasonChips({
    super.key,
    required this.reasons,
    this.visibleCount = 2,
  });

  final List<String> reasons;
  final int visibleCount;

  @override
  Widget build(BuildContext context) {
    if (reasons.isEmpty) {
      return const SizedBox.shrink();
    }

    final visible = reasons.take(visibleCount).toList(growable: false);
    final overflow = reasons.length - visible.length;

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final reason in visible)
          _MatchReasonChip(
            label: LearningProjectBuildL10n.matchHint(reason).resolve(context),
          ),
        if (overflow > 0)
          _MatchReasonChip(
            label: '+$overflow',
            emphasized: true,
            onTap: () => _showRemainingReasons(context),
          ),
      ],
    );
  }

  Future<void> _showRemainingReasons(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    return showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.md,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  LearningProjectBuildL10n.matchReasonsTitle.resolve(context),
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: palette.textPrimary, fontSize: 18),
                ),
                const SizedBox(height: AppSpacing.sm),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 320),
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: reasons.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 6),
                    itemBuilder: (context, index) {
                      return Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: _MatchReasonChip(
                          label: LearningProjectBuildL10n.matchHint(
                            reasons[index],
                          ).resolve(context),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _MatchReasonChip extends StatelessWidget {
  const _MatchReasonChip({
    required this.label,
    this.emphasized = false,
    this.onTap,
  });

  final String label;
  final bool emphasized;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final foreground = emphasized ? palette.lime : palette.textSecondary;
    final chip = ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 180),
      child: Container(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        decoration: BoxDecoration(
          color: emphasized
              ? palette.limeSoft.withValues(alpha: 0.55)
              : palette.mutedChip,
          borderRadius: AppRadius.pillAll,
          border: Border.all(
            color: emphasized
                ? palette.lime.withValues(alpha: 0.28)
                : palette.borderSubtle,
          ),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.label(context).copyWith(
            color: foreground,
            fontSize: 11,
            fontWeight: FontWeight.w600,
            height: 1.1,
          ),
        ),
      ),
    );

    if (onTap == null) {
      return chip;
    }

    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: chip,
      ),
    );
  }
}
