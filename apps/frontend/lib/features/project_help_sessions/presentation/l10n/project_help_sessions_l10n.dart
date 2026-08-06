import '../../../../shared/models/localized_text.dart';
import '../../data/models/project_help_session_models.dart';

export '../../../../shared/models/localized_text.dart';

class ProjectHelpSessionsL10n {
  const ProjectHelpSessionsL10n._();

  static const listTitle = LocalizedText(
    en: 'Help sessions',
    ar: 'جلسات المساعدة',
  );

  static const listSubtitle = LocalizedText(
    en: 'Track your private help requests and upcoming project sessions.',
    ar: 'تابع طلباتك ومواعيدك الفردية المرتبطة بالمشاريع التي تنفذها.',
  );

  static const requestCta = LocalizedText(
    en: 'Request a 1-on-1 help session',
    ar: 'طلب جلسة مساعدة فردية',
  );

  static const requestSupporting = LocalizedText(
    en: 'Ask the project creator for help with a specific step or problem.',
    ar: 'اطلب مساعدة من صاحب المشروع في خطوة أو مشكلة محددة.',
  );

  static const disabledCopy = LocalizedText(
    en: 'The project creator is not accepting help-session requests right now.',
    ar: 'صاحب المشروع لا يستقبل طلبات جلسات حاليًا.',
  );

  static const unavailableCopy = LocalizedText(
    en: 'Help sessions are unavailable for this project.',
    ar: 'جلسات المساعدة غير متاحة لهذا المشروع.',
  );

  static const viewSession = LocalizedText(
    en: 'View session',
    ar: 'عرض الجلسة',
  );

  static const sendRequest = LocalizedText(
    en: 'Send session request',
    ar: 'إرسال طلب الجلسة',
  );

  static const problemLabel = LocalizedText(
    en: 'What do you need help with?',
    ar: 'ما المشكلة التي تحتاج مساعدة فيها؟',
  );

  static const problemHelper = LocalizedText(
    en: 'Explain what you tried and where you got stuck so the project creator can prepare.',
    ar: 'اشرح ما جربته وأين توقفت حتى يستطيع صاحب المشروع الاستعداد للجلسة.',
  );

  static const generalQuestion = LocalizedText(
    en: 'General project question',
    ar: 'سؤال عام عن المشروع',
  );

  static const slot1 = LocalizedText(en: 'Option 1', ar: 'الموعد الأول');
  static const slot2 = LocalizedText(en: 'Option 2', ar: 'الموعد الثاني');
  static const slot3 = LocalizedText(en: 'Option 3', ar: 'الموعد الثالث');

  static const selectDate = LocalizedText(en: 'Select date', ar: 'اختر التاريخ');
  static const selectTime = LocalizedText(en: 'Select time', ar: 'اختر الوقت');
  static const editSlot = LocalizedText(en: 'Edit', ar: 'تعديل');

  static const emptyTitle = LocalizedText(
    en: 'No help sessions yet',
    ar: 'لا توجد جلسات مساعدة بعد',
  );

  static const emptyBody = LocalizedText(
    en: 'When you request a session from a project you are building, it will appear here.',
    ar: 'عندما تطلب جلسة من داخل مشروع تنفذه، ستظهر هنا.',
  );

  static const backToProjects = LocalizedText(
    en: 'Back to my projects',
    ar: 'العودة إلى مشاريعي',
  );

  static const backToSessions = LocalizedText(
    en: 'Back to help sessions',
    ar: 'العودة إلى جلسات المساعدة',
  );

  static const joinZoom = LocalizedText(
    en: 'Join Zoom',
    ar: 'الانضمام إلى Zoom',
  );

  static const joinOpensLater = LocalizedText(
    en: 'Join opens closer to the session start time.',
    ar: 'يفتح الانضمام قبل موعد الجلسة بقليل.',
  );

  static const zoomPreparing = LocalizedText(
    en: 'Preparing Zoom meeting',
    ar: 'جارٍ تجهيز اجتماع Zoom',
  );

  static const zoomPreparingBody = LocalizedText(
    en: 'The time is confirmed. The Join button will appear once the meeting is ready.',
    ar: 'تم تأكيد الموعد وسيظهر زر الانضمام بعد اكتمال تجهيز الاجتماع.',
  );

