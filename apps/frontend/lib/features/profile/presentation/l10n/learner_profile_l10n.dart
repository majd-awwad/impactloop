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
  String get editProfile => t('Edit profile', 'تعديل الملف');
  String avatarLabel(String name) =>
      t('Profile photo for $name', 'الصورة الشخصية لـ $name');
  String get verifiedLearner => t('Verified learner', 'متعلّم موثّق');

  String get profileCompletion =>
      t('Profile completion', 'اكتمال الملف الشخصي');
  String get profileCompletionBody => t(
    'You are closer to a complete, personalized experience.',
    'اقتربت من تجربة مكتملة ومخصصة لك.',
  );
  String completionSteps(int completed, int total) => t(
    '$completed of $total steps complete',
    '$completed من $total خطوات مكتملة',
  );
  String completionSemantics(int percentage, int completed, int total) => t(
    'Profile completion, $percentage percent, $completed of $total steps complete',
    'اكتمال الملف الشخصي، $percentage بالمئة، $completed من $total خطوات مكتملة',
  );
  String get profileComplete => t('Profile complete', 'ملفك مكتمل');
  String get profileCompleteBody =>
      t('Your learner profile is ready.', 'ملف المتعلّم الخاص بك جاهز.');
  String completionAction(String step) {
    return switch (step) {
      'display_name' => t('Add or update your name', 'أضف اسمك أو حدّثه'),
      'phone' => t('Add or review your phone', 'أضف رقم هاتفك أو راجعه'),
      'learning_basics' => t('Add your learning basics', 'أضف أساسيات التعلّم'),
      'interests' => t('Add your interests', 'أضف اهتماماتك'),
      'bio' => t('Add a short bio', 'أضف نبذة قصيرة'),
      'saved_location' => t('Add a saved location', 'أضف موقعاً محفوظاً'),
      _ => t('Complete your profile', 'أكمل ملفك الشخصي'),
    };
  }

  String get yourJourney => t('Your journey', 'رحلتك في ImpactLoop');
  String get activeReservations => t('Active reservations', 'حجوزات نشطة');
  String get completedBuilds => t('Completed builds', 'مشاريع مكتملة');
  String get savedProjects => t('Saved projects', 'مشاريع محفوظة');
  String get likedMaterials => t('Liked materials', 'المواد التي أعجبتني');
  String get materialRequests =>
      t('Material requests', 'طلبات المواد');
  String get myBuilds => t('My builds', 'مشاريعي');
  String get portfolio => t('Portfolio', 'معرض الإنجازات');
  String get openMyBuilds => t('Open my builds', 'فتح مشاريعي');
  String get openPortfolio => t('Open portfolio', 'فتح معرض الإنجازات');
  String get openMaterialRequests =>
      t('Open material requests', 'فتح طلبات المواد');
  String metricSemantics(String label, String count) =>
      t('$label, $count. Open.', '$label، $count. فتح.');

  String get continueProject => t('Continue project', 'متابعة المشروع');
  String get continueProjectBody =>
      t('Pick up where you left off.', 'أكمل من حيث توقفت.');
  String buildProgress(int completed, int total) =>
      t('$completed of $total steps', '$completed من $total خطوات');
  String lastActivity(String date) =>
      t('Last activity $date', 'آخر نشاط $date');
  String continueProjectSemantics(
    String title,
    int percentage,
    int completed,
    int total,
  ) => t(
    'Continue $title. $percentage percent complete, $completed of $total steps.',
    'متابعة $title. مكتمل بنسبة $percentage بالمئة، $completed من $total خطوات.',
  );

  String get learningIdentity => t('Your learning profile', 'ملف تعلّمك');
  String get quickActions => t('Quick actions', 'إجراءات سريعة');
  String get savedLocations => t('Saved locations', 'المواقع المحفوظة');
  String get openSavedLocations =>
      t('Open saved locations', 'فتح المواقع المحفوظة');
  String get openAccountSettings =>
      t('Open Account and Settings', 'فتح الحساب والإعدادات');

  String get dashboardLoading =>
      t('Loading profile dashboard', 'جارٍ تحميل لوحة الملف الشخصي');
  String get dashboardLoadFailed =>
      t('Your dashboard could not be loaded.', 'تعذّر تحميل لوحة ملفك الشخصي.');
  String get dashboardLoadFailedBody => t(
    'Your account and learning details are still available.',
    'لا تزال تفاصيل حسابك وتعلّمك متاحة.',
  );
  String get retry => t('Try again', 'حاول مرة أخرى');
  String get refreshFailed => t(
    'Some profile details could not be refreshed.',
    'تعذّر تحديث بعض تفاصيل الملف الشخصي.',
  );

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
  String get setUp => t('Set up', 'إعداد');
  String get setUpLearningProfile =>
      t('Set up learning profile', 'إعداد ملف التعلّم');
  String get noLearningProfileTitle =>
      t('No learning details yet', 'لا توجد تفاصيل تعلّم بعد');
  String get noLearningProfileBody => t(
    'Add your learner type, skill level, interests, and an optional bio.',
    'أضف نوع المتعلّم ومستوى الخبرة والاهتمامات ونبذة اختيارية.',
  );
  String get learningDetails => t('Learning details', 'تفاصيل التعلّم');
  String get learningSummaryTitle => t('Your learning profile', 'ملف تعلّمك');
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
  String showMoreInterests(int count) =>
      t('Show $count more interests', 'عرض $count اهتمامات أخرى');
  String get showFewerInterests =>
      t('Show fewer interests', 'عرض اهتمامات أقل');
  String hiddenInterestsSemantics(int count) => t(
    '$count more interests. Expand interests.',
    '$count اهتمامات أخرى. توسيع الاهتمامات.',
  );
  String get showFewerInterestsSemantics => t(
    'Show fewer interests. Collapse interests.',
    'عرض اهتمامات أقل. طي الاهتمامات.',
  );
  String get showMoreBio => t('Show more bio', 'عرض المزيد من النبذة');
  String get showLessBio => t('Show less bio', 'عرض أقل من النبذة');
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
  String get accountSection => t('Account', 'الحساب');
  String get learningProfileDestination => t('Learning profile', 'ملف التعلّم');
  String get openLearningProfile =>
      t('Open learning profile', 'فتح ملف التعلّم');
  String get completeLearningProfile =>
      t('Complete learning profile', 'إكمال ملف التعلّم');
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
  String get reviewAccountAction => t('Review account', 'مراجعة الحساب');

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
      'student' => t('Student', 'طالب'),
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
