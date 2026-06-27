import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../data/learning_hub_mock_data.dart';
import 'learning_hub_text.dart';

class DisabledAiPanel extends StatelessWidget {
  const DisabledAiPanel({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.disabledPanel,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.disabledPanelBorder),
      ),
      child: Row(
        children: [
          Icon(Icons.auto_awesome_outlined, color: palette.lime),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  learningDisabledAiTitle.resolve(context),
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: palette.textPrimary),
                  textAlign: TextAlign.start,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  learningDisabledAiSubtitle.resolve(context),
                  style: AppTextStyles.subtitle(
                    context,
                  ).copyWith(color: palette.textSecondary),
                  textAlign: TextAlign.start,
                ),
              ],
            ),
          ),
          if (!compact) ...[
            const SizedBox(width: AppSpacing.md),
            Icon(Icons.lock_outline, color: palette.textSecondary),
          ],
        ],
      ),
    );
  }
}
