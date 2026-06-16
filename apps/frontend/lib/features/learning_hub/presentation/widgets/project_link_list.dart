import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../data/learning_hub_mock_data.dart';
import '../../domain/models/learning_project.dart';
import 'learning_hub_text.dart';

class ProjectLinkList extends StatelessWidget {
  const ProjectLinkList({super.key, required this.links});

  final List<ProjectLinkItem> links;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: learningCardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: learningBorderSubtle),
        boxShadow: const [
          BoxShadow(
            color: Color(0x12000000),
            blurRadius: 18,
            offset: Offset(0, 8),
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
                  color: learningDarkSurfaceSoft,
                  borderRadius: AppRadius.pillAll,
                ),
                child: const Icon(Icons.open_in_new, color: learningLime),
              ),
              const Spacer(),
              Text(
                const LocalizedText(
                  en: 'Helpful links',
                  ar: 'روابط مفيدة',
                ).resolve(context),
                style: AppTextStyles.display(
                  context,
                ).copyWith(color: learningTextPrimary),
                textAlign: TextAlign.start,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          for (var index = 0; index < links.length; index++) ...[
            _LinkTile(item: links[index]),
            if (index != links.length - 1)
              const SizedBox(height: AppSpacing.md),
          ],
        ],
      ),
    );
  }
}

class _LinkTile extends StatelessWidget {
  const _LinkTile({required this.item});

  final ProjectLinkItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: learningDarkSurfaceSoft,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: learningBorderSubtle),
      ),
      child: Row(
        children: [
          const Icon(Icons.link_rounded, color: learningLime),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.label.resolve(context),
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(fontSize: 18, color: learningTextPrimary),
                  textAlign: TextAlign.start,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  item.urlLabel.resolve(context),
                  style: AppTextStyles.subtitle(
                    context,
                  ).copyWith(color: learningTextSecondary),
                  textAlign: TextAlign.start,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
