import 'package:flutter/widgets.dart';

class SavedLocationsL10n {
  const SavedLocationsL10n._(this.isArabic);

  factory SavedLocationsL10n.of(BuildContext context) {
    return SavedLocationsL10n._(
      Localizations.localeOf(context).languageCode.toLowerCase() == 'ar',
    );
  }

  final bool isArabic;

  String t(String en, String ar) => isArabic ? ar : en;

  String get pageTitle => t('Saved locations', 'المواقع المحفوظة');
  String get back => t('Back', 'رجوع');
  String get addLocation => t('Add location', 'إضافة موقع');
  String get edit => t('Edit', 'تعديل');
  String get delete => t('Delete', 'حذف');
  String get cancel => t('Cancel', 'إلغاء');
  String get retry => t('Retry', 'إعادة المحاولة');
  String get setDefault => t('Set default', 'تعيين كافتراضي');
  String get defaultLabel => t('Default', 'افتراضي');
  String get privateExactDetails =>
      t('Private exact details', 'تفاصيل دقيقة خاصة');
  String get created => t('Saved location created.', 'تم إنشاء الموقع المحفوظ.');
  String get updated => t('Saved location updated.', 'تم تحديث الموقع المحفوظ.');
  String get defaultUpdated =>
      t('Default location updated.', 'تم تحديث الموقع الافتراضي.');
  String get deleted => t('Saved location deleted.', 'تم حذف الموقع المحفوظ.');
  String get updateDefaultFailed => t(
    'Could not update the default location.',
    'تعذّر تحديث الموقع الافتراضي.',
  );
  String get deleteFailed => t(
    'Could not delete the saved location.',
    'تعذّر حذف الموقع المحفوظ.',
  );
  String address(String value) => t('Address: $value', 'العنوان: $value');
  String coordinates(String value) =>
      t('Coordinates: $value', 'الإحداثيات: $value');

  String get editLocation => t('Edit saved location', 'تعديل الموقع المحفوظ');
  String get label => t('Label', 'التسمية');
  String get labelHint =>
      t('Home, Workshop, Campus', 'المنزل، الورشة، الحرم الجامعي');
  String get city => t('City', 'المدينة');
  String get area => t('Area', 'المنطقة');
  String get exactAddress => t('Exact address', 'العنوان الدقيق');
  String get privateOptional => t('Private, optional', 'خاص، اختياري');
  String get country => t('Country', 'البلد');
  String get optional => t('Optional', 'اختياري');
  String get latitude => t('Latitude', 'خط العرض');
  String get longitude => t('Longitude', 'خط الطول');
  String get optionalExactCoordinate =>
      t('Optional exact coordinate', 'إحداثي دقيق اختياري');
  String get labelRequired => t('Label is required', 'التسمية مطلوبة');
  String get cityRequired => t('City is required', 'المدينة مطلوبة');
  String get countryRequired => t('Country is required', 'البلد مطلوب');
  String get cityRequiredForLookup => t(
    'City is required before looking up coordinates',
    'المدينة مطلوبة قبل البحث عن الإحداثيات',
  );
  String get longitudeRequired => t(
    'Longitude is required with latitude',
    'خط الطول مطلوب مع خط العرض',
  );
  String get latitudeRequired => t(
    'Latitude is required with longitude',
    'خط العرض مطلوب مع خط الطول',
  );
  String get useAsDefault =>
      t('Use as default saved location', 'استخدامه كموقع محفوظ افتراضي');
  String get saveChanges => t('Save changes', 'حفظ التغييرات');
  String get createLocation => t('Create location', 'إنشاء موقع');
  String get saving => t('Saving...', 'جارٍ الحفظ...');
  String get invalidNumber => t('Enter a valid number', 'أدخل رقماً صالحاً');
  String numberRange(String min, String max) => t(
    'Must be between $min and $max',
    'يجب أن تكون القيمة بين $min و$max',
  );
  String get createFailed => t(
    'Could not create this saved location.',
    'تعذّر إنشاء هذا الموقع المحفوظ.',
  );
  String get updateFailed => t(
    'Could not update this saved location.',
    'تعذّر تحديث هذا الموقع المحفوظ.',
  );

