import 'package:flutter/material.dart';

import '../../data/models/supplier_action_notification.dart';
import '../theme/supplier_locale_scope.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../../data/models/supplier_pickup_schedule_item.dart';

/// Supplier Portal UI strings (English / Arabic).
class SupplierL10n {
  SupplierL10n._(this._lang);

  final String _lang;

  bool get isArabic => _lang == 'ar';

  static SupplierL10n of(BuildContext context, [String? languageCode]) {
    final code = languageCode ??
        SupplierLocaleScope.maybeOf(context)?.languageCode ??
        Localizations.localeOf(context).languageCode;
    return SupplierL10n._(code);
  }

  String t(String en, String ar) => isArabic ? ar : en;

  // —— Brand / shell ——
  String get brandName => t('ImpactLoop', 'ImpactLoop');
  String get supplierRole => t('Supplier', 'مورد');
  String get supplierFallbackName => t('Supplier', 'مورد');
  String get supplierRoleSubtitle => t('Supplier role', 'دور المورد');

  // —— Navigation ——
  String get navOverview => t('Overview', 'نظرة عامة');
  String get navHome => t('Home', 'الرئيسية');
  String get navMyMaterials => t('My Materials', 'موادي');
  String get navMaterialsShort => t('Materials', 'المواد');
  String get navAddMaterial => t('Add Material', 'إضافة مادة');
  String get navAddShort => t('Add', 'إضافة');
  String get navIncomingRequests => t('Incoming Requests', 'الطلبات الواردة');
  String get navRequestsShort => t('Requests', 'الطلبات');
  String get navPickupSchedule => t('Pickup Schedule', 'جدول الاستلام');
  String get navBrowseMaterials => t('Browse Materials', 'تصفح المواد');
  String get navNotifications => t('Notifications', 'الإشعارات');
  String get navProfile => t('Profile', 'الملف الشخصي');
  String get navPortalFallback => t('Supplier Portal', 'بوابة المورد');

  // —— Settings ——
  String get themeLabel => t('Theme', 'المظهر');
  String get themeSystem => t('System', 'النظام');
  String get themeLight => t('Light', 'فاتح');
  String get themeDark => t('Dark', 'داكن');

  // —— Profile popover ——
  String get viewSupplierProfile => t('View supplier profile', 'عرض ملف المورد');
  String get logout => t('Logout', 'تسجيل الخروج');

  // —— Page subtitles ——
  String get subtitleOverview =>
      t('Track materials, requests, and impact.', 'تتبع المواد والطلبات والأثر.');
  String get subtitleAddMaterial => t(
        'List surplus materials for reuse by learners and makers.',
        'أدرج المواد الفائضة لإعادة استخدامها من قبل المتعلمين والصناع.',
      );
  String get subtitleProfile => t(
        'Manage public supplier details and pickup location.',
        'إدارة تفاصيل المورد العامة وموقع الاستلام.',
      );
  String get subtitleIncomingRequests => t(
        'Review learner requests and schedule pickups.',
        'راجع طلبات المتعلمين وحدد مواعيد الاستلام.',
      );
  String get subtitlePickupSchedule => t(
        'Track accepted pickups and upcoming handovers.',
        'تتبع عمليات الاستلام المقبولة والتسليمات القادمة.',
      );
  String get subtitleNotifications => t(
        'Review updates and actions that need your attention.',
        'راجع التحديثات والإجراءات التي تحتاج انتباهك.',
      );
  String get subtitleComingSoon =>
      t('Coming soon in the Supplier Portal.', 'قريباً في بوابة المورد.');
  String get subtitleDefault =>
      t('Manage your supplier activity.', 'إدارة نشاطك كمورد.');

  String get subtitleMyMaterials => t(
        'Manage your listed surplus materials.',
        'إدارة المواد الفائضة التي أدرجتها.',
      );

  String get myMaterialsTitle => navMyMaterials;
  String get myMaterialsSubtitle => subtitleMyMaterials;
  String get myMaterialsSearchHint =>
      t('Search your materials', 'ابحث في موادك');
  String get myMaterialsStatTotal => t('Total', 'الإجمالي');
  String get myMaterialsStatAvailable => t('Available', 'متاحة');
  String get myMaterialsStatPendingReserved =>
      t('Pending / Reserved', 'قيد الانتظار / محجوزة');
  String get myMaterialsStatReused => t('Reused', 'أعيد استخدامها');
  String get myMaterialsStatUnavailable => t('Unavailable', 'غير متاحة');
  String get myMaterialsEmptyTitle => t(
        'You have not listed any materials yet.',
        'لم تدرج أي مواد بعد.',
      );
  String get myMaterialsEmptySubtitle => t(
        'Share surplus materials with learners and makers from your workshop.',
        'شارك المواد الفائضة مع المتعلمين والصناع من ورشتك.',
      );
  String get myMaterialsEmptyCta =>
      t('Add your first material', 'أضف أول مادة');
  String get myMaterialsLoadError => t(
        'We could not load your materials.',
        'تعذّر تحميل موادك.',
      );
  String get myMaterialsFilteredEmptyTitle =>
      t('No materials match your filters.', 'لا توجد مواد مطابقة للتصفية.');
  String get myMaterialsFilteredEmptySubtitle => t(
        'Try clearing filters or adjusting your search.',
        'جرّب مسح التصفية أو تعديل البحث.',
      );
  String materialsResultCount(int count) => t(
        '$count material${count == 1 ? '' : 's'} shown',
        count == 1 ? 'مادة واحدة معروضة' : '$count مواد معروضة',
      );
  String get filterAvailable => t('Available', 'متاحة');
  String get filterPending => t('Pending', 'قيد الانتظار');
  String get filterReserved => t('Reserved', 'محجوزة');
  String get filterReused => t('Reused', 'أعيد استخدامها');
  String get filterUnavailable => t('Unavailable', 'غير متاحة');
  String get filterAllPrices => t('All prices', 'كل الأسعار');
  String get filterStatusLabel => t('Status', 'الحالة');
  String get filterPriceLabel => t('Price', 'السعر');
  String get filterCategory => t('Category', 'الفئة');
  String get filterAllCategories => t('All categories', 'كل الفئات');
  String get manageMaterial => t('Manage', 'إدارة');
  String get editListing => t('Edit', 'تعديل');
  String get editMaterialTitle => t('Edit material', 'تعديل المادة');
  String get editMaterialSubtitle => t(
        'Update safe listing details. Price and category changes require review.',
        'حدّث تفاصيل الإدراج الآمنة. تغييرات السعر والفئة تتطلب مراجعة.',
      );
  String get editMaterialReadOnlyHelper => t(
        'Price, category, location, and images are not editable here yet.',
        'السعر والفئة والموقع والصور غير قابلة للتعديل هنا بعد.',
      );
  String get materialUpdatedSuccess => t(
        'Material updated successfully.',
        'تم تحديث المادة بنجاح.',
      );
  String get materialUpdateFailed => t(
        'Could not update material. Please try again.',
        'تعذر تحديث المادة. يرجى المحاولة مرة أخرى.',
      );
  String get deleteMaterial => t('Delete', 'حذف');
  String get deleteMaterialTitle => t('Delete material?', 'حذف المادة؟');
  String get deleteMaterialBody => t(
        'This will remove the material from your listings. This action cannot be undone.',
        'سيؤدي هذا إلى إزالة المادة من إدراجاتك. لا يمكن التراجع عن هذا الإجراء.',
      );
  String get deleteMaterialConfirm => t('Delete', 'حذف');
  String get materialDeletedSuccess => t(
        'Material deleted successfully.',
        'تم حذف المادة بنجاح.',
      );
  String get deleteMaterialFailed => t(
        'Could not delete material. Please try again.',
        'تعذر حذف المادة. يرجى المحاولة مرة أخرى.',
      );
  String get deleteMaterialBlockedReused => t(
        'Reused materials cannot be deleted because they are part of reuse history.',
        'لا يمكن حذف المواد المعاد استخدامها لأنها جزء من سجل إعادة الاستخدام.',
      );
  String get deleteMaterialBlockedActiveRequests => t(
        'Cannot delete a material with active requests.',
        'لا يمكن حذف مادة لديها طلبات نشطة.',
      );
  String get deleteMaterialBlockedDefault => t(
        'This material cannot be deleted right now.',
        'لا يمكن حذف هذه المادة الآن.',
      );
  String get saveChanges => t('Save changes', 'حفظ التغييرات');
  String get readOnlyLabel => t('Read-only', 'للقراءة فقط');
  String get materialTypeLabel => t('Material type', 'نوع المادة');
  String get pickupNotesLabel => pickupNotes;
  String get suggestedUsesLabel => suggestedUses;
  String get editListingComingSoon => t(
        'Editing listings is coming soon.',
        'تعديل الإدراجات قريباً.',
      );
  String get previousPage => t('Previous', 'السابق');
  String get nextPage => t('Next', 'التالي');
  String paginationLabel(int page, int totalPages) =>
      t('Page $page of $totalPages', 'صفحة $page من $totalPages');
  String listedOn(String date) => t('Listed $date', 'أُدرج $date');
  String get materialNotFoundTitle =>
      t('Material not found', 'المادة غير موجودة');
  String get materialNotFoundSubtitle => t(
        'This listing may have been removed or is no longer available.',
        'ربما أُزيل هذا الإدراج أو لم يعد متاحاً.',
      );
  String get backToMyMaterials =>
      t('Back to My Materials', 'العودة إلى موادي');
  String get viewsLabel => t('Views', 'المشاهدات');
  String get createdLabel => t('Created', 'تاريخ الإنشاء');
  String get updatedLabel => t('Updated', 'تاريخ التحديث');

