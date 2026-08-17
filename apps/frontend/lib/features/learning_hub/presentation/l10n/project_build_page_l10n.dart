import '../../../../core/errors/api_exception.dart';
import '../../../../shared/models/localized_text.dart';

enum ProjectBuildLifecycleErrorAction {
  pause,
  resume,
  archive,
  buildAgain,
  materialRequest,
}

class ProjectBuildPageL10n {
  const ProjectBuildPageL10n._();

  static const buildActions = LocalizedText(
    en: 'Build actions',
    ar: 'إجراءات المشروع',
  );

  static const backToProject = LocalizedText(
    en: 'Back to project',
    ar: 'العودة إلى المشروع',
  );

  static const myBuilds = LocalizedText(en: 'My builds', ar: 'مشاريعي');

  static const progressSavedAutomatically = LocalizedText(
    en: 'Progress is saved automatically.',
    ar: 'يتم حفظ تقدمك تلقائيًا.',
  );

  static const resumeBuild = LocalizedText(
    en: 'Resume build',
    ar: 'استئناف المشروع',
  );

  static const editCompletionStory = LocalizedText(
    en: 'Edit completion story',
    ar: 'تعديل قصة الإنجاز',
  );

  static const pauseConfirmTitle = LocalizedText(
    en: 'Pause this build?',
    ar: 'إيقاف هذا المشروع مؤقتًا؟',
  );

  static const pauseConfirmBody = LocalizedText(
    en: 'Your progress will be saved. Active reservations and their deadlines will continue.',
    ar: 'سيتم حفظ تقدمك، وستستمر الحجوزات النشطة ومواعيدها.',
  );

  static const archiveConfirmTitle = LocalizedText(
    en: 'Archive this build?',
    ar: 'أرشفة هذا المشروع؟',
  );

  static const archiveConfirmBody = LocalizedText(
    en: 'The build will become read-only and will no longer appear in your active projects.',
    ar: 'سيصبح المشروع للقراءة فقط ولن يظهر ضمن مشاريعك النشطة.',
  );

  static const confirm = LocalizedText(en: 'Confirm', ar: 'تأكيد');

  static const cancel = LocalizedText(en: 'Cancel', ar: 'إلغاء');

  static const errorPauseBuild = LocalizedText(
    en: 'Couldn’t pause this build.',
    ar: 'تعذر إيقاف هذا المشروع مؤقتًا.',
  );

  static const errorResumeBuild = LocalizedText(
    en: 'Couldn’t resume this build.',
    ar: 'تعذر استئناف هذا المشروع.',
  );

  static const errorArchiveBuild = LocalizedText(
    en: 'This build can’t be archived while it has active reservations.',
    ar: 'لا يمكن أرشفة هذا المشروع أثناء وجود حجوزات نشطة.',
  );

  static const errorArchiveBuildGeneric = LocalizedText(
    en: 'Couldn’t archive this build.',
    ar: 'تعذر أرشفة هذا المشروع.',
  );

  static const errorBuildAgain = LocalizedText(
    en: 'Couldn’t start another build attempt.',
    ar: 'تعذر بدء محاولة جديدة للمشروع.',
  );

  static const errorMaterialRequest = LocalizedText(
    en: 'Couldn’t create the material request.',
    ar: 'تعذر إنشاء طلب المادة.',
  );

  static const completedHeaderTitle = LocalizedText(
    en: 'Project completed',
    ar: 'تم إكمال المشروع',
  );

  static const completedHeaderBody = LocalizedText(
    en: 'You finished the practical build. Review your result and learning journey below.',
    ar: 'أنهيت تنفيذ المشروع عمليًا. راجع النتيجة ورحلة التعلم أدناه.',
  );

  static const attemptLabel = LocalizedText(en: 'Attempt', ar: 'المحاولة');

  static const completedOn = LocalizedText(en: 'Completed on', ar: 'اكتمل في');

  static const sectionBuildResult = LocalizedText(
    en: 'Build result',
    ar: 'نتيجة المشروع',
  );

  static const sectionCompletionStoryPhotos = LocalizedText(
    en: 'Completion story and result photos',
    ar: 'قصة الإنجاز وصور النتيجة',
  );

