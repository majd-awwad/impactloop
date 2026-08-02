import '../../../../shared/models/localized_text.dart';

/// English / Arabic strings for the learner-facing Material Requests
/// feature. Mirrors the style used by `AiL10n`.
class LearnerMaterialRequestsL10n {
  const LearnerMaterialRequestsL10n._();

  // —— Titles ——
  static const pageTitle = LocalizedText(
    en: 'Material Requests',
    ar: 'طلبات المواد',
  );

  static const pageSubtitle = LocalizedText(
    en: 'Ask suppliers for materials you could not find on ImpactLoop.',
    ar: 'اطلب من الموردين مواداً لم تجدها على ImpactLoop.',
  );

  static const newRequest = LocalizedText(
    en: 'New request',
    ar: 'طلب جديد',
  );

  static const requestDetailsTitle = LocalizedText(
    en: 'Request details',
    ar: 'تفاصيل الطلب',
  );

  static const createRequestTitle = LocalizedText(
    en: 'Request a material',
    ar: 'اطلب مادة',
  );

  static const createRequestSubtitle = LocalizedText(
    en:
        'Tell suppliers what you need. We will notify you when a matching material is suggested.',
    ar: 'أخبر الموردين بما تحتاجه. سنُعلمك عند اقتراح مادة مطابقة.',
  );

  // —— Statuses ——
  static const statusOpen = LocalizedText(en: 'Open', ar: 'مفتوح');
  static const statusFulfilled = LocalizedText(en: 'Fulfilled', ar: 'تم التلبية');
  static const statusCancelled = LocalizedText(en: 'Cancelled', ar: 'ملغى');
  static const statusExpired = LocalizedText(en: 'Expired', ar: 'منتهي');
  static const statusAll = LocalizedText(en: 'All', ar: 'الكل');

  static LocalizedText statusLabel(String status) {
    return switch (status) {
      'OPEN' => statusOpen,
      'FULFILLED' => statusFulfilled,
      'CANCELLED' => statusCancelled,
      'EXPIRED' => statusExpired,
      _ => LocalizedText(en: status, ar: status),
    };
  }

  // —— List page ——
  static const loading = LocalizedText(
    en: 'Loading your material requests…',
    ar: 'جارٍ تحميل طلبات موادك…',
  );

  static const loadError = LocalizedText(
    en: 'We could not load your material requests.',
    ar: 'تعذّر تحميل طلبات موادك.',
  );

  static const retry = LocalizedText(en: 'Retry', ar: 'إعادة المحاولة');

  static const emptyTitle = LocalizedText(
    en: 'No material requests yet',
    ar: 'لا توجد طلبات مواد بعد',
  );

  static const emptySubtitle = LocalizedText(
    en:
        'Could not find a material you need? Ask suppliers directly and we will match you when something becomes available.',
    ar: 'لم تجد المادة التي تحتاجها؟ اطلبها مباشرة من الموردين وسنطابقك عندما تتوفر.',
  );

  static const emptyFilteredTitle = LocalizedText(
    en: 'No requests match this filter',
    ar: 'لا توجد طلبات مطابقة لهذا التصفية',
  );

  static LocalizedText suggestionsCount(int count) {
    if (count == 1) {
      return const LocalizedText(en: '1 suggestion', ar: 'اقتراح واحد');
    }
    return LocalizedText(en: '$count suggestions', ar: '$count اقتراحات');
  }

  // —— Form labels ——
  static const itemNameLabel = LocalizedText(
    en: 'What are you looking for?',
    ar: 'عمّ تبحث؟',
  );

  static const itemNameHint = LocalizedText(
    en: 'e.g. Arduino Uno, plywood sheets',
    ar: 'مثال: Arduino Uno، ألواح خشب رقائقي',
  );

  static const categoryLabel = LocalizedText(en: 'Category', ar: 'الفئة');

  static const chooseCategory = LocalizedText(
    en: 'Choose a category',
    ar: 'اختر فئة',
  );

  static const descriptionLabel = LocalizedText(
    en: 'Description (optional)',
    ar: 'الوصف (اختياري)',
  );

  static const descriptionHint = LocalizedText(
    en: 'Add details that could help a supplier match you faster.',
    ar: 'أضف تفاصيل قد تساعد المورد على مطابقتك بشكل أسرع.',
  );

  static const quantityLabel = LocalizedText(en: 'Quantity', ar: 'الكمية');

  static const unitLabel = LocalizedText(en: 'Unit', ar: 'الوحدة');

  static const unitHint = LocalizedText(en: 'piece', ar: 'قطعة');

  static const alternativesAllowedLabel = LocalizedText(
    en: 'Alternatives allowed',
    ar: 'البدائل مسموحة',
  );

  static const alternativesAllowedSubtitle = LocalizedText(
    en: 'Suppliers may suggest a similar material if this exact item is unavailable.',
    ar: 'يمكن للموردين اقتراح مادة مشابهة إذا لم تتوفر هذه المادة تحديداً.',
  );

  static const locationSectionTitle = LocalizedText(
    en: 'Location',
    ar: 'الموقع',
  );

  static const locationSectionSubtitle = LocalizedText(
    en: 'Only your city and area are shared with suppliers, never your exact address.',
    ar: 'تتم مشاركة مدينتك ومنطقتك فقط مع الموردين، وليس عنوانك الدقيق أبداً.',
  );

