import '../../../../shared/models/localized_text.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../learning_hub/domain/models/project_build.dart';

class LearnerBuildsL10n {
  const LearnerBuildsL10n._();

  static const myBuildsTitle = LocalizedText(
    en: 'My Builds',
    ar: 'مشاريعي',
  );

  static const myBuildsSubtitle = LocalizedText(
    en: 'Track active, paused, completed, and archived project builds.',
    ar: 'تابع مشاريعك النشطة، المؤجلة، المكتملة، والمؤرشفة.',
  );

  static const portfolioTitle = LocalizedText(
    en: 'Portfolio',
    ar: 'معرض الإنجازات',
  );

  static const portfolioSubtitle = LocalizedText(
    en: 'Completed builds and the impact you created.',
    ar: 'المشاريع المكتملة والأثر الذي حققته.',
  );

  static const tabActive = LocalizedText(en: 'Active', ar: 'نشطة');
  static const tabPaused = LocalizedText(en: 'Paused', ar: 'مؤجلة');
  static const tabCompleted = LocalizedText(en: 'Completed', ar: 'مكتملة');
  static const tabArchived = LocalizedText(en: 'Archived', ar: 'مؤرشفة');

  static const loading = LocalizedText(
    en: 'Loading your builds…',
    ar: 'جارٍ تحميل مشاريعك…',
  );

  static const loadError = LocalizedText(
    en: 'We could not load your builds.',
    ar: 'تعذّر تحميل مشاريعك.',
  );

  static const retry = LocalizedText(en: 'Retry', ar: 'إعادة المحاولة');

  static const emptyTitle = LocalizedText(
    en: 'No builds here yet',
    ar: 'لا توجد مشاريع هنا بعد',
  );

  static const emptyActiveSubtitle = LocalizedText(
    en: 'Start a project build from the Learning Hub to see it here.',
    ar: 'ابدأ مشروعاً من مركز التعلّم ليظهر هنا.',
  );

  static const emptyPausedSubtitle = LocalizedText(
    en: 'Paused builds will appear here when you pause an in-progress build.',
    ar: 'ستظهر المشاريع المؤجلة هنا عند إيقاف مشروع قيد التنفيذ مؤقتاً.',
  );

  static const emptyCompletedSubtitle = LocalizedText(
    en: 'Completed builds will appear here after you finish all steps.',
    ar: 'ستظهر المشاريع المكتملة هنا بعد إنهاء جميع الخطوات.',
  );

  static const emptyArchivedSubtitle = LocalizedText(
    en: 'No archived builds yet.',
    ar: 'لا توجد مشاريع مؤرشفة بعد.',
  );

  static const emptyPortfolioTitle = LocalizedText(
    en: 'Your private Portfolio is ready for completed projects.',
    ar: 'ملفك الخاص جاهز لمشاريعك المكتملة.',
  );

  static const emptyPortfolioSubtitle = LocalizedText(
    en:
        'Complete a project and add your story, photo, or learning reflection to see it here.',
    ar:
        'أكمل مشروعًا وأضف قصة إنجاز أو صورة أو مراجعة تعلم لتظهر هنا.',
  );

  static const exploreProjects = LocalizedText(
    en: 'Explore projects',
    ar: 'استكشف المشاريع',
  );

  static const portfolioLoading = LocalizedText(
    en: 'Loading your Portfolio…',
    ar: 'جارٍ تحميل ملفك الخاص…',
  );

  static const portfolioLoadError = LocalizedText(
    en: 'We could not load your Portfolio.',
    ar: 'تعذّر تحميل ملفك الخاص.',
  );

  static const attemptLabel = LocalizedText(en: 'Attempt', ar: 'محاولة');

  static LocalizedText attemptNumber(int number) => LocalizedText(
    en: 'Attempt $number',
    ar: 'المحاولة $number',
  );

  static LocalizedText statusLabel(ProjectBuildStatus status) {
    return switch (status) {
      ProjectBuildStatus.inProgress => LocalizedText(
        en: 'In progress',
        ar: 'قيد التنفيذ',
      ),
      ProjectBuildStatus.paused => const LocalizedText(
        en: 'Paused',
        ar: 'متوقف مؤقتًا',
      ),
      ProjectBuildStatus.completed => tabCompleted,
      ProjectBuildStatus.archived => tabArchived,
    };
  }

  static const openBuild = LocalizedText(en: 'Open build', ar: 'فتح المشروع');
  static const resumeBuild = LocalizedText(
    en: 'Resume build',
    ar: 'استئناف المشروع',
  );
  static const viewCompleted = LocalizedText(
    en: 'View completed build',
    ar: 'عرض المشروع المكتمل',
  );
  static const buildAgain = LocalizedText(en: 'Build again', ar: 'ابنِ مجدداً');
  static const pauseBuild = LocalizedText(en: 'Pause build', ar: 'إيقاف مؤقت');
  static const archiveBuild = LocalizedText(en: 'Archive', ar: 'أرشفة');