  static const overviewPracticalResult = LocalizedText(
    en: 'Practical result',
    ar: 'النتيجة العملية',
  );

  static const overviewLearningJourney = LocalizedText(
    en: 'Learning journey',
    ar: 'رحلة التعلم',
  );

  static const overviewCompletionStory = LocalizedText(
    en: 'Completion story',
    ar: 'قصة الإنجاز',
  );

  static const reviewAnswers = LocalizedText(
    en: 'Review answers',
    ar: 'مراجعة الإجابات',
  );

  static const continueFinalCheck = LocalizedText(
    en: 'Continue final check',
    ar: 'متابعة التحقق النهائي',
  );

  static const addLearningReflection = LocalizedText(
    en: 'Add learning reflection',
    ar: 'إضافة مراجعة التعلم',
  );

  static const editLearningReflection = LocalizedText(
    en: 'Edit learning reflection',
    ar: 'تعديل مراجعة التعلم',
  );

  static const reflectionNotAdded = LocalizedText(
    en: 'Reflection not added yet',
    ar: 'لم تُضف مراجعة التعلم بعد',
  );

  static const storyNotAdded = LocalizedText(
    en: 'Story not added yet',
    ar: 'لم تُضف قصة الإنجاز بعد',
  );

  static const photosNotAdded = LocalizedText(
    en: 'No result photos yet',
    ar: 'لا توجد صور نتيجة بعد',
  );

  static const stepLabel = LocalizedText(en: 'Step', ar: 'الخطوة');

  static const whyThisStepMatters = LocalizedText(
    en: 'Why does this step matter?',
    ar: 'لماذا هذه الخطوة مهمة؟',
  );

  static const sectionLearningJourney = LocalizedText(
    en: 'Learning journey',
    ar: 'رحلة التعلم',
  );

  static const sectionCheckReview = LocalizedText(
    en: 'Check review',
    ar: 'مراجعة الأسئلة',
  );

  static const sectionNextActions = LocalizedText(
    en: 'Next actions',
    ar: 'الخطوات التالية',
  );

  static const startCheckGroup = LocalizedText(
    en: 'Start check',
    ar: 'أسئلة البداية',
  );

  static const stepCheckGroup = LocalizedText(
    en: 'Step checks',
    ar: 'أسئلة الخطوات',
  );

  static const finalCheckGroup = LocalizedText(
    en: 'Final check',
    ar: 'الأسئلة النهائية',
  );

  static const checkGroupProgress = LocalizedText(
    en: 'handled',
    ar: 'تمت معالجتها',
  );

  static const checkGroupCorrect = LocalizedText(en: 'correct', ar: 'صحيحة');

  static const checkGroupSkipped = LocalizedText(en: 'skipped', ar: 'متخطاة');

  static const checkGroupRemaining = LocalizedText(
    en: 'remaining',
    ar: 'متبقية',
  );

  static const statusAnsweredCorrectly = LocalizedText(
    en: 'Answered correctly',
    ar: 'تمت الإجابة بشكل صحيح',
  );

  static const statusNeedsReview = LocalizedText(
    en: 'Your answer needs review',
    ar: 'إجابتك بحاجة إلى مراجعة',
  );

  static const statusSkippedForNow = LocalizedText(
    en: 'Skipped for now',
    ar: 'تم التخطي مؤقتًا',
  );

  static const statusNotAnswered = LocalizedText(
    en: 'Not answered',
    ar: 'لم تُجب',
  );

  static const yourAnswer = LocalizedText(en: 'Your answer', ar: 'إجابتك');

  static const correctAnswer = LocalizedText(
    en: 'Correct answer',
    ar: 'الإجابة الصحيحة',
  );

  static const explanation = LocalizedText(en: 'Explanation', ar: 'الشرح');

  static const hintViewed = LocalizedText(
    en: 'Hint viewed',
    ar: 'تم عرض التلميح',
  );

  static const attemptCountLabel = LocalizedText(
    en: 'Attempts',
    ar: 'المحاولات',
  );

  static const completedStepsSummary = LocalizedText(
    en: 'Completed steps',
    ar: 'الخطوات المكتملة',
  );

