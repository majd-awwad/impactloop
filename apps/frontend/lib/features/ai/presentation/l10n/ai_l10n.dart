import 'package:flutter/widgets.dart';

import '../../../../shared/models/localized_text.dart';

class AiL10n {
  const AiL10n._();

  static const title = LocalizedText(
    en: 'ImpactLoop Assistant',
    ar: 'ImpactLoop مساعد',
  );

  static const inputHint = LocalizedText(
    en: 'Write your message here…',
    ar: 'اكتب رسالتك هنا…',
  );

  static const send = LocalizedText(en: 'Send', ar: 'إرسال');

  static const newChat = LocalizedText(en: 'New chat', ar: 'محادثة جديدة');

  static const history = LocalizedText(
    en: 'History',
    ar: 'السجل',
  );

  static const statusActive = LocalizedText(
    en: 'Active now',
    ar: 'نشط الآن',
  );

  static const typing = LocalizedText(
    en: 'Typing…',
    ar: 'جاري الكتابة…',
  );

  static const conversationsTab = LocalizedText(
    en: 'Conversations',
    ar: 'المحادثات',
  );

  static const attachmentsTab = LocalizedText(
    en: 'Attachments',
    ar: 'المرفقات',
  );

  static const activeConversations = LocalizedText(
    en: 'Active conversations',
    ar: 'المحادثات النشطة',
  );

  static const archivedConversations = LocalizedText(
    en: 'Archived',
    ar: 'المؤرشفة',
  );

  static const searchConversations = LocalizedText(
    en: 'Search conversations…',
    ar: 'ابحث في المحادثات…',
  );

  static const viewAllConversations = LocalizedText(
    en: 'View all conversations',
    ar: 'عرض كل المحادثات',
  );

  static const lastMessagePrefix = LocalizedText(
    en: 'Last message:',
    ar: 'آخر رسالة:',
  );

  static const today = LocalizedText(en: 'Today', ar: 'اليوم');

  static const yesterday = LocalizedText(en: 'Yesterday', ar: 'أمس');

  static const attach = LocalizedText(en: 'Attach', ar: 'إرفاق');

  static const voiceInput = LocalizedText(en: 'Voice input', ar: 'إدخال صوتي');

  static const featureComingSoon = LocalizedText(
    en: 'This feature is coming soon.',
    ar: 'هذه الميزة قادمة قريبًا.',
  );

  static const noAttachments = LocalizedText(
    en: 'No attachments yet.',
    ar: 'لا توجد مرفقات بعد.',
  );

  static const categorySafety = LocalizedText(
    en: 'Safety tips',
    ar: 'نصائح السلامة',
  );

  static const categoryMaterials = LocalizedText(
    en: 'Sustainable materials',
    ar: 'مواد مستدامة',
  );

  static const categoryTools = LocalizedText(
    en: 'Tools & equipment',
    ar: 'أدوات ومعدات',
  );

  static const categorySafetyPrompt = LocalizedText(
    en: 'What safety precautions should I follow for my current project?',
    ar: 'ما احتياطات السلامة التي يجب أن أتبعها في مشروعي الحالي؟',
  );

  static const categoryMaterialsPrompt = LocalizedText(
    en: 'Suggest sustainable materials suitable for a beginner project.',
    ar: 'اقترح مواد مستدامة مناسبة لمشروع للمبتدئين.',
  );

  static const categoryToolsPrompt = LocalizedText(
    en: 'Which tools and equipment do I need for a beginner build?',
    ar: 'ما الأدوات والمعدات التي أحتاجها لبناء مبتدئ؟',
  );

  static const emptyTitle = LocalizedText(
    en: 'How can I help with your project?',
    ar: 'كيف يمكنني مساعدتك في مشروعك؟',
  );

