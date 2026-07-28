import 'package:flutter/material.dart';

class LearnerProfileL10n {
  LearnerProfileL10n._(this._languageCode);

  final String _languageCode;

  bool get isArabic => _languageCode == 'ar';

  static LearnerProfileL10n of(BuildContext context) {
    return LearnerProfileL10n._(
      Localizations.localeOf(context).languageCode.toLowerCase(),
    );
  }

  String t(String en, String ar) => isArabic ? ar : en;

  String get pageTitle => t('Profile', 'الملف الشخصي');
  String get accountFallback => t('Account', 'الحساب');
  String get signInToViewProfile =>
      t('Sign in to view your profile.', 'سجّل الدخول لعرض ملفك الشخصي.');

  String get learnerProfile => t('Learning profile', 'ملف التعلّم');
  String get learnerProfileDescription => t(
    'Your learning details help shape a more relevant experience.',
    'تساعد تفاصيل تعلّمك في تقديم تجربة أكثر ملاءمة لك.',
  );
  String get learningProfileIntro => t(
    'Your learner type, skill level, and interests help ImpactLoop tailor your learning experience. Your bio is optional.',
    'يساعد نوع المتعلّم ومستوى الخبرة والاهتمامات ImpactLoop على تهيئة تجربة التعلّم لك. النبذة اختيارية.',
  );
  String get editLearningProfile =>
      t('Edit learning profile', 'تعديل ملف التعلّم');
  String get setUpLearningProfile =>
      t('Set up learning profile', 'إعداد ملف التعلّم');
  String get noLearningProfileTitle =>
      t('No learning details yet', 'لا توجد تفاصيل تعلّم بعد');
  String get noLearningProfileBody => t(
    'Add your learner type, skill level, interests, and an optional bio.',
    'أضف نوع المتعلّم ومستوى الخبرة والاهتمامات ونبذة اختيارية.',
  );
  String get learningDetails => t('Learning details', 'تفاصيل التعلّم');
  String get learnerType => t('Learner type', 'نوع المتعلّم');
  String get skillLevel => t('Skill level', 'مستوى الخبرة');
  String get interests => t('Interests', 'الاهتمامات');
  String get about => t('Bio', 'نبذة');
  String get edit => t('Edit', 'تعديل');
  String get viewDetails => t('View details', 'عرض التفاصيل');
  String get notAdded => t('Not added', 'غير مضاف');
  String get optionalNotAdded =>
      t('Not added (optional)', 'غير مضافة (اختيارية)');
  String get noInterestsAdded => t('No interests added.', 'لم تُضف اهتمامات.');
  String showMore(int count) => t('Show $count more', 'عرض $count أخرى');
  String get showMoreContent => t('Show more', 'عرض المزيد');
  String get showLess => t('Show less', 'عرض أقل');
  String get back => t('Back', 'رجوع');
  String moreInterests(int count) => t('+$count more', '+$count أخرى');

  String get selectLearnerType =>
      t('Select your learner type', 'اختر نوع المتعلّم');
  String get selectSkillLevel =>
      t('Select your skill level', 'اختر مستوى الخبرة');
  String get learnerTypeRequired =>
      t('Learner type is required', 'نوع المتعلّم مطلوب');
  String get skillLevelRequired =>
      t('Skill level is required', 'مستوى الخبرة مطلوب');
  String get bioHint => t(
    'Share a short note about what you enjoy learning',
    'شارك نبذة قصيرة عمّا تستمتع بتعلّمه',
  );
  String get addAnotherInterest =>
      t('Add another interest (optional)', 'أضف اهتماماً آخر (اختياري)');
  String get customInterestHint =>
      t('Solar energy, CNC, etc.', 'الطاقة الشمسية، CNC، وغيرها.');
  String get saveChanges => t('Save changes', 'حفظ التغييرات');
  String get saving => t('Saving...', 'جارٍ الحفظ...');
  String get learnerProfileUpdated =>
      t('Learning profile updated.', 'تم تحديث ملف التعلّم.');
  String get updateLearnerProfileFailed => t(
    'Could not update your learning profile. Please try again.',
    'تعذّر تحديث ملف التعلّم. حاول مرة أخرى.',
  );
  String get learnerOnlyEditMessage => t(
    'Learning profile editing is available in learner mode.',
    'يتوفر تعديل ملف التعلّم في وضع المتعلّم.',
  );
  String get loadingInterests =>
      t('Loading interests...', 'جارٍ تحميل الاهتمامات...');
  String get interestFallbackMessage => t(
    'Interests could not be refreshed. You can still use the built-in list.',
    'تعذّر تحديث الاهتمامات. لا يزال بإمكانك استخدام القائمة المضمنة.',
  );

