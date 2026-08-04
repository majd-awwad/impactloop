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
