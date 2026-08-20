import '../../../../shared/models/localized_text.dart';

export '../../../../shared/models/localized_text.dart';

class AdminMaterialReportsL10n {
  const AdminMaterialReportsL10n._();

  static const reviewReport = LocalizedText(
    en: 'Review report',
    ar: 'مراجعة البلاغ',
  );

  static const viewMaterial = LocalizedText(
    en: 'View material',
    ar: 'عرض المادة',
  );

  static const viewFullMaterial = LocalizedText(
    en: 'View full material',
    ar: 'عرض المادة بالكامل',
  );

  static const reportContext = LocalizedText(
    en: 'Report context',
    ar: 'سياق البلاغ',
  );

  static const materialContext = LocalizedText(
    en: 'Material context',
    ar: 'سياق المادة',
  );

  static const decision = LocalizedText(en: 'Decision', ar: 'القرار');
  static const adminNote = LocalizedText(
    en: 'Administrative note',
    ar: 'ملاحظة إدارية',
  );
  static const adminNoteHint = LocalizedText(
    en: 'Record why this decision was made.',
    ar: 'سجّل سبب هذا القرار.',
  );
  static const adminNoteRequired = LocalizedText(
    en: 'Enter a short administrative note (at least 3 characters).',
    ar: 'أدخل ملاحظة إدارية قصيرة (3 أحرف على الأقل).',
  );
  static const selectDecision = LocalizedText(
    en: 'Select a decision before submitting.',
    ar: 'اختر قرارًا قبل الإرسال.',
  );
  static const cancel = LocalizedText(en: 'Cancel', ar: 'إلغاء');
  static const submitDecision = LocalizedText(
    en: 'Submit decision',
    ar: 'تأكيد القرار',
  );

  static const rejectReport = LocalizedText(
    en: 'Reject report',
    ar: 'رفض البلاغ',
  );
  static const rejectReportDescription = LocalizedText(
    en: 'No violation found, or the report is not substantiated.',
    ar: 'لا توجد مخالفة أو أن البلاغ غير مبرر.',
  );
  static const rejectImpact = LocalizedText(
    en: 'The report will be rejected and the material will not change.',
    ar: 'سيتم رفض البلاغ ولن تتغير حالة المادة.',
  );
  static const rejectSuccess = LocalizedText(
    en: 'The report was rejected without changing the material.',
    ar: 'تم رفض البلاغ دون تغيير المادة.',
  );

  static const resolveNoAction = LocalizedText(
    en: 'Close report without changing the material',
    ar: 'إغلاق البلاغ دون إجراء على المادة',
  );
  static const resolveNoActionDescription = LocalizedText(
    en: 'The report has been reviewed and no material status change is required.',
    ar: 'تمت مراجعة البلاغ ولا يلزم تعديل حالة المادة.',
  );
  static const resolveNoActionImpact = LocalizedText(
    en: 'The report will be closed without changing the material.',
    ar: 'سيتم إغلاق البلاغ دون تغيير المادة.',
  );
  static const resolveNoActionSuccess = LocalizedText(
    en: 'The report was closed.',
    ar: 'تم إغلاق البلاغ.',
  );
  static const resolveNoActionDecision = LocalizedText(
    en: 'No material action',
    ar: 'دون إجراء على المادة',
  );

  static const markUnavailable = LocalizedText(
    en: 'Mark material unavailable',
    ar: 'تعيين المادة كغير متوفرة',
  );
  static const markUnavailableDescription = LocalizedText(
    en: 'The material stays in the catalog but cannot be reserved.',
    ar: 'تبقى المادة في السجل ولكن لا تكون متاحة للحجز.',
  );
  static const markUnavailableImpact = LocalizedText(
    en: 'The report will be closed and the material will be marked unavailable.',
    ar: 'سيتم إغلاق البلاغ وتعيين المادة كغير متوفرة.',
  );
  static const markUnavailableSuccess = LocalizedText(
    en: 'The material was marked unavailable and the report was closed.',
    ar: 'تم تعيين المادة كغير متوفرة وإغلاق البلاغ.',
  );
  static const markUnavailableDecision = LocalizedText(
    en: 'Material marked unavailable',
    ar: 'تم تعيين المادة كغير متوفرة',
  );

