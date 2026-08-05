import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../domain/models/learning_project.dart';
import '../../domain/models/project_material_coverage.dart';
import '../l10n/learning_hub_coverage_l10n.dart';
import '../../presentation/theme/learning_ui_palette.dart';
import 'learning_hub_text.dart';

class ProjectComponentsSection extends StatefulWidget {
  const ProjectComponentsSection({
    super.key,
    this.components = const [],
    this.requiredComponents = const [],
  });

  final List<LocalizedText> components;
  final List<ProjectRequiredComponentItem> requiredComponents;

  @override
  State<ProjectComponentsSection> createState() =>
      _ProjectComponentsSectionState();
}

class _ProjectComponentsSectionState extends State<ProjectComponentsSection> {
  static const int _collapsedVisibleCount = 5;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    final l10n = LearningHubCoverageL10n.of(context);
    final usingDetailedComponents = widget.requiredComponents.isNotEmpty;
    final itemCount = usingDetailedComponents
        ? widget.requiredComponents.length
        : widget.components.length;
    final hasMore = itemCount > _collapsedVisibleCount;
    final visibleDetailed = _expanded
        ? widget.requiredComponents
        : widget.requiredComponents.take(_collapsedVisibleCount).toList();
    final visibleComponents = _expanded
        ? widget.components
        : widget.components.take(_collapsedVisibleCount).toList();

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.inventory_2_outlined, color: palette.lime, size: 22),
              const SizedBox(width: AppSpacing.sm),
              Text(
                const LocalizedText(
                  en: 'Required components',
                  ar: 'المكونات المطلوبة',
                ).resolve(context),
                style: textTheme.titleLarge?.copyWith(
                  color: palette.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
                textAlign: TextAlign.start,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            alignment: WrapAlignment.start,
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: usingDetailedComponents
                ? visibleDetailed.map((component) {
                    return _ComponentAvailabilityChip(
                      label: component.name.resolve(context),
                      status: component.publicAvailabilityStatus,
                      l10n: l10n,
                      palette: palette,
                      textTheme: textTheme,
                    );
                  }).toList()
                : visibleComponents.map((component) {
                    return Container(
                      padding: const EdgeInsetsDirectional.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.sm,
                      ),
                      decoration: BoxDecoration(
                        color: palette.cardSurfaceAlt,
                        borderRadius: AppRadius.pillAll,
                        border: Border.all(color: palette.borderSubtle),
                      ),
                      child: Text(
                        component.resolve(context),
                        style: textTheme.labelMedium?.copyWith(
                          color: palette.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                        textAlign: TextAlign.start,
                      ),
                    );
                  }).toList(),
          ),
          if (hasMore) ...[
            const SizedBox(height: AppSpacing.md),
            OutlinedButton.icon(
              onPressed: () => setState(() => _expanded = !_expanded),
              style: AppStatusButtonStyle.outlined(
                context,
                AppStatusTone.neutral,
              ),
              icon: Icon(
                _expanded
                    ? Icons.keyboard_arrow_up_rounded
                    : Icons.keyboard_arrow_down_rounded,
              ),
              label: Text(
                _expanded
                    ? const LocalizedText(
                        en: 'Show fewer components',
                        ar: 'عرض مكونات أقل',
                      ).resolve(context)
                    : LocalizedText(
                        en: 'Show all components ($itemCount)',
                        ar: 'عرض كل المكونات ($itemCount)',
                      ).resolve(context),
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          Container(
            width: double.infinity,
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md,
            ),
            decoration: BoxDecoration(
              color: palette.cardSurfaceAlt,
              borderRadius: AppRadius.lgAll,
              border: Border.all(color: palette.borderSubtle),
            ),
            child: Text(
              const LocalizedText(
                en: 'Public availability shows whether ImpactLoop currently lists materials that can satisfy each required component.',
                ar: 'يعرض التوفر العام ما إذا كانت المنصة تدرج حاليًا مواد يمكن أن تلبي كل مكوّن مطلوب.',
              ).resolve(context),
              style: textTheme.bodyMedium?.copyWith(
                color: palette.textSecondary,
                height: 1.45,
              ),
              textAlign: TextAlign.start,
            ),
          ),
        ],
      ),
    );
  }
}

class _ComponentAvailabilityChip extends StatelessWidget {
  const _ComponentAvailabilityChip({
    required this.label,
    required this.status,
    required this.l10n,
    required this.palette,
    required this.textTheme,
  });

  final String label;
  final ComponentPublicAvailabilityStatus? status;
  final LearningHubCoverageL10n l10n;
  final LearningUiPalette palette;
  final TextTheme textTheme;

  @override
  Widget build(BuildContext context) {
    final statusLabel = status == null
        ? null
        : l10n.availabilityStatusLabel(status!);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: textTheme.labelMedium?.copyWith(
              color: palette.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (statusLabel != null) ...[
            const SizedBox(height: 2),
            Text(
              statusLabel,
              style: textTheme.labelSmall?.copyWith(
                color: palette.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
