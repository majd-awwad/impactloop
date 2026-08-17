import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../l10n/smart_build_plan_l10n.dart';

class SmartBuildPlanAdvisoryStrip extends StatelessWidget {
  const SmartBuildPlanAdvisoryStrip({super.key});

  @override
  Widget build(BuildContext context) {
    final style = AppStatusStyle.of(context, AppStatusTone.info);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: style.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline_rounded, size: 20, color: style.foreground),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              SmartBuildPlanL10n.advisoryStrip.resolve(context),
              style: AppTextStyles.body(
                context,
              ).copyWith(color: style.foreground, height: 1.45),
            ),
          ),
        ],
      ),
    );
  }
}
