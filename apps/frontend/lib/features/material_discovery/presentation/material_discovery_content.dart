import 'package:flutter/material.dart';

import '../../../shared/models/localized_text.dart';
import '../domain/discovery_material.dart';

const materialDiscoveryNoMaterialsTitle = LocalizedText(
  en: 'No materials available yet',
  ar: 'لا توجد مواد متاحة حالياً',
);

const materialDiscoveryNoMaterialsSubtitle = LocalizedText(
  en: 'When suppliers publish reusable materials, they will appear here.',
  ar: 'عندما ينشر الموردون مواد قابلة لإعادة الاستخدام، ستظهر هنا.',
);

const materialDiscoveryEmptyTitle = LocalizedText(
  en: 'No materials matched this combination yet',
  ar: 'لا توجد مواد تطابق هذا الجمع حالياً',
);

const materialDiscoveryEmptySubtitle = LocalizedText(
  en: 'Try a broader search, switch category chips, or clear filters to start again.',
  ar: 'جرّب بحثاً أوسع أو غيّر الفلاتر أو امسحها للبدء من جديد.',
);

const materialQuickFilters = <LocalizedText>[
  LocalizedText(en: 'All results', ar: 'كل النتائج'),
  LocalizedText(en: 'Free only', ar: 'مجاني فقط'),
  LocalizedText(en: 'Paid only', ar: 'مدفوع فقط'),
  LocalizedText(en: 'Delivery', ar: 'يوجد توصيل'),
  LocalizedText(en: 'Pickup only', ar: 'استلام فقط'),
];

const materialSortOptions = <LocalizedText>[
  LocalizedText(en: 'Newest', ar: 'الأحدث'),
  LocalizedText(en: 'Popular', ar: 'الأكثر شعبية'),
];

const materialConditionFilters = <({String? value, LocalizedText label})>[
  (value: null, label: LocalizedText(en: 'Any condition', ar: 'أي حالة')),
  (value: 'NEW', label: LocalizedText(en: 'New', ar: 'جديدة')),
  (value: 'LIKE_NEW', label: LocalizedText(en: 'Like new', ar: 'شبه جديدة')),
  (value: 'GOOD', label: LocalizedText(en: 'Good', ar: 'جيدة')),
  (value: 'USED', label: LocalizedText(en: 'Used', ar: 'مستعملة')),
  (
    value: 'NEEDS_REPAIR',
    label: LocalizedText(en: 'Needs repair', ar: 'تحتاج إصلاحاً'),
  ),
];

List<Color> materialGradient(DiscoveryMaterial material) {
  return material.cardGradient.map(Color.new).toList();
}