  static const zoomDelayed = LocalizedText(
    en: 'Meeting setup delayed',
    ar: 'تأخر تجهيز الاجتماع',
  );

  static const zoomDelayedBody = LocalizedText(
    en: 'Your time is saved, but the Zoom link is not ready yet. The project creator can retry setup.',
    ar: 'تم حفظ الموعد، لكن رابط Zoom لم يجهز بعد. يستطيع صاحب المشروع إعادة المحاولة.',
  );

  static const acceptAlternativeTitle = LocalizedText(
    en: 'Confirm alternative time',
    ar: 'تأكيد الموعد البديل',
  );

  static const acceptAlternativeBody = LocalizedText(
    en: 'This time will be confirmed and a Zoom meeting will be prepared.',
    ar: 'سيتم اعتماد هذا الموعد وتجهيز اجتماع Zoom.',
  );

  static const confirmTime = LocalizedText(
    en: 'Confirm time',
    ar: 'تأكيد الموعد',
  );

  static const rejectAlternativeTitle = LocalizedText(
    en: 'Reject alternative time?',
    ar: 'رفض الموعد البديل؟',
  );

  static const rejectAlternativeBody = LocalizedText(
    en: 'This help session request will be closed. You can send a new request later.',
    ar: 'سيتم إغلاق طلب الجلسة الحالي، ويمكنك إرسال طلب جديد لاحقًا.',
  );

  static const rejectTime = LocalizedText(
    en: 'Reject time',
    ar: 'رفض الموعد',
  );

  static const cancelTitle = LocalizedText(
    en: 'Cancel help session?',
    ar: 'إلغاء جلسة المساعدة؟',
  );

  static const cancelConfirmedWarning = LocalizedText(
    en: 'The scheduled time and Zoom meeting will be cancelled and the project creator will be notified.',
    ar: 'سيتم إلغاء الموعد واجتماع Zoom وإبلاغ صاحب المشروع.',
  );

  static const confirmCancel = LocalizedText(
    en: 'Confirm cancellation',
    ar: 'تأكيد الإلغاء',
  );

  static const cancelReasonLabel = LocalizedText(
    en: 'Reason (optional)',
    ar: 'السبب (اختياري)',
  );

  static const cancelReasonRequired = LocalizedText(
    en: 'Reason',
    ar: 'السبب',
  );

  static const declinedTitle = LocalizedText(
    en: 'Help session request declined',
    ar: 'تعذر قبول طلب الجلسة',
  );

  static const joinNotYet = LocalizedText(
    en: 'It is not time to join yet.',
    ar: 'لم يحن وقت الانضمام بعد.',
  );

  static const joinClosed = LocalizedText(
    en: 'The join window for this session has closed.',
    ar: 'انتهت فترة الانضمام إلى هذه الجلسة.',
  );

  static const joinLaunchFailed = LocalizedText(
    en: 'Could not open Zoom. Try again.',
    ar: 'تعذر فتح Zoom. حاول مرة أخرى.',
  );

  static const zoomDeleteFailed = LocalizedText(
    en: 'Could not cancel the Zoom meeting right now. The session was not cancelled. Try again.',
    ar: 'تعذر إلغاء اجتماع Zoom حاليًا. لم يتم إلغاء الجلسة، حاول مرة أخرى.',
  );

  static const waitingForCreator = LocalizedText(
    en: 'Waiting for project creator',
    ar: 'بانتظار صاحب المشروع',
  );

  static const youCancelled = LocalizedText(en: 'You', ar: 'أنت');
  static const creatorCancelled = LocalizedText(
    en: 'Project creator',
    ar: 'صاحب المشروع',
  );

  static const completedTitle = LocalizedText(
    en: 'Help session completed',
    ar: 'اكتملت جلسة المساعدة',
  );

  static const completedLearnerBody = LocalizedText(
    en:
        'You can now record what you learned and your next steps in your private Project Notebook.',
    ar:
        'يمكنك الآن تسجيل ما تعلمته والخطوات التالية في دفتر المشروع الخاص بك.',
  );