  String get mapPoint => t('Map point', 'نقطة الخريطة');
  String get findingTypedAddress => t(
    'Finding coordinates from typed address...',
    'جارٍ البحث عن إحداثيات العنوان المكتوب...',
  );
  String get lookingUpPoint => t(
    'Looking up address for selected point...',
    'جارٍ البحث عن عنوان النقطة المحددة...',
  );
  String get mapHelp => t(
    'Type city/area/street to find coordinates, or pick a point on the map.',
    'اكتب المدينة أو المنطقة أو الشارع للعثور على الإحداثيات، أو اختر نقطة على الخريطة.',
  );
  String get findTypedAddress =>
      t('Find typed address', 'البحث عن العنوان المكتوب');
  String get changeMapPoint => t('Change map point', 'تغيير نقطة الخريطة');
  String get pickOnMap => t('Pick on map', 'اختيار من الخريطة');
  String get pickExactPoint => t('Pick exact point', 'اختيار نقطة دقيقة');
  String get pickExactPointOnMap =>
      t('Pick exact point on map', 'اختيار نقطة دقيقة على الخريطة');
  String get tapMapToChoose => t(
    'Tap the map to choose exact coordinates.',
    'اضغط على الخريطة لاختيار إحداثيات دقيقة.',
  );
  String get mapPrivacyHelp => t(
    'Tap the map to set private exact coordinates. The app will reverse-geocode the point into readable fields when possible.',
    'اضغط على الخريطة لتعيين إحداثيات دقيقة خاصة. سيحوّل التطبيق النقطة إلى حقول عنوان مقروءة عند الإمكان.',
  );
  String reverseLookupFailed(String message) => t(
    'Coordinates were selected, but address lookup failed: $message',
    'تم تحديد الإحداثيات، لكن تعذّر العثور على العنوان: $message',
  );
  String get reverseLookupFailedFallback => t(
    'Coordinates were selected, but address lookup failed. You can save them manually.',
    'تم تحديد الإحداثيات، لكن تعذّر العثور على العنوان. يمكنك حفظها يدوياً.',
  );
  String forwardLookupFailed(String message) => t(
    'Could not find coordinates for this typed address: $message',
    'تعذّر العثور على إحداثيات لهذا العنوان المكتوب: $message',
  );
  String get forwardLookupFailedFallback => t(
    'Could not find coordinates for this typed address. Try adding area/street details or pick a point on the map.',
    'تعذّر العثور على إحداثيات لهذا العنوان. أضف تفاصيل المنطقة أو الشارع، أو اختر نقطة على الخريطة.',
  );

  String get deleteTitle =>
      t('Delete saved location?', 'حذف الموقع المحفوظ؟');
  String get deleteDefaultBody => t(
    'This is your default saved location. Deleting it may make another saved location the default.',
    'هذا هو موقعك المحفوظ الافتراضي. قد يؤدي حذفه إلى تعيين موقع آخر كافتراضي.',
  );
  String deleteBody(String label) => t(
    'This removes "$label" from your private saved locations.',
    'سيؤدي هذا إلى إزالة "$label" من مواقعك المحفوظة الخاصة.',
  );
  String get privacyTitle => t('Private location data', 'بيانات موقع خاصة');
  String get privacyBody => t(
    'Exact address and coordinates are private account data. Public material browsing uses only safe approximate location fields.',
    'العنوان الدقيق والإحداثيات بيانات حساب خاصة. يستخدم تصفح المواد العام حقول موقع تقريبية وآمنة فقط.',
  );
  String get emptyTitle =>
      t('No saved locations yet', 'لا توجد مواقع محفوظة بعد');
  String get emptyBody => t(
    'Add a private location to reuse it when sorting materials by nearest first.',
    'أضف موقعاً خاصاً لإعادة استخدامه عند ترتيب المواد حسب الأقرب.',
  );
}