  static const useSavedLocation = LocalizedText(
    en: 'Use a saved location',
    ar: 'استخدام موقع محفوظ',
  );

  static const cityLabel = LocalizedText(en: 'City', ar: 'المدينة');

  static const areaLabel = LocalizedText(
    en: 'Area (optional)',
    ar: 'المنطقة (اختياري)',
  );

  static const neededByLabel = LocalizedText(
    en: 'Needed by (optional)',
    ar: 'مطلوب بحلول (اختياري)',
  );

  static const chooseDate = LocalizedText(en: 'Choose a date', ar: 'اختر تاريخاً');

  static const clearDate = LocalizedText(en: 'Clear', ar: 'مسح');

  static const submitRequest = LocalizedText(
    en: 'Send request',
    ar: 'إرسال الطلب',
  );

  static const submitting = LocalizedText(en: 'Sending…', ar: 'جارٍ الإرسال…');

  static const requestSentSuccess = LocalizedText(
    en: 'Your material request was sent to suppliers.',
    ar: 'تم إرسال طلب المادة إلى الموردين.',
  );

  static const requestCreateFailed = LocalizedText(
    en: 'Could not send your request. Please try again.',
    ar: 'تعذّر إرسال طلبك. يرجى المحاولة مرة أخرى.',
  );

  static const activeRequestLimitReached = LocalizedText(
    en: 'You have reached the maximum number of open requests.',
    ar: 'لقد وصلت إلى الحد الأقصى من الطلبات المفتوحة.',
  );

  static const duplicateOpenRequest = LocalizedText(
    en: 'You already have an open request for this item and category.',
    ar: 'لديك بالفعل طلب مفتوح لهذا العنصر والفئة.',
  );

  // —— Privacy ——
  static const privacyNote = LocalizedText(
    en:
        'Suppliers only see your requested item, category, quantity, and general area — never your exact address or contact details.',
    ar: 'يرى الموردون فقط العنصر المطلوب والفئة والكمية والمنطقة العامة — ولا يرون عنوانك الدقيق أو بيانات التواصل أبداً.',
  );

  // —— Detail page ——
  static const matchesTitle = LocalizedText(
    en: 'Supplier suggestions',
    ar: 'اقتراحات الموردين',
  );

  static const noMatchesYet = LocalizedText(
    en: 'No suppliers have suggested a material yet.',
    ar: 'لم يقترح أي مورد مادة بعد.',
  );

  static const dismissSuggestion = LocalizedText(
    en: 'Dismiss',
    ar: 'تجاهل',
  );

  static const dismissSuggestionConfirm = LocalizedText(
    en: 'Dismiss this suggestion?',
    ar: 'هل تريد تجاهل هذا الاقتراح؟',
  );

  static const suggestionDismissed = LocalizedText(
    en: 'Suggestion dismissed.',
    ar: 'تم تجاهل الاقتراح.',
  );

  static const openMaterial = LocalizedText(
    en: 'Open material',
    ar: 'فتح المادة',
  );

  static const reserveMaterial = LocalizedText(
    en: 'Reserve material',
    ar: 'حجز المادة',
  );

  static const cancelRequest = LocalizedText(en: 'Cancel request', ar: 'إلغاء الطلب');

  static const cancelRequestConfirm = LocalizedText(
    en: 'Cancel this material request?',
    ar: 'هل تريد إلغاء طلب المادة هذا؟',
  );

  static const requestCancelled = LocalizedText(
    en: 'Material request cancelled.',
    ar: 'تم إلغاء طلب المادة.',
  );

  static const markFulfilled = LocalizedText(
    en: 'Mark as fulfilled',
    ar: 'تحديد كمكتمل',
  );

  static const markFulfilledConfirm = LocalizedText(
    en: 'Mark this request as fulfilled?',
    ar: 'هل تريد تحديد هذا الطلب كمكتمل؟',
  );

  static const requestFulfilled = LocalizedText(
    en: 'Material request marked as fulfilled.',
    ar: 'تم تحديد طلب المادة كمكتمل.',
  );

  static const duplicateRequest = LocalizedText(
    en: 'Request again',
    ar: 'إعادة الطلب',
  );

  static const requestDuplicated = LocalizedText(
    en: 'A new open request was created.',
    ar: 'تم إنشاء طلب جديد مفتوح.',
  );

  static const confirm = LocalizedText(en: 'Confirm', ar: 'تأكيد');
  static const cancelAction = LocalizedText(en: 'Cancel', ar: 'إلغاء');

  static const requestNotFound = LocalizedText(
    en: 'Material request not found',
    ar: 'طلب المادة غير موجود',
  );

  static const genericLoadError = LocalizedText(
    en: 'Could not load this material request.',
    ar: 'تعذّر تحميل طلب المادة هذا.',
  );

  static const projectContextLabel = LocalizedText(
    en: 'From your build checklist',
    ar: 'من قائمة البناء الخاصة بك',
  );

  static LocalizedText quantityUnitLine(String quantity, String unit) {
    return LocalizedText(
      en: '$quantity $unit',
      ar: '$quantity $unit',
    );
  }

  static LocalizedText neededByLine(String date) {
    return LocalizedText(en: 'Needed by $date', ar: 'مطلوب بحلول $date');
  }

  static LocalizedText expiresLine(String date) {
    return LocalizedText(en: 'Expires $date', ar: 'ينتهي بتاريخ $date');
  }
}
