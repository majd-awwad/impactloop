import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../domain/models/smart_build_plan.dart';
import '../../l10n/smart_build_plan_l10n.dart';
import 'smart_build_plan_item_groups.dart';

class SmartBuildPlanReasonTags extends StatelessWidget {
  const SmartBuildPlanReasonTags({
    super.key,
    required this.tags,
    required this.matchType,
    this.maxVisible = 2,
  });

  final List<SmartBuildReasonTag> tags;
  final SmartBuildMatchType matchType;
  final int maxVisible;

  @override
  Widget build(BuildContext context) {
    final visible = prioritizedReasonTags(
      tags: tags,
      matchType: matchType,
      maxVisible: maxVisible,
    );
    final hidden = hiddenReasonTagCount(
      tags: tags,
      matchType: matchType,
      maxVisible: maxVisible,
    );

    if (visible.isEmpty && hidden == 0) {
      return const SizedBox.shrink();
    }

    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        for (final tag in visible)
          AppStatusBadge(
            label: SmartBuildPlanL10n.reasonTag(tag).resolve(context),
            tone: AppStatusTone.neutral,
          ),
        if (hidden > 0)
          AppStatusBadge(
            label: SmartBuildPlanL10n.moreReasons(hidden).resolve(context),
            tone: AppStatusTone.neutral,
          ),
      ],
    );
  }
}
