import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../domain/models/smart_build_plan.dart';

class SmartBuildPlanL10n {
  const SmartBuildPlanL10n._();

  static const buildSummaryTitle = LocalizedText(
    en: 'Build summary',
    ar: 'ملخص المشروع',
  );

  static const pageTitle = LocalizedText(
    en: 'Smart Build Plan',
    ar: 'الخطة الذكية للبناء',
  );

  static const openFromBuild = LocalizedText(
    en: 'Find best material plan',
    ar: 'اعثر على أفضل خطة مواد',
  );

  static const advisoryBanner = LocalizedText(
    en:
        'These are advisory recommendations only. Availability must be rechecked before reserving materials.',
    ar:
        'هذه توصيات إرشادية فقط. يجب إعادة التحقق من التوفر قبل حجز المواد.',
  );

  static const advisoryStrip = LocalizedText(
    en:
        'Smart recommendations only. Availability is checked again when you reserve.',
    ar: 'توصيات ذكية فقط. يتم التحقق من التوفر مجدداً عند الحجز.',
  );

  static LocalizedText updatedAt(String formatted) => LocalizedText(
    en: 'Updated $formatted',
    ar: 'التحديث: $formatted',
  );

  static const deliveryFeeNote = LocalizedText(
    en: 'Material subtotal excludes delivery fees.',
    ar: 'مجموع المواد لا يشمل رسوم التوصيل.',
  );

  static const knownPricesOnly = LocalizedText(
    en: 'Subtotal includes known material prices only.',
    ar: 'المجموع يشمل أسعار المواد المعروفة فقط.',
  );

  static const priceUnknown = LocalizedText(
    en: 'Price unknown',
    ar: 'السعر غير معروف',
  );

  static const refreshPlan = LocalizedText(
    en: 'Refresh plan',
    ar: 'تحديث الخطة',
  );

  static const retry = LocalizedText(
    en: 'Try again',
    ar: 'أعد المحاولة',
  );

  static const backToBuild = LocalizedText(
    en: 'Back to build',
    ar: 'العودة إلى البناء',
  );

  static const noOptimizableTitle = LocalizedText(
    en: 'No items to optimize right now',
    ar: 'لا توجد عناصر قابلة للتحسين حالياً',
  );

  static const noOptimizableBody = LocalizedText(
    en:
        'Your build items are already satisfied, in progress, or need your attention. Smart planning will be available when new items need materials.',
    ar:
        'عناصر البناء لديك مكتملة أو قيد المتابعة أو تحتاج انتباهك. ستتوفر الخطة الذكية عندما تحتاج عناصر جديدة إلى مواد.',
  );

  static const generatedAt = LocalizedText(
    en: 'Plan updated',
    ar: 'تم تحديث الخطة',
  );

  static const viewBuildItem = LocalizedText(
    en: 'View build item',
    ar: 'عرض عنصر البناء',
  );

  static const reserveHelper = LocalizedText(
    en:
        'Reserve links this material to your build checklist, then opens the existing reservation flow. Availability is rechecked before booking.',
    ar:
        'الحجز يربط هذه المادة بقائمة البناء ثم يفتح مسار الحجز الحالي. يتم إعادة التحقق من التوفر قبل الإتمام.',
  );

  static const summaryRequired = LocalizedText(
    en: 'Required',
    ar: 'المطلوبة',
  );

  static const summarySatisfied = LocalizedText(
    en: 'Satisfied',
    ar: 'مكتملة',
  );

  static const summaryInProgress = LocalizedText(
    en: 'In progress',
    ar: 'قيد التوريد',
  );

  static const summaryAttention = LocalizedText(
    en: 'Attention',
    ar: 'تحتاج انتباه',
  );

  static const summaryOptimizable = LocalizedText(
    en: 'Optimizable',
    ar: 'قابلة للتحسين',
  );

  static const summaryRemaining = LocalizedText(
    en: 'Remaining',
    ar: 'المتبقي',
  );

  static const planSelectorTitle = LocalizedText(
    en: 'Choose plan type',
    ar: 'اختر نوع الخطة',
  );

