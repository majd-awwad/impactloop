import '../../../data/models/project_help_session_models.dart';

class HelpSessionTimelineEvent {
  const HelpSessionTimelineEvent({
    required this.label,
    this.timestamp,
    required this.timezone,
    this.isCurrent = false,
  });

  final String label;
  final DateTime? timestamp;
  final String timezone;
  final bool isCurrent;
}

List<HelpSessionTimelineEvent> buildHelpSessionTimelineEvents(
  ProjectHelpSession session,
) {
  final tz = session.learnerTimeZone;
  final events = <HelpSessionTimelineEvent>[
    HelpSessionTimelineEvent(
      label: 'Request sent',
      timestamp: session.createdAt,
      timezone: tz,
    ),
  ];

  if (session.alternativeProposedAt != null) {
    events.add(
      HelpSessionTimelineEvent(
        label: 'Alternative proposed',
        timestamp: session.alternativeProposedAt,
        timezone: tz,
      ),
    );
  }

  if (session.confirmedAt != null) {
    events.add(
      HelpSessionTimelineEvent(
        label: 'Time confirmed',
        timestamp: session.confirmedAt,
        timezone: tz,
      ),
    );
  }

  switch (session.status) {
    case ProjectHelpSessionStatus.zoomPending:
      events.add(
        const HelpSessionTimelineEvent(
          label: 'Zoom prepared',
          timezone: 'UTC',
        ),
      );
      break;
    case ProjectHelpSessionStatus.schedulingFailed:
      events.add(
        const HelpSessionTimelineEvent(
          label: 'Zoom setup delayed',
          timezone: 'UTC',
        ),
      );
      break;
    case ProjectHelpSessionStatus.scheduled:
      events.add(
        HelpSessionTimelineEvent(
          label: 'Session scheduled',
          timestamp: session.selectedStartsAt,
          timezone: tz,
        ),
      );
      break;
    case ProjectHelpSessionStatus.declined:
      events.add(
        HelpSessionTimelineEvent(
          label: 'Request declined',
          timestamp: session.declinedAt,
          timezone: tz,
        ),
      );
      break;
    case ProjectHelpSessionStatus.cancelled:
      events.add(
        HelpSessionTimelineEvent(
          label: 'Session cancelled',
          timestamp: session.cancelledAt,
          timezone: tz,
        ),
      );
      break;
    case ProjectHelpSessionStatus.completed:
      events.add(
        HelpSessionTimelineEvent(
          label: 'Session completed',
          timestamp: session.completedAt,
          timezone: tz,
        ),
      );
      break;
  default:
      break;
  }

  if (events.isNotEmpty) {
    final last = events.last;
    events[events.length - 1] = HelpSessionTimelineEvent(
      label: last.label,
      timestamp: last.timestamp,
      timezone: last.timezone,
      isCurrent: true,
    );
    for (var i = 0; i < events.length - 1; i++) {
      final e = events[i];
      events[i] = HelpSessionTimelineEvent(
        label: e.label,
        timestamp: e.timestamp,
        timezone: e.timezone,
      );
    }
  }

  return _localizeEvents(events, session);
}

List<HelpSessionTimelineEvent> _localizeEvents(
  List<HelpSessionTimelineEvent> events,
  ProjectHelpSession session,
) {
  // Labels are localized at render time via a map in timeline widget - keep English keys here
  // and localize in HelpSessionTimeline using context. For simplicity return as-is;
  // HelpSessionTimeline will use localized labels from a switch.
  return events;
}

String localizedTimelineLabel(String key, bool isArabic) {
  return switch (key) {
    'Request sent' => isArabic ? 'تم إرسال الطلب' : 'Request sent',
    'Alternative proposed' =>
      isArabic ? 'تم اقتراح موعد بديل' : 'Alternative proposed',
    'Time confirmed' => isArabic ? 'تم تأكيد الموعد' : 'Time confirmed',
    'Zoom prepared' => isArabic ? 'جارٍ تجهيز Zoom' : 'Zoom prepared',
    'Zoom setup delayed' =>
      isArabic ? 'تأخر تجهيز Zoom' : 'Zoom setup delayed',
    'Session scheduled' => isArabic ? 'الجلسة مجدولة' : 'Session scheduled',
    'Request declined' => isArabic ? 'تم رفض الطلب' : 'Request declined',
    'Session cancelled' => isArabic ? 'تم إلغاء الجلسة' : 'Session cancelled',
    'Session completed' => isArabic ? 'اكتملت الجلسة' : 'Session completed',
    _ => key,
  };
}
