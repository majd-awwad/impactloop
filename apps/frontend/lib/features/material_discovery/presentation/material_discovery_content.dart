import 'package:flutter/material.dart';

import '../../../shared/models/localized_text.dart';
import '../domain/discovery_material.dart';

const materialDiscoveryStats = <LocalizedText, String>{
  LocalizedText(en: 'Materials ready', ar: 'مواد جاهزة'): '84',
  LocalizedText(en: 'Cities covered', ar: 'مدن مغطاة'): '12',
  LocalizedText(en: 'Free listings', ar: 'مواد مجانية'): '39',
};

const materialDiscoveryTip = LocalizedText(
  en: 'Discovery cards are designed to be reused later inside Supplier pages, reservation previews, and other marketplace sections.',
  ar: 'تم تصميم بطاقات المواد لتُعاد استخدامها لاحقاً داخل صفحات المورد ومعاينات الحجوزات وأقسام السوق الأخرى.',
);

const materialDiscoveryEmptyTitle = LocalizedText(
  en: 'No materials matched this combination yet',
  ar: 'لا توجد مواد تطابق هذا الجمع حالياً',
);

const materialDiscoveryEmptySubtitle = LocalizedText(
  en: 'Try a broader search, switch category chips, or open the public list again later.',
  ar: 'جرّب بحثاً أوسع أو غيّر الفلاتر أو عد إلى القائمة العامة لاحقاً.',
);

const materialDiscoveryCategories = <LocalizedText>[
  LocalizedText(en: 'All', ar: 'الكل'),
  LocalizedText(en: 'Wood', ar: 'خشب'),
  LocalizedText(en: 'Electronics', ar: 'إلكترونيات'),
  LocalizedText(en: 'Metal', ar: 'معادن'),
  LocalizedText(en: 'Plastic', ar: 'بلاستيك'),
  LocalizedText(en: 'Fabric', ar: 'أقمشة'),
];

const materialQuickFilters = <LocalizedText>[
  LocalizedText(en: 'All results', ar: 'كل النتائج'),
  LocalizedText(en: 'Available now', ar: 'متاح الآن'),
  LocalizedText(en: 'Free only', ar: 'مجاني فقط'),
  LocalizedText(en: 'Delivery', ar: 'يوجد توصيل'),
];

List<Color> materialGradient(DiscoveryMaterial material) {
  return material.cardGradient.map(Color.new).toList();
}