  String pageTitle(String location) {
    if (location == '/supplier/materials/new') return navAddMaterial;
    if (location == '/supplier' || location == '/supplier/') return navOverview;
    if (location == '/supplier/profile') {
      return t('Supplier Profile', 'ملف المورد');
    }
    if (location == '/supplier/reservations' ||
        location.startsWith('/supplier/reservations/')) {
      return navIncomingRequests;
    }
    if (location == '/supplier/pickup-schedule' ||
        location.startsWith('/supplier/pickup-schedule/')) {
      return navPickupSchedule;
    }
    if (location == '/supplier/notifications' ||
        location.startsWith('/supplier/notifications/')) {
      return navNotifications;
    }
    if (location == '/supplier/materials') return navMyMaterials;
    if (location.endsWith('/edit') && location.startsWith('/supplier/materials/')) {
      return editMaterialTitle;
    }
    if (location.startsWith('/supplier/materials')) return navMyMaterials;
    return navPortalFallback;
  }

  String pageSubtitle(String location) {
    if (location == '/supplier/materials/new') return subtitleAddMaterial;
    if (location == '/supplier' || location == '/supplier/') {
      return subtitleOverview;
    }
    if (location == '/supplier/profile') return subtitleProfile;
    if (location == '/supplier/reservations' ||
        location.startsWith('/supplier/reservations/')) {
      return subtitleIncomingRequests;
    }
    if (location == '/supplier/pickup-schedule' ||
        location.startsWith('/supplier/pickup-schedule/')) {
      return subtitlePickupSchedule;
    }
    if (location == '/supplier/notifications' ||
        location.startsWith('/supplier/notifications/')) {
      return subtitleNotifications;
    }
    if (location == '/supplier/materials') return subtitleMyMaterials;
    if (location.endsWith('/edit') && location.startsWith('/supplier/materials/')) {
      return editMaterialSubtitle;
    }
    return subtitleDefault;
  }

  // —— Common actions ——
  String get tryAgain => t('Try again', 'حاول مجدداً');
  String get save => t('Save', 'حفظ');
  String get cancel => t('Cancel', 'إلغاء');
  String get back => t('Back', 'رجوع');
  String get backToDashboard => t('Back to dashboard', 'العودة للوحة التحكم');
  String get backToHome => t('Back to home', 'العودة للرئيسية');
  String get accept => t('Accept', 'قبول');
  String get decline => t('Decline', 'رفض');
  String get loading => t('Loading…', 'جاري التحميل…');
  String get required => t('Required', 'مطلوب');
  String get optional => t('Optional', 'اختياري');
  String get free => t('Free', 'مجاني');
  String get paid => t('Paid', 'مدفوع');
  String get comingSoon => t('Coming soon', 'قريباً');

  // —— Dashboard ——
  String get dashboardWelcome => t('Welcome back', 'مرحباً بعودتك');
  String dashboardWelcomeName(String name) =>
      t('Welcome back, $name', 'مرحباً بعودتك، $name');
  String get dashboardHeroSubtitle => t(
        'Track your materials, respond to requests, and grow reuse impact.',
        'تتبع موادك، رد على الطلبات، ونمِّ أثر إعادة الاستخدام.',
      );
  String get addMaterial => t('Add material', 'إضافة مادة');
  String get viewRequests => t('View requests', 'عرض الطلبات');
  String get statActiveMaterials => t('Active materials', 'المواد النشطة');
  String get statPendingRequests => t('Pending requests', 'الطلبات المعلقة');
  String get statScheduledPickups =>
      t('Scheduled pickups', 'عمليات الاستلام المجدولة');
  String get statReusedMaterials => t('Reused materials', 'المواد المعاد استخدامها');
  String get operationsSnapshot => t('Operations snapshot', 'لمحة تشغيلية');
  String get reservationStatus => t('Reservation status', 'حالة الحجوزات');
  String get materialsStatus => t('Materials status', 'حالة المواد');
  String get quickActions => t('Quick actions', 'إجراءات سريعة');
  String get recentActivity => t('Recent activity', 'النشاط الأخير');
  String get recentActivitySubtitle => t(
        'Curated highlights from your latest operations',
        'أبرز ما حدث في عملياتك الأخيرة',
      );
  String get viewAllActivity => t('View all activity', 'عرض كل النشاط');
  String get actionableInsights => t('Actionable insights', 'رؤى قابلة للتنفيذ');
  String get actionableInsightsSubtitle => t(
        'Recommended next steps based on your current supplier activity.',
        'الخطوات التالية الموصى بها بناءً على نشاطك الحالي.',
      );
  String get requestsNeedAttention =>
      t('Requests need attention', 'الطلبات تحتاج انتباهك');
  String pendingRequestsMessage(int count) => t(
        'You have $count pending reservation${count == 1 ? '' : 's'} waiting for a response.',
        'لديك $count ${count == 1 ? 'حجز معلق' : 'حجوزات معلقة'} بانتظار ردك.',
      );
  String get noPendingRequests =>
      t('No pending requests right now.', 'لا توجد طلبات معلقة حالياً.');
  String get reviewRequests => t('Review requests', 'مراجعة الطلبات');
  String get pickupReadiness => t('Pickup readiness', 'جاهزية الاستلام');
  String get pickupLocationSet => t(
        'Pickup location is set. Self pickup is enabled.',
        'موقع الاستلام محدد. الاستلام الذاتي مفعّل.',
      );
  String get pickupLocationMissing => t(
        'Add or confirm your pickup location so learners know where to collect materials.',
        'أضف أو أكّد موقع الاستلام ليعرف المتعلمون مكان الاستلام.',
      );
  String get completeProfileForPickup => t(
        'Complete your supplier profile and pickup location to start accepting requests.',
        'أكمل ملف المورد وموقع الاستلام لبدء قبول الطلبات.',
      );
  String get updateProfile => t('Update profile', 'تحديث الملف');
  String get growReuse => t('Grow reuse', 'نمِّ إعادة الاستخدام');
  String get growReuseActiveListings => t(
        'You have active listings ready for learners. Completed pickups will increase reuse impact.',
        'لديك قوائم نشطة جاهزة للمتعلمين. الاستلام المكتمل يزيد أثر إعادة الاستخدام.',
      );
  String get growReuseStarting => t(
        'Reuse activity is starting. Keep materials updated to improve requests.',
        'بدأ نشاط إعادة الاستخدام. حدّث المواد لتحسين الطلبات.',
      );
  String get growReuseEmpty => t(
        'List materials to start building reuse impact when learners complete pickups.',
        'أدرج مواد لبدء بناء أثر إعادة الاستخدام عند اكتمال الاستلام.',
      );
  String get viewMaterials => t('View materials', 'عرض المواد');
  String get allCaughtUp => t(
        'All caught up. New learner requests and pickup updates will appear here.',
        'كل شيء محدّث. ستظهر طلبات المتعلمين وتحديثات الاستلام هنا.',
      );
  String get noRecentActivity =>
      t('No recent activity yet.', 'لا يوجد نشاط حديث بعد.');
  String get addFirstMaterial =>
      t('Add your first material', 'أضف مادتك الأولى');
  String get checkNotifications =>
      t('Check notifications', 'تحقق من الإشعارات');
  String get openPickupSchedule =>
      t('Open pickup schedule', 'فتح جدول الاستلام');
  String get editProfile => t('Edit profile', 'تعديل الملف');
  String get supplierHub => t('Supplier Hub', 'مركز المورد');
  String get heroTagline => t(
        'Share unused parts, reduce waste, and help learners build faster.',
        'شارك القطع غير المستخدمة، قلّل الهدر، وساعد المتعلمين على البناء أسرع.',
      );
  String pickupLine(String city, String? area) => area == null
      ? t('Pickup: $city', 'الاستلام: $city')
      : t('Pickup: $city, $area', 'الاستلام: $city، $area');
  String get noMaterialsListedYet =>
      t('No materials listed yet', 'لا توجد مواد مدرجة بعد');
  String get noMaterialsListedSubtitle => t(
        'Start by sharing unused parts, project leftovers, or surplus components.',
        'ابدأ بمشاركة القطع غير المستخدمة أو مخلفات المشاريع أو المكونات الفائضة.',
      );
  String get completeSupplierProfileTitle => t(
        'Complete your supplier profile',
        'أكمل ملف المورد',
      );
  String get completeSupplierProfileSubtitle => t(
        'Add your public supplier name and pickup location before listing materials.',
        'أضف اسم المورد العام وموقع الاستلام قبل إدراج المواد.',
      );
  String get completeProfile => t('Complete profile', 'إكمال الملف');
  String get dashboardLoadError => t(
        'We could not load your supplier dashboard.',
        'تعذّر تحميل لوحة تحكم المورد.',
      );
  String get dashboardLoadErrorMessage => t(
        'Please check your connection and try again.',
        'يرجى التحقق من الاتصال والمحاولة مجدداً.',
      );
  String get reuseImpact => t('Reuse impact', 'أثر إعادة الاستخدام');
  String reusedMaterialsSummary(int count, String quantity) => t(
        '$count reused · $quantity units',
        '$count معاد استخدامها · $quantity وحدة',
      );
  String get reuseImpactNote => t(
        'Impact is calculated from completed reuse data.',
        'يُحسب الأثر من بيانات إعادة الاستخدام المكتملة.',
      );
  String get noReviewsYet => t('No reviews yet', 'لا توجد مراجعات بعد');
  String get ratingLabel => t('Rating', 'التقييم');
  String reviewsCount(int count) =>
      t('$count reviews', '$count مراجعة');
  String get materialLifecycle => t('Material lifecycle', 'دورة حياة المادة');
  String get lifecycleListed => t('Listed', 'مدرجة');
  String get lifecycleAvailable => t('Available', 'متاحة');
  String get lifecycleReserved => t('Reserved', 'محجوزة');
  String get lifecycleReused => t('Reused', 'معاد استخدامها');

