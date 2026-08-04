import 'package:flutter/widgets.dart';

import '../../data/models/material_related_projects.dart';

class MaterialRelatedProjectsL10n {
  const MaterialRelatedProjectsL10n(this.context);

  final BuildContext context;

  static MaterialRelatedProjectsL10n of(BuildContext context) {
    return MaterialRelatedProjectsL10n(context);
  }

  bool get isArabic => Localizations.localeOf(context).languageCode == 'ar';

  String t(String en, String ar) => isArabic ? ar : en;

  String get sectionTitle => t(
    'Projects you can build with this material',
    'مشاريع يمكنك تنفيذها بهذه المادة',
  );

  String get sectionSubtitle => t(
    'See which project components this material can match.',
    'اكتشف مكوّنات المشاريع التي يمكن أن تناسبها هذه المادة.',
  );

  String get emptyTitle => t(
    'No matching projects found yet.',
    'لم يتم العثور على مشاريع مطابقة حاليًا.',
  );

  String get emptyBody => t(
    'This material does not currently match a published project component.',
    'لا تتطابق هذه المادة حاليًا مع مكوّن في مشروع منشور.',
  );

  String get browseLearningHub => t(
    'Browse Learning Hub',
    'تصفح مركز التعلم',
  );

  String get loadError => t(
    'Couldn’t load related projects.',
    'تعذر تحميل المشاريع المرتبطة.',
  );

  String get retry => t('Try again', 'إعادة المحاولة');

  String get loadMore => t('Load more', 'عرض المزيد');

  String get viewProject => t('View project', 'عرض المشروع');

  String get startBuild => t('Start build', 'ابدأ التنفيذ');

  String get continueBuild => t('Continue build', 'متابعة التنفيذ');

  String matchedComponentLabel(String componentName) => t(
    'Matches: $componentName',
    'تطابق: $componentName',
  );

  String matchTypeLabel(MaterialRelatedProjectMatchType type) {
    switch (type) {
      case MaterialRelatedProjectMatchType.exact:
        return t('Exact match', 'تطابق مباشر');
      case MaterialRelatedProjectMatchType.compatible:
        return t('Compatible', 'متوافقة');
      case MaterialRelatedProjectMatchType.alternative:
        return t('Alternative', 'بديل مناسب');
    }
  }

  String additionalMatchesLabel(int count) {
    if (count <= 0) {
      return '';
    }

    if (count == 1) {
      return t(
        'Also matches 1 more component',
        'تطابق أيضًا مكوّنًا إضافيًا واحدًا',
      );
    }

    if (isArabic) {
      return 'تطابق أيضًا $count مكوّنات إضافية';
    }

    return 'Also matches $count more components';
  }

  String likesLabel(int count) {
    if (count == 1) {
      return t('1 like', 'إعجاب واحد');
    }

    if (isArabic) {
      return '$count إعجابات';
    }

    return '$count likes';
  }
}