  static const addSessionNotesToNotebook = LocalizedText(
    en: 'Add session notes to Project Notebook',
    ar: 'إضافة ملاحظات الجلسة إلى دفتر المشروع',
  );

  static const openProjectNotebook = LocalizedText(
    en: 'Open Project Notebook',
    ar: 'فتح دفتر المشروع',
  );

  static const completionSectionTitle = LocalizedText(
    en: 'Complete help session',
    ar: 'إكمال جلسة المساعدة',
  );

  static const completionSectionBody = LocalizedText(
    en: 'You can complete the session after its scheduled end time.',
    ar: 'يمكنك إكمال الجلسة بعد انتهاء موعدها المحدد.',
  );

  static const markSessionCompleted = LocalizedText(
    en: 'Mark session as completed',
    ar: 'تحديد الجلسة كمكتملة',
  );

  static const completionConfirmTitle = LocalizedText(
    en: 'Complete help session?',
    ar: 'إكمال جلسة المساعدة؟',
  );

  static const completionConfirmBody = LocalizedText(
    en:
        'The session will be closed and the learner will be notified. The Zoom link will no longer be available from ImpactLoop.',
    ar:
        'سيتم إغلاق الجلسة وإبلاغ المتعلم، ولن يعود رابط Zoom متاحًا من ImpactLoop.',
  );

  static const completionConfirmPrimary = LocalizedText(
    en: 'Confirm completion',
    ar: 'تأكيد الإكمال',
  );

  static const completionAvailableAt = LocalizedText(
    en: 'Completion available at',
    ar: 'يصبح الإكمال متاحًا في',
  );

  static const sessionNotCompletableYet = LocalizedText(
    en: 'The session can be completed after its scheduled end time.',
    ar: 'يمكن إكمال الجلسة بعد انتهاء موعدها المحدد.',
  );

  static const retry = LocalizedText(en: 'Retry', ar: 'إعادة المحاولة');

  static const filterAll = LocalizedText(en: 'All', ar: 'الكل');
  static const filterActive = LocalizedText(en: 'Active', ar: 'نشطة');
  static const filterScheduled = LocalizedText(en: 'Scheduled', ar: 'مجدولة');
  static const filterCompleted = LocalizedText(en: 'Completed', ar: 'مكتملة');
  static const filterClosed = LocalizedText(en: 'Cancelled/Declined', ar: 'ملغاة/مرفوضة');

  static const authorListTitle = LocalizedText(
    en: 'Project help requests',
    ar: 'طلبات جلسات المشاريع',
  );

  static const authorListSubtitle = LocalizedText(
    en: 'Review learner requests, choose a time, and start scheduled Zoom sessions.',
    ar: 'راجع طلبات المتعلمين، اختر موعدًا مناسبًا، وابدأ جلسات Zoom المجدولة.',
  );

  static const authorEmptyTitle = LocalizedText(
    en: 'No help session requests yet',
    ar: 'لا توجد طلبات جلسات',
  );

  static const authorEmptyBody = LocalizedText(
    en: 'Learner requests for projects you created will appear here when help sessions are enabled.',
    ar: 'ستظهر هنا طلبات المتعلمين للمشاريع التي أنشأتها عندما تفعّل جلسات المساعدة.',
  );

  static const manageMyProjects = LocalizedText(
    en: 'Manage my projects',
    ar: 'إدارة مشاريعي',
  );

  static const authorFilterNew = LocalizedText(en: 'New requests', ar: 'طلبات جديدة');
  static const authorFilterWaiting = LocalizedText(
    en: 'Waiting for learner',
    ar: 'بانتظار المتعلم',
  );
  static const authorFilterNeedsAction = LocalizedText(
    en: 'Needs action',
    ar: 'تحتاج إجراء',
  );
  static const authorFilterClosed = LocalizedText(en: 'Closed', ar: 'منتهية');

  static const settingsTitle = LocalizedText(
    en: 'Help-session settings',
    ar: 'إعدادات جلسات المساعدة',
  );

  static const settingsDescription = LocalizedText(
    en: 'You can receive private help sessions from learners building this project. You can pause new requests at any time.',
    ar: 'يمكنك استقبال طلبات جلسات فردية من المتعلمين الذين ينفذون هذا المشروع. يمكنك إيقاف الطلبات في أي وقت.',
  );

