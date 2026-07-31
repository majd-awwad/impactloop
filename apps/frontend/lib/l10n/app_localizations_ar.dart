// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appTitle => 'ImpactLoop';

  @override
  String get unknownStatus => 'حالة غير معروفة';

  @override
  String get somethingWentWrong => 'حدث خطأ ما. يُرجى المحاولة مرة أخرى.';

  @override
  String get networkError =>
      'تعذّر الاتصال بالخادم. تحقّق من اتصالك بالإنترنت وحاول مرة أخرى.';

  @override
  String get timeoutError =>
      'استغرق الخادم وقتًا طويلًا للاستجابة. يُرجى المحاولة مرة أخرى.';

  @override
  String get serverError => 'حدثت مشكلة في الخادم. يُرجى المحاولة بعد قليل.';

  @override
  String get sessionExpired =>
      'انتهت صلاحية جلستك. يُرجى تسجيل الدخول مرة أخرى.';

  @override
  String get forbiddenError => 'ليست لديك صلاحية لإكمال هذا الإجراء.';

  @override
  String get conflictError =>
      'يتعارض هذا الطلب مع الحالة الحالية. حدّث الصفحة وحاول مرة أخرى.';

  @override
  String get validationError => 'تحقّق من المعلومات المحددة وحاول مرة أخرى.';

  @override
  String get accountSuspended => 'تم تعليق حسابك. تواصل مع مسؤول النظام.';

  @override
  String get pickupWindowRequired =>
      'اختر وقت بدء وانتهاء جديدًا للاستلام قبل إرسال طلب إعادة الجدولة.';

  @override
  String get invalidPickupWindow => 'موعد الاستلام غير صالح. اختر موعدًا آخر.';

  @override
  String get invalidValue => 'قيمة غير صالحة';

  @override
  String get completeRequiredDetail => 'أكمل هذا الحقل المطلوب قبل المتابعة.';

  @override
  String currencyNis(String amount) {
    return '$amount شيكل';
  }

  @override
  String distanceKilometers(String distance) {
    return '$distance كم';
  }

  @override
  String quantityWithUnit(String quantity, String unit) {
    return '$quantity $unit';
  }

  @override
  String get notificationFallbackTitle => 'إشعار';

  @override
  String get notificationFallbackBody => 'لديك تحديث جديد.';

  @override
  String get material => 'مادة';

  @override
  String get materials => 'المواد';

  @override
  String get supplier => 'المورّد';

  @override
  String get learner => 'المتعلّم';

  @override
  String get learningHub => 'مركز التعلّم';

  @override
  String get learningProject => 'مشروع تعليمي';

  @override
  String get requiredComponent => 'مكوّن مطلوب';

  @override
  String get reservation => 'حجز';

  @override
  String get reservationRequest => 'طلب حجز';

  @override
  String get pickup => 'الاستلام من المورّد';

  @override
  String get delivery => 'التوصيل';

  @override
  String get driver => 'السائق';

  @override
  String get available => 'متاح';

  @override
  String get reserved => 'محجوز';

  @override
  String get reused => 'أُعيد استخدامها';

  @override
  String get free => 'مجاني';

  @override
  String get paid => 'مدفوع';

  @override
  String get materialCondition => 'حالة المادة';

  @override
  String get sourceType => 'نوع المصدر';

  @override
  String get save => 'حفظ';

  @override
  String get saved => 'محفوظ';

  @override
  String get follow => 'متابعة';

  @override
  String get following => 'تتم متابعته';

  @override
  String get like => 'إعجاب';

  @override
  String get buildProject => 'تنفيذ المشروع';

  @override
  String get buildChecklist => 'قائمة تنفيذ المشروع';

  @override
  String get submission => 'مشروع مُرسَل للمراجعة';

  @override
  String get changesRequested => 'مطلوب إجراء تعديلات';

  @override
  String get pendingReview => 'قيد المراجعة';

  @override
  String get pickupMissed => 'فات موعد الاستلام';

  @override
  String get filterAll => 'الكل';

  @override
  String get filterActive => 'نشط';

  @override
  String get filterNeedsAction => 'يتطلب إجراءً';

  @override
  String get filterPending => 'قيد الانتظار';

  @override
  String get filterAccepted => 'مقبول';

  @override
  String get filterCompleted => 'مكتمل';

  @override
  String get filterClosed => 'مغلق';

  @override
  String get statusPendingSupplier => 'بانتظار رد المورّد';

  @override
  String get statusNeedsConfirmation => 'يتطلب تأكيدك';

  @override
  String get statusWaitingSupplier => 'بانتظار رد المورّد';

  @override
  String get statusWaitingSupplierWindow =>
      'بانتظار أن يختار المورّد موعد استلام جديدًا';

  @override
  String get statusAcceptedPickup => 'مقبول / جاهز للاستلام';

  @override
  String get statusAccepted => 'مقبول';

  @override
  String get statusRejected => 'مرفوض';

  @override
  String get statusCompleted => 'مكتمل';

  @override
  String get statusCancelled => 'ملغى';

  @override
  String get statusClosedMissedPickup => 'أُغلق بعد فوات موعد الاستلام';

  @override
  String get statusCancelledNoDriver => 'ملغى — لا يتوفر سائق';

  @override
  String get statusCancelledUnresolvedPickup =>
      'ألغاه المسؤول لعدم معالجة مشكلة الاستلام';

  @override
  String get statusExpiredNoResponse => 'منتهي الصلاحية — لم يصل رد';

  @override
  String get statusExpired => 'منتهي الصلاحية';

  @override
  String get statusFulfillmentFailed => 'تعذّر إتمام الطلب';

  @override
  String get statusPendingAdminReview => 'بانتظار مراجعة المسؤول';

  @override
  String get statusReportVerified => 'تم التحقق من البلاغ';

  @override
  String get statusReportDismissed => 'تم رفض البلاغ';

  @override
  String get statusResolvedNoStrike => 'تم الحل دون تسجيل مخالفة';

  @override
  String get statusWaitingDriver => 'بانتظار السائق';

  @override
  String get statusDriverAssigned => 'تم تعيين سائق';

  @override
  String get statusDriverAtPickup => 'وصل السائق إلى موقع الاستلام';

  @override
  String get statusPickedUp => 'تم الاستلام';

  @override
  String get statusOnTheWay => 'في الطريق';

  @override
  String get statusArrivedDropoff => 'وصل إلى موقع التسليم';

  @override
  String get statusDelivered => 'تم التوصيل';

  @override
  String get statusDeliveryCancelled => 'تم إلغاء التوصيل';

  @override
  String get statusPickupFailed => 'تعذّر الاستلام';

  @override
  String get statusDeliveryFailed => 'تعذّر التوصيل';

  @override
  String get statusDriverNoShow => 'لم يحضر السائق';

  @override
  String get statusLearnerNoShow => 'لم يحضر المتعلّم';

  @override
  String get statusNeedsAdminReview => 'يتطلب مراجعة المسؤول';

  @override
  String get statusInDelivery => 'قيد التوصيل';

  @override
  String get statusNoDriverAvailable => 'لا يتوفر سائق';

  @override
  String get statusDriverPickupOverdue => 'تأخر السائق عن الاستلام';

  @override
  String get statusDeliveryIssueReported => 'تم الإبلاغ عن مشكلة في التوصيل';

  @override
  String get statusDriverNotAssignedInTime =>
      'لم يتم تعيين سائق في الوقت المحدد';

  @override
  String get statusPickupNotCompleted => 'لم يكتمل الاستلام';

  @override
  String get statusAtSupplierPickup => 'في موقع استلام المورّد';

  @override
  String get statusPickupWindowPassed => 'فات موعد الاستلام';

  @override
  String get preferredDelivery => 'التوصيل المفضّل';

  @override
  String get requestedPickup => 'الاستلام المطلوب';

  @override
  String additionalWindows(int count) {
    return '+$count أخرى';
  }

  @override
  String deliveryAddressLabel(String address) {
    return 'عنوان التوصيل: $address';
  }

  @override
  String get safeDropoffAllowed => 'يُسمح بالتسليم في مكان آمن';

  @override
  String get safeDropoffNotAllowed => 'لا يُسمح بالتسليم في مكان آمن';

  @override
  String get justNow => 'الآن';

  @override
  String minutesAgo(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count دقيقة',
      many: '$count دقيقة',
      few: '$count دقائق',
      two: 'دقيقتين',
      one: 'دقيقة واحدة',
    );
    return 'قبل $_temp0';
  }

  @override
  String hoursAgo(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ساعة',
      many: '$count ساعة',
      few: '$count ساعات',
      two: 'ساعتين',
      one: 'ساعة واحدة',
    );
    return 'قبل $_temp0';
  }

  @override
  String daysAgo(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count يوم',
      many: '$count يومًا',
      few: '$count أيام',
      two: 'يومين',
      one: 'يوم واحد',
    );
    return 'قبل $_temp0';
  }

  @override
  String get notificationsTitle => 'الإشعارات';

  @override
  String get notificationsSubtitle =>
      'تحديثات الحجوزات والتوصيل والمشاريع والحساب.';

  @override
  String get notificationsLoading => 'جارٍ تحميل الإشعارات…';

  @override
  String get notificationsLoadingSubtitle => 'جارٍ جلب أحدث التحديثات.';

  @override
  String get notificationsLoadError => 'تعذّر تحميل الإشعارات.';

  @override
  String get tryAgain => 'يُرجى المحاولة مرة أخرى.';

  @override
  String get retry => 'إعادة المحاولة';

  @override
  String get refresh => 'تحديث';

  @override
  String get markAllRead => 'تحديد الكل كمقروء';

  @override
  String get filterUnread => 'غير مقروءة';

  @override
  String get filterRead => 'مقروءة';

  @override
  String get noUnreadNotifications => 'لا توجد إشعارات غير مقروءة.';

  @override
  String get allCaughtUp => 'اطّلعت على جميع التحديثات حتى الآن.';

  @override
  String get noReadNotifications => 'لا توجد إشعارات مقروءة بعد.';

  @override
  String get openedNotificationsAppearHere =>
      'ستظهر الإشعارات التي فتحتها هنا.';

  @override
  String get noNotifications => 'لا توجد إشعارات بعد.';

  @override
  String get notificationsAppearHere => 'ستظهر تحديثاتك هنا.';

  @override
  String get loadMore => 'تحميل المزيد';

  @override
  String notificationCount(int visible, int total) {
    return 'يتم عرض $visible من أصل $total إشعارًا.';
  }

  @override
  String get notificationChipJob => 'مهمة';

  @override
  String get notificationChipReminder => 'تذكير';

  @override
  String get notificationChipDelivery => 'تحديث التوصيل';

  @override
  String get notificationChipAccount => 'الحساب';

  @override
  String get notificationChipUpdate => 'تحديث';

  @override
  String get viewJobs => 'عرض المهام';

  @override
  String get viewDetails => 'عرض التفاصيل';

  @override
  String get viewDelivery => 'عرض التوصيل';

  @override
  String get viewReservation => 'عرض الحجز';

  @override
  String get viewSubmission => 'عرض المشروع المُرسَل';

  @override
  String get open => 'فتح';

  @override
  String get reservationAcceptedTitle => 'تم قبول الحجز';

  @override
  String reservationAcceptedBody(String materialTitle) {
    return 'تم قبول طلب $materialTitle. تحقّق من تفاصيل الاستلام أو التوصيل.';
  }

  @override
  String get reservationProposalTitle => 'اقترح المورّد موعدًا جديدًا';

  @override
  String reservationProposalBody(String materialTitle) {
    return 'راجع اقتراح المورّد بشأن $materialTitle.';
  }

  @override
  String get reservationDeclinedTitle => 'تم رفض الحجز';

  @override
  String reservationDeclinedBody(String materialTitle) {
    return 'تم رفض طلبك بشأن $materialTitle.';
  }

  @override
  String get reservationExpiredTitle => 'انتهت صلاحية الحجز';

  @override
  String reservationExpiredBody(String materialTitle) {
    return 'انتهت صلاحية طلبك بشأن $materialTitle قبل أن يرد المورّد.';
  }

  @override
  String get notificationReservationRequestedTitle => 'طلب حجز جديد';

  @override
  String notificationReservationRequestedBody(
    String learnerName,
    String materialTitle,
  ) {
    return 'طلب $learnerName $materialTitle.';
  }

  @override
  String get notificationReservationCancelledSupplierTitle => 'تم إلغاء الحجز';

  @override
  String notificationReservationCancelledSupplierBody(
    String learnerName,
    String materialTitle,
  ) {
    return 'ألغى $learnerName طلب $materialTitle.';
  }

  @override
  String get notificationReservationExpiredSupplierTitle =>
      'انتهت صلاحية الحجز';

  @override
  String notificationReservationExpiredSupplierBody(String materialTitle) {
    return 'انتهت صلاحية الطلب المعلّق لـ $materialTitle.';
  }

  @override
  String get notificationChoosePickupWindowTitle => 'اختر موعد استلام جديد';

  @override
  String notificationChoosePickupWindowBody(String materialTitle) {
    return 'اختر موعد استلام جديد لـ $materialTitle.';
  }

  @override
  String get notificationNewPickupWindowNeededTitle => 'يلزم موعد استلام جديد';

  @override
  String notificationNewPickupWindowNeededBody(String materialTitle) {
    return 'يلزم تحديد موعد استلام جديد لـ $materialTitle.';
  }

  @override
  String get notificationCategoryRequestUpdateTitle => 'تحديث طلب الفئة';

  @override
  String get notificationCategoryRequestUpdateBody =>
      'هناك تحديث على طلب الفئة الخاص بك.';

  @override
  String get notificationPriceRequestUpdateTitle => 'تحديث مراجعة السعر';

  @override
  String get notificationPriceRequestUpdateBody =>
      'هناك تحديث على طلب مراجعة السعر الخاص بك.';

  @override
  String get notificationMaterialModerationUpdateTitle => 'تحديث مراجعة المادة';

  @override
  String get notificationMaterialModerationUpdateBody =>
      'هناك تحديث على إدراج المادة الخاص بك.';

  @override
  String get notificationSupplierVerificationUpdateTitle => 'تحديث التحقق';

  @override
  String get notificationSupplierVerificationUpdateBody =>
      'هناك تحديث على التحقق من حساب المورّد الخاص بك.';

  @override
  String get reservationAlreadyAccepted => 'تم قبول هذا الحجز مسبقًا.';

  @override
  String get reservationAlreadyDeclined => 'تم رفض هذا الحجز مسبقًا.';

  @override
  String get reservationExpiredError =>
      'انتهت صلاحية هذا الحجز قبل إمكانية تحديثه.';

  @override
  String get reservationCancelledError => 'تم إلغاء هذا الحجز ولا يمكن تحديثه.';

  @override
  String get reservationNotPending =>
      'يمكن تنفيذ هذا الإجراء على الحجوزات قيد الانتظار فقط.';

  @override
  String get projectModerationTitle => 'تم تحديث مراجعة المشروع';

  @override
  String projectModerationBody(String projectTitle) {
    return 'تم تحديث حالة مراجعة $projectTitle.';
  }

  @override
  String get projectApprovedTitle => 'تم اعتماد المشروع التعليمي';

  @override
  String projectApprovedBody(String projectTitle) {
    return 'تم اعتماد $projectTitle ونشره الآن في مركز التعلّم.';
  }

  @override
  String get projectChangesRequestedTitle => 'مطلوب إجراء تعديلات على مشروعك';

  @override
  String projectChangesRequestedBody(String projectTitle) {
    return 'يحتاج $projectTitle إلى تعديلات قبل نشره.';
  }

  @override
  String get projectRejectedTitle => 'تم رفض المشروع التعليمي';

  @override
  String projectRejectedBody(String projectTitle) {
    return 'لم تتم الموافقة على $projectTitle.';
  }

  @override
  String get projectHiddenTitle => 'تم إلغاء نشر المشروع التعليمي';

  @override
  String projectHiddenBody(String projectTitle) {
    return 'تم إخفاء $projectTitle من مركز التعلّم.';
  }

  @override
  String get projectRestoredTitle => 'تمت استعادة المشروع التعليمي';

  @override
  String projectRestoredBody(String projectTitle) {
    return 'أُعيد نشر $projectTitle في مركز التعلّم.';
  }

  @override
  String get projectArchivedTitle => 'تمت أرشفة المشروع التعليمي';

  @override
  String projectArchivedBody(String projectTitle) {
    return 'تمت أرشفة $projectTitle وإزالته من مركز التعلّم.';
  }

  @override
  String projectModerationFeedback(String summary, String feedback) {
    return '$summary ملاحظات المراجع: $feedback';
  }

  @override
  String get addDraftPhoneTitle => 'إضافة مشروع';

  @override
  String get draftCategoryLoadError => 'تعذّر تحميل الفئات';

  @override
  String get draftCategoryLoading => 'جارٍ تحميل الفئات…';

  @override
  String get draftSelectCategory => 'اختر فئة';

  @override
  String get draftProjectTitleLabel => 'عنوان المشروع';

  @override
  String get draftProjectTitleHint => 'محطة طقس صفية تعمل بالطاقة الشمسية';

  @override
  String get draftCategoryLabel => 'الفئة';

  @override
  String get draftShortDescriptionLabel => 'وصف قصير';

  @override
  String get draftShortDescriptionHint => 'لخّص ما سينفّذه المتعلّم.';

  @override
  String get draftFullDescriptionLabel => 'الوصف الكامل (اختياري)';

  @override
  String get draftFullDescriptionHint => 'اشرح هدف المشروع والنتيجة المتوقعة.';

  @override
  String get draftStepsLabel => 'خطوات التنفيذ';

  @override
  String get draftStepsHint =>
      'اكتب خطوة واحدة في كل سطر. لا حاجة إلى كتابة الخطوة 1.\nصِل المستشعر باللوحة.\nثبّت المكوّنات.\nاختبر القراءات.';

  @override
  String get draftLinksLabel => 'روابط مفيدة';

  @override
  String get draftLinksHint => 'https://example.com/reference-guide';

  @override
  String get draftSaving => 'جارٍ حفظ المسودة…';

  @override
  String get draftSave => 'حفظ المسودة';

  @override
  String get draftSavedMessage =>
      'تم حفظ المسودة. يمكنك إضافة الصور وإرسالها للمراجعة عندما تصبح جاهزة.';

  @override
  String get draftSelectAvailableCategoryBeforeSave =>
      'اختر فئة مشروع متاحة قبل الحفظ.';

  @override
  String get draftMinimumContentBeforeSave =>
      'أضف 10 أحرف على الأقل من محتوى المشروع قبل الحفظ.';

  @override
  String get draftComponentRequired => 'أضف مكوّنًا واحدًا على الأقل مع اسمه.';

  @override
  String get draftComponentLimit => 'استخدم 50 مكوّنًا أو أقل.';

  @override
  String get draftComponentUnique => 'يجب أن يكون لكل مكوّن اسم فريد.';

  @override
  String get draftFullDescriptionMinimum =>
      'استخدم 10 أحرف على الأقل عند إضافة وصف كامل.';

  @override
  String get draftFullDescriptionMaximum =>
      'اجعل الوصف الكامل أقل من 10000 حرف.';

  @override
  String get draftTitleRequired => 'عنوان المشروع مطلوب.';

  @override
  String get draftMinimumThreeCharacters => 'استخدم 3 أحرف على الأقل.';

  @override
  String get draftTitleMaximum => 'اجعل العنوان أقل من 200 حرف.';

  @override
  String get draftSummaryRequired => 'الوصف القصير مطلوب.';

  @override
  String get draftMinimumTenCharacters => 'استخدم 10 أحرف على الأقل.';

  @override
  String get draftSummaryMaximum => 'اجعل الوصف القصير أقل من 500 حرف.';

  @override
  String get draftCategoriesCouldNotLoad => 'تعذّر تحميل فئات المشاريع.';

  @override
  String get draftCategoriesUnavailable => 'فئات المشاريع غير متاحة بعد.';

  @override
  String get draftSelectAvailableCategory => 'اختر فئة متاحة.';

  @override
  String get draftStepsMaximum => 'استخدم 100 خطوة أو أقل.';

  @override
  String get draftStepMaximum => 'اجعل كل خطوة أقل من 5000 حرف.';

  @override
  String get draftLinksMaximum => 'استخدم 20 رابطًا أو أقل.';

  @override
  String get draftLinksInvalid =>
      'استخدم روابط http أو https صالحة، رابطًا واحدًا في كل سطر.';

  @override
  String get draftComponentNameRequired => 'اسم المكوّن مطلوب.';

  @override
  String get draftComponentNameMaximum => 'اجعل اسم كل مكوّن أقل من 200 حرف.';

  @override
  String get draftQuantityPositive => 'يجب أن تكون الكمية أكبر من صفر.';

  @override
  String get draftValidUnit => 'اختر وحدة صالحة.';

  @override
  String get draftNotesMaximum => 'اجعل الملاحظات أقل من 1000 حرف.';

  @override
  String get draftKeywordsMaximum =>
      'استخدم ما يصل إلى 5 كلمات مفتاحية لكل مكوّن.';

  @override
  String get draftKeywordMaximum => 'اجعل كل كلمة مفتاحية أقل من 80 حرفًا.';

  @override
  String get draftValidMaterialCategory =>
      'اختر فئة مواد صالحة أو اتركها بلا تحديد.';

  @override
  String get pickupWindowNotSet => 'لم يُحدّد موعد الاستلام';

  @override
  String yourPreferredPickupWindow(String window) {
    return 'موعد الاستلام المفضّل لديك: $window';
  }

  @override
  String supplierProposedPickupWindow(String window) {
    return 'موعد الاستلام الذي اقترحه المورّد: $window';
  }

  @override
  String supplierDriverPickupWindow(String window) {
    return 'موعد استلام سائق المورّد: $window';
  }

  @override
  String earliestPossibleDelivery(String dateTime) {
    return 'أقرب موعد توصيل ممكن: $dateTime';
  }

  @override
  String supplierProposedDeliveryWindow(String window) {
    return 'موعد التوصيل الذي اقترحه المورّد: $window';
  }

  @override
  String confirmedDeliveryWindow(String window) {
    return 'موعد التوصيل المؤكّد: $window';
  }

  @override
  String supplierPickupWindow(String window) {
    return 'موعد الاستلام من المورّد: $window';
  }

  @override
  String previousPreferredDeliveryWindow(String window) {
    return 'موعد التوصيل المفضّل السابق لديك: $window';
  }

  @override
  String confirmedPickupWindow(String window) {
    return 'موعد الاستلام المؤكّد: $window';
  }

  @override
  String selectedDeliveryWindow(String window) {
    return 'موعد التوصيل المحدّد: $window';
  }

  @override
  String get learnerAccountRequired => 'يلزم حساب متعلّم';

  @override
  String get learnerAccountRequiredReservations =>
      'استخدم حساب متعلّم لعرض حجوزات المواد.';

  @override
  String get myReservations => 'حجوزاتي';

  @override
  String get reservationsSubtitle =>
      'تابع الطلبات ومواعيد الاستلام وتحديثات التوصيل.';

  @override
  String get loadingReservations => 'جارٍ تحميل الحجوزات';

  @override
  String get loadingReservationsSubtitle =>
      'جارٍ التحقق من أحدث نشاط للحجوزات.';

  @override
  String get reservationsLoadError => 'تعذّر تحميل الحجوزات';

  @override
  String get noReservations => 'لا توجد حجوزات بعد';

  @override
  String get noReservationsSubtitle =>
      'احجز مادة متاحة وستظهر تحديثات المورّد هنا.';

  @override
  String get browseMaterials => 'تصفّح المواد';

  @override
  String get noMatchingReservations => 'لا توجد حجوزات مطابقة';

  @override
  String get noMatchingReservationsSubtitle =>
      'جرّب مرشحًا آخر أو تصفّح المواد لبدء طلب جديد.';

  @override
  String get deliveryUpdatesUnavailable => 'تحديثات التوصيل غير متاحة مؤقتًا.';

  @override
  String get tryAgainAction => 'حاول مرة أخرى';

  @override
  String get fulfillmentMethod => 'طريقة استلام الطلب';

  @override
  String get supplierIssueReportedAdmin => 'تم إبلاغ الإدارة بمشكلة المورّد.';

  @override
  String get noDriverReportedAdmin => 'تم إبلاغ الإدارة بعدم توفر سائق.';

  @override
  String get supplierPickupCodeInstructions =>
      'أعطِ هذا الرمز للمورّد عند استلام المادة.';

  @override
  String pickupAddressValue(String address) {
    return 'عنوان الاستلام: $address';
  }

  @override
  String get pickupWindowPassedFollowup =>
      'فات موعد الاستلام. تواصل مع المورّد أو انتظر المتابعة.';

  @override
  String get viewMaterial => 'عرض المادة';

  @override
  String get cancelRequest => 'إلغاء الطلب';

  @override
  String get reservationCancelledFeedback => 'تم إلغاء الحجز.';

  @override
  String get keepRequest => 'الاحتفاظ بالطلب';

  @override
  String get cancelReservationQuestion => 'هل تريد إلغاء الحجز؟';

  @override
  String get close => 'إغلاق';

  @override
  String get cancelReleasesQuantity =>
      'ستُعاد الكمية المطلوبة إلى المادة المعروضة.';

  @override
  String requestedQuantityLabel(String quantity) {
    return 'الكمية المطلوبة: $quantity';
  }

  @override
  String yourRescheduleRequest(String reason) {
    return 'طلبك لتغيير الموعد: $reason';
  }

  @override
  String get requestReschedule => 'طلب تغيير الموعد';

  @override
  String get reasonRequired => 'السبب (مطلوب)';

  @override
  String get noteOptional => 'ملاحظة (اختيارية)';

  @override
  String get noteRequired => 'ملاحظة (مطلوبة)';

  @override
  String get pickProposedStart => 'اختيار بداية الموعد المقترح';

  @override
  String proposedStart(String dateTime) {
    return 'البداية: $dateTime';
  }

  @override
  String get pickProposedEnd => 'اختيار نهاية الموعد المقترح';

  @override
  String proposedEnd(String dateTime) {
    return 'النهاية: $dateTime';
  }

  @override
  String get rescheduleReasonWindowRequired =>
      'أدخل سببًا واختر موعد الاستلام.';

  @override
  String get endAfterStart => 'يجب أن يكون وقت النهاية بعد وقت البداية.';

  @override
  String get pickupWindowTooClose =>
      'اختر موعد استلام يتيح وقتًا كافيًا لإتمام التسليم.';

  @override
  String get sendRequest => 'إرسال الطلب';

  @override
  String get rescheduleSent => 'تم إرسال طلب تغيير الموعد إلى المورّد.';

  @override
  String get supplierUnavailable => 'المورّد غير متاح';

  @override
  String get materialNotReady => 'المادة غير جاهزة';

  @override
  String get wrongPickupInformation => 'معلومات الاستلام غير صحيحة';

  @override
  String get other => 'أخرى';

  @override
  String get reportSupplierIssue => 'الإبلاغ عن مشكلة مع المورّد';

  @override
  String get reportSupplierDescription =>
      'أبلغ الإدارة بمشكلة مع المورّد. سيُغلق الحجز مؤقتًا بانتظار المراجعة.';

  @override
  String get reason => 'السبب';

  @override
  String get describeWhatHappened => 'صف ما حدث';

  @override
  String get submitReport => 'إرسال البلاغ';

  @override
  String get reportNoDriverAvailable => 'الإبلاغ عن عدم توفر سائق';

  @override
  String get reportNoDriverDescription =>
      'لم يقبل أي سائق طلب التوصيل. أرسل بلاغًا لمراجعة الإدارة.';

  @override
  String get actionRequired => 'إجراء مطلوب';

  @override
  String get pickupTimeAccepted => 'تم قبول موعد الاستلام.';

  @override
  String get deliveryWindowAfterEarliest =>
      'يجب أن ينتهي الموعد المحدد بعد أقرب وقت ممكن للتوصيل.';

  @override
  String get deliveryWindowSubmitted => 'تم إرسال موعد التوصيل.';

  @override
  String get cancelReservation => 'إلغاء الحجز';

  @override
  String get acceptProposedTime => 'قبول الموعد المقترح';

  @override
  String get newDeliveryWindow => 'موعد توصيل جديد';

  @override
  String get submitNewDeliveryWindow => 'إرسال موعد التوصيل الجديد';

  @override
  String get pickupIncompleteAdminReview =>
      'لم يكتمل الاستلام قبل نهاية موعد المورّد. قد تراجع الإدارة الحالة إذا لم يبلّغ أحد عن المشكلة.';

  @override
  String get driverPickupIncompleteAdminReview =>
      'لم يُكمل السائق المعيّن الاستلام من المورّد قبل نهاية الموعد. قد تراجع الإدارة الحالة إذا لم يبلّغ أحد عن المشكلة.';

  @override
  String schedulingConflict(String reason) {
    return 'تعارض في الموعد: $reason';
  }

  @override
  String get reservationWaitingSupplierMessage => 'بانتظار رد المورّد.';

  @override
  String get reservationScheduleNeedsConfirmation =>
      'اقترح المورّد موعدًا يحتاج إلى تأكيدك.';

  @override
  String get reservationRescheduleWaitingSupplier =>
      'طلبت موعد استلام جديدًا. بانتظار رد المورّد.';

  @override
  String get reservationReportedAwaitingAdmin =>
      'تم الإبلاغ عن هذا الحجز وهو بانتظار مراجعة الإدارة.';

  @override
  String get reservationReportVerifiedMessage => 'تحققت الإدارة من صحة بلاغك.';

  @override
  String get reservationReportDismissedMessage => 'راجعت الإدارة بلاغك ورفضته.';

  @override
  String get reservationIncidentResolvedMessage =>
      'حُلّت هذه المشكلة دون تسجيل مخالفة.';

  @override
  String get reservationAcceptedPickupMessage =>
      'تم قبول الحجز. اتبع موعد الاستلام الذي حدده المورّد.';

  @override
  String get reservationRejectedSupplierMessage => 'رفض المورّد طلب الحجز.';

  @override
  String get reservationCompletedMessage => 'اكتمل هذا الحجز.';

  @override
  String get reservationCancelledMessage => 'تم إلغاء هذا الحجز.';

  @override
  String get reservationMissedPickupExpiredMessage =>
      'انتهت صلاحية الحجز بعد فوات موعد الاستلام دون متابعة. أنشئ حجزًا جديدًا إذا كنت لا تزال بحاجة إلى المادة.';

  @override
  String get reservationSupplierNoResponseExpired =>
      'انتهت صلاحية الطلب لأن المورّد لم يرد في الوقت المحدد.';

  @override
  String get reservationExpiredMessage => 'انتهت صلاحية هذا الحجز.';

  @override
  String supplierQuantityLine(String supplier, String quantity) {
    return 'المورّد: $supplier · المطلوب: $quantity';
  }

  @override
  String get deliveryInProgress => 'التوصيل قيد التنفيذ';

  @override
  String get deliveryScheduled => 'تمت جدولة التوصيل';

  @override
  String get deliveryReservation => 'حجز مع التوصيل';

  @override
  String get deliverySelectedAtReservation => 'تم اختيار التوصيل عند الحجز';

  @override
  String get deliveryRequestedStatus => 'تم طلب التوصيل';

  @override
  String get deliveryAvailable => 'التوصيل متاح';

  @override
  String get pickupOnly => 'الاستلام من المورّد فقط';

  @override
  String get combinedDelivery => 'توصيل مجمّع';

  @override
  String combinedDeliveryItems(int count) {
    return '$count عناصر في هذه المجموعة';
  }

  @override
  String combinedDeliveryTotal(String currency, String amount) {
    return 'إجمالي المجموعة $currency $amount';
  }

  @override
  String get combinedDeliveryFeeOnce =>
      'تُحتسب رسوم التوصيل مرة واحدة للمجموعة';

  @override
  String get welcomeBack => 'مرحبًا بعودتك';

  @override
  String get loginSubtitle =>
      'سجّل الدخول لمتابعة اكتشاف المواد وتنفيذ المشاريع بنفايات أقل.';

  @override
  String get email => 'البريد الإلكتروني';

  @override
  String get emailHint => 'you@example.com';

  @override
  String get password => 'كلمة المرور';

  @override
  String get emailRequired => 'البريد الإلكتروني مطلوب';

  @override
  String get validEmailRequired => 'أدخل عنوان بريد إلكتروني صالحًا';

  @override
  String get passwordRequired => 'كلمة المرور مطلوبة';

  @override
  String get invalidCredentials =>
      'البريد الإلكتروني أو كلمة المرور غير صحيحة.';

  @override
  String get forgotPasswordQuestion => 'هل نسيت كلمة المرور؟';

  @override
  String get signIn => 'تسجيل الدخول';

  @override
  String get newToImpactLoop => 'جديد في ImpactLoop؟';

  @override
  String get createAccount => 'إنشاء حساب';

  @override
  String get resetYourPassword => 'إعادة تعيين كلمة المرور';

  @override
  String get forgotPasswordSubtitle =>
      'أدخل البريد الإلكتروني لحسابك وسنرسل تعليمات إعادة التعيين إذا كان الحساب موجودًا.';

  @override
  String get forgotPasswordSuccess =>
      'إذا كان هناك حساب مرتبط بهذا البريد، فقد تم إرسال تعليمات إعادة التعيين.';

  @override
  String get backToSignIn => 'العودة إلى تسجيل الدخول';

  @override
  String get sendResetInstructions => 'إرسال تعليمات إعادة التعيين';

  @override
  String get createNewPassword => 'إنشاء كلمة مرور جديدة';

  @override
  String get resetPasswordSubtitle =>
      'اختر كلمة مرور جديدة لحسابك. لا يمكن استخدام رابط إعادة التعيين إلا مرة واحدة.';

  @override
  String get resetLinkInvalid => 'رابط إعادة التعيين مفقود أو غير صالح.';

  @override
  String get passwordUpdated =>
      'تم تحديث كلمة المرور. سجّل الدخول باستخدام كلمة المرور الجديدة.';

  @override
  String get goToSignIn => 'الانتقال إلى تسجيل الدخول';

  @override
  String get newPassword => 'كلمة المرور الجديدة';

  @override
  String get confirmPassword => 'تأكيد كلمة المرور';

  @override
  String get newPasswordRequired => 'كلمة المرور الجديدة مطلوبة';

  @override
  String get passwordMinLength => 'يجب ألا تقل كلمة المرور عن 8 أحرف';

  @override
  String get confirmNewPassword => 'أكّد كلمة المرور الجديدة';

  @override
  String get passwordsDoNotMatch => 'كلمتا المرور غير متطابقتين';

  @override
  String get resetPasswordAction => 'إعادة تعيين كلمة المرور';

  @override
  String get showPassword => 'إظهار كلمة المرور';

  @override
  String get hidePassword => 'إخفاء كلمة المرور';

  @override
  String get createYourAccount => 'أنشئ حسابك';

  @override
  String get registerSubtitle =>
      'حدّد كيف تريد استخدام ImpactLoop وأكمل ملفك الشخصي في خطوة واحدة.';

  @override
  String get alreadyHaveAccount => 'لديك حساب بالفعل؟';

  @override
  String get home => 'الرئيسية';

  @override
  String get learning => 'التعلّم';

  @override
  String get reservations => 'الحجوزات';

  @override
  String get profile => 'الملف الشخصي';

  @override
  String get settings => 'الإعدادات';

  @override
  String get menu => 'القائمة';

  @override
  String get account => 'الحساب';

  @override
  String get logout => 'تسجيل الخروج';

  @override
  String get loggingOut => 'جارٍ تسجيل الخروج…';

  @override
  String get signedOutOffline =>
      'تم تسجيل خروجك محليًا، لكن تعذّر الاتصال بالخادم.';

  @override
  String get learnReuseBuild => 'تعلّم. أعد الاستخدام. نفّذ.';

  @override
  String get themeSystem => 'النظام';

  @override
  String get themeLight => 'فاتح';

  @override
  String get themeDark => 'داكن';

  @override
  String homeGreeting(String name) {
    return 'مرحبًا بعودتك، $name';
  }

  @override
  String get homeHeroTitle => 'هل أنت مستعد لتنفيذ مشروع اليوم؟';

  @override
  String get homeHeroSubtitle =>
      'اعثر على مواد قابلة لإعادة الاستخدام، واستكشف أفكار المشاريع، وتابع الحجوزات والتوصيل من مكان واحد.';

  @override
  String get browseMaterialsAction => 'تصفّح المواد';

  @override
  String get exploreLearningHub => 'استكشف مركز التعلّم';

  @override
  String get quickActions => 'إجراءات سريعة';

  @override
  String get quickActionsSubtitle => 'ابدأ بالخدمات المتاحة اليوم.';

  @override
  String get browseAll => 'عرض الكل';

  @override
  String get browseProjects => 'تصفّح المشاريع';

  @override
  String get openMaterials => 'فتح المواد';

  @override
  String get openLearningHub => 'فتح مركز التعلّم';

  @override
  String get backToHome => 'العودة إلى الرئيسية';

  @override
  String get recommendationsLoadError => 'تعذّر تحميل التوصيات';

  @override
  String get recommendationsLoadErrorSubtitle =>
      'حاول مرة أخرى بعد قليل أو ارجع إلى الصفحة الرئيسية.';

  @override
  String get showUpTo => 'عرض حتى';

  @override
  String get addInterestsPrompt => 'أضف اهتماماتك لتحسين التوصيات.';

  @override
  String get editLearnerProfile => 'تعديل ملف المتعلّم';

  @override
  String get sectionSuggestedMaterialsTitle => 'مواد مقترحة لك';

  @override
  String get sectionSuggestedMaterialsSubtitle =>
      'مخصّصة وفق اهتماماتك ومشاريعك المحفوظة ونشاطك الأخير.';

  @override
  String get sectionSuggestedMaterialsEmpty =>
      'اختر اهتماماتك لتحسين الاقتراحات.';

  @override
  String get sectionSavedProjectMaterialsTitle => 'مواد لمشاريعك المحفوظة';

  @override
  String get sectionSavedProjectMaterialsSubtitle =>
      'مواد تطابق مكوّنات مشاريعك التعليمية المحفوظة.';

  @override
  String get sectionSavedProjectMaterialsEmpty =>
      'احفظ مشروعًا تعليميًا لرؤية المواد المطابقة.';

  @override
  String get sectionSuggestedProjectsTitle => 'مشاريع قد تعجبك';

  @override
  String get sectionSuggestedProjectsSubtitle =>
      'مقترحة وفق اهتماماتك والمواد المطابقة المتاحة.';

  @override
  String get sectionSuggestedProjectsEmpty =>
      'اختر اهتماماتك لرؤية توصيات المشاريع.';

  @override
  String get sectionContinueProjectsTitle => 'تابع مشاريعك';

  @override
  String get sectionContinueProjectsSubtitle =>
      'تابع تنفيذ المشاريع التي بدأت بها.';

  @override
  String get sectionContinueProjectsEmpty => 'ابدأ تنفيذ مشروع ليظهر هنا.';

  @override
  String get sectionSavedProjectsTitle => 'المشاريع المحفوظة';

  @override
  String get sectionSavedProjectsSubtitle => 'مشاريع حفظتها لوقت لاحق.';

  @override
  String get sectionSavedProjectsEmpty => 'ستظهر المشاريع المحفوظة هنا.';

  @override
  String get sectionFreeMaterialsTitle => 'مواد مجانية بالقرب منك';

  @override
  String get sectionFreeMaterialsSubtitle =>
      'مواد مجانية متاحة على ImpactLoop.';

  @override
  String get sectionFreeMaterialsEmpty => 'لم نعثر على مواد مجانية قريبة بعد.';

  @override
  String get sectionPopularProjectsTitle => 'المشاريع الشائعة';

  @override
  String get sectionPopularProjectsSubtitle =>
      'مشاريع تعليمية شائعة على ImpactLoop.';

  @override
  String get sectionPopularProjectsEmpty => 'لم نعثر على مشاريع شائعة بعد.';

  @override
  String get reasonSimilarReserved => 'مشابهة لمواد حجزتها';

  @override
  String get reasonRecentActivity => 'تطابق نشاطك الأخير';

  @override
  String get reasonSavedProjects => 'مرتبطة بمشاريعك المحفوظة';

  @override
  String get reasonLikedProjects => 'استنادًا إلى مشاريع أعجبتك';

  @override
  String get reasonFollowedProjects => 'مرتبطة بمشاريع تتابعها';

  @override
  String get reasonMaterialActivity => 'مرتبطة بمواد في نشاطك';

  @override
  String get reasonNearLocation => 'متاحة بالقرب من موقعك المحفوظ';

  @override
  String get reasonFreeMaterial => 'مادة مجانية';

  @override
  String get reasonFreeNearLocation => 'مادة مجانية بالقرب من موقعك المحفوظ';

  @override
  String get reasonDeliveryAvailable => 'التوصيل متاح';

  @override
  String get reasonPopularMaterial => 'مادة شائعة';

  @override
  String get reasonRecentlyAdded => 'أضيفت مؤخرًا';

  @override
  String reasonMatchesInterest(String interest) {
    return 'تطابق اهتمامك بـ $interest';
  }

  @override
  String reasonBuildingCategory(String category) {
    return 'لأنك تنفّذ مشروعًا ضمن فئة $category';
  }

  @override
  String reasonComponentsReady(int ready, int total) {
    return '$ready من أصل $total مكوّنات جاهزة';
  }

  @override
  String get reasonRecommended => 'مقترح لك';

  @override
  String get findReusableMaterials => 'اعثر على مواد قابلة لإعادة الاستخدام';

  @override
  String get browseItems => 'تصفّح العناصر';

  @override
  String get materialsActionDescription =>
      'ابحث في المواد التي يعرضها المورّدون حاليًا.';

  @override
  String get exploreLearningProjects => 'استكشف المشاريع التعليمية';

  @override
  String get exploreProjects => 'استكشف المشاريع';

  @override
  String get learningActionDescription => 'افتح دليل المشاريع في مركز التعلّم.';

  @override
  String get trackPickups => 'تابع الاستلام';

  @override
  String get reservationsActionDescription =>
      'تابع ردود المورّدين ومواعيد استلام المواد المطلوبة.';

  @override
  String get comingLater => 'قريبًا';

  @override
  String get comingLaterSubtitle =>
      'إحصاءات الأثر مخطط لها لكنها غير متاحة بعد.';

  @override
  String get impactSnapshot => 'ملخص الأثر';

  @override
  String get impactSnapshotDescription =>
      'سيظهر أثر إعادة الاستخدام هنا بعد إكمال الحجوزات والمشاريع.';

  @override
  String get landingFutureBadge => 'ابنِ مستقبلًا أفضل';

  @override
  String get landingHeroSubtitle =>
      'اكتشف مواد قابلة لإعادة الاستخدام، وشارك الموارد الفائضة، وحوّلها إلى مشاريع ضمن تجربة مجتمعية أكثر استدامة.';

  @override
  String get landingCtaNote => 'دون بطاقة ائتمان أو ضوضاء. ابدأ التنفيذ فحسب.';

  @override
  String get materialsReused => 'مواد أُعيد استخدامها';

  @override
  String get activeMakers => 'صنّاع نشطون';

  @override
  String get landingCommunity =>
      'انضم إلى مجتمع متنامٍ من الطلبة والصنّاع والمورّدين الذين ينفّذون مشاريع بنفايات أقل.';

  @override
  String get landingFeatureFindTitle => 'اعثر على مواد قابلة لإعادة الاستخدام';

  @override
  String get landingFeatureFindBody =>
      'تصفّح مجموعة واسعة من المواد التي يشاركها مجتمعك.';

  @override
  String get exploreMaterials => 'استكشف المواد';

  @override
  String get landingFeatureShareTitle => 'شارك المواد الفائضة';

  @override
  String get landingFeatureShareBody =>
      'اعرض ما لم تعد تحتاج إليه وساعد الآخرين على تنفيذ المزيد.';

  @override
  String get shareMaterials => 'مشاركة المواد';

  @override
  String get landingFeatureBuildTitle => 'نفّذ مشاريع بنفايات أقل';

  @override
  String get landingFeatureBuildBody =>
      'وفّر المال وقلّل النفايات وحوّل أفكارك الإبداعية إلى واقع.';

  @override
  String get startBuilding => 'ابدأ التنفيذ';

  @override
  String get landingFooter => 'خيارات مستدامة. مجتمعات أقوى. مشاريع أذكى.';

  @override
  String get requestDelivery => 'طلب التوصيل';

  @override
  String requestDeliveryForMaterial(String materialTitle) {
    return 'اختر المكان الذي سيوصل إليه السائق مادة $materialTitle.';
  }

  @override
  String get deliveryRequested => 'تم طلب التوصيل.';

  @override
  String get deliveryRequestFailed => 'تعذّر طلب التوصيل. حاول مرة أخرى.';

  @override
  String get savedAddressesLoadFailed => 'تعذّر تحميل العناوين المحفوظة.';

  @override
  String get noSavedAddresses =>
      'لا توجد عناوين محفوظة بعد. أدخل عنوانًا أدناه.';

  @override
  String get newAddress => 'عنوان جديد';

  @override
  String get savedDropoffAddress => 'عنوان التوصيل المحفوظ';

  @override
  String get chooseSavedDropoffAddress => 'اختر عنوان توصيل محفوظًا.';

  @override
  String get country => 'الدولة';

  @override
  String get city => 'المدينة';

  @override
  String get area => 'المنطقة';

  @override
  String get address => 'العنوان';

  @override
  String get countryAndCityRequired => 'الدولة والمدينة مطلوبتان.';

  @override
  String get useCurrentLocation => 'استخدام الموقع الحالي';

  @override
  String get gettingLocation => 'جارٍ تحديد الموقع…';

  @override
  String get currentLocationCaptured => 'تم تحديد الموقع الحالي.';

  @override
  String get currentLocationFailed => 'تعذّر تحديد موقعك الحالي.';

  @override
  String coordinatesValue(String coordinates) {
    return 'الإحداثيات: $coordinates';
  }

  @override
  String get preciseLocationHelp =>
      'يساعد الموقع الدقيق السائق في الوصول إليك. ويمكنك الاكتفاء بإدخال المدينة والعنوان.';

  @override
  String get saveAddressForLater => 'حفظ هذا العنوان لاستخدامه لاحقًا';

  @override
  String get addressLabel => 'اسم العنوان';

  @override
  String get addressLabelHint => 'المنزل، الجامعة، الورشة…';

  @override
  String get addressLabelRequired => 'أدخل اسمًا لحفظ هذا العنوان.';

  @override
  String get driverNoteOptional => 'ملاحظة للسائق (اختياري)';

  @override
  String get supplierProfile => 'ملف المورّد';

  @override
  String get supplierProfileNotFound => 'لم يتم العثور على ملف المورّد.';

  @override
  String get supplierProfileLoadFailed => 'تعذّر تحميل ملف المورّد.';

  @override
  String get supplierMaterialsLoadFailed => 'تعذّر تحميل مواد المورّد.';

  @override
  String get learnerAccountFollowRequired =>
      'استخدم حساب متعلّم لمتابعة المورّدين.';

  @override
  String publicMaterialsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count مادة عامة',
      many: '$count مادة عامة',
      few: '$count مواد عامة',
      two: 'مادتان عامتان',
      one: 'مادة عامة واحدة',
      zero: 'لا توجد مواد عامة',
    );
    return '$_temp0';
  }

  @override
  String get noPublicMaterials => 'لا توجد مواد عامة متاحة حاليًا.';

  @override
  String get retryLoadingMore => 'إعادة محاولة تحميل المزيد';

  @override
  String get aboutSupplier => 'عن هذا المورّد';

  @override
  String get aboutSupplierDescription =>
      'تصفّح المواد العامة لهذا المورّد وتابع التحديثات عند نشر مخزون جديد.';

  @override
  String get deliveryQuoteFailed =>
      'تعذّر حساب سعر التوصيل. تحقق من موقع التوصيل وحاول مرة أخرى.';

  @override
  String get cannotReserveOwnMaterial => 'لا يمكنك حجز مادة أدرجتها بنفسك.';

  @override
  String get openReservationAlreadyExists =>
      'لديك طلب حجز مفتوح لهذه المادة. راجع حجوزي.';

  @override
  String get materialUnavailableForReservation =>
      'لم تعد هذه المادة متاحة للحجوزات الجديدة.';

  @override
  String get invalidReservationQuantity =>
      'أدخل كمية أكبر من صفر ولا تتجاوز الكمية المتاحة.';

  @override
  String reservationQuantityUpTo(String quantity) {
    return 'هذه الكمية غير متاحة. يمكنك طلب ما يصل إلى $quantity الآن.';
  }

  @override
  String get loadingDelivery => 'جارٍ تحميل التوصيل';

  @override
  String get checkingDeliveryStatus => 'جارٍ التحقق من آخر حالة للتوصيل.';

  @override
  String get deliveryLoadFailed => 'تعذّر تحميل التوصيل';

  @override
  String get deliveryStatusTitle => 'حالة التوصيل';

  @override
  String requestedAt(String dateTime) {
    return 'طُلب في $dateTime';
  }

  @override
  String get assignedDriver => 'السائق المعيّن';

  @override
  String get pickupWindow => 'موعد الاستلام';

  @override
  String get pickupArea => 'منطقة الاستلام';

  @override
  String get dropoff => 'موقع التوصيل';

  @override
  String get driverNote => 'ملاحظة السائق';

  @override
  String get failureReason => 'سبب التعذّر';

  @override
  String get deliveryCodeInstructions =>
      'أعطِ هذا الرمز للسائق عند استلام المادة.';

  @override
  String get backToReservations => 'العودة إلى الحجوزات';

  @override
  String get liveTracking => 'التتبع المباشر';

  @override
  String get driverLocationUpdated => 'تم تحديث موقع السائق مؤخرًا';

  @override
  String get trackDelivery => 'تتبّع التوصيل';

  @override
  String get refreshStatus => 'تحديث الحالة';

  @override
  String get statusTimeline => 'سجل الحالة';

  @override
  String get statusTimelineDescription => 'تحديثات سير عملية التوصيل.';

  @override
  String get loadingTracking => 'جارٍ تحميل تتبع التوصيل…';

  @override
  String get fetchingTracking => 'جارٍ جلب آخر موقع للتوصيل.';

  @override
  String get trackingLoadFailed => 'تعذّر تحميل التتبع.';

  @override
  String get trackingUnavailable => 'التتبع غير متاح بعد';

  @override
  String get waitingDriverLocation => 'بانتظار موقع السائق';

  @override
  String get waitingDriverLocationDescription =>
      'استلم السائق مادتك، وسيظهر موقعه عند مشاركته.';

  @override
  String get driverLocationStale => 'لم يتم تحديث موقع السائق مؤخرًا.';

  @override
  String lastUpdatedAt(String dateTime) {
    return 'آخر تحديث: $dateTime';
  }

  @override
  String get autoUpdateHint =>
      'يتم التحديث تلقائيًا ما دامت هذه الصفحة مفتوحة.';

  @override
  String get refreshing => 'جارٍ التحديث…';

  @override
  String get refreshTracking => 'تحديث التتبع';

  @override
  String get viewDeliveryDetails => 'عرض تفاصيل التوصيل';

  @override
  String driverName(String name) {
    return 'السائق: $name';
  }

  @override
  String deliveryRoute(String pickup, String dropoff) {
    return 'الاستلام: $pickup ← التوصيل: $dropoff';
  }

  @override
  String get pickupLocation => 'موقع الاستلام';

  @override
  String get dropoffLocation => 'موقع التوصيل';

  @override
  String get waitingForDriver => 'بانتظار تعيين سائق.';

  @override
  String get driverAssigned => 'تم تعيين سائق.';

  @override
  String get driverHeadingToPickup => 'السائق في طريقه للاستلام من المورّد.';

  @override
  String get trackingComplete => 'اكتمل التتبع لهذا التوصيل.';

  @override
  String get trackingAvailableAfterPickup =>
      'يصبح موقع السائق متاحًا بعد استلام المادة.';

  @override
  String get driverLocationNotShared =>
      'لم يشارك السائق موقعه بعد. ستظهر تحديثات الموقع هنا عند مشاركته.';

  @override
  String accuracyMeters(String meters) {
    return 'الدقة: نحو $meters متر';
  }

  @override
  String get trackingRefreshFailed =>
      'تعذّر تحديث التتبع. يتم عرض آخر موقع معروف.';

  @override
  String get supplierSupplierRole => 'دور المورد';

  @override
  String get supplierOverview => 'نظرة عامة';

  @override
  String get supplierMyMaterials => 'موادي';

  @override
  String get supplierAddMaterial => 'إضافة مادة';

  @override
  String get supplierAdd => 'إضافة';

  @override
  String get supplierIncomingRequests => 'الطلبات الواردة';

  @override
  String get supplierRequests => 'الطلبات';

  @override
  String get supplierPickupSchedule => 'جدول الاستلام';

  @override
  String get supplierSupplierPortal => 'بوابة المورد';

  @override
  String get supplierTheme => 'المظهر';

  @override
  String get supplierViewSupplierProfile => 'عرض ملف المورد';

  @override
  String get supplierTrackMaterialsRequestsAndImpact =>
      'تتبع المواد والطلبات والأثر.';

  @override
  String get supplierListSurplusMaterialsForReuseBy =>
      'أدرج المواد الفائضة لإعادة استخدامها من قبل المتعلمين والصناع.';

  @override
  String get supplierManagePublicSupplierDetailsAndPickup =>
      'إدارة تفاصيل المورد العامة وموقع الاستلام.';

  @override
  String get supplierReviewLearnerRequestsAndSchedulePickups =>
      'راجع طلبات المتعلمين وحدد مواعيد الاستلام.';

  @override
  String get supplierTrackAcceptedPickupsAndUpcomingHandovers =>
      'تتبع عمليات الاستلام المقبولة والتسليمات القادمة.';

  @override
  String get supplierReviewUpdatesAndActionsThatNeed =>
      'راجع التحديثات والإجراءات التي تحتاج انتباهك.';

  @override
  String get supplierComingSoonInTheSupplierPortal => 'قريباً في بوابة المورد.';

  @override
  String get supplierManageYourSupplierActivity => 'إدارة نشاطك كمورد.';

  @override
  String get supplierManageYourListedSurplusMaterials =>
      'إدارة المواد الفائضة التي أدرجتها.';

  @override
  String get supplierSearchYourMaterials => 'ابحث في موادك';

  @override
  String get supplierTotal => 'الإجمالي';

  @override
  String get supplierPendingReserved => 'قيد الانتظار / محجوزة';

  @override
  String get supplierUnavailable2 => 'غير متاحة';

  @override
  String get supplierYouHaveNotListedAnyMaterials => 'لم تدرج أي مواد بعد.';

  @override
  String get supplierShareSurplusMaterialsWithLearnersAnd =>
      'شارك المواد الفائضة مع المتعلمين والصناع من ورشتك.';

  @override
  String get supplierAddYourFirstMaterial => 'أضف أول مادة';

  @override
  String get supplierWeCouldNotLoadYourMaterials => 'تعذّر تحميل موادك.';

  @override
  String get supplierNoMaterialsMatchYourFilters =>
      'لا توجد مواد مطابقة للتصفية.';

  @override
  String get supplierTryClearingFiltersOrAdjustingYour =>
      'جرّب مسح التصفية أو تعديل البحث.';

  @override
  String get supplierLikes => 'الإعجابات';

  @override
  String get supplierEngagement => 'التفاعل';

  @override
  String get supplierActiveDemand => 'الطلب النشط';

  @override
  String get supplierDemandInterestScore => 'درجة الطلب / الاهتمام';

  @override
  String get supplierReuseHistory => 'سجل إعادة الاستخدام';

  @override
  String get supplierReservationsForThisMaterial => 'حجوزات هذه المادة';

  @override
  String get supplierDemandIndicators => 'مؤشرات الطلب';

  @override
  String get supplierNoReservationsForThisMaterialYet =>
      'لا توجد حجوزات لهذه المادة بعد.';

  @override
  String get supplierNoDemandSignalsYet => 'لا توجد إشارات طلب بعد.';

  @override
  String get supplierNoActiveRequestsRightNowThis =>
      'لا توجد طلبات نشطة حالياً. تمت إعادة استخدام هذه المادة بالفعل.';

  @override
  String get supplierThisMaterialHasActiveDemand => 'هذه المادة لديها طلب نشط.';

  @override
  String get supplierLearnersAreShowingInterestButNo =>
      'المتعلمون يُظهرون اهتماماً، لكن لا توجد حجوزات بعد.';

  @override
  String get supplierNoActiveDemandYet => 'لا يوجد طلب نشط بعد.';

  @override
  String get supplierActiveDemandScore => 'درجة الطلب النشط';

  @override
  String get supplierOverallDemandScore => 'درجة الطلب الإجمالية';

  @override
  String supplierPercent(String percent) {
    return '$percent%';
  }

  @override
  String get supplierBasedOnViewsLikesActiveRequests =>
      'بناءً على المشاهدات والإعجابات والطلبات النشطة وعمليات إعادة الاستخدام المكتملة.';

  @override
  String get supplierCompletedReservations => 'حجوزات مكتملة';

  @override
  String get supplierCompletedReuses => 'عمليات إعادة استخدام مكتملة';

  @override
  String get supplierLastCompleted => 'آخر إكمال';

  @override
  String get supplierMarkUnavailable => 'تعليم كغير متاحة';

  @override
  String get supplierRestoreAvailable => 'إعادة إلى متاحة';

  @override
  String get supplierHighDemand => 'طلب مرتفع';

  @override
  String get supplierOpenReservation => 'فتح الحجز';

  @override
  String get supplierPendingReservations => 'حجوزات قيد الانتظار';

  @override
  String get supplierReservedReservations => 'حجوزات مقبولة';

  @override
  String get supplierTotalActiveRequests => 'إجمالي الطلبات النشطة';

  @override
  String get supplierDemandScore => 'درجة الطلب';

  @override
  String get supplierAllPrices => 'كل الأسعار';

  @override
  String get supplierStatus => 'الحالة';

  @override
  String get supplierPrice => 'السعر';

  @override
  String get supplierAllCategories => 'كل الفئات';

  @override
  String get supplierManage => 'إدارة';

  @override
  String get supplierEdit => 'تعديل';

  @override
  String get supplierEditMaterial => 'تعديل المادة';

  @override
  String get supplierUpdateSafeListingDetailsPriceAnd =>
      'حدّث تفاصيل الإدراج الآمنة. تغييرات السعر والفئة تتطلب مراجعة.';

  @override
  String get supplierPriceCategoryLocationAndImagesAre =>
      'السعر والفئة والموقع والصور غير قابلة للتعديل هنا بعد.';

  @override
  String get supplierMaterialUpdatedSuccessfully => 'تم تحديث المادة بنجاح.';

  @override
  String get supplierCouldNotUpdateMaterialPleaseTry =>
      'تعذر تحديث المادة. يرجى المحاولة مرة أخرى.';

  @override
  String get supplierDelete => 'حذف';

  @override
  String get supplierDeleteMaterial => 'حذف المادة؟';

  @override
  String get supplierThisWillRemoveTheMaterialFrom =>
      'سيؤدي هذا إلى إزالة المادة من إدراجاتك. لا يمكن التراجع عن هذا الإجراء.';

  @override
  String get supplierMaterialDeletedSuccessfully => 'تم حذف المادة بنجاح.';

  @override
  String get supplierCouldNotDeleteMaterialPleaseTry =>
      'تعذر حذف المادة. يرجى المحاولة مرة أخرى.';

  @override
  String get supplierReusedMaterialsCannotBeDeletedBecause =>
      'لا يمكن حذف المواد المعاد استخدامها لأنها جزء من سجل إعادة الاستخدام.';

  @override
  String get supplierCannotDeleteAMaterialWithActive =>
      'لا يمكن حذف مادة لديها طلبات نشطة.';

  @override
  String get supplierThisMaterialCannotBeDeletedRight =>
      'لا يمكن حذف هذه المادة الآن.';

  @override
  String get supplierReusedMaterialsCannotBeEditedBecause =>
      'لا يمكن تعديل المواد المعاد استخدامها لأنها جزء من سجل إعادة الاستخدام.';

  @override
  String get supplierCannotEditAMaterialWithActive =>
      'لا يمكن تعديل مادة لديها طلبات نشطة أو حالة محظورة.';

  @override
  String get supplierThisMaterialCannotBeEditedRight =>
      'لا يمكن تعديل هذه المادة الآن.';

  @override
  String get supplierEditingNotAvailable => 'التعديل غير متاح';

  @override
  String get supplierSaveChanges => 'حفظ التغييرات';

  @override
  String get supplierReadOnly => 'للقراءة فقط';

  @override
  String get supplierMaterialType => 'نوع المادة';

  @override
  String get supplierEditingListingsIsComingSoon => 'تعديل الإدراجات قريباً.';

  @override
  String get supplierPrevious => 'السابق';

  @override
  String get supplierNext => 'التالي';

  @override
  String supplierPagePageOfTotalpages(String page, String totalPages) {
    return 'صفحة $page من $totalPages';
  }

  @override
  String supplierListedDate(String date) {
    return 'أُدرج $date';
  }

  @override
  String get supplierMaterialNotFound => 'المادة غير موجودة';

  @override
  String get supplierThisListingMayHaveBeenRemoved =>
      'ربما أُزيل هذا الإدراج أو لم يعد متاحاً.';

  @override
  String get supplierBackToMyMaterials => 'العودة إلى موادي';

  @override
  String get supplierViews => 'المشاهدات';

  @override
  String get supplierCreated => 'تاريخ الإنشاء';

  @override
  String get supplierUpdated => 'تاريخ التحديث';

  @override
  String get supplierSupplierProfile => 'ملف المورد';

  @override
  String get supplierCancel => 'إلغاء';

  @override
  String get supplierBack => 'رجوع';

  @override
  String get supplierBackToDashboard => 'العودة للوحة التحكم';

  @override
  String get supplierAccept => 'قبول';

  @override
  String get supplierDecline => 'رفض';

  @override
  String get supplierLoading => 'جاري التحميل…';

  @override
  String get supplierRequired => 'مطلوب';

  @override
  String get supplierOptional => 'اختياري';

  @override
  String get supplierComingSoon => 'قريباً';

  @override
  String supplierWelcomeBackName(String name) {
    return 'مرحباً بعودتك، $name';
  }

  @override
  String get supplierTrackYourMaterialsRespondToRequests =>
      'تتبع موادك، رد على الطلبات، ونمِّ أثر إعادة الاستخدام.';

  @override
  String get supplierAddMaterial2 => 'إضافة مادة';

  @override
  String get supplierViewRequests => 'عرض الطلبات';

  @override
  String get supplierActiveMaterials => 'المواد النشطة';

  @override
  String get supplierPendingRequests => 'الطلبات المعلقة';

  @override
  String get supplierScheduledPickups => 'عمليات الاستلام المجدولة';

  @override
  String get supplierReusedMaterials => 'المواد المعاد استخدامها';

  @override
  String get supplierTotalMaterials => 'إجمالي المواد';

  @override
  String get supplierAvailableMaterials => 'المواد المتاحة';

  @override
  String get supplierReservedMaterials => 'المواد المحجوزة';

  @override
  String get supplierTotalMaterialViews => 'إجمالي مشاهدات المواد';

  @override
  String get supplierTotalMaterialLikes => 'إجمالي إعجابات المواد';

  @override
  String get supplierFollowers => 'المتابعون';

  @override
  String get supplierRecentReservationRequests => 'طلبات الحجز الأخيرة';

  @override
  String get supplierNoReservationRequestsYet => 'لا توجد طلبات حجز بعد.';

  @override
  String get supplierMostViewedMaterial => 'المادة الأكثر مشاهدة';

  @override
  String get supplierSupplierEngagement => 'تفاعل المورد';

  @override
  String get supplierAccountTotals => 'إجماليات الحساب';

  @override
  String get supplierNoViewedMaterialsYet => 'لا توجد مواد بمشاهدات بعد.';

  @override
  String get supplierHighDemandMaterials => 'مواد ذات طلب مرتفع';

  @override
  String get supplierMaterialsWithActiveReservationInterest =>
      'مواد لديها اهتمام حجز نشط.';

  @override
  String get supplierNoHighDemandMaterialsYet =>
      'لا توجد مواد ذات طلب مرتفع بعد.';

  @override
  String get supplierViewAllRequests => 'عرض كل الطلبات';

  @override
  String get supplierUnknownLearner => 'متعلم غير معروف';

  @override
  String get supplierOperationsSnapshot => 'لمحة تشغيلية';

  @override
  String supplierRequesterStatusDateQtyQuantity(
    String requester,
    String status,
    String date,
    String quantity,
  ) {
    return '$requester · $status · $date · الكمية $quantity';
  }

  @override
  String supplierCountViews(String count) {
    return '$count مشاهدة';
  }

  @override
  String get supplierSelectMaterialConditionBeforeVerifyingThe =>
      'اختر حالة المادة قبل التحقق من السعر.';

  @override
  String supplierReferenceMaxCurrencysymbolBasemaxConditionConditionlabe(
    String currencySymbol,
    String baseMax,
    String conditionLabel,
    String adjustedMax,
  ) {
    return 'الحد الأقصى المرجعي: $currencySymbol$baseMax · الحالة: $conditionLabel · الحد المعدّل: $currencySymbol$adjustedMax';
  }

  @override
  String get supplierSomeMaterialsAreGettingStrongDemand =>
      'بعض المواد تحظى بطلب قوي.';

  @override
  String get supplierYourMaterialsAreGettingViewsImprove =>
      'موادك تحصل على مشاهدات. حسّن العناوين/الصور لزيادة التفاعل.';

  @override
  String get supplierAddYourFirstMaterialToStart =>
      'أضف أول مادة لك لتبدأ في تلقي الطلبات.';

  @override
  String get supplierReservationStatus => 'حالة الحجوزات';

  @override
  String get supplierMaterialsStatus => 'حالة المواد';

  @override
  String get supplierRecentActivity => 'النشاط الأخير';

  @override
  String get supplierCuratedHighlightsFromYourLatestOperations =>
      'أبرز ما حدث في عملياتك الأخيرة';

  @override
  String get supplierViewAllActivity => 'عرض كل النشاط';

  @override
  String get supplierActionableInsights => 'رؤى قابلة للتنفيذ';

  @override
  String get supplierRecommendedNextStepsBasedOnYour =>
      'الخطوات التالية الموصى بها بناءً على نشاطك الحالي.';

  @override
  String get supplierRequestsNeedAttention => 'الطلبات تحتاج انتباهك';

  @override
  String get supplierNoPendingRequestsRightNow => 'لا توجد طلبات معلقة حالياً.';

  @override
  String get supplierReviewRequests => 'مراجعة الطلبات';

  @override
  String get supplierPickupReadiness => 'جاهزية الاستلام';

  @override
  String get supplierPickupLocationIsSetSelfPickup =>
      'موقع الاستلام محدد. الاستلام الذاتي مفعّل.';

  @override
  String get supplierAddOrConfirmYourPickupLocation =>
      'أضف أو أكّد موقع الاستلام ليعرف المتعلمون مكان الاستلام.';

  @override
  String get supplierCompleteYourSupplierProfileAndPickup =>
      'أكمل ملف المورد وموقع الاستلام لبدء قبول الطلبات.';

  @override
  String get supplierUpdateProfile => 'تحديث الملف';

  @override
  String get supplierGrowReuse => 'نمِّ إعادة الاستخدام';

  @override
  String get supplierYouHaveActiveListingsReadyFor =>
      'لديك قوائم نشطة جاهزة للمتعلمين. الاستلام المكتمل يزيد أثر إعادة الاستخدام.';

  @override
  String get supplierReuseActivityIsStartingKeepMaterials =>
      'بدأ نشاط إعادة الاستخدام. حدّث المواد لتحسين الطلبات.';

  @override
  String get supplierListMaterialsToStartBuildingReuse =>
      'أدرج مواد لبدء بناء أثر إعادة الاستخدام عند اكتمال الاستلام.';

  @override
  String get supplierViewMaterials => 'عرض المواد';

  @override
  String get supplierAllCaughtUpNewLearnerRequests =>
      'كل شيء محدّث. ستظهر طلبات المتعلمين وتحديثات الاستلام هنا.';

  @override
  String get supplierNoRecentActivityYet => 'لا يوجد نشاط حديث بعد.';

  @override
  String get supplierCheckNotifications => 'تحقق من الإشعارات';

  @override
  String get supplierOpenPickupSchedule => 'فتح جدول الاستلام';

  @override
  String get supplierEditProfile => 'تعديل الملف';

  @override
  String get supplierSupplierHub => 'مركز المورد';

  @override
  String get supplierShareUnusedPartsReduceWasteAnd =>
      'شارك القطع غير المستخدمة، قلّل الهدر، وساعد المتعلمين على البناء أسرع.';

  @override
  String supplierPickupCity(String city) {
    return 'الاستلام: $city';
  }

  @override
  String supplierPickupCityArea(String city, String area) {
    return 'الاستلام: $city، $area';
  }

  @override
  String get supplierNoMaterialsListedYet => 'لا توجد مواد مدرجة بعد';

  @override
  String get supplierStartBySharingUnusedPartsProject =>
      'ابدأ بمشاركة القطع غير المستخدمة أو مخلفات المشاريع أو المكونات الفائضة.';

  @override
  String get supplierCompleteYourSupplierProfile => 'أكمل ملف المورد';

  @override
  String get supplierAddYourPublicSupplierNameAnd =>
      'أضف اسم المورد العام وموقع الاستلام قبل إدراج المواد.';

  @override
  String get supplierCompleteProfile => 'إكمال الملف';

  @override
  String get supplierWeCouldNotLoadYourSupplier =>
      'تعذّر تحميل لوحة تحكم المورد.';

  @override
  String get supplierPleaseCheckYourConnectionAndTry =>
      'يرجى التحقق من الاتصال والمحاولة مجدداً.';

  @override
  String get supplierReuseImpact => 'أثر إعادة الاستخدام';

  @override
  String supplierCountReusedQuantityUnits(String count, String quantity) {
    return '$count معاد استخدامها · $quantity وحدة';
  }

  @override
  String get supplierImpactIsCalculatedFromCompletedReuse =>
      'يُحسب الأثر من بيانات إعادة الاستخدام المكتملة.';

  @override
  String get supplierProjectImpact => 'أثر المشاريع';

  @override
  String get supplierYourMaterialsHelpedLearnersCompleteReal =>
      'ساعدت موادك المتعلمين على إكمال مكوّنات مشاريع حقيقية.';

  @override
  String get supplierYourCompletedProjectImpactWillAppear =>
      'سيظهر أثر مشاريعك المكتمل هنا عندما ينهي المتعلمون المكوّنات باستخدام موادك.';

  @override
  String get supplierProjectsSupported => 'مشاريع مدعومة';

  @override
  String get supplierComponentsCompleted => 'مكوّنات مكتملة';

  @override
  String get supplierLearnerBuildsHelped => 'بناءات متعلمين مساندة';

  @override
  String get supplierRecentSupportedProjects => 'مشاريع مدعومة حديثاً';

  @override
  String get supplierNoReviewsYet => 'لا توجد مراجعات بعد';

  @override
  String get supplierRating => 'التقييم';

  @override
  String supplierCountReviews(String count) {
    return '$count مراجعة';
  }

  @override
  String get supplierMaterialLifecycle => 'دورة حياة المادة';

  @override
  String get supplierListed => 'مدرجة';

  @override
  String get supplierActionNeeded => 'يتطلب إجراء';

  @override
  String get supplierResolved => 'تم الحل';

  @override
  String supplierNoFilterlabelNotifications(String filterLabel) {
    return 'لا توجد إشعارات $filterLabel.';
  }

  @override
  String get supplierWeCouldNotLoadNotifications => 'تعذّر تحميل الإشعارات.';

  @override
  String get supplierNoActionAvailableForThisItem =>
      'لا يوجد إجراء متاح لهذا العنصر.';

  @override
  String get supplierCouldNotOpenListingTryAgain =>
      'تعذّر فتح الإدراج. حاول مجدداً من الإشعارات.';

  @override
  String get supplierApproved => 'موافق عليه';

  @override
  String supplierMaxFormatnisamountMaxNisUnit(String max, String unit) {
    return 'الحد $max ₪/$unit';
  }

  @override
  String get supplierEditListing => 'تعديل الإدراج';

  @override
  String get supplierEditPrice => 'تعديل السعر';

  @override
  String get supplierReviewRequest => 'مراجعة الطلب';

  @override
  String get supplierChoosePickupWindow => 'اختر نافذة الاستلام';

  @override
  String get supplierOpenMaterial => 'فتح المادة';

  @override
  String get supplierOpenProfile => 'فتح الملف الشخصي';

  @override
  String get supplierSupplierActive => 'المورد نشط';

  @override
  String get supplierPickupEnabled => 'الاستلام مفعّل';

  @override
  String get supplierNisListings => 'إدراجات بالشيكل';

  @override
  String get supplierPendingAcceptedAndCompletedRequests =>
      'الطلبات المعلقة والمقبولة والمكتملة';

  @override
  String get supplierInventoryBreakdownAcrossLifecycleStates =>
      'تفصيل المخزون عبر حالات دورة الحياة';

  @override
  String get supplierAcceptedPickups => 'عمليات الاستلام المقبولة';

  @override
  String get supplierCompletedReuse => 'إعادة الاستخدام المكتملة';

  @override
  String get supplierAcceptedHandovers => 'التسليمات المقبولة';

  @override
  String get supplierReservationActivityWillAppearHereOnce =>
      'سيظهر نشاط الحجوزات هنا عند وصول الطلبات.';

  @override
  String get supplierReservedPending => 'محجوزة / معلقة';

  @override
  String get supplierMaterialStatusBreakdownWillAppearAfter =>
      'سيظهر تفصيل حالة المواد بعد أول إدراج.';

  @override
  String get supplierPendingRequestWaiting => 'طلب معلق بانتظار الرد';

  @override
  String get supplierNextScheduledPickup => 'عملية الاستلام المجدولة التالية';

  @override
  String supplierAcceptedPickupWithName(String name) {
    return 'استلام مقبول مع $name';
  }

  @override
  String get supplierLatestCompletedReuse => 'أحدث إعادة استخدام مكتملة';

  @override
  String get supplierChooseSupplierType => 'اختر نوع المورد';

  @override
  String get supplierChoosePhotosFromYourDevice => 'اختر الصور من جهازك';

  @override
  String get supplierMaterialCouldNotBeListed => 'تعذّر إدراج المادة.';

  @override
  String get supplierChooseACategoryFirst => 'اختر فئة أولاً.';

  @override
  String get supplierEnterAMaterialNameFirst => 'أدخل اسم المادة أولاً.';

  @override
  String get supplierEnterAValidQuantityAndPrice => 'أدخل كمية وسعراً صالحين.';

  @override
  String get supplierPriceReviewRequestFailed => 'فشل طلب مراجعة السعر.';

  @override
  String get supplierSavedListingDraftWasNotFound =>
      'لم تُعثر على مسودة الإدراج المحفوظة.';

  @override
  String get supplierCategoryApprovedContinueYourListing =>
      'تمت الموافقة على الفئة. تابع إدراجك.';

  @override
  String get supplierContinueEditingYourSavedListingDraft =>
      'تابع تعديل مسودة الإدراج المحفوظة.';

  @override
  String get supplierContinueYourListingFromWhereYou =>
      'تابع إدراجك من حيث توقفت.';

  @override
  String get supplierCategoryRequestSubmittedYourListingDraft =>
      'تم إرسال طلب الفئة. حُفظت مسودة الإدراج. يمكنك المتابعة بعد موافقة المسؤول.';

  @override
  String get supplierCategoryRequestSubmittedYourListingDraft2 =>
      'تم إرسال طلب الفئة. حُفظت مسودة الإدراج.';

  @override
  String get supplierPriceReviewSubmittedAGeminiAssisted =>
      'تم إرسال مراجعة السعر. تم إنشاء اقتراح سعر بمساعدة Gemini لمراجعة المسؤول.';

  @override
  String supplierPriceVerificationFailedError(String error) {
    return 'فشل التحقق من السعر: $error';
  }

  @override
  String get supplierSubmitPriceReview => 'إرسال مراجعة السعر';

  @override
  String get supplierPleaseClarifyTheMaterialName => 'يرجى توضيح اسم المادة';

  @override
  String get supplierDidYouMeanOneOfThese => 'هل تقصد أحد هذه؟';

  @override
  String supplierMatchedPriceReferenceLabel(String label) {
    return 'مرجع السعر المطابق: $label';
  }

  @override
  String supplierMaximumAllowedUnitPriceSymbolPrice(
    String symbol,
    String price,
  ) {
    return 'الحد الأقصى لسعر الوحدة: $symbol$price';
  }

  @override
  String supplierMaximumAllowedUnitPriceSymbolPrice2(
    String symbol,
    String price,
    String unit,
  ) {
    return 'الحد الأقصى لسعر الوحدة: $symbol$price لكل $unit';
  }

  @override
  String supplierApprovedUnitUnit(String unit) {
    return 'الوحدة المعتمدة: $unit';
  }

  @override
  String get supplierPriceReviewIsRequiredBeforePaid =>
      'مراجعة السعر مطلوبة قبل النشر المدفوع. سيُنشأ اقتراح سعر بمساعدة Gemini لمراجعة المسؤول.';

  @override
  String get supplierPriceIsAboveTheAllowedLimit =>
      'السعر أعلى من الحد المسموح';

  @override
  String get supplierPriceBlocked => 'السعر محظور';

  @override
  String get supplierMyMaterials2 => 'موادي';

  @override
  String get supplierIncomingRequests2 => 'الطلبات الواردة';

  @override
  String get supplierCurrentlyVisibleToLearners => 'ظاهرة حالياً للمتعلمين';

  @override
  String get supplierWaitingForYourResponse => 'بانتظار ردك';

  @override
  String get supplierAction => 'إجراء';

  @override
  String get supplierPickup => 'استلام';

  @override
  String get supplierListReusableParts => 'أدرج قطعاً قابلة لإعادة الاستخدام';

  @override
  String get supplierRespondToLearners => 'رد على المتعلمين';

  @override
  String get supplierUpdatesActions => 'التحديثات والإجراءات';

  @override
  String get supplierLoadingIncomingRequests => 'جاري تحميل الطلبات الواردة…';

  @override
  String get supplierWeCouldNotLoadRequests => 'تعذّر تحميل الطلبات.';

  @override
  String get supplierRequestAccepted => 'تم قبول الطلب.';

  @override
  String get supplierCouldNotAcceptTheRequest => 'تعذّر قبول الطلب.';

  @override
  String get supplierRequestDeclined => 'تم رفض الطلب.';

  @override
  String get supplierCouldNotDeclineTheRequest => 'تعذّر رفض الطلب.';

  @override
  String get supplierPickupMarkedAsCompleted => 'تم تحديد الاستلام كمكتمل.';

  @override
  String get supplierCouldNotMarkPickupAsCompleted =>
      'تعذّر تحديد الاستلام كمكتمل.';

  @override
  String get supplierNeedsLearnerConfirmation => 'بحاجة إلى تأكيد المتعلم';

  @override
  String get supplierNeedsLearner => 'بحاجة إلى المتعلم';

  @override
  String get supplierDeclined => 'مرفوض';

  @override
  String get supplierNoRequestsYet => 'لا توجد طلبات بعد.';

  @override
  String get supplierNoRequestsMatchThisFilter =>
      'لا توجد طلبات تطابق هذا الفلتر.';

  @override
  String get supplierNoPendingRequests => 'لا توجد طلبات معلقة';

  @override
  String get supplierNoAcceptedPickupsYet =>
      'لا توجد عمليات استلام مقبولة بعد.';

  @override
  String get supplierNoDeclinedRequests => 'لا توجد طلبات مرفوضة.';

  @override
  String get supplierNoCompletedPickupsYet =>
      'لا توجد عمليات استلام مكتملة بعد.';

  @override
  String get supplierNewLearnerRequestsWillAppearHere =>
      'ستظهر طلبات المتعلمين الجديدة هنا.';

  @override
  String get supplierAcceptedRequestsWithPickupWindowsWill =>
      'ستظهر الطلبات المقبولة مع مواعيد الاستلام هنا.';

  @override
  String get supplierRequestsYouDeclineWillBeListed =>
      'ستُدرج الطلبات التي ترفضها هنا.';

  @override
  String get supplierFinishedPickupsWillAppearHere =>
      'ستظهر عمليات الاستلام المنتهية هنا.';

  @override
  String get supplierNoLearnerNote => 'لا توجد ملاحظة من المتعلم.';

  @override
  String get supplierSelfPickup => 'استلام ذاتي';

  @override
  String supplierPickupWindow2(String window) {
    return 'الاستلام: $window';
  }

  @override
  String get supplierNoRequestsWaitingForLearner =>
      'لا توجد طلبات بانتظار المتعلم';

  @override
  String get supplierNoCancelledRequests => 'لا توجد طلبات ملغاة';

  @override
  String get supplierReservationsAwaitingLearnerConfirmationAppearHere =>
      'تظهر الحجوزات التي تنتظر تأكيد المتعلم هنا.';

  @override
  String get supplierCancelledReservationsWillAppearHere =>
      'ستظهر الحجوزات الملغاة هنا.';

  @override
  String get supplierWaitingForSupplier => 'بانتظار المورد';

  @override
  String get supplierLoadingPickupSchedule => 'جاري تحميل جدول الاستلام…';

  @override
  String get supplierWeCouldNotLoadPickupSchedule =>
      'تعذّر تحميل جدول الاستلام.';

  @override
  String get supplierNoPickupsScheduledYet =>
      'لا توجد عمليات استلام مجدولة بعد.';

  @override
  String get supplierNoPickupsMatchThisFilter =>
      'لا توجد عمليات استلام تطابق هذا الفلتر.';

  @override
  String get supplierMarkCompleted => 'تحديد كمكتمل';

  @override
  String get supplierUpcoming => 'قادمة';

  @override
  String get supplierPast => 'سابقة';

  @override
  String get supplierToday => 'اليوم';

  @override
  String get supplierDone => 'منتهٍ';

  @override
  String get supplierNoPickupsScheduledForToday =>
      'لا توجد عمليات استلام مجدولة اليوم.';

  @override
  String get supplierNoUpcomingPickups => 'لا توجد عمليات استلام قادمة.';

  @override
  String get supplierNoPickupScheduleYet => 'لا يوجد جدول استلام بعد.';

  @override
  String get supplierCreateYourProfile => 'أنشئ ملفك';

  @override
  String get supplierUpdateYourPublicIdentityAndPickup =>
      'حدّث هويتك العامة وإعدادات الاستلام.';

  @override
  String get supplierUpdateHowLearnersDiscoverYouAnd =>
      'حدّث كيف يكتشفك المتعلمون وأين يمكن جمع المواد.';

  @override
  String get supplierPublicSupplierDetails => 'تفاصيل المورد العامة';

  @override
  String get supplierTheseDetailsAppearOnYourPublic =>
      'تظهر هذه التفاصيل في ملف المورد العام.';

  @override
  String get supplierPublicSupplierName => 'اسم المورد العام';

  @override
  String get supplierHowLearnersWillSeeYou => 'كيف سيراك المتعلمون';

  @override
  String get supplierAboutYourMaterials => 'عن موادك';

  @override
  String get supplierShareTheMaterialTypesYouUsually =>
      'شارك أنواع المواد التي تقدمها عادة.';

  @override
  String get supplierDefaultPickupArea => 'منطقة الاستلام الافتراضية';

  @override
  String get supplierUseAGeneralPickupAreaExact =>
      'استخدم منطقة استلام عامة. العناوين الدقيقة تبقى مخفية حتى الحاجة.';

  @override
  String get supplierChooseManually => 'اختيار يدوي';

  @override
  String get supplierPickupLocationSelectionMethod =>
      'طريقة تحديد موقع الاستلام';

  @override
  String get supplierEnterTheAddressDetailsOrMove =>
      'أدخل تفاصيل العنوان أو حرّك دبوس الخريطة لاختيار موقع الاستلام الدقيق.';

  @override
  String get supplierLocationSelected => 'تم تحديد الموقع';

  @override
  String get supplierFindingAddress => 'جاري البحث عن العنوان…';

  @override
  String get supplierRefreshCurrentLocation => 'تحديث الموقع الحالي';

  @override
  String get supplierOptionalAddressDetails => 'تفاصيل العنوان (اختياري)';

  @override
  String get supplierCoordinatesAreTheSourceOfTruth =>
      'الإحداثيات هي المرجع. هذه الحقول تساعد المتعلمين في العثور عليك.';

  @override
  String get supplierPalestine => 'فلسطين';

  @override
  String get supplierNeighborhoodOrDistrict => 'الحي أو المنطقة';

  @override
  String get supplierAddressLine => 'سطر العنوان';

  @override
  String get supplierStreetOrBuildingKeptPrivate =>
      'الشارع أو المبنى (يُحفظ بسرية)';

  @override
  String get supplierLocationPrivacy => 'خصوصية الموقع';

  @override
  String get supplierSetYourExactPickupLocationYour =>
      'حدّد موقع الاستلام الدقيق. تتحكم إعدادات الظهور بما يمكن للمتعلمين رؤيته.';

  @override
  String get supplierLocationVisibility => 'ظهور الموقع';

  @override
  String get supplierPublicArea => 'منطقة عامة';

  @override
  String get supplierOrderOnly => 'للطلبات فقط';

  @override
  String get supplierPrivate => 'خاص';

  @override
  String get supplierShowAsApproximate => 'عرض كموقع تقريبي';

  @override
  String get supplierLearnersSeeAGeneralAreaNot =>
      'يرى المتعلمون منطقة عامة وليس موقعاً دقيقاً.';

  @override
  String get supplierOrganizationDetails => 'تفاصيل المؤسسة';

  @override
  String get supplierForWorkshopsFactoriesAndEducationalInstitutions =>
      'للورش والمصانع والمؤسسات التعليمية فقط.';

  @override
  String get supplierOrganizationName => 'اسم المؤسسة';

  @override
  String get supplierLegalOrPublicOrganizationName =>
      'الاسم القانوني أو العام للمؤسسة';

  @override
  String get supplierContactPerson => 'شخص الاتصال';

  @override
  String get supplierOptionalContactName => 'اسم جهة الاتصال (اختياري)';

  @override
  String get supplierSaveProfile => 'حفظ الملف';

  @override
  String get supplierSaving => 'جاري الحفظ…';

  @override
  String get supplierDiscardChanges => 'تجاهل التغييرات';

  @override
  String get supplierKeepYourPublicSupplierDetailsAccurate =>
      'حافظ على تفاصيل موردك العامة دقيقة وموثوقة وسهلة الفهم للمتعلمين.';

  @override
  String get supplierCreateYourSupplierProfileSoLearners =>
      'أنشئ ملف المورد ليعرف المتعلمون أين وكيف يجمعون المواد.';

  @override
  String get supplierProfileUnavailable => 'الملف غير متاح';

  @override
  String get supplierProfileCouldNotBeSaved => 'تعذّر حفظ الملف.';

  @override
  String get supplierSupplierProfileUpdated => 'تم تحديث ملف المورد';

  @override
  String get supplierPleaseCaptureYourCurrentLocationBefore =>
      'يرجى تحديد موقعك الحالي قبل الحفظ.';

  @override
  String get supplierCouldNotGetCurrentLocationPlease =>
      'تعذّر تحديد الموقع الحالي. حاول مجدداً أو أدخله يدوياً.';

  @override
  String get supplierCurrentLocation => 'الموقع الحالي';

  @override
  String get supplierWeFoundThisAddressFromYour =>
      'وجدنا هذا العنوان من موقعك الحالي. راجعه وعدّله إن لزم.';

  @override
  String get supplierCurrentLocationCapturedButAddressLookup =>
      'تم تحديد الموقع الحالي، لكن فشل البحث عن العنوان. يمكنك إضافة المدينة أو المنطقة يدوياً.';

  @override
  String get supplierCurrentLocationCapturedYouCanOptionally =>
      'تم تحديد الموقع الحالي. يمكنك إضافة المدينة أو المنطقة أو تفاصيل العنوان اختيارياً.';

  @override
  String get supplierChooseVisibility => 'اختر مستوى الظهور';

  @override
  String get supplierWorkingDays => 'أيام العمل';

  @override
  String get supplierMonTueWed => 'الإثنين، الثلاثاء، الأربعاء';

  @override
  String get supplierOpenFrom => 'يفتح من';

  @override
  String get supplierOpenUntil => 'يغلق عند';

  @override
  String get supplierUseASeparateOrganizationAddress =>
      'استخدام عنوان مؤسسة منفصل';

  @override
  String get supplierEnableThisWhenYourOrganizationAddress =>
      'فعّل هذا الخيار عندما يختلف عنوان المؤسسة عن موقع الاستلام الافتراضي.';

  @override
  String get supplierBusinessCountry => 'بلد العمل';

  @override
  String get supplierBusinessCity => 'مدينة العمل';

  @override
  String get supplierBusinessArea => 'منطقة العمل';

  @override
  String get supplierBusinessAddressLine => 'سطر عنوان العمل';

  @override
  String get supplierCountryOptional => 'البلد (اختياري)';

  @override
  String get supplierCityOptional => 'المدينة (اختياري)';

  @override
  String get supplierAreaOptional => 'المنطقة (اختياري)';

  @override
  String get supplierAddressLineOptional => 'سطر العنوان (اختياري)';

  @override
  String get supplierOptionalNeighborhoodOrDistrict =>
      'الحي أو المنطقة (اختياري)';

  @override
  String get supplierOptionalStreetOrBuilding => 'الشارع أو المبنى (اختياري)';

  @override
  String get supplierCompleteYourSupplierProfileFirst =>
      'أكمل ملف المورد أولاً.';

  @override
  String get supplierSupplierDetailsAreRequiredBeforeYou =>
      'تفاصيل المورد مطلوبة قبل نشر المواد القابلة لإعادة الاستخدام.';

  @override
  String get supplierGoToSupplierProfile => 'الذهاب لملف المورد';

  @override
  String get supplierSetYourPickupLocationBeforeListing =>
      'حدد موقع الاستلام قبل إدراج المواد.';

  @override
  String get supplierPickupLocationComesFromYourSupplier =>
      'موقع الاستلام يأتي من ملف المورد ويُستخدم لكل مادة في هذه الخطوة.';

  @override
  String get supplierEditSupplierProfile => 'تعديل ملف المورد';

  @override
  String get supplierMaterialCategoriesAreUnavailable =>
      'فئات المواد غير متاحة.';

  @override
  String get supplierPleaseTryAgainAfterTheBackend =>
      'يرجى المحاولة مجدداً عند توفر الخادم.';

  @override
  String get supplierSupplierProfileCouldNotLoad => 'تعذّر تحميل ملف المورد.';

  @override
  String get supplierPleaseRefreshOrCompleteYourProfile =>
      'يرجى التحديث أو إكمال ملفك أولاً.';

  @override
  String get supplierWhatAreYouListing => 'ماذا تدرج؟';

  @override
  String get supplierDescribeTheSurplusMaterialClearly =>
      'صف المادة الفائضة بوضوح.';

  @override
  String get supplierMaterialTypeName => 'نوع/اسم المادة';

  @override
  String get supplierWaxMoldsArduinoUnoFabricScraps =>
      'قوالب شمع، Arduino Uno، بقايا قماش...';

  @override
  String get supplierUseTheCommonMaterialTypeOr =>
      'استخدم نوع المادة الشائع أو الاسم البديل. نستخدمه للمطابقة والتحقق من الأسعار المدفوعة.';

  @override
  String get supplierChooseACategoryFirstToSearch =>
      'اختر فئة أولاً للبحث في أنواع المواد المراجعة.';

  @override
  String get supplierNoReviewedMaterialTypesFoundFree =>
      'لم يتم العثور على أنواع مواد مراجعة. يمكن للإدراجات المجانية المتابعة بهذا الاسم.';

  @override
  String get supplierReviewedPriceAvailable => 'سعر مراجع متاح';

  @override
  String get supplierNoReviewedPrice => 'لا يوجد سعر مراجع';

  @override
  String get supplierPaidListingsNeedAReviewedMaterial =>
      'تحتاج الإدراجات المدفوعة إلى نوع مادة مراجع مع قاعدة سعر نشطة.';

  @override
  String supplierAliasesAliases(String aliases) {
    return 'أسماء بديلة: $aliases';
  }

  @override
  String get supplierListingTitle => 'عنوان الإدراج';

  @override
  String get supplierUsedWaxMolds8Pieces => 'قوالب شمع مستعملة - 8 قطع';

  @override
  String get supplierDescription => 'الوصف';

  @override
  String get supplierDescribeConditionQuantityAndWhatIs =>
      'صف الحالة والكمية وما يشمله العرض.';

  @override
  String get supplierChooseSource => 'اختر المصدر';

  @override
  String get supplierCondition => 'الحالة';

  @override
  String get supplierChooseCondition => 'اختر الحالة';

  @override
  String get supplierSuggestedUses => 'الاستخدامات المقترحة';

  @override
  String get supplierCandlesResinCastingCraftProjects =>
      'شموع، صب راتنج، مشاريع حرفية.';

  @override
  String get supplierChooseTheClosestBroadCategory => 'اختر أقرب فئة عامة.';

  @override
  String get supplierBroadCategory => 'الفئة العامة';

  @override
  String get supplierChooseCategory => 'اختر الفئة';

  @override
  String get supplierCategoryIsRequired => 'الفئة مطلوبة';

  @override
  String get supplierPublishMaterial => 'نشر المادة';

  @override
  String get supplierPublishing => 'جاري النشر…';

  @override
  String get supplierHideCategoryRequest => 'إخفاء طلب الفئة';

  @override
  String get supplierCannotFindYourCategory => 'لا تجد فئتك؟';

  @override
  String get supplierCategoryRequest => 'طلب فئة';

  @override
  String get supplierSendThisCategoryNameToAdmin =>
      'أرسل اسم الفئة للمسؤول للموافقة. سيُحفظ نموذج الإدراج الحالي لتكمل لاحقاً.';

  @override
  String get supplierRequestedCategoryName => 'اسم الفئة المطلوبة';

  @override
  String get supplierExampleCandleMakingTools => 'مثال: أدوات صنع الشموع';

  @override
  String get supplierSending => 'جاري الإرسال…';

  @override
  String get supplierSendCategoryRequest => 'إرسال طلب الفئة';

  @override
  String get supplierFreeListingsMayUseOtherWhen =>
      'يمكن للإدراجات المجانية استخدام «أخرى» عندما لا تناسب فئة مراجعة.';

  @override
  String get supplierPaidListingsCannotUseOtherUse =>
      'لا يمكن للإدراجات المدفوعة استخدام «أخرى». استخدم «لا تجد فئتك؟» لطلب فئة مراجعة أولاً.';

  @override
  String get supplierQuantityAndPricing => 'الكمية والتسعير';

  @override
  String get supplierEnterThePriceForOneUnit =>
      'أدخل سعر الوحدة الواحدة. تُعالج الكمية بشكل منفصل.';

  @override
  String get supplierQuantity => 'الكمية';

  @override
  String get supplierUnit => 'الوحدة';

  @override
  String get supplierPiece => 'قطعة';

  @override
  String get supplierPricePerUnit => 'السعر لكل وحدة (₪)';

  @override
  String get supplierVerifyPrice => 'التحقق من السعر';

  @override
  String supplierMaximumAllowedPricePerUnitIs(String unit, String max) {
    return 'الحد الأقصى للسعر لكل $unit هو $max ₪.';
  }

  @override
  String get supplierPickupLocationComesFromYourSupplier2 =>
      'موقع الاستلام يأتي من ملف المورد.';

  @override
  String get supplierOrganizationListingsUseYourProfilePickup =>
      'تستخدم إدراجات المؤسسة موقع الاستلام من ملفك.';

  @override
  String get supplierThisFixedPickupLocationFromYour =>
      'يُستخدم موقع الاستلام الثابت من ملفك لكل إدراج. حدّثه في ملف المورد إذا تغيّر عنوان الورشة أو المنشأة.';

  @override
  String get supplierEditPickupInProfile => 'تعديل الاستلام في الملف';

  @override
  String get supplierUseProfilePickupLocation =>
      'استخدام موقع الاستلام من الملف';

  @override
  String get supplierUseYourDefaultPickupAreaOr =>
      'استخدم منطقة الاستلام الافتراضية، أو حدّد نقطة استلام مختلفة لهذه المادة فقط.';

  @override
  String get supplierMaterialPickupLocation => 'موقع استلام المادة';

  @override
  String get supplierSetWhereLearnersShouldPickUp =>
      'حدد المكان الذي يجب على المتعلمين استلام هذه المادة منه.';

  @override
  String get supplierEnterACityOrCaptureYour =>
      'أدخل مدينة أو التقط موقعك الحالي للاستلام.';

  @override
  String get supplierPickupAllowed => 'الاستلام مسموح';

  @override
  String get supplierLearnersCanRequestSelfPickupFor =>
      'يمكن للمتعلمين طلب الاستلام الذاتي لهذه المادة.';

  @override
  String get supplierDeliveryAllowed => 'التوصيل مسموح';

  @override
  String get supplierLearnersCanRequestInternalDeliveryAfter =>
      'يمكن للمتعلمين طلب التوصيل الداخلي بعد قبولك للحجز.';

  @override
  String get supplierYes => 'نعم';

  @override
  String get supplierNo => 'لا';

  @override
  String get supplierPickupNotes => 'ملاحظات الاستلام';

  @override
  String get supplierPickupNearCampus => 'الاستلام قرب الحرم الجامعي.';

  @override
  String get supplierPaidListingsCannotUseOther =>
      'لا يمكن للإدراجات المدفوعة استخدام «أخرى».';

  @override
  String get supplierPaidListingsMustPassPriceVerification =>
      'يجب أن تجتاز الإدراجات المدفوعة التحقق من السعر قبل النشر.';

  @override
  String get supplierNisOnly => 'شيكل فقط';

  @override
  String get supplierFreeOtherAllowed => '«أخرى» مجانية مسموحة';

  @override
  String get supplierPaidNeedsPriceVerification =>
      'المدفوع يحتاج تحققاً من السعر';

  @override
  String get supplierCouldNotRestoreListingDraft =>
      'تعذّر استعادة مسودة الإدراج';

  @override
  String get supplierBackToNotifications => 'العودة للإشعارات';

  @override
  String get supplierMaterialListedSuccessfully => 'تم إدراج المادة بنجاح.';

  @override
  String get supplierAddAnotherMaterial => 'إضافة مادة أخرى';

  @override
  String supplierTitleCategoryPrice(
    String title,
    String category,
    String price,
  ) {
    return '$title • $category • $price';
  }

  @override
  String get supplierNew => 'جديد';

  @override
  String get supplierLikeNew => 'كالجديد';

  @override
  String get supplierGood => 'جيد';

  @override
  String get supplierUsed => 'مستعمل';

  @override
  String get supplierNeedsRepair => 'يحتاج إصلاح';

  @override
  String get supplierStudentLeftover => 'فائض طلابي';

  @override
  String get supplierWorkshopSurplus => 'فائض ورشة';

  @override
  String get supplierFactorySurplus => 'فائض مصنع';

  @override
  String get supplierEducationalInstitution => 'مؤسسة تعليمية';

  @override
  String get supplierIndividualSupplier => 'مورد فردي';

  @override
  String get supplierStudentSupplier => 'مورد طالب';

  @override
  String get supplierWorkshop => 'ورشة';

  @override
  String get supplierFactory => 'مصنع';

  @override
  String get supplierVerified => 'موثّق';

  @override
  String get supplierPendingVerification => 'بانتظار التحقق';

  @override
  String get supplierNotRequired => 'غير مطلوب';

  @override
  String get supplierAdminNote => 'ملاحظة المسؤول';

  @override
  String get supplierSupplierType => 'نوع المورد';

  @override
  String get supplierPickupCountryCity => 'بلد ومدينة الاستلام';

  @override
  String get supplierListingPreview => 'معاينة الإدراج';

  @override
  String get supplierProfileCompletion => 'اكتمال الملف';

  @override
  String get supplierSelectedCoordinates => 'الإحداثيات المحددة';

  @override
  String supplierLatitudeValue(String value) {
    return 'خط العرض: $value';
  }

  @override
  String supplierLongitudeValue(String value) {
    return 'خط الطول: $value';
  }

  @override
  String supplierCompleteOfTotalEssentialsComplete(
    String complete,
    String total,
  ) {
    return '$complete من $total أساسيات مكتملة';
  }

  @override
  String get supplierLearnerPreview => 'معاينة المتعلم';

  @override
  String get supplierHowLearnersMayDiscoverYourSupplier =>
      'كيف قد يكتشف المتعلمون ملف موردك لاحقاً.';

  @override
  String get supplierPickupAreaNotSet => 'منطقة الاستلام غير محددة';

  @override
  String get supplierSharesReusableMaterialsForStudentAnd =>
      'يشارك مواداً قابلة لإعادة الاستخدام لمشاريع الطلاب والصناع.';

  @override
  String supplierLocationVisibilityVisibility(String visibility) {
    return 'ظهور الموقع: $visibility';
  }

  @override
  String get supplierYourPublicName => 'اسمك العام';

  @override
  String supplierCurrentValue(String value) {
    return 'الحالي: $value';
  }

  @override
  String get supplierVerification => 'التحقق';

  @override
  String get supplierVerificationIsReadOnlyForNow =>
      'التحقق للقراءة فقط حالياً. ستُضاف لاحقاً عمليات رفع المستندات والمراجعة.';

  @override
  String get supplierAccountSecurity => 'أمان الحساب';

  @override
  String get supplierKeepYourAccountProtected => 'حافظ على حماية حسابك.';

  @override
  String get supplierChangePassword => 'تغيير كلمة المرور';

  @override
  String get supplierEnterYourCurrentPasswordThenChoose =>
      'أدخل كلمة المرور الحالية، ثم اختر كلمة مرور جديدة.';

  @override
  String get supplierCurrentPassword => 'كلمة المرور الحالية';

  @override
  String get supplierConfirmNewPassword => 'تأكيد كلمة المرور الجديدة';

  @override
  String get supplierUpdatePassword => 'تحديث كلمة المرور';

  @override
  String get supplierPasswordUpdatedSuccessfully =>
      'تم تحديث كلمة المرور بنجاح.';

  @override
  String get supplierPasswordCouldNotBeUpdatedPlease =>
      'تعذّر تحديث كلمة المرور. يرجى المحاولة مجدداً.';

  @override
  String get supplierThisFieldIsRequired => 'هذا الحقل مطلوب';

  @override
  String get supplierPasswordMustBeAtLeast8 =>
      'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.';

  @override
  String get supplierNewPasswordMustBeDifferentFrom =>
      'يجب أن تختلف كلمة المرور الجديدة عن الحالية.';

  @override
  String get supplierPasswordsDoNotMatch => 'كلمتا المرور غير متطابقتين.';

  @override
  String get supplierUpcomingPickups => 'عمليات الاستلام القادمة';

  @override
  String get supplierRecentMaterials => 'المواد الأخيرة';

  @override
  String get supplierMaterialPhotos => 'صور المادة';

  @override
  String get supplierAdd1To5PhotosJpg =>
      'أضف من صورة إلى 5 صور. JPG أو PNG أو WebP.';

  @override
  String get supplierAddAtLeastOneMaterialPhoto =>
      'أضف صورة واحدة على الأقل للمادة قبل النشر.';

  @override
  String get supplierSelectedPhotos => 'الصور المحددة';

  @override
  String get supplierAddImages => 'إضافة صور';

  @override
  String get supplierUploading => 'جاري الرفع...';

  @override
  String supplierCountMaxPhotos(String count, String max) {
    return '$count/$max صور';
  }

  @override
  String get supplierPickupDetails => 'تفاصيل الاستلام';

  @override
  String get supplierSendMessage => 'إرسال رسالة';

  @override
  String get supplierPickupWindowPassedChooseAFollow =>
      'انتهت نافذة الاستلام. اختر إجراء متابعة.';

  @override
  String get supplierReschedulePickup => 'إعادة جدولة الاستلام';

  @override
  String get supplierReportNoShow => 'الإبلاغ عن عدم حضور';

  @override
  String get supplierNoShowReportAlreadySubmittedFor =>
      'تم إرسال بلاغ عدم الحضور لهذا الحجز بالفعل.';

  @override
  String get supplierFollowUpMessages => 'رسائل المتابعة';

  @override
  String get supplierNoFollowUpMessagesYet => 'لا توجد رسائل متابعة بعد.';

  @override
  String get supplierWriteAShortFollowUpMessage => 'اكتب رسالة متابعة قصيرة…';

  @override
  String get supplierCouldNotLoadMessages => 'تعذر تحميل الرسائل.';

  @override
  String get supplierCouldNotSendMessage => 'تعذّر إرسال الرسالة.';

  @override
  String get supplierNeedsFollowUp => 'يحتاج متابعة';

  @override
  String get supplierOverdue => 'متأخر';

  @override
  String get supplierThisWillCancelTheReservationAnd =>
      'سيؤدي هذا إلى إلغاء الحجز وإتاحة المادة.';

  @override
  String get supplierSubmitANoShowReportFor =>
      'أرسل بلاغ عدم حضور لمراجعة المسؤول. هذا لا يؤدي إلى تعليق حساب المتعلم تلقائياً.';

  @override
  String get supplierMarkPickupAsCompleted => 'تحديد الاستلام كمكتمل؟';

  @override
  String get supplierThisWillMoveTheReservationTo =>
      'سينقل هذا الحجز إلى مكتمل ويحدد المادة كمعاد استخدامها.';

  @override
  String get supplierAcceptRequest => 'قبول الطلب';

  @override
  String get supplierChooseAPickupWindowForThe => 'اختر نافذة استلام للمتعلم.';

  @override
  String get supplierDeclineRequest => 'رفض الطلب';

  @override
  String get supplierYouCanAddAnOptionalReason =>
      'يمكنك إضافة سبب اختياري للمتعلم.';

  @override
  String get supplierReasonOptional => 'السبب (اختياري)';

  @override
  String get supplierPickupDate => 'تاريخ الاستلام';

  @override
  String get supplierDriverPickupWindowFromSupplier =>
      'نافذة استلام السائق من المورد';

  @override
  String get supplierByAcceptingYouAgreeToHand =>
      'بالقبول، توافق على تسليم المادة للسائق خلال نافذة الاستلام هذه. سنتحقق من ذلك مقابل نوافذ التوصيل المفضلة للمتعلم.';

  @override
  String get supplierWeWillCheckThisAgainstThe =>
      'سنتحقق من ذلك مقابل نوافذ التوصيل المفضلة للمتعلم.';

  @override
  String supplierEarliestDeliveryAfterPickupTime(String time) {
    return 'أقرب توصيل بعد الاستلام: $time';
  }

  @override
  String supplierConfirmedLearnerDeliveryWindowWindow(String window) {
    return 'نافذة التوصيل المؤكدة للمتعلم: $window';
  }

  @override
  String get supplierNoFeasibleLearnerDeliveryWindowThis =>
      'لا توجد نافذة توصيل مناسبة للمتعلم. سينتظر هذا تأكيد المتعلم.';

  @override
  String get supplierThisScheduleCanBeAcceptedDirectly =>
      'يمكن قبول هذا الجدول مباشرة.';

  @override
  String get supplierThisDeliveryWindowIsNotFeasible =>
      'نافذة التوصيل هذه غير مناسبة بعد استلام المورد وفترة السفر. سيلزم تأكيد المتعلم.';

  @override
  String get supplierSelectedLearnerPreferredWindow =>
      'تم اختيار نافذة الاستلام المفضلة للمتعلم';

  @override
  String get supplierCustomProposedWindow => 'نافذة مقترحة مخصصة';

  @override
  String get supplierLearnerPreferredPickupWindows =>
      'نوافذ الاستلام المفضلة للمتعلم';

  @override
  String get supplierLearnerPreferredDeliveryWindows =>
      'نوافذ التوصيل المفضلة للمتعلم';

  @override
  String get supplierDeliveryNote => 'ملاحظة التوصيل';

  @override
  String get supplierSelectedLearnerDeliveryWindowWillBe =>
      'سيتم استخدام نافذة التوصيل المفضلة للمتعلم عندما تكون ممكنة.';

  @override
  String get supplierProposeCustomDeliveryWindow => 'اقتراح نافذة توصيل مخصصة';

  @override
  String get supplierProposedLearnerDeliveryWindow =>
      'نافذة التوصيل المقترحة للمتعلم';

  @override
  String get supplierChooseTheProposedDeliveryDateAnd =>
      'اختر تاريخ ووقت التوصيل المقترح.';

  @override
  String get supplierProposedPickupTimeWaitingForLearner =>
      'وقت الاستلام المقترح — في انتظار تأكيد المتعلم';

  @override
  String get supplierSchedulingConflictWaitingForLearnerConfirmation =>
      'تعارض في الجدولة — في انتظار تأكيد المتعلم';

  @override
  String get supplierRequestSubmittedAwaitingLearnerConfirmation =>
      'تم إرسال الطلب — في انتظار تأكيد المتعلم';

  @override
  String get supplierStartTime => 'وقت البداية';

  @override
  String get supplierEndTime => 'وقت النهاية';

  @override
  String get supplierPickupNoteOptional => 'ملاحظة الاستلام (اختياري)';

  @override
  String get supplierTapToChoose => 'اضغط للاختيار';

  @override
  String get supplierPriceVerified => 'تم التحقق من السعر';

  @override
  String get supplierVerifyPriceBeforePublishing => 'تحقق من السعر قبل النشر';

  @override
  String get supplierPriceVerificationRequired => 'التحقق من السعر مطلوب';

  @override
  String get supplierWithinApprovedCapVerifyPriceTo =>
      'ضمن الحد المعتمد — تحقق من السعر للنشر';

  @override
  String get supplierCategoryRequests => 'طلبات الفئات';

  @override
  String supplierApprovedAsName(String name) {
    return 'موافق عليه كـ $name';
  }

  @override
  String get supplierWaitingForAdminApproval => 'بانتظار موافقة المسؤول.';

  @override
  String get supplierContinueListing => 'متابعة الإدراج';

  @override
  String get supplierDefaultPickupLocation => 'موقع الاستلام الافتراضي';

  @override
  String get supplierVisibility => 'الظهور';

  @override
  String get supplierLocationCaptured => 'تم تحديد الموقع';

  @override
  String get supplierNoAreaSelectedYet => 'لم يُحدد موقع بعد';

  @override
  String supplierVisibilityValue(String value) {
    return 'الظهور: $value';
  }

  @override
  String supplierTodayTodayUpcomingUpcomingCompletedCompleted(
    String today,
    String upcoming,
    String completed,
  ) {
    return 'اليوم: $today   قادمة: $upcoming   مكتملة: $completed';
  }

  @override
  String supplierRequesterName(String name) {
    return 'مقدم الطلب: $name';
  }

  @override
  String supplierQtyQty(String qty) {
    return 'الكمية: $qty';
  }

  @override
  String get supplierChooseAPickupDateAndTime =>
      'اختر تاريخ استلام ونافذة زمنية.';

  @override
  String get supplierSchedulePending => 'الجدول معلق';

  @override
  String get supplierAcceptedReservationsWithPickupWindowsWill =>
      'ستظهر الحجوزات المقبولة مع نوافذ الاستلام هنا.';

  @override
  String get supplierRecentListingsWillAppearHereAfter =>
      'ستظهر الإدراجات الأخيرة هنا بعد إضافة مواد قابلة لإعادة الاستخدام.';

  @override
  String get supplierActivityFromReservationsAndNotificationsWill =>
      'سيجتمع هنا النشاط من الحجوزات والإشعارات.';

  @override
  String get supplierOrganizationProfile => 'ملف المؤسسة';

  @override
  String get supplierRingTheWorkshopBellWhenYou => 'اضغط جرس الورشة عند وصولك.';

  @override
  String get supplierAlreadyReservedForAnotherLearner => 'محجوز لمُتعلم آخر.';

  @override
  String get supplierMaterialListingFoundationReady => 'أساس إدراج المواد جاهز';

  @override
  String supplierCountMaterialCategoriesLoaded(String count) {
    return 'تم تحميل $count فئات مواد.';
  }

  @override
  String get supplierLoadingCategories => 'جاري تحميل الفئات...';

  @override
  String get supplierCategoriesCouldNotBeLoadedYet => 'تعذّر تحميل الفئات بعد.';

  @override
  String get supplierLoadingListingPolicy => 'جاري تحميل سياسة الإدراج...';

  @override
  String get supplierListingPolicyUnavailable => 'سياسة الإدراج غير متاحة.';

  @override
  String get supplierUseYourCurrentLocationOrEnter =>
      'استخدم موقعك الحالي أو أدخل تفاصيل الاستلام يدوياً.';

  @override
  String get supplierTapTheMapToPlaceThe =>
      'اضغط على الخريطة لوضع دبوس الاستلام';

  @override
  String get supplierPickupPinSelectedOnMap =>
      'تم تحديد دبوس الاستلام على الخريطة';

  @override
  String get supplierPickupType => 'نوع الاستلام';

  @override
  String get supplierDate => 'التاريخ';

  @override
  String get supplierTime => 'الوقت';

  @override
  String get supplierMaterialRequest => 'المادة والطلب';

  @override
  String supplierPickupWindowRange(String range) {
    return 'نافذة الاستلام: $range';
  }

  @override
  String get supplierInstructions => 'التعليمات';

  @override
  String get supplierNoPickupInstructions => 'لا توجد تعليمات استلام.';

  @override
  String get supplierNoDeclineReasonProvided => 'لم يُقدَّم سبب للرفض.';

  @override
  String get supplierThisRequestExpiredBecauseYouDid =>
      'انتهت صلاحية هذا الطلب لأنك لم تقبل أو ترفض في الوقت المحدد.';

  @override
  String get supplierSupplierNote => 'ملاحظة المورد';

  @override
  String get supplierLearnerMessage => 'رسالة المتعلم';

  @override
  String get supplierCover => 'الغلاف';

  @override
  String get supplierDismiss => 'إغلاق';

  @override
  String get supplierAccountApprovedBanner =>
      'تمت الموافقة على حساب المورد. يمكنك الآن نشر المواد.';

  @override
  String get supplierWaitingForAdminApprovalPublish =>
      'حساب المورد بانتظار موافقة الإدارة. يمكنك نشر المواد بعد الموافقة.';

  @override
  String get supplierCommonSupplierTasks => 'مهام المورد الشائعة';

  @override
  String get supplierActivityWillAppearAsLearners =>
      'سيظهر النشاط هنا عندما يطلب المتعلمون موادك ويجمعونها.';

  @override
  String supplierPendingReservationsWaitingResponse(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'لديك $count حجز معلق بانتظار ردك.',
      many: 'لديك $count حجزًا معلقًا بانتظار ردك.',
      few: 'لديك $count حجوزات معلقة بانتظار ردك.',
      two: 'لديك حجزان معلقان بانتظار ردك.',
      one: 'لديك حجز واحد معلق بانتظار ردك.',
    );
    return '$_temp0';
  }

  @override
  String supplierCountRequestsNeedResponse(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count طلب يحتاج ردك.',
      many: '$count طلبًا يحتاج ردك.',
      few: '$count طلبات تحتاج ردك.',
      two: 'طلبان يحتاجان ردك.',
      one: 'طلب واحد يحتاج ردك.',
    );
    return '$_temp0';
  }

  @override
  String supplierCountReservationsCompleted(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'اكتمل $count حجز بنجاح.',
      many: 'اكتمل $count حجزًا بنجاح.',
      few: 'اكتمل $count حجوزات بنجاح.',
      two: 'اكتمل حجزان بنجاح.',
      one: 'اكتمل حجز واحد بنجاح.',
    );
    return '$_temp0';
  }

  @override
  String get supplierBasicInformation => 'المعلومات الأساسية';

  @override
  String get supplierTellLearnersWhatMaterial =>
      'أخبر المتعلمين عن المادة التي تقدمها.';

  @override
  String get supplierWhyExistingCategoriesDoNotFit =>
      'لماذا لا تناسب الفئات الحالية';

  @override
  String get supplierExplainMaterialKindAndWhy =>
      'اشرح نوع المادة ولماذا لا تناسب أي من الفئات الحالية.';

  @override
  String get supplierMaterialTypeSlashName => 'نوع / اسم المادة';

  @override
  String get supplierSearchOrTypeMaterialName => 'ابحث أو اكتب اسم المادة';

  @override
  String get supplierClearSpecificTitlesHelp =>
      'العناوين الواضحة والمحددة تساعد المتعلمين على فهم العنصر.';

  @override
  String get supplierIncludeDetailsHelpLearners =>
      'أضف تفاصيل تساعد المتعلمين على معرفة ما إذا كانت المادة مناسبة لمشروعهم.';

  @override
  String get supplierSetQuantityAndPrice => 'حدد الكمية المتاحة والسعر.';

  @override
  String get supplierPickupAndDelivery => 'الاستلام والتوصيل';

  @override
  String get supplierSetHowLearnersReceive =>
      'حدد كيف يمكن للمتعلمين استلام هذه المادة.';

  @override
  String get supplierPhotosSectionSubtitle =>
      'أضف صورًا لمساعدة المتعلمين على رؤية المادة بوضوح.';

  @override
  String get supplierChecklist => 'قائمة التحقق';

  @override
  String get supplierReadyToPublish => 'جاهز للنشر';

  @override
  String get supplierChooseCategoryChecklist => 'اختر فئة';

  @override
  String get supplierEnterMaterialTypeChecklist => 'أدخل نوع/اسم المادة';

  @override
  String get supplierEnterListingTitleChecklist => 'أدخل عنوان الإعلان';

  @override
  String get supplierAddDescriptionChecklist => 'أضف وصفًا';

  @override
  String get supplierSetConditionChecklist => 'حدد الحالة';

  @override
  String get supplierAddQuantityUnitChecklist => 'أضف الكمية والوحدة';

  @override
  String get supplierSelectFreeOrPriceChecklist =>
      'اختر مجاني أو أدخل سعرًا صالحًا';

  @override
  String get supplierVerifyPaidPriceChecklist =>
      'تحقق من السعر للمواد المدفوعة';

  @override
  String get supplierChooseFulfillmentChecklist =>
      'اختر خيار تسليم واحدًا على الأقل';

  @override
  String get supplierAddPhotoChecklist => 'أضف صورة واحدة على الأقل';

  @override
  String get supplierGeneralCategory => 'عام';

  @override
  String get supplierImageUploadFailed => 'فشل رفع الصورة';

  @override
  String get supplierEnterMaterialNameBeforeCategory =>
      'أدخل اسم المادة قبل طلب فئة جديدة.';

  @override
  String get supplierDescribeMaterialForCategory =>
      'صف المادة حتى تتمكن الإدارة من مراجعة طلب الفئة.';

  @override
  String get supplierEnterRequestedCategoryName => 'أدخل اسم الفئة المطلوبة.';

  @override
  String get supplierExplainWhyCategoriesDoNotFit =>
      'اشرح لماذا لا تناسب الفئات الحالية.';

  @override
  String get supplierEnterValidQuantityForMaterial =>
      'أدخل كمية صالحة لهذه المادة.';

  @override
  String get supplierEnterUnitForMaterial => 'أدخل وحدة هذه المادة.';

  @override
  String get supplierCouldNotUploadImages =>
      'تعذر رفع الصور. يرجى المحاولة مرة أخرى.';

  @override
  String get supplierCategoryStillPendingReview =>
      'طلب الفئة ما زال بانتظار مراجعة الإدارة.';

  @override
  String get supplierCategoryNoLongerAvailable =>
      'الفئة المحددة غير متاحة الآن. حدّث الفئات واختر مرة أخرى.';

  @override
  String get supplierDetailsNotSavedComplete =>
      'لم تُحفظ بعض تفاصيل المادة. يرجى إكمال الحقول الناقصة.';

  @override
  String get supplierCouldNotLoadSavedDraft =>
      'تعذر تحميل مسودة الإعلان المحفوظة. يرجى المحاولة مرة أخرى.';

  @override
  String supplierUseForListing(String name) {
    return 'استخدم $name لهذا الإعلان.';
  }

  @override
  String supplierCategoryRejectedUseSuggested(String name) {
    return 'تم رفض طلب الفئة. استخدم $name لهذا الإعلان.';
  }

  @override
  String get supplierCategoryRejectedChooseExisting =>
      'تم رفض طلب الفئة. اختر فئة موجودة وتابع.';

  @override
  String get supplierResolveCategoryBeforePriceReview =>
      'أنهِ طلب الفئة قبل إرسال مراجعة السعر.';

  @override
  String get supplierSelectValidCategoryBeforePriceReview =>
      'يرجى اختيار فئة صالحة قبل إرسال مراجعة السعر.';

  @override
  String get supplierEnterMaterialNameBeforePriceReview =>
      'أدخل اسم المادة قبل إرسال مراجعة السعر.';

  @override
  String get supplierEnterDescriptionBeforePriceReview =>
      'أدخل وصف المادة قبل إرسال مراجعة السعر.';

  @override
  String get supplierQuantityUnitRequiredBeforePriceReview =>
      'الكمية والوحدة مطلوبتان قبل إرسال مراجعة السعر.';

  @override
  String get supplierEnterValidPaidPriceBeforePriceReview =>
      'أدخل سعرًا مدفوعًا صالحًا قبل إرسال مراجعة السعر.';

  @override
  String get supplierEnterMaterialNameBeforePriceReview2 =>
      'أدخل اسم المادة قبل إرسال مراجعة السعر.';

  @override
  String supplierPriceAcceptedMaxAllowed(String max) {
    return 'تم قبول السعر. الحد الأقصى المسموح هو $max شيكل.';
  }

  @override
  String supplierMaxAllowedPriceEnterLess(String max) {
    return 'الحد الأقصى المسموح هو $max شيكل. يرجى إدخال $max شيكل أو أقل.';
  }

  @override
  String supplierMaxAllowedPricePerUnitEnterLess(String max, String unit) {
    return 'الحد الأقصى المسموح هو $max شيكل لكل $unit. يرجى إدخال $max شيكل أو أقل.';
  }

  @override
  String get supplierPaidMaterialNeedsPriceReview =>
      'تحتاج هذه المادة المدفوعة إلى مراجعة سعر من الإدارة قبل النشر.';

  @override
  String get supplierMaterialBeingPublished =>
      'جاري نشر هذه المادة. يرجى الانتظار قليلًا.';

  @override
  String get supplierPublishAttemptMismatch =>
      'محاولة النشر لا تطابق الطلب المحفوظ. أعد تعيين النموذج أو ابدأ من صفحة إضافة مادة جديدة.';

  @override
  String get supplierSelectValidCategoryBeforePublishing =>
      'يرجى اختيار فئة صالحة قبل النشر.';

  @override
  String get supplierEnterNumberGreaterThanZero => 'أدخل رقمًا أكبر من صفر';

  @override
  String supplierUnitPriceMustBeOrLess(String max) {
    return 'يجب أن يكون سعر الوحدة $max شيكل أو أقل.';
  }

  @override
  String get supplierListingTitleHintExample =>
      'مثال: مجموعات Breadboard نصف الحجم (دفعة احتياطية)';

  @override
  String get supplierInventoryOverview => 'نظرة عامة على المخزون';

  @override
  String get supplierMonitorMaterialAvailability =>
      'راقب توفر المواد والطلبات وحالة الإعلانات.';

  @override
  String get supplierClearSearch => 'مسح البحث';

  @override
  String get supplierResetFilters => 'إعادة ضبط الفلاتر';

  @override
  String get supplierReset => 'إعادة ضبط';

  @override
  String get supplierClearAll => 'مسح الكل';

  @override
  String get supplierMaterialsSection => 'المواد';

  @override
  String supplierShownOfTotal(int shown, int total) {
    return 'يُعرض $shown من $total';
  }

  @override
  String get supplierListingPreviewSubtitle => 'هكذا ستظهر مادتك للمتعلمين.';

  @override
  String get supplierMaterialTitlePlaceholder => 'سيظهر عنوان المادة هنا';

  @override
  String get supplierShortDescriptionPlaceholder =>
      'سيظهر وصف قصير لمادتك هنا.';

  @override
  String get supplierQuantityPlaceholder => 'ستظهر الكمية هنا';

  @override
  String get supplierPickupLocationPlaceholder => 'سيظهر موقع الاستلام هنا';

  @override
  String get supplierPickupAvailable => 'الاستلام متاح';

  @override
  String get supplierPickupUnavailable => 'الاستلام غير متاح';

  @override
  String get supplierInternalDeliveryAvailable => 'التوصيل الداخلي متاح';

  @override
  String get supplierDeliveryUnavailable => 'التوصيل غير متاح';

  @override
  String get supplierNoImageYet => 'لا توجد صورة بعد';

  @override
  String get supplierAddPhotosToSeePreview => 'أضف صورًا لمعاينة الإعلان';

  @override
  String supplierYouCanAddUpToPhotos(int max) {
    return 'يمكنك إضافة حتى $max صور.';
  }

  @override
  String supplierOnlyMorePhotosCanBeAdded(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'يمكن إضافة $count صورة فقط.',
      many: 'يمكن إضافة $count صورة فقط.',
      few: 'يمكن إضافة $count صور فقط.',
      two: 'يمكن إضافة صورتين فقط.',
      one: 'يمكن إضافة صورة واحدة فقط.',
    );
    return '$_temp0';
  }

  @override
  String supplierCouldNotReadImage(String name) {
    return 'تعذر قراءة \"$name\". جرّب صورة أخرى.';
  }

  @override
  String supplierFileLargerThan5Mb(String name) {
    return '$name أكبر من 5 ميجابايت.';
  }

  @override
  String supplierFileMustBeJpgPngWebp(String name) {
    return 'يجب أن يكون $name بصيغة JPG أو PNG أو WebP.';
  }

  @override
  String get supplierReuseHistoryWillAppear =>
      'سيظهر سجل إعادة الاستخدام هنا بعد اكتمال الحجوزات.';

  @override
  String supplierAvailableOfTotal(String available, String total, String unit) {
    return 'المتاح: $available من $total $unit';
  }

  @override
  String get supplierAccessDenied => 'الوصول مرفوض';

  @override
  String get supplierYouNeedASupplierAccountTo =>
      'تحتاج حساب مورد للوصول إلى هذه المنطقة.';

  @override
  String get supplierSupplierAccessRequired => 'مطلوب وصول المورد';

  @override
  String get supplierYouNeedASupplierRoleTo =>
      'تحتاج دور المورد للوصول إلى بوابة المورد.';

  @override
  String get supplierGoToHome => 'الذهاب للرئيسية';

  @override
  String get supplierDeliveryRequested => 'تم طلب التوصيل';

  @override
  String get supplierAttentionNeedsYourResponse => 'يحتاج ردك';

  @override
  String get supplierAttentionWaitingForLearner => 'بانتظار المتعلم';

  @override
  String get supplierAttentionInProgress => 'قيد التنفيذ';

  @override
  String get supplierAttentionAdminReview => 'مراجعة إدارية';

  @override
  String get supplierAttentionNoFurtherAction => 'لا إجراء إضافي';

  @override
  String get supplierAttentionTerminal => 'نهائي';

  @override
  String supplierAttentionNextActor(String attention, String actor) {
    return '$attention · التالي: $actor';
  }

  @override
  String get supplierNextActorAdmin => 'المشرف';

  @override
  String get supplierNextActorSystem => 'النظام';

  @override
  String get supplierNextActorNone => 'لا جهة فاعلة';

  @override
  String get supplierRecoveryNextAdmin => 'استعادة · التالي: المشرف';

  @override
  String get supplierWorkflowInitialDecision => 'قرار أولي';

  @override
  String get supplierWorkflowScheduling => 'جدولة';

  @override
  String get supplierWorkflowSelfPickup => 'استلام ذاتي';

  @override
  String get supplierWorkflowDelivery => 'توصيل';

  @override
  String get supplierWorkflowRecovery => 'استعادة';

  @override
  String get supplierCompletedSuccessfully => 'اكتمل بنجاح';

  @override
  String get supplierNoResponseBeforeDeadline => 'لم يصل رد قبل الموعد النهائي';

  @override
  String get supplierCompletedFulfillment => 'اكتمل التنفيذ';

  @override
  String get supplierCancelledBeforeFulfillment => 'أُلغي قبل التنفيذ';

  @override
  String get supplierExpiredBeforeFulfillment => 'انتهت صلاحيته قبل التنفيذ';

  @override
  String get supplierClosedAfterNoShow => 'أُغلق بعد عدم حضور المتعلم';

  @override
  String get supplierRejectedBeforeFulfillment => 'رُفض قبل التنفيذ';

  @override
  String get supplierFinalReservationOutcome => 'النتيجة النهائية للحجز';

  @override
  String get supplierTerminalVerbCancelled => 'أُلغي';

  @override
  String get supplierTerminalVerbExpired => 'انتهت صلاحيته';

  @override
  String get supplierTerminalVerbCompleted => 'اكتمل';

  @override
  String get supplierTerminalVerbClosed => 'أُغلق';

  @override
  String get supplierActionAcceptLearnerTime => 'قبول وقت المتعلم';

  @override
  String get supplierActionCompleteSelfPickup => 'إكمال الاستلام الذاتي';

  @override
  String get supplierProposeNewTime => 'اقتراح وقت مختلف';

  @override
  String get supplierAcceptNewTime => 'قبول وقت جديد';

  @override
  String get supplierActionMarkLearnerNoShow => 'تسجيل عدم حضور المتعلم';

  @override
  String get supplierActionReportIncident => 'الإبلاغ عن حادثة';

  @override
  String get supplierActionReportNoDriver => 'الإبلاغ عن عدم توفر سائق';

  @override
  String get supplierActionMarkPickupExpired => 'تعليم الاستلام منتهيًا';

  @override
  String get supplierActionReportDriverNoShow => 'الإبلاغ عن عدم حضور السائق';

  @override
  String get supplierActionSubmitRecoveryWindow =>
      'إرسال نافذة استلام للاستعادة';

  @override
  String get supplierConfirmPickup => 'تأكيد الاستلام';

  @override
  String get supplierSubmitPickupWindow => 'إرسال نافذة الاستلام';

  @override
  String get supplierReviewReschedule => 'مراجعة إعادة الجدولة';

  @override
  String get supplierReportToAdmin => 'الإبلاغ للمشرف';

  @override
  String get supplierStatusFilterAwaitingLearner => 'بانتظار المتعلم';

  @override
  String get supplierStatusFilterAwaitingSupplier => 'بانتظار المورد';

  @override
  String get supplierStatusFilterAwaitingResolution => 'بانتظار الحل';

  @override
  String get supplierNoShowReasonLearnerDidNotArrive => 'لم يحضر المتعلم';

  @override
  String get supplierNoShowReasonRepeatedDelay => 'تأخير متكرر';

  @override
  String get supplierNoShowReasonWrongInformation => 'معلومات خاطئة';

  @override
  String get supplierNoShowReasonSafetyConcern => 'مخاوف أمان أو ثقة';

  @override
  String get supplierNoShowReasonOther => 'أخرى';

  @override
  String get supplierNotProposed => 'غير مقترح';

  @override
  String supplierWindowUntil(String time) {
    return 'حتى $time';
  }

  @override
  String supplierWindowFrom(String time) {
    return 'من $time';
  }

  @override
  String get supplierTomorrow => 'غدًا';

  @override
  String get supplierNeedsAttention => 'يحتاج انتباهًا';

  @override
  String get supplierOperationalOverview => 'نظرة تشغيلية';

  @override
  String get supplierAllAttention => 'كل حالات الانتباه';

  @override
  String get supplierAllFulfillment => 'كل طرق التنفيذ';

  @override
  String get supplierAllStatuses => 'كل الحالات';

  @override
  String get supplierMoreFilters => 'مزيد من الفلاتر';

  @override
  String supplierFiltersCount(String count) {
    return 'فلاتر $count';
  }

  @override
  String get supplierDateRange => 'نطاق التاريخ';

  @override
  String get supplierSearchRequestsHint => 'ابحث عن مادة أو متعلم أو معرف حجز';

  @override
  String get supplierHistoryActive => 'نشط';

  @override
  String get supplierHistoryTerminal => 'السجل';

  @override
  String supplierCompletedCount(String count) {
    return 'مكتمل $count';
  }

  @override
  String supplierClosedCount(String count) {
    return 'مغلق $count';
  }

  @override
  String supplierShowingRange(String start, String end, String total) {
    return 'عرض $start–$end من $total';
  }

  @override
  String supplierShowingRangeRequests(String start, String end, String total) {
    return 'عرض $start–$end من $total طلب';
  }

  @override
  String supplierActiveFiltersCount(String count) {
    return '$count فلاتر';
  }

  @override
  String get supplierColumnRequest => 'الطلب';

  @override
  String get supplierColumnFulfillmentSchedule => 'التنفيذ والجدولة';

  @override
  String get supplierColumnStatusAttention => 'الحالة والانتباه';

  @override
  String get supplierColumnDetails => 'التفاصيل';

  @override
  String supplierPerPage(String count) {
    return '$count لكل صفحة';
  }

  @override
  String get supplierViewRequestDetails => 'عرض تفاصيل الطلب';

  @override
  String supplierViewRequestDetailsForMaterial(String material) {
    return 'عرض تفاصيل طلب $material';
  }

  @override
  String get supplierNoConfirmedTimeYet => 'لا وقت مؤكد بعد';

  @override
  String get supplierAdminRecoveryInProgress => 'استعادة إدارية قيد التنفيذ';

  @override
  String get supplierDeliveryHandledByDriver =>
      'يُدار هذا الحجز عبر التوصيل. السائق سيُعلّمه مكتملًا.';

  @override
  String get supplierMessagesWorkspaceNote =>
      'ستبقى رسائل الطلب متاحة في مساحة عمل الطلب.';

  @override
  String get supplierNoFurtherActionRequired =>
      'لا يلزم أي إجراء إضافي لهذا الطلب.';

  @override
  String get supplierRequestDetails => 'تفاصيل الطلب';

  @override
  String get supplierBackToIncomingRequests => 'العودة إلى الطلبات الواردة';

  @override
  String get supplierAvailableActions => 'الإجراءات المتاحة';

  @override
  String get supplierMore => 'المزيد';

  @override
  String get supplierMarkLearnerNoShowTitle => 'تسجيل عدم حضور المتعلم؟';

  @override
  String get supplierMarkLearnerNoShowMessage =>
      'سيُسجّل عدم حضور المتعلم لهذا الحجز.';

  @override
  String get supplierMarkLearnerNoShowConfirm => 'تسجيل عدم الحضور';

  @override
  String get supplierCouldNotUpdateRequest => 'تعذّر تحديث هذا الطلب.';

  @override
  String get supplierRequestSummary => 'ملخص الطلب';

  @override
  String supplierLearnerLine(String name) {
    return 'المتعلم: $name';
  }

  @override
  String get supplierOriginalLearnerNote => 'ملاحظة المتعلم الأصلية';

  @override
  String get supplierDeliveryAddressLabel => 'عنوان التوصيل';

  @override
  String supplierDeliveryAddressPrefix(String address) {
    return 'عنوان التوصيل: $address';
  }

  @override
  String get supplierSupplierProposal => 'اقتراح المورد';

  @override
  String get supplierLearnerProposal => 'اقتراح المتعلم';

  @override
  String get supplierConfirmedPickupWindow => 'نافذة الاستلام المؤكدة';

  @override
  String get supplierScheduleNegotiation => 'الجدولة والتفاوض';

  @override
  String get supplierAdminInitiatedRecovery => 'استعادة بدأها المشرف';

  @override
  String get supplierPendingReschedule => 'إعادة جدولة معلقة';

  @override
  String get supplierNoWindowProposed =>
      'لا توجد نافذة استلام أو توصيل مقترحة حاليًا.';

  @override
  String get supplierSchedulingContext => 'سياق الجدولة';

  @override
  String supplierEarliestFeasibleDelivery(String time) {
    return 'أقرب توصيل ممكن: $time';
  }

  @override
  String get supplierNoWindowConfirmedPickup =>
      'لم تُؤكَّد نافذة استلام أو توصيل لهذا الطلب.';

  @override
  String supplierNoWindowConfirmedBeforeTerminal(String verb) {
    return 'لم تُؤكَّد نافذة استلام قبل أن يُ$verb هذا الطلب.';
  }

  @override
  String get supplierScheduleHistory => 'سجل الجدولة';

  @override
  String get supplierFulfillmentAndDelivery => 'التنفيذ والتوصيل';

  @override
  String get supplierHandoverCodeAvailable => 'رمز متاح';

  @override
  String get supplierFailureRecovery => 'فشل / استعادة';

  @override
  String get supplierDeliveryNotCreated =>
      'لم يُختَر التوصيل أو يُنشأ لهذا الحجز.';

  @override
  String get supplierAttentionTitle => 'الانتباه';

  @override
  String get supplierAwaitingAdminResolution =>
      'هذا الطلب بانتظار حل إداري. عناصر تحكم المورد للقراءة فقط ما لم يُتاح إجراء.';

  @override
  String get supplierIncidentAdminReview => 'حادثة / مراجعة إدارية';

  @override
  String get supplierReportIdLabel => 'معرف البلاغ';

  @override
  String get supplierOperationalStateLabel => 'الحالة التشغيلية';

  @override
  String get supplierSupplierExplanation => 'شرح المورد';

  @override
  String get supplierAdminReviewNote => 'ملاحظة المراجعة الإدارية';

  @override
  String get supplierGroupContext => 'سياق المجموعة';

  @override
  String get supplierItemsInGroup => 'عناصر في المجموعة';

  @override
  String get supplierGroupedReservationItem => 'عنصر حجز مجمّع';

  @override
  String get supplierMoreGroupItems => 'تتوفر المزيد من العناصر في المجموعة.';

  @override
  String get supplierMessagesTitle => 'الرسائل';

  @override
  String supplierMessagesTitleWithCount(int count) {
    return 'الرسائل ($count)';
  }

  @override
  String get supplierNoMessagesYet => 'لا رسائل بعد.';

  @override
  String get supplierTypeMessageHint => 'اكتب رسالة…';

  @override
  String get supplierSendMessageTooltip => 'إرسال رسالة';

  @override
  String get supplierYou => 'أنت';

  @override
  String get supplierReservationUpdated => 'تم تحديث الحجز';

  @override
  String supplierHistoryStatusChange(String from, String to) {
    return '$from → $to';
  }

  @override
  String get supplierRequestNotFound => 'الطلب غير موجود';

  @override
  String get supplierRequestUnavailable => 'هذا الطلب غير متاح.';

  @override
  String get supplierCouldNotLoadRequestTitle => 'تعذّر تحميل الطلب';

  @override
  String get supplierCouldNotLoadRequest =>
      'تعذّر تحميل هذا الطلب. حاول مرة أخرى.';

  @override
  String get supplierFulfillmentLabel => 'التنفيذ';

  @override
  String get supplierLearnerEmail => 'بريد المتعلّم';

  @override
  String get supplierMethodLabel => 'الطريقة';

  @override
  String get supplierDeliveryStatusLabel => 'حالة التوصيل';

  @override
  String get supplierGroupLabel => 'المجموعة';

  @override
  String get supplierHandoverLabel => 'التسليم';

  @override
  String get supplierOutcomeLabel => 'النتيجة';

  @override
  String get supplierGroupIdLabel => 'معرّف المجموعة';

  @override
  String get supplierItemsLabel => 'العناصر';

  @override
  String get supplierConfirmedDeliveryWindow => 'موعد التوصيل المؤكد';

  @override
  String get supplierSupplierDeliveryPickupWindow =>
      'موعد استلام المورّد للتوصيل';

  @override
  String get supplierNewWindowAwaiting => 'موعد جديد بانتظار الرد التالي.';

  @override
  String supplierActorRequestedReschedule(String actor) {
    return 'طلب $actor إعادة الجدولة';
  }

  @override
  String supplierNextActorLine(String actor) {
    return 'الدور التالي: $actor';
  }

  @override
  String get supplierReservationHistory => 'سجل الحجز';

  @override
  String get supplierNoHistoryEvents => 'لم يتم إرجاع أي أحداث في السجل.';

  @override
  String get supplierWorkflowField => 'سير العمل';

  @override
  String get supplierRescheduleReasonLabel => 'السبب';

  @override
  String get supplierRescheduleReasonHint => 'لماذا تطلب وقتًا جديدًا؟';

  @override
  String get supplierSendRequest => 'إرسال الطلب';

  @override
  String get supplierRescheduleRequestSent =>
      'أُرسل طلب إعادة الجدولة إلى المتعلم.';

  @override
  String get supplierChooseNewPickupWindow => 'اختر نافذة استلام جديدة';

  @override
  String get supplierPickupWindowSubmittedWaiting =>
      'أُرسلت نافذة الاستلام. بانتظار السائق مجددًا.';

  @override
  String get supplierNewPickupTimeAccepted => 'قُبل وقت الاستلام الجديد.';

  @override
  String get supplierReservationClosed => 'أُغلق الحجز.';

  @override
  String get supplierReportToAdminTitle => 'الإبلاغ للمشرف';

  @override
  String get supplierReportToAdminMessage =>
      'أرسل بلاغًا للمراجعة الإدارية. سيُغلق الحجز.';

  @override
  String get supplierReportAndClose => 'الإبلاغ والإغلاق';

  @override
  String get supplierDescribeWhatHappened => 'صف ما حدث';

  @override
  String get supplierNoteRequired => 'ملاحظة (مطلوبة)';

  @override
  String get supplierSubmitReport => 'إرسال البلاغ';

  @override
  String get supplierMarkPickupExpiredTitle => 'تعليم نافذة الاستلام منتهية';

  @override
  String get supplierMarkPickupExpiredMessage =>
      'لم يقبل أي سائق هذا التوصيل قبل انتهاء نافذة استلام المورد. سيُغلق محاولة التوصيل ويُحال للمراجعة الإدارية.';

  @override
  String get supplierMarkExpired => 'تعليم منتهيًا';

  @override
  String get supplierPickupExpiredAdminReview =>
      'عُلّمت نافذة الاستلام منتهية. المراجعة الإدارية قيد التنفيذ.';

  @override
  String get supplierReportNoDriverTitle => 'الإبلاغ عن عدم توفر سائق';

  @override
  String get supplierReportNoDriverHint =>
      'صف سبب عدم قبول أي سائق لهذا التوصيل';

  @override
  String get supplierNoDriverReported => 'أُبلغ عن حالة عدم توفر سائق للمشرف.';

  @override
  String get supplierReportDriverNoShowTitle => 'الإبلاغ عن عدم حضور السائق';

  @override
  String get supplierReportDriverNoShowHint => 'صف ما حدث عند استلام المورد';

  @override
  String get supplierDriverNoShowReported => 'أُبلغ عن عدم حضور السائق للمشرف.';

  @override
  String get supplierPickupConfirmationCodeLabel => 'رمز تأكيد الاستلام';

  @override
  String get supplierPickupConfirmationCodeHint =>
      'أدخل رمز تأكيد الاستلام الذي يعطيك إياه المتعلم عند استلام المادة.';

  @override
  String get supplierPickupConfirmationCodeError =>
      'أدخل رمز الاستلام المكوّن من 6 أرقام من المتعلم.';

  @override
  String get supplierDeliveryWindowMustStartFuture =>
      'يجب أن تبدأ نافذة التوصيل في المستقبل.';

  @override
  String get supplierInboxRefreshFailed => 'تعذّر تحديث الطلبات الواردة.';

  @override
  String get supplierEmptyAllCaughtUp => 'أنت على اطلاع بكل شيء';

  @override
  String get supplierEmptyNoWaitingLearnerSubtitle =>
      'لا توجد طلبات تحتاج ردك حاليًا.';

  @override
  String get supplierEmptyNoWaitingLearner =>
      'لا توجد طلبات بانتظار تأكيد المتعلم.';

  @override
  String get supplierEmptyNoActiveFulfillment => 'لا استلامات أو توصيلات نشطة.';

  @override
  String get supplierEmptyNoAdminReview =>
      'لا توجد طلبات قيد المراجعة الإدارية.';

  @override
  String get supplierEmptyNoTerminalHistory =>
      'لم يُعثر على طلبات مكتملة أو مغلقة.';

  @override
  String get supplierEmptyNoFilterMatch =>
      'لا توجد طلبات تطابق الفلاتر المحددة.';

  @override
  String get supplierIncidentsDriverNotCompletedPickup =>
      'لم يُكمل السائق المعيّن الاستلام من المورد بعد انتهاء النافذة. أبلغ عن عدم حضور السائق لمراجعته من المشرف.';

  @override
  String get supplierIncidentsNoDriverBeforeWindow =>
      'لم يقبل أي سائق هذا التوصيل قبل انتهاء نافذة استلام المورد. أبلغ لمراجعته من المشرف.';

  @override
  String get supplierIncidentsNoDriverWaitHint =>
      'لا يوجد سائق بعد. يمكنك الإبلاغ عن عدم توفر سائق بعد 30 دقيقة من انتهاء نافذة الاستلام المجدولة.';

  @override
  String get supplierIncidentsReportNoDriver => 'الإبلاغ عن عدم توفر سائق';

  @override
  String get supplierIncidentsReportDriverNoShow =>
      'الإبلاغ عن عدم حضور السائق';

  @override
  String get supplierDriverHandoverCodeInstructions =>
      'أعطِ هذا الرمز للسائق بعد تسليم المادة.';

  @override
  String get supplierReportedToAdmin => 'أُبلغ للمشرف';

  @override
  String supplierRequestLine(String id, String status) {
    return 'طلب $id · $status';
  }

  @override
  String get actionContinue => 'متابعة';

  @override
  String get checkStatus => 'التحقق من الحالة';

  @override
  String get about => 'نبذة';

  @override
  String get review => 'مراجعة';

  @override
  String get description => 'الوصف';

  @override
  String get document => 'المستند';

  @override
  String get submitted => 'تاريخ الإرسال';

  @override
  String get organization => 'المؤسسة';

  @override
  String get notSelected => 'لم يتم الاختيار';

  @override
  String get becomeSupplierTitle => 'انضم كمورد';

  @override
  String get becomeSupplierSubtitle =>
      'احتفظ بوصولك كمتعلّم وأضف ملف مورد على نفس الحساب.';

  @override
  String get becomeSupplierOpenSupplierPortal => 'فتح بوابة المورد';

  @override
  String becomeSupplierProgressSemantic(int step, int total) {
    return 'تقدّم الانضمام كمورد، الخطوة $step من $total';
  }

  @override
  String get becomeSupplierSupplierTypeRequired => 'نوع المورد مطلوب';

  @override
  String get becomeSupplierSupplierNameRequired => 'اسم المورد مطلوب';

  @override
  String get becomeSupplierCityRequired => 'المدينة مطلوبة';

  @override
  String get becomeSupplierSupplierNameLabel => 'اسم المورد';

  @override
  String get becomeSupplierSupplierNameHint => 'كيف سيراك الآخرون';

  @override
  String get becomeSupplierAboutDescriptionOptional => 'نبذة / وصف (اختياري)';

  @override
  String get becomeSupplierAboutDescriptionHint =>
      'ما أنواع المواد التي تشاركها عادةً؟';

  @override
  String get becomeSupplierLocationHelpText =>
      'تساعد المدينة والمنطقة المتعلّمين على فهم مكان الاستلام المعتاد. يمكن إبقاء تفاصيل الاستلام الدقيقة خاصة حتى يتم قبول الحجز.';

  @override
  String get becomeSupplierPickupLocationNoteOptional =>
      'ملاحظة موقع الاستلام (اختياري)';

  @override
  String get becomeSupplierPickupLocationHint =>
      'قرب بوابة الجامعة، مدخل الورشة، إلخ.';

  @override
  String get becomeSupplierWorkingHoursOptional => 'ساعات العمل (اختياري)';

  @override
  String get becomeSupplierWorkingHoursHint => 'الإثنين–الجمعة 4م–7م';

  @override
  String get becomeSupplierPickupNotesHint =>
      'اتصل قبل الاستلام، أحضر بطاقة الطالب، إلخ.';

  @override
  String get becomeSupplierWorkshopsVerificationNote =>
      'الورش والمصانع والمؤسسات تتطلب مسار تحقق منفصل.';

  @override
  String becomeSupplierReviewPickupLocation(String location) {
    return 'موقع الاستلام: $location';
  }

  @override
  String becomeSupplierReviewWorkingHours(String hours) {
    return 'ساعات العمل: $hours';
  }

  @override
  String becomeSupplierReviewPickupNotes(String notes) {
    return 'ملاحظات الاستلام: $notes';
  }

  @override
  String get becomeSupplierStepSupplierTypeSubtitle =>
      'اختر كيف ستشارك المواد كمورد.';

  @override
  String get becomeSupplierStepProfileSubtitle =>
      'أخبر الآخرين من أنت وما تشاركه عادةً.';

  @override
  String get becomeSupplierStepLocationSubtitle =>
      'حدّد المدينة والمنطقة حيث يحدث الاستلام عادةً.';

  @override
  String get becomeSupplierStepPickupDetailsSubtitle =>
      'أضف ساعات استلام وملاحظات اختيارية للمتعلّمين.';

  @override
  String get becomeSupplierStepVerificationSubtitle =>
      'ارفع إثبات مؤسستك لمراجعة المسؤول.';

  @override
  String get becomeSupplierStepReviewSubtitle =>
      'راجع تفاصيل المورد، ثم افتح بوابة المورد.';

  @override
  String get supplierStudentSupplierDescription =>
      'للطلاب الذين يشاركون قطعاً أو مواد إضافية. لا يلزم مستند تحقق.';

  @override
  String get supplierIndividualSupplierDescription =>
      'للمواد الفائضة الشخصية. لا يلزم مستند تحقق.';

  @override
  String get supplierWorkshopSupplierDescription =>
      'للورش أو المختبرات. يلزم مستند تحقق.';

  @override
  String get supplierFactorySupplierDescription =>
      'للمصانع أو الشركات. يلزم مستند تحقق.';

  @override
  String get supplierEducationalInstitutionSupplierDescription =>
      'للمدارس أو الجامعات أو المراكز. يلزم مستند تحقق.';

  @override
  String get supplierChooseSupplierTypeFallback =>
      'اختر من يملك المواد التي ستشاركها.';

  @override
  String get completeSupplierProfileTitle => 'أكمل ملف المورد';

  @override
  String get completeSupplierProfileSubtitle =>
      'أخبر الآخرين بالمواد التي تشاركها وأين يعمل الاستلام.';

  @override
  String get selectYourSupplierType => 'اختر نوع المورد';

  @override
  String get publicNameRequired => 'الاسم العام مطلوب';

  @override
  String get pickupAreaRequired => 'منطقة الاستلام مطلوبة';

  @override
  String get shortDescriptionOptional => 'وصف قصير (اختياري)';

  @override
  String get pickupAreaLocationLabel => 'منطقة / موقع الاستلام';

  @override
  String get organizationSupplierVerificationNote =>
      'يُعامل موردو المؤسسات كمؤسسات موردين وقد يحتاجون تحققاً قبل إدراج المواد.';

  @override
  String get individualSupplierCanSwitchNote =>
      'يمكن لموردي الطلاب والأفراد العودة إلى وضع المتعلّم بعد الإعداد.';

  @override
  String get completeSupplierProfileFooterNote =>
      'يمكنك البدء كفرد وتحديث تفاصيل المورد لاحقاً.';

  @override
  String get verificationDocument => 'مستند التحقق';

  @override
  String get verificationDocumentRequired => 'مستند التحقق مطلوب';

  @override
  String get verificationFileSizeLimit =>
      'يجب أن يكون الملف 5 ميغابايت أو أصغر';

  @override
  String get verificationAllowedFileTypes =>
      'أنواع الملفات المسموحة: PDF وPNG وJPG وJPEG';

  @override
  String get verificationDocumentHint =>
      'PDF أو PNG أو JPG أو JPEG (بحد أقصى 5 ميغابايت)';

  @override
  String get verificationDocumentUploadHint =>
      'ارفع مستنداً يثبت هوية مؤسستك، مثل رخصة ورشة أو مستند مصنع أو إثبات جامعة/مؤسسة.';

  @override
  String get noFileSelected => 'لم يتم اختيار ملف';

  @override
  String get selectFile => 'اختيار ملف';

  @override
  String get changeFile => 'تغيير الملف';

  @override
  String get registrationDetailsIncomplete =>
      'تفاصيل التسجيل غير مكتملة. يرجى البدء من جديد.';

  @override
  String get switchToLearner => 'التبديل إلى المتعلّم';

  @override
  String get switchToSupplier => 'التبديل إلى المورد';

  @override
  String get becomeLearner => 'كن متعلّماً';

  @override
  String get organizationSupplierStaysInSupplierMode =>
      'حسابات موردي المؤسسات تبقى في وضع المورد.';

  @override
  String get learnerMode => 'وضع المتعلّم';

  @override
  String get supplierMode => 'وضع المورد';

  @override
  String get supplierVerifySubmittedTitle => 'تم إرسال تحقق المورد';

  @override
  String get supplierVerifyLoadStatusFailed => 'تعذّر تحميل حالة التحقق.';

  @override
  String get supplierVerifyPendingSubtitle =>
      'حساب المورد بانتظار موافقة المسؤول. ستتمكن من نشر المواد بعد الموافقة على حسابك.';

  @override
  String get supplierVerifyStillWaitingApproval =>
      'حساب المورد لا يزال بانتظار موافقة المسؤول.';

  @override
  String get supplierVerifyRejectedTitle => 'تم رفض تحقق المورد';

  @override
  String get supplierVerifyChangesRequestedTitle => 'طُلبت تعديلات';

  @override
  String get supplierVerifyStatusTitle => 'حالة تحقق المورد';

  @override
  String get supplierVerifyRejectedBody =>
      'تم رفض تحقق المورد. نشر المواد محظور حتى تتم الموافقة على مؤسستك.';

  @override
  String get supplierVerifyChangesRequestedBody =>
      'طلب مسؤول تعديلات على طلب التحقق. حدّث المستند وأعد الإرسال للمراجعة.';

  @override
  String get supplierVerifyStatusBody =>
      'نشر المواد محظور حتى تتم الموافقة على مؤسستك من قِبل مسؤول.';

  @override
  String get supplierVerifyStatusRefreshed => 'تم تحديث حالة التحقق.';

  @override
  String get supplierVerifySelectDocumentToUpload => 'اختر مستند تحقق للرفع.';

  @override
  String get resubmitVerification => 'إعادة إرسال التحقق';

  @override
  String get chooseVerificationDocument => 'اختيار مستند التحقق';

  @override
  String get supplierProfilePhotoUpdated => 'تم تحديث صورة الملف';

  @override
  String get supplierCoverImageUpdated => 'تم تحديث صورة الغلاف';

  @override
  String get supplierDiscardChangesQuestion => 'تجاهل التغييرات؟';

  @override
  String get supplierUnsavedEditsWillBeLost => 'ستفقد التعديلات غير المحفوظة.';

  @override
  String get supplierKeepEditing => 'متابعة التعديل';

  @override
  String get registerSupplierTypeControlsVerification =>
      'يتحكم هذا في متطلبات التحقق وكيف تُعرَض قوائم المواد على الطالبين.';

  @override
  String get registerSupplierPublicNameHelp =>
      'يظهر الاسم العام في قوائم المواد ورسائل الحجز. استخدم اسم ورشة أو مؤسسة أو اسماً شخصياً يتعرّف عليه الطالبون.';

  @override
  String get registerSupplierDisplayNameOptional => 'اسم عرض المورد (اختياري)';

  @override
  String get registerSupplierUsesFullNameDefault =>
      'يستخدم اسمك الكامل افتراضياً';

  @override
  String get registerSupplierShareMaterialsGoals =>
      'ماذا تريد أن تحقق بمشاركة المواد؟';

  @override
  String get registerSupplierBasicsSubtitle =>
      'اختر ملف المورد الذي يطابق من يملك المواد وكيف يظهر علناً.';

  @override
  String get registerSupplierVerificationSubtitle =>
      'يحتاج موردو المؤسسات مستنداً ليراجع المسؤول الحساب قبل نشر المواد.';

  @override
  String get registerSupplierReviewSupplierSubtitle =>
      'راجع حساب المورد ومنطقة الاستلام قبل إنشائه.';

  @override
  String get registerSupplierReviewBothSubtitle =>
      'راجع تفاصيل المتعلّم والمورد قبل إنشاء الحساب.';

  @override
  String get registerSupplierLocationBothSubtitle =>
      'حدّد منطقة الاستلام العامة للمواد التي تشاركها. تُعالَج تفاصيل توصيل المتعلّم لاحقاً عند الحاجة.';

  @override
  String get registerSupplierLocationSubtitle =>
      'حدّد منطقة الاستلام العامة للمواد التي تشاركها.';

  @override
  String get registerSupplierNoVerificationRequired =>
      'لا يلزم مستند تحقق لهذا النوع من الموردين.';

  @override
  String get registerSupplierNoVerificationBody =>
      'يمكنك مراجعة تفاصيل حسابك ثم إنشاء الحساب دون رفع ملف.';

  @override
  String get registerAccountReadyUploadVerification =>
      'حسابك جاهز. ارفع مستند التحقق للمتابعة.';

  @override
  String get registerSupplierSetupDescription =>
      'ستحدّد أهداف المورد ومنطقة الاستلام ونوع المورد والاسم العام والتحقق عند الحاجة.';

  @override
  String get registerBothSupplierSetupDescription =>
      'ستحدّد اهتمامات المتعلّم ومستوى التعلّم، إضافةً إلى الاستلام وملف المورد.';

  @override
  String get registerSupplierLocationHelperBoth =>
      'هذه منطقة الاستلام العامة للمواد التي تشاركها. لا تكشف عنواناً دقيقاً علناً، وتبقى تفاصيل توصيل المتعلّم منفصلة.';

  @override
  String get registerSupplierLocationHelper =>
      'يحتاج الموردون مدينة ومنطقة ليفهم الطالبون جدوى الاستلام. يمكن إبقاء تفاصيل الاستلام الدقيقة خاصة حتى يتم ترتيب حجز أو توصيل.';

  @override
  String get registerSupplierReviewHelper =>
      'تبقى أهداف المورد في الإعداد فقط. يستقبل الخادم حسابك وملف المورد ومنطقة الاستلام.';

  @override
  String get registerBothReviewHelper =>
      'تبقى الأهداف في الإعداد فقط. يستقبل الخادم حسابك وملف المتعلّم وملف المورد ومنطقة الاستلام.';

  @override
  String get retryVerification => 'إعادة محاولة التحقق';

  @override
  String get conditionNew => 'جديد';

  @override
  String get conditionLikeNew => 'كالجديد';

  @override
  String get conditionGood => 'جيد';

  @override
  String get conditionUsed => 'مستعمل';

  @override
  String get conditionNeedsRepair => 'يحتاج إصلاح';

  @override
  String get sourceTypeStudentLeftover => 'فائض طلابي';

  @override
  String get sourceTypeWorkshopSurplus => 'فائض ورشة';

  @override
  String get sourceTypeFactorySurplus => 'فائض مصنع';

  @override
  String get sourceTypeEducationalInstitution => 'مؤسسة تعليمية';

  @override
  String get materialStatusAvailable => 'متاح';

  @override
  String get materialStatusPendingReservation => 'قيد انتظار الحجز';

  @override
  String get materialStatusReserved => 'محجوز';

  @override
  String get materialStatusReused => 'أُعيد استخدامها';

  @override
  String get materialStatusUnavailable => 'غير متاح';

  @override
  String get supplierApply => 'تطبيق';

  @override
  String get supplierSelectScheduleRange => 'اختر نطاق الجدول';

  @override
  String get supplierActionCouldNotComplete => 'تعذّر تنفيذ الإجراء.';

  @override
  String get supplierHandovers => 'عمليات التسليم';

  @override
  String get supplierSearchScheduleHint =>
      'ابحث بالمادة أو المتعلم أو رقم الحجز...';

  @override
  String get supplierDeliveryPickup => 'استلام للتوصيل';

  @override
  String get supplierNoAttention => 'لا تحتاج انتباهاً';

  @override
  String get supplierScheduleColumnSchedule => 'الجدول';

  @override
  String get supplierScheduleColumnMaterialLearner => 'المادة والمتعلم';

  @override
  String get supplierScheduleColumnFulfillment => 'التنفيذ';

  @override
  String get supplierScheduleColumnWindow => 'النافذة';

  @override
  String get supplierScheduleColumnNextActor => 'الطرف التالي';

  @override
  String get supplierScheduleColumnActions => 'الإجراءات';

  @override
  String get supplierNoConfirmedWindow => 'لا توجد نافذة مؤكدة';

  @override
  String supplierGroupReservationsQuantity(String count, String quantity) {
    return '$count حجوزات · $quantity';
  }

  @override
  String supplierGroupReservationsCount(String count) {
    return '$count حجوزات';
  }

  @override
  String get supplierConfirmed => 'مؤكد';

  @override
  String get supplierSupplierPickup => 'استلام المورد';

  @override
  String get supplierConfirmedPickup => 'استلام مؤكد';

  @override
  String get supplierWaitingForDriver => 'بانتظار السائق';

  @override
  String get supplierDriverAssigned => 'تم تعيين السائق';

  @override
  String get supplierArrivedAtSupplier => 'وصل إلى المورد';

  @override
  String get supplierDriverOnTheWay => 'السائق في الطريق';

  @override
  String get supplierPickedUp => 'تم الاستلام';

  @override
  String get supplierView => 'عرض';

  @override
  String get supplierMoreActions => 'إجراءات إضافية';

  @override
  String supplierShowingHandoversRange(String start, String end, String total) {
    return 'عرض $start–$end من $total تسليمات';
  }

  @override
  String get supplierRowsPerPage => 'صفوف لكل صفحة';

  @override
  String get supplierPickupScheduleLoadFailedTitle =>
      'تعذّر تحميل جدول الاستلام';

  @override
  String get supplierPleaseTryAgain => 'يرجى المحاولة مرة أخرى.';

  @override
  String get supplierNoHandoversMatchFilters =>
      'لا توجد تسليمات تطابق الفلاتر المحددة.';

  @override
  String get supplierNoHandoversToday => 'لا توجد تسليمات مجدولة اليوم.';

  @override
  String get supplierNoHandoversUpcoming => 'لا توجد تسليمات قادمة.';

  @override
  String get supplierNoHandoversOverdue => 'لا توجد تسليمات متأخرة.';

  @override
  String get supplierNoHandoversCompletedPeriod =>
      'لا توجد تسليمات مكتملة في هذه الفترة.';

  @override
  String get supplierNoHandoversClosedPeriod =>
      'لا توجد تسليمات مغلقة في هذه الفترة.';

  @override
  String get supplierNoHandoversScheduled => 'لا توجد تسليمات مجدولة بعد.';

  @override
  String get supplierResetFiltersToSeeMore =>
      'جرّب إعادة ضبط الفلاتر لرؤية المزيد من التسليمات.';

  @override
  String get supplierConfirmedHandoversAppearHere =>
      'ستظهر هنا مواعيد الاستلام الذاتي واستلام السائق المؤكدة.';

  @override
  String get supplierOpenIncomingRequests => 'فتح الطلبات الواردة';

  @override
  String get supplierFiltersTitle => 'الفلاتر';

  @override
  String get supplierFilterOverdue => 'متأخرة';

  @override
  String get supplierUnscheduledAction => 'إجراء يحتاج جدولة';

  @override
  String get supplierNeedsScheduling => 'تحتاج جدولة';

  @override
  String get supplierAwaitingResolution => 'بانتظار الحل';

  @override
  String get supplierPastDue => 'متأخرة';

  @override
  String get supplierScheduled => 'مجدولة';

  @override
  String get supplierHandoverCompleted => 'اكتمل التسليم';

  @override
  String get supplierNeedsReview => 'تحتاج مراجعة';

  @override
  String get supplierExpired => 'منتهية';

  @override
  String get supplierNoShow => 'عدم حضور';

  @override
  String get supplierFulfillmentFailed => 'فشل التنفيذ';

  @override
  String get supplierCancelled => 'ملغاة';

  @override
  String get supplierAdminReview => 'مراجعة الإدارة';

  @override
  String get supplierNextActorYou => 'أنت';

  @override
  String get supplierNextActorLearner => 'المتعلم';

  @override
  String get supplierNextActorDriver => 'السائق';

  @override
  String get supplierCompletePickup => 'إكمال الاستلام';

  @override
  String get supplierReportLearnerNoShow => 'الإبلاغ عن عدم حضور المتعلم';

  @override
  String get supplierCloseReservation => 'إغلاق الحجز';

  @override
  String get supplierMessage => 'رسالة';

  @override
  String get supplierEditCover => 'تعديل الغلاف';

  @override
  String get supplierEditProfilePhoto => 'تعديل صورة ملف المورد';

  @override
  String get supplierEssentialsCompleteTitle => 'اكتملت الأساسيات';

  @override
  String get supplierEditProfileCompletionDetails =>
      'تعديل تفاصيل اكتمال ملف المورد';

  @override
  String supplierProfileCompletionPercent(String percent) {
    return 'اكتمال الملف $percent بالمئة';
  }

  @override
  String supplierMissingFields(String fields) {
    return 'المفقود: $fields';
  }

  @override
  String get supplierBusinessIdentity => 'هوية النشاط';

  @override
  String get supplierWorkingAvailability => 'التوفر للعمل';

  @override
  String get supplierWorkingAvailabilityMissing =>
      'لم تتم إضافة أوقات التوفر للعمل.';

  @override
  String get supplierWorkingHours => 'ساعات العمل';

  @override
  String get supplierPickupLocationAndPrivacy => 'موقع الاستلام والخصوصية';

  @override
  String get supplierCityArea => 'المدينة / المنطقة';

  @override
  String get supplierPickupAddress => 'عنوان الاستلام';

  @override
  String get supplierPickupLocationMap => 'خريطة موقع الاستلام';

  @override
  String get supplierSavedPickupLocation => 'موقع الاستلام المحفوظ الخاص بك.';

  @override
  String get supplierSubmitForReview => 'إرسال للمراجعة';

  @override
  String get supplierResubmit => 'إعادة الإرسال';

  @override
  String get supplierThanksVerificationCommunity =>
      'شكراً لمساعدتك في جعل ImpactLoop موثوقاً وآمناً لمجتمعنا.';

  @override
  String get supplierReviewedDate => 'تاريخ المراجعة';

  @override
  String get supplierSubmittedDate => 'تاريخ الإرسال';

  @override
  String get supplierAwaitingReview => 'بانتظار المراجعة';

  @override
  String get supplierChangesRequired => 'مطلوب تعديلات';

  @override
  String get supplierVerificationNotRequired => 'التحقق غير مطلوب';

  @override
  String get supplierNotVerified => 'غير موثّق';

  @override
  String get supplierVerificationUnavailable => 'التحقق غير متاح';

  @override
  String get supplierProfileVerified => 'تم توثيق الملف';

  @override
  String get supplierProfileAwaitingReview => 'ملفك بانتظار المراجعة.';

  @override
  String get supplierChangesRequiredBeforeApproval =>
      'مطلوب إجراء تعديلات قبل الموافقة.';

  @override
  String get supplierVerificationRejected => 'تم رفض التحقق من ملفك.';

  @override
  String get supplierVerificationNotRequiredMessage => 'التحقق غير مطلوب.';

  @override
  String get supplierProfileNotVerifiedYet => 'ملفك غير موثّق بعد.';

  @override
  String get supplierVerificationStatusUnavailable => 'حالة التحقق غير متاحة.';

  @override
  String get supplierPickupLocationLabel => 'موقع الاستلام';

  @override
  String get supplierPublicAreaApproximateTitle => 'منطقة عامة — موقع تقريبي';

  @override
  String get supplierPublicAreaApproximateExplanation =>
      'يرى المتعلمون المنطقة العامة قبل القبول. تتم مشاركة عنوان الاستلام الدقيق فقط عندما يسمح مسار العمل بذلك.';

  @override
  String get supplierPublicExactLocation => 'موقع عام دقيق';

  @override
  String get supplierPublicExactLocationExplanation =>
      'موقع الاستلام ظاهر للعامة.';

  @override
  String get supplierSharedAfterAcceptanceTitle =>
      'تتم المشاركة بعد قبول الحجز';

  @override
  String get supplierSharedAfterAcceptanceExplanation =>
      'لا يرى المتعلمون عنوان الاستلام الدقيق قبل قبول الحجز.';

  @override
  String get supplierPrivateLocation => 'موقع خاص';

  @override
  String get supplierPrivateLocationExplanation =>
      'لا يظهر موقع الاستلام للعامة.';

  @override
  String get supplierLocationPrivacyUnavailable => 'خصوصية الموقع غير متاحة';

  @override
  String get supplierLocationPrivacyUnavailableExplanation =>
      'تفاصيل الظهور غير متاحة حالياً.';

  @override
  String get supplierDaySun => 'الأحد';

  @override
  String get supplierDayMon => 'الإثنين';

  @override
  String get supplierDayTue => 'الثلاثاء';

  @override
  String get supplierDayWed => 'الأربعاء';

  @override
  String get supplierDayThu => 'الخميس';

  @override
  String get supplierDayFri => 'الجمعة';

  @override
  String get supplierDaySat => 'السبت';

  @override
  String get supplierSummaryClosed => 'مغلقة';

  @override
  String get supplierNotifCategoryMaterialReview => 'مراجعة المواد';

  @override
  String get supplierNotifCategoryDeliveryRecovery => 'معالجة التوصيل';

  @override
  String get supplierNotifCategorySystem => 'النظام';

  @override
  String get supplierNotifStateWaiting => 'بانتظار';

  @override
  String get supplierChooseTime => 'اختر الوقت';

  @override
  String get supplierPublicProfileSection => 'الملف العام';

  @override
  String get supplierOrganizationAvailabilitySection => 'المؤسسة والتوفر';

  @override
  String get supplierOrganizationNameHelp =>
      'اسم المؤسسة يحدد المؤسسة، وقد يطابق اسم المورد العام.';

  @override
  String get supplierAvailabilityInformationalHelp =>
      'التوفر للمعلومات ويساعد المتعلمين على التخطيط للاستلام.';

  @override
  String get supplierSeparateOrganizationAddress => 'عنوان المؤسسة المنفصل';

  @override
  String get supplierVisibilityPublicApproximate =>
      'يرى المتعلمون المنطقة العامة. يُشارك عنوان الاستلام الدقيق بعد قبول الحجز.';

  @override
  String get supplierVisibilityPublicExact =>
      'يمكن للمتعلمين رؤية موقع الاستلام المحفوظ وفق إعدادات الظهور العامة.';

  @override
  String get supplierVisibilityOrderOnly =>
      'يرى المتعلمون عنوان الاستلام الدقيق فقط بعد قبول الحجز.';

  @override
  String get supplierVisibilityPrivate => 'يبقى موقع الاستلام خاصاً.';

  @override
  String get supplierVisibilityUnavailable => 'تفاصيل ظهور الموقع غير متاحة.';

  @override
  String get supplierChooseValidTime => 'اختر وقتاً صالحاً.';

  @override
  String get supplierPickupMapUnavailable => 'خريطة الاستلام غير متاحة';

  @override
  String get supplierAddPickupLocationForMap => 'أضف موقع استلام لعرض الخريطة.';

  @override
  String get supplierCouldNotLoadSupplierProfile => 'تعذّر تحميل ملف المورد';

  @override
  String supplierMaterialRequestsBadge(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count طلبات',
      one: 'طلب واحد',
    );
    return '$_temp0';
  }

  @override
  String supplierMaterialsResultCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count مواد معروضة',
      one: 'مادة واحدة معروضة',
    );
    return '$_temp0';
  }

  @override
  String supplierActiveRequestsLabel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count طلبات نشطة',
      one: '$count طلب نشط',
    );
    return '$_temp0';
  }

  @override
  String supplierDemandCountLabel(int demand, int views) {
    String _temp0 = intl.Intl.pluralLogic(
      demand,
      locale: localeName,
      other: '$demand حجوزات',
      one: '$demand حجز',
    );
    String _temp1 = intl.Intl.pluralLogic(
      views,
      locale: localeName,
      other: '$views مشاهدات',
      one: '$views مشاهدة',
      zero: '$views مشاهدة',
    );
    return '$_temp0 · $_temp1';
  }
}