  // —— Notifications ——
  String get notificationsTitle => navNotifications;
  String get actionNeeded => t('Action needed', 'يتطلب إجراء');
  String get filterAll => t('All', 'الكل');
  String get filterReservations => t('Reservations', 'الحجوزات');
  String get filterCompleted => t('Completed', 'مكتمل');
  String get noNotificationsYet =>
      t('No notifications yet.', 'لا توجد إشعارات بعد.');
  String noFilterNotifications(String filterLabel) => t(
        'No $filterLabel notifications.',
        'لا توجد إشعارات $filterLabel.',
      );
  String get loadingNotifications =>
      t('Loading notifications…', 'جاري تحميل الإشعارات…');
  String get notificationsLoadError => t(
        'We could not load notifications.',
        'تعذّر تحميل الإشعارات.',
      );
  String get noActionAvailable => t(
        'No action available for this item.',
        'لا يوجد إجراء متاح لهذا العنصر.',
      );
  String get couldNotOpenListing => t(
        'Could not open listing. Try again from Notifications.',
        'تعذّر فتح الإدراج. حاول مجدداً من الإشعارات.',
      );
  String notificationFilterLabel(SupplierNotificationFilter filter) {
    return switch (filter) {
      SupplierNotificationFilter.all => filterAll,
      SupplierNotificationFilter.actionNeeded => actionNeeded,
      SupplierNotificationFilter.reservations => filterReservations,
      SupplierNotificationFilter.completed => filterCompleted,
    };
  }

  String notificationStatusLabel(SupplierActionNotificationStatus status) {
    return switch (status) {
      SupplierActionNotificationStatus.approved => t('Approved', 'موافق عليه'),
      SupplierActionNotificationStatus.rejected => t('Rejected', 'مرفوض'),
      SupplierActionNotificationStatus.pending => t('Pending', 'معلق'),
    };
  }

  String notificationTypeLabel(SupplierActionNotificationKind kind) {
    if (kind == SupplierActionNotificationKind.reservationPending) {
      return t('Reservation', 'حجز');
    }
    if (kind.name.startsWith('price')) return t('Price', 'السعر');
    return t('Category', 'الفئة');
  }

  String get notificationCompleted => filterCompleted;
  String maxPriceLabel(double max, String unit) =>
      t('Max ${max.toStringAsFixed(0)} NIS/$unit', 'الحد ${max.toStringAsFixed(0)} ₪/$unit');

  String get editListingAction => t('Edit listing', 'تعديل الإدراج');
  String get editPriceAction => t('Edit price', 'تعديل السعر');
  String get reviewRequestAction => t('Review request', 'مراجعة الطلب');

  String notificationActionLabel(
    SupplierActionNotificationActionType? actionType, {
    String? fallback,
  }) {
    if (actionType != null) {
      return switch (actionType) {
        SupplierActionNotificationActionType.continueListing =>
          continueListing,
        SupplierActionNotificationActionType.editListing => editListingAction,
        SupplierActionNotificationActionType.editPrice => editPriceAction,
        SupplierActionNotificationActionType.reviewRequest =>
          reviewRequestAction,
      };
    }
    return fallback ?? '';
  }

