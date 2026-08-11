import '../../../../shared/models/localized_text.dart';

class LearningProjectBuildL10n {
  const LearningProjectBuildL10n._();

  static const acquired = LocalizedText(
    en: 'Acquired',
    ar: 'تم الحصول عليها',
  );

  static const materialAcquired = LocalizedText(
    en: 'Material acquired',
    ar: 'تم استلام المادة',
  );

  static const readyForBuild = LocalizedText(
    en: 'Ready for build',
    ar: 'جاهزة للتنفيذ',
  );

  static const readyForBuildMaterialAcquired = LocalizedText(
    en: 'Ready for build — material acquired',
    ar: 'جاهزة للتنفيذ — تم استلام المادة',
  );

  static const acquiredSummary = LocalizedText(
    en: 'You acquired this material through a completed reservation.',
    ar: 'حصلت على هذه المادة من خلال حجز مكتمل.',
  );

  static const materialSelectedNotReady = LocalizedText(
    en:
        'Material selected — not ready yet. Reserve or acquire this material before using it in your build.',
    ar:
        'تم اختيار المادة — ليست جاهزة بعد. احجز المادة أو احصل عليها قبل استخدامها في البناء.',
  );

  static const inProgress = LocalizedText(
    en: 'In progress',
    ar: 'قيد المتابعة',
  );

  static const reservationCompleted = LocalizedText(
    en: 'Reservation completed',
    ar: 'اكتمل الحجز',
  );

  static const needsAttention = LocalizedText(
    en: 'Needs attention',
    ar: 'تحتاج إلى متابعة',
  );

  static const reservationRequiresResolution = LocalizedText(
    en: 'Reservation requires resolution',
    ar: 'الحجز يحتاج إلى معالجة',
  );

  static const selected = LocalizedText(
    en: 'Selected',
    ar: 'تم اختيار مادة',
  );

  static const reserved = LocalizedText(
    en: 'Reserved',
    ar: 'محجوزة',
  );

  static const alreadyOwned = LocalizedText(
    en: 'Already owned',
    ar: 'أمتلكها بالفعل',
  );

  static const materialSelectedReserveOrAcquire = LocalizedText(
    en: 'Material selected — reserve or acquire it before building.',
    ar: 'تم اختيار المادة — احجزها أو احصل عليها قبل البناء.',
  );

  static const insufficientQuantity = LocalizedText(
    en: 'Insufficient quantity',
    ar: 'الكمية غير كافية',
  );

  static const partiallyAcquired = LocalizedText(
    en: 'Partially acquired',
    ar: 'تم الحصول على جزء من الكمية',
  );

  static LocalizedText partiallyAcquiredDetail({
    required double acquired,
    required double required,
  }) =>
      LocalizedText(
        en:
            'Partially acquired — ${_formatQuantityLabel(acquired)} acquired, ${_formatQuantityLabel(required)} required',
        ar:
            'تم الحصول على جزء من الكمية — تم الحصول على ${_formatQuantityLabel(acquired)}، المطلوب ${_formatQuantityLabel(required)}',
      );

  static const acquiredIncompatibleUnit = LocalizedText(
    en:
        'This acquired material is not compatible with the required component unit.',
    ar: 'المادة التي تم الحصول عليها غير متوافقة مع وحدة المكوّن المطلوبة.',
  );

  static const useAnotherMaterial = LocalizedText(
    en: 'Use another material',
    ar: 'استخدام مادة أخرى',
  );

  static const removeFromComponent = LocalizedText(
    en: 'Remove from this component',
    ar: 'إزالة المادة من هذا المكوّن',
  );

  static const removeAcquiredAllocationTitle = LocalizedText(
    en: 'Remove this material from the component?',
    ar: 'إزالة هذه المادة من المكوّن؟',
  );

  static const removeAcquiredAllocationBody = LocalizedText(
    en:
        'The completed reservation and acquisition history will remain available.',
    ar: 'سيبقى الحجز المكتمل وسجل الحصول على المادة محفوظين.',
  );

  static const missing = LocalizedText(
    en: 'Missing',
    ar: 'مفقودة',
  );

  static const linkedOption = LocalizedText(
    en: 'Linked option',
    ar: 'الخيار المرتبط',
  );

  static const reserveThisMaterial = LocalizedText(
    en: 'Reserve this material',
    ar: 'احجز هذه المادة',
  );

  static const viewMaterial = LocalizedText(
    en: 'View material',
    ar: 'عرض المادة',
  );

  static const linkToComponent = LocalizedText(
    en: 'Link to component',
    ar: 'ربط بالمكوّن',
  );

  static const startBuild = LocalizedText(
    en: 'Start build',
    ar: 'ابدأ البناء',
  );

  static const continueChecklist = LocalizedText(
    en: 'Continue checklist',
    ar: 'متابعة قائمة التحقق',
  );

  static const browseMaterials = LocalizedText(
    en: 'Browse materials',
    ar: 'تصفح المواد',
  );

  static const buildChecklist = LocalizedText(
    en: 'Build checklist',
    ar: 'قائمة تحقق البناء',
  );

  static const planThisBuild = LocalizedText(
    en: 'Plan this build',
    ar: 'خطّط لهذا البناء',
  );

  static const unlinkMaterial = LocalizedText(
    en: 'Unlink',
    ar: 'إلغاء الربط',
  );

  static const cancel = LocalizedText(
    en: 'Cancel',
    ar: 'إلغاء',
  );

  static String _formatQuantityLabel(double value) {
    if (value == value.roundToDouble()) {
      return value.toInt().toString();
    }

    return value.toString();
  }

  static LocalizedText quantityAvailableRequired({
    required double available,
    required double required,
  }) =>
      LocalizedText(
        en:
            '${_formatQuantityLabel(available)} available, ${_formatQuantityLabel(required)} required',
        ar:
            'المتوفر ${_formatQuantityLabel(available)}، المطلوب ${_formatQuantityLabel(required)}',
      );

  static LocalizedText quantityAcquiredRequired({
    required double acquired,
    required double required,
  }) =>
      LocalizedText(
        en:
            '${_formatQuantityLabel(acquired)} acquired, ${_formatQuantityLabel(required)} required',
        ar:
            'تم الحصول على ${_formatQuantityLabel(acquired)}، المطلوب ${_formatQuantityLabel(required)}',
      );
}
