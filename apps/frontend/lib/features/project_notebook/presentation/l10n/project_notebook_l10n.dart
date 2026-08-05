import '../../../../shared/models/localized_text.dart';

class ProjectNotebookL10n {
  const ProjectNotebookL10n._();

  static const projectNotebook = LocalizedText(
    en: 'Project notebook',
    ar: 'دفتر المشروع',
  );

  static const privateToYou = LocalizedText(
    en: 'Private to you',
    ar: 'دفتر خاص بك',
  );

  static const privacyMessage = LocalizedText(
    en:
        'Your notes and drawings are private to this Build and are not published or shared with other users.',
    ar:
        'ملاحظاتك ورسوماتك خاصة بهذا المشروع ولا يتم نشرها أو مشاركتها مع مستخدمين آخرين.',
  );

  static const pages = LocalizedText(en: 'Pages', ar: 'الصفحات');
  static const addPage = LocalizedText(en: 'Add page', ar: 'إضافة صفحة');
  static const deletePage = LocalizedText(en: 'Delete page', ar: 'حذف الصفحة');
  static const clearPage = LocalizedText(en: 'Clear page', ar: 'مسح الصفحة');
  static const notes = LocalizedText(en: 'Notes', ar: 'ملاحظات');
  static const drawing = LocalizedText(en: 'Drawing', ar: 'رسم');
  static const pageTitle = LocalizedText(en: 'Page title', ar: 'عنوان الصفحة');
  static const pen = LocalizedText(en: 'Pen', ar: 'قلم');
  static const eraser = LocalizedText(en: 'Eraser', ar: 'ممحاة');
  static const undo = LocalizedText(en: 'Undo', ar: 'تراجع');
  static const redo = LocalizedText(en: 'Redo', ar: 'إعادة');
  static const clearDrawing = LocalizedText(
    en: 'Clear drawing',
    ar: 'مسح الرسم',
  );
  static const strokeSize = LocalizedText(
    en: 'Stroke size',
    ar: 'سمك الخط',
  );
  static const exportPdf = LocalizedText(en: 'Export PDF', ar: 'تنزيل PDF');
  static const generatingPdf = LocalizedText(
    en: 'Generating PDF…',
    ar: 'جارٍ إنشاء PDF…',
  );
  static const saved = LocalizedText(en: 'Saved', ar: 'تم الحفظ');
  static const saving = LocalizedText(en: 'Saving…', ar: 'جارٍ الحفظ...');
  static const couldNotSave = LocalizedText(
    en: 'Could not save',
    ar: 'تعذر الحفظ',
  );
  static const retry = LocalizedText(en: 'Retry', ar: 'إعادة المحاولة');
  static const notebookUnavailable = LocalizedText(
    en: 'Notebook unavailable',
    ar: 'الدفتر غير متاح',
  );
  static const readOnly = LocalizedText(en: 'Read only', ar: 'للقراءة فقط');
  static const archivedReadOnly = LocalizedText(
    en: 'Archived notebooks are read-only',
    ar: 'دفاتر المشاريع المؤرشفة للقراءة فقط',
  );
  static const loadError = LocalizedText(
    en: 'Could not load the project notebook.',
    ar: 'تعذر تحميل دفتر المشروع.',
  );
  static const backToBuild = LocalizedText(
    en: 'Back to Build',
    ar: 'العودة إلى المشروع',
  );
  static const privateNotebookLabel = LocalizedText(
    en: 'Private notebook',
    ar: 'دفتر خاص',
  );
  static const lastEdited = LocalizedText(
    en: 'Last edit',
    ar: 'آخر تعديل',
  );
  static const created = LocalizedText(en: 'Created', ar: 'تاريخ الإنشاء');
  static const totalPages = LocalizedText(
    en: 'Total pages',
    ar: 'عدد الصفحات',
  );
  static const deletePageTitle = LocalizedText(
    en: 'Delete this page?',
    ar: 'حذف هذه الصفحة؟',
  );
  static const deletePageBody = LocalizedText(
    en: 'This page and its notes and drawing will be removed.',
    ar: 'سيتم حذف هذه الصفحة وملاحظاتها ورسمها.',
  );
  static const clearDrawingTitle = LocalizedText(
    en: 'Clear drawing?',
    ar: 'مسح الرسم؟',
  );
  static const clearDrawingBody = LocalizedText(
    en: 'All strokes on this page will be removed.',
    ar: 'سيتم حذف جميع الخطوط في هذه الصفحة.',
  );
  static const cancel = LocalizedText(en: 'Cancel', ar: 'إلغاء');
  static const delete = LocalizedText(en: 'Delete', ar: 'حذف');
  static const clear = LocalizedText(en: 'Clear', ar: 'مسح');
  static const pdfExportFailed = LocalizedText(
    en: 'Could not export the notebook PDF.',
    ar: 'تعذر تنزيل PDF.',
  );
  static const selectPage = LocalizedText(
    en: 'Select page',
    ar: 'اختر صفحة',
  );
  static const drawingCanvas = LocalizedText(
    en: 'Drawing canvas',
    ar: 'لوحة الرسم',
  );
  static const notesField = LocalizedText(
    en: 'Notes text field',
    ar: 'حقل الملاحظات',
  );
  static const information = LocalizedText(en: 'Information', ar: 'معلومات');
  static const attemptNumber = LocalizedText(en: 'Attempt', ar: 'المحاولة');
  static const exportDate = LocalizedText(en: 'Export date', ar: 'تاريخ التصدير');
  static const impactLoop = LocalizedText(en: 'ImpactLoop', ar: 'ImpactLoop');

  static const drawHelper = LocalizedText(
    en: 'Draw using mouse, touch, or stylus.',
    ar: 'يمكنك الرسم بالماوس أو اللمس أو القلم.',
  );

  static const pageLimitReached = LocalizedText(
    en: 'Maximum of 20 pages reached.',
    ar: 'تم الوصول إلى الحد الأقصى وهو 20 صفحة.',
  );

  static const addPageSaveFailed = LocalizedText(
    en:
        'Could not save the new page. It is still available locally and you can retry.',
    ar:
        'تعذر حفظ الصفحة الجديدة. بقيت الصفحة محفوظة محليًا ويمكنك إعادة المحاولة.',
  );

  static const drawingSaveFailed = LocalizedText(
    en:
        'Could not save the drawing. Your drawing was not lost and you can retry.',
    ar: 'تعذر حفظ الرسم. لم يتم فقدان الرسم ويمكنك إعادة المحاولة.',
  );
}
