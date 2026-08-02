import '../../../../../core/format/localized_formatters.dart';
import '../../../../../l10n/app_localizations.dart';
import '../../../../../shared/l10n/material_ui_labels.dart';
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
  static String conditionText(String condition, AppLocalizations l10n) =>
      MaterialUiLabels(l10n).condition(condition);

  static String statusText(String status, AppLocalizations l10n) =>
      MaterialUiLabels(l10n).materialStatus(status);

  static String priceText({
    required bool isFree,
    double? price,
    required String currency,
    required AppLocalizations l10n,
  }) {
    if (isFree) {
      return l10n.free;
    }

    final formatters = LocalizedFormatters(l10n);
    final amount = price ?? 0;
    if (currency.toUpperCase() == 'NIS') {
      final decimalDigits = amount.truncateToDouble() == amount ? 0 : 2;
      return formatters.nis(amount, decimalDigits: decimalDigits);
    }

    final decimalDigits = amount.truncateToDouble() == amount ? 0 : 2;
    return '${formatters.number(amount, decimalDigits: decimalDigits)} $currency';
  }

  static String quantityText(
    double quantity,
    String unit,
    AppLocalizations l10n,
  ) => LocalizedFormatters(l10n).quantity(quantity, unit);

  static String stockText({
    required double quantity,
    required double availableQuantity,
    required String unit,
    required AppLocalizations l10n,
  }) {
    final formatters = LocalizedFormatters(l10n);
    if (availableQuantity < quantity) {
      return l10n.supplierAvailableOfTotal(
        formatters.number(availableQuantity),
        formatters.number(quantity),
        unit,
      );
    }

    return formatters.quantity(quantity, unit);
  }

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
          tone: materialLifecycleStatusTone(status),
        );
      case 'RESERVED':
        return (
          label: const LocalizedText(en: 'Reserved', ar: 'محجوز'),
          tone: materialLifecycleStatusTone(status),
        );
      case 'REUSED':
        return (
          label: const LocalizedText(en: 'Reused', ar: 'أعيد استخدامها'),
          tone: materialLifecycleStatusTone(status),
        );
      case 'UNAVAILABLE':
        return (
          label: const LocalizedText(en: 'Unavailable', ar: 'غير متاح'),
          tone: materialLifecycleStatusTone(status),
        );
      case 'AVAILABLE':
        return (
          label: const LocalizedText(en: 'Available', ar: 'متاح'),
          tone: materialLifecycleStatusTone(status),
        );
      default:
        return (
          label: const LocalizedText(en: 'Available', ar: 'متاح'),
          tone: MaterialStatusBadgeTone.available,
        );
    }
  }

  static LocalizedText locationLabel({required String city, String? area}) {
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
      return const LocalizedText(en: 'Pickup & delivery', ar: 'استلام وتوصيل');
    }

    if (deliveryAvailable) {
      return const LocalizedText(en: 'Delivery', ar: 'توصيل');
    }

    return const LocalizedText(en: 'Pickup only', ar: 'استلام فقط');
  }

  static String resolveText(LocalizedText text, bool isArabic) =>
      isArabic ? text.ar : text.en;
}
