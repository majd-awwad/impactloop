import 'package:flutter/widgets.dart';

class CommentsL10n {
  const CommentsL10n(this.context);

  final BuildContext context;

  bool get isArabic => Localizations.localeOf(context).languageCode == 'ar';
  String t(String en, String ar) => isArabic ? ar : en;

  String get comments => t('Comments', 'التعليقات');
  String get intro => t(
    'Share a thought or reply in the thread.',
    'شارك رأيك أو أضف ردًا إلى النقاش.',
  );
  String get writeBeforePosting =>
      t('Write a comment before posting.', 'اكتب تعليقًا قبل النشر.');
  String get commentLimit => t(
    'Comments can be at most 1000 characters.',
    'يجب ألا يتجاوز التعليق 1000 حرف.',
  );
  String get loadFailed =>
      t('Could not load comments.', 'تعذر تحميل التعليقات.');
  String get empty => t(
    'No comments yet. Be the first to start the discussion.',
    'لا توجد تعليقات بعد. ابدأ النقاش.',
  );
  String viewReplies(int count) => isArabic
      ? 'عرض الردود ($count)'
      : 'View $count ${count == 1 ? 'reply' : 'replies'}';
  String get hideReplies => t('Hide replies', 'إخفاء الردود');
  String get loadMoreReplies =>
      t('Load more replies', 'تحميل المزيد من الردود');
  String get editing => t('Editing your comment', 'تعديل تعليقك');
  String replyingTo(String name) => t('Replying to $name', 'ردًا على $name');
  String get cancel => t('Cancel', 'إلغاء');
  String get updateComment => t('Update your comment', 'عدّل تعليقك');
  String get writeReply => t('Write a reply…', 'اكتب ردًا…');
  String get writeComment => t('Write a comment…', 'اكتب تعليقًا…');
  String get save => t('Save', 'حفظ');
  String get post => t('Post', 'نشر');
  String get edited => t('Edited', 'تم التعديل');
  String get removed => t('This comment was removed.', 'تم حذف هذا التعليق.');
  String get reply => t('Reply', 'رد');
  String get edit => t('Edit', 'تعديل');
  String get delete => t('Delete', 'حذف');
}