  static const hideMaterial = LocalizedText(
    en: 'Hide material',
    ar: 'إخفاء المادة',
  );
  static const hideMaterialDescription = LocalizedText(
    en: 'Remove the material from public discovery due to an administrative decision.',
    ar: 'إزالة المادة من الاكتشاف العام بسبب قرار إداري.',
  );
  static const hideMaterialImpact = LocalizedText(
    en: 'The report will be closed and the material will be hidden from public discovery.',
    ar: 'سيتم إغلاق البلاغ وإخفاء المادة من الاكتشاف العام.',
  );
  static const hideMaterialSuccess = LocalizedText(
    en: 'The material was hidden and the report was closed.',
    ar: 'تم إخفاء المادة وإغلاق البلاغ.',
  );
  static const hideMaterialDecision = LocalizedText(
    en: 'Material hidden',
    ar: 'تم إخفاء المادة',
  );

  static const lockedDuringActiveReservation = LocalizedText(
    en: 'Unavailable while an active reservation exists',
    ar: 'غير متاح أثناء وجود حجز نشط',
  );
  static const lockedLifecycleComplete = LocalizedText(
    en: 'This material has completed its reuse lifecycle.',
    ar: 'اكتملت دورة إعادة استخدام هذه المادة.',
  );

  static const filterPending = LocalizedText(en: 'Pending', ar: 'قيد المراجعة');
  static const filterResolved = LocalizedText(
    en: 'Resolved',
    ar: 'تمت المعالجة',
  );
  static const filterRejected = LocalizedText(en: 'Rejected', ar: 'مرفوضة');
  static const filterAll = LocalizedText(en: 'All', ar: 'الكل');

  static const emptyPendingTitle = LocalizedText(
    en: 'No reports awaiting review',
    ar: 'لا توجد بلاغات بانتظار المراجعة',
  );
  static const emptyResolvedTitle = LocalizedText(
    en: 'No resolved reports',
    ar: 'لا توجد بلاغات تمت معالجتها',
  );
  static const emptyRejectedTitle = LocalizedText(
    en: 'No rejected reports',
    ar: 'لا توجد بلاغات مرفوضة',
  );
  static const emptyAllTitle = LocalizedText(
    en: 'No reports',
    ar: 'لا توجد بلاغات',
  );
  static const emptyPendingSubtitle = LocalizedText(
    en: 'New material reports will appear here until they are reviewed.',
    ar: 'ستظهر بلاغات المواد الجديدة هنا إلى أن تتم مراجعتها.',
  );
  static const emptyHistorySubtitle = LocalizedText(
    en: 'Handled reports remain available in this filter.',
    ar: 'تبقى البلاغات التي تمت معالجتها متاحة في هذا التصفية.',
  );

  static const pendingStatus = LocalizedText(
    en: 'Pending report',
    ar: 'بلاغ قيد المراجعة',
  );
  static const resolvedStatus = LocalizedText(
    en: 'Resolved',
    ar: 'تمت المعالجة',
  );
  static const rejectedStatus = LocalizedText(en: 'Rejected', ar: 'مرفوض');
  static const reporterLabel = LocalizedText(en: 'Reporter', ar: 'المُبلِّغ');
  static const supplierLabel = LocalizedText(en: 'Supplier', ar: 'المورّد');
  static const submittedLabel = LocalizedText(
    en: 'Submitted',
    ar: 'تاريخ الإرسال',
  );
  static const handledLabel = LocalizedText(
    en: 'Handled',
    ar: 'تاريخ المعالجة',
  );
  static const reportStatusLabel = LocalizedText(
    en: 'Report status',
    ar: 'حالة البلاغ',
  );
  static const materialStatusLabel = LocalizedText(
    en: 'Material status',
    ar: 'حالة المادة',
  );
  static const availabilityLabel = LocalizedText(
    en: 'Availability',
    ar: 'التوفّر',
  );
  static const priceLabel = LocalizedText(en: 'Price', ar: 'السعر');
  static const freeLabel = LocalizedText(en: 'Free', ar: 'مجاني');
  static const paidLabel = LocalizedText(en: 'Paid', ar: 'مدفوع');
  static const reasonLabel = LocalizedText(en: 'Reason', ar: 'السبب');
  static const reporterNoteLabel = LocalizedText(
    en: 'Reporter note',
    ar: 'ملاحظة المُبلِّغ',
  );
  static const openedFromPendingReport = LocalizedText(
    en: 'Opened from pending report',
    ar: 'فُتح من بلاغ قيد المراجعة',
  );
  static const reportedBy = LocalizedText(
    en: 'Reported by',
    ar: 'أُبلغ بواسطة',
  );
  static const searchReportsHint = LocalizedText(
    en: 'Search reports, materials, or reporters...',
    ar: 'ابحث في البلاغات أو المواد أو المُبلِّغين...',
  );

