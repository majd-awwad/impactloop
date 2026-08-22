import { z } from 'zod';

import { resolveAiChatProvider } from '../../config/env.js';
import { logger } from '../../observability/logger.js';
import { AppError } from '../../utils/app-error.js';
import { getAiChatProvider } from './providers/ai-chat-provider.factory.js';

import type {
  AiContentBlock,
  AiProjectAuthoringClarificationBlock,
} from './ai.content-blocks.js';
import {
  generateRealAuthoringComponentList,
  type RealAuthoringComponentListInput,
} from './ai-project-authoring-real.provider.js';
import type { SequentialComponent } from './ai-project-authoring-sequential.policy.js';
import type { AiLocale, BoundedHistoryMessage } from './ai.types.js';
import type { ProjectRecord } from './project-authoring-session.types.js';

const componentRoleSchema = z.enum(['REQUIRED_MATERIAL', 'TOOL', 'CONSUMABLE']);

const sequentialComponentSchema = z.object({
  componentName: z.string().trim().min(1).max(200),
  materialType: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(10000),
  unit: z.string().trim().min(1).max(40),
  componentRole: componentRoleSchema,
  isRequired: z.boolean(),
  canBeSubstituted: z.boolean(),
  searchKeywords: z.array(z.string()).max(20).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const componentStageReplySchema = z.discriminatedUnion('replyType', [
  z.object({
    replyType: z.literal('COMPONENT_LIST'),
    assistantText: z.string().trim().min(8).max(4000),
    components: z.array(sequentialComponentSchema).min(1).max(30),
  }),
  z.object({
    replyType: z.literal('REVISED_COMPONENT_LIST'),
    assistantText: z.string().trim().min(8).max(4000),
    components: z.array(sequentialComponentSchema).min(1).max(30),
  }),
  z.object({
    replyType: z.literal('FOLLOW_UP_QUESTION'),
    assistantText: z.string().trim().min(8).max(1200),
  }),
  z.object({
    replyType: z.literal('COMPONENT_EXPLANATION'),
    assistantText: z.string().trim().min(8).max(2000),
  }),
]);

export type ComponentStageReply = z.infer<typeof componentStageReplySchema>;

export type ComponentStageIntent =
  | 'SHOW_OR_GENERATE_FULL_LIST'
  | 'REVISION'
  | 'EXPLANATION'
  | 'OTHER';

export type ComponentListContext = {
  locale: AiLocale;
  projectId?: string | null;
  ideaText: string;
  projectTitle: string;
  projectShortDescription: string;
  projectDescription: string | null;
  difficulty?: string | null;
  durationMinutes?: number | null;
  clarification: AiProjectAuthoringClarificationBlock;
  recentAnswers: string[];
  feedback?: string;
  previousComponents?: SequentialComponent[];
  repairAttempt?: boolean;
  repairIssue?: string | null;
};

export type ComponentFeedbackContext = ComponentListContext & {
  comment: string;
  currentComponents: SequentialComponent[];
  intent: ComponentStageIntent;
};

const ARABIC_SCRIPT_PATTERN = /[\u0600-\u06FF]/;

/**
 * Primary sensing devices that must never be injected into a project whose brief
 * does not support their purpose (e.g. an Ultrasonic or PIR sensor slipping into
 * an LDR night-light). A project may support a sensor through its goal rather
 * than its exact catalog name, so every group has both direct and semantic
 * project-context signals.
 */
const FOREIGN_SENSOR_GROUPS: Array<{
  label: string;
  pattern: RegExp;
  supportedByProject: RegExp;
}> = [
  {
    label: 'ultrasonic sensor',
    pattern: /\b(ultrasonic|hc[-\s]?sr04)\b|بالموجات\s*فوق\s*الصوتية|الموجات\s*فوق\s*الصوتية|مستشعر\s*الموجات/i,
    supportedByProject:
      /\b(ultrasonic|hc[-\s]?sr04|distance|proximity|obstacle|parking|tank\s*level|range)\b|مساف[هة]|قرب|عوائق|موقف|مستوى\s*الخزان|خزان/i,
  },
  {
    label: 'PIR / motion sensor',
    pattern: /\b(pir|motion\s*sensor)\b|حسّ?اس\s*حركة|كشف\s*الحركة/i,
    supportedByProject:
      /\b(pir|motion\s*sensor|motion|presence|occupancy|security|intrusion|alarm)\b|حسّ?اس\s*حركة|كشف\s*الحركة|وجود|إشغال|اشغال|أمن|امن|تسلل|إنذار|انذار/i,
  },
  {
    label: 'soil-moisture sensor',
    pattern: /\bsoil\s*moisture\b|رطوبة\s*التربة/i,
    supportedByProject:
      /\b(soil\s*moisture|plant|garden|greenhouse|irrigation|agri(?:culture)?|watering|grow(?:ing)?|soil|humidity)\b|رطوبة\s*التربة|نبات(?:ات)?|حديقة|دفيئة|ري|سقي|زراع(?:ة|ي)|تربة|رطوبة/i,
  },
];
const VAGUE_COMPONENT_NAME_PATTERNS = [
  /^electronic parts?$/i,
  /^wiring tools?$/i,
  /^project supplies?$/i,
  /^مواد عامة$/,
  /^أدوات عامة$/,
];

const SHORT_FOLLOW_UP_PATTERN =
  /^(اه|اها|اي|ايوه|ايه|كمل|تمام|طيب|نعم|اوكي|ok|okay|yes|yep|sure|more|اكثر|وضح|وضح اكثر|وضحلي|اشرح اكثر)$/i;

const isConversationContinuationFollowUp = (comment: string) => {
  const normalized = normalizeText(comment);
  if (SHORT_FOLLOW_UP_PATTERN.test(normalized)) {
    return true;
  }
  return /^(اه[،,]?\s*)?(كمل|تمام|وضح|وضحلي|وضح اكثر|اشرح اكثر|وبعدين|بعدين|more|continue)(?:\s|$|[،,.])/.test(
    normalized,
  );
};

export type ComponentComposerIntent =
  | 'EXPLAIN_COMPONENT'
  | 'EXPLAIN_COMPONENT_LIST'
  | 'ANSWER_PROJECT_QUESTION'
  | 'CONTINUE_PREVIOUS_RESPONSE'
  | 'ADD_COMPONENT'
  | 'REMOVE_COMPONENT'
  | 'REPLACE_COMPONENT'
  | 'CHANGE_COMPONENT_QUANTITY'
  | 'SUGGEST_ALTERNATIVE'
  | 'REVISE_COMPONENT_LIST'
  | 'CLARIFY_LEARNER_REQUEST';

export type ComponentStageComposerResult =
  | { kind: 'EXPLANATION'; assistantText: string }
  | { kind: 'FOLLOW_UP'; assistantText: string }
  | { kind: 'REVISED_LIST'; assistantText: string; components: SequentialComponent[] };

const GENERIC_COMPONENT_ACK_PATTERNS = [
  /^which part of this suggestion/i,
  /^which part would you like to change/i,
  /^i understand/i,
  /^i will revise/i,
  /^ما الجزء الذي تريد تعديله/i,
  /^فهمت طلبك/i,
];

const normalizeText = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[!.؟?،,]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/أ/g, 'ا')
    .replace(/إ/g, 'ا')
    .replace(/آ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

const constraintText = (input: ComponentListContext) =>
  [
    input.ideaText,
    input.projectTitle,
    input.projectShortDescription,
    input.projectDescription ?? '',
    input.difficulty ?? '',
    input.durationMinutes?.toString() ?? '',
    ...input.recentAnswers,
    JSON.stringify(input.clarification),
  ].join(' ');

const learnerConstraints = (input: ComponentListContext) =>
  [
    input.ideaText,
    input.projectDescription ?? '',
    ...input.recentAnswers,
    ...(input.clarification.warnings ?? []),
    ...(input.clarification.assumptions ?? []),
  ].filter(Boolean);

const hasNoPumpConstraint = (text: string) =>
  /\b(no pump|without (a )?pump|no water pump|بدون مضخه|بدون مضخة|لا مضخه|لا مضخة)\b/i.test(
    text,
  );

const hasNoRelayConstraint = (text: string) =>
  /\b(no relay|without (a )?relay|بدون relay|بدون ريلاي|لا relay)\b/i.test(text);

const hasNoLcdConstraint = (text: string) =>
  /\b(no lcd|without (a )?lcd|بدون lcd|لا lcd)\b/i.test(text);

const hasNoScreenConstraint = (text: string) =>
  /\b(no screen|without (a )?screen|no display|بدون شاشه|بدون شاشة)\b/i.test(text);

const mentionsElectronics = (text: string) =>
  /\b(arduino|esp32|electronics|led|buzzer|sensor|breadboard|microcontroller)\b/i.test(
    text,
  );

const excludesElectronics = (text: string) =>
  /\b(no|without)\s+([a-z]+\s+)*(arduino|electronics|electronic|led|buzzer|sensor|breadboard)\b/i.test(
    text,
  );

const isElectronicsContext = (text: string) =>
  mentionsElectronics(text) && !excludesElectronics(text);

const isCraftContext = (text: string) =>
  /\b(cardboard|glue|ruler|scissors|cutting tool|craft|recycl)\b/i.test(text) &&
  !isElectronicsContext(text);

const isFabricContext = (text: string) =>
  /\b(fabric|textile|thread|needle|sewing|tote|scrap)\b/i.test(text) &&
  !isElectronicsContext(text);

const componentEntry = (
  locale: AiLocale,
  nameEn: string,
  nameAr: string,
  materialType: string,
  quantity: number,
  unit: string,
  role: SequentialComponent['componentRole'],
  required: boolean,
  keywords: string[],
  notesEn: string,
  notesAr: string,
): SequentialComponent => ({
  componentName: locale === 'ar' ? nameAr : nameEn,
  materialType,
  quantity,
  unit,
  componentRole: role,
  isRequired: required,
  canBeSubstituted: true,
  searchKeywords: keywords,
  notes: locale === 'ar' ? notesAr : notesEn,
});

const mockReactionGameComponents = (locale: AiLocale): SequentialComponent[] => [
  componentEntry(locale, 'Arduino Uno', 'لوحة Arduino Uno', 'Microcontroller', 1, 'piece', 'TOOL', true, ['Arduino'], 'Main controller.', 'لوحة التحكم.'),
  componentEntry(locale, 'Push button', 'زر ضغط', 'Input', 1, 'piece', 'REQUIRED_MATERIAL', true, ['button'], 'Player input.', 'إدخال اللاعب.'),
  componentEntry(locale, 'LED (red)', 'LED أحمر', 'Output', 1, 'piece', 'REQUIRED_MATERIAL', true, ['LED'], 'Indicator.', 'مؤشر.'),
  componentEntry(locale, 'LED (green)', 'LED أخضر', 'Output', 1, 'piece', 'REQUIRED_MATERIAL', true, ['LED'], 'Indicator.', 'مؤشر.'),
  componentEntry(locale, 'LED (yellow)', 'LED أصفر', 'Output', 1, 'piece', 'REQUIRED_MATERIAL', true, ['LED'], 'Indicator.', 'مؤشر.'),
  componentEntry(locale, 'Buzzer', 'Buzzer', 'Output', 1, 'piece', 'REQUIRED_MATERIAL', true, ['buzzer'], 'Audio feedback.', 'تنبيه صوتي.'),
  componentEntry(locale, '220 ohm resistors', 'مقاومات 220 أوم', 'Electronics', 3, 'piece', 'REQUIRED_MATERIAL', true, ['resistor'], 'Protect LEDs.', 'حماية الـ LED.'),
  componentEntry(locale, 'Breadboard', 'لوح تجارب', 'Accessory', 1, 'piece', 'TOOL', true, ['breadboard'], 'Prototype wiring.', 'تجارب التوصيل.'),
  componentEntry(locale, 'Jumper wires', 'أسلاك توصيل', 'Accessory', 10, 'piece', 'CONSUMABLE', true, ['jumper'], 'Connections.', 'توصيلات.'),
];

const mockCardboardStandComponents = (locale: AiLocale): SequentialComponent[] => [
  componentEntry(locale, 'Recycled cardboard', 'كرتون معاد التدوير', 'Cardboard', 2, 'sheet', 'REQUIRED_MATERIAL', true, ['cardboard'], 'Main material.', 'المادة الأساسية.'),
  componentEntry(locale, 'Craft glue', 'غراء حرفي', 'Adhesive', 1, 'bottle', 'CONSUMABLE', true, ['glue'], 'Assembly.', 'للتجميع.'),
  componentEntry(locale, 'Ruler', 'مسطرة', 'Tool', 1, 'piece', 'TOOL', true, ['ruler'], 'Measurements.', 'للقياس.'),
  componentEntry(locale, 'Cutting tool', 'أداة قص', 'Tool', 1, 'piece', 'TOOL', true, ['cutter'], 'Cut cardboard.', 'قص الكرتون.'),
];

const mockFabricToteComponents = (locale: AiLocale): SequentialComponent[] => [
  componentEntry(locale, 'Fabric scraps', 'بقايا قماش', 'Textile', 4, 'piece', 'REQUIRED_MATERIAL', true, ['fabric'], 'Bag body.', 'جسم الحقيبة.'),
  componentEntry(locale, 'Thread', 'خيط', 'Textile', 1, 'spool', 'CONSUMABLE', true, ['thread'], 'Seams.', 'للخياطة.'),
  componentEntry(locale, 'Hand-sewing needle', 'إبرة يدوية', 'Tool', 1, 'piece', 'TOOL', true, ['needle'], 'Sewing.', 'للخياطة.'),
];

const mockDoorAlarmComponents = (locale: AiLocale): SequentialComponent[] => [
  componentEntry(locale, 'Arduino Uno', 'لوحة Arduino Uno', 'Microcontroller', 1, 'piece', 'TOOL', true, ['Arduino'], 'Controls alarm logic.', 'يتحكم بمنطق الإنذار.'),
  componentEntry(locale, 'Magnetic reed switch', 'Reed switch مغناطيسي', 'Sensor', 1, 'piece', 'REQUIRED_MATERIAL', true, ['reed'], 'Door sensor.', 'حساس الباب.'),
  componentEntry(locale, 'Buzzer', 'Buzzer', 'Output', 1, 'piece', 'REQUIRED_MATERIAL', true, ['buzzer'], 'Audible alert.', 'تنبيه صوتي.'),
  componentEntry(locale, 'Red LED', 'LED أحمر', 'Output', 1, 'piece', 'REQUIRED_MATERIAL', true, ['LED'], 'Visual alert.', 'تنبيه ضوئي.'),
  componentEntry(locale, '220 ohm resistor', 'مقاومة 220 أوم', 'Electronics', 1, 'piece', 'REQUIRED_MATERIAL', true, ['resistor'], 'Protect LED.', 'حماية الـ LED.'),
  componentEntry(locale, 'Breadboard', 'لوح تجارب', 'Accessory', 1, 'piece', 'TOOL', true, ['breadboard'], 'Wiring.', 'توصيل.'),
  componentEntry(locale, 'Jumper wires', 'أسلاك توصيل', 'Accessory', 10, 'piece', 'CONSUMABLE', true, ['jumper'], 'Connections.', 'توصيلات.'),
  componentEntry(locale, 'USB cable', 'كابل USB', 'Accessory', 1, 'piece', 'TOOL', true, ['USB'], 'Power/program.', 'تغذية وبرمجة.'),
];

const mockSoilMoistureComponents = (locale: AiLocale): SequentialComponent[] => [
  componentEntry(locale, 'Arduino Uno', 'لوحة Arduino Uno', 'Microcontroller', 1, 'piece', 'TOOL', true, ['Arduino'], 'Controller.', 'لوحة التحكم.'),
  componentEntry(locale, 'Soil moisture sensor', 'مستشعر رطوبة التربة', 'Sensor', 1, 'piece', 'REQUIRED_MATERIAL', true, ['soil'], 'Moisture reading.', 'قراءة الرطوبة.'),
  componentEntry(locale, 'LED', 'LED', 'Output', 1, 'piece', 'REQUIRED_MATERIAL', true, ['LED'], 'Dry alert.', 'تنبيه الجفاف.'),
  componentEntry(locale, '220 ohm resistor', 'مقاومة 220 أوم', 'Electronics', 1, 'piece', 'REQUIRED_MATERIAL', true, ['resistor'], 'Protect LED.', 'حماية الـ LED.'),
  componentEntry(locale, 'Jumper wires', 'أسلاك توصيل', 'Accessory', 10, 'piece', 'CONSUMABLE', true, ['jumper'], 'Connections.', 'توصيلات.'),
];

const createBreadboardComponent = (locale: AiLocale): SequentialComponent => ({
  componentName: locale === 'ar' ? 'لوح تجارب (Breadboard)' : 'Breadboard',
  materialType: 'Accessory',
  quantity: 1,
  unit: 'piece',
  componentRole: 'TOOL',
  isRequired: true,
  canBeSubstituted: true,
  searchKeywords: ['breadboard'],
  notes: locale === 'ar' ? 'يسهّل توصيل الدائرة.' : 'Makes wiring the circuit easier.',
});

const mockArduinoLdrNightLightComponents = (locale: AiLocale): SequentialComponent[] => [
  componentEntry(locale, 'Arduino Uno', 'لوحة Arduino Uno', 'Microcontroller', 1, 'piece', 'TOOL', true, ['Arduino'], 'Main controller for reading the LDR and driving the LED.', 'لوحة التحكم لقراءة LDR وتشغيل LED.'),
  componentEntry(locale, 'LDR (photoresistor)', 'حساس LDR (Photoresistor)', 'Sensor', 1, 'piece', 'REQUIRED_MATERIAL', true, ['LDR', 'photoresistor'], 'Measures ambient light for night-light switching.', 'يقيس الإضاءة المحيطة لتبديل المصباح الليلي.'),
  componentEntry(locale, 'LED', 'LED', 'Output', 1, 'piece', 'REQUIRED_MATERIAL', true, ['LED'], 'Visible night-light output.', 'مخرج ضوئي للمصباح الليلي.'),
  componentEntry(locale, '10k ohm resistor', 'مقاومة 10kΩ', 'Electronics', 1, 'piece', 'REQUIRED_MATERIAL', true, ['10k', 'resistor'], 'Forms the LDR voltage divider with the sensor.', 'تكوّن مقسم الجهد مع LDR.'),
  componentEntry(locale, '220 ohm resistor', 'مقاومة 220Ω', 'Electronics', 1, 'piece', 'REQUIRED_MATERIAL', true, ['220', 'resistor'], 'Limits current through the LED.', 'تحدّ تيار LED.'),
  componentEntry(locale, 'Breadboard', 'Breadboard', 'Accessory', 1, 'piece', 'TOOL', true, ['breadboard'], 'Prototype wiring without soldering.', 'توصيل تجريبي بدون لحام.'),
  componentEntry(locale, 'Jumper wires', 'Jumper wires', 'Accessory', 10, 'piece', 'CONSUMABLE', true, ['jumper'], 'Connect Arduino, sensor, resistor, and LED.', 'توصيل Arduino والحساس والمقاومات والـ LED.'),
  componentEntry(locale, 'USB cable', 'كابل USB', 'Accessory', 1, 'piece', 'TOOL', true, ['USB'], '5V power and programming from a computer.', 'تغذية 5V وبرمجة من الحاسوب.'),
];

const isLdrNightLightContext = (text: string) =>
  /\b(ldr|night[- ]?light|photoresistor|light[- ]?dependent)\b/i.test(text) ||
  /(مصباح ليل|حساس ldr|ldr|فوتوريزستور)/i.test(text);

const mockGenerateSequentialComponentList = (
  input: ComponentListContext & { suggestAnother?: boolean; previousComponents?: SequentialComponent[] },
): { components: SequentialComponent[]; explanation: string } => {
  const text = constraintText(input).toLowerCase();
  let components: SequentialComponent[];

  if (isFabricContext(text)) {
    components = mockFabricToteComponents(input.locale);
  } else if (isCraftContext(text)) {
    components = mockCardboardStandComponents(input.locale);
  } else if (/\b(reaction game|push button).*\b(led|buzzer)\b/i.test(text) || (/\bbutton\b/.test(text) && /\bbuzzer\b/.test(text) && /\bled\b/.test(text))) {
    components = mockReactionGameComponents(input.locale);
  } else if (/\b(door alarm|reed switch|magnetic door)\b/i.test(text)) {
    components = mockDoorAlarmComponents(input.locale);
  } else if (isLdrNightLightContext(text)) {
    components = mockArduinoLdrNightLightComponents(input.locale);
  } else if (/\b(soil moisture|moisture sensor)\b/i.test(text)) {
    components = mockSoilMoistureComponents(input.locale);
  } else if (isElectronicsContext(text)) {
    components = mockArduinoLdrNightLightComponents(input.locale);
  } else {
    components = mockCardboardStandComponents(input.locale);
  }

  if (input.suggestAnother) {
    const withBreadboard = components.some((component) => /breadboard|تجارب/i.test(component.componentName))
      ? components.map((component) =>
          /jumper|wire|اسلاك|أسلاك/i.test(component.componentName)
            ? { ...component, quantity: component.quantity + 5 }
            : component,
        )
      : [...components, createBreadboardComponent(input.locale)];
    components = withBreadboard;
  }

  return {
    components,
    explanation:
      input.locale === 'ar'
        ? 'قائمة مكوّنات مقترحة بناءً على فكرة مشروعك.'
        : 'A proposed component list based on your project idea.',
  };
};

const filterConstraints = (
  components: SequentialComponent[],
  text: string,
): SequentialComponent[] =>
  components.filter((component) => {
    const name = component.componentName.toLowerCase();
    if (hasNoPumpConstraint(text) && /pump|مضخه|مضخة/.test(name)) {
      return false;
    }
    if (hasNoRelayConstraint(text) && /relay|ريلاي/.test(name)) {
      return false;
    }
    if ((hasNoLcdConstraint(text) || hasNoScreenConstraint(text)) && /lcd|screen|display|شاشه|شاشة/.test(name)) {
      return false;
    }
    if (isCraftContext(text) && /arduino|sensor|led|buzzer|breadboard|jumper|relay|pump|ldr/.test(name)) {
      return false;
    }
    if (isFabricContext(text) && /arduino|cardboard|sensor|led|buzzer|breadboard|jumper/.test(name)) {
      return false;
    }
    return true;
  });

export const validateComponentList = (components: SequentialComponent[]) => {
  const parsed = z.array(sequentialComponentSchema).min(1).safeParse(components);
  if (!parsed.success) {
    throw new AppError(
      'Component list was invalid.',
      502,
      'AI_COMPONENT_PROPOSAL_INVALID',
    );
  }
  const names = parsed.data.map((component) =>
    normalizeText(component.componentName),
  );
  if (new Set(names).size !== names.length) {
    throw new AppError(
      'Component list contained duplicate names.',
      502,
      'AI_COMPONENT_PROPOSAL_INVALID',
    );
  }
  return parsed.data;
};

export const assertComponentListQuality = (
  input: ComponentListContext,
  components: SequentialComponent[],
) => {
  const issues: string[] = [];
  const corpus = constraintText(input);
  const looksArabic = ARABIC_SCRIPT_PATTERN.test(corpus);

  if (looksArabic) {
    const arabicComponents = components.filter((component) =>
      ARABIC_SCRIPT_PATTERN.test(`${component.componentName} ${component.notes ?? ''}`),
    ).length;
    if (arabicComponents < Math.ceil(components.length / 2)) {
      issues.push('Arabic projects require Arabic component names and notes.');
    }
  }

  for (const component of components) {
    const name = component.componentName.trim();
    if (!name || name.length < 2) {
      issues.push('Component names must be specific.');
    }
    if (VAGUE_COMPONENT_NAME_PATTERNS.some((pattern) => pattern.test(name))) {
      issues.push(`Component "${name}" is too vague.`);
    }
    if (
      component.notes != null &&
      component.notes.trim().length > 0 &&
      component.notes.trim().length < 6
    ) {
      issues.push(`Component "${name}" needs a clearer purpose in notes.`);
    }
  }

  const text = corpus.toLowerCase();
  if (hasNoRelayConstraint(text)) {
    const relay = components.some((component) => /relay|ريلاي/i.test(component.componentName));
    if (relay) {
      issues.push('Component list includes excluded relay.');
    }
  }
  if (hasNoPumpConstraint(text)) {
    const pump = components.some((component) => /pump|مضخه|مضخة/i.test(component.componentName));
    if (pump) {
      issues.push('Component list includes excluded pump.');
    }
  }
  if ((hasNoLcdConstraint(text) || hasNoScreenConstraint(text)) &&
    components.some((component) => /lcd|screen|display|شاشه|شاشة/i.test(component.componentName))) {
    issues.push('Component list includes excluded display.');
  }

  if (isElectronicsContext(text) && components.length < 5) {
    issues.push(
      `Electronics projects need a circuit-complete component list; received ${components.length}.`,
    );
  }

  for (const foreign of FOREIGN_SENSOR_GROUPS) {
    const projectSupportsSensor = foreign.supportedByProject.test(corpus);
    if (projectSupportsSensor) {
      continue;
    }
    const offending = components.find((component) =>
      foreign.pattern.test(`${component.componentName} ${component.notes ?? ''}`),
    );
    if (offending) {
      issues.push(
        `Component "${offending.componentName}" is a ${foreign.label}, but the project context does not support that sensor's purpose.`,
      );
    }
  }

  if (issues.length > 0) {
    throw new AppError(issues.join(' '), 502, 'AI_COMPONENT_PROPOSAL_INVALID', { issues });
  }
};

export type ComponentSignature = {
  name: string;
  quantity: number;
  unit: string;
  required: boolean;
};

export const componentListSignature = (
  components: SequentialComponent[],
): ComponentSignature[] =>
  components
    .map((component) => ({
      name: component.componentName.trim().toLowerCase(),
      quantity: component.quantity,
      unit: component.unit.trim().toLowerCase(),
      required: component.isRequired,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

export const areComponentListsIdentical = (
  left: SequentialComponent[],
  right: SequentialComponent[],
): boolean =>
  JSON.stringify(componentListSignature(left)) ===
  JSON.stringify(componentListSignature(right));

const toRealComponentInput = (
  input: ComponentListContext & {
    suggestAnother?: boolean;
    previousComponents?: SequentialComponent[];
    feedback?: string | null;
  },
): RealAuthoringComponentListInput => ({
  locale: input.locale,
  projectId: input.projectId ?? null,
  ideaText: input.ideaText,
  projectTitle: input.projectTitle,
  projectShortDescription: input.projectShortDescription,
  projectDescription: input.projectDescription,
  difficulty: input.difficulty ?? null,
  durationMinutes: input.durationMinutes ?? null,
  learnerConstraints: learnerConstraints(input),
  recentMessages: input.recentAnswers,
  clarification: input.clarification,
  repairAttempt: input.repairAttempt ?? false,
  repairIssue: input.repairIssue ?? null,
  previousInvalidOutput: null,
  suggestAnother: input.suggestAnother,
  previousComponents: input.previousComponents,
  feedback: input.feedback ?? null,
});

const finalizeComponentList = (
  input: ComponentListContext,
  components: SequentialComponent[],
  explanation: string,
) => {
  const filtered = validateComponentList(filterConstraints(components, constraintText(input)));
  assertComponentListQuality(input, filtered);
  return {
    components: filtered,
    explanation,
  };
};

export const applyComponentRevisionFromComment = (
  components: SequentialComponent[],
  comment: string,
  locale: AiLocale,
): { components: SequentialComponent[] | null; assistantNote?: string } => {
  const normalized = normalizeText(comment);
  let revised = components.map((component) => ({ ...component }));
  let changed = false;

  if (
    (/(ضيف|اضف|اضافة|add)/.test(normalized) || normalized.includes('ضيف')) &&
    /breadboard|بريدبورد|لوح تجارب/.test(normalized)
  ) {
    if (!revised.some((component) => /breadboard|تجارب/i.test(component.componentName))) {
      revised.push(createBreadboardComponent(locale));
      changed = true;
    }
  }

  const quantityMatch =
    normalized.match(/عددهم\s*(\d+)/) ??
    normalized.match(/عدد(?:هم)?\s*(\d+)/) ??
    normalized.match(/quantity\s*(\d+)/) ??
    normalized.match(/(\d+)\s*(?:قطعه|قطعة|piece|pieces)/);
  const requestedQuantity = quantityMatch ? Number(quantityMatch[1]) : null;
  if (
    requestedQuantity != null &&
    /jumper|اسلاك|أسلاك|wire|توصيل/.test(normalized)
  ) {
    revised = revised.map((component) => {
      if (/jumper|اسلاك|أسلاك|wire|توصيل/i.test(component.componentName)) {
        if (component.quantity !== requestedQuantity) {
          changed = true;
          return { ...component, quantity: requestedQuantity };
        }
      }
      return component;
    });
  }

  if (
    (/(احذف|ازل|remove|delete)/.test(normalized) || normalized.includes('بدون')) &&
    /pump|مضخه|مضخة/.test(normalized)
  ) {
    const before = revised.length;
    revised = revised.filter((component) => !/pump|مضخه|مضخة/i.test(component.componentName));
    changed = changed || revised.length !== before;
  }

  if (
    (/(احذف|ازل|remove|delete)/.test(normalized) || normalized.includes('بدون')) &&
    /relay|ريلاي/.test(normalized)
  ) {
    const before = revised.length;
    revised = revised.filter((component) => !/relay|ريلاي/i.test(component.componentName));
    changed = changed || revised.length !== before;
  }

  if (
    (/(احذف|ازل|remove|delete)/.test(normalized) || normalized.includes('بدون')) &&
    /مقاوم|resistor/.test(normalized)
  ) {
    const hadResistor = revised.some((component) =>
      /resistor|مقاوم/i.test(component.componentName),
    );
    revised = revised.filter(
      (component) => !/resistor|مقاوم/i.test(component.componentName),
    );
    changed = changed || hadResistor;
    if (hadResistor) {
      return {
        components: validateComponentList(revised),
        assistantNote:
          locale === 'ar'
            ? 'أزلت المقاومة. قد يحتاج الـ LED مقاومة لتقليل التيار.'
            : 'Removed the resistor. The LED may still need a current-limiting resistor.',
      };
    }
  }

  if (!changed) {
    return { components: null };
  }

  return { components: validateComponentList(revised) };
};

let componentListGeneratorOverride:
  | ((input: ComponentListContext) => Promise<SequentialComponent[]> | SequentialComponent[])
  | null = null;

export const setSequentialComponentListGeneratorForTests = (
  generator: typeof componentListGeneratorOverride,
) => {
  componentListGeneratorOverride = generator;
};

const invokeConfiguredComponentProvider = async (
  input: ComponentListContext & {
    suggestAnother?: boolean;
    previousComponents?: SequentialComponent[];
    feedback?: string | null;
  },
) => {
  const resolvedProvider = resolveAiChatProvider();

  if (resolvedProvider === 'disabled') {
    throw new AppError(
      input.locale === 'ar'
        ? 'مساعد الذكاء الاصطناعي غير متاح حاليًا.'
        : 'The AI assistant is currently unavailable.',
      503,
      'AI_DISABLED',
    );
  }

  if (resolvedProvider === 'mock') {
    const mock = mockGenerateSequentialComponentList(input);
    return finalizeComponentList(input, mock.components, mock.explanation);
  }

  const providerResult = await generateRealAuthoringComponentList(
    toRealComponentInput(input),
    resolvedProvider,
  );
  return finalizeComponentList(
    input,
    providerResult.data.components,
    providerResult.data.explanation,
  );
};

export const generateSequentialComponentList = async (
  input: ComponentListContext,
): Promise<{ components: SequentialComponent[]; explanation: string }> => {
  if (componentListGeneratorOverride) {
    const components = await componentListGeneratorOverride(input);
    return finalizeComponentList(
      input,
      components,
      input.locale === 'ar'
        ? 'قائمة مكوّنات مقترحة بناءً على فكرة مشروعك.'
        : 'A proposed component list based on your project idea.',
    );
  }

  return invokeConfiguredComponentProvider(input);
};

export const generateAlternativeSequentialComponentList = async (
  input: ComponentListContext & { previousComponents: SequentialComponent[] },
): Promise<{ components: SequentialComponent[]; explanation: string }> => {
  const generated = await invokeConfiguredComponentProvider({
    ...input,
    suggestAnother: true,
    previousComponents: input.previousComponents,
    feedback:
      input.locale === 'ar'
        ? 'اقترح قائمة مكوّنات بديلة ومختلفة ماديًا عن القائمة السابقة.'
        : 'Suggest a materially different alternative component list from the previous one.',
  });

  if (areComponentListsIdentical(generated.components, input.previousComponents)) {
    throw new AppError(
      input.locale === 'ar'
        ? 'أعاد المساعد نفس قائمة المكوّنات. جرّب اقتراحًا آخر.'
        : 'The assistant returned the same component list. Retry another suggestion.',
      502,
      'AI_COMPONENT_PROPOSAL_IDENTICAL',
    );
  }

  return generated;
};

const validationIssuesFromError = (error: unknown): string[] => {
  if (!(error instanceof AppError) || !error.details || typeof error.details !== 'object') {
    return [];
  }
  const issues = (error.details as { issues?: unknown }).issues;
  return Array.isArray(issues)
    ? issues.filter((issue): issue is string => typeof issue === 'string')
    : [];
};

const validationTargetFromIssues = (issues: string[]) => {
  const text = issues.join(' ').toLowerCase();
  return FOREIGN_SENSOR_GROUPS.find((group) => text.includes(group.label))?.label ?? 'component-list';
};

const buildComponentRepairIssue = (error: unknown) => {
  const issues = validationIssuesFromError(error);
  const primaryIssue = issues.slice(0, 4).map((issue) => issue.slice(0, 360)).join(' ');
  const reason = primaryIssue ||
    (error instanceof AppError ? error.message : 'Component list was invalid.');

  return [
    'The previous component list failed validation.',
    `Failed rule: ${reason}`,
    'Return a complete replacement COMPONENT_LIST, not a partial patch.',
    'Use the complete canonical project context to decide whether each sensor serves the project goal; remove or replace a sensor whose purpose is unsupported.',
    'Keep explicit exclusions, required fields, and project-completeness constraints intact.',
  ].join(' ');
};

const logComponentRepairAttempt = (
  error: unknown,
  repairAttempt: boolean,
  repairSucceeded: boolean,
) => {
  if ((process.env.NODE_ENV ?? 'development') !== 'development') {
    return;
  }
  const issues = validationIssuesFromError(error);
  logger.warn(
    {
      operation: 'component_generation_repair',
      stage: 'COMPONENTS',
      errorCode: error instanceof AppError ? error.code : 'UNKNOWN',
      field: 'components[].componentName',
      reason: issues.length > 0 ? 'component_quality_validation' : 'provider_response_validation',
      target: validationTargetFromIssues(issues),
      repairAttempt,
      repairSucceeded,
    },
    'AI authoring component generation repair attempt',
  );
};

export const generateAlternativeSequentialComponentListWithRepair = async (
  input: ComponentListContext & { previousComponents: SequentialComponent[] },
): Promise<{ components: SequentialComponent[]; explanation: string }> => {
  try {
    return await generateAlternativeSequentialComponentList(input);
  } catch (error) {
    const repairable =
      error instanceof AppError &&
      [
        'AI_RESPONSE_INVALID',
        'AI_COMPONENT_PROPOSAL_INVALID',
        'AI_COMPONENT_PROPOSAL_IDENTICAL',
      ].includes(error.code);
    if (input.repairAttempt || !repairable) {
      throw error;
    }
    const repairIssue = buildComponentRepairIssue(error);
    logComponentRepairAttempt(error, true, false);
    try {
      const repaired = await generateAlternativeSequentialComponentList({
        ...input,
        repairAttempt: true,
        repairIssue,
      });
      logComponentRepairAttempt(error, true, true);
      return repaired;
    } catch (repairError) {
      logComponentRepairAttempt(repairError, true, false);
      throw repairError;
    }
  }
};

export const generateSequentialComponentListWithRepair = async (
  input: ComponentListContext,
): Promise<{ components: SequentialComponent[]; explanation: string }> => {
  try {
    return await generateSequentialComponentList(input);
  } catch (error) {
    // Regenerate once only when the provider did return a response that we can
    // ask it to repair. Transport, timeout, auth, and rate-limit failures need
    // normal retry semantics instead of a second identical network request.
    const repairable =
      error instanceof AppError &&
      ['AI_RESPONSE_INVALID', 'AI_COMPONENT_PROPOSAL_INVALID'].includes(error.code);
    if (input.repairAttempt || !repairable) {
      throw error;
    }
    const repairIssue = buildComponentRepairIssue(error);
    logComponentRepairAttempt(error, true, false);
    try {
      const repaired = await generateSequentialComponentList({
        ...input,
        repairAttempt: true,
        repairIssue,
      });
      logComponentRepairAttempt(error, true, true);
      return repaired;
    } catch (repairError) {
      logComponentRepairAttempt(repairError, true, false);
      throw repairError;
    }
  }
};

export const resolveComponentComposerIntent = (input: {
  comment: string;
  history: BoundedHistoryMessage[];
  currentComponents: SequentialComponent[];
}): ComponentComposerIntent => {
  const normalized = normalizeText(input.comment);
  const lastAssistant = [...input.history].reverse().find((entry) => entry.role === 'assistant');

  if (isConversationContinuationFollowUp(input.comment) && lastAssistant) {
    return 'CONTINUE_PREVIOUS_RESPONSE';
  }

  if (
    /^(ليش|لماذا|why|how come)\b/.test(normalized) ||
    normalized.includes('ليش بحتاج') ||
    normalized.includes('why do i need') ||
    (/(explain|اشرح|وضح)/.test(normalized) &&
      input.currentComponents.some((component) =>
        normalized.includes(normalizeText(component.componentName)),
      ))
  ) {
    return normalized.includes('قائمه') || normalized.includes('قائمة') || normalized.includes('list')
      ? 'EXPLAIN_COMPONENT_LIST'
      : 'EXPLAIN_COMPONENT';
  }

  if (
    normalized.includes('بديل') ||
    normalized.includes('alternative') ||
    normalized.includes('substitute')
  ) {
    return 'SUGGEST_ALTERNATIVE';
  }

  if (
    (/(اضف|اضافة|add)/.test(normalized) || normalized.includes('ضيف')) &&
    !/(احذف|ازل|remove|delete)/.test(normalized)
  ) {
    return 'ADD_COMPONENT';
  }

  if (/(احذف|ازل|remove|delete)/.test(normalized) || normalized.includes('بدون')) {
    return 'REMOVE_COMPONENT';
  }

  if (/(استبدل|غير|replace|swap)/.test(normalized)) {
    return 'REPLACE_COMPONENT';
  }

  if (
    !/(ليش|لماذا|why|how|اشرح|وضح|explain)/.test(normalized) &&
    (/(عددهم|عدد|quantity|قطعتين|قطعة|piece|pieces)/.test(normalized) ||
      /\d+\s*(?:قطع|قطعة|حبة|وحدة|pieces?|units?)/.test(normalized) ||
      /(?:قطع|قطعة|حبة|وحدة|pieces?|units?)\s*\d+/.test(normalized)) &&
    input.currentComponents.some((component) =>
      normalized.includes(normalizeText(component.componentName)),
    )
  ) {
    return 'CHANGE_COMPONENT_QUANTITY';
  }

  if (
    normalized.includes('اعطيني مكونات') ||
    normalized.includes('بدي مكونات') ||
    normalized.includes('تعطيني مكونات') ||
    normalized.includes('اقترح المكونات') ||
    normalized.includes('show the components') ||
    normalized.includes('component list')
  ) {
    return 'REVISE_COMPONENT_LIST';
  }

  if (
    normalized.includes('بسط') ||
    normalized.includes('غير القائمه') ||
    normalized.includes('غير القائمة') ||
    normalized.includes('revise') ||
    normalized.includes('simpler list') ||
    (/(اضف|احذف|add|remove)/.test(normalized) && input.currentComponents.length > 0)
  ) {
    return 'REVISE_COMPONENT_LIST';
  }

  if (
    normalized.includes('؟') ||
    normalized.includes('?') ||
    normalized.includes('شو') ||
    normalized.includes('what') ||
    normalized.includes('how')
  ) {
    return lastAssistant ? 'ANSWER_PROJECT_QUESTION' : 'EXPLAIN_COMPONENT_LIST';
  }

  if (lastAssistant) {
    return 'ANSWER_PROJECT_QUESTION';
  }

  return 'CLARIFY_LEARNER_REQUEST';
};

const buildComponentListSummary = (components: SequentialComponent[]) =>
  components
    .map(
      (component) =>
        `- ${component.componentName} x${component.quantity} ${component.unit}${component.notes ? ` — ${component.notes}` : ''}`,
    )
    .join('\n');

const generateComponentConversationExplanation = async (input: {
  locale: AiLocale;
  comment: string;
  history: BoundedHistoryMessage[];
  context: ComponentListContext;
  currentComponents: SequentialComponent[];
  intent: ComponentComposerIntent;
}): Promise<string> => {
  const provider = getAiChatProvider();
  if (provider.name === 'disabled') {
    throw new AppError(
      input.locale === 'ar'
        ? 'مساعد الذكاء الاصطناعي غير متاح حاليًا.'
        : 'The AI assistant is currently unavailable.',
      503,
      'AI_DISABLED',
    );
  }

  const contextualMessage = [
    'You are helping a learner discuss an in-progress project component list.',
    'Answer only from the supplied project context and component list.',
    'Do not change the component list, do not save anything, and do not invent unrelated parts.',
    input.context.locale === 'ar'
      ? 'Respond in Arabic. Keep technical terms such as Arduino, LDR, LED, Breadboard, USB, and Threshold in English when natural.'
      : null,
    `Project idea: ${input.context.ideaText}`,
    `Current component list:\n${buildComponentListSummary(input.currentComponents)}`,
    input.intent === 'CONTINUE_PREVIOUS_RESPONSE'
      ? 'The learner sent a short follow-up. Continue your previous explanation with more detail.'
      : null,
    input.intent === 'SUGGEST_ALTERNATIVE'
      ? 'Suggest practical alternatives for the referenced component while keeping the project workable.'
      : null,
    `Learner message: ${input.comment}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const history =
    input.intent === 'CONTINUE_PREVIOUS_RESPONSE'
      ? input.history
      : input.history.slice(0, Math.max(0, input.history.length - 1));

  const answer = await provider.generateGeneralLearningAnswer({
    locale: input.context.locale,
    userMessage: contextualMessage,
    history,
    scopeClassification: 'DOMAIN_KNOWLEDGE',
  });

  const assistantText = (answer.data.blocks as unknown as AiContentBlock[])
    .map((block) => block as unknown as { type: string; text?: string })
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text!)
    .join('\n\n')
    .trim();

  if (!assistantText) {
    throw new AppError(
      input.locale === 'ar'
        ? 'تعذّر إنشاء شرح مناسب. حاول مرة أخرى.'
        : 'Could not generate a useful explanation. Please try again.',
      502,
      'AI_RESPONSE_INVALID',
    );
  }

  if (
    input.context.locale === 'ar' &&
    (assistantText.match(/[\u0600-\u06FF]/gu) ?? []).length < 6
  ) {
    throw new AppError(
      input.locale === 'ar'
        ? 'تعذّر إنشاء شرح عربي مناسب. حاول مرة أخرى.'
        : 'Could not generate an Arabic explanation. Please try again.',
      502,
      'AI_AUTHORING_LANGUAGE_MISMATCH',
    );
  }

  return assistantText;
};

const reviseComponentListFromComposerFeedback = async (input: {
  context: ComponentListContext;
  comment: string;
  currentComponents: SequentialComponent[];
}): Promise<{ components: SequentialComponent[]; assistantText: string }> => {
  const regexRevision = applyComponentRevisionFromComment(
    input.currentComponents,
    input.comment,
    input.context.locale,
  );
  if (regexRevision.components) {
    const validated = finalizeComponentList(
      input.context,
      regexRevision.components,
      input.context.locale === 'ar'
        ? 'حدّثت قائمة المكوّنات بناءً على طلبك. راجع الاقتراح قبل الحفظ.'
        : 'I updated the component list based on your request. Review the proposal before saving.',
    );
    return {
      components: validated.components,
      assistantText:
        regexRevision.assistantNote ??
        (input.context.locale === 'ar'
          ? 'حدّثت قائمة المكوّنات بناءً على طلبك. راجع الاقتراح قبل الحفظ.'
          : 'I updated the component list based on your request. Review the proposal before saving.'),
    };
  }

  const generated = await generateSequentialComponentListWithRepair({
    ...input.context,
    feedback: `${input.comment}\n\nRevise the current component list. Keep the project circuit-complete, obey exclusions, avoid duplicates, and return the full revised list.\n\nCurrent list:\n${buildComponentListSummary(input.currentComponents)}`,
    previousComponents: input.currentComponents,
  });

  return {
    components: generated.components,
    assistantText:
      generated.explanation?.trim() ||
      (input.context.locale === 'ar'
        ? 'حدّثت قائمة المكوّنات بناءً على طلبك. راجع الاقتراح قبل الحفظ.'
        : 'I updated the component list based on your request. Review the proposal before saving.'),
  };
};

export const processComponentStageComposerMessage = async (input: {
  comment: string;
  context: ComponentListContext;
  currentComponents: SequentialComponent[];
  history: BoundedHistoryMessage[];
  project: ProjectRecord;
}): Promise<ComponentStageComposerResult> => {
  const intent = resolveComponentComposerIntent({
    comment: input.comment,
    history: input.history,
    currentComponents: input.currentComponents,
  });

  if (
    intent === 'EXPLAIN_COMPONENT' ||
    intent === 'EXPLAIN_COMPONENT_LIST' ||
    intent === 'ANSWER_PROJECT_QUESTION' ||
    intent === 'CONTINUE_PREVIOUS_RESPONSE' ||
    intent === 'SUGGEST_ALTERNATIVE'
  ) {
    const assistantText = await generateComponentConversationExplanation({
      locale: input.context.locale,
      comment: input.comment,
      history: input.history,
      context: input.context,
      currentComponents: input.currentComponents,
      intent,
    });
    return { kind: 'EXPLANATION', assistantText };
  }

  if (intent === 'CLARIFY_LEARNER_REQUEST') {
    return {
      kind: 'FOLLOW_UP',
      assistantText:
        input.context.locale === 'ar'
          ? 'هل تريد شرحًا عن مكوّن معيّن، تعديل القائمة الحالية، أم اقتراح قائمة كاملة؟'
          : 'Do you want an explanation about a specific component, a revision to the current list, or a complete list?',
    };
  }

  if (input.currentComponents.length === 0) {
    const generated = await generateSequentialComponentListWithRepair(input.context);
    return {
      kind: 'REVISED_LIST',
      assistantText: generated.explanation,
      components: generated.components,
    };
  }

  const revised = await reviseComponentListFromComposerFeedback({
    context: input.context,
    comment: input.comment,
    currentComponents: input.currentComponents,
  });
  return {
    kind: 'REVISED_LIST',
    assistantText: revised.assistantText,
    components: revised.components,
  };
};

export const classifyComponentStageIntent = (comment: string): ComponentStageIntent => {
  const normalized = normalizeText(comment);

  const showListPatterns = [
    'اعطيني مكونات',
    'بدي مكونات',
    'تعطيني مكونات',
    'بدي تعطيني',
    'اقترح المكونات',
    'شو بلزمني',
    'اعرضلي القائمه',
    'اعرضلي القائمة',
    'ما بدي اغير',
    'بدي اشوف المكونات',
    'give me the project components',
    'suggest the component list',
    'what components do i need',
    'show the full list',
    'show me the components',
    'component list',
  ];
  if (showListPatterns.some((pattern) => normalized.includes(pattern))) {
    return 'SHOW_OR_GENERATE_FULL_LIST';
  }

  if (
    /^(ليش|لماذا|why|how come)\b/.test(normalized) ||
    normalized.includes('ليش بحتاج') ||
    normalized.includes('why do i need')
  ) {
    return 'EXPLANATION';
  }

  if (
    normalized.includes('احذف') ||
    normalized.includes('ازل') ||
    normalized.includes('remove') ||
    normalized.includes('delete') ||
    normalized.includes('بدون') ||
    normalized.includes('without')
  ) {
    return 'REVISION';
  }

  return 'OTHER';
};

const buildListReply = (
  input: ComponentFeedbackContext,
  components: SequentialComponent[],
  replyType: 'COMPONENT_LIST' | 'REVISED_COMPONENT_LIST',
  assistantNote?: string,
): ComponentStageReply => {
  const names = components.map((component) => component.componentName).join(', ');
  const prefix =
    assistantNote ??
    (input.locale === 'ar'
      ? `إليك قائمة المكوّنات المقترحة:\n\n${names}`
      : `Here is the proposed component list:\n\n${names}`);
  return componentStageReplySchema.parse({
    replyType,
    assistantText: prefix,
    components,
  });
};

export const generateComponentStageReply = async (
  input: ComponentFeedbackContext,
): Promise<ComponentStageReply> => {
  const intent = input.intent === 'OTHER'
    ? classifyComponentStageIntent(input.comment)
    : input.intent;

  if (intent === 'SHOW_OR_GENERATE_FULL_LIST') {
    if (input.currentComponents.length > 0) {
      return buildListReply(input, input.currentComponents, 'COMPONENT_LIST');
    }
    const generated = await generateSequentialComponentListWithRepair(input);
    return buildListReply(input, generated.components, 'COMPONENT_LIST');
  }

  if (intent === 'EXPLANATION') {
    const normalized = normalizeText(input.comment);
    const target =
      input.currentComponents.find((component) =>
        normalized.includes(normalizeText(component.componentName)),
      ) ??
      input.currentComponents.find((component) =>
        /resistor|مقاومه|مقاومة/.test(normalized),
      );
    const explanation = target?.notes
      ? target.notes
      : input.locale === 'ar'
        ? 'كل مكوّن يساعد على إكمال مشروعك بأمان وفق الفكرة الحالية.'
        : 'Each component helps complete your project safely for the current idea.';
    return componentStageReplySchema.parse({
      replyType: 'COMPONENT_EXPLANATION',
      assistantText: explanation,
    });
  }

  if (intent === 'REVISION' || intent === 'OTHER') {
    const revision = applyComponentRevisionFromComment(
      input.currentComponents,
      input.comment,
      input.locale,
    );
    if (revision.components) {
      return buildListReply(
        input,
        revision.components,
        'REVISED_COMPONENT_LIST',
        revision.assistantNote,
      );
    }
    if (intent === 'REVISION') {
      const normalized = normalizeText(input.comment);
      let revised = [...input.currentComponents];
      if (/pump|مضخه|مضخة/.test(normalized)) {
        revised = revised.filter(
          (component) => !/pump|مضخه|مضخة/i.test(component.componentName),
        );
      }
      if (/relay|ريلاي/.test(normalized)) {
        revised = revised.filter(
          (component) => !/relay|ريلاي/i.test(component.componentName),
        );
      }
      revised = validateComponentList(revised);
      return buildListReply(input, revised, 'REVISED_COMPONENT_LIST');
    }
  }

  throw new AppError(
    input.locale === 'ar'
      ? 'هل تريد قائمة مكوّنات كاملة أم مساعدة في تعديل القائمة الحالية؟'
      : 'Do you want a complete component list or help changing the current list?',
    400,
    'AI_COMPONENT_INTENT_UNCLEAR',
  );
};

export const validateComponentStageReply = (reply: ComponentStageReply) => {
  const parsed = componentStageReplySchema.parse(reply);
  if (GENERIC_COMPONENT_ACK_PATTERNS.some((pattern) => pattern.test(parsed.assistantText))) {
    throw new AppError(
      'Component response was too generic.',
      502,
      'AI_COMPONENT_PROPOSAL_INVALID',
    );
  }
  if (
    (parsed.replyType === 'COMPONENT_LIST' ||
      parsed.replyType === 'REVISED_COMPONENT_LIST') &&
    parsed.components.length === 0
  ) {
    throw new AppError(
      'Component list was empty.',
      502,
      'AI_COMPONENT_PROPOSAL_INVALID',
    );
  }
  return parsed;
};
