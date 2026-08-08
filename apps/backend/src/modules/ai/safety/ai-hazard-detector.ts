import {
  PHYSICAL_HAZARD_DEFINITIONS,
  type PhysicalHazardAssessment,
  type PhysicalHazardCategory,
  type PhysicalHazardMatch,
} from './ai-hazard-taxonomy.js';

export const normalizeHazardText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const LEGITIMATE_SAFETY_PATTERNS: RegExp[] = [
  /(safety precaution|safe way|how to safely|safely use|safety tips|احتياطات|بأمان|سلامة|بشكل آمن|آمنة|بطريقة آمنة)/u,
];

type HazardRule = {
  id: string;
  category: PhysicalHazardCategory;
  pattern: RegExp;
  blocksWhenMatched?: boolean;
};

const TOPIC_RULES: HazardRule[] = [
  {
    id: 'household_electricity',
    category: 'ELECTRICAL_MAINS',
    pattern:
      /(كهربا\s*البيت|كهرباء\s*المنزل|كهرباء\s*البيت|كهربا\s*المنزل|home\s+electricity|house\s+electricity|household\s+electricity|wall\s+outlet|فيشة\s*الحيط|power\s+outlet|mains)/u,
  },
  {
    id: 'mains_voltage',
    category: 'ELECTRICAL_MAINS',
    pattern: /(220|230|240).{0,30}(volt|فولت|موتور|motor|direct|مباشرة)/u,
  },
  {
    id: 'wires_to_mains',
    category: 'ELECTRICAL_MAINS',
    pattern: /(سلك|سلكين|أسلاك|wire|wires).{0,40}(كهربا|كهرباء|mains|220|البيت|المنزل|outlet)/u,
  },
  {
    id: 'direct_mains_load',
    category: 'ELECTRICAL_MAINS',
    pattern:
      /(تشغيل|اشغل|أشغل|شغل|تشغيلي).{0,40}(موتور|motor|led|لامبة|محرك).{0,40}(كهربا|كهرباء|mains|220|البيت|المنزل|direct)/u,
  },
  {
    id: 'battery_topic',
    category: 'BATTERY',
    pattern:
      /(battery|batteries|cell pack|aa\b|aaa\b|lithium|li ion|li po|بطارية|بطاريات|خلايا)/u,
  },
  {
    id: 'lithium_topic',
    category: 'BATTERY',
    pattern: /(lithium|li ion|li po|ليثيوم)/u,
  },
  {
    id: 'power_source_topic',
    category: 'BATTERY',
    pattern: /(power source|usb power|battery pack|مصدر طاقة|طاقة usb)/u,
  },
  {
    id: 'heat_tools_topic',
    category: 'HEAT_BURN',
    pattern:
      /(hot glue|glue gun|soldering iron|heat gun|iron tip|مسدس شمع|لصق حراري|صمغ حراري|كاوية|كاويه|لحام|سخن)/u,
  },
  {
    id: 'flame_topic',
    category: 'HEAT_BURN',
    pattern: /(flame|burn|melting wax|candle wax|شمع|حرارة|اشتعال)/u,
  },
  {
    id: 'sharp_tools_topic',
    category: 'SHARP_CUT',
    pattern:
      /(scissors|craft knife|utility knife|box cutter|blade|منشار|مقص|سكين|شفرة|حاد)/u,
  },
  {
    id: 'cutting_topic',
    category: 'SHARP_CUT',
    pattern: /(cutting tool|cut cardboard|قص|قطع)/u,
  },
  {
    id: 'adhesive_topic',
    category: 'ADHESIVE_CHEMICAL',
    pattern: /(glue|adhesive|epoxy|super glue|غراء|لاصق|صمغ)/u,
  },
  {
    id: 'solvent_topic',
    category: 'SOLVENT_VOC',
    pattern:
      /(solvent|acetone|thinner|paint thinner|isopropyl|alcohol cleaner|مذيب|اسيتون|مذيبات)/u,
  },
  {
    id: 'power_tools_topic',
    category: 'TOOL_MISUSE',
    pattern: /(drill|saw|circular saw|table saw|power tool|مثقب|منشار|أداة كهربائية)/u,
  },
];

