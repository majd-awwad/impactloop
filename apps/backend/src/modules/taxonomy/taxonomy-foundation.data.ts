import type { TaxonomyConceptType } from '../../generated/prisma/client.js';

export type TaxonomyMappingProvenance =
  | 'AUTHORITATIVE'
  | 'REVIEWED'
  | 'DERIVED_EXACT'
  | 'UNMAPPED';

export type TaxonomyAliasSeed = {
  alias: string;
  language: 'EN' | 'AR';
  aliasType: 'EXPLICIT' | 'LEGACY' | 'ABBREVIATION' | 'TRANSLATION';
  source: string;
};

export type TaxonomyMappingRule = {
  provenance: Exclude<TaxonomyMappingProvenance, 'UNMAPPED'>;
  source: string;
  learnerInterestKeys?: readonly string[];
  materialCategoryNames?: readonly string[];
  materialTypeNames?: readonly string[];
  materialTagValues?: readonly string[];
  projectCategoryNames?: readonly string[];
  projectTagValues?: readonly string[];
  componentNameValues?: readonly string[];
  componentTypeValues?: readonly string[];
};

export type TaxonomyConceptSeed = {
  canonicalKey: string;
  conceptType: TaxonomyConceptType;
  labelEn: string;
  labelAr: string;
  aliases: readonly TaxonomyAliasSeed[];
  mappingRules: readonly TaxonomyMappingRule[];
};

const prefixForType: Record<TaxonomyConceptType, string> = {
  INTEREST: 'interest',
  MATERIAL_FAMILY: 'material-family',
  MATERIAL_FORM: 'material-form',
  PROJECT_TOPIC: 'project-topic',
  COMPONENT: 'component',
};

const alias = (
  value: string,
  language: 'EN' | 'AR',
  aliasType: TaxonomyAliasSeed['aliasType'] = 'EXPLICIT',
): TaxonomyAliasSeed => ({
  alias: value,
  language,
  aliasType,
  source: 'phase-2b-reviewed-vocabulary',
});

const concept = (
  conceptType: TaxonomyConceptType,
  key: string,
  labelEn: string,
  labelAr: string,
  aliases: readonly TaxonomyAliasSeed[],
  mappingRules: readonly TaxonomyMappingRule[],
): TaxonomyConceptSeed => ({
  canonicalKey: `${prefixForType[conceptType]}:${key.replace(/_/gu, '-')}`,
  conceptType,
  labelEn,
  labelAr,
  aliases,
  mappingRules,
});

const interest = (
  key: string,
  labelEn: string,
  labelAr: string,
  aliases: readonly TaxonomyAliasSeed[] = [],
) =>
  concept('INTEREST', key, labelEn, labelAr, aliases, [
    {
      provenance: 'AUTHORITATIVE',
      source: 'learner-interest-registry.key',
      learnerInterestKeys: [key],
    },
  ]);

const family = (
  key: string,
  labelEn: string,
  labelAr: string,
  materialCategoryNames: readonly string[],
  aliases: readonly TaxonomyAliasSeed[] = [],
) =>
  concept('MATERIAL_FAMILY', key, labelEn, labelAr, aliases, [
    {
      provenance: 'AUTHORITATIVE',
      source: 'frozen-seed.material-category.nameEn',
      materialCategoryNames,
    },
  ]);

const form = (
  key: string,
  labelEn: string,
  labelAr: string,
  materialTypeNames: readonly string[],
  aliases: readonly TaxonomyAliasSeed[] = [],
) =>
  concept('MATERIAL_FORM', key, labelEn, labelAr, aliases, [
    {
      provenance: 'REVIEWED',
      source: 'frozen-seed.material.materialType',
      materialTypeNames,
    },
  ]);

