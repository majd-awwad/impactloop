import 'package:flutter/material.dart';

import '../../../shared/models/localized_text.dart';
import '../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../shared/widgets/materials/material_status_badge.dart';
import '../domain/discovery_material.dart';

class MaterialDiscoveryApiMapper {
  const MaterialDiscoveryApiMapper._();

  static DiscoveryMaterial fromJson(Map<String, dynamic> json) {
    final categoryJson = _asMap(json['category']);
    final categoryNameEn = _stringOrFallback(
      categoryJson?['nameEn'],
      fallback: 'Materials',
    );
    final categoryNameAr = _stringOrFallback(
      categoryJson?['nameAr'],
      fallback: categoryNameEn,
    );
    final supplierName = _stringOrFallback(
      json['supplierName'],
      fallback: 'ImpactLoop supplier',
    );
    final condition = _stringOrFallback(json['condition'], fallback: 'GOOD');
    final status = _stringOrFallback(json['status'], fallback: 'AVAILABLE');
    final quantity = _numberFromDynamic(json['quantity']);
    final unit = _stringOrFallback(json['unit'], fallback: 'items');
    final isFree = json['isFree'] == true;
    final price = _numberFromDynamic(json['price']);
    final city = _nullableString(json['city']);
    final area = _nullableString(json['area']);
    final deliveryAvailable = json['deliveryAvailable'] == true;
    final ratingSummary = _numberFromDynamic(json['ratingSummary']);

    final conditionMeta = _conditionMeta(condition);
    final statusMeta = _statusMeta(status);
    final categoryLabel = LocalizedText(en: categoryNameEn, ar: categoryNameAr);
    final title = _stringOrFallback(json['title'], fallback: 'Untitled material');
    final description = _stringOrFallback(
      json['description'],
      fallback: 'No description available.',
    );

    return DiscoveryMaterial(
      id: _stringOrFallback(json['id'], fallback: ''),
      // TODO: replace duplicated EN/AR title text when backend exposes bilingual fields.
      title: LocalizedText(en: title, ar: title),
      description: LocalizedText(en: description, ar: description),
      category: categoryLabel,
      conditionLabel: conditionMeta.label,
      conditionTone: conditionMeta.tone,
      statusLabel: statusMeta.label,
      statusTone: statusMeta.tone,
      quantityLabel: _quantityLabel(quantity, unit),
      priceLabel: _priceLabel(isFree: isFree, price: price),
      locationLabel: _locationLabel(city: city, area: area),
      availabilityLabel: LocalizedText(
        en: deliveryAvailable ? 'Delivery available' : 'Pickup only',
        ar: deliveryAvailable ? 'التوصيل متاح' : 'استلام فقط',
      ),
      deliveryAvailable: deliveryAvailable,
      isFree: isFree,
      supplierName: LocalizedText(en: supplierName, ar: supplierName),
      supplierSubtitle: LocalizedText(
        en: 'Material supplier',
        ar: 'مورد مواد',
      ),
      heroIconData: _heroIconForCategory(categoryNameEn),
      cardGradient: _gradientForCategory(categoryNameEn),
      imageUrl: _imageUrl(json, categoryNameEn),
      ratingLabel: ratingSummary == null
          ? null
          : LocalizedText(
              en: _formatCompactNumber(ratingSummary),
              ar: _formatCompactNumber(ratingSummary),
            ),
    );
  }

  static Map<String, dynamic>? _asMap(Object? value) {
    if (value is Map<String, dynamic>) {
      return value;
    }

    return null;
  }

  static String _stringOrFallback(Object? value, {required String fallback}) {
    final normalized = _nullableString(value);
    if (normalized == null || normalized.isEmpty) {
      return fallback;
    }

    return normalized;
  }

  static String? _nullableString(Object? value) {
    if (value == null) {
      return null;
    }

    final normalized = value.toString().trim();
    return normalized.isEmpty ? null : normalized;
  }

  static String _imageUrl(Map<String, dynamic> json, String categoryNameEn) {
    final directImage = _nullableString(json['imageUrl']);
    if (directImage != null) {
      return directImage;
    }

    final imageUrls = json['imageUrls'];
    if (imageUrls is List) {
      for (final image in imageUrls) {
        if (image is Map) {
          final url = _nullableString(image['url'] ?? image['imageUrl']);
          if (url != null) {
            return url;
          }
        } else {
          final url = _nullableString(image);
          if (url != null) {
            return url;
          }
        }
      }
    }

    return _fallbackImageForCategory(categoryNameEn);
  }

  static String _fallbackImageForCategory(String categoryNameEn) {
    final normalized = categoryNameEn.toLowerCase();

    if (normalized.contains('wood')) {
      return 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80';
    }

    if (normalized.contains('electronic') ||
        normalized.contains('sensor') ||
        normalized.contains('circuit')) {
      return 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80';
    }

    if (normalized.contains('metal') || normalized.contains('steel')) {
      return 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80';
    }

    if (normalized.contains('plastic') || normalized.contains('acrylic')) {
      return 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=1200&q=80';
    }

    if (normalized.contains('fabric') ||
        normalized.contains('textile') ||
        normalized.contains('denim')) {
      return 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1200&q=80';
    }

    return 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80';
  }

