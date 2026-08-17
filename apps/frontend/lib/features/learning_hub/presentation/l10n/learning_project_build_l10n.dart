import '../../../../shared/models/localized_text.dart';

class LearningProjectBuildL10n {
  const LearningProjectBuildL10n._();

  static const acquired = LocalizedText(en: 'Acquired', ar: 'تم الحصول عليها');

  static const materialAcquired = LocalizedText(
    en: 'Material acquired',
    ar: 'تم استلام المادة',
  );

  static const readyForBuild = LocalizedText(
    en: 'Ready for build',
    ar: 'جاهزة للتنفيذ',
  );

  static const readyForBuildMaterialAcquired = LocalizedText(
    en: 'Ready for build — material acquired',
    ar: 'جاهزة للتنفيذ — تم استلام المادة',
  );

  static const acquiredSummary = LocalizedText(
    en: 'You acquired this material through a completed reservation.',
    ar: 'حصلت على هذه المادة من خلال حجز مكتمل.',
  );

  static const materialSelectedNotReady = LocalizedText(
    en: 'Material selected — not ready yet. Reserve or acquire this material before using it in your build.',
    ar: 'تم اختيار المادة — ليست جاهزة بعد. احجز المادة أو احصل عليها قبل استخدامها في البناء.',
  );

  static const inProgress = LocalizedText(
    en: 'In progress',
    ar: 'قيد المتابعة',
  );

  static const reservationCompleted = LocalizedText(
    en: 'Reservation completed',
    ar: 'اكتمل الحجز',
  );

  static const needsAttention = LocalizedText(
    en: 'Needs attention',
    ar: 'تحتاج إلى متابعة',
  );

  static const reservationRequiresResolution = LocalizedText(
    en: 'Reservation requires resolution',
    ar: 'الحجز يحتاج إلى معالجة',
  );

  static const selected = LocalizedText(en: 'Selected', ar: 'تم اختيار مادة');

  static const reserved = LocalizedText(en: 'Reserved', ar: 'محجوزة');

  static const alreadyOwned = LocalizedText(
    en: 'Already owned',
    ar: 'أمتلكها بالفعل',
  );

  static const materialSelectedReserveOrAcquire = LocalizedText(
    en: 'Material selected — reserve or acquire it before building.',
    ar: 'تم اختيار المادة — احجزها أو احصل عليها قبل البناء.',
  );

  static const insufficientQuantity = LocalizedText(
    en: 'Insufficient quantity',
    ar: 'الكمية غير كافية',
  );

  static const partiallyAcquired = LocalizedText(
    en: 'Partially acquired',
    ar: 'تم الحصول على جزء من الكمية',
  );

  static LocalizedText partiallyAcquiredDetail({
    required double acquired,
    required double required,
  }) => LocalizedText(
    en: 'Partially acquired — ${_formatQuantityLabel(acquired)} acquired, ${_formatQuantityLabel(required)} required',
    ar: 'تم الحصول على جزء من الكمية — تم الحصول على ${_formatQuantityLabel(acquired)}، المطلوب ${_formatQuantityLabel(required)}',
  );

  static const acquiredIncompatibleUnit = LocalizedText(
    en: 'This acquired material is not compatible with the required component unit.',
    ar: 'المادة التي تم الحصول عليها غير متوافقة مع وحدة المكوّن المطلوبة.',
  );

  static const incompatibleUnitTitle = LocalizedText(
    en: 'Incompatible unit',
    ar: 'الوحدة غير متوافقة',
  );

  static const incompatibleUnitBody = LocalizedText(
    en: 'This material does not use the required measurement unit for this component.',
    ar: 'هذه المادة لا تستخدم وحدة القياس المطلوبة لهذا المكوّن.',
  );

  static const materialNoLongerAvailable = LocalizedText(
    en: 'This linked material is no longer available on the platform.',
    ar: 'هذه المادة المرتبطة لم تعد متاحة على المنصة.',
  );

  static const useAnotherMaterial = LocalizedText(
    en: 'Use another material',
    ar: 'استخدام مادة أخرى',
  );

  static const removeFromComponent = LocalizedText(
    en: 'Remove from this component',
    ar: 'إزالة المادة من هذا المكوّن',
  );

  static const removeAcquiredAllocationTitle = LocalizedText(
    en: 'Remove this material from the component?',
    ar: 'إزالة هذه المادة من المكوّن؟',
  );

  static const removeAcquiredAllocationBody = LocalizedText(
    en: 'The completed reservation and acquisition history will remain available.',
    ar: 'سيبقى الحجز المكتمل وسجل الحصول على المادة محفوظين.',
  );

  static const missing = LocalizedText(en: 'Missing', ar: 'مفقودة');

