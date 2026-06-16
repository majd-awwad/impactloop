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
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: learningDisabledPanel,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: learningDisabledPanelBorder),
      ),
      child: Row(
        children: [
          const Icon(Icons.auto_awesome_outlined, color: learningLime),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  learningDisabledAiTitle.resolve(context),
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: learningTextPrimary),
                  textAlign: TextAlign.start,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  learningDisabledAiSubtitle.resolve(context),
                  style: AppTextStyles.subtitle(
                    context,
                  ).copyWith(color: learningTextSecondary),
                  textAlign: TextAlign.start,
                ),
              ],
            ),
          ),
          if (!compact) ...[
            const SizedBox(width: AppSpacing.md),
            const Icon(Icons.lock_outline, color: learningTextSecondary),
          ],
        ],
      ),
    );
  }
}