  String get heroChipSupplierActive =>
      t('Supplier active', 'المورد نشط');
  String get heroChipPickupEnabled =>
      t('Pickup enabled', 'الاستلام مفعّل');
  String get heroChipNisListings =>
      t('NIS listings', 'إدراجات بالشيكل');
  String get chartReservationSubtitle => t(
        'Pending, accepted, and completed requests',
        'الطلبات المعلقة والمقبولة والمكتملة',
      );
  String get chartMaterialsSubtitle => t(
        'Inventory breakdown across lifecycle states',
        'تفصيل المخزون عبر حالات دورة الحياة',
      );
  String get statHelperAcceptedPickups =>
      t('Accepted pickups', 'عمليات الاستلام المقبولة');
  String get statHelperCompletedReuse =>
      t('Completed reuse', 'إعادة الاستخدام المكتملة');
  String get quickActionPickupCaption =>
      t('Accepted handovers', 'التسليمات المقبولة');
  String get reservationChartEmpty => t(
        'Reservation activity will appear here once requests arrive.',
        'سيظهر نشاط الحجوزات هنا عند وصول الطلبات.',
      );
  String get materialsChartAvailable => t('Available', 'متاحة');
  String get materialsChartReservedPending =>
      t('Reserved / pending', 'محجوزة / معلقة');
  String get materialsChartUnavailable =>
      t('Unavailable', 'غير متاحة');
  String get materialsChartEmpty => t(
        'Material status breakdown will appear after your first listing.',
        'سيظهر تفصيل حالة المواد بعد أول إدراج.',
      );
  String get recentActivityPendingTitle =>
      t('Pending request waiting', 'طلب معلق بانتظار الرد');
  String get recentActivityNextPickup =>
      t('Next scheduled pickup', 'عملية الاستلام المجدولة التالية');
  String recentActivityAcceptedPickup(String name) => t(
        'Accepted pickup with $name',
        'استلام مقبول مع $name',
      );
  String get recentActivityLatestReuse =>
      t('Latest completed reuse', 'أحدث إعادة استخدام مكتملة');
  String get chooseSupplierType =>
      t('Choose supplier type', 'اختر نوع المورد');
  String get dragPhotosHint => t(
        'Drag photos here or choose from your device',
        'اسحب الصور هنا أو اختر من جهازك',
      );
  String get materialCouldNotBeListed => t(
        'Material could not be listed.',
        'تعذّر إدراج المادة.',
      );
  String get chooseCategoryFirst =>
      t('Choose a category first.', 'اختر فئة أولاً.');
  String get enterMaterialNameFirst =>
      t('Enter a material name first.', 'أدخل اسم المادة أولاً.');
  String get enterValidQuantityPrice => t(
        'Enter a valid quantity and price.',
        'أدخل كمية وسعراً صالحين.',
      );
  String get priceReviewRequestFailed => t(
        'Price review request failed.',
        'فشل طلب مراجعة السعر.',
      );
  String get savedDraftNotFound => t(
        'Saved listing draft was not found.',
        'لم تُعثر على مسودة الإدراج المحفوظة.',
      );
  String get categoryApprovedContinue => t(
        'Category approved. Continue your listing.',
        'تمت الموافقة على الفئة. تابع إدراجك.',
      );
  String get continueEditingDraft => t(
        'Continue editing your saved listing draft.',
        'تابع تعديل مسودة الإدراج المحفوظة.',
      );
  String get continueListingFromDraft => t(
        'Continue your listing from where you stopped.',
        'تابع إدراجك من حيث توقفت.',
      );
  String get categoryRequestSubmittedWithApproval => t(
        'Category request submitted. Your listing draft was saved. You can continue after admin approval.',
        'تم إرسال طلب الفئة. حُفظت مسودة الإدراج. يمكنك المتابعة بعد موافقة المسؤول.',
      );
  String get categoryRequestSubmitted => t(
        'Category request submitted. Your listing draft was saved.',
        'تم إرسال طلب الفئة. حُفظت مسودة الإدراج.',
      );
  String get priceReviewSubmitted => t(
        'Price review submitted. A Gemini-assisted price suggestion was generated for admin review.',
        'تم إرسال مراجعة السعر. تم إنشاء اقتراح سعر بمساعدة Gemini لمراجعة المسؤول.',
      );
  String priceVerificationFailed(String error) => t(
        'Price verification failed: $error',
        'فشل التحقق من السعر: $error',
      );
  String get submitPriceReview =>
      t('Submit price review', 'إرسال مراجعة السعر');
  String get clarifyMaterialName => t(
        'Please clarify the material name',
        'يرجى توضيح اسم المادة',
      );
  String get didYouMeanThese =>
      t('Did you mean one of these?', 'هل تقصد أحد هذه؟');
  String matchedPriceReference(String label) => t(
        'Matched price reference: $label',
        'مرجع السعر المطابق: $label',
      );
  String maxAllowedUnitPriceMessage(
    String symbol,
    String price,
    String? unit,
  ) =>
      unit == null
          ? t(
              'Maximum allowed unit price: $symbol$price',
              'الحد الأقصى لسعر الوحدة: $symbol$price',
            )
          : t(
              'Maximum allowed unit price: $symbol$price per $unit',
              'الحد الأقصى لسعر الوحدة: $symbol$price لكل $unit',
            );
  String approvedUnitLabel(String unit) =>
      t('Approved unit: $unit', 'الوحدة المعتمدة: $unit');
  String get priceReviewRequiredMessage => t(
        'Price review is required before paid publishing. A Gemini-assisted price suggestion will be generated for admin review.',
        'مراجعة السعر مطلوبة قبل النشر المدفوع. سيُنشأ اقتراح سعر بمساعدة Gemini لمراجعة المسؤول.',
      );
  String priceBlockedReason(String reason) => switch (reason) {
        'PRICE_TOO_HIGH' => t(
            'Price is above the allowed limit',
            'السعر أعلى من الحد المسموح',
          ),
        _ => t('Price blocked', 'السعر محظور'),
      };
  String get myMaterialsPopover =>
      t('My materials', 'موادي');
  String get incomingRequestsPopover =>
      t('Incoming requests', 'الطلبات الواردة');
  String get statHelperVisibleToLearners => t(
        'Currently visible to learners',
        'ظاهرة حالياً للمتعلمين',
      );
  String get statHelperWaitingResponse => t(
        'Waiting for your response',
        'بانتظار ردك',
      );
  String get statActionBadge => t('Action', 'إجراء');
  String get totalLabel => t('Total', 'الإجمال');
  String get pickupChip => t('Pickup', 'استلام');
  String pendingRequestsNeedResponse(int count) => t(
        '$count request${count == 1 ? '' : 's'} need your response.',
        count == 1
            ? 'طلب واحد يحتاج ردك.'
            : '$count طلبات تحتاج ردك.',
      );
  String completedReservationsSummary(int count) => t(
        '$count reservation${count == 1 ? '' : 's'} completed successfully.',
        count == 1
            ? 'اكتمل حجز واحد بنجاح.'
            : 'اكتمل $count حجوزات بنجاح.',
      );
  String get quickActionListParts =>
      t('List reusable parts', 'أدرج قطعاً قابلة لإعادة الاستخدام');
  String get quickActionRespondLearners =>
      t('Respond to learners', 'رد على المتعلمين');
  String get quickActionUpdatesActions =>
      t('Updates & actions', 'التحديثات والإجراءات');
  String get signedOutLocallyMessage => t(
        'You were signed out locally, but the server could not be reached.',
        'تم تسجيل خروجك محلياً، لكن تعذّر الوصول إلى الخادم.',
      );

  // —— Incoming requests ——
  String get incomingRequestsTitle => navIncomingRequests;
  String get loadingRequests =>
      t('Loading incoming requests…', 'جاري تحميل الطلبات الواردة…');
  String get requestsLoadError =>
      t('We could not load requests.', 'تعذّر تحميل الطلبات.');
  String get requestAccepted => t('Request accepted.', 'تم قبول الطلب.');
  String get requestAcceptFailed =>
      t('Could not accept the request.', 'تعذّر قبول الطلب.');
  String get requestDeclined => t('Request declined.', 'تم رفض الطلب.');
  String get requestDeclineFailed =>
      t('Could not decline the request.', 'تعذّر رفض الطلب.');
  String get pickupCompleted =>
      t('Pickup marked as completed.', 'تم تحديد الاستلام كمكتمل.');
  String get pickupCompleteFailed => t(
        'Could not mark pickup as completed.',
        'تعذّر تحديد الاستلام كمكتمل.',
      );
  String get tabPending => t('Pending', 'معلق');
  String get tabAccepted => t('Accepted', 'مقبول');
  String get tabDeclined => t('Declined', 'مرفوض');
  String get tabCompleted => filterCompleted;
  String get noRequests => t('No requests yet.', 'لا توجد طلبات بعد.');
  String get noRequestsForFilter => t(
        'No requests match this filter.',
        'لا توجد طلبات تطابق هذا الفلتر.',
      );
  String get noPendingRequestsTitle =>
      t('No pending requests', 'لا توجد طلبات معلقة');
  String get noAcceptedPickupsTitle =>
      t('No accepted pickups yet.', 'لا توجد عمليات استلام مقبولة بعد.');
  String get noDeclinedRequestsTitle =>
      t('No declined requests.', 'لا توجد طلبات مرفوضة.');
  String get noCompletedPickupsTitle =>
      t('No completed pickups yet.', 'لا توجد عمليات استلام مكتملة بعد.');
  String get noPendingRequestsSubtitle => t(
        'New learner requests will appear here.',
        'ستظهر طلبات المتعلمين الجديدة هنا.',
      );
  String get noAcceptedPickupsSubtitle => t(
        'Accepted requests with pickup windows will show here.',
        'ستظهر الطلبات المقبولة مع مواعيد الاستلام هنا.',
      );
  String get noDeclinedRequestsSubtitle => t(
        'Requests you decline will be listed here.',
        'ستُدرج الطلبات التي ترفضها هنا.',
      );
  String get noCompletedPickupsSubtitle => t(
        'Finished pickups will appear here.',
        'ستظهر عمليات الاستلام المنتهية هنا.',
      );
  String get noLearnerNote =>
      t('No learner note.', 'لا توجد ملاحظة من المتعلم.');
  String get selfPickup => t('Self pickup', 'استلام ذاتي');
  String pickupWindowLabel(String window) =>
      t('Pickup: $window', 'الاستلام: $window');

  String incomingRequestTabLabel(SupplierIncomingRequestTab tab) =>
      switch (tab) {
        SupplierIncomingRequestTab.pending => tabPending,
        SupplierIncomingRequestTab.accepted => tabAccepted,
        SupplierIncomingRequestTab.declined => tabDeclined,
        SupplierIncomingRequestTab.completed => tabCompleted,
      };