  static const linkedOption = LocalizedText(
    en: 'Linked option',
    ar: 'الخيار المرتبط',
  );

  static const reserveThisMaterial = LocalizedText(
    en: 'Reserve this material',
    ar: 'احجز هذه المادة',
  );

  static const viewMaterial = LocalizedText(
    en: 'View material',
    ar: 'عرض المادة',
  );

  static const linkToComponent = LocalizedText(
    en: 'Link to component',
    ar: 'ربط بالمكوّن',
  );

  static const startBuild = LocalizedText(en: 'Start build', ar: 'ابدأ البناء');

  static const continueChecklist = LocalizedText(
    en: 'Continue checklist',
    ar: 'متابعة قائمة التحقق',
  );

  static const browseMaterials = LocalizedText(
    en: 'Browse materials',
    ar: 'تصفح المواد',
  );

  static const buildChecklist = LocalizedText(
    en: 'Build checklist',
    ar: 'قائمة تحقق البناء',
  );

  static const planThisBuild = LocalizedText(
    en: 'Plan this build',
    ar: 'خطّط لهذا البناء',
  );

  static const learnerAccountRequired = LocalizedText(
    en: 'Use a learner account to start builds.',
    ar: 'استخدم حساب متعلم لبدء البناء.',
  );

  static const checklistUnavailable = LocalizedText(
    en: 'Checklist status is unavailable right now.',
    ar: 'حالة قائمة التحقق غير متاحة حاليًا.',
  );

  static const continueChecklistSummary = LocalizedText(
    en: 'Continue your saved checklist for this project.',
    ar: 'تابع قائمة التحقق المحفوظة لهذا المشروع.',
  );

  static const startChecklistSummary = LocalizedText(
    en: 'Start a checklist from the required components and track readiness.',
    ar: 'ابدأ قائمة تحقق من المكوّنات المطلوبة وتابع جاهزيتها.',
  );

  static LocalizedText readyCount({required int ready, required int total}) =>
      LocalizedText(
        en: '$ready of $total ready in your build',
        ar: '$ready من $total جاهزة في مشروعك',
      );

  static LocalizedText componentCount(int count) => LocalizedText(
    en: count == 1 ? '1 component' : '$count components',
    ar: count == 1 ? 'مكوّن واحد' : '$count مكوّنات',
  );

  static LocalizedText stepCount(int count) => LocalizedText(
    en: count == 1 ? '1 step' : '$count steps',
    ar: count == 1 ? 'خطوة واحدة' : '$count خطوات',
  );

  static const unlinkMaterial = LocalizedText(en: 'Unlink', ar: 'إلغاء الربط');

  static const cancel = LocalizedText(en: 'Cancel', ar: 'إلغاء');

  static String _formatQuantityLabel(double value) {
    if (value == value.roundToDouble()) {
      return value.toInt().toString();
    }

    return value.toString();
  }

  static LocalizedText quantityAvailableRequired({
    required double available,
    required double required,
  }) => LocalizedText(
    en: '${_formatQuantityLabel(available)} available, ${_formatQuantityLabel(required)} required',
    ar: 'المتوفر ${_formatQuantityLabel(available)}، المطلوب ${_formatQuantityLabel(required)}',
  );

  static LocalizedText quantityAcquiredRequired({
    required double acquired,
    required double required,
  }) => LocalizedText(
    en: '${_formatQuantityLabel(acquired)} acquired, ${_formatQuantityLabel(required)} required',
    ar: 'تم الحصول على ${_formatQuantityLabel(acquired)}، المطلوب ${_formatQuantityLabel(required)}',
  );

  static const materialsSectionTitle = LocalizedText(
    en: 'Materials',
    ar: 'المواد',
  );

  static LocalizedText readyCountShort({
    required int ready,
    required int total,
  }) =>
      LocalizedText(en: '$ready of $total ready', ar: '$ready من $total جاهزة');

  static const noRequiredComponents = LocalizedText(
    en: 'This project does not list required components yet.',
    ar: 'لا يدرج هذا المشروع مكوّنات مطلوبة بعد.',
  );

  static const allMaterialsReady = LocalizedText(
    en: 'All required materials are ready. You can review them while working through the steps.',
    ar: 'كل المواد المطلوبة جاهزة. يمكنك مراجعتها أثناء تنفيذ الخطوات.',
  );

  static LocalizedText stillRequiredCount(int count) => LocalizedText(
    en: 'Still required · $count',
    ar: 'لا تزال مطلوبة · $count',
  );

  static LocalizedText readyForProjectCount(int count) => LocalizedText(
    en: 'Ready for the project · $count',
    ar: 'جاهزة للمشروع · $count',
  );

