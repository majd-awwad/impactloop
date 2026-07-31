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
}
