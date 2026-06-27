import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../data/learning_hub_mock_data.dart';
import '../../domain/models/learning_project.dart';
import 'learning_hub_text.dart';

class ProjectComponentsSection extends StatefulWidget {
  const ProjectComponentsSection({super.key, required this.components});

  final List<LocalizedText> components;

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
    final hasMore = widget.components.length > _collapsedVisibleCount;
    final visibleComponents = _expanded
        ? widget.components
        : widget.components.take(_collapsedVisibleCount).toList();

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
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
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: palette.darkSurfaceSoft,
                  borderRadius: AppRadius.pillAll,
                ),
                child: Icon(Icons.inventory_2_outlined, color: palette.lime),
              ),
              const Spacer(),
              Text(
                const LocalizedText(
                  en: 'Required components',
                  ar: 'المكونات المطلوبة',
                ).resolve(context),
                style: AppTextStyles.display(
                  context,
                ).copyWith(color: palette.textPrimary),
                textAlign: TextAlign.start,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            alignment: WrapAlignment.start,
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: visibleComponents.map((component) {
              return Container(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                decoration: BoxDecoration(
                  color: palette.darkSurface,
                  borderRadius: AppRadius.pillAll,
                  border: Border.all(color: palette.borderSubtle),
                ),
                child: Text(
                  component.resolve(context),
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: palette.textPrimary),
                  textAlign: TextAlign.start,
                ),
              );
            }).toList(),
          ),
          if (hasMore) ...[
            const SizedBox(height: AppSpacing.md),
            OutlinedButton.icon(
              onPressed: () => setState(() => _expanded = !_expanded),
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
                        en: 'Show all components (${widget.components.length})',
                        ar: 'عرض كل المكونات (${widget.components.length})',
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
              color: palette.darkSurfaceSoft,
              borderRadius: AppRadius.lgAll,
              border: Border.all(color: palette.borderSubtle),
            ),
            child: Text(
              const LocalizedText(
                en: 'Note: these components are shown for learning only and will later connect to the AI Material Agent.',
                ar: 'ملاحظة: هذه المكونات معروضة لأغراض التعلم فقط وستتصل لاحقاً بوكيل المواد الذكي.',
              ).resolve(context),
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
              textAlign: TextAlign.start,
            ),
          ),
        ],
      ),
    );
  }
}