  String get setupProfileTitle =>
      t('Set up your learning profile', 'أعدّ ملف التعلّم الخاص بك');
  String get setupProfileBody => t(
    'Add your learner type, skill level, and interests.',
    'أضف نوع المتعلّم ومستوى الخبرة والاهتمامات.',
  );
  String get addInterestsTitle => t('Add your interests', 'أضف اهتماماتك');
  String get addInterestsBody => t(
    'Choose topics that can make learning suggestions more relevant.',
    'اختر موضوعات تساعد في جعل اقتراحات التعلّم أكثر ملاءمة.',
  );
  String get addLearningDetailsTitle =>
      t('Add your learning details', 'أضف تفاصيل تعلّمك');
  String missingLearningDetailsBody(bool typeMissing, bool levelMissing) {
    if (typeMissing && levelMissing) {
      return t(
        'Add your learner type and skill level.',
        'أضف نوع المتعلّم ومستوى الخبرة.',
      );
    }
    if (typeMissing) {
      return t('Add your learner type.', 'أضف نوع المتعلّم.');
    }
    return t('Add your skill level.', 'أضف مستوى الخبرة.');
  }

  String get addBio => t('Add a short bio', 'أضف نبذة قصيرة');
  String get noLearningDetails => t(
    'Your supported learning details will appear here.',
    'ستظهر تفاصيل تعلّمك المدعومة هنا.',
  );

  String get destinations => t('Your profile', 'ملفك الشخصي');
  String get learningProfileDestination => t('Learning Profile', 'ملف التعلّم');
  String get learningProfileDestinationBody => t(
    'View and update your learning details.',
    'اعرض تفاصيل تعلّمك وحدّثها.',
  );
  String get accountSettingsDestination =>
      t('Account and Settings', 'الحساب والإعدادات');
  String get accountSettingsDestinationBody => t(
    'Personal information, locations, security, appearance, and language.',
    'المعلومات الشخصية والمواقع والأمان والمظهر واللغة.',
  );

  String get accountSettingsLauncherTitle =>
      t('Account and Settings', 'الحساب والإعدادات');
  String get accountSettingsLauncherBody => t(
    'Manage the account actions already available in ImpactLoop.',
    'أدر إجراءات الحساب المتاحة حالياً في ImpactLoop.',
  );
  String get personalInformation =>
      t('Personal information', 'المعلومات الشخصية');
  String get personalInformationBody =>
      t('Name, phone, and profile photo.', 'الاسم والهاتف وصورة الملف.');
  String get savedLocations => t('Saved locations', 'المواقع المحفوظة');
  String get savedLocationsBody => t(
    'Manage private addresses used for discovery.',
    'أدر العناوين الخاصة المستخدمة في الاستكشاف.',
  );
  String get security => t('Security', 'الأمان');
  String get securityBody => t('Change your password.', 'غيّر كلمة المرور.');
  String get appearance => t('Appearance', 'المظهر');
  String get language => t('Language', 'اللغة');
  String get systemTheme => t('System', 'النظام');
  String get lightTheme => t('Light', 'فاتح');
  String get darkTheme => t('Dark', 'داكن');
  String get english => t('English', 'الإنجليزية');
  String get arabic => t('Arabic', 'العربية');
  String get logout => t('Logout', 'تسجيل الخروج');
  String get close => t('Close', 'إغلاق');
  String get localLogoutWarning => t(
    'You were signed out locally, but the server could not be reached.',
    'تم تسجيل خروجك محلياً، لكن تعذّر الوصول إلى الخادم.',
  );

  String get accountAccess => t('Account access', 'الوصول إلى الحساب');
  String get supplierProfile => t('Supplier profile', 'ملف المورد');
  String get supplierProfileBody =>
      t('Manage your supplier details.', 'أدر تفاصيل ملف المورد.');
  String get becomeSupplier => t('Become a supplier', 'انضم كمورد');
  String get becomeSupplierBody => t(
    'Start sharing reusable materials.',
    'ابدأ بمشاركة المواد القابلة لإعادة الاستخدام.',
  );
  String get switchToSupplier => t('Switch to Supplier', 'التبديل إلى المورد');
  String get switchToSupplierBody => t(
    'Open the supplier portal on this account.',
    'افتح بوابة المورد باستخدام هذا الحساب.',
  );

  String memberSince(String date) => t('Member since $date', 'عضو منذ $date');

