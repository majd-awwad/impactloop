import 'package:flutter/material.dart';

class AccountSettingsL10n {
  AccountSettingsL10n._(this._languageCode);

  final String _languageCode;

  bool get isArabic => _languageCode == 'ar';

  static AccountSettingsL10n of(BuildContext context) {
    return AccountSettingsL10n._(
      Localizations.localeOf(context).languageCode.toLowerCase(),
    );
  }

  String t(String en, String ar) => isArabic ? ar : en;

  String get pageTitle => t('Account and Settings', 'الحساب والإعدادات');
  String get accountFallback => t('Account', 'الحساب');
  String get accountUnavailable => t(
    'Your account information is temporarily unavailable.',
    'معلومات حسابك غير متاحة مؤقتاً.',
  );
  String get back => t('Back', 'رجوع');
  String get editPersonalInformation =>
      t('Edit personal information', 'تعديل المعلومات الشخصية');
  String get editProfile => t('Edit profile', 'تعديل الملف الشخصي');
  String get editProfileSubtitle => t(
    'Update your personal information and profile photo.',
    'حدّث معلوماتك الشخصية وصورة ملفك.',
  );
  String get profileUpdated =>
      t('Profile updated.', 'تم تحديث الملف الشخصي.');
  String get updateProfileFailed => t(
    'Could not update your profile. Please try again.',
    'تعذّر تحديث ملفك الشخصي. حاول مرة أخرى.',
  );
  String get profileSavedRefreshFailed => t(
    'Profile saved, but current account details could not be refreshed.',
    'تم حفظ الملف الشخصي، لكن تعذّر تحديث بيانات الحساب الحالية.',
  );
  String get basicInformation => t('Basic information', 'المعلومات الأساسية');
  String get basicInformationBody => t(
    'Update your name and phone number.',
    'حدّث اسمك ورقم هاتفك.',
  );
  String get displayName => t('Display name', 'اسم العرض');
  String get displayNameHelper => t(
    'This is the name that will appear to others on ImpactLoop.',
    'هذا هو الاسم الذي سيظهر للآخرين في ImpactLoop.',
  );
  String get displayNameTooShort => t(
    'Display name must be at least 2 characters',
    'يجب ألا يقل اسم العرض عن حرفين',
  );
  String get optional => t('Optional', 'اختياري');
  String get phoneVerificationReset => t(
    'Saving a new phone number will mark it as not verified.',
    'سيؤدي حفظ رقم هاتف جديد إلى اعتباره غير موثّق.',
  );
  String get saveChanges => t('Save changes', 'حفظ التغييرات');
  String get saving => t('Saving...', 'جارٍ الحفظ...');
  String get profilePhoto => t('Profile photo', 'صورة الملف الشخصي');
  String get profilePhotoBody => t(
    'Your photo is used throughout ImpactLoop.',
    'تُستخدم صورتك في جميع أنحاء ImpactLoop.',
  );
  String get profilePhotoQualityTip => t(
    'Prefer a clear, high-quality image.',
    'يُفضل استخدام صورة واضحة وبجودة عالية.',
  );
  String get profilePhotoGuidelinesTitle =>
      t('Image guidelines', 'إرشادات الصورة');
  String get profilePhotoGuidelinesBody => t(
    'Use a simple background when possible. JPG, PNG, or WebP up to 5 MB.',
    'استخدم خلفية بسيطة إن أمكن. JPG أو PNG أو WebP بحجم لا يتجاوز 5 ميجابايت.',
  );
  String get profilePhotoRequirements => t(
    'JPG, PNG, or WebP up to 5 MB.',
    'JPG أو PNG أو WebP بحجم لا يتجاوز 5 ميجابايت.',
  );
  String get choosePhoto => t('Choose photo', 'اختيار صورة');
  String get uploading => t('Uploading...', 'جارٍ الرفع...');
  String get remove => t('Remove', 'إزالة');
  String get removePhoto => t('Remove photo', 'إزالة الصورة');
  String get imageReadFailed => t(
    'Could not read the selected image.',
    'تعذّرت قراءة الصورة المحددة.',
  );
  String get imageTooLarge => t(
    'The image must be 5 MB or smaller.',
    'يجب ألا يتجاوز حجم الصورة 5 ميجابايت.',
  );

