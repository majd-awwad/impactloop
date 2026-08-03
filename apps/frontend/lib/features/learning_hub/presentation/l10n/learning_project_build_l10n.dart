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
}
