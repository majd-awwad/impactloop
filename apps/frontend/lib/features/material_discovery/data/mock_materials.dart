import 'package:flutter/material.dart';

import '../../../shared/models/localized_text.dart';
import '../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../shared/widgets/materials/material_status_badge.dart';
import '../domain/discovery_material.dart';

const mockMaterials = <DiscoveryMaterial>[
  DiscoveryMaterial(
    id: 'plywood-panels',
    title: LocalizedText(
      en: 'Reclaimed Birch Plywood Panels',
      ar: 'ألواح خشب رقائقي معاد استخدامها',
    ),
    description: LocalizedText(
      en: 'Clean workshop offcuts suitable for shelving, prototypes, and student build bases.',
      ar: 'قصاصات ورش نظيفة مناسبة للأرفف والنماذج الأولية وقواعد مشاريع الطلبة.',
    ),
    category: LocalizedText(en: 'Wood', ar: 'خشب'),
    conditionLabel: LocalizedText(en: 'Good', ar: 'جيدة'),
    conditionTone: MaterialConditionBadgeTone.good,
    statusLabel: LocalizedText(en: 'Available', ar: 'متاح'),
    statusTone: MaterialStatusBadgeTone.available,
    quantityLabel: LocalizedText(en: '18 sheets', ar: '18 لوحاً'),
    priceLabel: LocalizedText(en: 'Free', ar: 'مجاناً'),
    locationLabel: LocalizedText(en: 'Nablus, Industrial Area', ar: 'نابلس، المنطقة الصناعية'),
    availabilityLabel: LocalizedText(
      en: 'Delivery available',
      ar: 'التوصيل متاح',
    ),
    deliveryAvailable: true,
    isFree: true,
    supplierName: LocalizedText(
      en: 'Green Workshop Co.',
      ar: 'ورشة جرين ووركشوب',
    ),
    supplierSubtitle: LocalizedText(
      en: 'Furniture prototyping supplier',
      ar: 'مورد نماذج أثاث أولية',
    ),
    heroIconData: Icons.carpenter_outlined,
    cardGradient: [0xFF2E4738, 0xFF17211B],
    ratingLabel: LocalizedText(en: '4.8', ar: '4.8'),
    imageUrl:
        'https://unsplash.com/photos/uqh5Pbv0d4s/download?force=true&w=1200',
  ),
  DiscoveryMaterial(
    id: 'arduino-sensors',
    title: LocalizedText(
      en: 'Arduino Sensors Starter Bundle',
      ar: 'حزمة حساسات أردوينو للمبتدئين',
    ),
    description: LocalizedText(
      en: 'Mixed ultrasonic, light, and soil sensors recovered from classroom demo kits.',
      ar: 'حساسات متنوعة فوق صوتية وضوئية ورطوبة تربة مسترجعة من حقائب عروض صفية.',
    ),
    category: LocalizedText(en: 'Electronics', ar: 'إلكترونيات'),
    conditionLabel: LocalizedText(en: 'Like new', ar: 'شبه جديدة'),
    conditionTone: MaterialConditionBadgeTone.likeNew,
    statusLabel: LocalizedText(en: 'Available', ar: 'متاح'),
    statusTone: MaterialStatusBadgeTone.available,
    quantityLabel: LocalizedText(en: '24 pieces', ar: '24 قطعة'),
    priceLabel: LocalizedText(en: '\$18 bundle', ar: '18\$ للحزمة'),
    locationLabel: LocalizedText(en: 'Ramallah, Al-Tireh', ar: 'رام الله، الطيرة'),
    availabilityLabel: LocalizedText(en: 'Pickup only', ar: 'استلام فقط'),
    deliveryAvailable: false,
    isFree: false,
    supplierName: LocalizedText(
      en: 'Circuit Room',
      ar: 'غرفة الدوائر',
    ),
    supplierSubtitle: LocalizedText(
      en: 'Educational electronics lab',
      ar: 'مختبر إلكترونيات تعليمية',
    ),
    heroIconData: Icons.memory_rounded,
    cardGradient: [0xFF1C3F66, 0xFF121E2D],
    ratingLabel: LocalizedText(en: '4.9', ar: '4.9'),
    imageUrl:
        'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  ),
  DiscoveryMaterial(
    id: 'steel-tubes',
    title: LocalizedText(
      en: 'Powder-Coated Steel Tube Cuts',
      ar: 'قصاصات أنابيب فولاذ مطلية',
    ),
    description: LocalizedText(
      en: 'Straight metal cuts ideal for frames, benches, and student fabrication practice.',
      ar: 'قصات معدنية مستقيمة مناسبة للهياكل والمقاعد وتدريب التصنيع الطلابي.',
    ),
    category: LocalizedText(en: 'Metal', ar: 'معادن'),
    conditionLabel: LocalizedText(en: 'Fair', ar: 'متوسطة'),
    conditionTone: MaterialConditionBadgeTone.fair,
    statusLabel: LocalizedText(en: 'Reserved', ar: 'محجوز'),
    statusTone: MaterialStatusBadgeTone.reserved,
    quantityLabel: LocalizedText(en: '32 cuts', ar: '32 قطعة'),
    priceLabel: LocalizedText(en: '\$12 lot', ar: '12\$ للدفعة'),
    locationLabel: LocalizedText(en: 'Hebron, Workshop Zone', ar: 'الخليل، منطقة الورش'),
    availabilityLabel: LocalizedText(
      en: 'Delivery available',
      ar: 'التوصيل متاح',
    ),
    deliveryAvailable: true,
    isFree: false,
    supplierName: LocalizedText(
      en: 'ForgeLine Works',
      ar: 'فورج لاين',
    ),
    supplierSubtitle: LocalizedText(
      en: 'Metal fabrication supplier',
      ar: 'مورد تصنيع معدني',
    ),
    heroIconData: Icons.precision_manufacturing_outlined,
    cardGradient: [0xFF48515A, 0xFF1E252B],
    imageUrl:
        'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80',
  ),
  DiscoveryMaterial(
    id: 'plastic-crates',
    title: LocalizedText(
      en: 'Stackable Plastic Crates',
      ar: 'صناديق بلاستيكية قابلة للتكديس',
    ),
    description: LocalizedText(
      en: 'Sturdy crates useful for storage systems, sorting walls, and mobile workshop setups.',
      ar: 'صناديق متينة تفيد في أنظمة التخزين وجدران الفرز وتجهيز الورش المتنقلة.',
    ),
    category: LocalizedText(en: 'Plastic', ar: 'بلاستيك'),
    conditionLabel: LocalizedText(en: 'Good', ar: 'جيدة'),
    conditionTone: MaterialConditionBadgeTone.good,
    statusLabel: LocalizedText(en: 'Available', ar: 'متاح'),
    statusTone: MaterialStatusBadgeTone.available,
    quantityLabel: LocalizedText(en: '11 crates', ar: '11 صندوقاً'),
    priceLabel: LocalizedText(en: 'Free', ar: 'مجاناً'),
    locationLabel: LocalizedText(en: 'Bethlehem, City North', ar: 'بيت لحم، شمال المدينة'),
    availabilityLabel: LocalizedText(en: 'Pickup only', ar: 'استلام فقط'),
    deliveryAvailable: false,
    isFree: true,
    supplierName: LocalizedText(
      en: 'Loop Storage Hub',
      ar: 'مخزن لوب',
    ),
    supplierSubtitle: LocalizedText(
      en: 'Reusable storage provider',
      ar: 'مزود تخزين قابل لإعادة الاستخدام',
    ),
    heroIconData: Icons.inventory_outlined,
    cardGradient: [0xFF20504D, 0xFF152724],
    ratingLabel: LocalizedText(en: '4.6', ar: '4.6'),
    imageUrl:
        'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=1200&q=80',
  ),
  DiscoveryMaterial(
    id: 'denim-rolls',
    title: LocalizedText(
      en: 'Denim Fabric Rolls',
      ar: 'لفات قماش دينم',
    ),
    description: LocalizedText(
      en: 'Large offcuts from uniform production suited for bags, covers, and craft prototypes.',
      ar: 'قصاصات كبيرة من إنتاج الزي تصلح للحقائب والأغطية والنماذج الحرفية.',
    ),
    category: LocalizedText(en: 'Fabric', ar: 'أقمشة'),
    conditionLabel: LocalizedText(en: 'Mixed', ar: 'متفاوتة'),
    conditionTone: MaterialConditionBadgeTone.mixed,
    statusLabel: LocalizedText(en: 'Available', ar: 'متاح'),
    statusTone: MaterialStatusBadgeTone.available,
    quantityLabel: LocalizedText(en: '46 kg', ar: '46 كغم'),
    priceLabel: LocalizedText(en: '\$9 per roll', ar: '9\$ لكل لفة'),
    locationLabel: LocalizedText(en: 'Jenin, East Market', ar: 'جنين، السوق الشرقي'),
    availabilityLabel: LocalizedText(
      en: 'Delivery available',
      ar: 'التوصيل متاح',
    ),
    deliveryAvailable: true,
    isFree: false,
    supplierName: LocalizedText(
      en: 'Blue Thread Studio',
      ar: 'بلو ثريد',
    ),
    supplierSubtitle: LocalizedText(
      en: 'Textile reuse supplier',
      ar: 'مورد إعادة استخدام الأقمشة',
    ),
    heroIconData: Icons.checkroom_outlined,
    cardGradient: [0xFF39506B, 0xFF1C2432],
    imageUrl:
        'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1200&q=80',
  ),
  DiscoveryMaterial(
    id: 'acrylic-panels',
    title: LocalizedText(
      en: 'Clear Acrylic Display Panels',
      ar: 'ألواح أكريليك شفافة للعرض',
    ),
    description: LocalizedText(
      en: 'Laser-cut leftovers that work well for protective covers, signs, and enclosure mockups.',
      ar: 'بقايا مقصوصة بالليزر تصلح للأغطية الواقية واللافتات ونماذج الحاويات.',
    ),
    category: LocalizedText(en: 'Plastic', ar: 'بلاستيك'),
    conditionLabel: LocalizedText(en: 'Like new', ar: 'شبه جديدة'),
    conditionTone: MaterialConditionBadgeTone.likeNew,
    statusLabel: LocalizedText(en: 'Draft', ar: 'مسودة'),
    statusTone: MaterialStatusBadgeTone.draft,
    quantityLabel: LocalizedText(en: '14 panels', ar: '14 لوحاً'),
    priceLabel: LocalizedText(en: '\$7 set', ar: '7\$ للمجموعة'),
    locationLabel: LocalizedText(en: 'Tulkarm, Main Street', ar: 'طولكرم، الشارع الرئيسي'),
    availabilityLabel: LocalizedText(en: 'Pickup only', ar: 'استلام فقط'),
    deliveryAvailable: false,
    isFree: false,
    supplierName: LocalizedText(
      en: 'Display Craft Lab',
      ar: 'مختبر العرض',
    ),
    supplierSubtitle: LocalizedText(
      en: 'Acrylic and signage workshop',
      ar: 'ورشة أكريليك ولافتات',
    ),
    heroIconData: Icons.layers_outlined,
    cardGradient: [0xFF1E5C63, 0xFF132730],
    imageUrl:
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
  ),
];
DiscoveryMaterial? mockMaterialById(String id) {
  for (final material in mockMaterials) {
    if (material.id == id) {
      return material;
    }
  }

  return null;
}