  static const materialsSummary = LocalizedText(
    en: 'Materials ready',
    ar: 'المواد الجاهزة',
  );

  static const viewPrivatePortfolio = LocalizedText(
    en: 'View achievement portfolio',
    ar: 'عرض ملف الإنجاز',
  );

  static const addToPortfolio = LocalizedText(
    en: 'Add to my achievement portfolio',
    ar: 'إضافة إلى ملف إنجازي',
  );

  static const preparingProject = LocalizedText(
    en: 'Preparing the project',
    ar: 'تجهيز المشروع',
  );

  static LocalizedText materialsReadyCount(int ready, int total) =>
      LocalizedText(en: '$ready of $total ready', ar: '$ready من $total جاهزة');

  static LocalizedText materialsRemainingToStart(int count) => LocalizedText(
    en: count == 1
        ? '1 material still needs to be completed'
        : '$count materials still need to be completed',
    ar: _arMaterialsNeedCompletion(count),
  );

  static String _arMaterialsNeedCompletion(int count) {
    if (count <= 0) {
      return 'لا توجد مواد تحتاج إكمال';
    }
    if (count == 1) {
      return 'مادة واحدة تحتاج إكمال';
    }
    if (count == 2) {
      return 'مادتان تحتاجان إكمال';
    }
    if (count <= 10) {
      return '$count مواد تحتاج إكمال';
    }
    return '$count مادة تحتاج إكمال';
  }

  static String _arReadyMaterials(int count) {
    if (count <= 0) {
      return 'لا توجد مواد جاهزة';
    }
    if (count == 1) {
      return 'مادة واحدة جاهزة';
    }
    if (count == 2) {
      return 'مادتان جاهزتان';
    }
    if (count <= 10) {
      return '$count مواد جاهزة';
    }
    return '$count مادة جاهزة';
  }

  static const continuePreparingMaterials = LocalizedText(
    en: 'Continue preparing materials',
    ar: 'كمّل تجهيز المواد',
  );

  static const requiredMaterials = LocalizedText(
    en: 'Required materials',
    ar: 'المواد المطلوبة',
  );

  static const prepareMaterialsTitle = LocalizedText(
    en: 'Prepare materials',
    ar: 'تجهيز المواد',
  );

  static const notProvidedYet = LocalizedText(
    en: 'Not provided yet',
    ar: 'لم يتم توفيره بعد',
  );

  static const prepareReadyStatus = LocalizedText(en: 'Ready', ar: 'جاهز');

  static const prepareInProgressStatus = LocalizedText(
    en: 'In progress',
    ar: 'قيد التجهيز',
  );

  static const prepareNeedsActionStatus = LocalizedText(
    en: 'Needs action',
    ar: 'يحتاج إجراء',
  );

  static const prepareNeedsUpdateStatus = LocalizedText(
    en: 'Needs update',
    ar: 'يحتاج تحديث',
  );

  static const ownedNeedsUpdateBody = LocalizedText(
    en: 'This component is marked as owned, but readiness is not confirmed yet.',
    ar: 'هذا المكوّن مُعلَّم كمتوفر لديك، لكن الجاهزية غير مؤكدة بعد.',
  );

  static const prepareMissingStatus = LocalizedText(en: 'Missing', ar: 'مفقود');

  static const prepareOptionsStatus = LocalizedText(
    en: 'Options available',
    ar: 'خيارات متاحة',
  );

  static const prepareAlternativeStatus = LocalizedText(
    en: 'Selected alternative',
    ar: 'بديل مختار',
  );

  static const prepareSelectedStatus = LocalizedText(
    en: 'Selected material',
    ar: 'مادة مختارة',
  );

  static const availableOnHand = LocalizedText(
    en: 'You already have this',
    ar: 'متوفر لديك',
  );

  static const materialAcquiredShort = LocalizedText(
    en: 'Material acquired',
    ar: 'تم الحصول على المادة',
  );

  static const linkedToReservationShort = LocalizedText(
    en: 'Linked to your reservation',
    ar: 'مرتبط بحجزك',
  );

  static const waitingForPickup = LocalizedText(
    en: 'Waiting for pickup to complete',
    ar: 'بانتظار اكتمال الاستلام',
  );