  static const compactMissing = LocalizedText(en: 'Missing', ar: 'مفقود');

  static const compactAvailable = LocalizedText(en: 'Available', ar: 'متاح');

  static const compactReserved = LocalizedText(en: 'Reserved', ar: 'محجوز');

  static const compactOwned = LocalizedText(en: 'Owned', ar: 'مملوك');

  static const compactAlternative = LocalizedText(
    en: 'Alternative',
    ar: 'بديل',
  );

  static const missingDescription = LocalizedText(
    en: 'This component has not been provided yet.',
    ar: 'لم يتم توفير هذا المكوّن بعد',
  );

  static const availableDescription = LocalizedText(
    en: 'Matching materials are available to reserve.',
    ar: 'توجد مواد مطابقة يمكنك حجزها',
  );

  static const reservedDescription = LocalizedText(
    en: 'This component is linked to your reservation.',
    ar: 'تم ربط هذا المكوّن بحجزك',
  );

  static const ownedDescription = LocalizedText(
    en: 'Ready for the project.',
    ar: 'جاهز للمشروع',
  );

  static const alternativeDescription = LocalizedText(
    en: 'An alternative has been selected for this component.',
    ar: 'تم اختيار بديل لهذا المكوّن',
  );

  static const findMatchingMaterial = LocalizedText(
    en: 'Find a matching material',
    ar: 'العثور على مادة مطابقة',
  );

  static const browseMatchingMaterials = LocalizedText(
    en: 'Browse matching materials',
    ar: 'استعراض المواد المطابقة',
  );

  static const viewAllMaterials = LocalizedText(
    en: 'View all materials',
    ar: 'عرض جميع المواد',
  );

  static const viewReservation = LocalizedText(
    en: 'View reservation',
    ar: 'عرض الحجز',
  );

  static const iHaveThisComponent = LocalizedText(
    en: 'I have this component',
    ar: 'لدي هذا المكوّن',
  );

  static const changeStatus = LocalizedText(
    en: 'Change status',
    ar: 'تغيير الحالة',
  );

  static const requestThisComponent = LocalizedText(
    en: 'Request this component',
    ar: 'طلب هذا المكوّن',
  );

  static const useAlternative = LocalizedText(
    en: 'Use an alternative',
    ar: 'استخدام بديل',
  );

  static const viewAlternative = LocalizedText(
    en: 'View alternative',
    ar: 'عرض البديل',
  );

  static const changeAlternative = LocalizedText(
    en: 'Change alternative',
    ar: 'تغيير البديل',
  );

  static const moreActions = LocalizedText(
    en: 'More actions',
    ar: 'المزيد من الإجراءات',
  );

  static const addNote = LocalizedText(en: 'Add note', ar: 'إضافة ملاحظة');

  static const editNote = LocalizedText(en: 'Edit note', ar: 'تعديل الملاحظة');

  static LocalizedText quantityWithLocalizedUnit({
    required double quantity,
    required String unit,
  }) {
    final amount = _formatQuantityLabel(quantity);
    final isSingular = quantity == 1;
    final localizedUnit = _localizedUnit(unit, isSingular: isSingular);
    return LocalizedText(
      en: '$amount ${localizedUnit.en}',
      ar: '$amount ${localizedUnit.ar}',
    );
  }

  static LocalizedText _localizedUnit(String unit, {required bool isSingular}) {
    return switch (unit.trim().toLowerCase()) {
      'piece' || 'pieces' => LocalizedText(
        en: isSingular ? 'piece' : 'pieces',
        ar: isSingular ? 'قطعة' : 'قطع',
      ),
      'set' || 'sets' => LocalizedText(
        en: isSingular ? 'set' : 'sets',
        ar: isSingular ? 'طقم' : 'أطقم',
      ),
      'pair' || 'pairs' => LocalizedText(
        en: isSingular ? 'pair' : 'pairs',
        ar: isSingular ? 'زوج' : 'أزواج',
      ),
      'pack' || 'packs' => LocalizedText(
        en: isSingular ? 'pack' : 'packs',
        ar: isSingular ? 'عبوة' : 'عبوات',
      ),
      _ => LocalizedText(en: unit, ar: unit),
    };
  }

  static const possibleOptionsTitle = LocalizedText(
    en: 'Best matches',
    ar: 'أفضل التطابقات',
  );

  static const bestMatchTitle = LocalizedText(
    en: 'Best match',
    ar: 'أفضل تطابق',
  );

  static LocalizedText possibleOptionsSubtitle(String component) =>
      LocalizedText(
        en: 'Platform materials that match "$component"',
        ar: 'مواد من المنصة تطابق "$component"',
      );