  String get accountDetails => t('Account details', 'تفاصيل الحساب');
  String get accountEssentials => t('Account essentials', 'أساسيات الحساب');
  String get personalInformation =>
      t('Personal information', 'المعلومات الشخصية');
  String get personalInformationBody =>
      t('Name, phone, and profile photo.', 'الاسم والهاتف وصورة الملف الشخصي.');
  String get savedLocations => t('Saved locations', 'المواقع المحفوظة');
  String get savedLocationsBody => t(
    'Manage private addresses used across ImpactLoop.',
    'أدر العناوين الخاصة المستخدمة في ImpactLoop.',
  );
  String get security => t('Security', 'الأمان');
  String get securityBody => t('Change your password.', 'غيّر كلمة المرور.');
  String get changePasswordIntro => t(
    'Change your password using your current password.',
    'غيّر كلمة المرور باستخدام كلمة المرور الحالية.',
  );
  String get currentPassword => t('Current password', 'كلمة المرور الحالية');
  String get newPassword => t('New password', 'كلمة المرور الجديدة');
  String get confirmNewPassword =>
      t('Confirm new password', 'تأكيد كلمة المرور الجديدة');
  String get updatePassword => t('Update password', 'تحديث كلمة المرور');
  String get updating => t('Updating...', 'جارٍ التحديث...');
  String get passwordUpdated => t(
    'Password updated successfully.',
    'تم تحديث كلمة المرور بنجاح.',
  );
  String get updatePasswordFailed => t(
    'Could not update your password. Please try again.',
    'تعذّر تحديث كلمة المرور. حاول مرة أخرى.',
  );
  String get fieldRequired => t('This field is required', 'هذا الحقل مطلوب');
  String get passwordTooShort => t(
    'Password must be at least 8 characters',
    'يجب ألا تقل كلمة المرور عن 8 أحرف',
  );
  String get passwordMustDiffer => t(
    'New password must be different from your current password',
    'يجب أن تختلف كلمة المرور الجديدة عن الحالية',
  );
  String get passwordsDoNotMatch =>
      t('Passwords do not match', 'كلمتا المرور غير متطابقتين');
  String get showPassword => t('Show password', 'إظهار كلمة المرور');
  String get hidePassword => t('Hide password', 'إخفاء كلمة المرور');

  String get appPreferences => t('App preferences', 'تفضيلات التطبيق');
  String get localPreferencesNote => t(
    'Appearance and language are stored on this device.',
    'يتم حفظ المظهر واللغة على هذا الجهاز.',
  );
  String get appearance => t('Appearance', 'المظهر');
  String get chooseAppearance => t('Choose appearance', 'اختر المظهر');
  String get language => t('Language', 'اللغة');
  String get chooseLanguage => t('Choose language', 'اختر اللغة');
  String get systemTheme => t('System', 'النظام');
  String get lightTheme => t('Light', 'فاتح');
  String get darkTheme => t('Dark', 'داكن');
  String get english => t('English', 'الإنجليزية');
  String get arabic => t('Arabic', 'العربية');

  String get communication => t('Communication', 'التواصل');
  String get notifications => t('Notifications', 'الإشعارات');
  String get notificationsBody =>
      t('Open your notifications inbox.', 'افتح صندوق الإشعارات الخاص بك.');

  String get rolesAndAccess => t('Roles and access', 'الأدوار والوصول');
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
  String get switchToLearner => t('Switch to Learner', 'التبديل إلى المتعلّم');
  String get switchToLearnerBody => t(
    'Open the learner portal on this account.',
    'افتح بوابة المتعلّم باستخدام هذا الحساب.',
  );
  String get becomeLearner => t('Become a Learner', 'انضم كمتعلّم');
  String get becomeLearnerBody => t(
    'Add learner access to this account.',
    'أضف صلاحية المتعلّم إلى هذا الحساب.',
  );
  String get organizationSupplierRestriction => t(
    'Organization supplier accounts stay in supplier mode.',
    'تبقى حسابات المؤسسات المورّدة في وضع المورد.',
  );
  String get portalSwitchFailed => t(
    'Could not switch portals. Please try again.',
    'تعذّر تبديل البوابة. حاول مرة أخرى.',
  );

  String get accountState => t('Account state', 'حالة الحساب');
  String get verification => t('Verification', 'التحقق');
  String get email => t('Email', 'البريد الإلكتروني');
  String get phone => t('Phone', 'الهاتف');
  String get verified => t('Verified', 'موثّق');
  String get notVerified => t('Not verified', 'غير موثّق');
  String get notAdded => t('Not added', 'غير مضاف');

  String get session => t('Session', 'الجلسة');
  String get logout => t('Logout', 'تسجيل الخروج');
  String get loggingOut => t('Logging out…', 'جارٍ تسجيل الخروج…');
  String get logoutTitle =>
      t('Log out of ImpactLoop?', 'تسجيل الخروج من ImpactLoop؟');
  String get logoutBody => t(
    'You will need to sign in again to access your account.',
    'ستحتاج إلى تسجيل الدخول مرة أخرى للوصول إلى حسابك.',
  );
  String get cancel => t('Cancel', 'إلغاء');
  String get confirmLogout => t('Log out', 'تسجيل الخروج');
  String get localLogoutWarning => t(
    'You were signed out locally, but the server could not be reached.',
    'تم تسجيل خروجك محلياً، لكن تعذّر الوصول إلى الخادم.',
  );

  String avatarLabel(String name) =>
      t('Profile image for $name', 'صورة الملف الشخصي لـ $name');
  String destinationSemantics(String title, String detail) =>
      t('$title. $detail Open destination.', '$title. $detail فتح الوجهة.');
  String verificationSemantics(String field, String value, String status) =>
      t('$field, $value, $status.', '$field، $value، $status.');
  String preferenceOptionSemantics(
    String group,
    String option,
    bool selected,
  ) => t(
    '$group, $option, ${selected ? 'selected' : 'not selected'}.',
    '$group، $option، ${selected ? 'محدد' : 'غير محدد'}.',
  );
  String get logoutSemantics =>
      t('Logout. Destructive action.', 'تسجيل الخروج. إجراء حاسم.');

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
      'INACTIVE' => t('Inactive', 'غير نشط'),
      'DISABLED' => t('Disabled', 'معطّل'),
      'PENDING_VERIFICATION' => t('Pending verification', 'بانتظار التحقق'),
      final value => humanize(value),
    };
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