  static const matchesFound = LocalizedText(
    en: 'We found materials that may fit this component',
    ar: 'وجدنا مواد قد تناسب هذا المكوّن',
  );

  static const componentNotProvided = LocalizedText(
    en: 'This component has not been provided yet',
    ar: 'لم يتم توفير هذا المكوّن بعد',
  );

  static const noMaterialChosen = LocalizedText(
    en: 'No material has been selected for this component yet',
    ar: 'لم يتم اختيار مادة لهذا المكوّن بعد',
  );

  static const prepareMissingBody = LocalizedText(
    en: 'You have not chosen a material for this component yet',
    ar: 'لم تختر مادة لهذا المكوّن بعد',
  );

  static const prepareFindMaterial = LocalizedText(
    en: 'Find material',
    ar: 'العثور على مادة',
  );

  static const prepareReserveMaterial = LocalizedText(
    en: 'Reserve material',
    ar: 'احجز المادة',
  );

  static const selectedMaterialBody = LocalizedText(
    en: 'A material has been selected for this component.\nFinish the reservation to make it ready for the project.',
    ar: 'تم اختيار مادة لهذا المكوّن.\nأكمل الحجز لتصبح جاهزة للمشروع.',
  );

  static const prepareSelectedBody = LocalizedText(
    en: 'Finish the reservation to make it ready for the project.',
    ar: 'أكمل الحجز لتصبح جاهزة للمشروع.',
  );

  static const reservedMaterialBody = LocalizedText(
    en: 'This component is linked to your reservation.\nWaiting for pickup to complete.',
    ar: 'تم ربط هذا المكوّن بحجزك.\nبانتظار اكتمال الاستلام.',
  );

  static const readyOnHandForUse = LocalizedText(
    en: 'You already have this · ready to use',
    ar: 'متوفر لديك · جاهز للاستخدام',
  );

  static const chooseAnotherMaterial = LocalizedText(
    en: 'Choose another material',
    ar: 'اختيار مادة أخرى',
  );

  static const viewDetails = LocalizedText(
    en: 'View details',
    ar: 'عرض التفاصيل',
  );

  static const selectedNeedsReserve = LocalizedText(
    en: 'Reserve or acquire this material before building',
    ar: 'احجز هذه المادة أو احصل عليها قبل البناء',
  );

  static const viewOptions = LocalizedText(
    en: 'View options',
    ar: 'عرض الخيارات',
  );

  static const searchForMaterial = LocalizedText(
    en: 'Search for a material',
    ar: 'البحث عن مادة',
  );

  static const fixIssue = LocalizedText(en: 'Resolve', ar: 'حل المشكلة');

  static const viewAllRequiredMaterials = LocalizedText(
    en: 'View all required materials',
    ar: 'عرض كل المواد المطلوبة',
  );

  static LocalizedText needsActionGroup(int count) =>
      LocalizedText(en: 'Needs a choice · $count', ar: 'تحتاج اختيار · $count');

  static LocalizedText inProgressGroup(int count) =>
      LocalizedText(en: 'In progress · $count', ar: 'قيد التجهيز · $count');

  static LocalizedText readyGroup(int count) =>
      LocalizedText(en: 'Ready · $count', ar: 'جاهزة · $count');

  static LocalizedText prepareMixSummary({
    required int needsChoice,
    required int inProgress,
    required int ready,
  }) => LocalizedText(
    en: '$needsChoice need a choice · $inProgress in progress · $ready ready',
    ar: '$needsChoice تحتاج اختيار · $inProgress قيد التجهيز · $ready جاهزة',
  );

  static LocalizedText showMoreMaterials(int count) => LocalizedText(
    en: count == 1 ? 'Show 1 more material' : 'Show $count more materials',
    ar: _arShowMoreMaterials(count),
  );

  static String _arShowMoreMaterials(int count) {
    if (count <= 0) {
      return 'عرض المواد الأخرى';
    }
    if (count == 1) {
      return 'عرض مادة أخرى';
    }
    if (count == 2) {
      return 'عرض مادتين أخريين';
    }
    if (count <= 10) {
      return 'عرض $count مواد أخرى';
    }
    return 'عرض $count مادة أخرى';
  }

