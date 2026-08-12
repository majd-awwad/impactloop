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

  static const selectDate = LocalizedText(
    en: 'Select date',
    ar: 'اختر التاريخ',
  );
  static const selectTime = LocalizedText(en: 'Select time', ar: 'اختر الوقت');
  static const selectDateAndTime = LocalizedText(
    en: 'Select date and time',
    ar: 'اختر التاريخ والوقت',
  );
  static const editSlot = LocalizedText(en: 'Edit', ar: 'تعديل');

  static const privateSessionNote = LocalizedText(
    en: 'Private session with the project creator',
    ar: 'جلسة خاصة مع صاحب المشروع',
  );

  static LocalizedText projectCreatorLabel(String displayName) => LocalizedText(
    en: 'Project creator: $displayName',
    ar: 'صاحب المشروع: $displayName',
  );

  static const requestSubmittedSuccess = LocalizedText(
    en: 'Help session request sent.',
    ar: 'تم إرسال طلب الجلسة.',
  );

  static const settingsSavedSuccess = LocalizedText(
    en: 'Help session settings saved.',
    ar: 'تم حفظ إعدادات الجلسات.',
  );

  static const dismissError = LocalizedText(en: 'Dismiss', ar: 'إغلاق');

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

  static LocalizedText joinOpensAt(String value) => LocalizedText(
    en: 'Join opens at $value.',
    ar: 'يفتح الانضمام في $value.',
  );

  static const noShowWindowHint = LocalizedText(
    en: 'If the other participant does not attend, reporting will become available after the join window closes.',
    ar: 'إذا لم يحضر الطرف الآخر، سيظهر خيار الإبلاغ بعد انتهاء نافذة الانضمام.',
  );

  static const reportAuthorNoShow = LocalizedText(
    en: 'Report that the project creator did not attend',
    ar: 'الإبلاغ عن عدم حضور صاحب المشروع',
  );

  static const reportLearnerNoShow = LocalizedText(
    en: 'Report that the learner did not attend',
    ar: 'الإبلاغ عن عدم حضور المتعلم',
  );

  static const noShowConfirmTitle = LocalizedText(
    en: 'Submit a no-show report?',
    ar: 'إرسال بلاغ عدم حضور؟',
  );

  static const noShowConfirmBody = LocalizedText(
    en: 'Confirm only if the other participant did not attend during the full join window.',
    ar: 'أكّد فقط إذا لم يحضر الطرف الآخر طوال نافذة الانضمام كاملة.',
  );

  static const noShowConfirmAction = LocalizedText(
    en: 'Submit report',
    ar: 'إرسال البلاغ',
  );

  static const noShowReported = LocalizedText(
    en: 'No-show report submitted.',
    ar: 'تم إرسال بلاغ عدم الحضور.',
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

  static const rejectTime = LocalizedText(en: 'Reject time', ar: 'رفض الموعد');

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

  static const cancelRequest = LocalizedText(
    en: 'Cancel request',
    ar: 'إلغاء الطلب',
  );

  static const cancelReasonLabel = LocalizedText(
    en: 'Reason (optional)',
    ar: 'السبب (اختياري)',
  );

  static const cancelReasonRequired = LocalizedText(en: 'Reason', ar: 'السبب');

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

  static const creatorSuggestedDifferentTime = LocalizedText(
    en: 'The project creator suggested a different time.',
    ar: 'اقترح صاحب المشروع موعدًا مختلفًا.',
  );

  static const meetingBeingPrepared = LocalizedText(
    en: 'Meeting is being prepared.',
    ar: 'جارٍ تجهيز الاجتماع.',
  );

  static const zoomBeingCreated = LocalizedText(
    en: 'Zoom meeting is being created.',
    ar: 'جارٍ إنشاء اجتماع Zoom.',
  );

  static const sessionCancelledOverview = LocalizedText(
    en: 'This help session was cancelled.',
    ar: 'تم إلغاء جلسة المساعدة هذه.',
  );

  static const activeSessionTitle = LocalizedText(
    en: 'Help session request',
    ar: 'طلب جلسة مساعدة',
  );

  static const sessionManagement = LocalizedText(
    en: 'Session management',
    ar: 'إدارة الجلسة',
  );

  static const nextStep = LocalizedText(en: 'Next step', ar: 'الخطوة التالية');

  static const acceptSelectedTimeHint = LocalizedText(
    en: 'Select one of the proposed times to enable acceptance.',
    ar: 'اختر أحد المواعيد المقترحة لتفعيل القبول.',
  );

  static const backToProject = LocalizedText(
    en: 'Back to project',
    ar: 'العودة إلى المشروع',
  );

  static LocalizedText learnerLabel(String displayName) =>
      LocalizedText(en: 'Learner: $displayName', ar: 'المتعلم: $displayName');

  static const youCancelled = LocalizedText(en: 'You', ar: 'أنت');
  static const creatorCancelled = LocalizedText(
    en: 'Project creator',
    ar: 'صاحب المشروع',
  );

  static const cancelledByYou = LocalizedText(
    en: 'Cancelled by you',
    ar: 'ألغيتَ الطلب',
  );

  static const cancelledByProjectCreator = LocalizedText(
    en: 'Cancelled by project creator',
    ar: 'ألغاه صاحب المشروع',
  );

  static const cancelledByLearner = LocalizedText(
    en: 'Cancelled by learner',
    ar: 'ألغاه المتعلم',
  );

  static const requestAlreadySubmitted = LocalizedText(
    en: 'Your session request was already submitted.',
    ar: 'تم إرسال طلب الجلسة بالفعل.',
  );

  static const completedTitle = LocalizedText(
    en: 'Help session completed',
    ar: 'اكتملت جلسة المساعدة',
  );

  static const completedLearnerBody = LocalizedText(
    en: 'You can now record what you learned and your next steps in your private Project Notebook.',
    ar: 'يمكنك الآن تسجيل ما تعلمته والخطوات التالية في دفتر المشروع الخاص بك.',
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

  static const markSessionCompleted  static const markSessionCompleted = LocalizedText(
    en: 'Mark session as completed',
    ar: 'تحديد الجلسة كمكتملة',
  );

  static const completionConfirmTitle = LocalizedText(
    en: 'Complete help session?',
    ar: 'إكمال جلسة المساعدة؟',
  );

  static const completionConfirmBody = LocalizedText(
    en: 'The session will be closed and the learner will be notified. The Zoom link will no longer be available from ImpactLoop.',
    ar: 'سيتم إغلاق الجلسة وإبلاغ المتعلم، ولن يعود رابط Zoom متاحًا من ImpactLoop.',
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
  static const filterClosed = LocalizedText(
    en: 'Cancelled/Declined',
    ar: 'ملغاة/مرفوضة',
  );

  static const authorListTitle = LocalizedText(
    en: 'Project help requests',
    ar: 'طلبات جلسات المشاريع',
  );

  static const authorListSubtitle = LocalizedText(
    en: 'Review learner requests, choose a time, and join scheduled Zoom sessions.',
    ar: 'راجع طلبات المتعلمين، اختر موعدًا مناسبًا، وانضم إلى جلسات Zoom المجدولة.',
  );

  static const submissionsHelpRequestsAction = LocalizedText(
    en: 'Project help requests',
    ar: 'طلبات جلسات المشاريع',
  );

  static const viewHelpRequestsAction = LocalizedText(
    en: 'View help requests',
    ar: 'عرض طلبات الجلسات',
  );

  static const notificationOpenUnavailable = LocalizedText(
    en: 'This help session notification cannot be opened right now.',
    ar: 'تعذر فتح إشعار جلسة المساعدة حاليًا.',
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

  static const authorFilterNew = LocalizedText(
    en: 'New requests',
    ar: 'طلبات جديدة',
  );
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

  static const settingsSave = LocalizedText(
    en: 'Save settings',
    ar: 'حفظ الإعدادات',
  );

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

  static const declineRequest = LocalizedText(
    en: 'Decline request',
    ar: 'رفض الطلب',
  );

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

  static const declinePrimary = LocalizedText(
    en: 'Decline request',
    ar: 'رفض الطلب',
  );

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

  static const viewDetails = LocalizedText(
    en: 'View details',
    ar: 'عرض التفاصيل',
  );

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

  static LocalizedText durationLabel(int minutes) =>
      LocalizedText(en: '$minutes min', ar: '$minutes د');

  static LocalizedText timezoneDisplay(String timezone) => LocalizedText(
    en: 'Times will be shown in: $timezone',
    ar: 'سيتم عرض المواعيد حسب المنطقة الزمنية: $timezone',
  );

  static String errorMessage(String? code) {
    return switch (code) {
      'HELP_SESSIONS_DISABLED' => 'صاحب المشروع لا يستقبل طلبات جلسات حاليًا.',
      'AUTHOR_UNAVAILABLE' => 'جلسات المساعدة غير متاحة لهذا المشروع.',
      'BUILD_NOT_ELIGIBLE' => 'لا يمكن طلب جلسة لهذا التنفيذ حاليًا.',
      'ACTIVE_SESSION_EXISTS' => 'لديك طلب جلسة نشط لهذا المشروع بالفعل.',
      'DURATION_NOT_ALLOWED' => 'مدة الجلسة المختارة غير متاحة.',
      'WEEKLY_LIMIT_REACHED' =>
        'وصلت إلى الحد الأسبوعي للجلسات في هذا الأسبوع.',
      'INVALID_TIME_OPTIONS' || 'OPTION_NOT_AVAILABLE' =>
        'لم يعد هذا الموعد متاحًا للاختيار. حدّث الطلب وحاول مجددًا.',
      'TIME_SLOT_UNAVAILABLE' => 'هذا الموعد لم يعد متاحًا. اختر موعدًا آخر.',
      'SESSION_NOT_JOINABLE_YET' => 'لم يحن وقت الانضمام بعد.',
      'SESSION_JOIN_WINDOW_CLOSED' => 'انتهت فترة الانضمام إلى هذه الجلسة.',
      'SESSION_NOT_COMPLETABLE_YET' =>
        'يمكن إكمال الجلسة بعد انتهاء موعدها المحدد.',
      'SESSION_CANCELLATION_WINDOW_CLOSED' =>
        'لم يعد إلغاء الجلسة متاحًا بعد فتح نافذة الانضمام.',
      'SESSION_NO_SHOW_NOT_AVAILABLE' =>
        'يصبح الإبلاغ عن عدم الحضور متاحًا بعد انتهاء نافذة الانضمام.',
      'ZOOM_MEETING_NOT_FOUND' =>
        'لم يعد اجتماع Zoom متاحًا. تحقق من حالة الجلسة.',
      'ZOOM_NOT_READY' => 'رابط اجتماع Zoom غير جاهز بعد.',
      'HELP_SESSION_NO_DURATION_ENABLED' =>
        'يجب تفعيل مدة جلسة واحدة على الأقل.',
      'HELP_SESSION_WEEKLY_LIMIT_OUT_OF_RANGE' =>
        'الحد الأسبوعي يجب أن يكون بين 1 و10.',
      'ZOOM_DELETE_FAILED' =>
        'تعذر إلغاء اجتماع Zoom حاليًا. لم يتم إلغاء الجلسة، حاول مرة أخرى.',
      'ZOOM_CREATE_FAILED' ||
      'ZOOM_UNAVAILABLE' ||
      'ZOOM_AUTH_FAILED' ||
      'ZOOM_GET_FAILED' ||
      'ZOOM_RESPONSE_INVALID' ||
      'ZOOM_SCHEDULING_FAILED' ||
      'ZOOM_PERSISTENCE_FAILED' ||
      'ZOOM_DISABLED' ||
      'SCHEDULING_FAILED' =>
        'تعذر تجهيز رابط الاجتماع حاليًا. سيظهر الرابط بعد اكتمال الإعداد.',
      'TIMEOUT' =>
        'استغرق تجهيز رابط Zoom وقتًا أطول من المعتاد. انتظر قليلًا ثم حاول مرة أخرى.',
      'NETWORK_ERROR' =>
        'تعذر الاتصال بالخادم. تحقق من الاتصال وحاول مرة أخرى.',
      'VALIDATION_ERROR' => 'تحقق من الحقول المطلوبة وحاول مرة أخرى.',
      'INVALID_SESSION_STATE' ||
      'HELP_SESSION_INVALID_STATE' => 'لا يمكن إلغاء الجلسة في حالتها الحالية.',
      'INTERNAL_ERROR' => 'حدث خطأ غير متوقع. حاول مرة أخرى.',
      'PROJECT_HELP_SESSION_NOT_FOUND' ||
      'NOT_FOUND' => 'تعذر العثور على الجلسة.',
      _ => '',
    };
  }

  static String errorMessageEn(String? code) {
    return switch (code) {
      'HELP_SESSIONS_DISABLED' =>
        'The project creator is not accepting help-session requests right now.',
      'AUTHOR_UNAVAILABLE' => 'Help sessions are unavailable for this project.',
      'BUILD_NOT_ELIGIBLE' =>
        'This build is not eligible for a help session right now.',
      'ACTIVE_SESSION_EXISTS' =>
        'You already have an active help session for this project.',
      'DURATION_NOT_ALLOWED' =>
        'The selected session duration is not available.',
      'WEEKLY_LIMIT_REACHED' =>
        'You reached the weekly session limit for this week.',
      'INVALID_TIME_OPTIONS' || 'OPTION_NOT_AVAILABLE' =>
        'This time option is no longer available. Refresh and try again.',
      'TIME_SLOT_UNAVAILABLE' =>
        'This time slot is no longer available. Choose another one.',
      'SESSION_NOT_JOINABLE_YET' => 'It is not time to join yet.',
      'SESSION_JOIN_WINDOW_CLOSED' =>
        'The join window for this session has closed.',
      'SESSION_NOT_COMPLETABLE_YET' =>
        'The session can be completed after its scheduled end time.',
      'SESSION_CANCELLATION_WINDOW_CLOSED' =>
        'The session can no longer be cancelled after the join window opens.',
      'SESSION_NO_SHOW_NOT_AVAILABLE' =>
        'No-show reporting becomes available after the join window closes.',
      'ZOOM_MEETING_NOT_FOUND' =>
        'The Zoom meeting is no longer available. Check the session status.',
      'ZOOM_NOT_READY' => 'The Zoom meeting link is not ready yet.',
      'HELP_SESSION_NO_DURATION_ENABLED' =>
        'At least one session duration must be enabled.',
      'HELP_SESSION_WEEKLY_LIMIT_OUT_OF_RANGE' =>
        'Weekly limit must be between 1 and 10.',
      'ZOOM_DELETE_FAILED' =>
        'Could not cancel the Zoom meeting right now. The session was not cancelled. Try again.',
      'ZOOM_CREATE_FAILED' ||
      'ZOOM_UNAVAILABLE' ||
      'ZOOM_AUTH_FAILED' ||
      'ZOOM_GET_FAILED' ||
      'ZOOM_RESPONSE_INVALID' ||
      'ZOOM_SCHEDULING_FAILED' ||
      'ZOOM_PERSISTENCE_FAILED' ||
      'ZOOM_DISABLED' ||
      'SCHEDULING_FAILED' =>
        'Meeting setup is delayed. The join link will appear once setup completes.',
      'TIMEOUT' =>
        'Zoom is taking longer than usual. Wait a moment and try again.',
      'NETWORK_ERROR' =>
        'Could not reach the server. Check your connection and try again.',
      'VALIDATION_ERROR' => 'Check the required fields and try again.',
      'INVALID_SESSION_STATE' || 'HELP_SESSION_INVALID_STATE' =>
        'This session cannot be cancelled in its current state.',
      'INTERNAL_ERROR' => 'Something unexpected went wrong. Please try again.',
      'PROJECT_HELP_SESSION_NOT_FOUND' ||
      'NOT_FOUND' => 'The help session could not be found.',
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