  String incomingRequestEmptyTitle(SupplierIncomingRequestTab tab) =>
      switch (tab) {
        SupplierIncomingRequestTab.pending => noPendingRequestsTitle,
        SupplierIncomingRequestTab.accepted => noAcceptedPickupsTitle,
        SupplierIncomingRequestTab.declined => noDeclinedRequestsTitle,
        SupplierIncomingRequestTab.completed => noCompletedPickupsTitle,
      };

  String incomingRequestEmptySubtitle(SupplierIncomingRequestTab tab) =>
      switch (tab) {
        SupplierIncomingRequestTab.pending => noPendingRequestsSubtitle,
        SupplierIncomingRequestTab.accepted => noAcceptedPickupsSubtitle,
        SupplierIncomingRequestTab.declined => noDeclinedRequestsSubtitle,
        SupplierIncomingRequestTab.completed => noCompletedPickupsSubtitle,
      };

  String incomingRequestStatusLabel(SupplierIncomingRequestStatus status) =>
      switch (status) {
        SupplierIncomingRequestStatus.pending => tabPending,
        SupplierIncomingRequestStatus.accepted => tabAccepted,
        SupplierIncomingRequestStatus.declined => tabDeclined,
        SupplierIncomingRequestStatus.completed => tabCompleted,
      };

  // —— Pickup schedule ——
  String get loadingPickupSchedule =>
      t('Loading pickup schedule…', 'جاري تحميل جدول الاستلام…');
  String get pickupScheduleLoadError => t(
        'We could not load pickup schedule.',
        'تعذّر تحميل جدول الاستلام.',
      );
  String get noPickupsScheduled =>
      t('No pickups scheduled yet.', 'لا توجد عمليات استلام مجدولة بعد.');
  String get noPickupsForFilter => t(
        'No pickups match this filter.',
        'لا توجد عمليات استلام تطابق هذا الفلتر.',
      );
  String get markCompleted => t('Mark completed', 'تحديد كمكتمل');
  String get viewDetails => t('View details', 'عرض التفاصيل');
  String get filterUpcoming => t('Upcoming', 'قادمة');
  String get filterPast => t('Past', 'سابقة');
  String get filterToday => t('Today', 'اليوم');
  String get scheduleDone => t('Done', 'منتهٍ');
  String get noPickupsToday =>
      t('No pickups scheduled for today.', 'لا توجد عمليات استلام مجدولة اليوم.');
  String get noUpcomingPickups =>
      t('No upcoming pickups.', 'لا توجد عمليات استلام قادمة.');
  String get noCompletedSchedulePickups =>
      t('No completed pickups yet.', 'لا توجد عمليات استلام مكتملة بعد.');
  String get noPickupScheduleYet =>
      t('No pickup schedule yet.', 'لا يوجد جدول استلام بعد.');

  String pickupScheduleFilterLabel(SupplierPickupScheduleFilter filter) =>
      switch (filter) {
        SupplierPickupScheduleFilter.today => filterToday,
        SupplierPickupScheduleFilter.upcoming => filterUpcoming,
        SupplierPickupScheduleFilter.completed => tabCompleted,
        SupplierPickupScheduleFilter.all => filterAll,
      };

  String pickupScheduleEmptyMessage(SupplierPickupScheduleFilter filter) =>
      switch (filter) {
        SupplierPickupScheduleFilter.today => noPickupsToday,
        SupplierPickupScheduleFilter.upcoming => noUpcomingPickups,
        SupplierPickupScheduleFilter.completed => noCompletedSchedulePickups,
        SupplierPickupScheduleFilter.all => noPickupScheduleYet,
      };

  String pickupScheduleStatusLabel(SupplierPickupScheduleStatus status) =>
      switch (status) {
        SupplierPickupScheduleStatus.accepted => tabAccepted,
        SupplierPickupScheduleStatus.completed => tabCompleted,
      };

  // —— Profile ——
  String get createProfile => t('Create your profile', 'أنشئ ملفك');
  String get editProfileTitle => t('Edit profile', 'تعديل الملف');
  String get profileIntro => t(
        'Update how learners discover you and where materials can be collected.',
        'حدّث كيف يكتشفك المتعلمون وأين يمكن جمع المواد.',
      );
  String get publicDetails => t('Public supplier details', 'تفاصيل المورد العامة');
  String get publicDetailsSubtitle => t(
        'These details appear on your public supplier profile.',
        'تظهر هذه التفاصيل في ملف المورد العام.',
      );
  String get publicName => t('Public supplier name', 'اسم المورد العام');
  String get publicNameHint =>
      t('How learners will see you', 'كيف سيراك المتعلمون');
  String get aboutMaterials => t('About your materials', 'عن موادك');
  String get aboutMaterialsHint =>
      t('Share the material types you usually offer.', 'شارك أنواع المواد التي تقدمها عادة.');
  String get defaultPickupArea => t('Default pickup area', 'منطقة الاستلام الافتراضية');
  String get defaultPickupSubtitle => t(
        'Use a general pickup area. Exact addresses stay hidden until needed.',
        'استخدم منطقة استلام عامة. العناوين الدقيقة تبقى مخفية حتى الحاجة.',
      );
  String get useCurrentLocation =>
      t('Use current location', 'استخدام الموقع الحالي');
  String get enterManually => t('Enter manually', 'إدخال يدوي');
  String get gettingLocation => t('Getting location…', 'جاري تحديد الموقع…');
  String get findingAddress => t('Finding address…', 'جاري البحث عن العنوان…');
  String get refreshLocation =>
      t('Refresh current location', 'تحديث الموقع الحالي');
  String get optionalAddressDetails =>
      t('Optional address details', 'تفاصيل العنوان (اختياري)');
  String get coordinatesSourceOfTruth => t(
        'Coordinates are the source of truth. These fields help learners find you.',
        'الإحداثيات هي المرجع. هذه الحقول تساعد المتعلمين في العثور عليك.',
      );
  String get country => t('Country', 'البلد');
  String get city => t('City', 'المدينة');
  String get area => t('Area', 'المنطقة');
  String get areaHint =>
      t('Neighborhood or district', 'الحي أو المنطقة');
  String get addressLine => t('Address line', 'سطر العنوان');
  String get addressHint => t(
        'Street or building (kept private)',
        'الشارع أو المبنى (يُحفظ بسرية)',
      );
  String get locationPrivacy => t('Location privacy', 'خصوصية الموقع');
  String get locationPrivacySubtitle => t(
        'Your exact pickup address stays private. Learners only see a general area until a reservation is accepted.',
        'عنوان الاستلام الدقيق يبقى خاصاً. يرى المتعلمون منطقة عامة فقط حتى قبول الحجز.',
      );
  String get locationVisibility => t('Location visibility', 'ظهور الموقع');
  String get visibilityPublic => t('Public area', 'منطقة عامة');
  String get visibilityOrderOnly => t('Order only', 'للطلبات فقط');
  String get visibilityPrivate => t('Private', 'خاص');
  String get showApproximate => t('Show as approximate', 'عرض كموقع تقريبي');
  String get showApproximateSubtitle => t(
        'Learners see a general area, not an exact pin.',
        'يرى المتعلمون منطقة عامة وليس موقعاً دقيقاً.',
      );
  String get organizationDetails =>
      t('Organization details', 'تفاصيل المؤسسة');
  String get organizationSubtitle => t(
        'For workshops, factories, and educational institutions only.',
        'للورش والمصانع والمؤسسات التعليمية فقط.',
      );
  String get organizationName => t('Organization name', 'اسم المؤسسة');
  String get organizationNameHint =>
      t('Legal or public organization name', 'الاسم القانوني أو العام للمؤسسة');
  String get contactPerson => t('Contact person', 'شخص الاتصال');
  String get contactPersonHint =>
      t('Optional contact name', 'اسم جهة الاتصال (اختياري)');
  String get saveProfile => t('Save profile', 'حفظ الملف');
  String get savingProfile => t('Saving…', 'جاري الحفظ…');
  String get supplierProfileTitle => t('Supplier Profile', 'ملف المورد');
  String get profileIntroHasProfile => t(
        'Keep your public supplier details accurate, trustworthy, and easy for learners to understand.',
        'حافظ على تفاصيل موردك العامة دقيقة وموثوقة وسهلة الفهم للمتعلمين.',
      );
  String get profileIntroNoProfile => t(
        'Create your supplier profile so learners know where and how to collect materials.',
        'أنشئ ملف المورد ليعرف المتعلمون أين وكيف يجمعون المواد.',
      );
  String get profileUnavailable =>
      t('Profile unavailable', 'الملف غير متاح');
  String get profileCouldNotSave =>
      t('Profile could not be saved.', 'تعذّر حفظ الملف.');
  String get profileUpdated =>
      t('Supplier profile updated', 'تم تحديث ملف المورد');
  String get captureLocationBeforeSave => t(
        'Please capture your current location before saving.',
        'يرجى تحديد موقعك الحالي قبل الحفظ.',
      );
  String get couldNotGetLocation => t(
        'Could not get current location. Please try again or enter it manually.',
        'تعذّر تحديد الموقع الحالي. حاول مجدداً أو أدخله يدوياً.',
      );
  String get currentLocationLabel =>
      t('Current location', 'الموقع الحالي');
  String get addressFoundFromLocation => t(
        'We found this address from your current location. Please review and edit if needed.',
        'وجدنا هذا العنوان من موقعك الحالي. راجعه وعدّله إن لزم.',
      );
  String get addressLookupFailed => t(
        'Current location captured, but address lookup failed. You can add city or area manually.',
        'تم تحديد الموقع الحالي، لكن فشل البحث عن العنوان. يمكنك إضافة المدينة أو المنطقة يدوياً.',
      );
  String get locationCapturedOptionalDetails => t(
        'Current location captured. You can optionally add city, area, or address details.',
        'تم تحديد الموقع الحالي. يمكنك إضافة المدينة أو المنطقة أو تفاصيل العنوان اختيارياً.',
      );
  String get chooseVisibility =>
      t('Choose visibility', 'اختر مستوى الظهور');
  String get workingDays => t('Working days', 'أيام العمل');
  String get workingDaysHint => t('Mon, Tue, Wed', 'الإثنين، الثلاثاء، الأربعاء');
  String get openFrom => t('Open from', 'يفتح من');
  String get openUntil => t('Open until', 'يغلق عند');
  String get separateBusinessLocation => t(
        'Use a separate business location',
        'استخدام موقع عمل منفصل',
      );
  String get separateBusinessLocationSubtitle => t(
        'Leave off to use your default pickup location.',
        'اتركه معطلاً لاستخدام موقع الاستلام الافتراضي.',
      );
  String get businessCountry => t('Business country', 'بلد العمل');
  String get businessCity => t('Business city', 'مدينة العمل');
  String get businessArea => t('Business area', 'منطقة العمل');
  String get businessAddressLine =>
      t('Business address line', 'سطر عنوان العمل');
  String get countryOptionalLabel =>
      t('Country (optional)', 'البلد (اختياري)');
  String get cityOptionalLabel => t('City (optional)', 'المدينة (اختياري)');
  String get areaOptionalLabel => t('Area (optional)', 'المنطقة (اختياري)');
  String get addressLineOptionalLabel =>
      t('Address line (optional)', 'سطر العنوان (اختياري)');
  String get optionalNeighborhoodOrDistrict => t(
        'Optional neighborhood or district',
        'الحي أو المنطقة (اختياري)',
      );
  String get optionalStreetOrBuilding => t(
        'Optional street or building',
        'الشارع أو المبنى (اختياري)',
      );