  static const hideExtraMaterials = LocalizedText(
    en: 'Hide extra materials',
    ar: 'إخفاء المواد الإضافية',
  );

  static const stillMissing = LocalizedText(
    en: 'Still missing',
    ar: 'لا يزال مفقودًا',
  );

  static LocalizedText readyMaterialsCollapsed(int count) => LocalizedText(
    en: count == 1 ? '1 material is ready' : '$count materials are ready',
    ar: _arReadyMaterials(count),
  );

  static const showReadyMaterials = LocalizedText(
    en: 'Show ready materials',
    ar: 'عرض المواد الجاهزة',
  );

  static const hideReadyMaterials = LocalizedText(
    en: 'Hide ready materials',
    ar: 'إخفاء المواد الجاهزة',
  );

  static const allMaterialsReady = LocalizedText(
    en: 'All materials are ready',
    ar: 'كل المواد جاهزة',
  );

  static const readyToStartBody = LocalizedText(
    en: 'You are ready to start this project.',
    ar: 'أنت جاهز لبدء المشروع.',
  );

  static const startBuilding = LocalizedText(
    en: 'Start building',
    ar: 'ابدأ البناء',
  );

  static LocalizedText stepOfTotal(int current, int total) => LocalizedText(
    en: 'Step $current of $total',
    ar: 'الخطوة $current من $total',
  );

  static LocalizedText stepOfTotalWithPercent({
    required int current,
    required int total,
    required int percent,
  }) => LocalizedText(
    en: 'Step $current of $total · $percent%',
    ar: 'الخطوة $current من $total · $percent%',
  );

  static const buildTools = LocalizedText(en: 'Build tools', ar: 'أدوات البناء');

  static const buildJourney = LocalizedText(
    en: 'Build journey',
    ar: 'رحلة البناء',
  );

  static const finishedThisStep = LocalizedText(
    en: 'I finished this step',
    ar: 'أنهيت هذه الخطوة',
  );

  static LocalizedText stepCompletedFeedback(int number) => LocalizedText(
    en: 'Step $number is done',
    ar: 'تم إنجاز الخطوة $number',
  );

  static const nextStepReady = LocalizedText(en: 'Next:', ar: 'التالي:');

  static const continueLabel = LocalizedText(en: 'Continue', ar: 'متابعة');

  static const needHelp = LocalizedText(en: 'Need help?', ar: 'تحتاج مساعدة؟');

  static const welcomeBack = LocalizedText(
    en: 'Welcome back',
    ar: 'أهلًا بعودتك',
  );

  static LocalizedText stoppedAtStep(int current, int total) => LocalizedText(
    en: 'You left off at step $current of $total',
    ar: 'توقفت عند الخطوة $current من $total',
  );

  static const continueFromHere = LocalizedText(
    en: 'Continue from where you left off',
    ar: 'متابعة من حيث توقفت',
  );

  static const showMaterials = LocalizedText(
    en: 'Show materials',
    ar: 'عرض المواد',
  );

  static const hideMaterials = LocalizedText(
    en: 'Hide materials',
    ar: 'إخفاء المواد',
  );

  static const moreDetails = LocalizedText(
    en: 'More details',
    ar: 'عرض التفاصيل',
  );

  static const learningAndHelp = LocalizedText(
    en: 'Learning and help',
    ar: 'التعلّم والمساعدة',
  );

  static const laterStatus = LocalizedText(en: 'Later', ar: 'لاحقًا');

  static const quickReview = LocalizedText(
    en: 'Quick review',
    ar: 'مراجعة سريعة',
  );

  static const reviewBeforeFinish = LocalizedText(
    en: 'Before finishing, review what you learned.',
    ar: 'قبل إنهاء المشروع، راجع ما تعلمته.',
  );

  static const skipForNow = LocalizedText(en: 'Skip for now', ar: 'تخطي الآن');

  static LocalizedText masteredConceptsCount(int count) => LocalizedText(
    en: count == 1 ? '1 concept mastered' : '$count concepts mastered',
    ar: count == 1 ? 'مفهوم واحد متقن' : '$count مفاهيم متقنة',
  );