  static const planBestOverallHelper = LocalizedText(
    en: 'Best balance of availability, cost and pickup convenience.',
    ar: 'أفضل توازن بين التوفر والتكلفة وسهولة الاستلام.',
  );

  static const planCheapestHelper = LocalizedText(
    en: 'Lowest known material subtotal.',
    ar: 'أقل مجموع معروف للمواد.',
  );

  static const planFewestPickupHelper = LocalizedText(
    en: 'Reduces the number of pickup stops.',
    ar: 'يقلل عدد محطات الاستلام.',
  );

  static LocalizedText planAlsoLabel(SmartBuildPlanLabel label) => LocalizedText(
    en: 'Also: ${planLabel(label).en}',
    ar: 'أيضاً: ${planLabel(label).ar}',
  );

  static const recommendedPlanBadge = LocalizedText(
    en: 'Recommended plan',
    ar: 'الخطة الموصى بها',
  );

  static const componentsCoveredMetric = LocalizedText(
    en: 'Components covered',
    ar: 'المكونات المغطاة',
  );

  static const planSummaryTitle = LocalizedText(
    en: 'Selected plan',
    ar: 'الخطة المختارة',
  );

  static const coveredComponents = LocalizedText(
    en: 'Covered components',
    ar: 'المكونات المغطاة',
  );

  static const uncoveredComponents = LocalizedText(
    en: 'Uncovered',
    ar: 'غير مغطاة',
  );

  static const materialSubtotal = LocalizedText(
    en: 'Material subtotal',
    ar: 'مجموع المواد',
  );

  static const suppliers = LocalizedText(
    en: 'Suppliers',
    ar: 'الموردون',
  );

  static const pickupLocations = LocalizedText(
    en: 'Pickup locations',
    ar: 'مواقع الاستلام',
  );

  static const unknownPrices = LocalizedText(
    en: 'Unknown prices',
    ar: 'أسعار غير معروفة',
  );

  static const proposedMaterials = LocalizedText(
    en: 'Build materials',
    ar: 'مواد البناء',
  );

  static LocalizedText recommendedMaterials(int count) => LocalizedText(
    en: 'Recommended materials ($count)',
    ar: 'المواد المقترحة ($count)',
  );

  static const reserveSectionHelper = LocalizedText(
    en: 'Availability and quantity are checked again when you reserve.',
    ar: 'يتم التحقق من التوفر والكمية مجدداً عند الحجز.',
  );

  static const requiredComponentLabel = LocalizedText(
    en: 'Required component',
    ar: 'المكون المطلوب',
  );

  static const recommendedMaterialLabel = LocalizedText(
    en: 'Recommended material',
    ar: 'المادة المقترحة',
  );

  static LocalizedText inProgressSection(int count) => LocalizedText(
    en: 'In progress ($count)',
    ar: 'قيد التوريد ($count)',
  );

  static const inProgressCompact = LocalizedText(
    en: 'Active reservation',
    ar: 'حجز نشط',
  );

  static LocalizedText alreadyCoveredSection(int count) => LocalizedText(
    en: 'Already covered ($count)',
    ar: 'مغطى بالفعل ($count)',
  );

  static const alreadyOwned = LocalizedText(
    en: 'Already owned',
    ar: 'مملوك بالفعل',
  );

  static const alreadyAcquired = LocalizedText(
    en: 'Acquired',
    ar: 'تم الحصول عليه',
  );

  static LocalizedText needsAttentionSection(int count) => LocalizedText(
    en: 'Needs attention ($count)',
    ar: 'تحتاج انتباه ($count)',
  );

  static LocalizedText stillMissingSection(int count) => LocalizedText(
    en: 'Still missing — $count components',
    ar: 'ما زال ناقصاً — $count مكونات',
  );

  static const stillMissingSubtext = LocalizedText(
    en:
        "We couldn't find an eligible compatible material on ImpactLoop for these components right now.",
    ar:
        'لم نجد حاليًا مواد متوافقة ومؤهلة على ImpactLoop لهذه المكوّنات.',
  );

  static const notCurrentlyAvailableOnPlatform = LocalizedText(
    en: 'Not currently available on ImpactLoop',
    ar: 'غير متوفر حاليًا على ImpactLoop',
  );