  static const readOnlyNotice = LocalizedText(
    en: 'This build is read-only.',
    ar: 'هذا المشروع للعرض فقط.',
  );

  static const pausedNotice = LocalizedText(
    en: 'This build is paused. Resume to keep editing.',
    ar: 'هذا المشروع متوقف مؤقتاً. تابع للمتابعة في التعديل.',
  );

  static const completionStoryTitle = LocalizedText(
    en: 'Completion story',
    ar: 'قصة الإنجاز',
  );

  static const completionStorySubtitle = LocalizedText(
    en: 'Share what you learned and how the build turned out.',
    ar: 'شارك ما تعلّمته وكيف سار المشروع.',
  );

  static const reflectionLabel = LocalizedText(
    en: 'Reflection',
    ar: 'تأملاتك',
  );

  static const captionLabel = LocalizedText(en: 'Caption', ar: 'وصف قصير');

  static const saveStory = LocalizedText(en: 'Save story', ar: 'حفظ القصة');

  static const savingStory = LocalizedText(
    en: 'Saving…',
    ar: 'جارٍ الحفظ…',
  );

  static const storySaved = LocalizedText(
    en: 'Story saved',
    ar: 'تم حفظ القصة',
  );

  static const storySavedNotice = LocalizedText(
    en: 'Your completion story is saved with this completed Build.',
    ar: 'تم حفظ القصة مع هذا المشروع المكتمل.',
  );

  static const addPhoto = LocalizedText(
    en: 'Add result photo',
    ar: 'إضافة صورة للنتيجة',
  );

  static const uploadPhoto = LocalizedText(
    en: 'Upload photo',
    ar: 'رفع الصورة',
  );

  static const uploadingPhoto = LocalizedText(
    en: 'Uploading…',
    ar: 'جارٍ رفع الصورة…',
  );

  static const photoUploaded = LocalizedText(
    en: 'Photo uploaded',
    ar: 'تم رفع الصورة',
  );

  static const photoUploadedNotice = LocalizedText(
    en: 'The photo is now part of this completed Build.',
    ar: 'تم رفع الصورة، وأصبحت جزءًا من هذا المشروع المكتمل.',
  );

  static const stayHere = LocalizedText(en: 'Stay here', ar: 'البقاء هنا');

  static const viewPrivatePortfolio = LocalizedText(
    en: 'View private Portfolio',
    ar: 'عرض الملف الخاص',
  );

  static const removePhoto = LocalizedText(
    en: 'Remove',
    ar: 'إزالة',
  );

  static const changePhoto = LocalizedText(
    en: 'Change',
    ar: 'تغيير',
  );

  static const resultPhotosTitle = LocalizedText(
    en: 'Result photos',
    ar: 'صور النتيجة',
  );

  static const uploadUnsupportedType = LocalizedText(
    en: 'This image format is not supported.',
    ar: 'صيغة الصورة غير مدعومة.',
  );

  static const uploadTooLarge = LocalizedText(
    en: 'The image is larger than the allowed size.',
    ar: 'حجم الصورة أكبر من الحد المسموح.',
  );

  static const uploadFailed = LocalizedText(
    en: 'Couldn’t upload the result photo. Please try again.',
    ar: 'تعذر رفع صورة النتيجة. حاول مرة أخرى.',
  );

  static const uploadInvalidFile = LocalizedText(
    en: 'Choose a valid image to upload.',
    ar: 'اختر صورة صالحة لرفعها.',
  );

  static const genericActionFailed = LocalizedText(
    en: 'Couldn’t complete this action.',
    ar: 'تعذر إكمال هذا الإجراء.',
  );

  static const impactSummaryTitle = LocalizedText(
    en: 'Impact summary',
    ar: 'ملخص الأثر',
  );

  static LocalizedText impactMaterialsAcquired(int count) => LocalizedText(
    en: '$count materials acquired via ImpactLoop',
    ar: '$count مواد تم الحصول عليها عبر ImpactLoop',
  );

  static LocalizedText impactStepsCompleted(int completed, int total) =>
      LocalizedText(
        en: '$completed of $total steps completed',
        ar: '$completed من $total خطوات مكتملة',
      );

  static const browseLearningHub = LocalizedText(
    en: 'Browse Learning Hub',
    ar: 'تصفّح مركز التعلّم',
  );

  static const learningGoalAdded = LocalizedText(
    en: 'Learning goal added',
    ar: 'تمت إضافة هدف تعليمي',
  );

  static LocalizedText learningChecksProgress(int handled, int total) =>
      LocalizedText(
        en: 'Learning checks $handled of $total',
        ar: 'تحققات التعلم $handled من $total',
      );

  static const reviewRecommended = LocalizedText(
    en: 'Review recommended',
    ar: 'يُنصح بالمراجعة',
  );

  static const startLearningCheck = LocalizedText(
    en: 'Start learning check',
    ar: 'ابدأ تحقق التعلم',
  );

  static const goalAchieved = LocalizedText(
    en: 'Goal achieved',
    ar: 'تم تحقيق الهدف',
  );

