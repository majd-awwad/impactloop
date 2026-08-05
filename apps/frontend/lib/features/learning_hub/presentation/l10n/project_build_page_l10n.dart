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

  static const myBuilds = LocalizedText(
    en: 'My builds',
    ar: 'مشاريعي',
  );

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
    en:
        'Your progress will be saved. Active reservations and their deadlines will continue.',
    ar: 'سيتم حفظ تقدمك، وستستمر الحجوزات النشطة ومواعيدها.',
  );

  static const archiveConfirmTitle = LocalizedText(
    en: 'Archive this build?',
    ar: 'أرشفة هذا المشروع؟',
  );

  static const archiveConfirmBody = LocalizedText(
    en:
        'The build will become read-only and will no longer appear in your active projects.',
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
    en:
        'You finished the practical build. Review your result and learning journey below.',
    ar: 'أنهيت تنفيذ المشروع عمليًا. راجع النتيجة ورحلة التعلم أدناه.',
  );

  static const attemptLabel = LocalizedText(
    en: 'Attempt',
    ar: 'المحاولة',
  );

  static const completedOn = LocalizedText(
    en: 'Completed on',
    ar: 'اكتمل في',
  );

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

  static const stepLabel = LocalizedText(
    en: 'Step',
    ar: 'الخطوة',
  );

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

  static const checkGroupCorrect = LocalizedText(
    en: 'correct',
    ar: 'صحيحة',
  );

  static const checkGroupSkipped = LocalizedText(
    en: 'skipped',
    ar: 'متخطاة',
  );

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

  static const yourAnswer = LocalizedText(
    en: 'Your answer',
    ar: 'إجابتك',
  );

  static const correctAnswer = LocalizedText(
    en: 'Correct answer',
    ar: 'الإجابة الصحيحة',
  );

  static const explanation = LocalizedText(
    en: 'Explanation',
    ar: 'الشرح',
  );

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
    en: 'View private Portfolio',
    ar: 'عرض الملف الخاص',
  );

  static const stayOnBuild = LocalizedText(
    en: 'Stay on build',
    ar: 'البقاء في المشروع',
  );

  static const backToMyBuilds = LocalizedText(
    en: 'Back to My Builds',
    ar: 'العودة إلى مشاريعي',
  );

  static const addResultPhotos = LocalizedText(
    en: 'Add result photos',
    ar: 'إضافة صور النتيجة',
  );

  static const finalCheckUnavailable = LocalizedText(
    en:
        'Final check is unavailable right now. You can still review your completed build.',
    ar:
        'التحقق النهائي غير متاح الآن. يمكنك متابعة مراجعة مشروعك المكتمل.',
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
      ProjectBuildLifecycleErrorAction.pause =>
        errorPauseBuild.resolveFor(languageCode),
      ProjectBuildLifecycleErrorAction.resume =>
        errorResumeBuild.resolveFor(languageCode),
      ProjectBuildLifecycleErrorAction.archive =>
        errorArchiveBuildGeneric.resolveFor(languageCode),
      ProjectBuildLifecycleErrorAction.buildAgain =>
        errorBuildAgain.resolveFor(languageCode),
      ProjectBuildLifecycleErrorAction.materialRequest =>
        errorMaterialRequest.resolveFor(languageCode),
    };
  }
}