  // —— Add material (UI labels only) ——
  String get completeProfileFirst =>
      t('Complete your supplier profile first.', 'أكمل ملف المورد أولاً.');
  String get completeProfileFirstMessage => t(
        'Supplier details are required before you can publish reusable materials.',
        'تفاصيل المورد مطلوبة قبل نشر المواد القابلة لإعادة الاستخدام.',
      );
  String get goToProfile => t('Go to Supplier Profile', 'الذهاب لملف المورد');
  String get setPickupLocation => t(
        'Set your pickup location before listing materials.',
        'حدد موقع الاستلام قبل إدراج المواد.',
      );
  String get setPickupLocationMessage => t(
        'Pickup location comes from your Supplier Profile and is used for every material in this step.',
        'موقع الاستلام يأتي من ملف المورد ويُستخدم لكل مادة في هذه الخطوة.',
      );
  String get editSupplierProfile =>
      t('Edit Supplier Profile', 'تعديل ملف المورد');
  String get categoriesUnavailable =>
      t('Material categories are unavailable.', 'فئات المواد غير متاحة.');
  String get categoriesUnavailableMessage => t(
        'Please try again after the backend is reachable.',
        'يرجى المحاولة مجدداً عند توفر الخادم.',
      );
  String get profileLoadError =>
      t('Supplier profile could not load.', 'تعذّر تحميل ملف المورد.');
  String get profileLoadErrorMessage => t(
        'Please refresh or complete your profile first.',
        'يرجى التحديث أو إكمال ملفك أولاً.',
      );
  String get listingSectionTitle =>
      t('What are you listing?', 'ماذا تدرج؟');
  String get listingSectionSubtitle =>
      t('Describe the surplus material clearly.', 'صف المادة الفائضة بوضوح.');
  String get materialName => t('Material type/name', 'نوع/اسم المادة');
  String get materialNameHint =>
      t('Wax molds, Arduino Uno, fabric scraps...', 'قوالب شمع، Arduino Uno، بقايا قماش...');
  String get materialNameHelper => t(
        'Use the common material type or alias. We use this for matching and paid price checks.',
        'استخدم نوع المادة الشائع أو الاسم البديل. نستخدمه للمطابقة والتحقق من الأسعار المدفوعة.',
      );
  String get listingTitle => t('Listing title', 'عنوان الإدراج');
  String get listingTitleHint =>
      t('Used wax molds - 8 pieces', 'قوالب شمع مستعملة - 8 قطع');
  String get description => t('Description', 'الوصف');
  String get descriptionHint => t(
        'Describe condition, quantity, and what is included.',
        'صف الحالة والكمية وما يشمله العرض.',
      );
  String get sourceType => t('Source type', 'نوع المصدر');
  String get chooseSource => t('Choose source', 'اختر المصدر');
  String get condition => t('Condition', 'الحالة');
  String get chooseCondition => t('Choose condition', 'اختر الحالة');
  String get suggestedUses => t('Suggested uses', 'الاستخدامات المقترحة');
  String get suggestedUsesHint =>
      t('Candles, resin casting, craft projects.', 'شموع، صب راتنج، مشاريع حرفية.');
  String get categorySectionTitle => t('Category', 'الفئة');
  String get categorySectionSubtitle =>
      t('Choose the closest broad category.', 'اختر أقرب فئة عامة.');
  String get broadCategory => t('Broad category', 'الفئة العامة');
  String get chooseCategory => t('Choose category', 'اختر الفئة');
  String get categoryRequired =>
      t('Category is required', 'الفئة مطلوبة');
  String get publishMaterial => t('Publish material', 'نشر المادة');
  String get publishing => t('Publishing…', 'جاري النشر…');
  String get hideCategoryRequest =>
      t('Hide category request', 'إخفاء طلب الفئة');
  String get cannotFindCategory =>
      t('Cannot find your category?', 'لا تجد فئتك؟');
  String get categoryRequest => t('Category request', 'طلب فئة');
  String get categoryRequestMessage => t(
        'Send this category name to admin for approval. Your current listing form will be saved so you can continue later.',
        'أرسل اسم الفئة للمسؤول للموافقة. سيُحفظ نموذج الإدراج الحالي لتكمل لاحقاً.',
      );
  String get requestedCategoryName =>
      t('Requested category name', 'اسم الفئة المطلوبة');
  String get requestedCategoryHint =>
      t('Example: Candle Making Tools', 'مثال: أدوات صنع الشموع');
  String get sending => t('Sending…', 'جاري الإرسال…');
  String get sendCategoryRequest =>
      t('Send category request', 'إرسال طلب الفئة');
  String get freeOtherAllowed => t(
        'Free listings may use Other when no reviewed category fits.',
        'يمكن للإدراجات المجانية استخدام «أخرى» عندما لا تناسب فئة مراجعة.',
      );
  String get paidOtherBlockedMessage => t(
        'Paid listings cannot use Other. Use Cannot find your category? to request a reviewed category first.',
        'لا يمكن للإدراجات المدفوعة استخدام «أخرى». استخدم «لا تجد فئتك؟» لطلب فئة مراجعة أولاً.',
      );
  String get quantityAndPricing =>
      t('Quantity and pricing', 'الكمية والتسعير');
  String get quantityPricingSubtitle => t(
        'Enter the price for one unit. Quantity is handled separately.',
        'أدخل سعر الوحدة الواحدة. تُعالج الكمية بشكل منفصل.',
      );
  String get quantity => t('Quantity', 'الكمية');
  String get unit => t('Unit', 'الوحدة');
  String get unitHint => t('piece', 'قطعة');
  String get pricePerUnit => t('Price per unit (₪)', 'السعر لكل وحدة (₪)');
  String get verifyPrice => t('Verify price', 'التحقق من السعر');
  String maxPricePerUnitMessage(String unit, String max) => t(
        'Maximum allowed price per $unit is $max NIS.',
        'الحد الأقصى للسعر لكل $unit هو $max ₪.',
      );
  String get pickupSectionTitle => t('Pickup', 'الاستلام');
  String get pickupSectionSubtitle => t(
        'Pickup location comes from your Supplier Profile.',
        'موقع الاستلام يأتي من ملف المورد.',
      );
  String get pickupAllowed => t('Pickup allowed', 'الاستلام مسموح');
  String get pickupAllowedSubtitle => t(
        'Learners can request self pickup for this material.',
        'يمكن للمتعلمين طلب الاستلام الذاتي لهذه المادة.',
      );
  String get deliveryAllowed => t('Delivery allowed', 'التوصيل مسموح');
  String get deliveryAllowedSubtitle => t(
        'Delivery workflow is coming later.',
        'سير عمل التوصيل قادم لاحقاً.',
      );
  String get pickupNotes => t('Pickup notes', 'ملاحظات الاستلام');
  String get pickupNotesHint =>
      t('Pickup near campus.', 'الاستلام قرب الحرم الجامعي.');
  String get paidCannotUseOther => t(
        'Paid listings cannot use Other.',
        'لا يمكن للإدراجات المدفوعة استخدام «أخرى».',
      );
  String get paidMustVerifyPrice => t(
        'Paid listings must pass price verification before publishing.',
        'يجب أن تجتاز الإدراجات المدفوعة التحقق من السعر قبل النشر.',
      );
  String get policyBadgeNisOnly => t('NIS only', 'شيكل فقط');
  String get policyBadgeFreeOther =>
      t('Free Other allowed', '«أخرى» مجانية مسموحة');
  String get policyBadgePaidVerify => t(
        'Paid needs price verification',
        'المدفوع يحتاج تحققاً من السعر',
      );
  String get restoreDraftError => t(
        'Could not restore listing draft',
        'تعذّر استعادة مسودة الإدراج',
      );
  String get backToNotifications =>
      t('Back to Notifications', 'العودة للإشعارات');
  String get materialListedSuccess => t(
        'Material listed successfully.',
        'تم إدراج المادة بنجاح.',
      );
  String get addAnotherMaterial =>
      t('Add another material', 'إضافة مادة أخرى');
  String materialSummaryLine(String title, String category, String price) =>
      t('$title • $category • $price', '$title • $category • $price');

