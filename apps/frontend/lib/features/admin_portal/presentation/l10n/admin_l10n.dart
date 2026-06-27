import 'package:flutter/material.dart';

class AdminL10n {
  AdminL10n._(this._lang);

  final String _lang;

  bool get isArabic => _lang == 'ar';

  static AdminL10n of(BuildContext context) {
    final code = Localizations.localeOf(context).languageCode;
    return AdminL10n._(code);
  }

  String t(String en, String ar) => isArabic ? ar : en;

  String get navOverview => t('Overview', 'نظرة عامة');
  String get navUsers => t('Users', 'المستخدمون');
  String get navSuppliers => t('Suppliers', 'الموردون');
  String get navSupplierVerification => t('Supplier Verification', 'التحقق من المورد');
  String get navMaterials => t('Materials', 'المواد');
  String get navApprovals => t('Approvals', 'الموافقات');
  String get navInvitations => t('Invitations', 'الدعوات');
  String get navImpactAnalytics => t('Impact Analytics', 'تحليلات الأثر');
  String get navAuditLogs => t('Audit Logs', 'سجلات التدقيق');

  String get accessDeniedTitle => t('Access denied', 'تم رفض الوصول');
  String get accessDeniedBody => t(
        'You do not have permission to access the Admin Portal.',
        'ليس لديك صلاحية للوصول إلى بوابة الإدارة.',
      );

  String get overviewPageTitle => t('Admin Overview', 'نظرة عامة للإدارة');
  String get overviewPageSubtitle => t(
        'Platform control dashboard',
        'لوحة تحكم المنصة',
      );

  String welcomeTitle(String name) =>
      t('Welcome back, $name', 'مرحباً بعودتك، $name');
  String get welcomeSubtitle => t(
        'Here is today\'s platform activity, approvals, reuse impact, and operational health.',
        'إليك نشاط المنصة اليوم والموافقات وأثر إعادة الاستخدام والصحة التشغيلية.',
      );
  String get bannerOverviewLabel =>
      t('Platform overview', 'نظرة عامة على المنصة');

  String get platformDistributionTitle =>
      t('Platform account distribution', 'توزيع حسابات المنصة');
  String get platformDistributionSubtitle => t(
        'Users, suppliers, and active drivers on ImpactLoop',
        'المستخدمون والموردون والسائقون النشطون على ImpactLoop',
      );

  String get impactSectionTitle => t('Reuse Impact', 'أثر إعادة الاستخدام');
  String get co2RingCenterLabel => t(
        'Listed materials reused',
        'المواد المدرجة المعاد استخدامها',
      );
  String get estimatedAvoidedSuffix =>
      t('estimated avoided', 'تقدير تجنب');

  String get controlCenterTitle => t('Platform Control Center', 'مركز التحكم بالمنصة');
  String get controlCenterSubtitle => t(
        'Monitor platform activity, approvals, invitations, supplier verification, and reuse impact from one place.',
        'راقب نشاط المنصة والموافقات والدعوات والتحقق من الموردين وأثر إعادة الاستخدام من مكان واحد.',
      );

  String get chartsAnalyticsTitle => t('Charts & analytics', 'الرسوم البيانية والتحليلات');
  String get chartsAnalyticsSubtitle => t(
        'Reuse trends, category distribution, reservations, and approval queues.',
        'اتجاهات إعادة الاستخدام وتوزيع الفئات والحجوزات وقوائم الموافقات.',
      );

  String get platformMetricsTitle => t('Platform metrics', 'مقاييس المنصة');
  String get platformMetricsSubtitle => t(
        'Live counts across users, listings, approvals, and operations.',
        'أعداد مباشرة للمستخدمين والقوائم والموافقات والعمليات.',
      );

  String get adminOperationsTitle => t('Admin operations', 'عمليات الإدارة');
  String get adminOperationsSubtitle => t(
        'Jump into each admin module from the control dashboard.',
        'انتقل إلى كل وحدة إدارية من لوحة التحكم.',
      );
  String get openModuleCta => t('Open', 'فتح');

