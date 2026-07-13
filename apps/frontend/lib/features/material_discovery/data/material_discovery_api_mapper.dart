import 'package:flutter/material.dart';

import '../../../core/config/api_config.dart';
import '../../../shared/models/localized_text.dart';
import '../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../shared/widgets/materials/material_status_badge.dart';
import '../domain/discovery_material.dart';
import '../domain/discovery_material_image.dart';
import '../presentation/discovery_material_display.dart';

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
    final availableQuantity =
        _numberFromDynamic(json['availableQuantity']) ?? quantity;
    final unit = _stringOrFallback(json['unit'], fallback: 'items');
    final isFree = json['isFree'] == true;
    final price = _numberFromDynamic(json['price']);
    final city = _nullableString(json['city']);
    final area = _nullableString(json['area']);
    final approximateLatitude = _numberFromDynamic(json['approximateLatitude']);
    final approximateLongitude = _numberFromDynamic(
      json['approximateLongitude'],
    );
    final approximateDistanceKm = _numberFromDynamic(
      json['approximateDistanceKm'],
    );
    final deliveryAvailable = json['deliveryAvailable'] == true;
    final pickupAllowed = json['pickupAllowed'] != false;
    final suggestedUses = _nullableString(json['suggestedUses']);
    final sourceType = _nullableString(json['sourceType']);
    final supplierType = _nullableString(json['supplierType']);
    final supplierVerified = json['supplierVerified'] == true;
    final isOwnMaterial = json['isOwnMaterial'] == true ? true : null;
    final canReserve = json['canReserve'] is bool
        ? json['canReserve'] as bool
        : null;
    final reserveBlockReason = _nullableString(json['reserveBlockReason']);
    final ratingSummary = _numberFromDynamic(json['ratingSummary']);
    final viewsCount = _intFromDynamic(json['viewsCount']) ?? 0;
    final likesCount = _intFromDynamic(json['likesCount']) ?? 0;
    final isLiked = json['isLiked'] == true;

    final conditionMeta = _conditionMeta(condition);
    final statusMeta = _statusMeta(
      status,
      availableQuantity: availableQuantity ?? 0,
    );
    final categoryId = _nullableString(categoryJson?['id']);
    final title = _stringOrFallback(
      json['title'],
      fallback: 'Untitled material',
    );
    final description = DiscoveryMaterialDisplay.sanitizedDescriptionOrFallback(
      _stringOrFallback(json['description'], fallback: ''),
    );

    final categoryLabel = LocalizedText(en: categoryNameEn, ar: categoryNameAr);
    final supplierTypeLabel = DiscoveryMaterial.supplierTypeLabelFor(
      supplierType,
    );
    final galleryImages = _mapGalleryImages(json);
    final imageUrl = galleryImages.isNotEmpty
        ? galleryImages.first.url
        : _resolveImageUrl(json);

    return DiscoveryMaterial(
      id: _stringOrFallback(json['id'], fallback: ''),
      status: status,
      quantity: quantity ?? 0,
      availableQuantity: availableQuantity ?? 0,
      unit: unit,
      // TODO: replace duplicated EN/AR title text when backend exposes bilingual fields.
      title: LocalizedText(en: title, ar: title),
      description: LocalizedText(en: description, ar: description),
      category: categoryLabel,
      categoryId: categoryId,
      city: city,
      area: area,
      approximateLatitude: approximateLatitude,
      approximateLongitude: approximateLongitude,
      approximateDistanceKm: approximateDistanceKm,
      conditionLabel: conditionMeta.label,
      conditionTone: conditionMeta.tone,
      statusLabel: statusMeta.label,
      statusTone: statusMeta.tone,
      quantityLabel: _quantityLabel(
        quantity: quantity,
        availableQuantity: availableQuantity,
        unit: unit,
      ),
      priceLabel: _priceLabel(isFree: isFree, price: price),
      locationLabel: _locationLabel(
        city: city,
        area: area,
        approximateDistanceKm: approximateDistanceKm,
      ),
      availabilityLabel: _availabilityLabel(
        deliveryAvailable: deliveryAvailable,
        pickupAllowed: pickupAllowed,
      ),
      deliveryAvailable: deliveryAvailable,
      pickupAllowed: pickupAllowed,
      isFree: isFree,
      supplierName: LocalizedText(en: supplierName, ar: supplierName),
      supplierSubtitle:
          supplierTypeLabel ??
          const LocalizedText(en: 'Material supplier', ar: 'مورد مواد'),
      supplierType: supplierType,
      supplierVerified: supplierVerified,
      heroIconData: _heroIconForCategory(categoryNameEn),
      cardGradient: _gradientForCategory(categoryNameEn),
      imageUrl: imageUrl,
      galleryImages: galleryImages,
      ratingLabel: ratingSummary == null
          ? null
          : LocalizedText(
              en: _formatCompactNumber(ratingSummary),
              ar: _formatCompactNumber(ratingSummary),
            ),
      viewsCount: viewsCount,
      likesCount: likesCount,
      isLiked: isLiked,
      postedAt: _dateTimeFromDynamic(json['createdAt']),
      suggestedUses: suggestedUses,
      sourceType: sourceType,
      isOwnMaterial: isOwnMaterial,
      canReserve: canReserve,
      reserveBlockReason: reserveBlockReason,
    );
  }

  static DateTime? _dateTimeFromDynamic(Object? value) {
    if (value == null) {
      return null;
    }

    if (value is DateTime) {
      return value;
    }

    final normalized = value.toString().trim();
    if (normalized.isEmpty) {
      return null;
    }

    return DateTime.tryParse(normalized);
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

  static List<DiscoveryMaterialImage> _mapGalleryImages(
    Map<String, dynamic> json,
  ) {
    final images = json['images'];
    if (images is! List) {
      return const [];
    }

    final mapped = <DiscoveryMaterialImage>[];

    for (final image in images) {
      if (image is! Map) {
        continue;
      }

      final imageMap = Map<String, dynamic>.from(image);
      final url = _nullableString(imageMap['url'] ?? imageMap['imageUrl']);
      if (url == null) {
        continue;
      }

      mapped.add(
        DiscoveryMaterialImage(
          id: _stringOrFallback(imageMap['id'], fallback: url),
          url: ApiConfig.resolveMediaUrl(url),
          isCover: imageMap['isCover'] == true,
          isPrimary:
              imageMap['isPrimary'] == true || imageMap['isCover'] == true,
          sortOrder: _intFromDynamic(imageMap['sortOrder']) ?? mapped.length,
        ),
      );
    }

    if (mapped.isEmpty) {
      return const [];
    }

    mapped.sort((left, right) {
      if (left.isCover != right.isCover) {
        return left.isCover ? -1 : 1;
      }

      final sortCompare = left.sortOrder.compareTo(right.sortOrder);
      if (sortCompare != 0) {
        return sortCompare;
      }

      return left.id.compareTo(right.id);
    });

    return mapped;
  }

  static String? _resolveImageUrl(Map<String, dynamic> json) {
    final directImage =
        _nullableString(json['primaryImageUrl']) ??
        _nullableString(json['imageUrl']);
    if (directImage != null) {
      return ApiConfig.resolveMediaUrl(directImage);
    }

    final images = json['images'];
    if (images is List) {
      for (final image in images) {
        if (image is Map) {
          final url = _nullableString(image['url'] ?? image['imageUrl']);
          if (url != null) {
            return ApiConfig.resolveMediaUrl(url);
          }
        } else {
          final url = _nullableString(image);
          if (url != null) {
            return ApiConfig.resolveMediaUrl(url);
          }
        }
      }
    }

    final imageUrls = json['imageUrls'];
    if (imageUrls is List) {
      for (final image in imageUrls) {
        if (image is Map) {
          final url = _nullableString(image['url'] ?? image['imageUrl']);
          if (url != null) {
            return ApiConfig.resolveMediaUrl(url);
          }
        } else {
          final url = _nullableString(image);
          if (url != null) {
            return ApiConfig.resolveMediaUrl(url);
          }
        }
      }
    }

    return null;
  }

  static int? _intFromDynamic(Object? value) {
    if (value == null) {
      return null;
    }

    if (value is int) {
      return value;
    }

    if (value is num) {
      return value.toInt();
    }

    return int.tryParse(value.toString());
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

  static LocalizedText _quantityLabel({
    required double? quantity,
    required double? availableQuantity,
    required String unit,
  }) {
    final totalText = quantity == null ? '--' : _formatCompactNumber(quantity);
    final available = availableQuantity ?? quantity;

    if (available != null && quantity != null && available < quantity) {
      final availableText = _formatCompactNumber(available);
      return LocalizedText(
        en: 'Available: $availableText of $totalText $unit',
        ar: 'المتاح: $availableText من $totalText $unit',
      );
    }

    return LocalizedText(en: '$totalText $unit', ar: '$totalText $unit');
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
    return LocalizedText(en: 'NIS $priceText', ar: '$priceText شيكل');
  }

  static LocalizedText _availabilityLabel({
    required bool deliveryAvailable,
    required bool pickupAllowed,
  }) {
    if (pickupAllowed && deliveryAvailable) {
      return const LocalizedText(
        en: 'Pickup and delivery available',
        ar: 'الاستلام والتوصيل متاحان',
      );
    }

    if (deliveryAvailable) {
      return const LocalizedText(en: 'Delivery available', ar: 'التوصيل متاح');
    }

    if (pickupAllowed) {
      return const LocalizedText(en: 'Pickup only', ar: 'استلام فقط');
    }

    return const LocalizedText(
      en: 'Contact supplier for pickup options',
      ar: 'تواصل مع المورد لخيارات الاستلام',
    );
  }

  static LocalizedText _locationLabel({
    required String? city,
    required String? area,
    required double? approximateDistanceKm,
  }) {
    final distanceText = approximateDistanceKm == null
        ? null
        : approximateDistanceKm < 10
        ? '~${approximateDistanceKm.toStringAsFixed(1)} km'
        : '~${approximateDistanceKm.toStringAsFixed(0)} km';

    if (city == null && area == null) {
      if (distanceText != null) {
        return LocalizedText(en: distanceText, ar: distanceText);
      }

      return const LocalizedText(
        en: 'Location shared on request',
        ar: 'يتم مشاركة الموقع عند الطلب',
      );
    }

    if (city != null && area != null) {
      final label = '$city, $area';
      final arLabel = '$city، $area';
      return distanceText == null
          ? LocalizedText(en: label, ar: arLabel)
          : LocalizedText(
              en: '$label - $distanceText',
              ar: '$arLabel - $distanceText',
            );
    }

    final label = city ?? area!;
    return distanceText == null
        ? LocalizedText(en: label, ar: label)
        : LocalizedText(
            en: '$label - $distanceText',
            ar: '$label - $distanceText',
          );
  }

  static ({LocalizedText label, MaterialConditionBadgeTone tone})
  _conditionMeta(String value) {
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
    String value, {
    required double availableQuantity,
  }) {
    if (availableQuantity > 0 && value != 'REUSED' && value != 'UNAVAILABLE') {
      return (
        label: const LocalizedText(en: 'Available', ar: 'متاح'),
        tone: MaterialStatusBadgeTone.available,
      );
    }

    switch (value) {
      case 'PENDING_RESERVATION':
        return (
          label: const LocalizedText(
            en: 'Pending reservation',
            ar: 'بانتظار الحجز',
          ),
          tone: materialLifecycleStatusTone(value),
        );
      case 'RESERVED':
        return (
          label: const LocalizedText(en: 'Reserved', ar: 'محجوز'),
          tone: materialLifecycleStatusTone(value),
        );
      case 'REUSED':
        return (
          label: const LocalizedText(en: 'Reused', ar: 'أعيد استخدامها'),
          tone: materialLifecycleStatusTone(value),
        );
      case 'UNAVAILABLE':
        return (
          label: const LocalizedText(en: 'Unavailable', ar: 'غير متاح'),
          tone: materialLifecycleStatusTone(value),
        );
      case 'AVAILABLE':
        return (
          label: const LocalizedText(en: 'Available', ar: 'متاح'),
          tone: materialLifecycleStatusTone(value),
        );
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

    return value
        .toStringAsFixed(2)
        .replaceFirst(RegExp(r'0+$'), '')
        .replaceFirst(RegExp(r'\.$'), '');
  }
}
