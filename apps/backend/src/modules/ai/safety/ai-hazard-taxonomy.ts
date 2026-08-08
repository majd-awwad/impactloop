export const PHYSICAL_HAZARD_CATEGORIES = [
  'ELECTRICAL_MAINS',
  'BATTERY',
  'HEAT_BURN',
  'SHARP_CUT',
  'ADHESIVE_CHEMICAL',
  'SOLVENT_VOC',
  'TOOL_MISUSE',
] as const;

export type PhysicalHazardCategory = (typeof PHYSICAL_HAZARD_CATEGORIES)[number];

export type PhysicalHazardSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type PhysicalHazardDefinition = {
  category: PhysicalHazardCategory;
  severity: PhysicalHazardSeverity;
  /** When true, actionable misuse patterns may hard-block before the LLM. */
  blockWhenActionable: boolean;
  topicRuleIds: readonly string[];
  precautions: {
    en: string;
    ar: string;
  };
};

export const PHYSICAL_HAZARD_DEFINITIONS: Record<
  PhysicalHazardCategory,
  PhysicalHazardDefinition
> = {
  ELECTRICAL_MAINS: {
    category: 'ELECTRICAL_MAINS',
    severity: 'HIGH',
    blockWhenActionable: true,
    topicRuleIds: [
      'household_electricity',
      'mains_voltage',
      'wires_to_mains',
      'direct_mains_load',
    ],
    precautions: {
      en: 'Use a low-voltage supply or an appropriate driver matched to component ratings; never wire hobby circuits directly to household mains.',
      ar: 'استخدم مصدر تغذية منخفض الجهد أو درايفر مناسب لتصنيف المكوّن؛ لا توصل دوائر الهواية مباشرة بكهرباء المنزل.',
    },
  },
  BATTERY: {
    category: 'BATTERY',
    severity: 'HIGH',
    blockWhenActionable: true,
    topicRuleIds: ['battery_topic', 'lithium_topic', 'power_source_topic'],
    precautions: {
      en: 'Match polarity, use the correct cell type and charger, avoid short circuits, and replace damaged or swollen cells.',
      ar: 'طابق القطبية، استخدم نوع البطارية والشاحن المناسب، تجنب القصر، واستبدل الخلايا التالفة أو المتورمة.',
    },
  },
  HEAT_BURN: {
    category: 'HEAT_BURN',
    severity: 'MEDIUM',
    blockWhenActionable: false,
    topicRuleIds: ['heat_tools_topic', 'flame_topic'],
    precautions: {
      en: 'Work on a heat-resistant surface, keep hot tools away from skin and flammables, and unplug or cool tools before handling.',
      ar: 'اعمل على سطح يتحمل الحرارة، ابعد الأدوات الساخنة عن الجلد والمواد القابلة للاشتعال، وافصل أو برّد الأداة قبل التعامل معها.',
    },
  },
  SHARP_CUT: {
    category: 'SHARP_CUT',
    severity: 'MEDIUM',
    blockWhenActionable: false,
    topicRuleIds: ['sharp_tools_topic', 'cutting_topic'],
    precautions: {
      en: 'Cut away from your body, keep fingers clear of blades, clamp work when possible, and store sharp tools safely.',
      ar: 'اقطع بعيدًا عن جسدك، ابعد أصابعك عن الشفرات، ثبّت القطعة عند الإمكان، وخزّن الأدوات الحادة بأمان.',
    },
  },
  ADHESIVE_CHEMICAL: {
    category: 'ADHESIVE_CHEMICAL',
    severity: 'LOW',
    blockWhenActionable: false,
    topicRuleIds: ['adhesive_topic'],
    precautions: {
      en: 'Use adhesives in a ventilated area, avoid skin contact, and keep caps closed when not in use.',
      ar: 'استخدم اللاصقات في مكان مهوى، تجنب ملامسة الجلد، وأغلق العبوة عند عدم الاستخدام.',
    },
  },
  SOLVENT_VOC: {
    category: 'SOLVENT_VOC',
    severity: 'MEDIUM',
    blockWhenActionable: false,
    topicRuleIds: ['solvent_topic'],
    precautions: {
      en: 'Ventilate the workspace, avoid sparks near flammable solvents, and follow label directions for disposal.',
      ar: 'هوّي مساحة العمل، تجنب النار أو الشرر قرب المذيبات القابلة للاشتعال، واتبع تعليمات التخلص على الملصق.',
    },
  },
  TOOL_MISUSE: {
    category: 'TOOL_MISUSE',
    severity: 'HIGH',
    blockWhenActionable: true,
    topicRuleIds: ['power_tools_topic', 'tool_safety_bypass'],
    precautions: {
      en: 'Keep guards and safety interlocks installed, wear eye protection, and never modify a tool to bypass its safety features.',
      ar: 'أبقِ الحمايات وقفلات الأمان مثبتة، استخدم حماية العين، ولا تعدّل الأداة لتجاوز ميزات السلامة.',
    },
  },
};

export type PhysicalHazardMatch = {
  category: PhysicalHazardCategory;
  severity: PhysicalHazardSeverity;
  matchedRule: string;
};

export type PhysicalHazardAssessment = {
  hazards: PhysicalHazardMatch[];
  categories: PhysicalHazardCategory[];
  requiredPrecautions: {
    en: string[];
    ar: string[];
  };
  shouldBlock: boolean;
  blockReasons: string[];
};