  static const requestThisMaterial = LocalizedText(
    en: 'Request this material',
    ar: 'طلب هذه المادة',
  );

  static const requestActive = LocalizedText(
    en: 'Request active',
    ar: 'الطلب نشط',
  );

  static const viewRequest = LocalizedText(
    en: 'View request',
    ar: 'عرض الطلب',
  );

  static LocalizedText showAllMissing(int count) => LocalizedText(
    en: 'Show all $count missing components',
    ar: 'عرض كل $count المكونات الناقصة',
  );

  static const showLessMissing = LocalizedText(
    en: 'Show less',
    ar: 'عرض أقل',
  );

  static LocalizedText showAllCovered(int count) => LocalizedText(
    en: 'Show all $count',
    ar: 'عرض الكل ($count)',
  );

  static const noMaterialsAvailableTitle = LocalizedText(
    en: 'No new material recommendations right now',
    ar: 'لا توجد توصيات مواد جديدة حاليًا',
  );

  static LocalizedText noMaterialsAvailableBody(int count) => LocalizedText(
    en:
        'The remaining components do not currently have eligible materials available on ImpactLoop.',
    ar:
        'لا تتوفر حاليًا مواد مؤهلة على ImpactLoop للمكوّنات المتبقية.',
  );

  static LocalizedText viewMissingComponents(int count) => LocalizedText(
    en: 'View missing components ($count)',
    ar: 'عرض المكونات الناقصة ($count)',
  );

  static LocalizedText moreReasons(int count) => LocalizedText(
    en: '+$count reasons',
    ar: '+$count أسباب',
  );

  static LocalizedText planCoveredMetric(int covered, int total) => LocalizedText(
    en: '$covered / $total covered',
    ar: '$covered / $total مغطاة',
  );

  static LocalizedText planPickupMetric(int count) => LocalizedText(
    en: '$count locations',
    ar: '$count مواقع',
  );

  static const viewMaterial = LocalizedText(
    en: 'View material',
    ar: 'عرض المادة',
  );

  static const reserveMaterial = LocalizedText(
    en: 'Reserve',
    ar: 'احجز',
  );

  static const requiredQuantity = LocalizedText(
    en: 'Required',
    ar: 'المطلوب',
  );

  static const availableQuantity = LocalizedText(
    en: 'Available',
    ar: 'المتوفر',
  );

  static const attentionBody = LocalizedText(
    en: 'This item needs your attention before planning can continue.',
    ar: 'هذا العنصر يحتاج انتباهك قبل متابعة التخطيط.',
  );

  static const inProgressBody = LocalizedText(
    en: 'Already covered by your current selection or reservation.',
    ar: 'مغطى بالفعل باختيارك أو حجزك الحالي.',
  );

  static const uncoveredBody = LocalizedText(
    en: 'No valid recommendation is currently available.',
    ar: 'لا توجد توصية صالحة متاحة حالياً.',
  );

  static const alreadySatisfiedBody = LocalizedText(
    en: 'Already satisfied for this build.',
    ar: 'مكتمل بالفعل لهذا البناء.',
  );

  static LocalizedText planLabel(SmartBuildPlanLabel label) {
    return switch (label) {
      SmartBuildPlanLabel.bestOverall => const LocalizedText(
        en: 'Best overall',
        ar: 'الأفضل إجمالاً',
      ),
      SmartBuildPlanLabel.cheapest => const LocalizedText(
        en: 'Cheapest',
        ar: 'الأرخص',
      ),
      SmartBuildPlanLabel.fewestPickupLocations => const LocalizedText(
        en: 'Fewest pickup locations',
        ar: 'أقل مواقع استلام',
      ),
    };
  }

  static LocalizedText planHelper(SmartBuildPlanLabel label) {
    return switch (label) {
      SmartBuildPlanLabel.bestOverall => planBestOverallHelper,
      SmartBuildPlanLabel.cheapest => planCheapestHelper,
      SmartBuildPlanLabel.fewestPickupLocations => planFewestPickupHelper,
    };
  }