  String conditionLabel(String value) => switch (value) {
        'NEW' => t('New', 'جديد'),
        'LIKE_NEW' => t('Like new', 'كالجديد'),
        'GOOD' => t('Good', 'جيد'),
        'USED' => t('Used', 'مستعمل'),
        'NEEDS_REPAIR' => t('Needs repair', 'يحتاج إصلاح'),
        _ => value,
      };

  String sourceTypeLabel(String value) => switch (value) {
        'STUDENT_LEFTOVER' => t('Student leftover', 'فائض طلابي'),
        'WORKSHOP_SURPLUS' => t('Workshop surplus', 'فائض ورشة'),
        'FACTORY_SURPLUS' => t('Factory surplus', 'فائض مصنع'),
        'EDUCATIONAL_INSTITUTION' =>
          t('Educational institution', 'مؤسسة تعليمية'),
        _ => value,
      };

  String supplierTypeLabel(String value) {
    final normalized = value.trim().toUpperCase().replaceAll(' ', '_');
    return switch (normalized) {
      'INDIVIDUAL_SUPPLIER' || 'INDIVIDUAL' =>
        t('Individual supplier', 'مورد فردي'),
      'STUDENT_SUPPLIER' => t('Student supplier', 'مورد طالب'),
      'WORKSHOP' => t('Workshop', 'ورشة'),
      'FACTORY' => t('Factory', 'مصنع'),
      'EDUCATIONAL_INSTITUTION' =>
        t('Educational institution', 'مؤسسة تعليمية'),
      _ => value,
    };
  }

  String verificationStatusLabel(String value) => switch (value.toUpperCase()) {
        'VERIFIED' => t('Verified', 'موثّق'),
        'PENDING' => t('Pending verification', 'بانتظار التحقق'),
        'REJECTED' => t('Rejected', 'مرفوض'),
        'NOT_REQUIRED' => t('Not required', 'غير مطلوب'),
        _ => value,
      };

