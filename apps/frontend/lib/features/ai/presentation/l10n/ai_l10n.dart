import 'package:flutter/widgets.dart';

import '../../../../shared/models/localized_text.dart';

class AiL10n {
  const AiL10n._();

  static const title = LocalizedText(
    en: 'ImpactLoop Assistant',
    ar: 'مساعد ImpactLoop',
  );

  static const inputHint = LocalizedText(
    en: 'Ask about projects, materials, tools, or safety…',
    ar: 'اسأل عن المشاريع أو المواد أو الأدوات أو السلامة…',
  );

  static const send = LocalizedText(en: 'Send', ar: 'إرسال');

  static const newChat = LocalizedText(en: 'New chat', ar: 'محادثة جديدة');

  static const history = LocalizedText(
    en: 'History',
    ar: 'السجل',
  );

  static const activeConversations = LocalizedText(
    en: 'Active conversations',
    ar: 'المحادثات النشطة',
  );

  static const archivedConversations = LocalizedText(
    en: 'Archived',
    ar: 'المؤرشفة',
  );

  static const emptyTitle = LocalizedText(
    en: 'How can I help with your project?',
    ar: 'كيف يمكنني مساعدتك في مشروعك؟',
  );

  static const emptySubtitle = LocalizedText(
    en: 'Educational guidance for materials, tools, safety, and beginner projects.',
    ar: 'إرشاد تعليمي حول المواد والأدوات والسلامة والمشاريع للمبتدئين.',
  );

  static const outOfScopeLabel = LocalizedText(
    en: 'Outside assistant scope',
    ar: 'خارج نطاق المساعد',
  );

  static const safetyLabel = LocalizedText(
    en: 'Safety guidance',
    ar: 'إرشادات السلامة',
  );

  static const retry = LocalizedText(en: 'Retry', ar: 'إعادة المحاولة');

  static const aiDisabled = LocalizedText(
    en: 'The assistant is temporarily unavailable.',
    ar: 'المساعد غير متاح مؤقتًا.',
  );

  static const busyConversation = LocalizedText(
    en: 'This conversation is still processing a message.',
    ar: 'هذه المحادثة ما زالت تعالج رسالة.',
  );

  static const genericFailure = LocalizedText(
    en: 'Something went wrong. Please try again.',
    ar: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
  );

  static const loading = LocalizedText(
    en: 'Thinking…',
    ar: 'جارٍ التفكير…',
  );

  static const maxLength = LocalizedText(
    en: 'Message is too long.',
    ar: 'الرسالة طويلة جدًا.',
  );

  static const archive = LocalizedText(en: 'Archive', ar: 'أرشفة');

  static const restore = LocalizedText(en: 'Restore', ar: 'استعادة');

  static const archiveConfirm = LocalizedText(
    en: 'Archive this conversation?',
    ar: 'هل تريد أرشفة هذه المحادثة؟',
  );

  static const archivedNotice = LocalizedText(
    en: 'Conversation archived.',
    ar: 'تمت أرشفة المحادثة.',
  );

  static const restoredNotice = LocalizedText(
    en: 'Conversation restored.',
    ar: 'تمت استعادة المحادثة.',
  );

  static const noConversations = LocalizedText(
    en: 'No conversations yet.',
    ar: 'لا توجد محادثات بعد.',
  );

  static const noArchivedConversations = LocalizedText(
    en: 'No archived conversations.',
    ar: 'لا توجد محادثات مؤرشفة.',
  );

  static const launcherTooltip = LocalizedText(
    en: 'Open ImpactLoop Assistant',
    ar: 'فتح مساعد ImpactLoop',
  );

  static const expand = LocalizedText(
    en: 'Expand',
    ar: 'توسيع',
  );

  static const collapse = LocalizedText(
    en: 'Collapse panel',
    ar: 'تصغير اللوحة',
  );

  static const untitledConversation = LocalizedText(
    en: 'New conversation',
    ar: 'محادثة جديدة',
  );

  static const materialsSection = LocalizedText(
    en: 'Materials',
    ar: 'المواد',
  );

  static const materialDetailsSection = LocalizedText(
    en: 'Material details',
    ar: 'تفاصيل المادة',
  );

  static const projectsSection = LocalizedText(
    en: 'Projects',
    ar: 'المشاريع',
  );

  static const projectDetailsSection = LocalizedText(
    en: 'Project details',
    ar: 'تفاصيل المشروع',
  );

  static const componentsSection = LocalizedText(
    en: 'Components',
    ar: 'المكونات',
  );

  static const buildChecklistSection = LocalizedText(
    en: 'Build checklist',
    ar: 'قائمة البناء',
  );

  static const componentMatchesSection = LocalizedText(
    en: 'Matching materials',
    ar: 'مواد مطابقة',
  );

  static const materialComparisonSection = LocalizedText(
    en: 'Material comparison',
    ar: 'مقارنة المواد',
  );

  static const projectComparisonSection = LocalizedText(
    en: 'Project comparison',
    ar: 'مقارنة المشاريع',
  );

  static const recommendedMaterialsSection = LocalizedText(
    en: 'Recommended materials',
    ar: 'مواد مقترحة',
  );

  static const recommendedProjectsSection = LocalizedText(
    en: 'Recommended projects',
    ar: 'مشاريع مقترحة',
  );

