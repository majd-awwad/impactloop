import 'package:flutter/widgets.dart';

class ProjectReviewsL10n {
  const ProjectReviewsL10n(this.context);

  final BuildContext context;

  bool get isArabic => Localizations.localeOf(context).languageCode == 'ar';

  String t(String en, String ar) => isArabic ? ar : en;

  String get learnerAccountRequired => t(
    'Use a learner account to review projects.',
    'استخدم حساب متعلم لمراجعة المشاريع.',
  );
  String get chooseRating => t(
    'Choose a rating from 1 to 5 stars.',
    'اختر تقييمًا من نجمة إلى خمس نجوم.',
  );
  String get reviewSaved => t('Review saved.', 'تم حفظ المراجعة.');
  String get reviewRemoved => t('Review removed.', 'تم حذف المراجعة.');
  String get noReviews =>
      t('No learner reviews yet', 'لا توجد مراجعات من المتعلمين بعد');
  String get updateYourReview => t('Update your review', 'تحديث مراجعتك');
  String get reviewThisProject =>
      t('Review this project', 'مراجعة هذا المشروع');
  String get reviewHint => t(
    'What helped, what was missing, or what would you change?',
    'ما الذي ساعدك؟ وما الذي كان مفقودًا أو تود تغييره؟',
  );
  String get updateReview => t('Update review', 'تحديث المراجعة');
  String get postReview => t('Post review', 'نشر المراجعة');
  String get remove => t('Remove', 'حذف');
  String get yourReview => t('Your review', 'مراجعتك');
  String get firstReview => t(
    'No reviews yet. Be the first learner to rate this project.',
    'لا توجد مراجعات بعد. كن أول متعلم يقيّم هذا المشروع.',
  );

  String ratingSummary(double value, int count) {
    if (isArabic) {
      return '${value.toStringAsFixed(1)} من 5 · $count مراجعة';
    }
    return '${value.toStringAsFixed(1)} from $count ${count == 1 ? 'review' : 'reviews'}';
  }

  String starLabel(int value) => isArabic
      ? '$value ${value == 1 ? 'نجمة' : 'نجوم'}'
      : '$value ${value == 1 ? 'star' : 'stars'}';
}
