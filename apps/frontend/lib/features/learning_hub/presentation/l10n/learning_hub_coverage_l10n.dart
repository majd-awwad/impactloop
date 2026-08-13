import 'package:flutter/widgets.dart';

import '../../domain/models/project_material_coverage.dart';

class LearningHubCoverageL10n {
  const LearningHubCoverageL10n(this.context);

  final BuildContext context;

  static LearningHubCoverageL10n of(BuildContext context) {
    return LearningHubCoverageL10n(context);
  }

  bool get isArabic => Localizations.localeOf(context).languageCode == 'ar';

  String t(String en, String ar) => isArabic ? ar : en;

  String get publicCoverageTitle => t('Material availability', 'توفر المواد');

  String totalMaterials(int count) =>
      isArabic ? '$count مطلوبة' : '$count required';

  String availableMaterials(int count) =>
      isArabic ? '$count متوفرة' : '$count available';

  String missingMaterials(int count) =>
      isArabic ? '$count غير متوفرة' : '$count unavailable';

  String get personalReadinessTitle =>
      t('Your build readiness', 'جاهزية مشروعك');

  String publicCoverageSummary(ProjectMaterialCoverageSummary summary) {
    if (summary.totalRequiredComponents == 0) {
      return t(
        'No required material components listed',
        'لا توجد مكوّنات مواد مطلوبة مدرجة',
      );
    }

    if (summary.coverageLevel == ProjectMaterialCoverageLevel.full) {
      return t(
        'All required materials available',
        'جميع المواد المطلوبة متوفرة',
      );
    }

    if (summary.missingComponents == 1) {
      return t('1 material currently missing', 'مادة واحدة غير متوفرة حاليًا');
    }

    if (summary.missingComponents > 1) {
      if (isArabic) {
        return '${summary.missingComponents} مواد غير متوفرة حاليًا';
      }
      return '${summary.missingComponents} materials currently missing';
    }

    if (isArabic) {
      return '${summary.availableComponents} من ${summary.totalRequiredComponents} مواد متوفرة';
    }

    return '${summary.availableComponents} of ${summary.totalRequiredComponents} materials available';
  }

  String publicCoverageCardLabel(ProjectMaterialCoverageSummary summary) {
    if (summary.totalRequiredComponents == 0) {
      return t('No materials listed', 'لا توجد مواد مدرجة');
    }

    if (summary.coverageLevel == ProjectMaterialCoverageLevel.full) {
      return t('All materials available', 'جميع المواد متوفرة');
    }

    if (summary.missingComponents == 1) {
      return t('1 material missing', 'مادة واحدة مفقودة');
    }

    if (summary.missingComponents > 1) {
      if (isArabic) {
        return '${summary.missingComponents} مواد مفقودة';
      }
      return '${summary.missingComponents} materials missing';
    }

    if (isArabic) {
      return '${summary.availableComponents} من ${summary.totalRequiredComponents} مواد متوفرة';
    }

    return '${summary.availableComponents} of ${summary.totalRequiredComponents} materials available';
  }

  String personalReadinessCardLabel(ProjectPersonalBuildReadiness readiness) {
    return personalReadinessSummary(readiness);
  }

  String personalReadinessSummary(ProjectPersonalBuildReadiness readiness) {
    if (isArabic) {
      return '${readiness.readyComponents} من ${readiness.totalRequiredComponents} جاهزة في مشروعك';
    }

    return '${readiness.readyComponents} of ${readiness.totalRequiredComponents} ready in your build';
  }

  String personalNeedsMaterials(ProjectPersonalBuildReadiness readiness) {
    if (readiness.needsMaterialComponents <= 0) {
      return '';
    }

    if (readiness.needsMaterialComponents == 1) {
      return t(
        '1 component still needs materials',
        'ما زال مكوّن واحد بحاجة إلى مواد',
      );
    }

    if (isArabic) {
      return 'ما زال ${readiness.needsMaterialComponents} مكوّنات بحاجة إلى مواد';
    }

    return '${readiness.needsMaterialComponents} components still need materials';
  }

  String get continueBuild => t('Continue build', 'متابعة التنفيذ');

  String availabilityStatusLabel(ComponentPublicAvailabilityStatus status) {
    switch (status) {
      case ComponentPublicAvailabilityStatus.available:
        return t('Available', 'متوفرة');
      case ComponentPublicAvailabilityStatus.partial:
        return t('Partial', 'جزئية');
      case ComponentPublicAvailabilityStatus.missing:
        return t('Missing', 'غير متوفرة');
      case ComponentPublicAvailabilityStatus.unknown:
        return t('Unknown', 'غير معروف');
    }
  }

  String get filterAny => t('Any availability', 'أي حالة توفر');

  String get filterFull => t('All materials available', 'جميع المواد متوفرة');

  String get filterMost => t('Most materials available', 'معظم المواد متوفرة');

  String get filterSome => t('Some materials available', 'بعض المواد متوفرة');

  String get filterNone => t('No materials available', 'لا توجد مواد متوفرة');

  String get sortRecommended => t('Recommended', 'مقترحة');

  String get sortMostAvailable =>
      t('Most materials available', 'الأكثر توفرًا للمواد');

  String get sortShortestDuration => t('Shortest duration', 'الأقصر مدة');

  String get sortEasiest => t('Easiest first', 'الأسهل أولًا');

  String get sortMostPopular => t('Most popular', 'الأكثر شيوعًا');

  String get sortNewest => t('Newest', 'الأحدث');
}