const topic = (
  key: string,
  labelEn: string,
  labelAr: string,
  projectCategoryNames: readonly string[],
  aliases: readonly TaxonomyAliasSeed[] = [],
) =>
  concept('PROJECT_TOPIC', key, labelEn, labelAr, aliases, [
    {
      provenance: 'AUTHORITATIVE',
      source: 'frozen-seed.project-category.nameEn',
      projectCategoryNames,
    },
  ]);

const component = (
  key: string,
  labelEn: string,
  labelAr: string,
  componentNameValues: readonly string[],
  componentTypeValues: readonly string[],
  aliases: readonly TaxonomyAliasSeed[] = [],
) =>
  concept('COMPONENT', key, labelEn, labelAr, aliases, [
    {
      provenance: 'REVIEWED',
      source: 'frozen-seed.project-required-component.name-and-materialType',
      componentNameValues,
      componentTypeValues,
    },
  ]);

export const TAXONOMY_CONCEPT_SEEDS: readonly TaxonomyConceptSeed[] = [
  interest('electronics', 'Electronics', 'إلكترونيات'),
  interest('arduino', 'Arduino', 'أردوينو', [alias('Arduino board', 'EN')]),
  interest('robotics', 'Robotics', 'الروبوتات', [alias('robot', 'EN'), alias('robots', 'EN')]),
  interest('sensors', 'Sensors', 'أجهزة الاستشعار', [alias('sensor modules', 'EN')]),
  interest('circuits', 'Circuits', 'الدوائر الإلكترونية', [alias('circuit building', 'EN')]),
  interest('displays', 'Displays', 'الشاشات', [alias('LCD display', 'EN'), alias('display module', 'EN')]),
  interest('wires_connectors', 'Wires & Connectors', 'أسلاك وموصلات', [alias('wires and connectors', 'EN'), alias('cables', 'EN')]),
  interest('audio_media', 'Audio & Media', 'الصوت والوسائط', [alias('audio and media', 'EN')]),
  interest('woodworking', 'Woodworking', 'أعمال خشبية', [alias('wood working', 'EN')]),
  interest('fabric_textiles', 'Fabric & Textiles', 'أقمشة ومنسوجات', [alias('fabric and textiles', 'EN')]),
  interest('art_crafts', 'Art & Crafts', 'فنون وحرف', [alias('art and crafts', 'EN')]),
  interest('recycling', 'Recycling', 'إعادة التدوير', [alias('upcycling', 'EN')]),
  interest('home_diy', 'Home DIY', 'أعمال منزلية يدوية', [alias('home_diy', 'EN'), alias('home improvement', 'EN')]),

  family('electronics', 'Electronics', 'إلكترونيات', ['Electronics & Components'], [alias('electronic components', 'EN')]),
  family('mechanical', 'Mechanical Parts', 'قطع ميكانيكية', ['Motors & Mechanical Parts']),
  family('power', 'Power & Batteries', 'طاقة وبطاريات', ['Power & Batteries']),
  family('wood', 'Wood', 'خشب', ['Wood & Boards'], [alias('timber', 'EN')]),
  family('plastic', 'Plastic & Acrylic', 'بلاستيك وأكريليك', ['Plastics & Acrylic']),
  family('metal', 'Metal & Fasteners', 'معادن ومثبتات', ['Metal & Fasteners']),
  family('fabric', 'Fabric & Textiles', 'أقمشة ومنسوجات', ['Fabric & Textiles']),
  family('paper', 'Paper & Cardboard', 'ورق وكرتون', ['Paper & Cardboard']),
  family('tools', 'Tools & Hardware', 'أدوات وعدد', ['Tools & Hardware']),
  family('craft', 'Art & Craft Supplies', 'مستلزمات فن وحرف', ['Art & Craft Supplies']),
  family('packaging', 'Packaging & Containers', 'تغليف وحاويات', ['Packaging & Containers']),
  family('lab', 'Lab & Education Supplies', 'مستلزمات مختبر وتعليم', ['Lab & Education Supplies']),
  family('reusable', 'Other Reusable Materials', 'مواد أخرى قابلة لإعادة الاستخدام', ['Other Reusable Materials']),

  form('arduino-uno', 'Arduino Uno', 'أردوينو أونو', ['Arduino Uno'], [alias('Arduino Uno R3', 'EN', 'LEGACY'), alias('لوحة أردوينو أونو', 'AR', 'TRANSLATION')]),
  form('ultrasonic-sensor', 'Ultrasonic Sensor', 'حساس الموجات فوق الصوتية', ['Ultrasonic Sensor'], [alias('HC-SR04', 'EN', 'ABBREVIATION'), alias('distance sensor', 'EN')]),
  form('breadboard', 'Breadboard', 'لوحة تجارب', ['Breadboard'], [alias('prototype board', 'EN')]),
  form('jumper-wires', 'Jumper Wires', 'أسلاك توصيل', ['Jumper Wires'], [alias('Dupont wires', 'EN', 'ABBREVIATION')]),
  form('dc-motor', 'DC Motor', 'محرك تيار مستمر', ['DC Motor'], [alias('DC motors', 'EN'), alias('محرك DC', 'AR')]),
  form('servo-motor', 'Servo Motor', 'محرك سيرفو', ['Servo Motor'], [alias('SG90 servo', 'EN', 'ABBREVIATION')]),
  form('motor-driver', 'Motor Driver', 'درايفر محرك', ['Motor Driver'], [alias('L298N', 'EN', 'ABBREVIATION')]),
  form('led-pack', 'LED Pack', 'حزمة مصابيح LED', ['LED Pack'], [alias('LEDs', 'EN')]),
  form('resistor-pack', 'Resistor Pack', 'حزمة مقاومات', ['Resistor Pack'], [alias('resistors', 'EN')]),
  form('battery-holder', 'Battery Holder', 'حامل بطارية', ['Battery Holder'], [alias('battery clip', 'EN')]),
  form('acrylic-sheet', 'Acrylic Sheet', 'لوح أكريليك', ['Acrylic Sheet'], [alias('plexiglass', 'EN')]),
  form('pvc-pipes', 'PVC Pipes', 'أنابيب PVC', ['PVC Pipes'], [alias('PVC tube', 'EN')]),
  form('rubber-wheels', 'Rubber Wheels', 'عجلات مطاطية', ['Rubber Wheels'], [alias('robot wheels', 'EN')]),
  form('plywood-sheet', 'Plywood Sheet', 'لوح خشب رقائقي', ['Plywood Sheet'], [alias('plywood panel', 'EN')]),
  form('mdf-offcuts', 'MDF Offcuts', 'بقايا MDF', ['MDF Offcuts'], [alias('MDF scraps', 'EN')]),
  form('cardboard-sheets', 'Cardboard Sheets', 'ألواح كرتون', ['Cardboard Sheets'], [alias('carton sheets', 'EN')]),
  form('fabric-scraps', 'Fabric Scraps', 'بقايا أقمشة', ['Fabric Scraps'], [alias('textile scraps', 'EN')]),
  form('denim-offcuts', 'Denim Offcuts', 'بقايا جينز', ['Denim Offcuts'], [alias('denim scraps', 'EN')]),
  form('small-hinges', 'Small Hinges', 'مفصلات صغيرة', ['Small Hinges'], [alias('door hinge', 'EN')]),
  form('screws-and-nuts', 'Screws and Nuts', 'براغي وصواميل', ['Screws and Nuts'], [alias('fasteners', 'EN')]),
  form('wooden-dowels', 'Wooden Dowels', 'أوتاد خشبية', ['Wooden Dowels'], [alias('wooden dowel', 'EN')]),
  form('wood-glue', 'Wood Glue', 'غراء خشب', ['Wood Glue']),

  topic('robotics', 'Robotics', 'الروبوتات', ['Robotics']),
  topic('electronics', 'Electronics', 'إلكترونيات', ['Electronics']),
  topic('recycling-crafts', 'Recycling Crafts', 'حرف إعادة التدوير', ['Recycling Crafts']),
  topic('woodworking', 'Woodworking', 'أعمال خشبية', ['Woodworking']),
  topic('home-experiments', 'Home Experiments', 'تجارب منزلية', ['Home Experiments']),
  topic('textile-crafts', 'Textile Crafts', 'حرف نسيجية', ['Textile Crafts']),

  component('arduino-board', 'Arduino Board', 'لوحة أردوينو', ['Arduino board'], ['Arduino Uno'], [alias('Arduino', 'EN', 'ABBREVIATION')]),
  component('ultrasonic-distance-sensor', 'Ultrasonic Distance Sensor', 'حساس مسافة بالموجات فوق الصوتية', ['Ultrasonic distance sensor'], ['Ultrasonic Sensor'], [alias('HC-SR04', 'EN', 'ABBREVIATION')]),
  component('dc-gear-motors', 'DC Gear Motors', 'محركات تيار مستمر مسننة', ['DC gear motors'], ['DC Motor'], [alias('DC gear motor', 'EN')]),
  component('jumper-wires', 'Jumper Wires', 'أسلاك توصيل', ['Jumper wires'], ['Jumper Wires'], [alias('Dupont wires', 'EN')]),
  component('rubber-wheels', 'Rubber Wheels', 'عجلات مطاطية', ['Rubber wheels'], ['Rubber Wheels']),
  component('breadboard', 'Breadboard', 'لوحة تجارب', ['Breadboard'], ['Breadboard']),
  component('led', 'LED', 'مصباح LED', ['LED'], ['LED Pack']),
  component('resistor', 'Resistor', 'مقاومة كهربائية', ['Resistor'], ['Resistor Pack']),
  component('battery-holder', 'Battery Holder', 'حامل بطارية', ['Battery holder'], ['Battery Holder']),
  component('acrylic-sheets', 'Clear Acrylic Sheets', 'ألواح أكريليك شفافة', ['Clear acrylic sheets'], ['Acrylic Sheet']),
  component('pvc-pipes', 'PVC Pipes', 'أنابيب PVC', ['PVC pipes', 'PVC pipe pieces'], ['PVC Pipes']),
  component('small-hinges', 'Small Hinges', 'مفصلات صغيرة', ['Small hinges'], ['Small Hinges']),
  component('screws-and-nuts', 'Screws and Nuts', 'براغي وصواميل', ['Screws and nuts'], ['Screws and Nuts']),
  component('plywood-panel', 'Plywood Panel', 'لوح خشب رقائقي', ['Plywood panel'], ['Plywood Sheet']),
  component('mdf-offcut', 'MDF Offcut', 'قطعة MDF متبقية', ['MDF offcut'], ['MDF Offcuts']),
  component('cardboard-sheets', 'Cardboard Sheets', 'ألواح كرتون', ['Cardboard sheets', 'Cardboard sheet'], ['Cardboard Sheets']),
  component('fabric-scraps', 'Fabric Scraps', 'بقايا أقمشة', ['Fabric scraps'], ['Fabric Scraps']),
  component('denim-offcuts', 'Denim Offcuts', 'بقايا جينز', ['Denim offcuts'], ['Denim Offcuts']),
  component('wooden-dowel', 'Wooden Dowel', 'وتد خشبي', ['Wooden dowel'], ['Wooden Dowels']),
  component('wood-glue', 'Wood Glue', 'غراء خشب', ['Wood glue'], ['Wood Glue']),
];

export const TAXONOMY_CONCEPT_TYPE_COUNTS = TAXONOMY_CONCEPT_SEEDS.reduce(
  (counts, seed) => ({ ...counts, [seed.conceptType]: (counts[seed.conceptType] ?? 0) + 1 }),
  {} as Record<string, number>,
);