const BLOCKING_RULES: HazardRule[] = [
  {
    id: 'bypass_protection',
    category: 'ELECTRICAL_MAINS',
    pattern:
      /(bypass|remove|disable|الغ(?:ي|اء)|ازل|أزل).{0,40}(protection|fuse|breaker|ground|earthing|حماية|قاطع)/u,
    blocksWhenMatched: true,
  },
  {
    id: 'unsafe_mains_en',
    category: 'ELECTRICAL_MAINS',
    pattern:
      /(connect|wire|plug|attach).{0,40}(direct(?:ly)?|without).{0,40}(mains|220|230|240|home electricity|wall outlet)/u,
    blocksWhenMatched: true,
  },
  {
    id: 'unsafe_mains_ar_connect',
    category: 'ELECTRICAL_MAINS',
    pattern: /(اوصل|أوصل|وصل|شبك|أشبك).{0,50}(كهربا|كهرباء|البيت|المنزل|220|230|240|mains|الفيش|فيشة)/u,
    blocksWhenMatched: true,
  },
  {
    id: 'unsafe_mains_ar_direct',
    category: 'ELECTRICAL_MAINS',
    pattern: /(اوصل|أوصل|وصل|شبك|أشبك).{0,40}(مباشرة|مباشر|directly|without protection)/u,
    blocksWhenMatched: true,
  },
  {
    id: 'battery_short_or_puncture',
    category: 'BATTERY',
    pattern:
      /(short(?:\s|circuit)?|puncture|stab|pierce|crush).{0,40}(battery|cell|lithium|li ion|li po|بطارية|ليثيوم)/u,
    blocksWhenMatched: true,
  },
  {
    id: 'battery_bypass_bms',
    category: 'BATTERY',
    pattern:
      /(bypass|remove|disable|الغ(?:ي|اء)|ازل|أزل).{0,40}(bms|battery management|protection board|لوحة حماية|حماية البطارية)/u,
    blocksWhenMatched: true,
  },
  {
    id: 'charge_non_rechargeable',
    category: 'BATTERY',
    pattern:
      /(charge|شحن).{0,40}(non rechargeable|not rechargeable|alkaline|aa batteries|aaa batteries|aa cells|aaa cells|بطارية قلوية|غير قابلة للشحن)/u,
    blocksWhenMatched: true,
  },
  {
    id: 'tool_guard_removal',
    category: 'TOOL_MISUSE',
    pattern:
      /(remove|disable|bypass|take off|الغ(?:ي|اء)|ازل|أزل|أزيل|ازيل|شيل).{0,40}(guard|safety interlock|blade guard|حماية|قفل أمان|حاجز)/u,
    blocksWhenMatched: true,
  },
  {
    id: 'dangerous_solvent_mix',
    category: 'SOLVENT_VOC',
    pattern:
      /(mix|combine|امزج|اخلط).{0,40}(bleach|chlorine|ammonia|كلور|تبييض|امونيا).{0,40}(acetone|alcohol|solvent|مذيب|اسيتون)/u,
    blocksWhenMatched: true,
  },
];

const matchRules = (
  normalized: string,
  rules: HazardRule[],
  onlyBlocking = false,
): PhysicalHazardMatch[] => {
  const matches: PhysicalHazardMatch[] = [];

  for (const rule of rules) {
    if (onlyBlocking && !rule.blocksWhenMatched) {
      continue;
    }
    if (!rule.pattern.test(normalized)) {
      continue;
    }

    const definition = PHYSICAL_HAZARD_DEFINITIONS[rule.category];
    matches.push({
      category: rule.category,
      severity: definition.severity,
      matchedRule: rule.id,
    });
  }

  return matches;
};

const hasDirectMainsCompositeCue = (normalized: string): boolean =>
  /(مباشرة|مباشر|directly|without protection|بدون حماية)/u.test(normalized) &&
  /(كهربا|كهرباء|mains|220|البيت|المنزل|outlet|فيش)/u.test(normalized);

const hasWiringMainsCompositeCue = (normalized: string): boolean =>
  /(اوصل|أوصل|وصل|شبك|wire|plug|connect)/u.test(normalized) &&
  /(كهربا|كهرباء|mains|220|البيت|المنزل|outlet|فيش|سلك|household|home electricity)/u.test(
    normalized,
  );

const dedupeHazards = (hazards: PhysicalHazardMatch[]): PhysicalHazardMatch[] => {
  const seen = new Set<string>();
  const deduped: PhysicalHazardMatch[] = [];

  for (const hazard of hazards) {
    const key = `${hazard.category}:${hazard.matchedRule}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(hazard);
  }

  return deduped;
};

export const assessPhysicalHazards = (text: string): PhysicalHazardAssessment => {
  const normalized = normalizeHazardText(text);
  const legitimateSafety = LEGITIMATE_SAFETY_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );

  const topicMatches = matchRules(normalized, TOPIC_RULES);
  const blockingMatches = matchRules(normalized, BLOCKING_RULES, true);
  const hazards = dedupeHazards([...topicMatches, ...blockingMatches]);

  const blockReasons: string[] = blockingMatches.map((match) => match.matchedRule);

  if (!legitimateSafety && hasDirectMainsCompositeCue(normalized)) {
    blockReasons.push('direct_mains_composite');
    hazards.push({
      category: 'ELECTRICAL_MAINS',
      severity: 'HIGH',
      matchedRule: 'direct_mains_composite',
    });
  }

  if (!legitimateSafety && hasWiringMainsCompositeCue(normalized)) {
    blockReasons.push('wiring_mains_composite');
    hazards.push({
      category: 'ELECTRICAL_MAINS',
      severity: 'HIGH',
      matchedRule: 'wiring_mains_composite',
    });
  }

  const dedupedHazards = dedupeHazards(hazards);
  const categories = [...new Set(dedupedHazards.map((hazard) => hazard.category))];
  const requiredPrecautions = {
    en: categories.map((category) => PHYSICAL_HAZARD_DEFINITIONS[category].precautions.en),
    ar: categories.map((category) => PHYSICAL_HAZARD_DEFINITIONS[category].precautions.ar),
  };

  const shouldBlock =
    !legitimateSafety &&
    (blockReasons.length > 0 ||
      blockingMatches.some(
        (match) => PHYSICAL_HAZARD_DEFINITIONS[match.category].blockWhenActionable,
      ));

  return {
    hazards: dedupedHazards,
    categories,
    requiredPrecautions,
    shouldBlock,
    blockReasons: [...new Set(blockReasons)],
  };
};
