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

  String get accountDetails => t('Account details', 'تفاصيل الحساب');
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

  String get avatarLabel => t('Profile image', 'صورة الملف الشخصي');

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