  // —— Shared widgets ——
  String get close => t('Close', 'إغلاق');
  String get supplierType => t('Supplier type', 'نوع المورد');
  String get pickupCountryCity =>
      t('Pickup country & city', 'بلد ومدينة الاستلام');
  String get listingPreview => t('Listing preview', 'معاينة الإدراج');
  String get profileCompletion => t('Profile completion', 'اكتمال الملف');
  String get selectedCoordinates =>
      t('Selected coordinates', 'الإحداثيات المحددة');
  String latitudeLabel(String value) =>
      t('Latitude: $value', 'خط العرض: $value');
  String longitudeLabel(String value) =>
      t('Longitude: $value', 'خط الطول: $value');
  String essentialsComplete(int complete, int total) => t(
        '$complete of $total essentials complete',
        '$complete من $total أساسيات مكتملة',
      );
  String get learnerPreview => t('Learner preview', 'معاينة المتعلم');
  String get learnerPreviewSubtitle => t(
        'How learners may discover your supplier profile later.',
        'كيف قد يكتشف المتعلمون ملف موردك لاحقاً.',
      );
  String get pickupAreaNotSet =>
      t('Pickup area not set', 'منطقة الاستلام غير محددة');
  String get defaultMaterialsDescription => t(
        'Shares reusable materials for student and maker projects.',
        'يشارك مواداً قابلة لإعادة الاستخدام لمشاريع الطلاب والصناع.',
      );
  String locationVisibilityLabel(String visibility) => t(
        'Location visibility: $visibility',
        'ظهور الموقع: $visibility',
      );
  String get yourPublicName => t('Your public name', 'اسمك العام');
  String visibilityCurrent(String value) =>
      t('Current: $value', 'الحالي: $value');
  String get verification => t('Verification', 'التحقق');
  String get verificationReadOnlyNote => t(
        'Verification is read-only for now. Document upload and review workflows will come later.',
        'التحقق للقراءة فقط حالياً. ستُضاف لاحقاً عمليات رفع المستندات والمراجعة.',
      );
  String get accountSecurity => t('Account Security', 'أمان الحساب');
  String get accountSecuritySubtitle =>
      t('Keep your account protected.', 'حافظ على حماية حسابك.');
  String get changePassword => t('Change password', 'تغيير كلمة المرور');
  String get changePasswordIntro => t(
        'Enter your current password, then choose a new one.',
        'أدخل كلمة المرور الحالية، ثم اختر كلمة مرور جديدة.',
      );
  String get currentPassword =>
      t('Current password', 'كلمة المرور الحالية');
  String get newPassword => t('New password', 'كلمة المرور الجديدة');
  String get confirmNewPassword =>
      t('Confirm new password', 'تأكيد كلمة المرور الجديدة');
  String get updatePassword => t('Update password', 'تحديث كلمة المرور');
  String get passwordUpdated => t(
        'Password updated successfully.',
        'تم تحديث كلمة المرور بنجاح.',
      );
  String get passwordUpdateFailed => t(
        'Password could not be updated. Please try again.',
        'تعذّر تحديث كلمة المرور. يرجى المحاولة مجدداً.',
      );
  String get fieldRequired =>
      t('This field is required', 'هذا الحقل مطلوب');
  String get passwordMinLength => t(
        'Password must be at least 8 characters.',
        'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.',
      );
  String get passwordMustDiffer => t(
        'New password must be different from your current password.',
        'يجب أن تختلف كلمة المرور الجديدة عن الحالية.',
      );
  String get passwordsDoNotMatch => t(
        'Passwords do not match.',
        'كلمتا المرور غير متطابقتين.',
      );
  String get upcomingPickups =>
      t('Upcoming pickups', 'عمليات الاستلام القادمة');
  String get recentMaterials => t('Recent materials', 'المواد الأخيرة');
  String get materialPhotos => t('Material photos', 'صور المادة');
  String get materialPhotosSubtitle => t(
        'Add 1 to 5 photos. JPG, PNG, or WebP.',
        'أضف من صورة إلى 5 صور. JPG أو PNG أو WebP.',
      );
  String get addAtLeastOneMaterialPhoto => t(
        'Add at least one material photo before publishing.',
        'أضف صورة واحدة على الأقل للمادة قبل النشر.',
      );
  String get selectedPhotos => t('Selected photos', 'الصور المحددة');
  String get addImages => t('Add images', 'إضافة صور');
  String get uploading => t('Uploading...', 'جاري الرفع...');
  String photosCount(int count, int max) =>
      t('$count/$max photos', '$count/$max صور');
  String get pickupDetails => t('Pickup details', 'تفاصيل الاستلام');
  String get completePickupTitle =>
      t('Mark pickup as completed?', 'تحديد الاستلام كمكتمل؟');
  String get completePickupMessage => t(
        'This will move the reservation to Completed and mark the material as reused.',
        'سينقل هذا الحجز إلى مكتمل ويحدد المادة كمعاد استخدامها.',
      );
  String get acceptRequest => t('Accept request', 'قبول الطلب');
  String get acceptRequestSubtitle => t(
        'Choose a pickup window for the learner.',
        'اختر نافذة استلام للمتعلم.',
      );
  String get declineRequest => t('Decline request', 'رفض الطلب');
  String get declineRequestSubtitle => t(
        'You can add an optional reason for the learner.',
        'يمكنك إضافة سبب اختياري للمتعلم.',
      );
  String get reasonOptional => t('Reason (optional)', 'السبب (اختياري)');
  String get pickupDate => t('Pickup date', 'تاريخ الاستلام');
  String get startTime => t('Start time', 'وقت البداية');
  String get endTime => t('End time', 'وقت النهاية');
  String get pickupNoteOptional =>
      t('Pickup note (optional)', 'ملاحظة الاستلام (اختياري)');
  String get tapToChoose => t('Tap to choose', 'اضغط للاختيار');
  String get priceVerified => t('Price verified', 'تم التحقق من السعر');
  String get verifyPriceBeforePublishing => t(
        'Verify price before publishing',
        'تحقق من السعر قبل النشر',
      );
  String get priceVerificationRequired => t(
        'Price verification required',
        'التحقق من السعر مطلوب',
      );
  String get categoryRequests => t('Category requests', 'طلبات الفئات');
  String approvedAs(String name) => t('Approved as $name', 'موافق عليه كـ $name');
  String get waitingAdminApproval => t(
        'Waiting for admin approval.',
        'بانتظار موافقة المسؤول.',
      );
  String get continueListing => t('Continue listing', 'متابعة الإدراج');
  String get defaultPickupLocation =>
      t('Default pickup location', 'موقع الاستلام الافتراضي');
  String get visibility => t('Visibility', 'الظهور');
  String get pickupLocation => t('Pickup location', 'موقع الاستلام');
  String visibilityLabel(String value) => switch (value) {
        'PUBLIC' => visibilityPublic,
        'ORDER_ONLY' => visibilityOrderOnly,
        'PRIVATE' => visibilityPrivate,
        _ => value,
      };
  String get locationCapturedShort =>
      t('Location captured', 'تم تحديد الموقع');
  String get noAreaSelectedYet =>
      t('No area selected yet', 'لم يُحدد موقع بعد');
  String visibilitySummary(String value) =>
      t('Visibility: $value', 'الظهور: $value');
  String pickupScheduleSummary(int today, int upcoming, int completed) => t(
        'Today: $today   Upcoming: $upcoming   Completed: $completed',
        'اليوم: $today   قادمة: $upcoming   مكتملة: $completed',
      );
  String requesterLabel(String name) =>
      t('Requester: $name', 'مقدم الطلب: $name');
  String qtyLabel(String qty) => t('Qty: $qty', 'الكمية: $qty');
  String viewsCount(int count) => t('$count views', '$count مشاهدة');
  String get price => t('Price', 'السعر');
  String get choosePickupDateAndTime => t(
        'Choose a pickup date and time window.',
        'اختر تاريخ استلام ونافذة زمنية.',
      );
  String get endTimeMustBeAfterStart => t(
        'End time must be after start time.',
        'يجب أن يكون وقت النهاية بعد وقت البداية.',
      );
  String get schedulePending => t('Schedule pending', 'الجدول معلق');
  String get upcomingPickupsEmpty => t(
        'Accepted reservations with pickup windows will show up here.',
        'ستظهر الحجوزات المقبولة مع نوافذ الاستلام هنا.',
      );
  String get recentMaterialsEmpty => t(
        'Recent listings will appear here after you add reusable materials.',
        'ستظهر الإدراجات الأخيرة هنا بعد إضافة مواد قابلة لإعادة الاستخدام.',
      );
  String get recentActivityEmpty => t(
        'Activity from reservations and notifications will collect here.',
        'سيجتمع هنا النشاط من الحجوزات والإشعارات.',
      );
  String get organizationProfile =>
      t('Organization profile', 'ملف المؤسسة');
  String get supplierProfileLabel =>
      t('Supplier profile', 'ملف المورد');
  String get pickupNoteHint => t(
        'Ring the workshop bell when you arrive.',
        'اضغط جرس الورشة عند وصولك.',
      );
  String get declineReasonHint => t(
        'Already reserved for another learner.',
        'محجوز لمُتعلم آخر.',
      );
  String get materialListingFoundationReady => t(
        'Material listing foundation ready',
        'أساس إدراج المواد جاهز',
      );
  String materialCategoriesLoaded(int count) => t(
        '$count material categories loaded.',
        'تم تحميل $count فئات مواد.',
      );
  String get loadingCategories =>
      t('Loading categories...', 'جاري تحميل الفئات...');
  String get categoriesCouldNotLoad => t(
        'Categories could not be loaded yet.',
        'تعذّر تحميل الفئات بعد.',
      );
  String get loadingListingPolicy =>
      t('Loading listing policy...', 'جاري تحميل سياسة الإدراج...');
  String get listingPolicyUnavailable =>
      t('Listing policy unavailable.', 'سياسة الإدراج غير متاحة.');
  String categoryRequestStatusLabel(String status) => switch (status) {
        'APPROVED' => t('Approved', 'موافق عليه'),
        'REJECTED' => t('Rejected', 'مرفوض'),
        _ => tabPending,
      };
  String get mapLocationHelp => t(
        'Use your current location or enter pickup details manually.',
        'استخدم موقعك الحالي أو أدخل تفاصيل الاستلام يدوياً.',
      );
  String get materialLabel => t('Material', 'المادة');
  String get learnerLabel => t('Learner', 'المتعلم');
  String get pickupTypeLabel => t('Pickup type', 'نوع الاستلام');
  String get statusLabel => t('Status', 'الحالة');
  String get dateLabel => t('Date', 'التاريخ');
  String get timeLabel => t('Time', 'الوقت');
  String get completedLabel => t('Completed', 'مكتمل');
  String get supplierNoteLabel => t('Supplier note', 'ملاحظة المورد');
  String get learnerMessageLabel => t('Learner message', 'رسالة المتعلم');
  String get coverPhoto => t('Cover', 'الغلاف');

  // —— Access denied ——
  String get accessDenied => t('Access denied', 'الوصول مرفوض');
  String get accessDeniedMessage => t(
        'You need a supplier account to access this area.',
        'تحتاج حساب مورد للوصول إلى هذه المنطقة.',
      );
  String get supplierAccessRequired =>
      t('Supplier access required', 'مطلوب وصول المورد');
  String get supplierAccessRequiredMessage => t(
        'You need a Supplier role to access the Supplier Portal.',
        'تحتاج دور المورد للوصول إلى بوابة المورد.',
      );
  String get goToHome => t('Go to home', 'الذهاب للرئيسية');
  String get signIn => t('Sign in', 'تسجيل الدخول');
}