  static const misleadingInformation = LocalizedText(
    en: 'Misleading information',
    ar: 'معلومات مضللة',
  );
  static const wrongCategory = LocalizedText(
    en: 'Wrong category',
    ar: 'تصنيف غير صحيح',
  );
  static const wrongPrice = LocalizedText(
    en: 'Wrong price',
    ar: 'سعر غير صحيح',
  );
  static const inappropriate = LocalizedText(
    en: 'Inappropriate material',
    ar: 'مادة غير لائقة',
  );
  static const itemNotAvailable = LocalizedText(
    en: 'Item not available',
    ar: 'العنصر غير متوفر',
  );
  static const suspiciousSupplier = LocalizedText(
    en: 'Suspicious supplier',
    ar: 'مورّد مثير للريبة',
  );
  static const otherReason = LocalizedText(en: 'Other', ar: 'أخرى');

  static String reason(String code, String languageCode) {
    switch (code) {
      case 'MISLEADING_INFORMATION':
        return misleadingInformation.resolveFor(languageCode);
      case 'WRONG_CATEGORY':
        return wrongCategory.resolveFor(languageCode);
      case 'WRONG_PRICE':
        return wrongPrice.resolveFor(languageCode);
      case 'INAPPROPRIATE':
        return inappropriate.resolveFor(languageCode);
      case 'ITEM_NOT_AVAILABLE':
        return itemNotAvailable.resolveFor(languageCode);
      case 'SUSPICIOUS_SUPPLIER':
        return suspiciousSupplier.resolveFor(languageCode);
      case 'OTHER':
        return otherReason.resolveFor(languageCode);
      default:
        return code.replaceAll('_', ' ').toLowerCase();
    }
  }

  static String reportStatus(String status, String languageCode) {
    switch (status.trim().toUpperCase()) {
      case 'PENDING':
        return pendingStatus.resolveFor(languageCode);
      case 'RESOLVED':
        return resolvedStatus.resolveFor(languageCode);
      case 'REJECTED':
        return rejectedStatus.resolveFor(languageCode);
      default:
        return status.replaceAll('_', ' ');
    }
  }

  static String decisionLabel(String? resolutionAction, String languageCode) {
    switch (resolutionAction) {
      case 'NO_MATERIAL_ACTION':
        return resolveNoActionDecision.resolveFor(languageCode);
      case 'MARKED_UNAVAILABLE':
        return markUnavailableDecision.resolveFor(languageCode);
      case 'HIDDEN':
        return hideMaterialDecision.resolveFor(languageCode);
      default:
        return '';
    }
  }

  static LocalizedText emptyTitleFor(String status) {
    switch (status) {
      case 'RESOLVED':
        return emptyResolvedTitle;
      case 'REJECTED':
        return emptyRejectedTitle;
      case 'ALL':
        return emptyAllTitle;
      default:
        return emptyPendingTitle;
    }
  }

  static LocalizedText emptySubtitleFor(String status) {
    return status == 'PENDING' ? emptyPendingSubtitle : emptyHistorySubtitle;
  }
}
