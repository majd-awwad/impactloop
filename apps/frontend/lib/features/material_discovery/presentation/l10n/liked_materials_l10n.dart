import 'package:flutter/widgets.dart';

class LikedMaterialsL10n {
  LikedMaterialsL10n._(this._languageCode);

  final String _languageCode;

  bool get isArabic => _languageCode == 'ar';

  static LikedMaterialsL10n of(BuildContext context) => LikedMaterialsL10n._(
    Localizations.localeOf(context).languageCode.toLowerCase(),
  );

  String t(String en, String ar) => isArabic ? ar : en;

  String get title => t('Liked materials', 'المواد التي أعجبتني');
  String get description => t(
    'Return to reusable materials you liked and open their latest details.',
    'عُد إلى المواد القابلة لإعادة الاستخدام التي أعجبتك وافتح أحدث تفاصيلها.',
  );
  String get back => t('Back', 'رجوع');
  String get refresh => t('Refresh liked materials', 'تحديث المواد المعجب بها');
  String get loading =>
      t('Loading liked materials…', 'جارٍ تحميل المواد المعجب بها…');
  String get emptyTitle =>
      t('No liked materials yet', 'لا توجد مواد أعجبتك بعد');
  String get emptyBody => t(
    'Like materials from their details to return to them here.',
    'أبدِ إعجابك بالمواد من صفحة تفاصيلها لتعود إليها هنا.',
  );
  String get browseMaterials => t('Browse materials', 'تصفّح المواد');
  String get loadFailed =>
      t('Could not load liked materials.', 'تعذّر تحميل المواد المعجب بها.');
  String get retry => t('Try again', 'حاول مرة أخرى');
  String get loadingMore => t('Loading more…', 'جارٍ تحميل المزيد…');
  String get loadMore => t('Load more', 'تحميل المزيد');
  String get loadMoreFailed => t(
    'Could not load more materials. Your current items are still available.',
    'تعذّر تحميل المزيد من المواد. لا تزال العناصر الحالية متاحة.',
  );
  String get refreshFailed => t(
    'The collection could not be refreshed. Try again.',
    'تعذّر تحديث المجموعة. حاول مرة أخرى.',
  );
  String get unlikeFailed => t(
    'Could not remove this material from your likes.',
    'تعذّرت إزالة الإعجاب بهذه المادة.',
  );
  String showing(int loaded, int total) =>
      t('Showing $loaded of $total', 'عرض $loaded من $total');
  String openMaterial(String title) => t('Open $title', 'فتح $title');
  String removeMaterial(String title) => t(
    'Remove $title from liked materials',
    'إزالة $title من المواد التي أعجبتني',
  );
}