  static LocalizedText reviewConceptsCount(int count) => LocalizedText(
    en: count == 1 ? '1 concept needs review' : '$count concepts need review',
    ar: count == 1 ? 'مفهوم يحتاج مراجعة' : '$count تحتاج مراجعة',
  );

  static const whatYouLearned = LocalizedText(
    en: 'What you learned',
    ar: 'ما تعلمته',
  );

  static LocalizedText youCompletedProject(String title) =>
      LocalizedText(en: 'You completed $title!', ar: 'أنجزت $title!');

  static LocalizedText stepsCompletedCount(int completed, int total) =>
      LocalizedText(
        en: '$completed of $total steps',
        ar: '$completed من $total خطوات',
      );

  static LocalizedText materialsProvidedCount(int ready, int total) =>
      LocalizedText(
        en: '$ready of $total materials ready',
        ar: '$ready من $total مادة',
      );

  static LocalizedText reusedMaterialsCount(int count) => LocalizedText(
    en: count == 1 ? '1 material reused' : '$count materials reused',
    ar: count == 1 ? 'مادة أُعيد استخدامها' : '$count مواد أُعيد استخدامها',
  );

  static const yourProjectImpact = LocalizedText(
    en: 'Your project impact',
    ar: 'أثر مشروعك',
  );

  static const viewBuildJourney = LocalizedText(
    en: 'View build journey',
    ar: 'عرض رحلة البناء',
  );

  static const hideBuildJourney = LocalizedText(
    en: 'Hide build journey',
    ar: 'إخفاء رحلة البناء',
  );

  static const addProjectPhoto = LocalizedText(
    en: 'Add a project photo',
    ar: 'أضف صورة للمشروع',
  );

  static const storyDraftHint = LocalizedText(
    en: 'Build story',
    ar: 'قصة البناء',
  );

  static const askAi = LocalizedText(en: 'Ask AI', ar: 'اسأل المساعد');

  static const continueWithAi = LocalizedText(
    en: 'Continue with AI',
    ar: 'متابعة مع المساعد',
  );

  static const editStory = LocalizedText(en: 'Edit story', ar: 'تعديل القصة');

  static const backToMyBuilds = LocalizedText(
    en: 'Back to My Builds',
    ar: 'العودة إلى مشاريعي',
  );

  static const addResultPhotos = LocalizedText(
    en: 'Add result photos',
    ar: 'إضافة صور النتيجة',
  );

  static const finalCheckUnavailable = LocalizedText(
    en: 'Final check is unavailable right now. You can still review your completed build.',
    ar: 'التحقق النهائي غير متاح الآن. يمكنك متابعة مراجعة مشروعك المكتمل.',
  );

  static const practicalProgressComplete = LocalizedText(
    en: 'Practical build complete',
    ar: 'اكتمل التنفيذ العملي',
  );

  static String lifecycleErrorMessage(
    Object error,
    ProjectBuildLifecycleErrorAction action,
    String languageCode,
  ) {
    if (error is ApiException) {
      if (error.code == 'BUILD_ARCHIVE_BLOCKED') {
        final blockers = error.details?['blockers'];
        if (blockers is List && blockers.isNotEmpty) {
          final first = blockers.first;
          if (first is Map && first['message'] is String) {
            return first['message'] as String;
          }
        }
        return errorArchiveBuild.resolveFor(languageCode);
      }

      if (error.message.trim().isNotEmpty &&
          error.message != 'Request failed') {
        return error.message;
      }
    }

    return switch (action) {
      ProjectBuildLifecycleErrorAction.pause => errorPauseBuild.resolveFor(
        languageCode,
      ),
      ProjectBuildLifecycleErrorAction.resume => errorResumeBuild.resolveFor(
        languageCode,
      ),
      ProjectBuildLifecycleErrorAction.archive =>
        errorArchiveBuildGeneric.resolveFor(languageCode),
      ProjectBuildLifecycleErrorAction.buildAgain => errorBuildAgain.resolveFor(
        languageCode,
      ),
      ProjectBuildLifecycleErrorAction.materialRequest =>
        errorMaterialRequest.resolveFor(languageCode),
    };
  }
}