  static const settingsEnable = LocalizedText(
    en: 'Enable 1-on-1 help sessions',
    ar: 'إتاحة جلسات المساعدة الفردية',
  );

  static const settingsDurations = LocalizedText(
    en: 'Available session durations',
    ar: 'مدد الجلسات المتاحة',
  );

  static const settingsWeeklyLimit = LocalizedText(
    en: 'Weekly session limit',
    ar: 'الحد الأسبوعي للجلسات',
  );

  static const settingsPrivacy = LocalizedText(
    en: 'Your email and phone are never shown to learners. ImpactLoop coordinates requests and schedules, and Zoom is created after a time is confirmed.',
    ar: 'لن يتم عرض بريدك الإلكتروني أو رقم هاتفك للمتعلم. تنظم ImpactLoop الطلب والموعد، ويتم إنشاء اجتماع Zoom بعد تأكيد الموعد.',
  );

  static const settingsSave = LocalizedText(en: 'Save settings', ar: 'حفظ الإعدادات');

  static const settingsAvailable = LocalizedText(en: 'Available', ar: 'متاحة');
  static const settingsPaused = LocalizedText(en: 'Paused', ar: 'متوقفة');

  static const submissionSettingsLink = LocalizedText(
    en: 'Help-session settings',
    ar: 'إعدادات جلسات المساعدة',
  );

  static const acceptSelectedTime = LocalizedText(
    en: 'Accept selected time',
    ar: 'قبول الموعد المحدد',
  );

  static const proposeAlternative = LocalizedText(
    en: 'Propose alternative time',
    ar: 'اقتراح موعد بديل',
  );

  static const declineRequest = LocalizedText(en: 'Decline request', ar: 'رفض الطلب');

  static const acceptConfirmTitle = LocalizedText(
    en: 'Confirm session time',
    ar: 'تأكيد موعد الجلسة',
  );

  static const acceptConfirmBody = LocalizedText(
    en: 'The time will be confirmed and a Zoom meeting will be created automatically.',
    ar: 'سيتم اعتماد الموعد وإنشاء اجتماع Zoom تلقائيًا.',
  );

  static const acceptConfirmPrimary = LocalizedText(
    en: 'Confirm and create meeting',
    ar: 'تأكيد وإنشاء الاجتماع',
  );

  static const alternativeTitle = LocalizedText(
    en: 'Propose alternative time',
    ar: 'اقتراح موعد بديل',
  );

  static const alternativeBody = LocalizedText(
    en: 'Choose one time for the learner to accept or reject.',
    ar: 'اختر موعدًا واحدًا ليؤكده المتعلم أو يرفضه.',
  );

  static const alternativeSend = LocalizedText(
    en: 'Send alternative time',
    ar: 'إرسال الموعد البديل',
  );

  static const waitingLearnerAlternative = LocalizedText(
    en: 'Waiting for the learner to respond to the alternative time',
    ar: 'بانتظار رد المتعلم على الموعد البديل',
  );

  static const declineTitle = LocalizedText(
    en: 'Decline help session request?',
    ar: 'رفض طلب الجلسة؟',
  );

  static const declineBody = LocalizedText(
    en: 'The request will be closed and the learner will be notified. They can send a new request later.',
    ar: 'سيتم إغلاق الطلب وإبلاغ المتعلم. يمكنه إرسال طلب جديد لاحقًا.',
  );

  static const declinePrimary = LocalizedText(en: 'Decline request', ar: 'رفض الطلب');

  static const zoomRetryTitle = LocalizedText(
    en: 'Could not prepare Zoom meeting',
    ar: 'تعذر تجهيز اجتماع Zoom',
  );

  static const zoomRetryBody = LocalizedText(
    en: 'The time is saved, but meeting creation did not finish. Retry without changing the time.',
    ar: 'تم حفظ الموعد، لكن إنشاء الاجتماع لم يكتمل. أعد المحاولة دون تغيير الموعد.',
  );

  static const zoomRetryAction = LocalizedText(
    en: 'Retry creating meeting',
    ar: 'إعادة محاولة إنشاء الاجتماع',
  );

