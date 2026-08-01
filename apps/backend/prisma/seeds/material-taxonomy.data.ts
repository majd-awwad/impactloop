export type MaterialTypeSeed = {
  nameEn: string;
  nameAr?: string;
  defaultUnit: string;
  aliases: Array<{ alias: string; language?: string }>;
  priceRule: {
    unit: string;
    maxAllowedUnitPriceNis?: number;
    maxAllowedTotalPriceNis?: number;
  };
};

export const MATERIAL_CATEGORY_SEEDS = [
  { nameEn: "Electronics", nameAr: "إلكترونيات" },
  { nameEn: "Tools & Equipment", nameAr: "أدوات ومعدات" },
  { nameEn: "Wood & Timber", nameAr: "خشب وأخشاب" },
  { nameEn: "Plastic & Acrylic", nameAr: "بلاستيك وأكريليك" },
  { nameEn: "Metal", nameAr: "معادن" },
  { nameEn: "Fabric & Textile", nameAr: "أقمشة ونسيج" },
  { nameEn: "Art, Craft & Molding", nameAr: "فن وحرف وقوالب" },
  { nameEn: "Lab & Workshop Supplies", nameAr: "مستلزمات مختبر وورشة" },
  { nameEn: "Packaging", nameAr: "تغليف" },
  { nameEn: "Construction Leftovers", nameAr: "مخلفات بناء" },
  {
    nameEn: "Household Reusables",
    nameAr: "أدوات منزلية قابلة لإعادة الاستخدام",
  },
  { nameEn: "Other", nameAr: "أخرى" },
] as const;