  static const recommendedActionsSection = LocalizedText(
    en: 'Suggested next steps',
    ar: 'خطوات مقترحة لك',
  );

  static const recommendationReasonFallback = LocalizedText(
    en: 'Recommended for you',
    ar: 'موصى به لك',
  );

  static const actionConfirmationSection = LocalizedText(
    en: 'Confirm action',
    ar: 'تأكيد الإجراء',
  );

  static const actionResultSection = LocalizedText(
    en: 'Action result',
    ar: 'نتيجة الإجراء',
  );

  static const externalSourcesSection = LocalizedText(
    en: 'Sources',
    ar: 'المصادر',
  );

  static const availableLabel = LocalizedText(
    en: 'Available',
    ar: 'متاح',
  );

  static const pickupOnly = LocalizedText(
    en: 'Pickup only',
    ar: 'استلام فقط',
  );

  static const deliveryOnly = LocalizedText(
    en: 'Delivery available',
    ar: 'توصيل متاح',
  );

  static const pickupAndDelivery = LocalizedText(
    en: 'Pickup & delivery',
    ar: 'استلام وتوصيل',
  );

  static const viewProject = LocalizedText(
    en: 'View project',
    ar: 'عرض المشروع',
  );

  static const viewBuild = LocalizedText(
    en: 'View build',
    ar: 'عرض البناء',
  );

  static const confirmAction = LocalizedText(
    en: 'Confirm',
    ar: 'تأكيد',
  );

  static const cancelAction = LocalizedText(
    en: 'Cancel',
    ar: 'إلغاء',
  );

  static const actionExpired = LocalizedText(
    en: 'This confirmation has expired.',
    ar: 'انتهت صلاحية هذا التأكيد.',
  );

  static String checklistProgress(
    BuildContext context,
    int ready,
    int total,
  ) {
    return LocalizedText(
      en: '$ready of $total ready',
      ar: '$ready من $total جاهز',
    ).resolve(context);
  }

  static const suggestedQuestions = [
    LocalizedText(
      en: 'Explain Arduino Uno simply',
      ar: 'اشرح Arduino Uno ببساطة',
    ),
    LocalizedText(
      en: 'Suggest a beginner recycling project',
      ar: 'اقترح مشروع إعادة تدوير للمبتدئين',
    ),
    LocalizedText(
      en: 'What safety precautions should I follow when soldering?',
      ar: 'ما احتياطات السلامة عند اللحام؟',
    ),
    LocalizedText(
      en: 'Can wood replace acrylic for a prototype?',
      ar: 'هل يمكن استبدال الأكريليك بالخشب في النموذج الأولي؟',
    ),
  ];

  static String purposeLabel(BuildContext context, String purpose) {
    switch (purpose) {
      case 'refusal':
        return outOfScopeLabel.resolve(context);
      case 'safety':
        return safetyLabel.resolve(context);
      case 'clarification':
        return LocalizedText(
          en: 'Clarification',
          ar: 'توضيح',
        ).resolve(context);
      default:
        return LocalizedText(
          en: 'Answer',
          ar: 'إجابة',
        ).resolve(context);
    }
  }

  static String errorMessageForCode(BuildContext context, String? code) {
    switch (code) {
      case 'AI_DISABLED':
        return aiDisabled.resolve(context);
      case 'AI_RATE_LIMITED':
        return LocalizedText(
          en: 'Too many requests. Please wait and try again.',
          ar: 'طلبات كثيرة. يرجى الانتظار ثم المحاولة مرة أخرى.',
        ).resolve(context);
      case 'AI_CONVERSATION_BUSY':
        return busyConversation.resolve(context);
      case 'AI_PROVIDER_TIMEOUT':
        return LocalizedText(
          en: 'The assistant took too long to respond.',
          ar: 'استغرق المساعد وقتًا طويلًا للرد.',
        ).resolve(context);
      case 'AI_PROVIDER_AUTH_ERROR':
        return LocalizedText(
          en: 'The assistant is not configured correctly on the server.',
          ar: 'إعدادات المساعد على الخادم غير صحيحة.',
        ).resolve(context);
      case 'AI_PROVIDER_QUOTA_EXCEEDED':
        return LocalizedText(
          en: 'The assistant is temporarily busy. Please try again shortly.',
          ar: 'المساعد مشغول مؤقتًا. يرجى المحاولة بعد قليل.',
        ).resolve(context);
      case 'AI_PROVIDER_MODEL_UNAVAILABLE':
        return LocalizedText(
          en: 'The assistant model is unavailable right now.',
          ar: 'نموذج المساعد غير متاح حاليًا.',
        ).resolve(context);
      case 'AI_PROVIDER_ERROR':
      case 'AI_RESPONSE_INVALID':
        return genericFailure.resolve(context);
      case 'AI_CONVERSATION_NOT_FOUND':
        return LocalizedText(
          en: 'This conversation is no longer available.',
          ar: 'هذه المحادثة لم تعد متاحة.',
        ).resolve(context);
      case 'NETWORK_ERROR':
        return LocalizedText(
          en: 'Could not reach the server.',
          ar: 'تعذر الوصول إلى الخادم.',
        ).resolve(context);
      case 'TIMEOUT':
        return LocalizedText(
          en: 'The request timed out.',
          ar: 'انتهت مهلة الطلب.',
        ).resolve(context);
      default:
        return genericFailure.resolve(context);
    }
  }
}