  static const acceptSchedulingFailed = LocalizedText(
    en: 'The time was confirmed, but Zoom meeting setup failed.',
    ar: 'تم تأكيد الموعد، لكن تعذر تجهيز اجتماع Zoom.',
  );

  static const startZoom = LocalizedText(en: 'Start Zoom session', ar: 'بدء جلسة Zoom');

  static const startZoomSoon = LocalizedText(
    en: 'The Start button becomes available 15 minutes before the session.',
    ar: 'سيصبح زر البدء متاحًا قبل الموعد بـ15 دقيقة.',
  );

  static const startLaunchFailed = LocalizedText(
    en: 'Could not open Zoom. Try again.',
    ar: 'تعذر فتح جلسة Zoom. حاول مرة أخرى.',
  );

  static const viewDetails = LocalizedText(en: 'View details', ar: 'عرض التفاصيل');

  static LocalizedText authorStatusLabel(ProjectHelpSessionStatus status) =>
      statusLabel(status);

  static LocalizedText statusLabel(ProjectHelpSessionStatus status) {
    return switch (status) {
      ProjectHelpSessionStatus.pending => const LocalizedText(
          en: 'Pending',
          ar: 'قيد الانتظار',
        ),
      ProjectHelpSessionStatus.alternativeProposed => const LocalizedText(
          en: 'Alternative proposed',
          ar: 'موعد بديل مقترح',
        ),
      ProjectHelpSessionStatus.zoomPending => const LocalizedText(
          en: 'Preparing meeting',
          ar: 'تجهيز الاجتماع',
        ),
      ProjectHelpSessionStatus.schedulingFailed => const LocalizedText(
          en: 'Setup delayed',
          ar: 'تأخر الإعداد',
        ),
      ProjectHelpSessionStatus.scheduled => const LocalizedText(
          en: 'Scheduled',
          ar: 'مجدولة',
        ),
      ProjectHelpSessionStatus.declined => const LocalizedText(
          en: 'Declined',
          ar: 'مرفوضة',
        ),
      ProjectHelpSessionStatus.cancelled => const LocalizedText(
          en: 'Cancelled',
          ar: 'ملغاة',
        ),
      ProjectHelpSessionStatus.completed => const LocalizedText(
          en: 'Completed',
          ar: 'مكتملة',
        ),
    };
  }

  static LocalizedText durationLabel(int minutes) => LocalizedText(
        en: '$minutes min',
        ar: '$minutes د',
      );

  static LocalizedText timezoneDisplay(String timezone) => LocalizedText(
        en: 'Times will be shown in: $timezone',
        ar: 'سيتم عرض المواعيد حسب المنطقة الزمنية: $timezone',
      );

  static String errorMessage(String? code) {
    return switch (code) {
      'HELP_SESSIONS_DISABLED' =>
        'صاحب المشروع لا يستقبل طلبات جلسات حاليًا.',
      'AUTHOR_UNAVAILABLE' => 'جلسات المساعدة غير متاحة لهذا المشروع.',
      'BUILD_NOT_ELIGIBLE' => 'لا يمكن طلب جلسة لهذا التنفيذ حاليًا.',
      'ACTIVE_SESSION_EXISTS' =>
        'لديك طلب جلسة نشط لهذا المشروع بالفعل.',
      'DURATION_NOT_ALLOWED' => 'مدة الجلسة المختارة غير متاحة.',
      'WEEKLY_LIMIT_REACHED' =>
        'وصلت إلى الحد الأسبوعي للجلسات في هذا الأسبوع.',
      'INVALID_TIME_OPTIONS' ||
      'OPTION_NOT_AVAILABLE' =>
        'لم يعد هذا الموعد متاحًا للاختيار. حدّث الطلب وحاول مجددًا.',
      'TIME_SLOT_UNAVAILABLE' => 'هذا الموعد لم يعد متاحًا. اختر موعدًا آخر.',
      'SESSION_NOT_JOINABLE_YET' => 'لم يحن وقت الانضمام بعد.',
      'SESSION_JOIN_WINDOW_CLOSED' =>
        'انتهت فترة الانضمام إلى هذه الجلسة.',
      'SESSION_NOT_STARTABLE_YET' => 'لم يحن وقت بدء الجلسة بعد.',
      'SESSION_START_WINDOW_CLOSED' => 'انتهت فترة بدء هذه الجلسة.',
      'SESSION_NOT_COMPLETABLE_YET' =>
        'يمكن إكمال الجلسة بعد انتهاء موعدها المحدد.',
      'ZOOM_MEETING_NOT_FOUND' =>
        'لم يعد اجتماع Zoom متاحًا. تحقق من حالة الجلسة.',
      'HELP_SESSION_NO_DURATION_ENABLED' =>
        'يجب تفعيل مدة جلسة واحدة على الأقل.',
      'HELP_SESSION_WEEKLY_LIMIT_OUT_OF_RANGE' =>
        'الحد الأسبوعي يجب أن يكون بين 1 و10.',
      'ZOOM_DELETE_FAILED' =>
        'تعذر إلغاء اجتماع Zoom حاليًا. لم يتم إلغاء الجلسة، حاول مرة أخرى.',
      'ZOOM_CREATE_FAILED' ||
      'ZOOM_UNAVAILABLE' ||
      'ZOOM_AUTH_FAILED' ||
      'ZOOM_SCHEDULING_FAILED' ||
      'ZOOM_PERSISTENCE_FAILED' ||
      'ZOOM_DISABLED' ||
      'SCHEDULING_FAILED' =>
        'تعذر تجهيز رابط الاجتماع حاليًا. سيظهر الرابط بعد اكتمال الإعداد.',
      _ => '',
    };
  }

