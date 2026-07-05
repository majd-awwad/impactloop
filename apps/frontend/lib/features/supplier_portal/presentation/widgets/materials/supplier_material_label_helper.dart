import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../../../shared/widgets/materials/material_status_badge.dart';

typedef SupplierConditionMeta = ({
  LocalizedText label,
  MaterialConditionBadgeTone tone,
});

typedef SupplierStatusMeta = ({
  LocalizedText label,
  MaterialStatusBadgeTone tone,
});

abstract final class SupplierMaterialLabelHelper {
  static SupplierConditionMeta conditionMeta(String condition) {
    switch (condition) {
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

  static SupplierStatusMeta statusMeta(String status) {
    switch (status) {
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

  static LocalizedText quantityLabel(double quantity, String unit) {
    final qty =
        quantity % 1 == 0 ? quantity.toInt().toString() : quantity.toString();
    return LocalizedText(en: '$qty $unit', ar: '$qty $unit');
  }

  static LocalizedText stockLabel({
    required double quantity,
    required double availableQuantity,
    required String unit,
  }) {
    final totalQty =
        quantity % 1 == 0 ? quantity.toInt().toString() : quantity.toString();
    final availableQty = availableQuantity % 1 == 0
        ? availableQuantity.toInt().toString()
        : availableQuantity.toString();

    if (availableQuantity < quantity) {
      return LocalizedText(
        en: 'Available: $availableQty of $totalQty $unit',
        ar: 'المتاح: $availableQty من $totalQty $unit',
      );
    }

    return quantityLabel(quantity, unit);
  }

  static LocalizedText priceLabel({
    required bool isFree,
    double? price,
    required String currency,
  }) {
    if (isFree) {
      return const LocalizedText(en: 'Free', ar: 'مجاني');
    }

    final amount =
        price?.toStringAsFixed(price.truncateToDouble() == price ? 0 : 2);
    return LocalizedText(en: '$amount $currency', ar: '$amount $currency');
  }

  static LocalizedText locationLabel({
    required String city,
    String? area,
  }) {
    if (area != null && area.isNotEmpty) {
      return LocalizedText(en: '$city · $area', ar: '$city · $area');
    }

    return LocalizedText(en: city, ar: city);
  }

  static LocalizedText availabilityLabel({
    required bool pickupAllowed,
    required bool deliveryAvailable,
  }) {
    if (pickupAllowed && deliveryAvailable) {
      return const LocalizedText(
        en: 'Pickup & delivery',
        ar: 'استلام وتوصيل',
      );
    }

    if (deliveryAvailable) {
      return const LocalizedText(en: 'Delivery', ar: 'توصيل');
    }

    return const LocalizedText(en: 'Pickup only', ar: 'استلام فقط');
  }

  static String resolveText(LocalizedText text, bool isArabic) =>
      isArabic ? text.ar : text.en;
}