  static double? _numberFromDynamic(Object? value) {
    if (value == null) {
      return null;
    }

    if (value is num) {
      return value.toDouble();
    }

    return double.tryParse(value.toString());
  }

  static LocalizedText _quantityLabel(double? quantity, String unit) {
    final quantityText = quantity == null ? '--' : _formatCompactNumber(quantity);
    return LocalizedText(
      en: '$quantityText $unit',
      ar: '$quantityText $unit',
    );
  }

  static LocalizedText _priceLabel({
    required bool isFree,
    required double? price,
  }) {
    if (isFree) {
      return const LocalizedText(en: 'Free', ar: 'مجاناً');
    }

    if (price == null) {
      return const LocalizedText(en: 'Price on request', ar: 'السعر عند الطلب');
    }

    final priceText = _formatCompactNumber(price);
    return LocalizedText(
      en: 'NIS $priceText',
      ar: '$priceText شيكل',
    );
  }

  static LocalizedText _locationLabel({
    required String? city,
    required String? area,
  }) {
    if (city == null && area == null) {
      return const LocalizedText(
        en: 'Location shared on request',
        ar: 'يتم مشاركة الموقع عند الطلب',
      );
    }

    if (city != null && area != null) {
      return LocalizedText(en: '$city, $area', ar: '$city، $area');
    }

    final label = city ?? area!;
    return LocalizedText(en: label, ar: label);
  }

  static ({LocalizedText label, MaterialConditionBadgeTone tone}) _conditionMeta(
    String value,
  ) {
    switch (value) {
      case 'LIKE_NEW':
        return (
          label: const LocalizedText(en: 'Like new', ar: 'شبه جديدة'),
          tone: MaterialConditionBadgeTone.likeNew,
        );
      case 'USED':
        return (
          label: const LocalizedText(en: 'Used', ar: 'مستعملة'),
          tone: MaterialConditionBadgeTone.fair,
        );
      case 'NEW':
        return (
          label: const LocalizedText(en: 'New', ar: 'جديدة'),
          tone: MaterialConditionBadgeTone.likeNew,
        );
      case 'NEEDS_REPAIR':
        return (
          label: const LocalizedText(en: 'Needs repair', ar: 'تحتاج إصلاحاً'),
          tone: MaterialConditionBadgeTone.mixed,
        );
      case 'GOOD':
      default:
        return (
          label: const LocalizedText(en: 'Good', ar: 'جيدة'),
          tone: MaterialConditionBadgeTone.good,
        );
    }
  }

  static ({LocalizedText label, MaterialStatusBadgeTone tone}) _statusMeta(
    String value,
  ) {
    switch (value) {
      case 'PENDING_RESERVATION':
        return (
          label: const LocalizedText(
            en: 'Pending reservation',
            ar: 'بانتظار الحجز',
          ),
          tone: MaterialStatusBadgeTone.reserved,
        );
      case 'RESERVED':
        return (
          label: const LocalizedText(en: 'Reserved', ar: 'محجوز'),
          tone: MaterialStatusBadgeTone.reserved,
        );
      case 'REUSED':
        return (
          label: const LocalizedText(en: 'Reused', ar: 'أعيد استخدامها'),
          tone: MaterialStatusBadgeTone.reused,
        );
      case 'UNAVAILABLE':
        return (
          label: const LocalizedText(en: 'Unavailable', ar: 'غير متاح'),
          tone: MaterialStatusBadgeTone.draft,
        );
      case 'AVAILABLE':
      default:
        return (
          label: const LocalizedText(en: 'Available', ar: 'متاح'),
          tone: MaterialStatusBadgeTone.available,
        );
    }
  }

  static IconData _heroIconForCategory(String categoryName) {
    switch (categoryName.toLowerCase()) {
      case 'electronics':
        return Icons.memory_rounded;
      case 'wood':
      case 'wood & panels':
        return Icons.carpenter_outlined;
      case 'plastics':
      case 'plastic':
        return Icons.layers_outlined;
      case 'fabric':
      case 'fabric & textiles':
        return Icons.checkroom_outlined;
      case 'tools & hardware':
        return Icons.precision_manufacturing_outlined;
      default:
        return Icons.inventory_2_outlined;
    }
  }

  static List<int> _gradientForCategory(String categoryName) {
    switch (categoryName.toLowerCase()) {
      case 'electronics':
        return [0xFF1C3F66, 0xFF121E2D];
      case 'wood':
      case 'wood & panels':
        return [0xFF2E4738, 0xFF17211B];
      case 'plastics':
      case 'plastic':
        return [0xFF1E5C63, 0xFF132730];
      case 'fabric':
      case 'fabric & textiles':
        return [0xFF39506B, 0xFF1C2432];
      case 'tools & hardware':
        return [0xFF48515A, 0xFF1E252B];
      default:
        return [0xFF20504D, 0xFF152724];
    }
  }

  static String _formatCompactNumber(double value) {
    if (value == value.roundToDouble()) {
      return value.toStringAsFixed(0);
    }

    return value.toStringAsFixed(2).replaceFirst(RegExp(r'0+$'), '').replaceFirst(RegExp(r'\.$'), '');
  }
}