  static String errorMessageEn(String? code) {
    return switch (code) {
      'HELP_SESSIONS_DISABLED' =>
        'The project creator is not accepting help-session requests right now.',
      'AUTHOR_UNAVAILABLE' =>
        'Help sessions are unavailable for this project.',
      'BUILD_NOT_ELIGIBLE' =>
        'This build is not eligible for a help session right now.',
      'ACTIVE_SESSION_EXISTS' =>
        'You already have an active help session for this project.',
      'DURATION_NOT_ALLOWED' => 'The selected session duration is not available.',
      'WEEKLY_LIMIT_REACHED' =>
        'You reached the weekly session limit for this week.',
      'INVALID_TIME_OPTIONS' ||
      'OPTION_NOT_AVAILABLE' =>
        'This time option is no longer available. Refresh and try again.',
      'TIME_SLOT_UNAVAILABLE' =>
        'This time slot is no longer available. Choose another one.',
      'SESSION_NOT_JOINABLE_YET' => 'It is not time to join yet.',
      'SESSION_JOIN_WINDOW_CLOSED' =>
        'The join window for this session has closed.',
      'SESSION_NOT_STARTABLE_YET' => 'It is not time to start the session yet.',
      'SESSION_START_WINDOW_CLOSED' =>
        'The start window for this session has closed.',
      'SESSION_NOT_COMPLETABLE_YET' =>
        'The session can be completed after its scheduled end time.',
      'ZOOM_MEETING_NOT_FOUND' =>
        'The Zoom meeting is no longer available. Check the session status.',
      'HELP_SESSION_NO_DURATION_ENABLED' =>
        'At least one session duration must be enabled.',
      'HELP_SESSION_WEEKLY_LIMIT_OUT_OF_RANGE' =>
        'Weekly limit must be between 1 and 10.',
      'ZOOM_DELETE_FAILED' =>
        'Could not cancel the Zoom meeting right now. The session was not cancelled. Try again.',
      'ZOOM_CREATE_FAILED' ||
      'ZOOM_UNAVAILABLE' ||
      'ZOOM_AUTH_FAILED' ||
      'ZOOM_SCHEDULING_FAILED' ||
      'ZOOM_PERSISTENCE_FAILED' ||
      'ZOOM_DISABLED' ||
      'SCHEDULING_FAILED' =>
        'Meeting setup is delayed. The join link will appear once setup completes.',
      _ => '',
    };
  }

  static LocalizedText localizedError(String? code) => LocalizedText(
        en: errorMessageEn(code).isEmpty
            ? 'Something went wrong. Please try again.'
            : errorMessageEn(code),
        ar: errorMessage(code).isEmpty
            ? 'حدث خطأ. حاول مرة أخرى.'
            : errorMessage(code),
      );
}