  static LocalizedText plannerStateLabel(SmartBuildPlannerState state) {
    return switch (state) {
      SmartBuildPlannerState.alreadySatisfied => const LocalizedText(
        en: 'Already satisfied',
        ar: 'مكتمل بالفعل',
      ),
      SmartBuildPlannerState.inProgress => summaryInProgress,
      SmartBuildPlannerState.attention => summaryAttention,
      SmartBuildPlannerState.planned => const LocalizedText(
        en: 'Planned',
        ar: 'مقترح',
      ),
      SmartBuildPlannerState.uncovered => uncoveredComponents,
    };
  }

  static AppStatusTone plannerStateTone(SmartBuildPlannerState state) {
    return switch (state) {
      SmartBuildPlannerState.alreadySatisfied => AppStatusTone.success,
      SmartBuildPlannerState.inProgress => AppStatusTone.info,
      SmartBuildPlannerState.attention => AppStatusTone.warning,
      SmartBuildPlannerState.planned => AppStatusTone.primary,
      SmartBuildPlannerState.uncovered => AppStatusTone.danger,
    };
  }

  static LocalizedText matchTypeLabel(SmartBuildMatchType type) {
    return switch (type) {
      SmartBuildMatchType.exact => const LocalizedText(
        en: 'Exact match',
        ar: 'تطابق تام',
      ),
      SmartBuildMatchType.compatible => const LocalizedText(
        en: 'Compatible match',
        ar: 'تطابق متوافق',
      ),
      SmartBuildMatchType.alternative => const LocalizedText(
        en: 'Approved alternative',
        ar: 'بديل معتمد',
      ),
    };
  }

  static LocalizedText reasonTag(SmartBuildReasonTag tag) {
    return switch (tag) {
      SmartBuildReasonTag.exactMatch => matchTypeLabel(SmartBuildMatchType.exact),
      SmartBuildReasonTag.compatibleMatch =>
        matchTypeLabel(SmartBuildMatchType.compatible),
      SmartBuildReasonTag.approvedAlternative =>
        matchTypeLabel(SmartBuildMatchType.alternative),
      SmartBuildReasonTag.free => const LocalizedText(en: 'Free', ar: 'مجاني'),
      SmartBuildReasonTag.sameCity => const LocalizedText(
        en: 'Same city',
        ar: 'نفس المدينة',
      ),
      SmartBuildReasonTag.sameArea => const LocalizedText(
        en: 'Same area',
        ar: 'نفس المنطقة',
      ),
      SmartBuildReasonTag.samePickupAsOtherItem => const LocalizedText(
        en: 'Same pickup as another item',
        ar: 'نفس موقع الاستلام لعنصر آخر',
      ),
      SmartBuildReasonTag.sameSupplierAsOtherItem => const LocalizedText(
        en: 'Same supplier as another item',
        ar: 'نفس المورد لعنصر آخر',
      ),
      SmartBuildReasonTag.onlyCompatibleOption => const LocalizedText(
        en: 'Only compatible option',
        ar: 'الخيار المتوافق الوحيد',
      ),
    };
  }

  static LocalizedText uncoveredReason(SmartBuildUncoveredReason reason) {
    return switch (reason) {
      SmartBuildUncoveredReason.noEligibleCandidates => const LocalizedText(
        en: 'No eligible materials found',
        ar: 'لم يتم العثور على مواد مؤهلة',
      ),
      SmartBuildUncoveredReason.insufficientAvailableQuantity =>
        const LocalizedText(
          en: 'Insufficient available quantity',
          ar: 'الكمية المتاحة غير كافية',
        ),
      SmartBuildUncoveredReason.incompatibleUnit => const LocalizedText(
        en: 'Incompatible unit',
        ar: 'وحدة غير متوافقة',
      ),
      SmartBuildUncoveredReason.noAvailableMaterial => const LocalizedText(
        en: 'No available material',
        ar: 'لا توجد مادة متاحة',
      ),
      SmartBuildUncoveredReason.notOptimizable => const LocalizedText(
        en: 'Not optimizable',
        ar: 'غير قابل للتحسين',
      ),
    };
  }
}
