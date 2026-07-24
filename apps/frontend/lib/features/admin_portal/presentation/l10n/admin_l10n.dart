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
  String get navSupplierVerification =>
      t('Supplier Verification', 'التحقق من المورد');
  String get navMaterials => t('Materials', 'المواد');
  String get navApprovals => t('Approvals', 'الموافقات');
  String get navInvitations => t('Invitations', 'الدعوات');
  String get navImpactAnalytics => t('Impact Analytics', 'تحليلات الأثر');
  String get navAuditLogs => t('Audit Logs', 'سجلات التدقيق');
  String get navReservations => t('Reservations', 'الحجوزات');
  String get navDeliveries => t('Deliveries', 'التوصيل');
  String get navLearningProjects => t('Learning Projects', 'مشاريع التعلم');

  String get accessDeniedTitle => t('Access denied', 'تم رفض الوصول');
  String get accessDeniedBody => t(
    'You do not have permission to access the Admin Portal.',
    'ليس لديك صلاحية للوصول إلى بوابة الإدارة.',
  );

  String get overviewPageTitle => t('Admin Overview', 'نظرة عامة للإدارة');
  String get overviewPageSubtitle =>
      t('Platform control dashboard', 'لوحة تحكم المنصة');

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
  String get co2RingCenterLabel =>
      t('Listed materials reused', 'المواد المدرجة المعاد استخدامها');
  String get estimatedAvoidedSuffix => t('estimated avoided', 'تقدير تجنب');

  String get controlCenterTitle =>
      t('Platform Control Center', 'مركز التحكم بالمنصة');
  String get controlCenterSubtitle => t(
    'Monitor platform activity, approvals, invitations, supplier verification, and reuse impact from one place.',
    'راقب نشاط المنصة والموافقات والدعوات والتحقق من الموردين وأثر إعادة الاستخدام من مكان واحد.',
  );

  String get chartsAnalyticsTitle =>
      t('Charts & analytics', 'الرسوم البيانية والتحليلات');
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
  String get statAvailableMaterials =>
      t('Available materials', 'المواد المتاحة');
  String get statPendingApprovals =>
      t('Pending approvals', 'الموافقات المعلّقة');
  String get statActiveInvitations => t('Active invitations', 'الدعوات النشطة');
  String get statCompletedReuse =>
      t('Completed reuse', 'عمليات إعادة الاستخدام المكتملة');
  String get statActiveDrivers => t('Active drivers', 'السائقون النشطون');

  String get estimatedCo2Avoided =>
      t('Estimated CO₂ avoided', 'تقدير تجنب CO₂');
  String get estimatedBadge => t('Estimated', 'تقديري');
  String get estimatedCo2Helper => t(
    'Estimated from reused materials and category-based reuse factors.',
    'تقدير من المواد المعاد استخدامها وعوامل إعادة الاستخدام حسب الفئة.',
  );
  String get estimatedCo2ShortHelper =>
      t('Estimated from reused materials', 'تقدير من المواد المعاد استخدامها');
  String get reuseCompletionRateLabel =>
      t('Reuse completion rate', 'معدل إكمال إعادة الاستخدام');

  String get hintUsers =>
      t('Registered accounts on ImpactLoop', 'الحسابات المسجلة على ImpactLoop');
  String get hintSuppliers =>
      t('Suppliers with portal access', 'الموردون الذين لديهم وصول للبوابة');
  String get hintMaterials => t(
    'All listed materials on the platform',
    'جميع المواد المدرجة على المنصة',
  );
  String get hintAvailableMaterials => t(
    'Materials currently open for reservation',
    'المواد المتاحة للحجز حالياً',
  );
  String get hintPendingApprovals => t(
    'Supplier, category, and price requests waiting',
    'طلبات الموردين والفئات والأسعار المعلّقة',
  );
  String get hintActiveInvitations => t(
    'Open driver, moderator, and admin invites',
    'دعوات السائق والمشرف والإدارة المفتوحة',
  );
  String get hintCompletedReuse =>
      t('Materials marked as reused', 'المواد المعلّمة كمعاد استخدامها');
  String get hintActiveDrivers =>
      t('Users with driver role assigned', 'المستخدمون الذين لديهم دور سائق');

  String get reuseActivityTitle =>
      t('Reuse activity over time', 'نشاط إعادة الاستخدام عبر الزمن');
  String get reuseActivitySubtitle => t(
    'Monthly completed reuse across the platform',
    'إعادة الاستخدام المكتملة شهرياً عبر المنصة',
  );
  String get materialsByCategoryTitle =>
      t('Materials by category', 'المواد حسب الفئة');
  String get materialsByCategorySubtitle => t(
    'Distribution of listed materials across categories',
    'توزيع المواد المدرجة عبر الفئات',
  );
  String get reservationStatusTitle =>
      t('Reservation status overview', 'نظرة عامة على حالات الحجز');
  String get reservationStatusSubtitle => t(
    'Current reservation pipeline by status',
    'مسار الحجوزات الحالي حسب الحالة',
  );
  String get pendingActionsTitle =>
      t('Approval queue breakdown', 'تفصيل قائمة الموافقات');
  String get pendingActionsSubtitle => t(
    'Pending supplier, category, price, and report reviews',
    'مراجعات الموردين والفئات والأسعار والبلاغات المعلّقة',
  );

  String get recentInvitationsTitle =>
      t('Recent invitations', 'الدعوات الأخيرة');
  String get recentActivityTitle =>
      t('Recent admin activity', 'النشاط الإداري الأخير');
  String get recentActivitySubtitle => t(
    'Latest administrative events when available',
    'أحدث الأحداث الإدارية عند توفرها',
  );
  String get recentActivityEmptySubtitle =>
      t('No admin activity yet', 'لا يوجد نشاط إداري بعد');
  String get viewAllAuditLogs => t('View all logs', 'عرض كل السجلات');
  String get supplierVerificationQueueTitle =>
      t('Supplier verification queue', 'قائمة التحقق من الموردين');
  String get reviewQueuesTitle => t('Review queues', 'قوائم المراجعة');
  String get reviewQueuesSubtitle => t(
    'Supplier verification, invitations, and admin activity',
    'التحقق من الموردين والدعوات والنشاط الإداري',
  );
  String get supplierVerificationFutureNote => t(
    'Supplier verification workflow will appear after organization verification documents are enabled.',
    'ستظهر عملية التحقق من الموردين بعد تفعيل مستندات التحقق للمؤسسات.',
  );

  String get impactSnapshotTitle =>
      t('Reuse Impact Snapshot', 'لقطة أثر إعادة الاستخدام');
  String get impactSnapshotSubtitle => t(
    'Platform reuse outcomes from completed reservations and materials',
    'نتائج إعادة الاستخدام من الحجوزات والمواد المكتملة',
  );
  String get impactReusedMaterials =>
      t('Reused materials', 'مواد أُعيد استخدامها');
  String get impactCompletedReservations =>
      t('Completed reservations', 'الحجوزات المكتملة');
  String get impactLearnersBenefited =>
      t('Learners benefited', 'المتعلمون المستفيدون');
  String get impactSuppliersContributed =>
      t('Suppliers contributed', 'الموردون المساهمون');
  String get impactTopCategory =>
      t('Top reused category', 'أعلى فئة معاد استخدامها');
  String get impactTopCategoryEmpty =>
      t('Top reused category: —', 'أعلى فئة معاد استخدامها: —');
  String get impactEnvironmentalNote => t(
    'Estimated environmental impact is calculated using category-based reuse factors and available material quantities. Values are approximate.',
    'يتم حساب الأثر البيئي التقديري باستخدام عوامل إعادة الاستخدام حسب الفئة والكميات المتاحة. القيم تقريبية.',
  );

  String get emptyNoDataYet => t('No data yet', 'لا توجد بيانات بعد');
  String get emptyNoInvitations => t(
    'Create role invitations from the Invitations page once enabled.',
    'أنشئ دعوات الأدوار من صفحة الدعوات عند تفعيلها.',
  );
  String get emptyNoInvitationsTitle =>
      t('No active invitations', 'لا توجد دعوات نشطة');
  String get emptyNoInvitationsHint => t(
    'Open the Invitations module to create driver, moderator, or admin invites.',
    'افتح وحدة الدعوات لإنشاء دعوات سائق أو مشرف أو إدارة.',
  );
  String get emptyNoActivity =>
      t('No admin activity yet', 'لا يوجد نشاط إداري بعد');
  String get emptyNoActivityHint => t(
    'Audit events will appear after admin actions are enabled.',
    'ستظهر أحداث التدقيق بعد تفعيل إجراءات الإدارة.',
  );
  String get emptyNoSupplierVerifications => t(
    'No supplier verification requests waiting.',
    'لا توجد طلبات تحقق من الموردين حالياً.',
  );
  String get emptyAllClearTitle => t('All clear', 'كل شيء واضح');
  String get emptyNoPendingApprovals => t(
    'No supplier, category, price, or report reviews waiting.',
    'لا توجد مراجعات موردين أو فئات أو أسعار أو بلاغات معلّقة.',
  );

  String get pendingSupplierVerifications =>
      t('Supplier verification', 'تحقق المورد');
  String get pendingCategoryRequests => t('Category requests', 'طلبات الفئات');
  String get pendingPriceRequests => t('Price requests', 'طلبات الأسعار');
  String get pendingReports => t('Reports', 'البلاغات');

  String get opUsersDesc =>
      t('Manage platform user accounts', 'إدارة حسابات مستخدمي المنصة');
  String get opSuppliersDesc => t(
    'Review supplier accounts and profiles',
    'مراجعة حسابات وملفات الموردين',
  );
  String get opSupplierVerificationDesc => t(
    'Process supplier verification requests',
    'معالجة طلبات التحقق من الموردين',
  );
  String get opMaterialsDesc =>
      t('Moderate and review material listings', 'مراجعة وإدارة قوائم المواد');
  String get opApprovalsDesc => t(
    'Category, price, and listing approvals',
    'موافقات الفئات والأسعار والقوائم',
  );
  String get opInvitationsDesc =>
      t('Create and track role invitations', 'إنشاء وتتبع دعوات الأدوار');
  String get opImpactDesc => t(
    'Explore reuse and impact analytics',
    'استكشاف تحليلات إعادة الاستخدام والأثر',
  );
  String get opAuditLogsDesc =>
      t('Review administrative audit history', 'مراجعة سجل التدقيق الإداري');

  String get categoryRequest => t('Category request', 'طلب فئة');
  String get resolveCategoryRequest =>
      t('Resolve category request', 'معالجة طلب الفئة');
  String get useExistingCategory =>
      t('Use existing category', 'استخدام فئة حالية');
  String get createNewCategory => t('Create new category', 'إنشاء فئة جديدة');
  String get useExistingGuidance => t(
    'Recommended when an existing category already covers this material.',
    'يوصى به عندما تغطي فئة حالية هذه المادة بالفعل.',
  );
  String get createNewGuidance => t(
    'Create only when existing categories do not accurately represent this request.',
    'أنشئ فئة جديدة فقط عندما لا تمثل الفئات الحالية هذا الطلب بدقة.',
  );
  String get suggestedExistingCategory =>
      t('Suggested existing category', 'الفئة الحالية المقترحة');
  String get searchOtherCategories => t(
    'Search or select another active category',
    'ابحث أو اختر فئة نشطة أخرى',
  );
  String get searchCategories =>
      t('Search existing categories…', 'ابحث في الفئات الحالية…');
  String get chooseExistingCategory =>
      t('Choose an existing category', 'اختر فئة حالية');
  String get existingCategory => t('Existing category', 'الفئة الحالية');
  String get existingCategoryRequired =>
      t('Choose an active existing category.', 'اختر فئة حالية نشطة.');
  String get loadingCategories =>
      t('Loading existing categories…', 'جارٍ تحميل الفئات الحالية…');
  String get failedCategories =>
      t('Failed to load existing categories.', 'تعذر تحميل الفئات الحالية.');
  String get noCategoriesAvailable => t(
    'No active owned material categories are available.',
    'لا توجد فئات مواد نشطة ومحددة الملكية متاحة.',
  );
  String get useThisCategory => t('Use this category', 'استخدم هذه الفئة');
  String get exactNameMatch => t('Exact match', 'مطابقة تامة');
  String get possibleNameMatch => t('Possible match', 'مطابقة محتملة');
  String get approveWithExisting =>
      t('Approve with existing category', 'الموافقة باستخدام فئة حالية');
  String get createAndApprove =>
      t('Create and approve', 'إنشاء الفئة والموافقة');
  String get createJustification =>
      t('Why is a separate category needed?', 'لماذا يلزم إنشاء فئة منفصلة؟');
  String get createJustificationHelper => t(
    'Explain briefly why the suggested category does not fit.',
    'اشرح بإيجاز لماذا لا تناسب الفئة المقترحة هذا الطلب.',
  );
  String get createJustificationRequired => t(
    'Enter at least 10 characters explaining why a new category is needed.',
    'أدخل 10 أحرف على الأقل لتوضيح سبب الحاجة إلى فئة جديدة.',
  );
  String get existingNameConflict =>
      t('This category already exists', 'هذه الفئة موجودة بالفعل');
  String materialUsageCount(int count) => t(
    '$count marketplace material${count == 1 ? '' : 's'}',
    '$count مادة في المنصة',
  );
  String get requestDetails => t('Request details', 'تفاصيل الطلب');
  String get categoryMatching => t('Category matching', 'مطابقة الفئة');
  String get similarCategories => t('Similar categories', 'فئات مشابهة');
  String get noSimilarCategories =>
      t('No suggested existing category', 'لا توجد فئة حالية مقترحة');
  String get approvalConfiguration =>
      t('Approval configuration', 'إعداد الموافقة');
  String get requestedCategoryName =>
      t('Requested name', 'الاسم المقترح من المورد');
  String get finalCategoryNameEn =>
      t('Final category name in English', 'اسم الفئة النهائي بالإنجليزية');
  String get finalCategoryNameAr =>
      t('Final category name in Arabic', 'اسم الفئة النهائي بالعربية');
  String get bilingualNamesHelper => t(
    'Review both final marketplace names. Users see the name matching their app language. Automated checks only catch obvious structure and language-placement problems; they do not verify grammar or translation.',
    'راجع اسمي المتجر النهائيين. سيظهر للمستخدم الاسم الموافق للغة التطبيق. تكشف الفحوصات الآلية المشكلات الواضحة في البنية وموضع اللغة فقط، ولا تتحقق من القواعد أو الترجمة.',
  );
  String get namingGuidance => t(
    'Use a short, clear marketplace category name. Avoid material titles, full descriptions, and vague wording.',
    'استخدم اسم فئة مختصرًا وواضحًا للمتجر، وتجنب أسماء المواد المحددة والوصف الطويل والعبارات العامة.',
  );
  String get englishNameRequired => t(
    'Enter an English category name between 2 and 120 characters.',
    'أدخل اسم الفئة بالإنجليزية بين حرفين و120 حرفًا.',
  );
  String get arabicNameRequired => t(
    'Enter an Arabic category name between 2 and 120 characters.',
    'أدخل اسم الفئة بالعربية بين حرفين و120 حرفًا.',
  );
  String get englishNameWrongScript => t(
    'The English name appears to contain Arabic text.',
    'يبدو أن اسم الفئة الإنجليزي يحتوي على نص عربي.',
  );
  String get arabicNameWrongScript => t(
    'The Arabic name appears to contain English-only text.',
    'يبدو أن اسم الفئة العربي يحتوي على نص إنجليزي فقط.',
  );
  String get nameControlCharacters => t(
    'Category names cannot contain control characters.',
    'لا يمكن أن تحتوي أسماء الفئات على محارف تحكم.',
  );
  String get namePunctuationBoundary => t(
    'Category names cannot begin or end with punctuation.',
    'لا يمكن أن يبدأ اسم الفئة أو ينتهي بعلامة ترقيم.',
  );
  String get nameRepeatedWords => t(
    'Avoid repeating the same word consecutively.',
    'تجنب تكرار الكلمة نفسها بشكل متتالٍ.',
  );
  String get nameDescriptionLike => t(
    'This looks like a full description rather than a concise category name.',
    'يبدو هذا وصفًا كاملاً وليس اسم فئة مختصرًا.',
  );
  String get namesAppearIdentical => t(
    'Both marketplace names are identical. Confirm that this term is intentionally used in both languages.',
    'الاسمان متطابقان. تأكد أن هذا المصطلح يُستخدم بالشكل نفسه في اللغتين.',
  );
  String get confirmSharedTechnicalTerm => t(
    'I confirm this shared technical term is intentional.',
    'أؤكد أن استخدام هذا المصطلح التقني نفسه في اللغتين مقصود.',
  );
  String get sharedNameAcknowledgementRequired => t(
    'Confirm that this shared technical term is intentionally used in both languages.',
    'أكد أن هذا المصطلح التقني يُستخدم عن قصد بالشكل نفسه في اللغتين.',
  );
  String get nameUnusuallyLong => t(
    'This name is unusually long for a category.',
    'هذا الاسم طويل بشكل غير معتاد لفئة.',
  );
  String get englishNameCasingWarning => t(
    'Review English capitalization; marketplace categories normally use title-style names.',
    'راجع كتابة الأحرف الكبيرة في الاسم الإنجليزي؛ تستخدم فئات المتجر عادةً نمط العناوين.',
  );
  String get repeatedWhitespaceWarning => t(
    'Repeated whitespace will be saved as one ordinary space.',
    'سيتم حفظ المسافات المتكررة كمسافة عادية واحدة.',
  );
  String get materialTitleWarning => t(
    'This looks like a material title rather than a reusable category name.',
    'يبدو هذا اسم مادة محددة وليس اسم فئة قابلة لإعادة الاستخدام.',
  );
  String get similarWordingWarning => t(
    'This wording is very similar to an existing category.',
    'هذه الصياغة مشابهة جدًا لفئة موجودة.',
  );
  String get assignMaterialFamily =>
      t('Assign material family', 'تعيين عائلة المادة');
  String get required => t('Required', 'مطلوب');
  String get chooseMaterialFamily =>
      t('Choose a material family', 'اختر عائلة مادة');
  String get searchMaterialFamilies =>
      t('Search material families', 'ابحث في عائلات المواد');
  String get loadingMaterialFamilies =>
      t('Loading material families…', 'جارٍ تحميل عائلات المواد…');
  String get failedMaterialFamilies =>
      t('Failed to load material families.', 'تعذر تحميل عائلات المواد.');
  String get noMaterialFamilies => t(
    'No active material families are available.',
    'لا توجد عائلات مواد نشطة متاحة.',
  );
  String get materialFamily => t('Material family', 'عائلة المادة');
  String get materialFamilyRequired =>
      t('Material family is required.', 'عائلة المادة مطلوبة.');
  String get materialFamilyInactive => t(
    'Selected material family is inactive.',
    'عائلة المادة المحددة غير نشطة.',
  );
  String get taxonomyConceptWrongType => t(
    'Selected taxonomy concept is not a material family.',
    'مفهوم التصنيف المحدد ليس عائلة مادة.',
  );
  String get materialFamilyNotFound => t(
    'Selected material family is no longer available.',
    'عائلة المادة المحددة لم تعد متاحة.',
  );
  String get ownershipHelper => t(
    'Select the canonical material family that best represents this new category.',
    'اختر عائلة المادة المرجعية التي تمثل هذه الفئة الجديدة بأفضل شكل.',
  );
  String get ownershipExplanation => t(
    'This mapping connects the category to the taxonomy and recommendation system.',
    'يربط هذا التعيين الفئة بنظام التصنيف والتوصيات.',
  );
  String get activeMapping => t('Active mapping', 'تعيين نشط');
  String get requestSummary => t('Request summary', 'ملخص الطلب');
  String get adminGuidance => t('Admin guidance', 'إرشادات الإدارة');
  String get ownershipGuidance => t(
    'Review similar categories, then select the appropriate material family before approving.',
    'راجع الفئات المشابهة ثم اختر عائلة المادة المناسبة قبل الموافقة.',
  );
  String get submitted => t('Submitted', 'تاريخ التقديم');
  String get requestedBy => t('Requested by', 'مقدم الطلب');
  String get status => t('Status', 'الحالة');
  String get supplier => t('Supplier', 'المورد');
  String get material => t('Material', 'المادة');
  String get description => t('Description', 'الوصف');
  String get quantity => t('Quantity', 'الكمية');
  String get condition => t('Condition', 'الحالة');
  String get location => t('Location', 'الموقع');
  String get reason => t('Reason', 'السبب');
  String get approve => t('Approve', 'موافقة');
  String get reject => t('Reject', 'رفض');
  String get close => t('Close', 'إغلاق');
  String get retry => t('Retry', 'إعادة المحاولة');
  String get approvalSucceeded =>
      t('Category request approved.', 'تمت الموافقة على طلب الفئة.');
}