  static LocalizedText possibleOptionsCount({
    required int count,
    required String component,
  }) => LocalizedText(
    en: count == 1
        ? '1 matching material for "$component"'
        : '$count matching materials for "$component"',
    ar: count == 1
        ? 'مادة مطابقة واحدة لـ "$component"'
        : '$count مواد مطابقة لـ "$component"',
  );

  static const matchReasonsTitle = LocalizedText(
    en: 'Match reasons',
    ar: 'أسباب المطابقة',
  );

  static const noMatchingMaterials = LocalizedText(
    en: 'We did not find a matching material right now.',
    ar: 'لم نجد مادة مطابقة حاليًا',
  );

  static LocalizedText browseAllMaterialsFor(String component) => LocalizedText(
    en: 'Browse all materials for "$component"',
    ar: 'تصفّح جميع المواد لـ "$component"',
  );

  static const couldNotLoadOptions = LocalizedText(
    en: 'Could not load material options right now.',
    ar: 'تعذر تحميل خيارات المواد الآن.',
  );

  static const tryAgain = LocalizedText(en: 'Try again', ar: 'إعادة المحاولة');

  static const free = LocalizedText(en: 'Free', ar: 'مجاني');

  static const paid = LocalizedText(en: 'Paid', ar: 'مدفوع');

  static LocalizedText conditionLabel(String raw) {
    return switch (raw.trim().toUpperCase()) {
      'NEW' => const LocalizedText(en: 'New', ar: 'جديد'),
      'LIKE_NEW' => const LocalizedText(en: 'Like new', ar: 'كالجديد'),
      'GOOD' => const LocalizedText(en: 'Good', ar: 'جيد'),
      'USED' => const LocalizedText(en: 'Used', ar: 'مستعمل'),
      'NEEDS_REPAIR' => const LocalizedText(
        en: 'Needs repair',
        ar: 'يحتاج إلى إصلاح',
      ),
      _ => LocalizedText(en: raw, ar: raw),
    };
  }

  static LocalizedText matchHint(String raw) {
    return switch (raw.trim().toLowerCase()) {
      'compatible concept' => const LocalizedText(
        en: 'Compatible concept',
        ar: 'مفهوم متوافق',
      ),
      'concept match' => const LocalizedText(
        en: 'Concept match',
        ar: 'تطابق المفهوم',
      ),
      'name match' => const LocalizedText(en: 'Name match', ar: 'تطابق الاسم'),
      'strong match' => const LocalizedText(
        en: 'Strong match',
        ar: 'مطابقة قوية',
      ),
      'category match' => const LocalizedText(
        en: 'Category match',
        ar: 'نفس الفئة',
      ),
      'keyword match' => const LocalizedText(
        en: 'Keyword match',
        ar: 'تطابق الكلمات',
      ),
      'material type match' => const LocalizedText(
        en: 'Material type match',
        ar: 'تطابق نوع المادة',
      ),
      'matches component type' => const LocalizedText(
        en: 'Matches component type',
        ar: 'يطابق نوع المكوّن',
      ),
      'pickup available' => const LocalizedText(
        en: 'Pickup available',
        ar: 'استلام متاح',
      ),
      'delivery available' => const LocalizedText(
        en: 'Delivery available',
        ar: 'توصيل متاح',
      ),
      'same city' => const LocalizedText(en: 'Same city', ar: 'نفس المدينة'),
      'free' => free,
      'possible option' => const LocalizedText(
        en: 'Possible option',
        ar: 'خيار محتمل',
      ),
      _ => LocalizedText(en: raw, ar: raw),
    };
  }

  static const buildStepsTitle = LocalizedText(
    en: 'Build steps',
    ar: 'خطوات البناء',
  );

  static const completeStep = LocalizedText(
    en: 'Complete step',
    ar: 'إكمال الخطوة',
  );

  static const finishedThisStep = LocalizedText(
    en: 'I finished this step',
    ar: 'أنهيت هذه الخطوة',
  );

  static const stepStatusCurrent = LocalizedText(en: 'Current', ar: 'الحالية');

  static const stepStatusLocked = LocalizedText(en: 'Later', ar: 'لاحقًا');

  static const stepStatusDone = LocalizedText(en: 'Done', ar: 'تمت');

  static const noBuildStepsYet = LocalizedText(
    en: 'This project does not include build steps yet.',
    ar: 'لا يتضمن هذا المشروع خطوات بناء بعد.',
  );

  static const prepareMaterialsBeforeSteps = LocalizedText(
    en: 'Prepare required materials before starting the steps.',
    ar: 'حضّر المواد المطلوبة قبل بدء الخطوات.',
  );
}