  static const emptySubtitle = LocalizedText(
    en: 'Ask about materials, tools, safety, and step-by-step project guidance.',
    ar: 'اسأل عن المواد والأدوات والسلامة والإرشاد خطوة بخطوة لمشروعك.',
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

  static const chatAssistantTimeout = LocalizedText(
    en: 'The assistant took longer than expected. Please try again.',
    ar: 'استغرق المساعد وقتًا أطول من المتوقع. حاول مرة أخرى.',
  );

  static String materialsReadyBanner(BuildContext context, int ready, int total) {
    return LocalizedText(
      en: 'Materials: $ready/$total ready',
      ar: 'المواد: $ready من $total جاهزة',
    ).resolve(context);
  }

  static String currentStepBanner(BuildContext context, int stepNumber, String title) {
    return LocalizedText(
      en: 'Step $stepNumber: $title',
      ar: 'الخطوة $stepNumber: $title',
    ).resolve(context);
  }

  static String preparingMaterialsBanner(BuildContext context) {
    return LocalizedText(
      en: 'Preparing materials',
      ar: 'تحضير المواد',
    ).resolve(context);
  }

  static String completedStepsProgress(
    BuildContext context, {
    required int completed,
    required int total,
    required int percent,
  }) {
    return LocalizedText(
      en: 'Completed $completed of $total steps · $percent%',
      ar: 'أنجزت $completed من $total خطوات · $percent%',
    ).resolve(context);
  }

  static String currentStepOfTotal(
    BuildContext context, {
    required int stepNumber,
    required int total,
  }) {
    return LocalizedText(
      en: 'Current step: $stepNumber of $total',
      ar: 'الخطوة الحالية: $stepNumber من $total',
    ).resolve(context);
  }

  static const loading = LocalizedText(
    en: 'Thinking…',
    ar: 'جارٍ التفكير…',
  );

  static const analyzingIdea = LocalizedText(
    en: 'Analyzing your project idea…',
    ar: 'جارٍ تحليل فكرة مشروعك…',
  );

  static const authoringWhatIUnderstand = LocalizedText(
    en: 'What I understand',
    ar: 'ما أفهمه',
  );

  static const authoringCurrentQuestion = LocalizedText(
    en: 'Current question',
    ar: 'السؤال الحالي',
  );

  static const authoringAssumptions = LocalizedText(
    en: 'Assumptions',
    ar: 'افتراضات',
  );

  static const authoringWarnings = LocalizedText(
    en: 'Warnings',
    ar: 'تحذيرات',
  );

  static const authoringReadyForProposal = LocalizedText(
    en: 'Your project idea has enough detail to generate a structured draft.',
    ar: 'أصبحت فكرة مشروعك واضحة بما يكفي لإنشاء مسودة منظمة.',
  );

  static const authoringConfirmSelection = LocalizedText(
    en: 'Confirm selection',
    ar: 'تأكيد الاختيار',
  );

  static const authoringInputHint = LocalizedText(
    en: 'Answer about your project idea…',
    ar: 'أجب عن فكرة مشروعك…',
  );

  static const authoringGenerateProposal = LocalizedText(
    en: 'Generate project proposal',
    ar: 'إنشاء اقتراح المشروع',
  );

  static const authoringGeneratingProposal = LocalizedText(
    en: 'Generating your project proposal…',
    ar: 'جارٍ إنشاء اقتراح مشروعك…',
  );

  static const proposalGenerationInvalid = LocalizedText(
    en: 'The assistant could not create a valid proposal. Please try again.',
    ar: 'تعذر على المساعد إنشاء اقتراح صالح. يرجى المحاولة مرة أخرى.',
  );

  static const proposalGenerationRateLimited = LocalizedText(
    en: 'The AI service is temporarily busy. Please try again shortly.',
    ar: 'خدمة الذكاء الاصطناعي مشغولة مؤقتًا. يرجى المحاولة بعد قليل.',
  );

  static const proposalGenerationTimeout = LocalizedText(
    en: 'Proposal generation took too long. Please try again.',
    ar: 'استغرق إنشاء الاقتراح وقتًا طويلًا. يرجى المحاولة مرة أخرى.',
  );

  static const proposalAiDisabled = LocalizedText(
    en: 'AI project generation is currently unavailable.',
    ar: 'إنشاء المشروع بالذكاء الاصطناعي غير متاح حاليًا.',
  );

  static const authoringProposalPreviewBadge = LocalizedText(
    en: 'Preview',
    ar: 'معاينة',
  );

  static const authoringProposalPreviewNotice = LocalizedText(
    en: 'This is a preview. Your saved project has not been changed.',
    ar: 'هذه معاينة فقط. لم يتم تغيير مشروعك المحفوظ.',
  );

  static const authoringProposalStaleNotice = LocalizedText(
    en: 'Project changed after this proposal.',
    ar: 'تم تغيير المشروع بعد هذا الاقتراح.',
  );

  static const authoringProposalDescription = LocalizedText(
    en: 'Description',
    ar: 'الوصف',
  );

  static const authoringProposalShortDescription = LocalizedText(
    en: 'Summary',
    ar: 'الملخص',
  );

  static const authoringProposalRequiredComponents = LocalizedText(
    en: 'Required components',
    ar: 'المكونات المطلوبة',
  );

  static const authoringProposalSteps = LocalizedText(
    en: 'Steps',
    ar: 'الخطوات',
  );

  static const authoringProposalSafety = LocalizedText(
    en: 'Safety considerations',
    ar: 'اعتبارات السلامة',
  );

  static const authoringProposalEstimatedDuration = LocalizedText(
    en: 'Estimated duration',
    ar: 'المدة التقديرية',
  );

  static const authoringProposalDifficulty = LocalizedText(
    en: 'Difficulty',
    ar: 'الصعوبة',
  );

  static const authoringProposalOptional = LocalizedText(
    en: 'Optional',
    ar: 'اختياري',
  );

  static const authoringProposalRequired = LocalizedText(
    en: 'Required',
    ar: 'مطلوب',
  );

  static const authoringProposalSubstitutable = LocalizedText(
    en: 'Substitutions allowed',
    ar: 'يسمح بالبدائل',
  );

  static const authoringReviewAcceptProposal = LocalizedText(
    en: 'Accept proposal',
    ar: 'قبول الاقتراح',
  );

  static const authoringReviewKeepCurrent = LocalizedText(
    en: 'Keep current',
    ar: 'الإبقاء على الحالي',
  );

  static const authoringReviewRequestChanges = LocalizedText(
    en: 'Request changes',
    ar: 'طلب تعديلات',
  );

  static const authoringReviewChangeDecision = LocalizedText(
    en: 'Change decision',
    ar: 'تغيير القرار',
  );

  static const authoringReviewDecisionAccept = LocalizedText(
    en: 'Accepted',
    ar: 'مقبول',
  );

  static const authoringReviewDecisionKeep = LocalizedText(
    en: 'Keeping current',
    ar: 'يبقى الحالي',
  );

  static const authoringReviewDecisionRevision = LocalizedText(
    en: 'Needs revision',
    ar: 'بحاجة إلى مراجعة',
  );

  static const authoringReviewDecisionUnreviewed = LocalizedText(
    en: 'Not reviewed',
    ar: 'لم تتم المراجعة',
  );

  static const authoringReviewCurrentDraft = LocalizedText(
    en: 'Current draft',
    ar: 'المسودة الحالية',
  );

  static const authoringReviewRevisionCommentHint = LocalizedText(
    en: 'Describe what should change…',
    ar: 'صف التغيير المطلوب…',
  );

  static const authoringReviewSaveRequest = LocalizedText(
    en: 'Save request',
    ar: 'حفظ الطلب',
  );

  static const authoringReviewGenerateRevised = LocalizedText(
    en: 'Generate revised proposal',
    ar: 'إنشاء اقتراح مُراجع',
  );

  static const authoringReviewApplyReviewed = LocalizedText(
    en: 'Apply reviewed proposal',
    ar: 'تطبيق الاقتراح المراجع',
  );

  static const authoringReviewApplied = LocalizedText(
    en: 'Applied to draft',
    ar: 'تم التطبيق على المسودة',
  );

  static const authoringProposalUpdated = LocalizedText(
    en: 'Proposal updated',
    ar: 'تم تحديث الاقتراح',
  );

  static const authoringProposalVersion = LocalizedText(
    en: 'Version',
    ar: 'الإصدار',
  );

  static const authoringDiffAdded = LocalizedText(
    en: 'Added',
    ar: 'أُضيف',
  );

  static const authoringDiffRemoved = LocalizedText(
    en: 'Removed',
    ar: 'أُزيل',
  );

  static const authoringDiffUpdated = LocalizedText(
    en: 'Updated',
    ar: 'تم التحديث',
  );

  static const authoringDiffChangedTargets = LocalizedText(
    en: 'Changed sections',
    ar: 'الأقسام المتغيرة',
  );

  static const authoringReviewDiscuss = LocalizedText(
    en: 'Discuss',
    ar: 'ناقش',
  );

  static LocalizedText authoringDiscussingTargetLabel(String target) {
    return switch (target) {
      'title' => const LocalizedText(en: 'Discussing: Title', ar: 'النقاش: العنوان'),
      'shortDescription' => const LocalizedText(
          en: 'Discussing: Summary', ar: 'النقاش: الملخص'),
      'description' => const LocalizedText(
          en: 'Discussing: Description', ar: 'النقاش: الوصف'),
      'difficulty' => const LocalizedText(
          en: 'Discussing: Difficulty', ar: 'النقاش: الصعوبة'),
      'estimatedMinutes' => const LocalizedText(
          en: 'Discussing: Estimated duration',
          ar: 'النقاش: المدة التقديرية'),
      'components' => const LocalizedText(
          en: 'Discussing: Required components',
          ar: 'النقاش: المكوّنات المطلوبة'),
      'steps' => const LocalizedText(en: 'Discussing: Steps', ar: 'النقاش: الخطوات'),
      'TITLE' => const LocalizedText(en: 'Discussing: Title', ar: 'النقاش: العنوان'),
      'SHORT_DESCRIPTION' => const LocalizedText(
          en: 'Discussing: Summary', ar: 'النقاش: الملخص'),
      'FULL_DESCRIPTION' => const LocalizedText(
          en: 'Discussing: Description', ar: 'النقاش: الوصف'),
      'DIFFICULTY' => const LocalizedText(
          en: 'Discussing: Difficulty', ar: 'النقاش: الصعوبة'),
      'ESTIMATED_DURATION' => const LocalizedText(
          en: 'Discussing: Estimated duration',
          ar: 'النقاش: المدة التقديرية'),
      'COMPONENTS' => const LocalizedText(
          en: 'Discussing: Required components',
          ar: 'النقاش: المكوّنات المطلوبة'),
      'STEPS_OVERVIEW' => const LocalizedText(
          en: 'Discussing: Steps', ar: 'النقاش: الخطوات'),
      'STEP_REVIEW' => const LocalizedText(
          en: 'Discussing: Step', ar: 'النقاش: الخطوة'),
      _ => LocalizedText(en: 'Discussing: $target', ar: 'النقاش: $target'),
    };
  }

  static LocalizedText authoringDiscussComposerHintForSessionStage(String stage) {
    return switch (stage) {
      'TITLE' => authoringDiscussComposerHint('title'),
      'SHORT_DESCRIPTION' => authoringDiscussComposerHint('shortDescription'),
      'FULL_DESCRIPTION' => authoringDiscussComposerHint('description'),
      'DIFFICULTY' => authoringDiscussComposerHint('difficulty'),
      'ESTIMATED_DURATION' => authoringDiscussComposerHint('estimatedMinutes'),
      'COMPONENTS' => authoringDiscussComposerHint('components'),
      'STEPS_OVERVIEW' || 'STEP_REVIEW' => authoringDiscussComposerHint('steps'),
      _ => const LocalizedText(
          en: 'Describe the change you want…',
          ar: 'صف التغيير الذي تريده…',
        ),
    };
  }

  static LocalizedText authoringDiscussComposerHint(String target) {
    return switch (target) {
      'title' => const LocalizedText(
          en: 'Describe the title change you want…',
          ar: 'صف تغيير العنوان الذي تريده…'),
      'shortDescription' => const LocalizedText(
          en: 'Describe the summary change you want…',
          ar: 'صف تغيير الملخص الذي تريده…'),
      'description' => const LocalizedText(
          en: 'Describe the description change you want…',
          ar: 'صف تغيير الوصف الذي تريده…'),
      'difficulty' => const LocalizedText(
          en: 'Describe the difficulty change you want…',
          ar: 'صف تغيير مستوى الصعوبة الذي تريده…'),
      'estimatedMinutes' => const LocalizedText(
          en: 'Describe the duration change you want…',
          ar: 'صف تغيير المدة التي تريدها…'),
      'components' => const LocalizedText(
          en: 'Describe the component changes you want…',
          ar: 'صف تغييرات المكوّنات التي تريدها…'),
      'steps' => const LocalizedText(
          en: 'Describe the step changes you want…',
          ar: 'صف تغييرات الخطوات التي تريدها…'),
      _ => LocalizedText(
          en: 'Describe the change you want for $target…',
          ar: 'صف التغيير الذي تريده لـ $target…',
        ),
    };
  }

  static LocalizedText authoringReviewProgressSummary(
    int resolved,
    int total,
    int needsDiscussion,
  ) {
    return LocalizedText(
      en: '$resolved of $total reviewed'
          '${needsDiscussion > 0 ? ' · $needsDiscussion need discussion' : ''}',
      ar: '$resolved من $total تمت مراجعتها'
          '${needsDiscussion > 0 ? ' · $needsDiscussion بحاجة إلى نقاش' : ''}',
    );
  }

  static LocalizedText authoringReviewStatusLabel(String status) {
    return switch (status) {
      'READY_TO_APPLY' => const LocalizedText(
          en: 'Ready to apply', ar: 'جاهز للتطبيق'),
      'DISCUSSION_NEEDED' => const LocalizedText(
          en: 'Discussion needed', ar: 'يلزم نقاش'),
      'APPLIED' => const LocalizedText(en: 'Applied', ar: 'تم التطبيق'),
      'STALE' => const LocalizedText(en: 'Stale', ar: 'قديم'),
      _ => const LocalizedText(en: 'In review', ar: 'قيد المراجعة'),
    };
  }

  static const authoringReviewCompleteBanner = LocalizedText(
    en: 'Review complete — all sections resolved',
    ar: 'اكتملت المراجعة — تم حسم جميع الأقسام',
  );

  static LocalizedText authoringReviewCompleteSummary(int resolved, int total) {
    return LocalizedText(
      en: 'Review complete — $resolved of $total sections resolved',
      ar: 'اكتملت المراجعة — $resolved من $total أقسام تم حسمها',
    );
  }

  static const authoringReviewLocked = LocalizedText(
    en: 'Locked',
    ar: 'مقفل',
  );

  static const authoringReviewYourRequest = LocalizedText(
    en: 'Your request',
    ar: 'طلبك',
  );

  static const authoringReviewDecisionUnderDiscussion = LocalizedText(
    en: 'Under discussion',
    ar: 'قيد النقاش',
  );

  static const authoringReviewDecisionRevisionRequested = LocalizedText(
    en: 'Revision requested',
    ar: 'طُلبت مراجعة',
  );

  static const authoringReviewContinueDiscussion = LocalizedText(
    en: 'Continue discussion',
    ar: 'متابعة النقاش',
  );

  static const authoringProposalAppliedSuccess = LocalizedText(
    en: 'Project proposal applied to your draft.',
    ar: 'تم تطبيق اقتراح المشروع على مسودتك.',
  );

  static const authoringSequentialProgressTitle = LocalizedText(
    en: 'Guided project authoring',
    ar: 'تأليف المشروع الموجّه',
  );

  static const authoringSequentialStart = LocalizedText(
    en: 'Start',
    ar: 'ابدأ',
  );

  static const authoringSequentialAcceptAndSave = LocalizedText(
    en: 'Accept and save',
    ar: 'اعتماد وحفظ',
  );

  static const authoringSequentialSuggestAnother = LocalizedText(
    en: 'Suggest another',
    ar: 'اقترح بديلًا',
  );

  static const authoringSequentialEnterOwnValue = LocalizedText(
    en: 'Enter my own value',
    ar: 'أدخل قيمتي الخاصة',
  );

  static const authoringSequentialEnterOwnComponentList = LocalizedText(
    en: 'Enter my own component list',
    ar: 'أدخل قائمة مكوّناتي',
  );

  static const authoringSequentialSavedComponents = LocalizedText(
    en: 'Current saved components',
    ar: 'المكوّنات المحفوظة حاليًا',
  );

  static const authoringSequentialProposedComponents = LocalizedText(
    en: 'Assistant proposal — not saved yet',
    ar: 'اقتراح المساعد — لم يُحفظ بعد',
  );

  static const authoringSequentialSaveComponentList = LocalizedText(
    en: 'Save component list',
    ar: 'حفظ قائمة المكوّنات',
  );

  static const authoringSequentialSaveManualValue = LocalizedText(
    en: 'Save this value',
    ar: 'احفظ هذه القيمة',
  );

  static const authoringSequentialManualPreview = LocalizedText(
    en: 'Preview',
    ar: 'معاينة',
  );

  static LocalizedText authoringSequentialManualHint(String stage) {
    return switch (stage) {
      'TITLE' => const LocalizedText(en: 'Enter your project title', ar: 'أدخل عنوان مشروعك'),
      'SHORT_DESCRIPTION' =>
        const LocalizedText(en: 'Enter a short description', ar: 'أدخل وصفًا مختصرًا'),
      'FULL_DESCRIPTION' =>
        const LocalizedText(en: 'Enter the full description', ar: 'أدخل الوصف الكامل'),
      'DIFFICULTY' =>
        const LocalizedText(en: 'Choose difficulty', ar: 'اختر مستوى الصعوبة'),
      'ESTIMATED_DURATION' =>
        const LocalizedText(en: 'Estimated minutes', ar: 'المدة بالدقائق'),
      _ => const LocalizedText(en: 'Enter your value', ar: 'أدخل قيمتك'),
    };
  }

  static const authoringSequentialRegenerateStale = LocalizedText(
    en: 'Generate a new suggestion using the updated draft',
    ar: 'أنشئ اقتراحًا جديدًا بناءً على المسودة المحدّثة',
  );

  static const authoringSequentialReviewFullList = LocalizedText(
    en: 'Review full list',
    ar: 'راجع القائمة كاملة',
  );

  static const authoringSequentialReviewCompletePlan = LocalizedText(
    en: 'Review complete plan',
    ar: 'راجع الخطة كاملة',
  );

  static const authoringSequentialReviewStepByStep = LocalizedText(
    en: 'Review step by step',
    ar: 'راجع خطوة بخطوة',
  );

  static const authoringSequentialReviewOneByOne = LocalizedText(
    en: 'Review one by one',
    ar: 'راجع واحدًا تلو الآخر',
  );

  static LocalizedText authoringSequentialComponentProgress(int current, int total) {
    return LocalizedText(
      en: 'Component $current of $total',
      ar: 'المكوّن $current من $total',
    );
  }

  static LocalizedText authoringSequentialStepProgress(int current, int total) {
    return LocalizedText(
      en: 'Step $current of $total',
      ar: 'الخطوة $current من $total',
    );
  }

  static const authoringSequentialAcceptComponent = LocalizedText(
    en: 'Accept component',
    ar: 'اعتماد المكوّن',
  );

  static const authoringSequentialAcceptStep = LocalizedText(
    en: 'Accept step',
    ar: 'اعتماد الخطوة',
  );

  static const authoringSequentialRemoveItem = LocalizedText(
    en: 'Remove',
    ar: 'إزالة',
  );

  static const authoringSequentialAddItem = LocalizedText(
    en: 'Add',
    ar: 'إضافة',
  );

  static const authoringSequentialBackItem = LocalizedText(
    en: 'Back',
    ar: 'رجوع',
  );

  static const authoringSequentialExplainStep = LocalizedText(
    en: 'Explain more',
    ar: 'اشرح أكثر',
  );

  static const authoringSequentialAcceptListAndSave = LocalizedText(
    en: 'Accept component list and save',
    ar: 'اعتماد قائمة المكوّنات وحفظها',
  );

  static const authoringSequentialAcceptPlanAndSave = LocalizedText(
    en: 'Accept steps and save',
    ar: 'اعتماد الخطوات وحفظها',
  );

  static const authoringSequentialEnterOwnSteps = LocalizedText(
    en: 'Enter my own steps',
    ar: 'أدخل خطواتي بنفسي',
  );

  static const authoringSequentialReloadDraft = LocalizedText(
    en: 'Reload draft',
    ar: 'إعادة تحميل المسودة',
  );

  static const authoringSequentialGeneratingStepPlan = LocalizedText(
    en: 'Generating your step plan…',
    ar: 'جارٍ إنشاء خطة الخطوات…',
  );

  static const authoringSequentialGenerateStepPlan = LocalizedText(
    en: 'Generate step plan',
    ar: 'إنشاء خطة الخطوات',
  );

  static const authoringSequentialFinalReviewSummary = LocalizedText(
    en: 'Final review',
    ar: 'المراجعة النهائية',
  );

  static const authoringSequentialLegacyTransitionBanner = LocalizedText(
    en:
        'Your project uses the previous review flow. Continue with the new guided authoring assistant.',
    ar: 'مشروعك يستخدم تدفق المراجعة السابق. تابع باستخدام مساعد التأليف الموجّه الجديد.',
  );

  static const authoringSequentialContinueGuided = LocalizedText(
    en: 'Continue guided authoring',
    ar: 'متابعة التأليف الموجّه',
  );

  static const authoringSequentialFinalReview = LocalizedText(
    en: 'Your project draft is ready.',
    ar: 'مسودة مشروعك جاهزة.',
  );

  static const authoringSequentialFinish = LocalizedText(
    en: 'Finish authoring',
    ar: 'إنهاء التأليف',
  );

  static LocalizedText authoringSequentialStageLabel(String stage) {
    return switch (stage) {
      'TITLE' => const LocalizedText(en: 'Title', ar: 'العنوان'),
      'SHORT_DESCRIPTION' =>
        const LocalizedText(en: 'Short description', ar: 'الوصف المختصر'),
      'FULL_DESCRIPTION' =>
        const LocalizedText(en: 'Full description', ar: 'الوصف الكامل'),
      'DIFFICULTY' => const LocalizedText(en: 'Difficulty', ar: 'الصعوبة'),
      'ESTIMATED_DURATION' =>
        const LocalizedText(en: 'Estimated duration', ar: 'المدة التقديرية'),
      'COMPONENTS' =>
        const LocalizedText(en: 'Required components', ar: 'المكوّنات المطلوبة'),
      'STEPS_OVERVIEW' => const LocalizedText(en: 'Build steps', ar: 'خطوات البناء'),
      'STEP_REVIEW' => const LocalizedText(en: 'Build steps', ar: 'خطوات البناء'),
      'FINAL_REVIEW' =>
        const LocalizedText(en: 'Final review', ar: 'المراجعة النهائية'),
      'COMPLETE' => const LocalizedText(en: 'Complete', ar: 'مكتمل'),
      _ => LocalizedText(en: stage, ar: stage),
    };
  }

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

  static const componentMatchesNoListing = LocalizedText(
    en: 'No currently available ImpactLoop listing was found.',
    ar: 'لا توجد حالياً أي قائمة متاحة على ImpactLoop.',
  );

  static const budgetEstimateSection = LocalizedText(
    en: 'Estimated available-material subtotal',
    ar: 'تقدير المواد المتوفرة حالياً',
  );

  static const budgetEstimatedSubtotal = LocalizedText(
    en: 'Estimated available-material subtotal',
    ar: 'مجموع المواد المتوفرة المقدّر',
  );

  static const budgetEstimateComplete = LocalizedText(
    en: 'Complete estimate',
    ar: 'تقدير كامل',
  );

  static const budgetEstimatePartial = LocalizedText(
    en: 'Partial estimate',
    ar: 'تقدير جزئي',
  );

  static const budgetEstimateZeroCost = LocalizedText(
    en: 'Complete estimate with free selected materials',
    ar: 'تقدير كامل بمواد مجانية مختارة',
  );

  static const budgetCoverageSummary = LocalizedText(
    en: '{priced} of {total} required components priced',
    ar: '{priced} من {total} مكونات مطلوبة بسعر محسوب',
  );

  static const budgetAlternativesCount = LocalizedText(
    en: '{count} cheaper alternatives not selected',
    ar: '{count} بدائل أغلى لم تُختَر',
  );

  static const budgetStatusSelected = LocalizedText(
    en: 'Selected',
    ar: 'مختار',
  );

  static const budgetStatusNoMatch = LocalizedText(
    en: 'No available match',
    ar: 'لا يوجد تطابق متاح',
  );

  static const budgetStatusInsufficient = LocalizedText(
    en: 'Insufficient quantity',
    ar: 'كمية غير كافية',
  );

  static const budgetStatusUnpriced = LocalizedText(
    en: 'Price unavailable',
    ar: 'السعر غير متاح',
  );

  static const budgetStatusUnsupportedCurrency = LocalizedText(
    en: 'Unsupported currency',
    ar: 'عملة غير مدعومة',
  );

  static const budgetStatusUnitAssumption = LocalizedText(
    en: 'Unit assumption required',
    ar: 'يتطلب افتراض وحدة',
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

  static const externalSourcesCaveat = LocalizedText(
    en: 'External web results; ImpactLoop has not verified these sources.',
    ar: 'نتائج خارجية من الويب؛ لم تتحقق ImpactLoop من هذه المصادر.',
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

  static const viewMaterial = LocalizedText(
    en: 'View material',
    ar: 'عرض المادة',
  );

  static const matchedComponentsLabel = LocalizedText(
    en: 'Matched',
    ar: 'متطابقة',
  );

  static const missingComponentsLabel = LocalizedText(
    en: 'Missing',
    ar: 'ناقصة',
  );

  static const coverageLabel = LocalizedText(
    en: 'coverage',
    ar: 'تغطية',
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
        return proposalAiDisabled.resolve(context);
      case 'AI_RATE_LIMITED':
      case 'AI_PROVIDER_RATE_LIMITED':
        return proposalGenerationRateLimited.resolve(context);
      case 'AI_CONVERSATION_BUSY':
        return busyConversation.resolve(context);
      case 'AI_PROVIDER_TIMEOUT':
      case 'TIMEOUT':
        return chatAssistantTimeout.resolve(context);
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
        return proposalGenerationInvalid.resolve(context);
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
      default:
        return genericFailure.resolve(context);
    }
  }
}
