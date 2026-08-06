import 'package:flutter/material.dart';

import '../../../data/models/project_help_session_models.dart';
import '../help_session_status_utils.dart';
import 'help_session_timeline_events.dart' show
    HelpSessionTimelineEvent,
    buildHelpSessionTimelineEvents,
    localizedTimelineLabel;

class HelpSessionTimeline extends StatelessWidget {
  const HelpSessionTimeline({super.key, required this.session});

  final ProjectHelpSession session;

  @override
  Widget build(BuildContext context) {
    final events = buildHelpSessionTimelineEvents(session);
    if (events.isEmpty) {
      return const SizedBox.shrink();
    }

    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
    final localizedEvents = events
        .map(
          (event) => HelpSessionTimelineEvent(
            label: localizedTimelineLabel(event.label, isArabic),
            timestamp: event.timestamp,
            timezone: event.timezone,
            isCurrent: event.isCurrent,
          ),
        )
        .toList();
    return Semantics(
      container: true,
      label: isArabic ? 'مسار الجلسة' : 'Session timeline',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < localizedEvents.length; i++)
            _TimelineRow(
              event: localizedEvents[i],
              isLast: i == localizedEvents.length - 1,
            ),
        ],
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.event, required this.isLast});

  final HelpSessionTimelineEvent event;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final color = event.isCurrent
        ? Theme.of(context).colorScheme.primary
        : Theme.of(context).disabledColor;

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Semantics(
                label: event.isCurrent ? 'Current step' : 'Completed step',
                child: Icon(
                  event.isCurrent ? Icons.radio_button_checked : Icons.circle,
                  size: event.isCurrent ? 14 : 8,
                  color: color,
                ),
              ),
              if (!isLast)
                Container(
                  width: 2,
                  height: 20,
                  color: Theme.of(context).dividerColor,
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.label,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight:
                            event.isCurrent ? FontWeight.w700 : FontWeight.w500,
                      ),
                ),
                if (event.timestamp != null)
                  Text(
                    formatHelpSessionDateTime(
                      context,
                      event.timestamp!,
                      event.timezone,
                    ),
                    style: Theme.of(context).textTheme.labelSmall,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