  String get emailNotVerifiedTitle =>
      t('Email not verified', 'البريد الإلكتروني غير موثّق');
  String get emailNotVerifiedBody => t(
    'Email verification is still pending for this account.',
    'لا يزال توثيق البريد الإلكتروني معلقاً لهذا الحساب.',
  );
  String get phoneMissingTitle => t('Add a phone number', 'أضف رقم هاتف');
  String get phoneMissingBody => t(
    'Add a phone number to keep your contact details complete.',
    'أضف رقم هاتف لاستكمال معلومات التواصل الخاصة بك.',
  );
  String get addPhoneAction => t('Add phone', 'إضافة هاتف');
  String get phoneNotVerifiedTitle =>
      t('Phone not verified', 'رقم الهاتف غير موثّق');
  String get phoneNotVerifiedBody => t(
    'Review the phone number saved on this account.',
    'راجع رقم الهاتف المحفوظ في هذا الحساب.',
  );
  String get reviewPhoneAction => t('Review phone', 'مراجعة الهاتف');

  String roleLabel(String role) {
    return switch (role.trim().toUpperCase()) {
      'LEARNER' => t('Learner', 'متعلّم'),
      'SUPPLIER' => t('Supplier', 'مورد'),
      'DRIVER' => t('Driver', 'سائق'),
      'ADMIN' => t('Admin', 'مسؤول'),
      'MODERATOR' => t('Moderator', 'مشرف'),
      final value => humanize(value),
    };
  }

  String accountStatusLabel(String status) {
    return switch (status.trim().toUpperCase()) {
      'ACTIVE' => t('Active', 'نشط'),
      'SUSPENDED' => t('Suspended', 'معلّق'),
      'DISABLED' => t('Disabled', 'معطّل'),
      'PENDING_VERIFICATION' => t('Pending verification', 'بانتظار التحقق'),
      final value => humanize(value),
    };
  }

  String learnerTypeLabel(String value) {
    return switch (value.trim().toLowerCase()) {
      'university student' => t('University student', 'طالب جامعي'),
      'school student' => t('School student', 'طالب مدرسة'),
      'self learner' => t('Self learner', 'متعلّم ذاتي'),
      'maker / hobbyist' => t('Maker / hobbyist', 'صانع / هاوٍ'),
      _ => humanize(value),
    };
  }

  String skillLevelLabel(String value) {
    return switch (value.trim().toLowerCase()) {
      'beginner' => t('Beginner', 'مبتدئ'),
      'intermediate' => t('Intermediate', 'متوسط'),
      'advanced' => t('Advanced', 'متقدم'),
      'expert' => t('Expert', 'خبير'),
      _ => humanize(value),
    };
  }

  String interestLabel(String value) {
    final normalized = value.trim().toLowerCase();
    if (normalized.startsWith('custom:')) {
      return humanize(normalized.substring('custom:'.length));
    }
    return switch (normalized) {
      'electronics' => t('Electronics', 'الإلكترونيات'),
      'arduino' => t('Arduino', 'أردوينو'),
      'robotics' => t('Robotics', 'الروبوتات'),
      'sensors' => t('Sensors', 'المستشعرات'),
      'circuits' => t('Circuits', 'الدوائر'),
      'displays' => t('Displays', 'الشاشات'),
      'wires_connectors' => t('Wires & Connectors', 'الأسلاك والموصلات'),
      'audio_media' => t('Audio & Media', 'الصوت والوسائط'),
      'woodworking' => t('Woodworking', 'الأعمال الخشبية'),
      'fabric_textiles' => t('Fabric & Textiles', 'الأقمشة والمنسوجات'),
      'art_crafts' => t('Art & Crafts', 'الفنون والحرف'),
      'recycling' => t('Recycling', 'إعادة التدوير'),
      'home_diy' => t('Home DIY', 'الأعمال المنزلية اليدوية'),
      _ => humanize(value),
    };
  }

  bool hasLocalizedInterestLabel(String value) {
    final normalized = value.trim().toLowerCase();
    return normalized.startsWith('custom:') ||
        const {
          'electronics',
          'arduino',
          'robotics',
          'sensors',
          'circuits',
          'displays',
          'wires_connectors',
          'audio_media',
          'woodworking',
          'fabric_textiles',
          'art_crafts',
          'recycling',
          'home_diy',
        }.contains(normalized);
  }

  String humanize(String value) {
    final words = value
        .trim()
        .replaceAll('_', ' ')
        .split(RegExp(r'\s+'))
        .where((word) => word.isNotEmpty)
        .map((word) {
          final lower = word.toLowerCase();
          return lower.isEmpty
              ? lower
              : '${lower[0].toUpperCase()}${lower.substring(1)}';
        });
    return words.isEmpty ? value : words.join(' ');
  }
}