  static const goalPartiallyAchieved = LocalizedText(
    en: 'Partially achieved',
    ar: 'تحقق الهدف جزئيًا',
  );

  static const goalNotYetAchieved = LocalizedText(
    en: 'Not yet achieved',
    ar: 'لم يتحقق بعد',
  );

  static const notReviewedYet = LocalizedText(
    en: 'Not reviewed yet',
    ar: 'لم تتم المراجعة بعد',
  );

  static const learningReflectionAdded = LocalizedText(
    en: 'Learning reflection added',
    ar: 'تمت إضافة مراجعة التعلم',
  );

  static const learningJourneyTitle = LocalizedText(
    en: 'Learning journey',
    ar: 'رحلة التعلم',
  );

  static const personalGoal = LocalizedText(
    en: 'Personal goal',
    ar: 'الهدف الشخصي',
  );

  static const goalOutcome = LocalizedText(
    en: 'Goal outcome',
    ar: 'نتيجة الهدف',
  );

  static const conceptsUnderstood = LocalizedText(
    en: 'Concepts understood',
    ar: 'المفاهيم التي تم فهمها',
  );

  static const conceptsForReview = LocalizedText(
    en: 'Recommended for review',
    ar: 'مفاهيم يُنصح بمراجعتها',
  );

  static const learningReflection = LocalizedText(
    en: 'Reflection',
    ar: 'مراجعة التعلم',
  );

  static LocalizedText goalOutcomeLabel(String? outcome) {
    return switch (outcome?.toUpperCase()) {
      'ACHIEVED' => goalAchieved,
      'PARTIALLY_ACHIEVED' => goalPartiallyAchieved,
      'NOT_YET_ACHIEVED' => goalNotYetAchieved,
      _ => notReviewedYet,
    };
  }

  static const completionPhotoMaxBytes = 5 * 1024 * 1024;

  static const supportedCompletionPhotoMimeTypes = {
    'image/jpeg',
    'image/png',
    'image/webp',
  };

  static String completionPhotoUploadErrorMessage(
    Object error,
    String languageCode,
  ) {
    if (error is! ApiException) {
      return uploadFailed.resolveFor(languageCode);
    }

    final message = error.message.trim().toLowerCase();
    if (message == 'validation failed' ||
        message == 'request failed' ||
        message.contains('something went wrong')) {
      return uploadFailed.resolveFor(languageCode);
    }

    switch (error.code) {
      case 'VALIDATION_ERROR':
        if (message.contains('size') ||
            message.contains('maximum') ||
            message.contains('limit_file_size')) {
          return uploadTooLarge.resolveFor(languageCode);
        }
        if (message.contains('jpg') ||
            message.contains('png') ||
            message.contains('webp') ||
            message.contains('allowed') ||
            message.contains('format') ||
            message.contains('mime')) {
          return uploadUnsupportedType.resolveFor(languageCode);
        }
        if (message.contains('select an image') ||
            message.contains('empty') ||
            message.contains('valid image')) {
          return uploadInvalidFile.resolveFor(languageCode);
        }
        return uploadFailed.resolveFor(languageCode);
      case 'BUILD_NOT_COMPLETED':
      case 'COMPLETION_PHOTO_LIMIT':
        return error.message.isNotEmpty &&
                !_isGenericErrorMessage(error.message)
            ? error.message
            : uploadFailed.resolveFor(languageCode);
      case 'NETWORK_ERROR':
      case 'TIMEOUT':
        return uploadFailed.resolveFor(languageCode);
      default:
        return error.message.isNotEmpty &&
                !_isGenericErrorMessage(error.message)
            ? error.message
            : uploadFailed.resolveFor(languageCode);
    }
  }

  static bool _isGenericErrorMessage(String message) {
    final normalized = message.trim().toLowerCase();
    return normalized == 'validation failed' ||
        normalized == 'request failed' ||
        normalized.contains('something went wrong');
  }

  static String? mimeTypeForCompletionPhoto({
    required String? fileExtension,
    String? reportedMimeType,
  }) {
    final extensionMime = _mimeTypeForExtension(fileExtension);
    final normalizedMime = _normalizeReportedMime(reportedMimeType);

    if (normalizedMime != null) {
      if (!supportedCompletionPhotoMimeTypes.contains(normalizedMime)) {
        return null;
      }
      if (extensionMime != null && extensionMime != normalizedMime) {
        return null;
      }
      return normalizedMime;
    }

    return extensionMime;
  }

  static String? _mimeTypeForExtension(String? fileExtension) {
    return switch (fileExtension?.toLowerCase()) {
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      'webp' => 'image/webp',
      _ => null,
    };
  }

  static String? _normalizeReportedMime(String? reportedMimeType) {
    final normalized = reportedMimeType?.trim().toLowerCase();
    if (normalized == null || normalized.isEmpty) {
      return null;
    }
    if (normalized == 'image/jpg') {
      return 'image/jpeg';
    }
    if (normalized == 'application/octet-stream') {
      return null;
    }
    return normalized;
  }
}