export const MATERIAL_TYPE_SEEDS: Record<string, MaterialTypeSeed[]> = {
  Electronics: [
    {
      nameEn: "Arduino Uno",
      nameAr: "Arduino Uno",
      defaultUnit: "piece",
      aliases: [
        { alias: "Arduino", language: "en" },
        { alias: "Arduino Uno R3", language: "en" },
        { alias: "Microcontroller board", language: "en" },
        { alias: "اردوينو", language: "ar" },
        { alias: "لوحة أردوينو", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 70,
        maxAllowedTotalPriceNis: 160,
      },
    },
    {
      nameEn: "Raspberry Pi",
      nameAr: "Raspberry Pi",
      defaultUnit: "piece",
      aliases: [
        { alias: "Raspberry Pi board", language: "en" },
        { alias: "Raspberry Pi", language: "en" },
        { alias: "لوحة راسبيري باي", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 250,
        maxAllowedTotalPriceNis: 550,
      },
    },
    {
      nameEn: "Ultrasonic Sensor",
      nameAr: "حساس الموجات فوق الصوتية",
      defaultUnit: "piece",
      aliases: [
        { alias: "HC-SR04", language: "en" },
        { alias: "Distance sensor", language: "en" },
        { alias: "حساس مسافة", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 15,
        maxAllowedTotalPriceNis: 40,
      },
    },
    {
      nameEn: "Jumper Wires",
      nameAr: "أسلاك توصيل",
      defaultUnit: "pack",
      aliases: [
        { alias: "Dupont wires", language: "en" },
        { alias: "Wire pack", language: "en" },
        { alias: "أسلاك jumper", language: "ar" },
      ],
      priceRule: {
        unit: "pack",
        maxAllowedUnitPriceNis: 12,
        maxAllowedTotalPriceNis: 30,
      },
    },
    {
      nameEn: "Breadboard",
      nameAr: "لوحة تجارب",
      defaultUnit: "piece",
      aliases: [
        { alias: "Prototype board", language: "en" },
        { alias: "لوحة بريدبورد", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 18,
        maxAllowedTotalPriceNis: 45,
      },
    },
    {
      nameEn: "DC Motor",
      nameAr: "محرك DC",
      defaultUnit: "piece",
      aliases: [
        { alias: "Small DC motor", language: "en" },
        { alias: "محرك تيار مستمر", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 20,
        maxAllowedTotalPriceNis: 50,
      },
    },
    {
      nameEn: "Servo Motor",
      nameAr: "سيرفو موتور",
      defaultUnit: "piece",
      aliases: [
        { alias: "SG90 servo", language: "en" },
        { alias: "سيرفو", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 35,
        maxAllowedTotalPriceNis: 80,
      },
    },
    {
      nameEn: "Motor Driver",
      nameAr: "درايفر محرك",
      defaultUnit: "piece",
      aliases: [
        { alias: "L298N", language: "en" },
        { alias: "Motor controller", language: "en" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 35,
        maxAllowedTotalPriceNis: 80,
      },
    },
    {
      nameEn: "LED Strip",
      nameAr: "شريط LED",
      defaultUnit: "meter",
      aliases: [
        { alias: "LED tape", language: "en" },
        { alias: "شريط ليد", language: "ar" },
      ],
      priceRule: {
        unit: "meter",
        maxAllowedUnitPriceNis: 8,
        maxAllowedTotalPriceNis: 80,
      },
    },
    {
      nameEn: "Resistor Pack",
      nameAr: "مجموعة مقاومات",
      defaultUnit: "pack",
      aliases: [
        { alias: "Resistors", language: "en" },
        { alias: "مقاومات", language: "ar" },
      ],
      priceRule: {
        unit: "pack",
        maxAllowedUnitPriceNis: 10,
        maxAllowedTotalPriceNis: 25,
      },
    },
  ],
  "Art, Craft & Molding": [
    {
      nameEn: "Wax Molds",
      nameAr: "قوالب شمع",
      defaultUnit: "piece",
      aliases: [
        { alias: "Wax mold", language: "en" },
        { alias: "Candle mold", language: "en" },
        { alias: "Candle molds", language: "en" },
        { alias: "قوالب شمع", language: "ar" },
        { alias: "قالب شمع", language: "ar" },
        { alias: "قوالب شموع", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 30,
        maxAllowedTotalPriceNis: 90,
      },
    },
    {
      nameEn: "Silicone Molds",
      nameAr: "قوالب سيليكون",
      defaultUnit: "piece",
      aliases: [
        { alias: "Silicone mold", language: "en" },
        { alias: "قالب سيليكون", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 35,
        maxAllowedTotalPriceNis: 110,
      },
    },
    {
      nameEn: "Resin Molds",
      nameAr: "قوالب ريزين",
      defaultUnit: "piece",
      aliases: [
        { alias: "Epoxy mold", language: "en" },
        { alias: "قالب ريزين", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 32,
        maxAllowedTotalPriceNis: 100,
      },
    },
    {
      nameEn: "Paint Supplies",
      nameAr: "مستلزمات طلاء",
      defaultUnit: "set",
      aliases: [
        { alias: "Paint set", language: "en" },
        { alias: "ألوان", language: "ar" },
      ],
      priceRule: {
        unit: "set",
        maxAllowedUnitPriceNis: 25,
        maxAllowedTotalPriceNis: 90,
      },
    },
    {
      nameEn: "Craft Tools",
      nameAr: "أدوات حرف",
      defaultUnit: "set",
      aliases: [
        { alias: "Craft kit", language: "en" },
        { alias: "أدوات فنية", language: "ar" },
      ],
      priceRule: {
        unit: "set",
        maxAllowedUnitPriceNis: 30,
        maxAllowedTotalPriceNis: 100,
      },
    },
  ],
  "Wood & Timber": [
    {
      nameEn: "Wood Board",
      nameAr: "لوح خشب",
      defaultUnit: "piece",
      aliases: [
        { alias: "Timber board", language: "en" },
        { alias: "لوح خشب", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 25,
        maxAllowedTotalPriceNis: 120,
      },
    },
    {
      nameEn: "Wood Scraps",
      nameAr: "بقايا خشب",
      defaultUnit: "kg",
      aliases: [
        { alias: "Scrap wood", language: "en" },
        { alias: "خردة خشب", language: "ar" },
      ],
      priceRule: {
        unit: "kg",
        maxAllowedUnitPriceNis: 5,
        maxAllowedTotalPriceNis: 40,
      },
    },
    {
      nameEn: "Plywood Sheet",
      nameAr: "لوح خشب رقائقي",
      defaultUnit: "piece",
      aliases: [
        { alias: "Plywood", language: "en" },
        { alias: "خشب رقائقي", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 35,
        maxAllowedTotalPriceNis: 140,
      },
    },
  ],
  "Plastic & Acrylic": [
    {
      nameEn: "Acrylic Sheet",
      nameAr: "لوح أكريليك",
      defaultUnit: "piece",
      aliases: [
        { alias: "Plexiglass sheet", language: "en" },
        { alias: "أكريليك", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 30,
        maxAllowedTotalPriceNis: 120,
      },
    },
    {
      nameEn: "Plastic Sheet",
      nameAr: "لوح بلاستيك",
      defaultUnit: "piece",
      aliases: [
        { alias: "Plastic panel", language: "en" },
        { alias: "بلاستيك", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 18,
        maxAllowedTotalPriceNis: 70,
      },
    },
    {
      nameEn: "Plastic Containers",
      nameAr: "حاويات بلاستيك",
      defaultUnit: "piece",
      aliases: [
        { alias: "Storage containers", language: "en" },
        { alias: "علب بلاستيك", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 8,
        maxAllowedTotalPriceNis: 40,
      },
    },
  ],
  "Fabric & Textile": [
    {
      nameEn: "Fabric Scraps",
      nameAr: "بقايا أقمشة",
      defaultUnit: "kg",
      aliases: [
        { alias: "Textile scraps", language: "en" },
        { alias: "قماش", language: "ar" },
      ],
      priceRule: {
        unit: "kg",
        maxAllowedUnitPriceNis: 6,
        maxAllowedTotalPriceNis: 35,
      },
    },
    {
      nameEn: "Yarn",
      nameAr: "خيوط صوف",
      defaultUnit: "pack",
      aliases: [
        { alias: "Wool yarn", language: "en" },
        { alias: "خيوط", language: "ar" },
      ],
      priceRule: {
        unit: "pack",
        maxAllowedUnitPriceNis: 12,
        maxAllowedTotalPriceNis: 40,
      },
    },
    {
      nameEn: "Sewing Supplies",
      nameAr: "مستلزمات خياطة",
      defaultUnit: "set",
      aliases: [
        { alias: "Sewing kit", language: "en" },
        { alias: "خياطة", language: "ar" },
      ],
      priceRule: {
        unit: "set",
        maxAllowedUnitPriceNis: 20,
        maxAllowedTotalPriceNis: 60,
      },
    },
  ],
  "Tools & Equipment": [
    {
      nameEn: "Hand Tool",
      nameAr: "أداة يدوية",
      defaultUnit: "piece",
      aliases: [
        { alias: "Manual tool", language: "en" },
        { alias: "أداة يدوية", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 45,
        maxAllowedTotalPriceNis: 120,
      },
    },
    {
      nameEn: "Small Power Tool",
      nameAr: "أداة كهربائية صغيرة",
      defaultUnit: "piece",
      aliases: [
        { alias: "Power tool", language: "en" },
        { alias: "Drill", language: "en" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 130,
        maxAllowedTotalPriceNis: 320,
      },
    },
    {
      nameEn: "Measuring Tool",
      nameAr: "أداة قياس",
      defaultUnit: "piece",
      aliases: [
        { alias: "Ruler", language: "en" },
        { alias: "Calipers", language: "en" },
        { alias: "أداة قياس", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 35,
        maxAllowedTotalPriceNis: 90,
      },
    },
  ],
  Packaging: [
    {
      nameEn: "Cardboard Boxes",
      nameAr: "صناديق كرتون",
      defaultUnit: "piece",
      aliases: [
        { alias: "Carton boxes", language: "en" },
        { alias: "كرتون", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 5,
        maxAllowedTotalPriceNis: 30,
      },
    },
    {
      nameEn: "Bubble Wrap",
      nameAr: "لفافة فقاعات",
      defaultUnit: "roll",
      aliases: [
        { alias: "Protective wrap", language: "en" },
        { alias: "فقاعات", language: "ar" },
      ],
      priceRule: {
        unit: "roll",
        maxAllowedUnitPriceNis: 12,
        maxAllowedTotalPriceNis: 35,
      },
    },
    {
      nameEn: "Glass Jars",
      nameAr: "برطمانات زجاج",
      defaultUnit: "piece",
      aliases: [
        { alias: "Mason jars", language: "en" },
        { alias: "برطمان", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 6,
        maxAllowedTotalPriceNis: 40,
      },
    },
  ],
  Metal: [
    {
      nameEn: "Metal Sheet",
      nameAr: "لوح معدني",
      defaultUnit: "piece",
      aliases: [
        { alias: "Steel sheet", language: "en" },
        { alias: "صفائح معدنية", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 30,
        maxAllowedTotalPriceNis: 120,
      },
    },
    {
      nameEn: "Metal Rods",
      nameAr: "قضبان معدنية",
      defaultUnit: "piece",
      aliases: [
        { alias: "Metal bars", language: "en" },
        { alias: "قضبان", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 15,
        maxAllowedTotalPriceNis: 60,
      },
    },
  ],
  "Lab & Workshop Supplies": [
    {
      nameEn: "Safety Goggles",
      nameAr: "نظارات واقية",
      defaultUnit: "piece",
      aliases: [
        { alias: "Protective goggles", language: "en" },
        { alias: "نظارات سلامة", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 15,
        maxAllowedTotalPriceNis: 40,
      },
    },
    {
      nameEn: "Lab Glassware",
      nameAr: "أدوات زجاجية للمختبر",
      defaultUnit: "set",
      aliases: [
        { alias: "Beakers", language: "en" },
        { alias: "زجاج مختبر", language: "ar" },
      ],
      priceRule: {
        unit: "set",
        maxAllowedUnitPriceNis: 25,
        maxAllowedTotalPriceNis: 80,
      },
    },
    {
      nameEn: "Workshop Consumables",
      nameAr: "مستهلكات ورشة",
      defaultUnit: "set",
      aliases: [
        { alias: "Workshop supplies", language: "en" },
        { alias: "مستلزمات ورشة", language: "ar" },
      ],
      priceRule: {
        unit: "set",
        maxAllowedUnitPriceNis: 20,
        maxAllowedTotalPriceNis: 70,
      },
    },
  ],
  "Construction Leftovers": [
    {
      nameEn: "Tiles",
      nameAr: "بلاط",
      defaultUnit: "piece",
      aliases: [
        { alias: "Ceramic tiles", language: "en" },
        { alias: "بلاط", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 8,
        maxAllowedTotalPriceNis: 50,
      },
    },
    {
      nameEn: "PVC Pipes",
      nameAr: "أنابيب PVC",
      defaultUnit: "piece",
      aliases: [
        { alias: "Plastic pipes", language: "en" },
        { alias: "مواسير", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 10,
        maxAllowedTotalPriceNis: 45,
      },
    },
  ],
  "Household Reusables": [
    {
      nameEn: "Storage Baskets",
      nameAr: "سلال تخزين",
      defaultUnit: "piece",
      aliases: [
        { alias: "Baskets", language: "en" },
        { alias: "سلة", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 12,
        maxAllowedTotalPriceNis: 40,
      },
    },
    {
      nameEn: "Household Containers",
      nameAr: "حاويات منزلية",
      defaultUnit: "piece",
      aliases: [
        { alias: "Food containers", language: "en" },
        { alias: "علب تخزين", language: "ar" },
      ],
      priceRule: {
        unit: "piece",
        maxAllowedUnitPriceNis: 8,
        maxAllowedTotalPriceNis: 35,
      },
    },
  ],
};
