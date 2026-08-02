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
  String get pageSubtitle => t(
    'Save your preferred addresses for faster booking, pickup, or delivery.',
    'احفظ عناوينك المفضلة للوصول السريع عند الحجز أو الاستلام أو التوصيل.',
  );
  String get back => t('Back', 'رجوع');
  String get addLocation => t('Add location', 'إضافة موقع');
  String get addNewLocation => t('Add new location', 'إضافة موقع جديد');
  String get edit => t('Edit', 'تعديل');
  String get editLocationAction => t('Edit location', 'تعديل الموقع');
  String get delete => t('Delete', 'حذف');
  String get deleteLocationAction => t('Delete location', 'حذف الموقع');
  String get cancel => t('Cancel', 'إلغاء');
  String get retry => t('Retry', 'إعادة المحاولة');
  String get setDefault => t('Set default', 'تعيين كافتراضي');
  String get setAsDefault => t('Set as default', 'تعيين كافتراضي');
  String get defaultLabel => t('Default', 'افتراضي');
  String get privateExactDetails =>
      t('Private exact details', 'تفاصيل دقيقة خاصة');
  String get mySavedLocations => t('My saved locations', 'مواقعي المحفوظة');
  String locationCount(int count) => t('$count', '$count');
  String locationCountLabel(int count) => t(
    count == 1 ? '1 saved location' : '$count saved locations',
    count == 1 ? 'موقع محفوظ واحد' : '$count مواقع محفوظة',
  );
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

  String get privacyTitle => t('Your location privacy', 'خصوصية موقعك');
  String get privacyBody => t(
    'Addresses and coordinates support reservation, pickup, delivery, and related platform functions. They stay private to your account and are not publicly exposed.',
    'تُستخدم العناوين والإحداثيات لدعم الحجز والاستلام والتوصيل ووظائف المنصة المرتبطة بالموقع. تبقى بيانات خاصة بحسابك ولا تُعرض للعامة.',
  );

  String get emptyTitle =>
      t('No saved locations yet', 'لا توجد مواقع محفوظة بعد');
  String get emptyBody => t(
    'Add a private location to reuse for booking, pickup, or delivery — or start from your current GPS position.',
    'أضف موقعاً خاصاً لإعادة استخدامه عند الحجز أو الاستلام أو التوصيل، أو ابدأ من موقعك الحالي عبر GPS.',
  );

  String get useCurrentLocation =>
      t('Use my current location', 'استخدام موقعي الحالي');
  String get useCurrentLocationDescription => t(
    'We will ask for device location permission, then prefill a new saved location. Review the details and save only when you are ready.',
    'سنطلب إذن الموقع من الجهاز ثم نملأ موقعًا محفوظًا جديدًا. راجع التفاصيل واحفظ فقط عندما تكون جاهزًا.',
  );
  String get useCurrentLocationLoading => t(
    'Getting your current location...',
    'جارٍ الحصول على موقعك الحالي...',
  );
  String get locationServicesDisabled => t(
    'Location services are turned off. Enable them, then try again.',
    'خدمات الموقع معطّلة. فعّلها ثم حاول مرة أخرى.',
  );
  String get locationPermissionDenied => t(
    'Location permission was denied. Allow location access to continue.',
    'تم رفض إذن الموقع. اسمح بالوصول إلى الموقع للمتابعة.',
  );
  String get locationPermissionDeniedForever => t(
    'Location permission is permanently denied. Enable it in browser or device settings.',
    'إذن الموقع مرفوض بشكل دائم. فعّله من إعدادات المتصفح أو الجهاز.',
  );
  String get locationUnavailable => t(
    'Could not get your current position. Try again or enter the address manually.',
    'تعذّر الحصول على موقعك الحالي. حاول مرة أخرى أو أدخل العنوان يدويًا.',
  );
  String get locationTimeout => t(
    'Getting your location timed out. Try again or enter the address manually.',
    'انتهت مهلة الحصول على موقعك. حاول مرة أخرى أو أدخل العنوان يدويًا.',
  );
  String get locationUnsupported => t(
    'Current location is not supported in this browser or device.',
    'الموقع الحالي غير مدعوم في هذا المتصفح أو الجهاز.',
  );
  String get locationGenericFailure => t(
    'Something went wrong while getting your location. Please try again.',
    'حدث خطأ أثناء الحصول على موقعك. حاول مرة أخرى.',
  );
  String get reverseGeocodePartialFailure => t(
    'Coordinates were captured, but address lookup failed. You can complete the address manually.',
    'تم التقاط الإحداثيات، لكن تعذّر العثور على العنوان. يمكنك إكمال العنوان يدويًا.',
  );

  String get sidePanelTitle => t('Why save locations?', 'لماذا تحفظ المواقع؟');
  String get sideFasterAccessTitle => t('Faster access', 'الوصول بسرعة');
  String get sideFasterAccessBody => t(
    'Reuse preferred addresses when booking, picking up, or arranging delivery.',
    'أعد استخدام عناوينك المفضلة عند الحجز أو الاستلام أو ترتيب التوصيل.',
  );
  String get sidePrivacyFirstTitle => t('Privacy first', 'الأمان أولاً');
  String get sidePrivacyFirstBody => t(
    'Exact addresses stay private to your account and are not shown publicly.',
    'تبقى العناوين الدقيقة خاصة بحسابك ولا تُعرض للعامة.',
  );
  String get sideFullControlTitle => t('Full control', 'تحكم كامل');
  String get sideFullControlBody => t(
    'Add, edit, set a default, or delete any saved location anytime.',
    'أضف أو عدّل أو عيّن افتراضيًا أو احذف أي موقع محفوظ في أي وقت.',
  );

  String get loadingLocations =>
      t('Loading saved locations...', 'جارٍ تحميل المواقع المحفوظة...');
  String get loadFailed => t(
    'Could not load saved locations.',
    'تعذّر تحميل المواقع المحفوظة.',
  );

  String locationCardSemantics({
    required String label,
    required String summary,
    required bool isDefault,
  }) {
    final defaultPart = isDefault
        ? t(', default location', '، الموقع الافتراضي')
        : '';
    return t(
      'Saved location $label. $summary$defaultPart',
      'موقع محفوظ $label. $summary$defaultPart',
    );
  }
}