  String get statUsers => t('Users', 'المستخدمون');
  String get statSuppliers => t('Suppliers', 'الموردون');
  String get statMaterials => t('Materials', 'المواد');
  String get statAvailableMaterials => t('Available materials', 'المواد المتاحة');
  String get statPendingApprovals => t('Pending approvals', 'الموافقات المعلّقة');
  String get statActiveInvitations => t('Active invitations', 'الدعوات النشطة');
  String get statCompletedReuse => t('Completed reuse', 'عمليات إعادة الاستخدام المكتملة');
  String get statActiveDrivers => t('Active drivers', 'السائقون النشطون');

  String get estimatedCo2Avoided => t('Estimated CO₂ avoided', 'تقدير تجنب CO₂');
  String get estimatedBadge => t('Estimated', 'تقديري');
  String get estimatedCo2Helper => t(
        'Estimated from reused materials and category-based reuse factors.',
        'تقدير من المواد المعاد استخدامها وعوامل إعادة الاستخدام حسب الفئة.',
      );
  String get reuseCompletionRateLabel =>
      t('Reuse completion rate', 'معدل إكمال إعادة الاستخدام');

  String get hintUsers => t('Registered accounts on ImpactLoop', 'الحسابات المسجلة على ImpactLoop');
  String get hintSuppliers => t('Suppliers with portal access', 'الموردون الذين لديهم وصول للبوابة');
  String get hintMaterials => t('All listed materials on the platform', 'جميع المواد المدرجة على المنصة');
  String get hintAvailableMaterials => t('Materials currently open for reservation', 'المواد المتاحة للحجز حالياً');
  String get hintPendingApprovals => t(
        'Supplier, category, and price requests waiting',
        'طلبات الموردين والفئات والأسعار المعلّقة',
      );
  String get hintActiveInvitations => t('Open driver, moderator, and admin invites', 'دعوات السائق والمشرف والإدارة المفتوحة');
  String get hintCompletedReuse => t('Materials marked as reused', 'المواد المعلّمة كمعاد استخدامها');
  String get hintActiveDrivers => t('Users with driver role assigned', 'المستخدمون الذين لديهم دور سائق');

  String get reuseActivityTitle => t('Reuse activity over time', 'نشاط إعادة الاستخدام عبر الزمن');
  String get reuseActivitySubtitle => t(
        'Monthly completed reuse across the platform',
        'إعادة الاستخدام المكتملة شهرياً عبر المنصة',
      );
  String get materialsByCategoryTitle => t('Materials by category', 'المواد حسب الفئة');
  String get materialsByCategorySubtitle => t(
        'Distribution of listed materials across categories',
        'توزيع المواد المدرجة عبر الفئات',
      );
  String get reservationStatusTitle => t('Reservation status overview', 'نظرة عامة على حالات الحجز');
  String get reservationStatusSubtitle => t(
        'Current reservation pipeline by status',
        'مسار الحجوزات الحالي حسب الحالة',
      );
  String get pendingActionsTitle => t('Approval queue breakdown', 'تفصيل قائمة الموافقات');
  String get pendingActionsSubtitle => t(
        'Pending supplier, category, price, and report reviews',
        'مراجعات الموردين والفئات والأسعار والبلاغات المعلّقة',
      );

  String get recentInvitationsTitle => t('Recent invitations', 'الدعوات الأخيرة');
  String get recentActivityTitle => t('Recent admin activity', 'النشاط الإداري الأخير');
  String get recentActivitySubtitle => t(
        'Latest administrative events when available',
        'أحدث الأحداث الإدارية عند توفرها',
      );
  String get recentActivityEmptySubtitle => t(
        'No admin activity yet',
        'لا يوجد نشاط إداري بعد',
      );
  String get supplierVerificationQueueTitle => t('Supplier verification queue', 'قائمة التحقق من الموردين');
  String get reviewQueuesTitle => t('Review queues', 'قوائم المراجعة');
  String get reviewQueuesSubtitle => t(
        'Supplier verification, invitations, and admin activity',
        'التحقق من الموردين والدعوات والنشاط الإداري',
      );
  String get supplierVerificationFutureNote => t(
        'Supplier verification workflow will appear after organization verification documents are enabled.',
        'ستظهر عملية التحقق من الموردين بعد تفعيل مستندات التحقق للمؤسسات.',
      );

