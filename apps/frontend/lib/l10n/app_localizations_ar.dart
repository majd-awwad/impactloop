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
  String get projectSubmissionCoverImageRequired =>
      'أضف صورة واحدة على الأقل للمشروع قبل إرساله للمراجعة.';

  @override
  String get projectSubmissionRequiredComponentsRequired =>
      'أضف مكوّنًا مطلوبًا واحدًا على الأقل قبل الإرسال.';

  @override
  String get projectSubmissionStepsRequired =>
      'أضف خطوة واحدة على الأقل للمشروع قبل الإرسال.';

  @override
  String get projectSubmissionCategoryRequired =>
      'اختر فئة المشروع قبل الإرسال.';

  @override
  String get projectSubmissionTitleRequired =>
      'أضف عنوانًا للمشروع قبل الإرسال.';

  @override
  String get projectSubmissionShortDescriptionRequired =>
      'أضف وصفًا قصيرًا قبل الإرسال.';

  @override
  String get projectSubmissionDescriptionRequired =>
      'أضف وصفًا كاملاً للمشروع قبل الإرسال.';

  @override
  String get projectSubmissionDifficultyRequired =>
      'اختر مستوى الصعوبة قبل الإرسال.';

  @override
  String get projectSubmissionDurationRequired =>
      'أضف المدة التقديرية للمشروع قبل الإرسال.';

  @override
  String get projectSubmissionDetailsRequired =>
      'أكمل تفاصيل المشروع المطلوبة قبل الإرسال.';

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
  String get reservationRequest => 'طلب حجز المادة';

  @override
  String get reservationRequestSubtitle =>
      'أدخل التفاصيل المطلوبة لإرسال الطلب إلى المورد';

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
  String get filterNeedsAction => 'يتطلب إجراء';

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
  String get statusRedeliveryPending => 'جارٍ ترتيب محاولة توصيل أخرى';

  @override
  String get statusRedeliveryScheduled => 'تمت جدولة إعادة التوصيل';

  @override
  String get statusReturnToSupplierRequired =>
      'تعذّر إكمال التوصيل. تُعاد المادة إلى المورّد وستتم مراجعة الحالة.';

  @override
  String get statusReturnedToSupplier =>
      'أُعيدت المادة إلى المورّد والحالة قيد المراجعة';

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
      'تحديثات الدفع والحجوزات والتوصيل والمشاريع والحساب.';

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
  String get notificationChipReservation => 'حجز';

  @override
  String get notificationChipMaterial => 'مادة';

  @override
  String get notificationChipLearning => 'تعلّم';

  @override
  String get notificationChipMaterialRequest => 'طلب مادة';

  @override
  String get notificationChipAccount => 'الحساب';

  @override
  String get notificationChipUpdate => 'تحديث';

  @override
  String get notificationChipPayment => 'دفع';

  @override
  String get notificationChipRefund => 'استرداد';

  @override
  String get notificationsFilterPayments => 'المدفوعات';

  @override
  String get notificationsFilterDelivery => 'التوصيل';

  @override
  String get notificationsFilterRefunds => 'الاستردادات';

  @override
  String notificationsUnreadCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count غير مقروءة',
      one: 'إشعار واحد غير مقروء',
      zero: 'لا يوجد غير مقروء',
    );
    return '$_temp0';
  }

  @override
  String get notificationPaymentRequiredTitle => 'الدفع مطلوب';

  @override
  String notificationPaymentRequiredBody(String materialTitle) {
    return 'أكمل الدفع مقابل $materialTitle للمتابعة.';
  }

  @override
  String notificationPaymentRequiredBodyWithAmount(
    String amount,
    String materialTitle,
  ) {
    return 'ادفع $amount مقابل $materialTitle للمتابعة.';
  }

  @override
  String get notificationPaymentAcceptedReadyTitle => 'تم قبول طلب الحجز';

  @override
  String notificationPaymentAcceptedReadyBodyMaterialsAndDelivery(
    String amount,
  ) {
    return 'أصبح طلبك جاهزًا للدفع. الإجمالي: $amount شامل المواد والتوصيل.';
  }

  @override
  String notificationPaymentAcceptedReadyBodyMaterialsOnly(String amount) {
    return 'أصبح طلبك جاهزًا للدفع. الإجمالي: $amount شامل المواد.';
  }

  @override
  String notificationPaymentAcceptedReadyBodyDeliveryOnly(String amount) {
    return 'أصبح طلبك جاهزًا للدفع. الإجمالي: $amount شامل التوصيل.';
  }

  @override
  String notificationPaymentAcceptedReadyBodyPickup(
    String amount,
    String materialTitle,
  ) {
    return 'أصبح طلبك جاهزًا للدفع. الإجمالي: $amount مقابل $materialTitle قبل الاستلام. يبقى رمز الاستلام مخفيًا حتى إتمام الدفع.';
  }

  @override
  String get notificationPaymentDeliveryFeeRequiredTitle =>
      'رسوم التوصيل مطلوبة';

  @override
  String notificationPaymentDeliveryFeeRequiredBody(String materialTitle) {
    return 'مطلوب دفع رسوم التوصيل قبل متابعة توصيل $materialTitle.';
  }

  @override
  String notificationPaymentDeliveryFeeRequiredBodyWithAmount(
    String amount,
    String materialTitle,
  ) {
    return 'ادفع رسوم التوصيل بقيمة $amount قبل متابعة توصيل $materialTitle.';
  }

  @override
  String get notificationPaymentCompletedTitle => 'اكتمل الدفع';

  @override
  String notificationPaymentCompletedBody(String materialTitle) {
    return 'تم استلام الدفع مقابل $materialTitle.';
  }

  @override
  String notificationPaymentCompletedBodyWithAmount(
    String amount,
    String materialTitle,
  ) {
    return 'تم استلام دفع بقيمة $amount مقابل $materialTitle.';
  }

  @override
  String get notificationPaymentCompletedMoreRequiredTitle =>
      'تم استلام دفعة — ما زال هناك مبلغ مستحق';

  @override
  String notificationPaymentCompletedMoreRequiredBody(String materialTitle) {
    return 'تم استلام دفعة مقابل $materialTitle، لكن ما زال هناك دفع مطلوب قبل متابعة التنفيذ.';
  }

  @override
  String notificationPaymentCompletedMoreRequiredBodyWithAmount(
    String amount,
    String materialTitle,
  ) {
    return 'تم استلام $amount مقابل $materialTitle، لكن ما زال هناك دفع مطلوب قبل متابعة التنفيذ.';
  }

  @override
  String get notificationPaymentFulfillmentReadyTitle => 'جاهز للتوصيل';

  @override
  String notificationPaymentFulfillmentReadyBody(String materialTitle) {
    return '$materialTitle جاهزة للانتقال إلى التنفيذ.';
  }

  @override
  String get notificationPaymentPickupReadyTitle => 'جاهز للاستلام';

  @override
  String notificationPaymentPickupReadyBody(String materialTitle) {
    return '$materialTitle جاهزة للاستلام. اعرض رمز الاستلام.';
  }

  @override
  String get notificationPaymentRefundRequestedTitle => 'جاري معالجة الاسترداد';

  @override
  String notificationPaymentRefundRequestedBody(String materialTitle) {
    return 'يتم معالجة استرداد لـ $materialTitle.';
  }

  @override
  String notificationPaymentRefundRequestedBodyWithAmount(
    String amount,
    String materialTitle,
  ) {
    return 'يتم معالجة استرداد بقيمة $amount لـ $materialTitle.';
  }

  @override
  String get notificationPaymentRefundedTitle => 'تم الاسترداد';

  @override
  String notificationPaymentRefundedBody(String materialTitle) {
    return 'اكتمل استردادك مقابل $materialTitle.';
  }

  @override
  String notificationPaymentRefundedBodyWithAmount(
    String amount,
    String materialTitle,
  ) {
    return 'اكتمل استردادك بقيمة $amount مقابل $materialTitle.';
  }

  @override
  String get notificationPaymentRefundedNewCycleTitle =>
      'تم الاسترداد — مطلوب دفع جديد';

  @override
  String notificationPaymentRefundedNewCycleBody(String materialTitle) {
    return 'تم استرداد دفعتك السابقة مقابل $materialTitle. مطلوب الآن دفع جديد للمتابعة.';
  }

  @override
  String notificationPaymentRefundedNewCycleBodyWithAmount(
    String amount,
    String materialTitle,
  ) {
    return 'تم استرداد دفعتك السابقة بقيمة $amount مقابل $materialTitle. مطلوب الآن دفع جديد للمتابعة.';
  }

  @override
  String get notificationPaymentRefundFailedTitle => 'الاسترداد يحتاج متابعة';

  @override
  String notificationPaymentRefundFailedBody(String materialTitle) {
    return 'تعذّر إكمال الاسترداد مقابل $materialTitle. راجع تفاصيل الحجز.';
  }

  @override
  String get notificationPaymentLateSuccessRefundTitle => 'استرداد دفعة متأخرة';

  @override
  String notificationPaymentLateSuccessRefundBody(String materialTitle) {
    return 'تم استرداد دفعة متأخرة تلقائيًا مقابل $materialTitle.';
  }

  @override
  String get notificationPaymentNewCycleRequiredTitle =>
      'دورة دفع جديدة مطلوبة';

  @override
  String notificationPaymentNewCycleRequiredBody(String materialTitle) {
    return 'مطلوب دورة دفع جديدة مقابل $materialTitle.';
  }

  @override
  String notificationPaymentNewCycleRequiredBodyWithAmount(
    String amount,
    String materialTitle,
  ) {
    return 'ادفع $amount للدورة الجديدة من $materialTitle.';
  }

  @override
  String get notificationPaymentResolutionRequiredTitle =>
      'مطلوب حل لمشكلة الدفع';

  @override
  String notificationPaymentResolutionRequiredBody(String materialTitle) {
    return 'حجزك لـ $materialTitle يحتاج إلى حل لمشكلة الدفع.';
  }

  @override
  String get notificationPaymentShowPickupCode => 'عرض رمز الاستلام';

  @override
  String get notificationPaymentStatusUnpaid => 'لم يُدفع بعد';

  @override
  String get notificationPaymentStatusPaid => 'مدفوع';

  @override
  String get notificationPaymentStatusRefundProcessing =>
      'جاري معالجة الاسترداد';

  @override
  String get notificationPaymentStatusRefunded => 'تم الاسترداد';

  @override
  String get notificationPaymentStatusRefundFailed => 'فشل الاسترداد';

  @override
  String get notificationPaymentStatusResolutionRequired => 'مطلوب حل';

  @override
  String get notificationPaymentStatusLateRefund => 'تم استرداد دفعة متأخرة';

  @override
  String get notificationPaymentStatusPickupReady => 'جاهز للاستلام';

  @override
  String get notificationPaymentStatusFulfillmentReady => 'جاهز للتنفيذ';

  @override
  String get notificationPaymentNextStepPay =>
      'تابع إلى الدفع لإكمال هذه العملية.';

  @override
  String get notificationPaymentNextStepViewReservation =>
      'افتح تفاصيل الحجز لمراجعة سجل الدفع.';

  @override
  String get notificationPaymentNextStepPickup =>
      'افتح تفاصيل الحجز لعرض رمز الاستلام.';

  @override
  String get notificationPaymentNextStepTrack =>
      'افتح تفاصيل الحجز لمتابعة التنفيذ.';

  @override
  String get notificationPaymentNextStepRefundProcessing =>
      'افتح تفاصيل الحجز لمتابعة الاسترداد.';

  @override
  String get notificationPaymentNextStepRefunded =>
      'افتح تفاصيل الحجز لمراجعة الدفعة المستردة.';

  @override
  String get notificationPaymentNextStepResolution =>
      'افتح تفاصيل الحجز لحل مشكلة الدفع.';

  @override
  String get notificationPaymentNextStepLateRefund =>
      'افتح تفاصيل الحجز لمراجعة الاسترداد التلقائي.';

  @override
  String get notificationPaymentDetailSecondary => 'تفاصيل الحجز';

  @override
  String get notificationPaymentAmountLabel => 'المبلغ';

  @override
  String get notificationsBack => 'رجوع';

  @override
  String get refreshNotifications => 'تحديث الإشعارات';

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
      'تابع جميع حجوزاتك وطلبات الاستلام والتوصيل والدفع من هنا.';

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
  String get reservationsSummaryActive => 'نشطة';

  @override
  String get reservationsSummaryActionRequired => 'يتطلب إجراء';

  @override
  String get reservationsSummaryPaymentsRequired => 'مدفوعات مطلوبة';

  @override
  String get reservationsSummaryDeliveries => 'توصيل جاهز';

  @override
  String get reservationsSummaryTotal => 'إجمالي الحجوزات';

  @override
  String get reservationsSummaryLoadedHint =>
      'الأعداد تعكس الحجوزات المحمّلة حالياً.';

  @override
  String get reservationsTimezoneNote =>
      'جميع التواريخ والأوقات حسب المنطقة الزمنية الخاصة بك.';

  @override
  String get reservationsFilter => 'تصفية';

  @override
  String get viewAllReservations => 'عرض كل الحجوزات';

  @override
  String get reservationMoneyAmountDue => 'المبلغ المطلوب';

  @override
  String get reservationMoneyRemaining => 'المتبقي';

  @override
  String get reservationMoneyPaidInFull => 'تم الدفع بالكامل';

  @override
  String reservationMoneyOrdersRemaining(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count دفعة متبقية',
      many: '$count دفعة متبقية',
      few: '$count دفعات متبقية',
      two: 'دفعتان متبقيتان',
      one: 'دفعة واحدة متبقية',
      zero: 'لا دفعات متبقية',
    );
    return '$_temp0';
  }

  @override
  String get reservationMoneyMaterialPaidDeliveryDue =>
      'تم دفع دفعة المادة. رسوم التوصيل ما زالت مطلوبة.';

  @override
  String get reservationMoneyDeliveryPaidMaterialDue =>
      'تم تسديد رسوم التوصيل. دفعة المادة ما زالت مطلوبة.';

  @override
  String get reservationMoneyBothOutstanding =>
      'تُدفع المادة ورسوم التوصيل معًا في دفعة واحدة.';

  @override
  String get reservationNextStepPayTitle => 'أكمل الدفع لتأكيد الحجز';

  @override
  String get reservationNextStepPaySupporting =>
      'سيظهر رمز الاستلام بعد الدفع وبدء نافذة الاستلام.';

  @override
  String get reservationNextStepPaySupportingDelivery =>
      'يبدأ التوصيل فقط بعد إكمال الدفع المطلوب.';

  @override
  String get reservationNextStepPartialTitle => 'أكمل الدفع المتبقي';

  @override
  String get reservationNextStepPartialSupporting =>
      'تم استلام دفعة، وما زالت رسوم التوصيل مطلوبة.';

  @override
  String get paymentStatusNotRequired => 'الدفع غير مطلوب';

  @override
  String get reservationNextStepPayToConfirm =>
      'ادفع لتأكيد الحجز وإظهار رمز الاستلام.';

  @override
  String get reservationNextStepPayToConfirmDelivery =>
      'ادفع لتأكيد الحجز ومتابعة التوصيل.';

  @override
  String get materialDetailViewReservation => 'عرض الحجز';

  @override
  String get materialDetailViewPickupDetails => 'عرض تفاصيل الاستلام';

  @override
  String get materialDetailViewDeliveryDetails => 'عرض تفاصيل التوصيل';

  @override
  String get materialDetailRequestDeliveryInReservations =>
      'اطلب التوصيل من حجوزاتي';

  @override
  String get materialDetailViewDeliveryStatus => 'عرض حالة التوصيل';

  @override
  String get materialDetailViewReservationRequest => 'عرض طلب الحجز';

  @override
  String get materialDetailViewReservationHistory => 'عرض سجل الحجز';

  @override
  String get materialDetailViewReservationStatus => 'عرض حالة الحجز';

  @override
  String get materialDetailAcceptedPickupReady =>
      'تم قبول الحجز. تفاصيل الاستلام جاهزة.';

  @override
  String get materialDetailAcceptedDeliveryReady =>
      'تم قبول الحجز. افتح تفاصيل الحجز لحالة التوصيل والدفع.';

  @override
  String get materialDetailAcceptedRequestDelivery =>
      'تم قبول الحجز. التوصيل الداخلي متاح من حجوزاتي.';

  @override
  String materialDetailPreviousDeliveryRequestAgain(String status) {
    return 'حالة التوصيل السابقة: $status. اطلب التوصيل من حجوزاتي.';
  }

  @override
  String materialDetailDeliveryStatusLine(String status) {
    return 'حالة التوصيل: $status.';
  }

  @override
  String get materialDetailPaymentRequired =>
      'ما زال الدفع مطلوبًا. افتح الحجز لمتابعة الدفع.';

  @override
  String get materialDetailReservationPending =>
      'تم إرسال طلب الحجز. بانتظار رد المورد.';

  @override
  String get notificationPaymentOpenCheckout => 'فتح الدفع';

  @override
  String get notificationPaymentStatusCheckPayment =>
      'تحقق من حالة الدفع الحالية';

  @override
  String reservationMoneyAmountWithCurrency(String amount) {
    return '$amount ₪';
  }

  @override
  String get reservationDetailsTitle => 'تفاصيل الحجز';

  @override
  String get reservationSummaryTitle => 'ملخص الحجز';

  @override
  String get reservationReference => 'المرجع';

  @override
  String get reservationStatusLabel => 'الحالة';

  @override
  String get reservationLocationLabel => 'الموقع';

  @override
  String get importantNotes => 'ملاحظات مهمة';

  @override
  String get pickupCodeTitle => 'رمز الاستلام';

  @override
  String get pickupCodeLockedPayment => 'أكمل الدفع لفتح رمز الاستلام.';

  @override
  String get pickupCodeWaitingWindow =>
      'سيظهر رمز الاستلام عند بدء نافذة الاستلام.';

  @override
  String get pickupCodeAvailableLabel => 'اعرض هذا الرمز للمورّد عند الاستلام.';

  @override
  String get pickupCodeSafetyNote =>
      'لا تشارك هذا الرمز قبل وصولك إلى موقع الاستلام.';

  @override
  String get pickupCodeClosed => 'رمز الاستلام لم يعد متاحًا لهذا الحجز.';

  @override
  String get pickupCodeProcessing =>
      'سيصبح رمز الاستلام متاحًا بعد تأكيد الدفع.';

  @override
  String get pickupCodeUnderReview =>
      'رمز الاستلام موقوف مؤقتًا أثناء مراجعة الحالة.';

  @override
  String get pickupCodeRefundProcessing =>
      'رمز الاستلام غير متاح أثناء معالجة الاسترداد.';

  @override
  String get pickupCodeRefunded => 'تم استرداد هذا الحجز. لا يلزم رمز استلام.';

  @override
  String get pickupCodeNotApplicable => 'رمز الاستلام لا ينطبق على هذا الحجز.';

  @override
  String get showPickupQr => 'إظهار رمز QR للاستلام';

  @override
  String get pickupQrDialogTitle => 'رمز QR للاستلام';

  @override
  String get pickupQrInstructions =>
      'اعرض رمز QR هذا للمورّد عند استلام المادة.';

  @override
  String pickupQrMaterialLabel(String title) {
    return 'المادة: $title';
  }

  @override
  String pickupQrValidUntil(String expiresAt) {
    return 'صالح حتى $expiresAt';
  }

  @override
  String get pickupQrExpired => 'انتهت صلاحية رمز QR';

  @override
  String get pickupQrGenerateNew => 'إنشاء رمز QR جديد';

  @override
  String get pickupQrIssueFailed => 'تعذر إنشاء رمز QR للاستلام';

  @override
  String get pickupQrManualFallbackNote =>
      'إذا تعذّر المسح، استخدم رمز الاستلام اليدوي في هذه الصفحة.';

  @override
  String get showDeliveryQr => 'إظهار رمز QR للتسليم';

  @override
  String get deliveryQrDialogTitle => 'رمز QR للتسليم';

  @override
  String get deliveryQrInstructions =>
      'اعرض رمز QR هذا للسائق عند استلام المادة.';

  @override
  String deliveryQrValidUntil(String expiresAt) {
    return 'صالح حتى $expiresAt';
  }

  @override
  String get deliveryQrExpired => 'انتهت صلاحية رمز QR';

  @override
  String get deliveryQrGenerateNew => 'إنشاء رمز QR جديد';

  @override
  String get deliveryQrIssueFailed => 'تعذر إنشاء رمز QR للتسليم';

  @override
  String get deliveryQrManualFallbackNote =>
      'إذا تعذّر المسح، استخدم رمز التسليم اليدوي في هذه الصفحة.';

  @override
  String get driverScanDeliveryQr => 'مسح رمز QR للتسليم';

  @override
  String get driverDeliveryQrPointCamera =>
      'وجّه الكاميرا نحو رمز QR للتسليم الخاص بالمتعلّم.';

  @override
  String get driverDeliveryQrVerifying => 'جارٍ التحقق من رمز QR للتسليم…';

  @override
  String get driverDeliveryQrVerifiedTitle => 'تم التحقق من رمز QR';

  @override
  String get driverDeliveryQrLearnerLabel => 'المتعلّم';

  @override
  String get driverDeliveryQrConfirmHandover => 'تأكيد تسليم المادة';

  @override
  String get driverDeliveryQrInvalidPayload =>
      'رمز QR هذا ليس رمز تسليم صالحًا في ImpactLoop.';

  @override
  String get driverDeliveryQrVerifyFailed => 'تعذر التحقق من رمز QR للتسليم.';

  @override
  String get driverDeliveryQrConfirmFailed =>
      'تعذر تأكيد التسليم. حاول مرة أخرى أو استخدم رمز التأكيد.';

  @override
  String get driverDeliveryQrHandoverCompletedBody => 'تم تسليم المادة بنجاح.';

  @override
  String get driverDeliveryQrCredentialUnavailable =>
      'رمز QR للتسليم غير صالح أو لم يعد متاحًا.';

  @override
  String get driverDeliveryQrCameraPermissionRequired =>
      'يلزم السماح باستخدام الكاميرا لمسح رمز التسليم.';

  @override
  String get driverDeliveryQrCameraUnavailable =>
      'الكاميرا غير متاحة على هذا الجهاز.';

  @override
  String get driverScanSupplierPickupQr => 'مسح رمز QR الخاص بالمورّد';

  @override
  String get driverSupplierPickupQrPointCamera =>
      'وجّه الكاميرا نحو رمز QR لاستلام المورّد.';

  @override
  String get driverSupplierPickupQrVerifying =>
      'جارٍ التحقق من رمز QR للاستلام…';

  @override
  String get driverSupplierPickupQrVerifiedTitle =>
      'تم التحقق من رمز QR للاستلام';

  @override
  String get driverSupplierPickupQrInvalidPayload =>
      'رمز QR هذا ليس رمز استلام صالحًا من المورّد في ImpactLoop.';

  @override
  String get driverSupplierPickupQrVerifyFailed =>
      'تعذر التحقق من رمز QR للاستلام.';

  @override
  String get driverSupplierPickupQrConfirmFailed =>
      'تعذر تأكيد الاستلام. حاول مرة أخرى أو استخدم رمز تسليم المورّد.';

  @override
  String get driverSupplierPickupQrHandoverCompletedBody =>
      'تم استلام المادة بنجاح.';

  @override
  String get driverSupplierPickupQrCredentialUnavailable =>
      'رمز QR للاستلام غير صالح أو لم يعد متاحًا.';

  @override
  String get driverSupplierPickupQrCameraPermissionRequired =>
      'يلزم السماح باستخدام الكاميرا لمسح رمز استلام المورّد.';

  @override
  String get driverSupplierPickupQrCameraUnavailable =>
      'الكاميرا غير متاحة على هذا الجهاز.';

  @override
  String get driverSupplierPickupQrScanAgain => 'مسح رمز آخر';

  @override
  String get useSupplierHandoverCodeInstead =>
      'استخدام رمز تسليم المورّد بدلًا من ذلك';

  @override
  String get completeSupplierPickupDialogTitle => 'تأكيد استلام المورّد';

  @override
  String get completeSupplierPickupScanQr => 'مسح رمز QR الخاص بالمورّد';

  @override
  String get completeSupplierPickupManualCode => 'رمز تسليم المورّد';

  @override
  String get confirmPickup => 'تأكيد الاستلام';

  @override
  String get completeDeliveryDialogTitle => 'إكمال التسليم';

  @override
  String get cashToCollect => 'المبلغ المطلوب تحصيله نقدًا';

  @override
  String get cashReceivedConfirmation => 'أؤكد استلام المبلغ نقدًا';

  @override
  String get cashCollectionRequiredError =>
      'أكّد استلام المبلغ النقدي قبل إكمال التسليم.';

  @override
  String get learnerContact => 'بيانات تواصل المتعلّم';

  @override
  String get call => 'اتصال';

  @override
  String get noPhoneAvailable => 'لا يوجد رقم هاتف متاح';

  @override
  String get completeDeliveryScanQr => 'مسح رمز QR للتسليم';

  @override
  String get completeDeliveryManualCode => 'رمز تسليم المتعلّم';

  @override
  String get pickupWindowNotStarted => 'لم تبدأ بعد';

  @override
  String get pickupWindowActiveNow => 'متاحة الآن';

  @override
  String get pickupWindowEnded => 'انتهت';

  @override
  String get openInMaps => 'فتح في الخرائط';

  @override
  String get mapApproximateNote => 'تُظهر الخريطة منطقة استلام تقريبية.';

  @override
  String get followUpMessagesTitle => 'رسائل المتابعة';

  @override
  String get noFollowUpMessagesYet => 'لا توجد رسائل متابعة بعد.';

  @override
  String get writeShortFollowUpMessage => 'أرسل رسالة متابعة قصيرة للمورّد…';

  @override
  String get sendFollowUpMessage => 'إرسال الرسالة';

  @override
  String get followUpMessagesLoadError => 'تعذّر تحميل رسائل المتابعة.';

  @override
  String get showFullHistory => 'عرض السجل الكامل';

  @override
  String get showLessHistory => 'عرض أقل';

  @override
  String get paymentHistoryTitle => 'سجل الدفع';

  @override
  String get currentPaymentCycle => 'دورة الدفع الحالية';

  @override
  String get previousPaymentCycleCancelled => 'تم إلغاء دورة الدفع السابقة.';

  @override
  String get previousPaymentCycleRefunded => 'تم استرداد دورة الدفع السابقة.';

  @override
  String get reservationDetailNotesPickupTitle => 'ملاحظات الاستلام';

  @override
  String get reservationDetailNotesPickupSafety =>
      'أحضر هوية سارية وصل ضمن نافذة الاستلام المؤكدة.';

  @override
  String get reservationDetailNotesPickupContact =>
      'تواصل مع المورّد عبر رسائل المتابعة إذا تأخرت.';

  @override
  String get reservationDetailTimelineCreated => 'تم إنشاء الحجز';

  @override
  String get reservationDetailTimelinePending => 'بانتظار رد المورّد';

  @override
  String get reservationDetailTimelineAwaitingConfirmation => 'يتطلب تأكيدك';

  @override
  String get reservationDetailTimelinePaymentRequired => 'دفع مطلوب';

  @override
  String get reservationDetailTimelinePaymentCompleted => 'تم الدفع';

  @override
  String get reservationDetailTimelineReadyPickup => 'جاهز للاستلام';

  @override
  String get reservationDetailTimelineReadyDelivery => 'جاهز للتوصيل';

  @override
  String get reservationDetailTimelineCompleted => 'اكتمل الحجز';

  @override
  String get reservationDetailTimelineCancelled => 'تم إلغاء الحجز';

  @override
  String get reservationDetailTimelineRefunded => 'تم استرداد الدفع';

  @override
  String get reservationDetailTimelineUnderReview => 'قيد مراجعة الإدارة';

  @override
  String get reservationDetailPaymentTitle => 'الدفع';

  @override
  String get reservationDetailPaymentRequiredTitle => 'الدفع المطلوب';

  @override
  String get reservationDetailMaterialAmount => 'مبلغ المادة';

  @override
  String get reservationDetailDeliveryFeeAmount => 'رسوم التوصيل';

  @override
  String get reservationDetailPickupFeeAmount => 'رسوم الاستلام';

  @override
  String get reservationDetailRemainingAmount => 'المتبقي';

  @override
  String get reservationDetailTotalRequired => 'المبلغ المطلوب';

  @override
  String get contactSupplier => 'تواصل مع المورد';

  @override
  String get viewSupplierProfile => 'عرض ملف المورد';

  @override
  String get reservationDetailFulfillmentTitle => 'التنفيذ';

  @override
  String get reservationDetailQuickActionsTitle => 'إجراءات سريعة';

  @override
  String get reservationDetailOverdueBanner =>
      'فات موعد الاستلام. تواصل مع المورّد أو انتظر المتابعة.';

  @override
  String get allReservations => 'جميع الحجوزات';

  @override
  String get loadingReservation => 'جارٍ تحميل الحجز';

  @override
  String get loadingReservationSubtitle => 'جارٍ التحقق من أحدث حالة للحجز.';

  @override
  String get reservationLoadError => 'تعذّر تحميل الحجز';

  @override
  String get checkoutComingSoon => 'صفحة الدفع ستتوفر قريبًا. طلب الدفع جاهز.';

  @override
  String get checkoutPageTitle => 'إتمام الدفع';

  @override
  String get checkoutPageSubtitle =>
      'أنت على وشك تأكيد هذا الحجز بدفع المبلغ المطلوب بشكل آمن.';

  @override
  String get checkoutBreadcrumbHome => 'الرئيسية';

  @override
  String get checkoutBreadcrumbReservations => 'حجوزاتي';

  @override
  String get checkoutBreadcrumbDetails => 'تفاصيل الحجز';

  @override
  String get checkoutBreadcrumbCheckout => 'الدفع';

  @override
  String get checkoutStepSummary => 'ملخص الدفع';

  @override
  String get checkoutStepMethod => 'طريقة الدفع';

  @override
  String get reservationPaymentCard => 'بطاقة';

  @override
  String get reservationPaymentCash => 'الدفع عند الاستلام';

  @override
  String get reservationPaymentCardBeforeFulfillment =>
      'ادفع إلكترونيًا قبل التنفيذ عند الحاجة.';

  @override
  String get reservationPaymentCashAtHandover =>
      'سيتم تحصيل المبلغ نقدًا عند التسليم.';

  @override
  String get reservationPaymentCashInPerson =>
      'الدفع النقدي يتطلب تسليمًا مباشرًا.';

  @override
  String get reservationPaymentDueAtHandover => 'مستحق عند التسليم';

  @override
  String get reservationOrderSummary => 'ملخص الطلب';

  @override
  String reservationAvailableQuantity(String quantity) {
    return 'المتوفر $quantity';
  }

  @override
  String get reservationDeliveryDetails => 'تفاصيل التوصيل';

  @override
  String get reservationDeliveryAddressLabel => 'العنوان بالتفصيل';

  @override
  String get reservationDeliveryAddressHint =>
      'الشارع، رقم المبنى، المنطقة، أقرب معلم';

  @override
  String get reservationDeliveryAddressRequired =>
      'أدخل عنوان التوصيل بالتفصيل.';

  @override
  String get reservationChooseCityHint => 'اختر المدينة';

  @override
  String get reservationSafeDropoffLabel => 'التوصيل في مكان آمن';

  @override
  String get reservationSafeDropoffHint =>
      'اترك الطلب في مكان آمن إذا لم يكن أحد متاحًا لاستلامه.';

  @override
  String get reservationDeliveryNoteLabel => 'ملاحظة للتوصيل';

  @override
  String get reservationDeliveryNoteHint =>
      'أضف أي ملاحظات أو تعليمات خاصة بالتوصيل.';

  @override
  String get reservationPreferredDeliveryTimeOptional => 'وقت التوصيل المفضل';

  @override
  String get reservationPreferredPickupTimeOptional => 'وقت الاستلام المفضل';

  @override
  String get reservationMessageToSupplierLabel => 'رسالة للمورد';

  @override
  String get reservationMessageToSupplierHint =>
      'اكتب رسالتك أو أسئلتك للمورد هنا…';

  @override
  String get reservationMessageToSupplierPickupHint =>
      'أضف ملاحظات أو أسئلة عن الاستلام…';

  @override
  String get reservationFulfillmentPickupHint => 'استلم من موقع المورّد.';

  @override
  String get reservationFulfillmentDeliveryHint => 'التوصيل إلى عنوانك.';

  @override
  String get reservationPaymentCardFasterHint =>
      'ملاحظة: الدفع بالبطاقة أسرع وأكثر أمانًا.';

  @override
  String get reservationMaterialSubtotalLabel => 'إجمالي المواد';

  @override
  String get reservationUnitPriceLabel => 'سعر الوحدة';

  @override
  String get reservationDeliveryFeeLabel => 'رسوم التوصيل';

  @override
  String get reservationEstimatedTotalLabel => 'الإجمالي التقديري';

  @override
  String get reservationEstimatedTotalPending => 'الإجمالي التقديري قيد الحساب';

  @override
  String get reservationTotalToPayLabel => 'الإجمالي المطلوب';

  @override
  String get reservationCalculatingTotal => 'جارٍ حساب الإجمالي التقديري…';

  @override
  String get reservationChooseFulfillmentHint =>
      'اختر طريقة الاستلام للمتابعة.';

  @override
  String get reservationPickupOnlyHint =>
      'هذه المادة متاحة للاستلام الذاتي فقط.';

  @override
  String get reservationDeliveryOnlyHint => 'هذه المادة متاحة للتوصيل فقط.';

  @override
  String get reservationEnterCityForQuote => 'أدخل المدينة لحساب رسوم التوصيل.';

  @override
  String get reservationQuoteWaitingHint =>
      'سيظهر الإجمالي التقديري بعد إدخال التفاصيل المطلوبة.';

  @override
  String get reservationAddAnotherWindow => 'إضافة وقت آخر';

  @override
  String get preferredWindowDateLabel => 'تاريخ البداية';

  @override
  String get preferredWindowStartTimeLabel => 'وقت البداية';

  @override
  String get preferredWindowEndTimeLabel => 'وقت النهاية';

  @override
  String get preferredWindowChooseDate => 'اختر التاريخ';

  @override
  String get preferredWindowChooseTime => 'اختر الوقت';

  @override
  String preferredWindowNumberLabel(int number) {
    return 'النافذة المفضلة $number';
  }

  @override
  String get preferredWindowRemoveTooltip => 'إزالة النافذة';

  @override
  String get preferredWindowIncompleteError =>
      'اختر التاريخ ووقت البداية ووقت النهاية.';

  @override
  String reservationSubmitTotalLabel(String amount) {
    return 'الإجمالي: $amount';
  }

  @override
  String get reservationSubmitMissingFulfillment =>
      'اختر الاستلام أو التوصيل قبل الحجز.';

  @override
  String get reservationSubmitMissingPayment => 'اختر طريقة الدفع.';

  @override
  String get reservationSubmitMissingQuote =>
      'أكمل التفاصيل المطلوبة لعرض الإجمالي التقديري.';

  @override
  String get reservationSubmitMissingCity => 'أدخل مدينة التوصيل.';

  @override
  String get reservationSubmitMissingAddress => 'أدخل عنوان التوصيل.';

  @override
  String get fieldOptional => 'اختياري';

  @override
  String get fieldRequired => 'مطلوب';

  @override
  String get reservationTrustBadge => 'طلبك آمن ومضمون';

  @override
  String get reservationTrustBadgeDetail =>
      'نحمي بياناتك ولا نشارك معلومات التواصل إلا عند الحاجة التشغيلية.';

  @override
  String get reservationCombineDeliveryGroup => 'الدمج مع توصيل قائم';

  @override
  String get reservationCombineDeliveryGroupHint =>
      'لديك توصيل آخر من هذا المورّد يمكن دمجه. ادفع رسوم توصيل واحدة.';

  @override
  String get reservationCombinedDeliveryFeeNote =>
      'تُحسب رسوم التوصيل المدمج مرة واحدة لهذه المجموعة.';

  @override
  String get checkoutStepConfirm => 'تأكيد الطلب';

  @override
  String get checkoutStepResult => 'النتيجة';

  @override
  String get checkoutReservationInfo => 'معلومات الحجز';

  @override
  String get checkoutOrderIdLabel => 'الحجز';

  @override
  String get checkoutReservationDateLabel => 'التاريخ';

  @override
  String get checkoutReservationStatusLabel => 'الحالة';

  @override
  String get checkoutPickupWindowLabel => 'نافذة الاستلام';

  @override
  String get checkoutViewReservationDetails => 'عرض تفاصيل الحجز';

  @override
  String checkoutQuantityLabel(int count) {
    return '$count وحدة';
  }

  @override
  String get checkoutFulfillmentPickup => 'استلام من المورّد';

  @override
  String get checkoutFulfillmentDelivery => 'توصيل';

  @override
  String get checkoutVerifiedSupplier => 'مورّد موثّق';

  @override
  String get checkoutAmountSummaryTitle => 'ملخص المبلغ';

  @override
  String get checkoutItemPrice => 'سعر المادة';

  @override
  String get checkoutDeliveryFees => 'رسوم التوصيل';

  @override
  String get checkoutTotalRequired => 'الإجمالي المطلوب';

  @override
  String get checkoutPreviouslyPaid => 'المدفوع سابقًا';

  @override
  String get checkoutRemainingAmount => 'المبلغ المتبقي';

  @override
  String get checkoutChooseWhatToPay => 'اختر ما تريد دفعه';

  @override
  String get checkoutCombinedPaymentTitle => 'يشمل الدفع';

  @override
  String get checkoutCombinedPaymentHint =>
      'تُحصَّل المبالغ المتبقية للمادة والتوصيل معًا في جلسة دفع واحدة.';

  @override
  String get checkoutPurposeMaterialTitle => 'سعر المادة';

  @override
  String get checkoutPurposeMaterialHint =>
      'يدفع المبلغ المتبقي للمادة لهذا الحجز.';

  @override
  String get checkoutPurposeDeliveryTitle => 'رسوم التوصيل';

  @override
  String get checkoutPurposeDeliveryHint =>
      'يدفع رسوم التوصيل المتبقية لهذا الحجز.';

  @override
  String get checkoutOtherOrderHint =>
      'أي مبالغ متبقية لهذا الحجز مشمولة في جلسة الدفع هذه.';

  @override
  String get checkoutPaymentIncludesTitle => 'يشمل الدفع';

  @override
  String get checkoutIncludesConfirmReservation => 'تأكيد الحجز';

  @override
  String get checkoutIncludesPickupCode => 'إظهار رمز الاستلام عند الجاهزية';

  @override
  String get checkoutIncludesDeliveryDispatch =>
      'تمكين إرسال التوصيل عند الجاهزية';

  @override
  String get checkoutSecurePaymentTitle => 'دفع آمن';

  @override
  String get checkoutSecurePaymentBody =>
      'جلسة الدفع مشفّرة. لا يخزّن ImpactLoop بيانات البطاقات — يتم الدفع عبر مزوّد الدفع التجريبي الآمن في هذه البيئة.';

  @override
  String get checkoutContinueToPayment => 'متابعة إلى الدفع';

  @override
  String get checkoutReviewOrder => 'مراجعة الطلب';

  @override
  String get checkoutConfirmPayment => 'تأكيد الدفع';

  @override
  String get checkoutMockProviderTitle => 'مزوّد الدفع التجريبي';

  @override
  String get checkoutMockProviderBody =>
      'تستخدم هذه البيئة مزوّد ImpactLoop التجريبي الآمن. إتمام الدفع يحدّث حالة الدفع الموثّقة في الخادم — الضغط على زر وحده لا يعني النجاح.';

  @override
  String get checkoutMockPaySecurely => 'إتمام الدفع التجريبي';

  @override
  String get checkoutMockSimulateDecline => 'محاكاة الرفض';

  @override
  String get checkoutMockCancelAttempt => 'إلغاء هذه المحاولة';

  @override
  String get checkoutReviewTitle => 'مراجعة الطلب';

  @override
  String get checkoutReviewMethodLabel => 'طريقة الدفع';

  @override
  String get checkoutReviewMethodValue => 'مزوّد ImpactLoop التجريبي';

  @override
  String get checkoutReviewAmountLabel => 'المبلغ المطلوب';

  @override
  String get checkoutProcessingTitle => 'جارٍ معالجة الدفع…';

  @override
  String get checkoutProcessingBody =>
      'يرجى عدم إغلاق هذه الصفحة. قد يستغرق الأمر بضع ثوانٍ أثناء التحقق من الدفع مع المزوّد.';

  @override
  String get checkoutSuccessTitle => 'تم الدفع بنجاح!';

  @override
  String get checkoutSuccessBody =>
      'تم تأكيد دفع الحجز. ارجع إلى تفاصيل الحجز للخطوة التالية.';

  @override
  String get checkoutSuccessTransactionLabel => 'جلسة الدفع';

  @override
  String get checkoutBackToReservation => 'العودة إلى تفاصيل الحجز';

  @override
  String get checkoutViewAllReservations => 'عرض جميع حجوزاتي';

  @override
  String get checkoutFailureTitle => 'فشل الدفع';

  @override
  String get checkoutFailureBody =>
      'تعذّر إتمام الدفع. يمكنك إعادة المحاولة بأمان دون إنشاء إرسال مكرر.';

  @override
  String get checkoutRetry => 'إعادة المحاولة';

  @override
  String get checkoutChangeMethod => 'العودة إلى طريقة الدفع';

  @override
  String get checkoutCancelledTitle => 'تم إلغاء الدفع';

  @override
  String get checkoutCancelledBody =>
      'تم إلغاء محاولة الدفع هذه. يمكنك بدء دفع آمن جديد عندما تكون جاهزًا.';

  @override
  String get checkoutExpiredTitle => 'انتهت صلاحية الدفع';

  @override
  String get checkoutExpiredBody =>
      'انتهت صلاحية محاولة الدفع قبل الإتمام. ابدأ دفعًا جديدًا للمتابعة.';

  @override
  String get checkoutAlreadyPaidTitle => 'مدفوع مسبقًا';

  @override
  String get checkoutAlreadyPaidBody =>
      'دفع هذا الحجز مسدّد بالفعل. لا يلزم دفع إضافي.';

  @override
  String get checkoutRefundPendingTitle => 'استرداد قيد المعالجة';

  @override
  String get checkoutRefundPendingBody =>
      'يوجد استرداد قيد المعالجة لدفع هذا الحجز. الدفع غير متاح.';

  @override
  String get checkoutPartiallyRefundedTitle => 'استرداد جزئي';

  @override
  String get checkoutPartiallyRefundedBody =>
      'يوجد استرداد قيد المعالجة أو مكتمل جزئيًا لهذا الحجز. الدفع غير متاح حتى تتضح حالة الدفع.';

  @override
  String get checkoutRefundedTitle => 'تم الاسترداد';

  @override
  String get checkoutRefundedBody =>
      'تم استرداد دفع هذا الحجز. قد يلزم بدء دورة دفع جديدة من تفاصيل الحجز.';

  @override
  String get checkoutOrderCancelledTitle => 'تم إلغاء طلب الدفع';

  @override
  String get checkoutOrderCancelledBody =>
      'تم إلغاء دفع هذا الحجز ولا يمكن إتمام الدفع.';

  @override
  String get checkoutInvariantBlockedTitle => 'الدفع يحتاج مراجعة';

  @override
  String get checkoutInvariantBlockedBody =>
      'الدفع محظور حتى تتم مراجعة حالة دفع هذا الحجز. ارجع إلى تفاصيل الحجز أو تواصل مع الدعم.';

  @override
  String get checkoutLoadErrorTitle => 'تعذّر تحميل صفحة الدفع';

  @override
  String get checkoutLoadErrorBody =>
      'تعذّر تحميل دفع هذا الحجز. تحقق من الاتصال وحاول مرة أخرى.';

  @override
  String get checkoutMissingTitle => 'الدفع غير متاح';

  @override
  String get checkoutMissingBody =>
      'لم يتم العثور على دفع هذا الحجز أو ليس لديك صلاحية الوصول إليه.';

  @override
  String get checkoutRetryLoad => 'حاول مرة أخرى';

  @override
  String get checkoutSubmittingGuard =>
      'الدفع قيد التنفيذ بالفعل. يرجى الانتظار.';

  @override
  String get checkoutableOrderReadyHint => 'يوجد دفع جاهز لهذا الحجز.';

  @override
  String get paymentStatusRequired => 'دفع مطلوب';

  @override
  String get paymentStatusPartial => 'دفعة جزئية';

  @override
  String get paymentStatusProcessing => 'قيد المعالجة';

  @override
  String get paymentStatusPaid => 'مدفوع';

  @override
  String get paymentStatusRefundPending => 'استرداد قيد المعالجة';

  @override
  String get paymentStatusRefunded => 'تم الاسترداد';

  @override
  String get paymentStatusNeedsReview => 'يتطلب مراجعة';

  @override
  String get paymentSummaryUnavailable => 'حالة الدفع غير متاحة';

  @override
  String get paymentSummaryUnavailableHint =>
      'تفاصيل الحجز ما زالت متاحة. اسحب للتحديث أو حاول مرة أخرى.';

  @override
  String get reservationListStatusWaiting => 'قيد الانتظار';

  @override
  String get reservationListStatusNeedsAction => 'يتطلب إجراء';

  @override
  String get reservationListStatusAccepted => 'مقبول';

  @override
  String get reservationListStatusCompleted => 'مكتمل';

  @override
  String get reservationListStatusClosed => 'مغلق';

  @override
  String get reservationListStatusNeedsReview => 'يتطلب مراجعة';

  @override
  String get reservationNextStepDeliveryFeeRemaining =>
      'تم استلام دفعة، وما زالت رسوم التوصيل مطلوبة.';

  @override
  String get reservationNextStepWaitingSupplier => 'بانتظار موافقة المورد.';

  @override
  String get reservationNextStepConfirmProposal => 'راجع اقتراح المورد وأكّده.';

  @override
  String get reservationNextStepPickupCodeWindow =>
      'تم الدفع، وسيصبح رمز الاستلام متاحًا داخل نافذة الاستلام.';

  @override
  String get reservationNextStepPickupCodeReady =>
      'رمز الاستلام جاهز في صفحة تفاصيل الحجز.';

  @override
  String get reservationNextStepFindingDriver => 'جاري البحث عن سائق.';

  @override
  String get reservationNextStepTrackDelivery =>
      'التوصيل قيد التنفيذ. تتبّعه للاطلاع على التحديثات.';

  @override
  String get reservationNextStepRefundProcessing => 'تتم معالجة إعادة المبلغ.';

  @override
  String get reservationNextStepRefunded => 'تم استرداد هذا الدفع.';

  @override
  String get reservationNextStepUnderReview =>
      'الحالة قيد المراجعة، ولا يلزم إجراء منك الآن.';

  @override
  String get reservationNextStepPaymentProcessing => 'جارٍ معالجة الدفع.';

  @override
  String get reservationNextStepPaymentUnavailable =>
      'حالة الدفع غير متاحة مؤقتًا. افتح التفاصيل أو حدّث الصفحة.';

  @override
  String get reservationNextStepReadyPickup =>
      'تم قبول الحجز. افتح التفاصيل لمعلومات الاستلام.';

  @override
  String get reservationNextStepAcceptedDelivery =>
      'تم قبول الحجز. سيتابع التوصيل عند الجاهزية.';

  @override
  String get reservationNextStepDelivered => 'تم تسليم المواد بنجاح.';

  @override
  String get reservationNextStepCompletedPickup => 'تم إكمال الاستلام بنجاح.';

  @override
  String get reservationNextStepClosed => 'هذا الحجز مغلق.';

  @override
  String get reservationNextStepViewDetails =>
      'افتح التفاصيل لعرض الحالة الكاملة.';

  @override
  String get payNow => 'ادفع الآن';

  @override
  String get completePayment => 'أكمل الدفع';

  @override
  String get viewPickupCode => 'عرض رمز الاستلام';

  @override
  String get reservationDateLabel => 'تاريخ الحجز';

  @override
  String get supplierLabel => 'المورد';

  @override
  String get quantityLabelShort => 'الكمية';

  @override
  String get fulfillmentPickup => 'استلام';

  @override
  String get fulfillmentDelivery => 'توصيل';

  @override
  String get skeletonLoadingReservations => 'جارٍ تحميل حجوزاتك';

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
  String get confirmFlexibleDeliveryWindow => 'تأكيد موعد التوصيل';

  @override
  String get flexibleDeliveryNeedsWindowHint =>
      'تركت توقيت التوصيل مفتوحًا. أكّد اقتراح المورّد أو اختر أي نافذة توصيل بعد أقرب وقت أدناه.';

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
  String get reservationFlexibleScheduleReady =>
      'حدّد المورّد موعدًا. أكّد نافذة التوصيل للمتابعة.';

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
  String get becomeSupplierActionDescription =>
      'ابدأ إعداد حساب المورّد الخاص بك.';

  @override
  String get supplierProfileActionDescription =>
      'حدّث ملف المورّد وتفاصيل الاستلام.';

  @override
  String get comingLater => 'قريبًا';

  @override
  String get comingLaterSubtitle =>
      'إحصاءات الأثر مخطط لها لكنها غير متاحة بعد.';

  @override
  String get impactSnapshot => 'ملخص الأثر';

  @override
  String get impactSnapshotSubtitle =>
      'تقدّم إعادة الاستخدام من الاستلامات والمشاريع المكتملة.';

  @override
  String get impactSnapshotDescription =>
      'أكمل استلام المواد ومشاريع التنفيذ لبدء تتبّع أثر إعادة الاستخدام.';

  @override
  String get impactSnapshotCompletedPickups => 'استلامات مكتملة';

  @override
  String get impactSnapshotCompletedBuilds => 'مشاريع مكتملة';

  @override
  String get impactSnapshotActiveReservations => 'حجوزات نشطة';

  @override
  String get impactSnapshotActiveBuilds => 'مشاريع قيد التنفيذ';

  @override
  String impactSnapshotInProgressNote(
    String activeReservations,
    String activeBuilds,
  ) {
    return '$activeReservations حجوزات نشطة و$activeBuilds مشاريع قيد التنفيذ.';
  }

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
  String get deliveryRequestedFree =>
      'تم طلب التوصيل. التوصيل مجاني لهذا الطلب.';

  @override
  String get deliveryFeePaymentRequired =>
      'تم إعداد التوصيل. ادفع رسوم التوصيل لبدء التنفيذ.';

  @override
  String get freeDeliveryLabel => 'توصيل مجاني';

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
  String get savedAddressDefaultBadge => 'الافتراضي';

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
      'السعر والفئة والموقع غير قابلة للتعديل هنا بعد.';

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
      'بالقبول، توافق على تسليم المادة للسائق خلال نافذة الاستلام هذه. سيحدّد السائق المعيّن موعد التوصيل مع المتعلّم لاحقًا.';

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
  String get supplierFlexibleLearnerNeedsDeliveryProposal =>
      'ترك المتعلّم توقيت التوصيل مفتوحًا. اقترح نافذة توصيل للقبول — ستُعتمد تلقائيًا إذا كانت مناسبة بعد الاستلام.';

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
  String get supplierReturnRequiredTitle => 'يجب إعادة المادة';

  @override
  String get supplierReturnRequiredBody =>
      'تعذّر إكمال التوصيل. سيعيد السائق المواد التي استلمها. أكّد الاستلام فقط بعد وصولها.';

  @override
  String get supplierReturnReasonFinalAttempt =>
      'تعذّر إكمال محاولة التوصيل النهائية.';

  @override
  String get supplierReturnReasonRetryExpired =>
      'انتهت مهلة إعادة التوصيل قبل إكمال محاولة أخرى.';

  @override
  String get supplierReturnedItems => 'المواد قيد الإعادة';

  @override
  String get supplierConfirmMaterialReturned => 'تأكيد إعادة المادة';

  @override
  String get supplierConfirmReturnTitle => 'تأكيد الإعادة الفعلية';

  @override
  String get supplierConfirmReturnBody =>
      'أكّد أن السائق أعاد فعليًا جميع المواد المدرجة.';

  @override
  String get supplierReturnConfirmed => 'تم تأكيد إعادة المادة.';

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
  String get supplierHistoryEventAcceptedBySupplier => 'قبل المورد الحجز';

  @override
  String get supplierHistoryEventDeclinedBySupplier => 'رفض المورد الحجز';

  @override
  String get supplierHistoryEventPickupCompletedBySupplier =>
      'أكمل المورد الاستلام';

  @override
  String get supplierHistoryEventSupplierRequestedReschedule =>
      'طلب المورد إعادة جدولة';

  @override
  String get supplierHistoryEventSupplierAcceptedLearnerReschedule =>
      'قبل المورد اقتراح إعادة الجدولة من المتعلم';

  @override
  String get supplierHistoryEventSupplierCancelled => 'ألغى المورد الحجز';

  @override
  String get supplierHistoryEventSupplierCancelledPendingReschedule =>
      'ألغى المورد الحجز بعد طلب إعادة الجدولة';

  @override
  String get supplierHistoryEventReportedAfterMissedPickup =>
      'أُبلغ للمشرف بعد فوات نافذة الاستلام';

  @override
  String get supplierHistoryEventRequestedByLearner => 'طلب المتعلم الحجز';

  @override
  String get supplierHistoryEventCancelledByLearner => 'ألغى المتعلم الحجز';

  @override
  String get supplierHistoryEventCancelledByLearnerAwaitingConfirmation =>
      'ألغى المتعلم الحجز أثناء انتظار التأكيد';

  @override
  String get supplierHistoryEventLearnerAcceptedSupplierPickupWindow =>
      'قبل المتعلم نافذة الاستلام المقترحة من المورد';

  @override
  String get supplierHistoryEventLearnerConfirmedDeliveryWindow =>
      'أكد المتعلم نافذة التوصيل المناسبة';

  @override
  String get supplierHistoryEventLearnerRequestedReschedule =>
      'طلب المتعلم إعادة جدولة';

  @override
  String get supplierHistoryEventLearnerCancelledAfterReschedule =>
      'ألغى المتعلم الحجز بعد طلب إعادة الجدولة';

  @override
  String get supplierHistoryEventLearnerNoShowAfterPickup =>
      'لم يحضر المتعلم بعد نافذة الاستلام';

  @override
  String get supplierHistoryEventLearnerReportedSupplierIssue =>
      'أبلغ المتعلم عن مشكلة مع المورد بعد نافذة الاستلام';

  @override
  String get supplierHistoryEventPendingExpiredAfterPreferredWindow =>
      'انتهت صلاحية الحجز بعد مرور آخر نافذة جدولة مفضلة دون رد من المورد';

  @override
  String get supplierHistoryEventPendingExpiredAfterTimeout =>
      'انتهت صلاحية الحجز بعد انتهاء المهلة دون رد من المورد';

  @override
  String get supplierHistoryEventMissedPickupAutoExpired =>
      'انتهت صلاحية الحجز تلقائيًا بعد فوات نافذة الاستلام';

  @override
  String get supplierHistoryEventNoDriverAvailable => 'لا يوجد سائق متاح';

  @override
  String get supplierHistoryEventNoDriverAutoEscalated =>
      'تصعيد تلقائي لعدم توفر سائق';

  @override
  String get supplierHistoryEventAssignedDriverPickupAutoEscalated =>
      'تصعيد تلقائي لتأخر سائق معيّن عند الاستلام';

  @override
  String get supplierHistoryEventDeliveryPickupWindowExpired =>
      'انتهت نافذة استلام التوصيل';

  @override
  String get supplierHistoryEventDriverNoShowAtSupplier =>
      'لم يحضر السائق لاستلام المورد';

  @override
  String get supplierHistoryEventDriverNoShowReportedBySupplier =>
      'أبلغ المورد عن عدم حضور السائق';

  @override
  String get supplierHistoryEventSupplierMarkedPickupExpired =>
      'علّم المورد نافذة الاستلام منتهية';

  @override
  String get supplierHistoryEventSupplierPickupWindowExpiredNoDriver =>
      'انتهت نافذة استلام المورد دون تعيين سائق';

  @override
  String get supplierHistoryEventDeliveryCompletedByDriver =>
      'أكمل السائق التوصيل';

  @override
  String get supplierHistoryEventGroupedDeliveryCompletedByDriver =>
      'أكمل السائق التوصيل المجمّع';

  @override
  String get supplierHistoryEventSupplierSubmittedPickupWindowNoDriver =>
      'قدّم المورد نافذة استلام جديدة بعد عدم توفر سائق';

  @override
  String get supplierHistoryEventSupplierSubmittedReplacementPickupWindow =>
      'قدّم المورد نافذة استلام بديلة بعد استلام جزئي';

  @override
  String get supplierHistoryEventSupplierSubmittedPickupWindowAdminRecovery =>
      'قدّم المورد نافذة استلام جديدة بعد استرداد إداري';

  @override
  String get supplierHistoryEventAdminRequestedNewPickupWindowNoDriver =>
      'طلب المشرف من المورد اختيار نافذة استلام جديدة بعد عدم توفر سائق';

  @override
  String
  get supplierHistoryEventAdminRequestedNewPickupWindowPickupIncomplete =>
      'طلب المشرف من المورد اختيار نافذة استلام جديدة بعد عدم اكتمال الاستلام';

  @override
  String get supplierHistoryEventAdminCancelledNoDriver =>
      'ألغى المشرف الحجز وأفرج عن الحجز بعد عدم توفر سائق';

  @override
  String get supplierHistoryEventAdminCancelledPickupIncomplete =>
      'ألغى المشرف الحجز وأفرج عن الحجز بعد عدم اكتمال الاستلام';

  @override
  String get supplierHistoryEventFulfillmentIssueReported =>
      'أُبلغ عن مشكلة في التنفيذ';

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
  String get supplierPickupVerificationIntro =>
      'تحقق من الاستلام عبر رمز QR الخاص بالمتعلم أو رمز التأكيد.';

  @override
  String get supplierPickupVerificationOr => 'أو';

  @override
  String get supplierScanPickupQr => 'مسح رمز QR للاستلام';

  @override
  String get supplierPickupQrPointCamera =>
      'وجّه الكاميرا نحو رمز QR للاستلام.';

  @override
  String get supplierPickupQrVerifying => 'جارٍ التحقق من رمز QR للاستلام…';

  @override
  String get supplierPickupQrVerifiedTitle => 'تم التحقق من رمز QR';

  @override
  String get supplierPickupQrLearnerLabel => 'المتعلم';

  @override
  String get supplierPickupQrQuantityLabel => 'الكمية';

  @override
  String get supplierPickupQrConfirmHandover => 'تأكيد تسليم المادة';

  @override
  String get supplierPickupQrInvalidPayload =>
      'رمز QR هذا ليس رمز استلام صالحًا في ImpactLoop.';

  @override
  String get supplierPickupQrCredentialUnavailable =>
      'رمز QR للاستلام غير صالح أو لم يعد متاحًا.';

  @override
  String get supplierPickupQrVerifyFailed => 'تعذر التحقق من رمز QR للاستلام.';

  @override
  String get supplierPickupQrConfirmFailed =>
      'تعذر تأكيد التسليم. حاول مرة أخرى أو استخدم رمز التأكيد.';

  @override
  String get supplierPickupQrCameraPermissionRequired =>
      'يلزم السماح باستخدام الكاميرا لمسح رمز الاستلام.';

  @override
  String get supplierPickupQrCameraUnavailable =>
      'الكاميرا غير متاحة على هذا الجهاز.';

  @override
  String get supplierPickupQrScanAgain => 'مسح رمز آخر';

  @override
  String get supplierPickupQrUseCodeInstead =>
      'استخدام رمز التأكيد بدلًا من ذلك';

  @override
  String get supplierPickupQrTryAgain => 'إعادة المحاولة';

  @override
  String get supplierPickupQrHandoverCompletedTitle => 'تم التسليم بنجاح';

  @override
  String get supplierPickupQrHandoverCompletedBody => 'تم تسليم المادة بنجاح.';

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
  String get driverPickupVerification => 'التحقق من استلام السائق';

  @override
  String get driverPickupVerificationBody => 'وصل السائق لاستلام هذه المادة.';

  @override
  String get supplierDriverPickupQrDialogTitle => 'رمز QR لاستلام السائق';

  @override
  String get supplierDriverPickupQrInstructions =>
      'اعرض رمز QR هذا للسائق عند استلام المادة.';

  @override
  String supplierDriverPickupQrValidUntil(String expiresAt) {
    return 'صالح حتى $expiresAt';
  }

  @override
  String get supplierDriverPickupQrExpired => 'انتهت صلاحية رمز QR';

  @override
  String get supplierDriverPickupQrGenerateNew => 'إنشاء رمز QR جديد';

  @override
  String get supplierDriverPickupQrIssueFailed => 'تعذر إنشاء رمز QR للاستلام';

  @override
  String get supplierDriverPickupQrManualFallbackNote =>
      'إذا تعذّر المسح، استخدم رمز تسليم المورّد أعلاه.';

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
  String get becomeSupplierTitle => 'كن مورّدًا';

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
  String get driverMode => 'وضع السائق';

  @override
  String get adminMode => 'وضع المسؤول';

  @override
  String get moderatorMode => 'وضع المشرف';

  @override
  String get supplierDashboard => 'لوحة المورد';

  @override
  String get adminPortalNav => 'بوابة الإدارة';

  @override
  String get materialRequestsNav => 'طلبات المواد';

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

  @override
  String get driverPortal => 'بوابة السائق';

  @override
  String get driverInternalDelivery => 'توصيل داخلي';

  @override
  String get driverJobs => 'المهام';

  @override
  String get driverJobsTitle => 'مهام السائق';

  @override
  String get driverJobsSubtitle =>
      'استلم المواد من المورّدين وسلّمها إلى المتعلّمين.';

  @override
  String driverActiveDeliveriesCount(int active, int max) {
    return 'التوصيلات النشطة: $active/$max';
  }

  @override
  String driverAvailableJobsCount(int count) {
    return 'المهام المتاحة: $count';
  }

  @override
  String get driverAvailableJobsCountLoading => 'المهام المتاحة: …';

  @override
  String driverTotalAvailable(int count) {
    return 'الإجمالي المتاح: $count';
  }

  @override
  String driverAreaChip(String area) {
    return 'المنطقة: $area';
  }

  @override
  String get driverCouldNotLoadActive => 'تعذّر تحميل التوصيلات النشطة';

  @override
  String get driverRefreshBeforeAccept => 'حدّث الصفحة قبل قبول مهمة جديدة.';

  @override
  String get driverMyActiveDeliveries => 'توصيلاتي النشطة';

  @override
  String get driverLoadingActive => 'جارٍ تحميل التوصيلات النشطة…';

  @override
  String get driverNoActiveDeliveries => 'لا توجد توصيلات نشطة بعد.';

  @override
  String get driverNoActiveDeliveriesHint =>
      'يمكنك قبول المهام المتاحة عندما تكون جاهزًا.';

  @override
  String get driverAvailableNearbyJobs => 'المهام المتاحة القريبة';

  @override
  String get driverActiveLimitReached => 'وصلت إلى حد التوصيلات النشطة.';

  @override
  String get driverActiveLimitHint => 'أكمل توصيلًا واحدًا قبل قبول آخر.';

  @override
  String get driverCompleteOneFirst => 'أكمل توصيلًا واحدًا قبل قبول آخر.';

  @override
  String get driverLoadingAvailable => 'جارٍ تحميل المهام المتاحة…';

  @override
  String get driverLookingForWaiting =>
      'جارٍ البحث عن طلبات توصيل بانتظار السائق.';

  @override
  String get driverCouldNotLoadAvailable => 'تعذّر تحميل المهام المتاحة.';

  @override
  String get driverOpenDelivery => 'فتح التوصيل';

  @override
  String get driverFindNearbyJobs => 'البحث عن مهام قريبة';

  @override
  String get driverDistanceToPickupHint => 'تُحسب المسافة إلى موقع الاستلام.';

  @override
  String get driverAnyDistance => 'أي مسافة';

  @override
  String driverWithinKm(int km) {
    return 'ضمن $km كم';
  }

  @override
  String get driverNearest => 'الأقرب';

  @override
  String get driverNewest => 'الأحدث';

  @override
  String get driverDone => 'تم';

  @override
  String get driverCityLabel => 'المدينة:';

  @override
  String get driverAllCities => 'كل المدن';

  @override
  String get driverAreaLabel => 'المنطقة:';

  @override
  String get driverAllAreas => 'كل المناطق';

  @override
  String get driverResetFilters => 'إعادة تعيين الفلاتر';

  @override
  String get driverLocationNeeded => 'الموقع مطلوب لفلتر المسافة.';

  @override
  String get driverLocationLabel => 'الموقع';

  @override
  String get driverSort => 'الترتيب';

  @override
  String get driverAcceptJob => 'قبول المهمة';

  @override
  String get driverAccepting => 'جارٍ القبول…';

  @override
  String get driverActiveLimitReachedButton => 'تم بلوغ حد التوصيلات النشطة';

  @override
  String get driverDeliveryAccepted => 'تم قبول التوصيل.';

  @override
  String get driverDeliveryNoLongerAvailable => 'لم يعد هذا التوصيل متاحًا.';

  @override
  String get driverReachedActiveLimit => 'لقد وصلت إلى حد التوصيلات النشطة.';

  @override
  String get driverDistanceToPickup => 'المسافة إلى الاستلام';

  @override
  String get driverPickupLabel => 'الاستلام';

  @override
  String get driverIncreaseRadius => 'توسيع نطاق البحث';

  @override
  String get driverShowAnyDistance => 'عرض أي مسافة';

  @override
  String get driverLoadingLocation => 'جارٍ تحميل الموقع…';

  @override
  String get driverUsingCurrentLocation => 'باستخدام موقعك الحالي';

  @override
  String driverUsingProfileArea(String location) {
    return 'باستخدام منطقة الملف الشخصي: $location';
  }

  @override
  String get driverLocationUnavailable =>
      'الموقع غير متاح — عرض كل المهام المتاحة';

  @override
  String get driverSearchRadiusAny => 'نطاق البحث: أي مسافة';

  @override
  String driverSearchRadiusWithin(int km) {
    return 'نطاق البحث: ضمن $km كم';
  }

  @override
  String get driverPickupDistanceUnavailable => 'مسافة الاستلام غير متاحة';

  @override
  String driverKmToPickup(String distance) {
    return '$distance كم إلى الاستلام';
  }

  @override
  String driverNoJobsWithinRadius(String radius) {
    return 'لا توجد مهام ضمن $radius كم.';
  }

  @override
  String driverJobsAvailableOutsideRadius(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count مهمة',
      many: '$count مهمة',
      few: '$count مهام',
      two: 'مهمتان',
      one: 'مهمة واحدة',
      zero: 'لا توجد مهام',
    );
    return '$_temp0 متاحة خارج نطاقك الحالي. جرّب توسيع النطاق أو اختيار أي مسافة.';
  }

  @override
  String get driverTryIncreaseRadius => 'جرّب توسيع النطاق أو اختيار أي مسافة.';

  @override
  String get driverNoJobsInArea => 'لم تُعثر على مهام في هذه المنطقة.';

  @override
  String driverJobsAvailableBroaderFilters(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count مهمة',
      many: '$count مهمة',
      few: '$count مهام',
      two: 'مهمتان',
      one: 'مهمة واحدة',
      zero: 'لا توجد مهام',
    );
    return '$_temp0 متاحة بفلاتر أوسع. جرّب كل المناطق أو إعادة تعيين الفلاتر.';
  }

  @override
  String get driverTryAllAreasOrReset =>
      'جرّب كل المناطق أو إعادة تعيين الفلاتر.';

  @override
  String get driverNoJobsNearby => 'لا توجد مهام متاحة قريبة منك الآن.';

  @override
  String get driverTryChangeFilters =>
      'جرّب تغيير فلتر المدينة أو المنطقة أو المسافة.';

  @override
  String get driverCheckingActiveDelivery =>
      'جارٍ التحقق من التوصيل المعيّن النشط.';

  @override
  String get driverCouldNotLoadDetails => 'تعذّر تحميل تفاصيل التوصيل.';

  @override
  String get driverMovedToAdminReview => 'نُقل التوصيل إلى مراجعة الإدارة';

  @override
  String get driverNoLongerActive => 'التوصيل لم يعد نشطًا';

  @override
  String get driverNoLongerActiveDefault =>
      'لم يعد هذا التوصيل نشطًا. نُقل إلى مراجعة الإدارة.';

  @override
  String get driverBackToJobs => 'العودة إلى المهام';

  @override
  String get driverNotAssigned => 'التوصيل غير نشط أو غير معيّن لك';

  @override
  String get driverOpenJobsBoard =>
      'افتح لوحة المهام لعرض التوصيل المعيّن الحالي.';

  @override
  String get driverActiveDelivery => 'توصيل نشط';

  @override
  String get driverLearnerUnavailable => 'المتعلّم غير متاح';

  @override
  String get driverDeliveryWindow => 'موعد التوصيل';

  @override
  String get driverLearnerPreferredDeliveryTimes =>
      'وقت التوصيل المفضّل للمتعلّم';

  @override
  String get driverNoPreferredDeliveryTime =>
      'لم يحدّد المتعلّم وقتًا مفضّلًا للتوصيل.';

  @override
  String get supplierNoPreferredDeliveryTime =>
      'لم يحدّد المتعلّم وقتًا مفضّلًا للتوصيل.';

  @override
  String get driverSetDeliveryWindow => 'تحديد موعد التوصيل';

  @override
  String get driverScheduleRedelivery => 'جدولة إعادة التوصيل';

  @override
  String get driverStartRedelivery => 'بدء إعادة التوصيل';

  @override
  String get driverCouldntDeliver => 'تعذّر التوصيل';

  @override
  String get driverMaterialRemainsInCustody =>
      'تبقى المادة في عهدتك حتى المحاولة التالية.';

  @override
  String get driverRetryDeadline => 'الموعد النهائي لإعادة المحاولة';

  @override
  String get driverFirstAttemptSummary => 'المحاولة الأولى المتعذّرة';

  @override
  String get driverContactAttempted => 'حاولت التواصل مع المتعلّم';

  @override
  String get driverScheduleRetryNow => 'جدولة إعادة المحاولة الآن';

  @override
  String get driverSelectWindowStart => 'اختيار بداية الموعد';

  @override
  String get driverSelectWindowEnd => 'اختيار نهاية الموعد';

  @override
  String get driverInvalidWindow =>
      'اختر موعدًا صالحًا تكون نهايته بعد بدايته.';

  @override
  String get driverWindowSaved => 'تم حفظ موعد التوصيل.';

  @override
  String get driverLearnerNote => 'ملاحظة المتعلّم';

  @override
  String get driverNoNextAction => 'لا يوجد إجراء تالٍ';

  @override
  String get driverCannotAdvance =>
      'لا يمكن تقدّم هذا التوصيل من حالته الحالية.';

  @override
  String get driverCannotAdvanceFurther => 'لا يمكن تقدّم هذا التوصيل أكثر.';

  @override
  String get driverTimingNote => 'ملاحظة التوقيت';

  @override
  String get driverOptionalNote => 'ملاحظة اختيارية للسائق';

  @override
  String get driverOptionalNoteHint => 'أضف ملاحظة قصيرة لتحديث الحالة';

  @override
  String get driverUpdating => 'جارٍ التحديث...';

  @override
  String get driverReportPickupFailed => 'الإبلاغ عن فشل الاستلام';

  @override
  String get driverReportDeliveryFailed => 'الإبلاغ عن فشل التوصيل';

  @override
  String get driverReportDriverIssue => 'الإبلاغ عن تعذّري عن الاستمرار';

  @override
  String get driverSupplierHandoverCode => 'رمز تسليم المورّد';

  @override
  String get driverSupplierHandoverCodeMessage =>
      'أدخل الرمز الذي يعطيك إياه المورّد بعد تسليم المادة.';

  @override
  String get driverMarkPickedUp => 'تأكيد الاستلام';

  @override
  String get driverLearnerDeliveryCode => 'رمز تسليم المتعلّم';

  @override
  String get driverLearnerDeliveryCodeMessage =>
      'أدخل الرمز الذي يعطيك إياه المتعلّم عند استلام المادة.';

  @override
  String get driverMarkDelivered => 'تأكيد التسليم';

  @override
  String get driverDeliveryMarkedDelivered => 'تم تأكيد التسليم.';

  @override
  String get driverStatusUpdated => 'تم تحديث حالة التوصيل.';

  @override
  String get driverStatusArrivedPickupSuccess => 'تم الوصول إلى موقع الاستلام.';

  @override
  String get driverStatusPickedUpSuccess => 'تم تأكيد الاستلام.';

  @override
  String get driverStatusOnTheWaySuccess => 'أنت في الطريق إلى المتعلّم.';

  @override
  String get driverStatusArrivedDropoffSuccess => 'تم الوصول إلى موقع التسليم.';

  @override
  String get driverStatusRedeliveryPending => 'إعادة التوصيل قيد الترتيب';

  @override
  String get driverStatusRedeliveryScheduled => 'تمت جدولة إعادة التوصيل';

  @override
  String get driverStatusReturnToSupplierRequired => 'إعادة إلى المورّد';

  @override
  String get driverStatusReturnedToSupplier => 'أُعيدت إلى المورّد';

  @override
  String get driverReturnToSupplierTitle => 'إعادة إلى المورّد';

  @override
  String get driverReturnToSupplierBody =>
      'أعِد جميع المواد التي بحوزتك إلى المورّد. تبقى المواد في عهدتك حتى يؤكد المورّد استلامها.';

  @override
  String get driverReturnReasonFinalAttempt =>
      'تعذّر إكمال محاولة التوصيل النهائية.';

  @override
  String get driverReturnReasonRetryExpired => 'انتهت مهلة إعادة التوصيل.';

  @override
  String get driverWaitingSupplierConfirmation =>
      'بانتظار تأكيد المورّد للاستلام';

  @override
  String get driverStatusChangedRefresh =>
      'تغيّرت حالة التوصيل. حدّث الصفحة وجرّب الإجراء التالي الصالح.';

  @override
  String get driverInvalidConfirmationCode =>
      'رمز التأكيد غير صحيح. تحقّق من الرمز وحاول مرة أخرى.';

  @override
  String get driverHandoverWindowNotStarted => 'لم تبدأ نافذة التسليم بعد.';

  @override
  String get driverHandoverWindowExpired => 'انتهت نافذة التسليم بالفعل.';

  @override
  String get driverPartialPickupSelectionInvalid =>
      'عناصر الاستلام المحددة غير صالحة. حدّث الصفحة وحاول مرة أخرى.';

  @override
  String get driverGroupedDeliverySplitConflict =>
      'تغيّر هذا التوصيل المجمّع. حدّث الصفحة وحاول مرة أخرى.';

  @override
  String get driverAvailableJobsCursorInvalid =>
      'ترقيم قائمة المهام غير محدّث. حدّث المهام المتاحة.';

  @override
  String get driverPartialPickupTitle => 'تأكيد ما تم استلامه';

  @override
  String get driverPartialPickupBody => 'حدّد كل عنصر حجز سلّمه المورّد الآن.';

  @override
  String get driverPartialPickupPickedSection => 'سيُسلَّم الآن';

  @override
  String get driverPartialPickupPendingSection => 'سيبقى معلّقًا';

  @override
  String get driverPartialPickupReasonRequired => 'اختر سببًا لكل عنصر معلّق.';

  @override
  String driverPartialPickupSummary(int pickedCount, int pendingCount) {
    String _temp0 = intl.Intl.pluralLogic(
      pickedCount,
      locale: localeName,
      other: 'سيُسلَّم $pickedCount عنصر الآن.',
      many: 'سيُسلَّم $pickedCount عنصرًا الآن.',
      few: 'سيُسلَّم $pickedCount عناصر الآن.',
      two: 'سيُسلَّم عنصران الآن.',
      one: 'سيُسلَّم عنصر واحد الآن.',
      zero: 'لن يُسلَّم أي عنصر الآن.',
    );
    String _temp1 = intl.Intl.pluralLogic(
      pendingCount,
      locale: localeName,
      other: 'سيبقى $pendingCount عنصر معلّق.',
      many: 'ستبقى $pendingCount عنصرًا معلّقًا.',
      few: 'ستبقى $pendingCount عناصر معلّقة.',
      two: 'سيبقى عنصران معلّقان.',
      one: 'سيبقى عنصر واحد معلّق.',
      zero: 'لن يبقى أي عنصر معلّق.',
    );
    return '$_temp0 $_temp1';
  }

  @override
  String get driverPartialPickupContinue => 'المتابعة إلى رمز التأكيد';

  @override
  String get driverPartialPickupReasonMaterialNotReady => 'المادة غير جاهزة';

  @override
  String get driverPartialPickupReasonMaterialMissing => 'المادة مفقودة';

  @override
  String get driverPartialPickupReasonWrongItem => 'عنصر خاطئ';

  @override
  String get driverPartialPickupReasonQuantityMismatch => 'عدم تطابق الكمية';

  @override
  String get driverPartialPickupReasonDamagedItem => 'عنصر تالف';

  @override
  String get driverPartialPickupReasonSupplierRefused => 'المورّد رفض التسليم';

  @override
  String get driverPartialPickupReasonOther => 'أخرى';

  @override
  String get driverPickupFailureReported => 'تم الإبلاغ عن فشل الاستلام.';

  @override
  String get driverDeliveryFailureReported => 'تم الإبلاغ عن فشل التوصيل.';

  @override
  String get driverNoteRequired => 'ملاحظة (مطلوبة)';

  @override
  String get driverIssueNoteHint => 'صف سبب عدم قدرتك على إكمال التوصيل';

  @override
  String get driverSubmitReport => 'إرسال البلاغ';

  @override
  String get driverReason => 'السبب';

  @override
  String get driverIssueReported => 'تم الإبلاغ عن مشكلة السائق.';

  @override
  String get driverLocationSharing => 'مشاركة الموقع';

  @override
  String get driverLocationSharingBody =>
      'شارك موقعك أثناء نشاط هذا التوصيل. يمكن للمتعلّم تتبّعك فقط بعد استلام المادة.';

  @override
  String get driverShareAutomatically => 'المشاركة تلقائيًا';

  @override
  String get driverSharingEvery45Seconds =>
      'مشاركة كل 45 ثانية طالما هذه الصفحة مفتوحة.';

  @override
  String get driverLocationSharingPaused => 'مشاركة الموقع متوقفة';

  @override
  String get driverSending => 'جارٍ الإرسال...';

  @override
  String get driverSendMyLocation => 'إرسال موقعي';

  @override
  String get driverLocationUpdateSent => 'تم إرسال تحديث الموقع.';

  @override
  String driverLastShared(String dateTime) {
    return 'آخر مشاركة: $dateTime';
  }

  @override
  String driverCurrentStage(String status) {
    return 'المرحلة الحالية: $status';
  }

  @override
  String get driverNoFurtherSteps => 'لا مزيد من الخطوات لهذا التوصيل.';

  @override
  String driverAdvanceTo(String action) {
    return 'التقدّم إلى: $action';
  }

  @override
  String driverNextAction(String action) {
    return 'التالي: $action';
  }

  @override
  String get driverSupplierCodeRequired =>
      'رمز تسليم المورّد مطلوب عند تأكيد الاستلام.';

  @override
  String get driverLearnerCodeRequired =>
      'رمز تسليم المتعلّم مطلوب عند تأكيد التسليم.';

  @override
  String get driverCompleteArriveBeforePickedUp =>
      'أكمل \"الوصول لموقع الاستلام\" قبل تأكيد الاستلام.';

  @override
  String get driverMarkPickedUpBeforeDelivery =>
      'أكّد الاستلام قبل بدء التوصيل.';

  @override
  String get driverStartDeliveryBeforeArrive =>
      'ابدأ التوصيل قبل الوصول لموقع التسليم.';

  @override
  String get driverArriveBeforeDelivered =>
      'صل إلى موقع التسليم قبل تأكيد التسليم.';

  @override
  String get driverActionNotAvailable => 'هذا الإجراء غير متاح بعد.';

  @override
  String get driverNotSet => 'غير محدد';

  @override
  String get driverApproximateAddress =>
      'عنوان تقريبي — تأكد مع المتعلّم عند الحاجة.';

  @override
  String get driverExactCoordinatesMissing => 'الإحداثيات الدقيقة غير متوفرة.';

  @override
  String driverAssignedAt(String dateTime) {
    return 'معيّن $dateTime';
  }

  @override
  String driverAvailableInDays(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count يوم',
      many: '$count يومًا',
      few: '$count أيام',
      two: 'يومين',
      one: 'يوم واحد',
      zero: 'أقل من يوم',
    );
    return 'متاح خلال $_temp0';
  }

  @override
  String driverAvailableInHoursMinutes(int hours, int minutes) {
    return 'متاح خلال $hours س $minutes د';
  }

  @override
  String driverAvailableInHours(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ساعة',
      many: '$count ساعة',
      few: '$count ساعات',
      two: 'ساعتين',
      one: 'ساعة واحدة',
      zero: 'أقل من ساعة',
    );
    return 'متاح خلال $_temp0';
  }

  @override
  String driverAvailableInMinutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count دقيقة',
      many: '$count دقيقة',
      few: '$count دقائق',
      two: 'دقيقتين',
      one: 'دقيقة واحدة',
      zero: 'أقل من دقيقة',
    );
    return 'متاح خلال $_temp0';
  }

  @override
  String get driverAvailableSoon => 'متاح قريبًا';

  @override
  String get driverPickupNotAvailableYet => 'تأكيد الاستلام غير متاح بعد';

  @override
  String driverPickupConfirmFrom(String time) {
    return 'يمكن تأكيد الاستلام من $time (قبل 30 دقيقة من موعد المورّد).';
  }

  @override
  String get driverSupplierPickupWindowPassed => 'انتهى موعد استلام المورّد';

  @override
  String driverPickupConfirmationEnded(String dateTime) {
    return 'انتهت نافذة تأكيد الاستلام المسموحة في $dateTime.';
  }

  @override
  String get driverDeliveryWindowNotSet => 'موعد تأكيد التوصيل غير محدد';

  @override
  String get driverLearnerMustConfirmWindow =>
      'يجب على المتعلّم تأكيد موعد التوصيل قبل أن تتمكن من تأكيد التسليم.';

  @override
  String get driverDeliveryNotAvailableYet => 'تأكيد التوصيل غير متاح بعد';

  @override
  String driverDeliveryConfirmFrom(String time) {
    return 'يمكن تأكيد التوصيل من $time.';
  }

  @override
  String get driverDeliveryWindowPassed => 'انتهى موعد التوصيل';

  @override
  String driverDeliveryConfirmationEnded(String dateTime) {
    return 'انتهت نافذة تأكيد التوصيل المسموحة في $dateTime.';
  }

  @override
  String get driverPickupWindowNotStarted => 'موعد الاستلام لم يبدأ بعد';

  @override
  String driverPickupStartsAt(String time) {
    return 'يبدأ الاستلام في $time.';
  }

  @override
  String get driverSupplierPickupOverdue => 'تأخّر موعد استلام المورّد';

  @override
  String driverPickupOverdueBody(String dateTime) {
    return 'انتهت نافذة تأكيد الاستلام المسموحة في $dateTime. أبلغ عن فشل الاستلام إذا لم تتمكن من إكماله.';
  }

  @override
  String get driverScheduledPickupEnded => 'انتهى موعد الاستلام المجدول';

  @override
  String driverScheduledPickupEndedBody(String time) {
    return 'انتهى موعد المورّد في $time. لا يزال بإمكانك إكمال الاستلام إذا كانت المادة جاهزة.';
  }

  @override
  String get driverArriveAtPickup => 'الوصول لموقع الاستلام';

  @override
  String get driverArriveAtPickupReq1 => 'توجّه إلى موقع استلام المورّد.';

  @override
  String get driverArriveAtPickupReq2 => 'لا يلزم رمز تأكيد لهذه الخطوة.';

  @override
  String get driverMarkPickedUpReq1 => 'يجب أن تكون في موقع استلام المورّد.';

  @override
  String get driverMarkPickedUpReq2 => 'أدخل رمز تسليم المورّد عند الطلب.';

  @override
  String get driverStartDeliveryOnTheWay => 'بدء التوصيل / في الطريق';

  @override
  String get driverStartDeliveryReq1 =>
      'يجب أن تكون المادة قد استُلمت من المورّد.';

  @override
  String get driverStartDeliveryReq2 => 'لا يلزم رمز تأكيد لهذه الخطوة.';

  @override
  String get driverArriveAtDropoff => 'الوصول لموقع التسليم';

  @override
  String get driverArriveAtDropoffReq1 => 'توجّه إلى موقع تسليم المتعلّم.';

  @override
  String get driverArriveAtDropoffReq2 => 'لا يلزم رمز تأكيد لهذه الخطوة.';

  @override
  String get driverMarkDeliveredReq1 => 'يجب أن تكون في موقع تسليم المتعلّم.';

  @override
  String get driverMarkDeliveredReq2 => 'أدخل رمز تسليم المتعلّم عند الطلب.';

  @override
  String get driverFailureSupplierUnavailable => 'المورّد غير متاح';

  @override
  String get driverFailureMaterialNotReady => 'المادة غير جاهزة';

  @override
  String get driverFailureLocationIssue => 'مشكلة في الموقع';

  @override
  String get driverFailureLearnerUnavailable => 'المتعلّم غير متاح';

  @override
  String get driverFailureAddressIssue => 'مشكلة في العنوان';

  @override
  String get driverFailureAccessIssue => 'مشكلة في الوصول';

  @override
  String get driverInactiveMovedToAdminReview => 'نُقل إلى مراجعة الإدارة';

  @override
  String get driverInactiveNoLongerActive => 'لم يعد نشطًا';

  @override
  String get driverTransportCar => 'سيارة';

  @override
  String get driverTransportMotorcycle => 'دراجة نارية';

  @override
  String get driverTransportBicycle => 'دراجة هوائية';

  @override
  String get driverTransportWalking => 'سيرًا على الأقدام';

  @override
  String get driverPhoneRequired => 'مطلوب للسائقين';

  @override
  String get driverTransportationType => 'وسيلة النقل';

  @override
  String get driverAddressLineOptional => 'سطر العنوان (اختياري)';

  @override
  String get driverAvailabilityNoteOptional => 'ملاحظة التوفر (اختياري)';

  @override
  String get notificationDriverNewJobTitle => 'مهمة توصيل جديدة';

  @override
  String notificationDriverNewJobBody(String materialTitle) {
    return '$materialTitle جاهزة للتوصيل.';
  }

  @override
  String get notificationDriverPickupTimeTitle => 'موعد الاستلام';

  @override
  String notificationDriverPickupTimeBody(String materialTitle) {
    return 'يبدأ استلام $materialTitle قريبًا.';
  }

  @override
  String get notificationDriverDropoffTimeTitle => 'موعد التسليم';

  @override
  String notificationDriverDropoffTimeBody(String materialTitle) {
    return 'يبدأ تسليم $materialTitle قريبًا.';
  }

  @override
  String get notificationDriverUnassignedTitle => 'تم إلغاء تعيين التوصيل';

  @override
  String notificationDriverUnassignedBody(String materialTitle) {
    return 'أُعيد فتح $materialTitle لمجموعة السائقين من قِبل الإدارة.';
  }

  @override
  String get notificationDriverMovedToAdminTitle =>
      'نُقل التوصيل إلى مراجعة الإدارة';

  @override
  String get notificationDriverMovedToAdminBody =>
      'نُقل التوصيل إلى مراجعة الإدارة لأن الاستلام لم يُكتمل ضمن موعد الاستلام.';

  @override
  String get driverToday => 'اليوم';

  @override
  String driverPickupStartsInHours(
    int hours,
    String dateLabel,
    String timeRange,
  ) {
    String _temp0 = intl.Intl.pluralLogic(
      hours,
      locale: localeName,
      other: '$hours ساعات',
      one: 'ساعة واحدة',
    );
    return 'يبدأ الاستلام خلال $_temp0 · $dateLabel · $timeRange';
  }

  @override
  String driverPickupStartsInMinutes(
    int minutes,
    String dateLabel,
    String timeRange,
  ) {
    String _temp0 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: '$minutes دقيقة',
      many: '$minutes دقيقة',
      few: '$minutes دقائق',
      two: 'دقيقتين',
      one: 'دقيقة واحدة',
      zero: 'أقل من دقيقة',
    );
    return 'يبدأ الاستلام خلال $_temp0 · $dateLabel · $timeRange';
  }

  @override
  String driverPickupStartsSoon(String dateLabel, String timeRange) {
    return 'يبدأ الاستلام قريبًا · $dateLabel · $timeRange';
  }

  @override
  String driverPickupWindowEndedSummary(String dateLabel, String timeRange) {
    return 'انتهت نافذة الاستلام · $dateLabel · $timeRange';
  }

  @override
  String driverReadyForPickupNow(String dateLabel, String timeRange) {
    return 'جاهز للاستلام الآن · $dateLabel · $timeRange';
  }

  @override
  String get inviteAcceptTitle => 'أكمل دعوة ImpactLoop';

  @override
  String get inviteInvalidLink => 'رابط الدعوة غير صالح.';

  @override
  String get inviteRegistrationCompleted => 'اكتمل التسجيل بنجاح.';

  @override
  String inviteRoleLabel(String role) {
    return 'الدور: $role';
  }

  @override
  String inviteInvitedRole(String role) {
    return 'الدور المدعو: $role';
  }

  @override
  String inviteExpires(String date) {
    return 'تنتهي في: $date';
  }

  @override
  String get inviteInvalidOrExpired =>
      'رابط الدعوة هذا غير صالح أو منتهٍ أو ملغى أو مستخدم بالفعل.';

  @override
  String get inviteCompleteRegistration => 'إكمال التسجيل';

  @override
  String get inviteFullName => 'الاسم الكامل';

  @override
  String get invitePhone => 'الهاتف';

  @override
  String get invitePhoneOptional => 'الهاتف (اختياري)';

  @override
  String get inviteFieldRequired => 'مطلوب';

  @override
  String get driverLocationUnavailableShort => 'الموقع غير متاح';

  @override
  String get driverUnknownParty => 'غير معروف';

  @override
  String driverGroupedItemsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count عنصر',
      many: '$count عنصرًا',
      few: '$count عناصر',
      two: 'عنصران',
      one: 'عنصر واحد',
      zero: 'لا عناصر',
    );
    return '$_temp0';
  }

  @override
  String get driverCouldNotShareLocation =>
      'تعذّر مشاركة الموقع. حاول مرة أخرى أو استخدم إرسال موقعي.';

  @override
  String get driverLocationPermissionDenied =>
      'تم رفض إذن الموقع. فعّل إذن الموقع أو حاول مرة أخرى.';

  @override
  String get driverLocationServicesDisabled =>
      'خدمات الموقع معطّلة. شغّل خدمات الموقع وحاول مرة أخرى.';

  @override
  String get driverCurrentLocationFailed =>
      'تعذّر الحصول على موقعك الحالي. يُرجى المحاولة مرة أخرى.';

  @override
  String get driverHistoryTitle => 'السجل والبلاغات';

  @override
  String get driverHistorySubtitle =>
      'راجع عمليات التوصيل السابقة وتابع البلاغات التي قدّمتها.';

  @override
  String get driverDeliveriesTab => 'التوصيلات';

  @override
  String get driverReportsTab => 'البلاغات';

  @override
  String get driverHistoryEmpty => 'لا توجد توصيلات سابقة حتى الآن.';

  @override
  String get driverReportsEmpty => 'لم تقدّم أي بلاغات حتى الآن.';

  @override
  String get driverArchiveLoadFailed => 'تعذّر تحميل هذا السجل.';

  @override
  String get driverArchiveMoreFailed =>
      'تعذّر تحميل عناصر أقدم. ما زالت النتائج الحالية ظاهرة.';

  @override
  String get driverOpenHistoricalDelivery => 'فتح التوصيل السابق';

  @override
  String get driverPartialPickupHistory => 'استلام جزئي';

  @override
  String get driverSubmittedNote => 'ملاحظتك المقدّمة';

  @override
  String get driverResolutionOutcome => 'النتيجة';

  @override
  String get driverOpenRelatedDelivery => 'فتح التوصيل المرتبط';

  @override
  String get driverHistoricalDeliveryTitle => 'توصيل سابق';

  @override
  String get driverReadOnly => 'للقراءة فقط';

  @override
  String get driverDeliverySummary => 'ملخص التوصيل';

  @override
  String get driverItemAudit => 'سجل المواد';

  @override
  String get driverLegacyItemAuditWarning =>
      'لا تحتوي عملية التوصيل القديمة هذه على لقطة استلام؛ تظهر سجلات الحجز الحالية.';

  @override
  String get driverFailureReason => 'سبب التعذّر';

  @override
  String get driverDeliveryTimeline => 'الخط الزمني للتوصيل';

  @override
  String get driverTimelineUnavailable => 'لا تتوفر أحداث في الخط الزمني.';

  @override
  String get driverHistoryNav => 'السجل';

  @override
  String get driverOutcomeAdminReview => 'نُقل إلى مراجعة الإدارة';

  @override
  String get driverOutcomeReassigned => 'أُعيد إسناده إلى سائق آخر';

  @override
  String get driverOutcomeReleased => 'أُعيد إلى الوظائف المتاحة';

  @override
  String get driverOutcomeClosed => 'توصيل مغلق';

  @override
  String get driverReviewPending => 'قيد المراجعة';

  @override
  String get driverReviewVerified => 'تم التحقق';

  @override
  String get driverReviewRejected => 'مرفوض';

  @override
  String get driverReviewResolvedNoStrike => 'حُلّ دون مخالفة';

  @override
  String get driverIncidentPickupFailed => 'مشكلة استلام';

  @override
  String get driverIncidentDeliveryFailed => 'مشكلة توصيل';

  @override
  String get driverIncidentDriverIssue => 'مشكلة لدى السائق';

  @override
  String get driverOutcomeSupplierReschedule => 'طُلب من المورّد إعادة الجدولة';

  @override
  String get driverOutcomeReplacementSubmitted => 'تم تقديم موعد بديل';

  @override
  String get driverOutcomeRegrouped => 'أُعيد تجميع الحجز';

  @override
  String get driverOutcomeCancelledExpired =>
      'أُلغي الحجز أو انتهت صلاحيته ورُفع الحجز';

  @override
  String get driverOutcomePendingRecovery => 'إجراء المعالجة ما زال معلقًا';

  @override
  String get driverOutcomeNoUpdate => 'لا يوجد تحديث للمعالجة بعد';

  @override
  String get driverYes => 'نعم';

  @override
  String get driverNotPickedUpTitle => 'لم يتم استلامها';

  @override
  String get driverArchiveCursorExpired =>
      'تغيّرت صفحة السجل هذه أو انتهت صلاحيتها. ابدأ مجددًا من أحدث النتائج.';

  @override
  String get driverRestartArchive => 'البدء من الأحدث';

  @override
  String get driverOpenRecoveryDelivery => 'فتح توصيل المعالجة';

  @override
  String get driverProfileTitle => 'الملف التشغيلي للسائق';

  @override
  String get driverProfileSubtitle =>
      'أدر تفاصيل العمل المستخدمة في التوصيل وتحكّم في استقبال عروض توصيل جديدة.';

  @override
  String get driverAdministrativeProfileStatus => 'حالة الملف';

  @override
  String get driverOperationalState => 'الحالة التشغيلية';

  @override
  String get driverProfileStatusActive => 'نشط';

  @override
  String get driverProfileStatusInactive => 'غير نشط';

  @override
  String get driverProfileStatusSuspended => 'موقوف';

  @override
  String get driverProfileStatusUnknown => 'الحالة غير متاحة';

  @override
  String get driverProfileActiveExplanation => 'ملف السائق نشط.';

  @override
  String get driverProfileInactiveExplanation =>
      'ملف السائق غير نشط. لا يمكن تعديل الملف أو استقبال وظائف جديدة.';

  @override
  String get driverProfileSuspendedExplanation =>
      'ملف السائق موقوف. تواصل مع الدعم إذا احتجت إلى المساعدة.';

  @override
  String get driverProfileUnknownExplanation =>
      'تعذّر تأكيد حالة ملف السائق. حدّث الصفحة قبل تغيير التوفر.';

  @override
  String get driverAvailabilityAvailable => 'متاح';

  @override
  String get driverAvailabilityOffline => 'غير متصل';

  @override
  String get driverAvailabilityOnDelivery => 'في مهمة توصيل';

  @override
  String get driverAvailabilityUnknown => 'الحالة غير متاحة';

  @override
  String get driverAvailabilityUnknownExplanation =>
      'يدير النظام حالتك التشغيلية، وهي غير متاحة حاليًا.';

  @override
  String get driverSystemManagedState => 'حالة تشغيلية يديرها النظام';

  @override
  String get driverAcceptingNewJobs => 'استقبال وظائف جديدة';

  @override
  String get driverAcceptingNewJobsOn => 'عروض التوصيل الجديدة مفعّلة.';

  @override
  String get driverAcceptingNewJobsOff => 'عروض التوصيل الجديدة متوقفة مؤقتًا.';

  @override
  String get driverActiveDeliveriesContinueNoOffers =>
      'تستمر توصيلاتك النشطة، ولن تستقبل عروض وظائف جديدة.';

  @override
  String get driverOnDeliveryAcceptingExplanation =>
      'أنت تنفّذ توصيلات نشطة ويمكنك قبول عمل إضافي ضمن الحد الحالي.';

  @override
  String get driverAvailableExplanation =>
      'يمكنك تصفح وظائف التوصيل الجديدة وقبولها.';

  @override
  String get driverOfflineExplanation => 'لا تستقبل عروض توصيل جديدة.';

  @override
  String get driverDashboardAvailabilityTitle => 'التوفر والحالة';

  @override
  String get driverActiveDeliveryCountLabel => 'التوصيلات النشطة';

  @override
  String get driverPauseNewJobsConfirmationTitle =>
      'إيقاف عروض الوظائف الجديدة؟';

  @override
  String get driverPauseNewJobsConfirmationBody =>
      'ستستمر التوصيلات المسندة والتذكيرات والإشعارات التشغيلية. سيتوقف استقبال عروض الوظائف الجديدة فقط.';

  @override
  String get driverPauseNewJobsAction => 'إيقاف الوظائف الجديدة';

  @override
  String get driverResumeNewJobs => 'استئناف الوظائف الجديدة';

  @override
  String get driverOperationalProfileDetails => 'تفاصيل الملف التشغيلي';

  @override
  String get driverProfileCity => 'المدينة';

  @override
  String get driverProfileArea => 'المنطقة';

  @override
  String get driverTransportationCar => 'سيارة';

  @override
  String get driverTransportationMotorcycle => 'دراجة نارية';

  @override
  String get driverTransportationBicycle => 'دراجة هوائية';

  @override
  String get driverTransportationWalking => 'سيرًا على الأقدام';

  @override
  String get driverTransportationUnknown => 'غير محدد';

  @override
  String get driverChooseTransportation => 'اختر وسيلة النقل';

  @override
  String get driverVehicleDescription => 'وصف المركبة';

  @override
  String get driverVehiclePlate => 'لوحة المركبة';

  @override
  String get driverCapacityNotes => 'ملاحظات السعة';

  @override
  String get driverCapacityNotesHint =>
      'معلومات اختيارية عن حجم المواد أو سعة الحمل';

  @override
  String get driverOptionalField => 'اختياري';

  @override
  String get driverCityValidation => 'أدخل مدينة من حرفين إلى 100 حرف.';

  @override
  String get driverAreaValidation => 'أدخل منطقة من حرفين إلى 100 حرف.';

  @override
  String get driverTransportationValidation => 'اختر وسيلة نقل مدعومة.';

  @override
  String get driverVehicleLabelValidation =>
      'يجب ألا يتجاوز وصف المركبة 120 حرفًا.';

  @override
  String get driverVehiclePlateValidation =>
      'يجب ألا تتجاوز لوحة المركبة 32 حرفًا.';

  @override
  String get driverCapacityNotesValidation =>
      'يجب ألا تتجاوز ملاحظات السعة 500 حرف.';

  @override
  String get driverSaveProfile => 'حفظ الملف';

  @override
  String get driverSavingProfile => 'جارٍ الحفظ…';

  @override
  String get driverProfileSaved => 'تم حفظ ملف السائق.';

  @override
  String get driverProfileLoadError => 'تعذّر تحميل ملف السائق';

  @override
  String get driverAccountSettingsTitle => 'إعدادات الحساب';

  @override
  String get driverAccountSettingsExplanation =>
      'تتم إدارة الاسم ورقم الهاتف من إعدادات الحساب.';

  @override
  String get driverOpenAccountSettings => 'فتح إعدادات الحساب';

  @override
  String get driverUnsavedChangesTitle => 'تجاهل التغييرات غير المحفوظة؟';

  @override
  String get driverUnsavedChangesBody => 'لم تُحفظ تغييرات ملف السائق بعد.';

  @override
  String get driverKeepEditing => 'متابعة التعديل';

  @override
  String get driverDiscardChanges => 'تجاهل التغييرات';

  @override
  String get driverJobsPausedTitle => 'عروض الوظائف الجديدة متوقفة';

  @override
  String get driverJobsPausedExplanation =>
      'فعّل استقبال الوظائف الجديدة لتصفح التوصيلات المتاحة مجددًا.';

  @override
  String get driverJobsInactiveTitle => 'ملف السائق غير نشط';

  @override
  String get driverJobsSuspendedTitle => 'ملف السائق موقوف';

  @override
  String get driverJobsUnavailableTitle => 'الوظائف المتاحة غير متوفرة';

  @override
  String get driverAssignedDeliveriesContinue =>
      'تبقى التوصيلات المسندة والتذكيرات والبلاغات وسجل الإشعارات متاحة.';

  @override
  String get driverNotAcceptingNewJobsError =>
      'استأنف استقبال الوظائف الجديدة قبل قبول هذا التوصيل.';

  @override
  String get driverCancelAction => 'إلغاء';

  @override
  String get driverStatusWaitingForAssignment => 'بانتظار التعيين';

  @override
  String get driverStatusAssigned => 'معيّن — توجّه للاستلام';

  @override
  String get driverStatusAtPickup => 'في موقع الاستلام';

  @override
  String get driverStatusPickedUp => 'تم الاستلام';

  @override
  String get driverStatusOnTheWay => 'في الطريق إلى المتعلّم';

  @override
  String get driverStatusAtDropoff => 'في موقع التسليم';

  @override
  String get driverStatusDelivered => 'تم التسليم';

  @override
  String get driverStatusCancelled => 'ملغى';

  @override
  String get driverStatusPickupFailed => 'فشل الاستلام';

  @override
  String get driverStatusDeliveryFailed => 'فشل التسليم';

  @override
  String get driverStatusDriverNoShow => 'مُعلَّم كعدم حضور';

  @override
  String get driverStatusLearnerNoShow => 'المتعلّم لم يحضر';

  @override
  String get driverStatusAwaitingReview => 'قيد مراجعة الإدارة';

  @override
  String get driverNavHome => 'الرئيسية';

  @override
  String get driverNavJobs => 'الوظائف';

  @override
  String get driverNavActive => 'النشطة';

  @override
  String get driverNavHistory => 'السجل';

  @override
  String get driverNavMore => 'المزيد';

  @override
  String get driverNavGroupOverview => 'نظرة عامة';

  @override
  String get driverNavGroupWork => 'العمل';

  @override
  String get driverNavGroupHistory => 'السجل';

  @override
  String get driverNavGroupAccount => 'الحساب';

  @override
  String get driverMoreTitle => 'خيارات إضافية';

  @override
  String get driverMoreProfile => 'ملف السائق';

  @override
  String get driverMoreNotifications => 'الإشعارات';

  @override
  String get driverMoreHistory => 'السجل والتقارير';

  @override
  String get driverMoreAccountSettings => 'إعدادات الحساب';

  @override
  String get driverAcceptingJobsOnExplicit => 'متاح لاستقبال مهام جديدة';

  @override
  String get driverAcceptingJobsOffExplicit => 'غير متاح حاليًا';

  @override
  String get driverEditFilters => 'تعديل الفلاتر';

  @override
  String get driverPartialPickupSelectAtLeastOne =>
      'اختر عنصرًا واحدًا على الأقل الذي سلّمه المورّد الآن.';

  @override
  String get driverEmptyActiveTitle => 'لا توجد توصيلات نشطة';

  @override
  String get driverEmptyActiveBody =>
      'عند قبول مهمة، ستظهر هنا حتى يكتمل التسليم.';

  @override
  String get driverEmptyActiveCta => 'تصفّح الوظائف المتاحة';

  @override
  String get driverViewNearbyJobs => 'عرض الوظائف القريبة';

  @override
  String get driverRoutePickupLabel => 'الاستلام';

  @override
  String get driverRouteDropoffLabel => 'التسليم';

  @override
  String get driverRouteFrom => 'من';

  @override
  String get driverRouteTo => 'إلى';

  @override
  String get driverRouteArrowSemantic => 'اتجاه المسار';

  @override
  String get driverMapSectionTitle => 'المواقع';

  @override
  String get driverMapPickupPin => 'موقع الاستلام';

  @override
  String get driverMapDropoffPin => 'موقع التسليم';

  @override
  String get driverMapOpenExternal => 'فتح في الخرائط';

  @override
  String get driverMapUnavailable => 'معاينة الخريطة غير متوفرة لهذا الموقع.';

  @override
  String get driverUnitPiece => 'قطعة';

  @override
  String get driverUnitSheet => 'لوح';

  @override
  String get driverUnitBag => 'كيس';

  @override
  String get driverUnitKg => 'كغ';

  @override
  String get driverUnitItem => 'عنصر';

  @override
  String get driverUnitUnit => 'وحدة';

  @override
  String get driverUnitPanel => 'لوح';

  @override
  String get driverUnitCrate => 'صندوق';

  @override
  String get driverUnitMeter => 'متر';

  @override
  String get driverUnitLiter => 'لتر';

  @override
  String get driverUnitRoll => 'لفة';

  @override
  String get driverUnitBox => 'علبة';

  @override
  String get driverUnitPack => 'حزمة';

  @override
  String get driverUnitSet => 'مجموعة';

  @override
  String driverQuantityPiece(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count قطعة',
      many: '$count قطعة',
      few: '$count قطع',
      two: 'قطعتان',
      one: 'قطعة واحدة',
      zero: 'لا قطع',
    );
    return '$_temp0';
  }

  @override
  String driverQuantitySheet(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count لوح',
      many: '$count لوحًا',
      few: '$count ألواح',
      two: 'لوحان',
      one: 'لوح واحد',
      zero: 'لا ألواح',
    );
    return '$_temp0';
  }

  @override
  String driverQuantityBag(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count كيس',
      many: '$count كيسًا',
      few: '$count أكياس',
      two: 'كيسان',
      one: 'كيس واحد',
      zero: 'لا أكياس',
    );
    return '$_temp0';
  }

  @override
  String driverQuantityKg(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count كغ',
      one: '1 كغ',
      zero: '0 كغ',
    );
    return '$_temp0';
  }

  @override
  String driverQuantityItem(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count عنصر',
      many: '$count عنصرًا',
      few: '$count عناصر',
      two: 'عنصران',
      one: 'عنصر واحد',
      zero: 'لا عناصر',
    );
    return '$_temp0';
  }

  @override
  String driverQuantityUnit(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count وحدة',
      many: '$count وحدةً',
      few: '$count وحدات',
      two: 'وحدتان',
      one: 'وحدة واحدة',
      zero: 'لا وحدات',
    );
    return '$_temp0';
  }

  @override
  String driverQuantityPanel(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count لوح',
      many: '$count لوحًا',
      few: '$count ألواح',
      two: 'لوحان',
      one: 'لوح واحد',
      zero: 'لا ألواح',
    );
    return '$_temp0';
  }

  @override
  String driverQuantityCrate(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count صندوق',
      many: '$count صندوقًا',
      few: '$count صناديق',
      two: 'صندوقان',
      one: 'صندوق واحد',
      zero: 'لا صناديق',
    );
    return '$_temp0';
  }

  @override
  String driverQuantityMeter(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count متر',
      many: '$count مترًا',
      few: '$count أمتار',
      two: 'متران',
      one: 'متر واحد',
      zero: 'لا أمتار',
    );
    return '$_temp0';
  }

  @override
  String driverQuantityLiter(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count لتر',
      many: '$count لترًا',
      few: '$count لترات',
      two: 'لتران',
      one: 'لتر واحد',
      zero: 'لا لترات',
    );
    return '$_temp0';
  }

  @override
  String driverQuantityRoll(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count لفة',
      many: '$count لفةً',
      few: '$count لفات',
      two: 'لفتان',
      one: 'لفة واحدة',
      zero: 'لا لفات',
    );
    return '$_temp0';
  }

  @override
  String driverQuantityBox(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count علبة',
      many: '$count علبةً',
      few: '$count علب',
      two: 'علبتان',
      one: 'علبة واحدة',
      zero: 'لا علب',
    );
    return '$_temp0';
  }

  @override
  String driverQuantityPack(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count حزمة',
      many: '$count حزمةً',
      few: '$count حزم',
      two: 'حزمتان',
      one: 'حزمة واحدة',
      zero: 'لا حزم',
    );
    return '$_temp0';
  }

  @override
  String driverQuantitySet(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count مجموعة',
      many: '$count مجموعةً',
      few: '$count مجموعات',
      two: 'مجموعتان',
      one: 'مجموعة واحدة',
      zero: 'لا مجموعات',
    );
    return '$_temp0';
  }

  @override
  String get notificationDriverPickupReminderTitle => 'تذكير الاستلام';

  @override
  String notificationDriverPickupReminderBody(String materialTitle) {
    return 'تذكير: موعد استلام $materialTitle قريب.';
  }

  @override
  String get notificationDriverPickupStartingSoonTitle =>
      'الاستلام يبدأ قريبًا';

  @override
  String notificationDriverPickupStartingSoonBody(String materialTitle) {
    return 'يبدأ استلام $materialTitle خلال دقائق.';
  }

  @override
  String get notificationDriverPickupWindowStartedTitle => 'بدأ موعد الاستلام';

  @override
  String notificationDriverPickupWindowStartedBody(String materialTitle) {
    return 'موعد استلام $materialTitle مفتوح الآن.';
  }

  @override
  String get notificationDriverPickupOverdueTitle => 'تأخّر الاستلام';

  @override
  String notificationDriverPickupOverdueBody(String materialTitle) {
    return 'تأخّر استلام $materialTitle. أكمل الاستلام أو أبلغ عن مشكلة.';
  }

  @override
  String get notificationDriverDropoffReminderTitle => 'تذكير التسليم';

  @override
  String notificationDriverDropoffReminderBody(String materialTitle) {
    return 'تذكير: موعد تسليم $materialTitle قريب.';
  }

  @override
  String get notificationDriverDropoffStartingSoonTitle =>
      'التسليم يبدأ قريبًا';

  @override
  String notificationDriverDropoffStartingSoonBody(String materialTitle) {
    return 'يبدأ تسليم $materialTitle خلال دقائق.';
  }

  @override
  String get notificationDriverDropoffWindowStartedTitle => 'بدأ موعد التسليم';

  @override
  String notificationDriverDropoffWindowStartedBody(String materialTitle) {
    return 'موعد تسليم $materialTitle مفتوح الآن.';
  }

  @override
  String get notificationDriverDropoffOverdueTitle => 'تأخّر التسليم';

  @override
  String notificationDriverDropoffOverdueBody(String materialTitle) {
    return 'تأخّر تسليم $materialTitle. أكمل التسليم أو أبلغ عن مشكلة.';
  }

  @override
  String get notificationDriverDeliveryRequestCreatedTitle => 'طُلب توصيل';

  @override
  String notificationDriverDeliveryRequestCreatedBody(String materialTitle) {
    return 'طُلب توصيل لـ $materialTitle.';
  }

  @override
  String get notificationDriverDeliveryAcceptedTitle => 'تم قبول التوصيل';

  @override
  String notificationDriverDeliveryAcceptedBody(String materialTitle) {
    return 'قبلت توصيل $materialTitle.';
  }

  @override
  String get notificationDriverDeliveryNextStepTitle =>
      'الخطوة التالية للتوصيل';

  @override
  String notificationDriverDeliveryNextStepBody(String materialTitle) {
    return 'تابع توصيل $materialTitle.';
  }

  @override
  String get notificationDeliveryDriverAssignedTitle => 'تم تعيينك للتوصيل';

  @override
  String notificationDeliveryDriverAssignedBody(String materialTitle) {
    return 'عُيّنت لتوصيل $materialTitle.';
  }

  @override
  String get adminNavOverview => 'نظرة عامة';

  @override
  String get adminNavUsers => 'المستخدمون';

  @override
  String get adminNavSuppliers => 'الموردون';

  @override
  String get adminNavMaterials => 'المواد';

  @override
  String get adminNavApprovals => 'الموافقات';

  @override
  String get adminNavInvitations => 'الدعوات';

  @override
  String get adminNavImpactAnalytics => 'تحليلات الأثر';

  @override
  String get adminNavAuditLogs => 'سجلات التدقيق';

  @override
  String get adminNavReservations => 'الحجوزات';

  @override
  String get adminNavDeliveries => 'التوصيل';

  @override
  String get adminNavLearningProjects => 'مشاريع التعلم';

  @override
  String get adminNavExportCenter => 'مركز التصدير';

  @override
  String get adminAccessDeniedTitle => 'تم رفض الوصول';

  @override
  String get adminOverviewPageTitle => 'نظرة عامة للإدارة';

  @override
  String get adminImpactSectionTitle => 'أثر إعادة الاستخدام';

  @override
  String get adminEstimatedAvoidedSuffix => 'تقدير تجنب';

  @override
  String get adminPlatformMetricsTitle => 'مقاييس المنصة';

  @override
  String get adminAdminOperationsTitle => 'عمليات الإدارة';

  @override
  String get adminOpenModuleCta => 'فتح';

  @override
  String get adminStatUsers => 'المستخدمون';

  @override
  String get adminStatSuppliers => 'الموردون';

  @override
  String get adminStatMaterials => 'المواد';

  @override
  String get adminStatActiveInvitations => 'الدعوات النشطة';

  @override
  String get adminStatActiveDrivers => 'السائقون النشطون';

  @override
  String get adminEstimatedBadge => 'تقديري';

  @override
  String get adminViewAllAuditLogs => 'عرض كل السجلات';

  @override
  String get adminReviewQueuesTitle => 'قوائم المراجعة';

  @override
  String get adminEmptyNoDataYet => 'لا توجد بيانات بعد';

  @override
  String get adminEmptyAllClearTitle => 'كل شيء واضح';

  @override
  String get adminPendingCategoryRequests => 'طلبات الفئات';

  @override
  String get adminPendingPriceRequests => 'طلبات الأسعار';

  @override
  String get adminPendingReports => 'البلاغات';

  @override
  String get adminCategoryRequest => 'طلب فئة';

  @override
  String get adminCreateNewCategory => 'إنشاء فئة جديدة';

  @override
  String get adminExistingCategory => 'الفئة الحالية';

  @override
  String get adminUseThisCategory => 'استخدم هذه الفئة';

  @override
  String get adminExactNameMatch => 'مطابقة تامة';

  @override
  String get adminPossibleNameMatch => 'مطابقة محتملة';

  @override
  String get adminRequestDetails => 'تفاصيل الطلب';

  @override
  String get adminCategoryMatching => 'مطابقة الفئة';

  @override
  String get adminSimilarCategories => 'فئات مشابهة';

  @override
  String get adminRequired => 'مطلوب';

  @override
  String get adminMaterialFamily => 'عائلة المادة';

  @override
  String get adminActiveMapping => 'تعيين نشط';

  @override
  String get adminRequestSummary => 'ملخص الطلب';

  @override
  String get adminAdminGuidance => 'إرشادات الإدارة';

  @override
  String get adminSubmitted => 'تاريخ التقديم';

  @override
  String get adminRequestedBy => 'مقدم الطلب';

  @override
  String get adminStatus => 'الحالة';

  @override
  String get adminSupplier => 'المورد';

  @override
  String get adminMaterial => 'المادة';

  @override
  String get adminDescription => 'الوصف';

  @override
  String get adminQuantity => 'الكمية';

  @override
  String get adminCondition => 'الحالة';

  @override
  String get adminLocation => 'الموقع';

  @override
  String get adminReason => 'السبب';

  @override
  String get adminApprove => 'موافقة';

  @override
  String get adminReject => 'رفض';

  @override
  String get adminClose => 'إغلاق';

  @override
  String get adminRetry => 'إعادة المحاولة';

  @override
  String get adminNavSupplierVerification => 'التحقق من المورد';

  @override
  String get adminAccessDeniedBody =>
      'ليس لديك صلاحية للوصول إلى بوابة الإدارة.';

  @override
  String get adminOverviewPageSubtitle => 'لوحة تحكم المنصة';

  @override
  String adminWelcomeTitle(String name) {
    return 'مرحباً بعودتك، $name';
  }

  @override
  String get adminWelcomeSubtitle =>
      'إليك نشاط المنصة اليوم والموافقات وأثر إعادة الاستخدام والصحة التشغيلية.';

  @override
  String get adminBannerOverviewLabel => 'نظرة عامة على المنصة';

  @override
  String get adminPlatformDistributionTitle => 'توزيع حسابات المنصة';

  @override
  String get adminPlatformDistributionSubtitle =>
      'المستخدمون والموردون والسائقون النشطون على ImpactLoop';

  @override
  String get adminCo2RingCenterLabel => 'المواد المدرجة المعاد استخدامها';

  @override
  String get adminControlCenterTitle => 'مركز التحكم بالمنصة';

  @override
  String get adminControlCenterSubtitle =>
      'راقب نشاط المنصة والموافقات والدعوات والتحقق من الموردين وأثر إعادة الاستخدام من مكان واحد.';

  @override
  String get adminChartsAnalyticsTitle => 'الرسوم البيانية والتحليلات';

  @override
  String get adminChartsAnalyticsSubtitle =>
      'اتجاهات إعادة الاستخدام وتوزيع الفئات والحجوزات وقوائم الموافقات.';

  @override
  String get adminPlatformMetricsSubtitle =>
      'أعداد مباشرة للمستخدمين والقوائم والموافقات والعمليات.';

  @override
  String get adminAdminOperationsSubtitle =>
      'انتقل إلى كل وحدة إدارية من لوحة التحكم.';

  @override
  String get adminStatAvailableMaterials => 'المواد المتاحة';

  @override
  String get adminStatPendingApprovals => 'الموافقات المعلّقة';

  @override
  String get adminStatCompletedReuse => 'عمليات إعادة الاستخدام المكتملة';

  @override
  String get adminEstimatedCo2Avoided => 'تقدير تجنب CO₂';

  @override
  String get adminEstimatedCo2Helper =>
      'تقدير من المواد المعاد استخدامها وعوامل إعادة الاستخدام حسب الفئة.';

  @override
  String get adminEstimatedCo2ShortHelper => 'تقدير من المواد المعاد استخدامها';

  @override
  String get adminReuseCompletionRateLabel => 'معدل إكمال إعادة الاستخدام';

  @override
  String get adminHintUsers => 'الحسابات المسجلة على ImpactLoop';

  @override
  String get adminHintSuppliers => 'الموردون الذين لديهم وصول للبوابة';

  @override
  String get adminHintMaterials => 'جميع المواد المدرجة على المنصة';

  @override
  String get adminHintAvailableMaterials => 'المواد المتاحة للحجز حالياً';

  @override
  String get adminHintPendingApprovals =>
      'طلبات الموردين والفئات والأسعار المعلّقة';

  @override
  String get adminHintActiveInvitations =>
      'دعوات السائق والمشرف والإدارة المفتوحة';

  @override
  String get adminHintCompletedReuse => 'المواد المعلّمة كمعاد استخدامها';

  @override
  String get adminHintActiveDrivers => 'المستخدمون الذين لديهم دور سائق';

  @override
  String get adminReuseActivityTitle => 'نشاط إعادة الاستخدام عبر الزمن';

  @override
  String get adminReuseActivitySubtitle =>
      'إعادة الاستخدام المكتملة شهرياً عبر المنصة';

  @override
  String get adminMaterialsByCategoryTitle => 'المواد حسب الفئة';

  @override
  String get adminMaterialsByCategorySubtitle =>
      'توزيع المواد المدرجة عبر الفئات';

  @override
  String get adminReservationStatusTitle => 'نظرة عامة على حالات الحجز';

  @override
  String get adminReservationStatusSubtitle =>
      'مسار الحجوزات الحالي حسب الحالة';

  @override
  String get adminPendingActionsTitle => 'تفصيل قائمة الموافقات';

  @override
  String get adminPendingActionsSubtitle =>
      'مراجعات الموردين والفئات والأسعار والبلاغات المعلّقة';

  @override
  String get adminRecentInvitationsTitle => 'الدعوات الأخيرة';

  @override
  String get adminRecentActivityTitle => 'النشاط الإداري الأخير';

  @override
  String get adminRecentActivitySubtitle => 'أحدث الأحداث الإدارية عند توفرها';

  @override
  String get adminRecentActivityEmptySubtitle => 'لا يوجد نشاط إداري بعد';

  @override
  String get adminSupplierVerificationQueueTitle => 'قائمة التحقق من الموردين';

  @override
  String get adminReviewQueuesSubtitle =>
      'التحقق من الموردين والدعوات والنشاط الإداري';

  @override
  String get adminSupplierVerificationFutureNote =>
      'ستظهر عملية التحقق من الموردين بعد تفعيل مستندات التحقق للمؤسسات.';

  @override
  String get adminImpactSnapshotTitle => 'لقطة أثر إعادة الاستخدام';

  @override
  String get adminImpactSnapshotSubtitle =>
      'نتائج إعادة الاستخدام من الحجوزات والمواد المكتملة';

  @override
  String get adminImpactReusedMaterials => 'مواد أُعيد استخدامها';

  @override
  String get adminImpactCompletedReservations => 'الحجوزات المكتملة';

  @override
  String get adminImpactLearnersBenefited => 'المتعلمون المستفيدون';

  @override
  String get adminImpactSuppliersContributed => 'الموردون المساهمون';

  @override
  String get adminImpactTopCategory => 'أعلى فئة معاد استخدامها';

  @override
  String get adminImpactTopCategoryEmpty => 'أعلى فئة معاد استخدامها: —';

  @override
  String get adminImpactEnvironmentalNote =>
      'يتم حساب الأثر البيئي التقديري باستخدام عوامل إعادة الاستخدام حسب الفئة والكميات المتاحة. القيم تقريبية.';

  @override
  String get adminEmptyNoInvitations =>
      'أنشئ دعوات الأدوار من صفحة الدعوات عند تفعيلها.';

  @override
  String get adminEmptyNoInvitationsTitle => 'لا توجد دعوات نشطة';

  @override
  String get adminEmptyNoInvitationsHint =>
      'افتح وحدة الدعوات لإنشاء دعوات سائق أو مشرف أو إدارة.';

  @override
  String get adminEmptyNoActivity => 'لا يوجد نشاط إداري بعد';

  @override
  String get adminEmptyNoActivityHint =>
      'ستظهر أحداث التدقيق بعد تفعيل إجراءات الإدارة.';

  @override
  String get adminEmptyNoSupplierVerifications =>
      'لا توجد طلبات تحقق من الموردين حالياً.';

  @override
  String get adminEmptyNoPendingApprovals =>
      'لا توجد مراجعات موردين أو فئات أو أسعار أو بلاغات معلّقة.';

  @override
  String get adminPendingSupplierVerifications => 'تحقق المورد';

  @override
  String get adminOpUsersDesc => 'إدارة حسابات مستخدمي المنصة';

  @override
  String get adminOpSuppliersDesc => 'مراجعة حسابات وملفات الموردين';

  @override
  String get adminOpSupplierVerificationDesc =>
      'معالجة طلبات التحقق من الموردين';

  @override
  String get adminOpMaterialsDesc => 'مراجعة وإدارة قوائم المواد';

  @override
  String get adminOpApprovalsDesc => 'موافقات الفئات والأسعار والقوائم';

  @override
  String get adminOpInvitationsDesc => 'إنشاء وتتبع دعوات الأدوار';

  @override
  String get adminOpImpactDesc => 'استكشاف تحليلات إعادة الاستخدام والأثر';

  @override
  String get adminOpAuditLogsDesc => 'مراجعة سجل التدقيق الإداري';

  @override
  String get adminResolveCategoryRequest => 'معالجة طلب الفئة';

  @override
  String get adminUseExistingCategory => 'استخدام فئة حالية';

  @override
  String get adminUseExistingGuidance =>
      'يوصى به عندما تغطي فئة حالية هذه المادة بالفعل.';

  @override
  String get adminCreateNewGuidance =>
      'أنشئ فئة جديدة فقط عندما لا تمثل الفئات الحالية هذا الطلب بدقة.';

  @override
  String get adminSuggestedExistingCategory => 'الفئة الحالية المقترحة';

  @override
  String get adminSearchOtherCategories => 'ابحث أو اختر فئة نشطة أخرى';

  @override
  String get adminSearchCategories => 'ابحث في الفئات الحالية…';

  @override
  String get adminChooseExistingCategory => 'اختر فئة حالية';

  @override
  String get adminExistingCategoryRequired => 'اختر فئة حالية نشطة.';

  @override
  String get adminLoadingCategories => 'جارٍ تحميل الفئات الحالية…';

  @override
  String get adminFailedCategories => 'تعذر تحميل الفئات الحالية.';

  @override
  String get adminNoCategoriesAvailable =>
      'لا توجد فئات مواد نشطة ومحددة الملكية متاحة.';

  @override
  String get adminApproveWithExisting => 'الموافقة باستخدام فئة حالية';

  @override
  String get adminCreateAndApprove => 'إنشاء الفئة والموافقة';

  @override
  String get adminCreateJustification => 'لماذا يلزم إنشاء فئة منفصلة؟';

  @override
  String get adminCreateJustificationHelper =>
      'اشرح بإيجاز لماذا لا تناسب الفئة المقترحة هذا الطلب.';

  @override
  String get adminCreateJustificationRequired =>
      'أدخل 10 أحرف على الأقل لتوضيح سبب الحاجة إلى فئة جديدة.';

  @override
  String get adminExistingNameConflict => 'هذه الفئة موجودة بالفعل';

  @override
  String get adminNoSimilarCategories => 'لا توجد فئة حالية مقترحة';

  @override
  String get adminApprovalConfiguration => 'إعداد الموافقة';

  @override
  String get adminRequestedCategoryName => 'الاسم المقترح من المورد';

  @override
  String get adminFinalCategoryNameEn => 'اسم الفئة النهائي بالإنجليزية';

  @override
  String get adminFinalCategoryNameAr => 'اسم الفئة النهائي بالعربية';

  @override
  String get adminBilingualNamesHelper =>
      'راجع اسمي المتجر النهائيين. سيظهر للمستخدم الاسم الموافق للغة التطبيق. تكشف الفحوصات الآلية المشكلات الواضحة في البنية وموضع اللغة فقط، ولا تتحقق من القواعد أو الترجمة.';

  @override
  String get adminNamingGuidance =>
      'استخدم اسم فئة مختصرًا وواضحًا للمتجر، وتجنب أسماء المواد المحددة والوصف الطويل والعبارات العامة.';

  @override
  String get adminEnglishNameRequired =>
      'أدخل اسم الفئة بالإنجليزية بين حرفين و120 حرفًا.';

  @override
  String get adminArabicNameRequired =>
      'أدخل اسم الفئة بالعربية بين حرفين و120 حرفًا.';

  @override
  String get adminEnglishNameWrongScript =>
      'يبدو أن اسم الفئة الإنجليزي يحتوي على نص عربي.';

  @override
  String get adminArabicNameWrongScript =>
      'يبدو أن اسم الفئة العربي يحتوي على نص إنجليزي فقط.';

  @override
  String get adminNameControlCharacters =>
      'لا يمكن أن تحتوي أسماء الفئات على محارف تحكم.';

  @override
  String get adminNamePunctuationBoundary =>
      'لا يمكن أن يبدأ اسم الفئة أو ينتهي بعلامة ترقيم.';

  @override
  String get adminNameRepeatedWords => 'تجنب تكرار الكلمة نفسها بشكل متتالٍ.';

  @override
  String get adminNameDescriptionLike =>
      'يبدو هذا وصفًا كاملاً وليس اسم فئة مختصرًا.';

  @override
  String get adminNamesAppearIdentical =>
      'الاسمان متطابقان. تأكد أن هذا المصطلح يُستخدم بالشكل نفسه في اللغتين.';

  @override
  String get adminConfirmSharedTechnicalTerm =>
      'أؤكد أن استخدام هذا المصطلح التقني نفسه في اللغتين مقصود.';

  @override
  String get adminSharedNameAcknowledgementRequired =>
      'أكد أن هذا المصطلح التقني يُستخدم عن قصد بالشكل نفسه في اللغتين.';

  @override
  String get adminNameUnusuallyLong => 'هذا الاسم طويل بشكل غير معتاد لفئة.';

  @override
  String get adminEnglishNameCasingWarning =>
      'راجع كتابة الأحرف الكبيرة في الاسم الإنجليزي؛ تستخدم فئات المتجر عادةً نمط العناوين.';

  @override
  String get adminRepeatedWhitespaceWarning =>
      'سيتم حفظ المسافات المتكررة كمسافة عادية واحدة.';

  @override
  String get adminMaterialTitleWarning =>
      'يبدو هذا اسم مادة محددة وليس اسم فئة قابلة لإعادة الاستخدام.';

  @override
  String get adminSimilarWordingWarning =>
      'هذه الصياغة مشابهة جدًا لفئة موجودة.';

  @override
  String get adminAssignMaterialFamily => 'تعيين عائلة المادة';

  @override
  String get adminChooseMaterialFamily => 'اختر عائلة مادة';

  @override
  String get adminSearchMaterialFamilies => 'ابحث في عائلات المواد';

  @override
  String get adminLoadingMaterialFamilies => 'جارٍ تحميل عائلات المواد…';

  @override
  String get adminFailedMaterialFamilies => 'تعذر تحميل عائلات المواد.';

  @override
  String get adminNoMaterialFamilies => 'لا توجد عائلات مواد نشطة متاحة.';

  @override
  String get adminMaterialFamilyRequired => 'عائلة المادة مطلوبة.';

  @override
  String get adminMaterialFamilyInactive => 'عائلة المادة المحددة غير نشطة.';

  @override
  String get adminTaxonomyConceptWrongType =>
      'مفهوم التصنيف المحدد ليس عائلة مادة.';

  @override
  String get adminMaterialFamilyNotFound =>
      'عائلة المادة المحددة لم تعد متاحة.';

  @override
  String get adminOwnershipHelper =>
      'اختر عائلة المادة المرجعية التي تمثل هذه الفئة الجديدة بأفضل شكل.';

  @override
  String get adminOwnershipExplanation =>
      'يربط هذا التعيين الفئة بنظام التصنيف والتوصيات.';

  @override
  String get adminOwnershipGuidance =>
      'راجع الفئات المشابهة ثم اختر عائلة المادة المناسبة قبل الموافقة.';

  @override
  String get adminApprovalSucceeded => 'تمت الموافقة على طلب الفئة.';

  @override
  String get adminCancel => 'إلغاء';

  @override
  String get adminConfirm => 'تأكيد';

  @override
  String get adminDone => 'تم';

  @override
  String get adminExport => 'تصدير';

  @override
  String get adminFormat => 'التنسيق';

  @override
  String get adminExcel => 'Excel';

  @override
  String get adminCsv => 'CSV';

  @override
  String get adminPdf => 'PDF';

  @override
  String get adminPrevious => 'السابق';

  @override
  String get adminNext => 'التالي';

  @override
  String get adminSearch => 'بحث';

  @override
  String get adminReset => 'إعادة تعيين';

  @override
  String get adminResetFilters => 'إعادة تعيين الفلاتر';

  @override
  String get adminActions => 'الإجراءات';

  @override
  String get adminView => 'عرض';

  @override
  String get adminViewDetails => 'عرض التفاصيل';

  @override
  String get adminInviteUser => 'دعوة مستخدم';

  @override
  String get adminSuspendAccount => 'تعليق الحساب';

  @override
  String get adminReactivateAccount => 'إعادة تفعيل الحساب';

  @override
  String adminSuspendAccountQuestion(String name) {
    return 'تعليق $name؟';
  }

  @override
  String get adminSuspendAccountBody =>
      'سيمنع ذلك المستخدم من تنفيذ الإجراءات المهمة، لكن بياناته وسجله سيبقيان محفوظين.';

  @override
  String get adminReasonRequired => 'السبب (مطلوب)';

  @override
  String get adminSuspensionReasonMinLength =>
      'يلزم سبب تعليق لا يقل عن 3 أحرف.';

  @override
  String get adminAccountSuspended => 'تم تعليق الحساب.';

  @override
  String adminReactivateAccountBody(String name) {
    return 'استعادة الوصول لـ $name؟ بياناته وسجله بقيا محفوظين أثناء التعليق.';
  }

  @override
  String get adminAccountReactivated => 'تمت إعادة تفعيل الحساب.';

  @override
  String get adminExportWebOnly => 'التصدير متاح على واجهة الإدارة للويب فقط.';

  @override
  String get adminNoUsersMatchFilters =>
      'لا يوجد مستخدمون يطابقون الفلاتر الحالية.';

  @override
  String get adminExportUsers => 'تصدير المستخدمين';

  @override
  String get adminNoProjectBuildsWithLearningData =>
      'لا توجد مشاريع بناء مع بيانات تعلم.';

  @override
  String get adminExportReservations => 'تصدير الحجوزات';

  @override
  String get adminNoReservationsMatchFilters =>
      'لا توجد حجوزات تطابق الفلاتر الحالية.';

  @override
  String get adminReservationDetails => 'تفاصيل الحجز';

  @override
  String get adminOpenReport => 'فتح البلاغ';

  @override
  String get adminOpenDelivery => 'فتح التوصيل';

  @override
  String get adminExportIncidentReports => 'تصدير بلاغات الحوادث';

  @override
  String get adminNoIncidentReportsMatchFilters =>
      'لا توجد بلاغات حوادث تطابق الفلاتر الحالية.';

  @override
  String get adminCouldNotLoadIncidentReports => 'تعذر تحميل بلاغات الحوادث.';

  @override
  String get adminExportMaterials => 'تصدير المواد';

  @override
  String get adminNoMaterialsMatchFilters =>
      'لا توجد مواد تطابق الفلاتر الحالية.';

  @override
  String get adminExportMaterialReports => 'تصدير بلاغات المواد';

  @override
  String get adminNoMaterialReportsMatchFilters =>
      'لا توجد بلاغات مواد تطابق الفلاتر الحالية.';

  @override
  String get adminSupplierVerificationDetails => 'تفاصيل التحقق من المورد';

  @override
  String get adminApproveSupplierVerificationQuestion =>
      'الموافقة على التحقق من المورد؟';

  @override
  String get adminRequestChanges => 'طلب تعديلات';

  @override
  String get adminApproveSupplierVerification =>
      'الموافقة على التحقق من المورد';

  @override
  String get sectionLearningSpotlightTitle => 'أضواء التعلم';

  @override
  String get sectionLearningSpotlightSubtitle =>
      'ابدأ بأدلة مشاريع مبنية من مواد قابلة لإعادة الاستخدام.';

  @override
  String get sectionLearningSpotlightEmpty => 'لا توجد مشاريع تعلم منشورة بعد';

  @override
  String get sectionLearningSpotlightEmptyDescription =>
      'عند نشر مشاريع التعلم، ستظهر الأدلة المميزة هنا.';

  @override
  String get sectionHomeSuggestedMaterialsTitle => 'مواد مقترحة';

  @override
  String get sectionHomeSuggestedMaterialsSubtitle =>
      'بعض المواد المدرجة حالياً لمساعدتك على البدء.';

  @override
  String get sectionHomeSuggestedMaterialsEmpty => 'لا توجد مواد متاحة بعد';

  @override
  String get sectionHomeSuggestedMaterialsEmptyDescription =>
      'عندما يدرج الموردون مواداً قابلة لإعادة الاستخدام، ستظهر مجموعة صغيرة هنا.';

  @override
  String get completeLearnerProfileTitle => 'أكمل ملف المتعلم';

  @override
  String get completeLearnerProfileSubtitle =>
      'ساعدنا في تخصيص المشاريع وتوصيات المواد.';

  @override
  String get registerLearnerProfileTitle => 'ملف المتعلم';

  @override
  String get registerSupplierProfileTitle => 'ملف المورد';

  @override
  String get registerBothProfilesHint =>
      'ستكمل تفاصيل المتعلم والمورد في الخطوات التالية.';

  @override
  String get registerFullNameLabel => 'الاسم الكامل';

  @override
  String get registerYourNameHint => 'اسمك';

  @override
  String get registerFullNameRequired => 'الاسم الكامل مطلوب';

  @override
  String get registerEmailAddressLabel => 'عنوان البريد الإلكتروني';

  @override
  String get registerPhoneOptionalLabel => 'رقم الهاتف (اختياري)';

  @override
  String get registerConfirmPasswordRequired => 'تأكيد كلمة المرور مطلوب';

  @override
  String get registerLearnerTypeTitle => 'نوع المتعلم';

  @override
  String get registerSkillLevelTitle => 'مستوى المهارة';

  @override
  String get registerReviewAccount => 'الحساب';

  @override
  String get registerReviewIntent => 'الهدف';

  @override
  String get registerReviewName => 'الاسم';

  @override
  String get registerReviewInterests => 'الاهتمامات';

  @override
  String get registerReviewGoals => 'الأهداف';

  @override
  String get registerReviewLocation => 'الموقع';

  @override
  String get registerReviewLearnerType => 'نوع المتعلم';

  @override
  String get registerReviewSkillLevel => 'مستوى المهارة';

  @override
  String get registerInterestsOptionalLabel => 'الاهتمامات (اختياري)';

  @override
  String get registerBioOptionalLabel => 'نبذة (اختياري)';

  @override
  String get registerSkillLevelHelper => 'ما مدى راحتك في بناء مشاريع التعلم؟';

  @override
  String get registerLearnerTypeRequired => 'نوع المتعلم مطلوب';

  @override
  String get registerSkillLevelRequired => 'مستوى المهارة مطلوب';

  @override
  String get registerSelectLearnerType => 'اختر نوع المتعلم';

  @override
  String get registerSelectSkillLevel => 'اختر مستوى المهارة';

  @override
  String get registerBioHint => 'أخبر الآخرين قليلاً عن أهدافك التعليمية';

  @override
  String get registerSupplierNextHint =>
      'بعد ذلك، سنساعدك في إعداد ملف المورد أيضاً.';

  @override
  String get authLearnLabel => 'تعلّم';

  @override
  String get authReuseLabel => 'أعد الاستخدام';

  @override
  String get authBuildLabel => 'ابنِ';

  @override
  String get authMaterialsReusedLabel => 'مواد أُعيد استخدامها';

  @override
  String get authProjectsLaunchedLabel => 'مشاريع أُطلقت';

  @override
  String get authRegistrationMovedTitle => 'تم نقل التسجيل';

  @override
  String get authRegistrationMovedSubtitle =>
      'يكمل ImpactLoop التسجيل الآن في مكان واحد. جارٍ توجيهك إلى معالج التسجيل…';

  @override
  String get authBrandTitle => 'ImpactLoop';

  @override
  String get authOnboardingStorySubtitle =>
      'انضم إلى منظومة إعادة استخدام يجد فيها المتعلمون المواد، ويشارك المورّدون الفائض، وتصبح المشاريع العملية أسهل في التنفيذ.';

  @override
  String get authOnboardingBenefitFindNearby =>
      'اعثر على مواد مفيدة بالقرب منك';

  @override
  String get authOnboardingBenefitShareSurplus =>
      'شارك المواد الفائضة بدلًا من إهدارها';

  @override
  String get authOnboardingBenefitBuildPractical =>
      'نفّذ مشاريع عملية بتكلفة أقل';

  @override
  String get homeSuggestedMaterialsLoadError => 'تعذر تحميل المواد المقترحة';

  @override
  String get homeSuggestedMaterialsLoadErrorSubtitle =>
      'الصفحة الرئيسية ما زالت متاحة. أعد المحاولة عندما يعمل واجهة برمجة المواد.';

  @override
  String get homeLearningSpotlightLoadError => 'تعذر تحميل مشاريع التعلم';

  @override
  String get homeLearningSpotlightLoadErrorSubtitle =>
      'الصفحة الرئيسية ما زالت متاحة. أعد المحاولة عندما يعمل واجهة برمجة مركز التعلم.';

  @override
  String get learningProjectCreator => 'صاحب المشروع';

  @override
  String get learningViewProfile => 'عرض الملف';

  @override
  String learningViewCreatorProfile(String name) {
    return 'عرض الملف العام لـ $name';
  }

  @override
  String get learningSearchProjectsHint =>
      'ابحث بالعنوان أو الملخص أو المكوّن أو صاحب المشروع';

  @override
  String get publicUserPublishedProjects => 'المشاريع المنشورة';

  @override
  String get publicUserNoPublishedProjects => 'لا توجد مشاريع منشورة بعد';

  @override
  String get publicUserNoPublishedProjectsBody =>
      'لم ينشر هذا المستخدم مشاريع عامة بعد.';

  @override
  String get publicUserSupplierActivity => 'نشاط المورد';

  @override
  String get publicUserViewSupplierProfile => 'عرض ملف المورد';

  @override
  String publicUserAvailableMaterials(int count) {
    return '$count مواد متاحة';
  }

  @override
  String get publicRoleLearner => 'متعلم';

  @override
  String get publicRoleSupplier => 'مورد';

  @override
  String get publicUserProfileUnavailable => 'الملف غير متاح';

  @override
  String get publicUserProfileUnavailableBody =>
      'قد لا يكون هذا الملف العام متاحاً بعد الآن.';

  @override
  String get phsNewRequest => 'طلب جلسة مساعدة';

  @override
  String get phsChooseProject => 'اختر المشروع';

  @override
  String get phsSearchEligibleProjects => 'ابحث بعنوان المشروع أو اسم صاحبه';

  @override
  String phsByCreator(String name) {
    return 'بواسطة $name';
  }
}
