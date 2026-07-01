import 'package:flutter/material.dart';

import '../domain/models/learning_project.dart';

export '../presentation/theme/learning_project_visuals.dart';
export '../presentation/theme/learning_ui_palette.dart';

const learningCategories = <LocalizedText>[
  LocalizedText(en: 'All', ar: 'الكل'),
  LocalizedText(en: 'Robotics', ar: 'روبوتات'),
  LocalizedText(en: 'Internet of Things', ar: 'إنترنت الأشياء'),
  LocalizedText(en: 'Energy', ar: 'طاقة'),
  LocalizedText(en: 'Handmade', ar: 'حرف يدوية'),
  LocalizedText(en: 'Agriculture', ar: 'زراعة'),
];

const learningStats = <LocalizedText, int>{
  LocalizedText(en: 'Available projects', ar: 'مشروع متاح'): 6,
  LocalizedText(en: 'Registered learners', ar: 'متعلم مسجل'): 951,
  LocalizedText(en: 'Categories', ar: 'فئات'): 6,
};

const learningProjects = <LearningProject>[
  LearningProject(
    id: 'robot-sorter',
    category: LocalizedText(en: 'Robotics', ar: 'روبوتات'),
    title: LocalizedText(
      en: 'Obstacle Avoidance Robot',
      ar: 'روبوت متجنب العوائق',
    ),
    summary: LocalizedText(
      en: 'Build a moving robot with Arduino and reused workshop sensors.',
      ar: 'ابنِ روبوتاً يتحرك ذاتياً باستخدام Arduino وحساسات معاد تدويرها من ورش محلية.',
    ),
    difficulty: LocalizedText(en: 'Medium', ar: 'متوسط'),
    duration: LocalizedText(en: '3-4 hours', ar: '3-4 ساعات'),
    ratingLabel: LocalizedText(en: 'learners', ar: 'متعلم'),
    ratingValue: 4.8,
    ratingCount: 156,
    componentCountLabel: LocalizedText(en: '5 components', ar: '5 مكونات'),
    components: [
      LocalizedText(en: 'Arduino board', ar: 'لوحة أردوينو'),
      LocalizedText(en: 'Ultrasonic sensor', ar: 'حساس فوق صوتي'),
      LocalizedText(en: 'DC motors', ar: 'محركات DC'),
      LocalizedText(en: 'Reused wheels', ar: 'عجلات معاد استخدامها'),
      LocalizedText(en: 'Battery holder', ar: 'حامل بطارية'),
    ],
    steps: [
      ProjectStep(
        title: LocalizedText(
          en: 'Prepare the robot base and mount the reused wheels.',
          ar: 'جهز قاعدة الروبوت وثبت العجلات المعاد استخدامها.',
        ),
      ),
      ProjectStep(
        title: LocalizedText(
          en: 'Connect the motors and ultrasonic sensor to the board.',
          ar: 'صل المحركات والحساس فوق الصوتي باللوحة.',
        ),
      ),
      ProjectStep(
        title: LocalizedText(
          en: 'Upload the avoidance logic and test obstacle detection.',
          ar: 'ارفع منطق تفادي العوائق واختبر اكتشاف الأجسام.',
        ),
      ),
    ],
    links: [
      ProjectLinkItem(
        label: LocalizedText(
          en: 'Arduino wiring notes',
          ar: 'ملاحظات توصيل أردوينو',
        ),
        urlLabel: LocalizedText(en: 'Reference guide', ar: 'دليل مرجعي'),
      ),
      ProjectLinkItem(
        label: LocalizedText(
          en: 'Sensor testing checklist',
          ar: 'قائمة فحص الحساس',
        ),
        urlLabel: LocalizedText(en: 'Workshop sheet', ar: 'ورقة ورشة'),
      ),
    ],
    imageUrl:
        'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80',
    heroIconData: Icons.smart_toy_outlined,
    cardGradient: [0xFF1F2937, 0xFF243B53],
    isFeatured: true,
    hasRatings: true,
  ),
  LearningProject(
    id: 'copper-phone-stand',
    category: LocalizedText(en: 'Handmade', ar: 'حرف يدوية'),
    title: LocalizedText(
      en: 'Copper Pipe Phone Holder',
      ar: 'حامل هاتف من أنابيب نحاسية',
    ),
    summary: LocalizedText(
      en: 'Turn plumbing leftovers into a clean industrial desk stand.',
      ar: 'حوّل بقايا السباكة إلى حامل مكتبي بطابع صناعي بسيط.',
    ),
    difficulty: LocalizedText(en: 'Easy', ar: 'سهل'),
    duration: LocalizedText(en: '1-2 hours', ar: '1-2 ساعة'),
    ratingLabel: LocalizedText(en: 'learners', ar: 'متعلم'),
    ratingValue: 5.0,
    ratingCount: 41,
    componentCountLabel: LocalizedText(en: '4 components', ar: '4 مكونات'),
    components: [
      LocalizedText(en: 'Copper pipe scraps', ar: 'قصاصات أنابيب نحاسية'),
      LocalizedText(en: 'Angle joints', ar: 'وصلات زاوية'),
      LocalizedText(en: 'Metal glue', ar: 'لاصق معدني'),
      LocalizedText(en: 'Rubber feet', ar: 'أقدام مطاطية'),
    ],
    steps: [
      ProjectStep(
        title: LocalizedText(
          en: 'Cut the pipe segments to the required lengths.',
          ar: 'اقطع الأنابيب إلى الأطوال المطلوبة.',
        ),
      ),
      ProjectStep(
        title: LocalizedText(
          en: 'Dry-fit the joints before gluing the frame.',
          ar: 'ركب الوصلات مبدئياً قبل لصق الهيكل.',
        ),
      ),
      ProjectStep(
        title: LocalizedText(
          en: 'Add rubber feet and test phone balance.',
          ar: 'أضف الأقدام المطاطية واختبر توازن الهاتف.',
        ),
      ),
    ],
    links: [
      ProjectLinkItem(
        label: LocalizedText(
          en: 'Pipe sizing basics',
          ar: 'أساسيات قياس الأنابيب',
        ),
        urlLabel: LocalizedText(en: 'Sizing sheet', ar: 'ورقة القياس'),
      ),
    ],
    imageUrl:
        'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80',
    heroIconData: Icons.handyman_outlined,
    cardGradient: [0xFF8A6B17, 0xFF667C4F],
    isFeatured: false,
    hasRatings: true,
  ),
  LearningProject(
    id: 'weather-station',
    category: LocalizedText(en: 'Internet of Things', ar: 'إنترنت الأشياء'),
    title: LocalizedText(en: 'Smart Weather Station', ar: 'محطة طقس ذكية'),
    summary: LocalizedText(
      en: 'Track heat and humidity, then send readings over Wi‑Fi.',
      ar: 'قِس الحرارة والرطوبة ثم أرسل القراءات عبر Wi‑Fi.',
    ),
    difficulty: LocalizedText(en: 'Advanced', ar: 'متقدم'),
    duration: LocalizedText(en: '4-5 hours', ar: '4-5 ساعات'),
    ratingLabel: LocalizedText(en: 'learners', ar: 'متعلم'),
    ratingValue: 4.7,
    ratingCount: 82,
    componentCountLabel: LocalizedText(en: '5 components', ar: '5 مكونات'),
    components: [
      LocalizedText(en: 'ESP8266', ar: 'ESP8266'),
      LocalizedText(en: 'Temperature sensor', ar: 'حساس حرارة'),
      LocalizedText(en: 'Humidity sensor', ar: 'حساس رطوبة'),
      LocalizedText(en: 'Small case', ar: 'علبة صغيرة'),
      LocalizedText(en: 'Reused cables', ar: 'أسلاك معاد استخدامها'),
    ],
    steps: [
      ProjectStep(
        title: LocalizedText(
          en: 'Mount sensors inside the reused plastic enclosure.',
          ar: 'ثبت الحساسات داخل العلبة البلاستيكية المعاد استخدامها.',
        ),
      ),
      ProjectStep(
        title: LocalizedText(
          en: 'Connect the Wi‑Fi module and verify live readings.',
          ar: 'صل وحدة Wi‑Fi وتحقق من القراءات الحية.',
        ),
      ),
      ProjectStep(
        title: LocalizedText(
          en: 'Calibrate the displayed values and compare with room conditions.',
          ar: 'عاير القيم المعروضة وقارنها بظروف الغرفة.',
        ),
      ),
    ],
    links: [
      ProjectLinkItem(
        label: LocalizedText(en: 'ESP8266 pin map', ar: 'خريطة أرجل ESP8266'),
        urlLabel: LocalizedText(en: 'Pinout sheet', ar: 'مخطط الأرجل'),
      ),
    ],
    imageUrl:
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    heroIconData: Icons.sensors_outlined,
    cardGradient: [0xFF1F456B, 0xFF162538],
    isFeatured: false,
    hasRatings: true,
  ),
  LearningProject(
    id: 'reclaimed-led-lamp',
    category: LocalizedText(en: 'Handmade', ar: 'حرف يدوية'),
    title: LocalizedText(
      en: 'Reclaimed Wood LED Lamp',
      ar: 'مصباح LED من خشب معاد تدويره',
    ),
    summary: LocalizedText(
      en: 'Combine reused wood and LED strips into a decorative desk lamp.',
      ar: 'ادمج الخشب المعاد تدويره مع شرائط LED لصناعة مصباح مكتبي ديكوري.',
    ),
    difficulty: LocalizedText(en: 'Easy', ar: 'سهل'),
    duration: LocalizedText(en: '2-3 hours', ar: '2-3 ساعات'),
    ratingLabel: LocalizedText(en: 'learners', ar: 'متعلم'),
    ratingValue: 4.9,
    ratingCount: 134,
    componentCountLabel: LocalizedText(en: '5 components', ar: '5 مكونات'),
    components: [
      LocalizedText(en: 'Scrap wood', ar: 'خشب متبقي'),
      LocalizedText(en: 'LED strip', ar: 'شريط LED'),
      LocalizedText(en: 'Power adapter', ar: 'محول طاقة'),
      LocalizedText(en: 'Diffuser sheet', ar: 'لوح ناشر للضوء'),
      LocalizedText(en: 'Wire clips', ar: 'مشابك أسلاك'),
    ],
    steps: [
      ProjectStep(
        title: LocalizedText(
          en: 'Sand the reclaimed wood and mark the lamp slot.',
          ar: 'صنفر الخشب المعاد تدويره وحدد مكان المصباح.',
        ),
      ),
      ProjectStep(
        title: LocalizedText(
          en: 'Install the LED strip and diffuser carefully.',
          ar: 'ثبت شريط LED والناشر الضوئي بعناية.',
        ),
      ),
      ProjectStep(
        title: LocalizedText(
          en: 'Route the cable neatly and test warm lighting.',
          ar: 'مرر السلك بشكل منظم واختبر الإضاءة الدافئة.',
        ),
      ),
    ],
    links: [
      ProjectLinkItem(
        label: LocalizedText(en: 'LED safety basics', ar: 'أساسيات أمان LED'),
        urlLabel: LocalizedText(en: 'Safety note', ar: 'ملاحظة أمان'),
      ),
    ],
    imageUrl:
        'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=1200&q=80',
    heroIconData: Icons.lightbulb_outline,
    cardGradient: [0xFF6B8C5B, 0xFF6E9362],
    isFeatured: false,
    hasRatings: true,
  ),
  LearningProject(
    id: 'wireless-charger',
    category: LocalizedText(en: 'Energy', ar: 'طاقة'),
    title: LocalizedText(
      en: 'Wireless Charger from Old Coils',
      ar: 'شاحن لاسلكي من بوينات قديمة',
    ),
    summary: LocalizedText(
      en: 'Reuse old copper coils to build a simple inductive charger demo.',
      ar: 'أعد استخدام البوينات النحاسية القديمة لصناعة نموذج شاحن حثّي بسيط.',
    ),
    difficulty: LocalizedText(en: 'Advanced', ar: 'متقدم'),
    duration: LocalizedText(en: '5-6 hours', ar: '5-6 ساعات'),
    ratingLabel: LocalizedText(en: 'learners', ar: 'متعلم'),
    ratingValue: 4.5,
    ratingCount: 67,
    componentCountLabel: LocalizedText(en: '5 components', ar: '5 مكونات'),
    components: [
      LocalizedText(en: 'Old copper coils', ar: 'بوينات نحاسية قديمة'),
      LocalizedText(en: 'IC WS6850', ar: 'IC WS6850'),
      LocalizedText(en: '10nF capacitors', ar: 'مكثفات 10nF'),
      LocalizedText(en: 'PCB board', ar: 'لوحة PCB'),
      LocalizedText(en: '5V 1A power source', ar: 'مصدر 5V 1A'),
    ],
    steps: [
      ProjectStep(
        title: LocalizedText(
          en: 'Wind and align the copper coils for stable transfer.',
          ar: 'لف البوينات النحاسية القديمة وحدد محاذاتها للاستقبال المستقر.',
        ),
      ),
      ProjectStep(
        title: LocalizedText(
          en: 'Connect the WS6850 circuit with the capacitors.',
          ar: 'وصّل دائرة WS6850 مع المكثفات.',
        ),
      ),
      ProjectStep(
        title: LocalizedText(
          en: 'Test resonance and tune the transfer distance.',
          ar: 'اختبر الرنين واضبط مسافة نقل الطاقة.',
        ),
      ),
      ProjectStep(
        title: LocalizedText(
          en: 'Build a receiver board that matches your phone.',
          ar: 'ابنِ لوحة استقبال للهاتف المتوافق.',
        ),
      ),
      ProjectStep(
        title: LocalizedText(
          en: 'Measure efficiency and output power safely.',
          ar: 'اختبر الكفاءة وقِس الطاقة المنقولة بأمان.',
        ),
      ),
    ],
    links: [
      ProjectLinkItem(
        label: LocalizedText(
          en: 'Induction charging primer',
          ar: 'مقدمة في الشحن الحثي',
        ),
        urlLabel: LocalizedText(en: 'Concept note', ar: 'مذكرة مفاهيم'),
      ),
      ProjectLinkItem(
        label: LocalizedText(en: 'PCB routing hints', ar: 'إرشادات تخطيط PCB'),
        urlLabel: LocalizedText(en: 'Routing guide', ar: 'دليل التوصيل'),
      ),
    ],
    imageUrl:
        'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    heroIconData: Icons.bolt_rounded,
    cardGradient: [0xFF4C1D95, 0xFF24243E],
    isFeatured: false,
    hasRatings: true,
  ),
  LearningProject(
    id: 'smart-irrigation',
    category: LocalizedText(en: 'Agriculture', ar: 'زراعة'),
    title: LocalizedText(
      en: 'Automatic Solar Irrigation',
      ar: 'نظام ري أوتوماتيكي شمسي',
    ),
    summary: LocalizedText(
      en: 'Use a soil sensor and a small pump powered by a solar panel.',
      ar: 'استخدم حساس تربة ومضخة صغيرة تعمل بالطاقة الشمسية لري النبات تلقائياً.',
    ),
    difficulty: LocalizedText(en: 'Medium', ar: 'متوسط'),
    duration: LocalizedText(en: '3-4 hours', ar: '4-3 ساعات'),
    ratingLabel: LocalizedText(en: 'learners', ar: 'متعلم'),
    ratingValue: 4.6,
    ratingCount: 73,
    componentCountLabel: LocalizedText(en: '5 components', ar: '5 مكونات'),
    components: [
      LocalizedText(en: 'Soil moisture sensor', ar: 'حساس رطوبة التربة'),
      LocalizedText(en: 'Mini water pump', ar: 'مضخة ماء صغيرة'),
      LocalizedText(en: 'Solar panel', ar: 'لوح شمسي'),
      LocalizedText(en: 'Relay module', ar: 'وحدة ريليه'),
      LocalizedText(en: 'Water container', ar: 'وعاء ماء'),
    ],
    steps: [
      ProjectStep(
        title: LocalizedText(
          en: 'Place the sensor at root level and wire the pump.',
          ar: 'ضع الحساس عند مستوى الجذور ووصل المضخة.',
        ),
      ),
      ProjectStep(
        title: LocalizedText(
          en: 'Connect the relay to the solar-powered control board.',
          ar: 'صل الريليه بلوحة التحكم العاملة بالطاقة الشمسية.',
        ),
      ),
      ProjectStep(
        title: LocalizedText(
          en: 'Define the moisture threshold and test plant watering.',
          ar: 'حدد حد الرطوبة واختبر سقي النبات.',
        ),
      ),
    ],
    links: [
      ProjectLinkItem(
        label: LocalizedText(
          en: 'Pump sizing basics',
          ar: 'أساسيات اختيار المضخة',
        ),
        urlLabel: LocalizedText(en: 'Sizing note', ar: 'مذكرة الاختيار'),
      ),
    ],
    imageUrl:
        'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80',
    heroIconData: Icons.agriculture_outlined,
    cardGradient: [0xFF3D7C4B, 0xFF527B53],
    isFeatured: false,
    hasRatings: true,
  ),
];