  String get impactSnapshotTitle => t('Reuse Impact Snapshot', 'لقطة أثر إعادة الاستخدام');
  String get impactSnapshotSubtitle => t(
        'Platform reuse outcomes from completed reservations and materials',
        'نتائج إعادة الاستخدام من الحجوزات والمواد المكتملة',
      );
  String get impactReusedMaterials => t('Reused materials', 'مواد أُعيد استخدامها');
  String get impactCompletedReservations => t('Completed reservations', 'الحجوزات المكتملة');
  String get impactLearnersBenefited => t('Learners benefited', 'المتعلمون المستفيدون');
  String get impactSuppliersContributed => t('Suppliers contributed', 'الموردون المساهمون');
  String get impactTopCategory => t('Top reused category', 'أعلى فئة معاد استخدامها');
  String get impactTopCategoryEmpty => t('Top reused category: —', 'أعلى فئة معاد استخدامها: —');
  String get impactEnvironmentalNote => t(
        'Estimated environmental impact is calculated using category-based reuse factors and available material quantities. Values are approximate.',
        'يتم حساب الأثر البيئي التقديري باستخدام عوامل إعادة الاستخدام حسب الفئة والكميات المتاحة. القيم تقريبية.',
      );

  String get emptyNoDataYet => t('No data yet', 'لا توجد بيانات بعد');
  String get emptyNoInvitations => t(
        'Create role invitations from the Invitations page once enabled.',
        'أنشئ دعوات الأدوار من صفحة الدعوات عند تفعيلها.',
      );
  String get emptyNoInvitationsTitle => t('No active invitations', 'لا توجد دعوات نشطة');
  String get emptyNoInvitationsHint => t(
        'Open the Invitations module to create driver, moderator, or admin invites.',
        'افتح وحدة الدعوات لإنشاء دعوات سائق أو مشرف أو إدارة.',
      );
  String get emptyNoActivity => t('No admin activity yet', 'لا يوجد نشاط إداري بعد');
  String get emptyNoActivityHint => t(
        'Audit events will appear after admin actions are enabled.',
        'ستظهر أحداث التدقيق بعد تفعيل إجراءات الإدارة.',
      );
  String get emptyNoSupplierVerifications =>
      t('No supplier verification requests waiting.', 'لا توجد طلبات تحقق من الموردين حالياً.');
  String get emptyAllClearTitle => t('All clear', 'كل شيء واضح');
  String get emptyNoPendingApprovals => t(
        'No supplier, category, price, or report reviews waiting.',
        'لا توجد مراجعات موردين أو فئات أو أسعار أو بلاغات معلّقة.',
      );

  String get pendingSupplierVerifications => t('Supplier verification', 'تحقق المورد');
  String get pendingCategoryRequests => t('Category requests', 'طلبات الفئات');
  String get pendingPriceRequests => t('Price requests', 'طلبات الأسعار');
  String get pendingReports => t('Reports', 'البلاغات');

  String get opUsersDesc => t('Manage platform user accounts', 'إدارة حسابات مستخدمي المنصة');
  String get opSuppliersDesc => t('Review supplier accounts and profiles', 'مراجعة حسابات وملفات الموردين');
  String get opSupplierVerificationDesc => t('Process supplier verification requests', 'معالجة طلبات التحقق من الموردين');
  String get opMaterialsDesc => t('Moderate and review material listings', 'مراجعة وإدارة قوائم المواد');
  String get opApprovalsDesc => t('Category, price, and listing approvals', 'موافقات الفئات والأسعار والقوائم');
  String get opInvitationsDesc => t('Create and track role invitations', 'إنشاء وتتبع دعوات الأدوار');
  String get opImpactDesc => t('Explore reuse and impact analytics', 'استكشاف تحليلات إعادة الاستخدام والأثر');
  String get opAuditLogsDesc => t('Review administrative audit history', 'مراجعة سجل التدقيق الإداري');
}
