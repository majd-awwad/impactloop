import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';

class DiscoveryLocationPrivacyPanel extends StatelessWidget {
  const DiscoveryLocationPrivacyPanel({super.key});

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.hintSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.hintBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: palette.mint.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(Icons.privacy_tip_outlined, color: palette.mint),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  const LocalizedText(
                    en: 'Location privacy',
                    ar: 'خصوصية الموقع',
                  ).resolve(context),
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: palette.textPrimary),
                  textAlign: TextAlign.start,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  const LocalizedText(
                    en: 'For privacy, public results show city, area, and approximate map pins only.',
                    ar: 'لحماية الخصوصية، تعرض النتائج العامة المدينة والمنطقة ونقاطاً تقريبية فقط.',
                  ).resolve(context),
                  style: AppTextStyles.subtitle(
                    context,
                  ).copyWith(color: palette.textSecondary),
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
