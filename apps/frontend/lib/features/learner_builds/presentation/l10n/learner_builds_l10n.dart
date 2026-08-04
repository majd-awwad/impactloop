import '../../../../shared/models/localized_text.dart';
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
    en: 'Archived builds are hidden from active work but stay here for reference.',
    ar: 'المشاريع المؤرشفة مخفية من العمل النشط ولكنها تبقى هنا للرجوع إليها.',
  );

  static const emptyPortfolioTitle = LocalizedText(
    en: 'No portfolio entries yet',
    ar: 'لا توجد إنجازات في المعرض بعد',
  );

  static const emptyPortfolioSubtitle = LocalizedText(
    en: 'Complete a project build to showcase your impact here.',
    ar: 'أكمل مشروعاً لعرض أثرك هنا.',
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
    en: 'View completed',
    ar: 'عرض المكتمل',
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

  static const addPhoto = LocalizedText(en: 'Add photo', ar: 'إضافة صورة');

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
}
