import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../data/models/project_help_session_models.dart';
import 'help_session_detail_primitives.dart';
import 'help_session_timeline.dart';

class HelpSessionTimelineSection extends StatelessWidget {
  const HelpSessionTimelineSection({super.key, required this.session});

  final ProjectHelpSession session;

  @override
  Widget build(BuildContext context) {
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    return HelpSessionDetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HelpSessionDetailSectionTitle(isArabic ? 'المسار' : 'Timeline'),
          const SizedBox(height: AppSpacing.sm),
          HelpSessionTimeline(session: session),
        ],
      ),
    );
  }
}