const learningFeaturedTip = LocalizedText(
  en: 'Each project lists the needed components so you can collect them from nearby workshops and makerspaces.',
  ar: 'كل مشروع يوضح المكونات المطلوبة، لتتمكن لاحقاً من جمعها من الورش والمصانع القريبة منك.',
);

const learningAddDraftIntro = LocalizedText(
  en: 'Share your idea as a draft for review. This screen is a UI mock only and does not submit data yet.',
  ar: 'شارك فكرتك كمسودة للمراجعة. هذه الشاشة مجرد واجهة تجريبية ولا ترسل أي بيانات بعد.',
);

const learningDisabledAiTitle = LocalizedText(
  en: 'Find Materials with AI',
  ar: 'ابحث عن المواد بالذكاء الاصطناعي',
);

const learningDisabledAiSubtitle = LocalizedText(
  en: 'Coming soon. This feature will later help match required components with available materials.',
  ar: 'قريباً. ستساعد هذه الميزة لاحقاً في مطابقة المكونات المطلوبة مع المواد المتاحة.',
);

LearningProject? learningProjectById(String id) {
  for (final project in learningProjects) {
    if (project.id == id) {
      return project;
    }
  }

  return null;
}

List<RatingBreakdown> mockBreakdownFor(LearningProject project) {
  final total = project.ratingCount;
  final high = (total * 0.64).round();
  final mid = (total * 0.24).round();
  final low = (total * 0.12).round();

  return [
    RatingBreakdown(stars: 5, count: high),
    RatingBreakdown(stars: 4, count: mid),
    RatingBreakdown(stars: 3, count: low),
  ];
}
