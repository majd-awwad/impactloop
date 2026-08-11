import { createHash } from "node:crypto";

import { COMMUNITY_DEMO_PEOPLE } from "../community-demo-people.data.js";
import type { CanonicalCommunityMaterial } from "./load-canonical-materials.js";

export type MaterialCondition =
  | "NEW"
  | "LIKE_NEW"
  | "GOOD"
  | "USED"
  | "NEEDS_REPAIR";

export type ResolvedCommunityMaterial = CanonicalCommunityMaterial & {
  provenanceOwnerEmail: string;
  displayTitle: string;
  resolvedMaterialType: string;
  resolvedCondition: MaterialCondition;
  resolvedConditionBasis: string;
  resolvedDescription: string;
  resolvedSuggestedUses: string;
  resolvedOwnerEmail: string;
  createdAt: Date;
  qualityNotes: string[];
  managedTags: string[];
};

type SupplierPoolMember = {
  email: string;
  kind: "ORGANIZATION" | "INDIVIDUAL";
  city: string;
  preferred: string;
  name: string;
};

const hash01 = (value: string): number => {
  const digest = createHash("sha256").update(value).digest();
  return digest.readUInt32BE(0) / 0xffffffff;
};

const titleCaseWord = (word: string): string => {
  if (/^[A-Z0-9-]{2,}$/.test(word)) return word;
  if (/^(esp32|nema\d*|hc-sr04|sg90|mg996r|dc|ac|usb|lcd|tft|pid|pwm)$/i.test(word)) {
    return word.toUpperCase();
  }
  if (word.length <= 1) return word.toUpperCase();
  return word[0]!.toUpperCase() + word.slice(1);
};

const cleanSpacing = (value: string): string =>
  value.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();

/** Move trailing Arabic parenthetical notes out of titles when mixed with English. */
const extractArabicTitleNote = (
  title: string,
): { title: string; note: string | null } => {
  const match = title.match(/^(.*?)(\s*[\(（][^)\n]*[\u0600-\u06FF][^)\n]*[\)）]\s*)$/u);
  if (match) {
    return { title: cleanSpacing(match[1]!), note: cleanSpacing(match[2]!) };
  }
  return { title, note: null };
};

const TITLE_OVERRIDES: Record<string, string> = {
  "mat-149": "1-Channel Relay Module",
  "mat-150": "2-Channel Relay Module",
  "mat-040": "4-Channel Relay Module (3 channels working)",
  "mat-176": "Heatsink",
  "mat-218": "DC Motor + Press + H-Bridge Assembly",
  "mat-194": "Raspberry Pi Kit (Heatsink, Flash, SD Card, Cable)",
  "mat-084": "Arduino Uno R3 (Pin 9 Broken)",
  "mat-242": "DS18B20 Waterproof Temperature Sensor",
  "mat-211": "Connectors Assortment",
  "mat-226": "IR Sensor",
  "mat-173": "1-Channel Relay",
  "mat-174": "2-Channel Relay",
  "mat-019": "1-Channel Relay",
  "mat-020": "4-Channel Relay",
};

const TYPE_OVERRIDES: Record<
  string,
  { type: string; reason: string; unit?: string }
> = {
  "mat-194": {
    type: "Raspberry Pi Kit",
    reason: "Bundle is a Raspberry Pi kit, not a heatsink component.",
  },
  "mat-218": {
    type: "DC Drive Assembly",
    reason: "Title describes DC + press + H-bridge as one assembly/bundle.",
    unit: "sets",
  },
  "mat-072": {
    type: "Shaft Coupler",
    reason: "Brass shaft hex coupler is not a generic connector.",
  },
};

/** Collapse CSV material-type labels into shared taxonomy names. */
const TYPE_CONSOLIDATION: Record<string, string> = {
  "arduino uno": "Arduino Uno",
  "arduino uno r3": "Arduino Uno",
  "arduino": "Arduino Uno",
  "raspberry pi": "Raspberry Pi",
  "raspberry pi 4": "Raspberry Pi",
  heatsink: "Heatsink",
  "heat sink": "Heatsink",
  "relay module": "Relay Module",
  relay: "Relay Module",
  "1 channel relay": "Relay Module",
  "4 channel relay": "Relay Module",
  "h-bridge motor driver": "H-Bridge Motor Driver",
  "h bridge motor driver": "H-Bridge Motor Driver",
  "l298n": "H-Bridge Motor Driver",
  "servo motor": "Servo Motor",
  servo: "Servo Motor",
  "dc motor": "DC Motor",
  "stepper motor": "Stepper Motor",
  "ultrasonic sensor": "Ultrasonic Sensor",
  ultrasonic: "Ultrasonic Sensor",
  "3d-printed part": "3D-Printed Part",
  "3d printed part": "3D-Printed Part",
};

const evidenceCondition = (
  material: CanonicalCommunityMaterial,
): { condition: MaterialCondition; basis: string } | null => {
  const blob = [
    material.title,
    material.descriptionDraft,
    material.sourceNote,
    material.originalPriceRaw,
  ]
    .join(" ")
    .toLowerCase();

  if (
    material.condition === "NEEDS_REPAIR" ||
    material.conditionBasis === "SOURCE_TEXT_DAMAGE" ||
    /\b(broken|damaged|not working|doesn't work|does not work|معطوب|تالف|خربان)\b/i.test(
      blob,
    ) ||
    /\bonly working\b|\b\d+\s*only working\b|\bchnnel relay \(3 only working\)/i.test(
      blob,
    )
  ) {
    return { condition: "NEEDS_REPAIR", basis: "QA_EVIDENCE_DAMAGE" };
  }

  if (
    material.condition === "USED" ||
    material.conditionBasis === "SOURCE_TEXT_USED_OR_REPAIRED" ||
    /\b(used|re-?railed|repaired|worn|salvaged|مستعمل)\b/i.test(blob)
  ) {
    return { condition: "USED", basis: "QA_EVIDENCE_USED" };
  }

  if (
    material.condition === "LIKE_NEW" ||
    material.conditionBasis === "SOURCE_TEXT_ALMOST_UNUSED" ||
    /\b(almost unused|like new|nearly new|شبه جديد)\b/i.test(blob)
  ) {
    return { condition: "LIKE_NEW", basis: "QA_EVIDENCE_LIKE_NEW" };
  }

  if (/\b(brand new|new sealed|unused|جديد)\b/i.test(blob)) {
    return { condition: "NEW", basis: "QA_EVIDENCE_NEW" };
  }

  return null;
};

/**
 * Controlled demo distribution for rows that only had DEMO_DEFAULT_GOOD.
 * Deterministic by seed key — not blind random.
 */
const demoCondition = (seedKey: string): { condition: MaterialCondition; basis: string } => {
  const bucket = hash01(`condition:${seedKey}`);
  if (bucket < 0.06) return { condition: "NEW", basis: "QA_DEMO_DISTRIBUTION_NEW" };
  if (bucket < 0.18) return { condition: "LIKE_NEW", basis: "QA_DEMO_DISTRIBUTION_LIKE_NEW" };
  if (bucket < 0.63) return { condition: "GOOD", basis: "QA_DEMO_DISTRIBUTION_GOOD" };
  if (bucket < 0.9) return { condition: "USED", basis: "QA_DEMO_DISTRIBUTION_USED" };
  return { condition: "NEEDS_REPAIR", basis: "QA_DEMO_DISTRIBUTION_NEEDS_REPAIR" };
};

const resolveTitle = (
  material: CanonicalCommunityMaterial,
): { title: string; movedNote: string | null; notes: string[] } => {
  const notes: string[] = [];
  if (TITLE_OVERRIDES[material.seedKey]) {
    notes.push(`title_override:${material.seedKey}`);
    return { title: TITLE_OVERRIDES[material.seedKey]!, movedNote: null, notes };
  }

  let title = material.title.trim();
  const extracted = extractArabicTitleNote(title);
  title = extracted.title;
  if (extracted.note) notes.push("moved_arabic_parenthetical_from_title");

  title = title
    .replace(/\bchanel\b/gi, "channel")
    .replace(/\bchnnel\b/gi, "channel")
    .replace(/\bconnecters\b/gi, "connectors")
    .replace(/\btempruter\b/gi, "temperature")
    .replace(/\s*\.\s*$/g, "");

  // Light capitalization cleanup for all-lowercase short titles.
  if (title === title.toLowerCase() && title.length < 48 && !/[\u0600-\u06FF]/.test(title)) {
    title = title.split(" ").map(titleCaseWord).join(" ");
    notes.push("title_case_normalized");
  }

  title = cleanSpacing(title);
  return { title, movedNote: extracted.note, notes };
};

const resolveMaterialType = (
  material: CanonicalCommunityMaterial,
): { type: string; notes: string[]; unit?: string } => {
  const override = TYPE_OVERRIDES[material.seedKey];
  if (override) {
    return {
      type: override.type,
      notes: [`type_override:${override.reason}`],
      unit: override.unit,
    };
  }

  const normalized = material.materialType.trim().toLowerCase();
  const consolidated = TYPE_CONSOLIDATION[normalized];
  if (consolidated && consolidated !== material.materialType) {
    return {
      type: consolidated,
      notes: [`type_consolidated_from:${material.materialType}`],
    };
  }

  return { type: material.materialType, notes: [] };
};

const buildMarketplaceDescription = (
  material: CanonicalCommunityMaterial,
  input: {
    title: string;
    materialType: string;
    condition: MaterialCondition;
    movedNote: string | null;
    unit: string;
  },
): { description: string; generated: boolean } => {
  const parts: string[] = [];
  const sourceNote = material.sourceNote.trim();
  const original = material.descriptionDraft.trim();
  const isBoilerplate =
    /Reusable .+ listing prepared from documented graduation-project hardware data/i.test(
      original,
    ) || original.length === 0;

  parts.push(
    `${input.title} listed for reuse in learning and maker projects.`,
  );

  parts.push(
    `Type: ${input.materialType}. Quantity: ${material.quantity} ${input.unit}. Condition: ${input.condition.replaceAll("_", " ").toLowerCase()}.`,
  );

  if (material.isFree) {
    if (/free with/i.test(material.originalPriceRaw) || /PROMOTED_CONDITIONAL_FREE/i.test(material.pricingResolution)) {
      parts.push(
        "Offered as a standalone free demo listing. Original source notes mentioned conditional free-with-other-components pricing; ImpactLoop stores this as a normal free item.",
      );
    } else {
      parts.push("Offered free for learners.");
    }
  } else {
    parts.push(`Price: ${material.priceNis} NIS.`);
  }

  if (sourceNote) {
    parts.push(`Supplier note: ${sourceNote}`);
  }
  if (input.movedNote) {
    parts.push(`Extra detail from source title: ${input.movedNote}`);
  }

  if (!isBoilerplate && original && !original.startsWith("Reusable ")) {
    parts.push(original);
  } else if (original.includes("Source note:")) {
    // keep any embedded source note already present
  }

  return { description: parts.join(" "), generated: true };
};

const buildSuggestedUses = (
  material: CanonicalCommunityMaterial,
  materialType: string,
): string => {
  if (
    material.suggestedUses.trim() &&
    !/^Repair, prototyping, maker projects/i.test(material.suggestedUses)
  ) {
    return material.suggestedUses.trim();
  }

  const type = materialType.toLowerCase();
  if (type.includes("arduino") || type.includes("esp32") || type.includes("raspberry")) {
    return "Microcontroller labs, sensor prototypes, robotics controllers, classroom demos.";
  }
  if (type.includes("motor") || type.includes("servo") || type.includes("stepper")) {
    return "Robot motion, mechanisms, automation prototypes, maker builds.";
  }
  if (type.includes("sensor")) {
    return "Measurement demos, obstacle detection, environmental sensing, student labs.";
  }
  if (type.includes("relay") || type.includes("driver") || type.includes("h-bridge")) {
    return "Load switching, motor control, automation, power interface circuits.";
  }
  return "Repair, prototyping, maker projects, and practical learning builds.";
};

const ELECTRONICS_HINT =
  /إلكترون|electron|arduino|esp|raspberry|sensor|relay|motor|battery|wire|pcb|micro/i;
const WOOD_HINT = /خشب|wood|board|frame|mdf/i;
const BUILD_HINT = /بناء|metal|acrylic|plastic|wheel|screw|tool|hardware|مواد/i;

const affinityScore = (
  supplier: SupplierPoolMember,
  material: CanonicalCommunityMaterial,
): number => {
  let score = 1;
  const preferred = supplier.preferred;
  const hay = `${material.categoryKey} ${material.materialType} ${material.title}`;

  if (ELECTRONICS_HINT.test(preferred) && /electronics|motors|power/i.test(material.categoryKey)) {
    score += 3;
  }
  if (WOOD_HINT.test(preferred) && /wood|plastics|other/i.test(material.categoryKey)) {
    score += 2;
  }
  if (BUILD_HINT.test(preferred) && /metal|tools|other|plastics/i.test(material.categoryKey)) {
    score += 2;
  }
  // Soft only — never zero out cross-category ownership.
  if (supplier.kind === "ORGANIZATION") score += 0.5;
  if (supplier.city === material.ownerCity) score += 0.75;
  void hay;
  return score;
};

const buildSupplierPool = (): SupplierPoolMember[] => {
  return COMMUNITY_DEMO_PEOPLE.filter(
    (person) => person.platformRole === "SUPPLIER",
  ).map((person) => {
    const record = person as {
      email: string;
      supplierKind: string;
      city: string;
      preferredCategory: string;
      publicName: string;
      displayName: string;
    };
    return {
      email: record.email,
      kind: record.supplierKind === "ORGANIZATION" ? "ORGANIZATION" : "INDIVIDUAL",
      city: record.city,
      preferred: record.preferredCategory,
      name: record.publicName || record.displayName,
    };
  });
};

/**
 * Spread ownership across ~28 active suppliers while keeping soft affinity.
 * Provenance owner remains on the resolved object for audit.
 */
export const buildOwnerRedistribution = (
  materials: CanonicalCommunityMaterial[],
): Map<string, string> => {
  const suppliers = buildSupplierPool();
  const targetActive = 28;
  const ranked = [...suppliers].sort((a, b) => {
    const orgBias = Number(b.kind === "ORGANIZATION") - Number(a.kind === "ORGANIZATION");
    if (orgBias !== 0) return orgBias;
    return a.email.localeCompare(b.email);
  });

  // Always include original provenance owners so sync stays local-friendly,
  // then fill up to targetActive with additional suppliers.
  const active = new Map<string, SupplierPoolMember>();
  for (const material of materials) {
    const match = suppliers.find((s) => s.email === material.ownerEmail);
    if (match) active.set(match.email, match);
  }
  for (const supplier of ranked) {
    if (active.size >= targetActive) break;
    active.set(supplier.email, supplier);
  }

  const activeList = [...active.values()];
  const counts = new Map<string, number>(activeList.map((s) => [s.email, 0]));
  const maxFor = (supplier: SupplierPoolMember) =>
    supplier.kind === "ORGANIZATION" ? 14 : 7;

  const assignment = new Map<string, string>();
  const sortedMaterials = [...materials].sort((a, b) =>
    a.seedKey.localeCompare(b.seedKey),
  );

  for (const material of sortedMaterials) {
    const scored = activeList
      .map((supplier) => {
        const count = counts.get(supplier.email) ?? 0;
        const capacityPenalty = count >= maxFor(supplier) ? -50 : -count * 0.35;
        const jitter = hash01(`owner:${material.seedKey}:${supplier.email}`) * 0.4;
        return {
          supplier,
          score: affinityScore(supplier, material) + capacityPenalty + jitter,
        };
      })
      .sort((a, b) => b.score - a.score);

    const chosen = scored[0]!.supplier.email;
    assignment.set(material.seedKey, chosen);
    counts.set(chosen, (counts.get(chosen) ?? 0) + 1);
  }

  return assignment;
};

const resolveCreatedAt = (seedKey: string): Date => {
  // Spread across the last 18 days, deterministic per seed key.
  const daysBack = Math.floor(hash01(`createdAt:${seedKey}`) * 18);
  const hour = Math.floor(hash01(`hour:${seedKey}`) * 14) + 8;
  const minute = Math.floor(hash01(`minute:${seedKey}`) * 60);
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysBack);
  date.setUTCHours(hour, minute, Math.floor(hash01(`sec:${seedKey}`) * 50), 0);
  return date;
};

export const applyCommunityMaterialQuality = (
  materials: CanonicalCommunityMaterial[],
): ResolvedCommunityMaterial[] => {
  const ownerMap = buildOwnerRedistribution(materials);

  return materials.map((material) => {
    const qualityNotes: string[] = [];
    const titleInfo = resolveTitle(material);
    qualityNotes.push(...titleInfo.notes);

    const typeInfo = resolveMaterialType(material);
    qualityNotes.push(...typeInfo.notes);

    const evidenced = evidenceCondition(material);
    const conditionInfo =
      evidenced ??
      (material.conditionBasis === "DEMO_DEFAULT_GOOD"
        ? demoCondition(material.seedKey)
        : {
            condition: material.condition,
            basis: material.conditionBasis || "SOURCE",
          });
    if (!evidenced && material.conditionBasis === "DEMO_DEFAULT_GOOD") {
      qualityNotes.push("condition_redistributed_from_demo_default_good");
    }

    const descriptionInfo = buildMarketplaceDescription(material, {
      title: titleInfo.title,
      materialType: typeInfo.type,
      condition: conditionInfo.condition,
      movedNote: titleInfo.movedNote,
      unit: typeInfo.unit ?? material.unitNormalized,
    });

    const suggestedUses = buildSuggestedUses(material, typeInfo.type);
    const resolvedOwnerEmail =
      ownerMap.get(material.seedKey) ?? material.ownerEmail;
    if (resolvedOwnerEmail !== material.ownerEmail) {
      qualityNotes.push(
        `owner_redistributed_from:${material.ownerEmail}`,
      );
    }

    const managedTags = [
      ...new Set(
        [
          ...material.tags.filter((tag) => !tag.startsWith("il-demo-mat:")),
          material.categoryKey,
          typeInfo.type.toLowerCase().replace(/\s+/g, "_"),
        ].filter(Boolean),
      ),
    ];

    return {
      ...material,
      provenanceOwnerEmail: material.ownerEmail,
      displayTitle: titleInfo.title,
      resolvedMaterialType: typeInfo.type,
      resolvedCondition: conditionInfo.condition,
      resolvedConditionBasis: conditionInfo.basis,
      resolvedDescription: descriptionInfo.description,
      resolvedSuggestedUses: suggestedUses,
      resolvedOwnerEmail,
      unitNormalized: typeInfo.unit ?? material.unitNormalized,
      createdAt: resolveCreatedAt(material.seedKey),
      qualityNotes,
      managedTags,
      generatedFields: [
        ...material.generatedFields,
        "displayTitle",
        "resolvedDescription",
        "resolvedCondition",
        "resolvedOwnerEmail",
        "createdAt",
      ],
    };
  });
};

export const summarizeQuality = (materials: ResolvedCommunityMaterial[]) => {
  const conditions: Record<string, number> = {};
  const owners: Record<string, number> = {};
  const types = new Set<string>();
  for (const material of materials) {
    conditions[material.resolvedCondition] =
      (conditions[material.resolvedCondition] ?? 0) + 1;
    owners[material.resolvedOwnerEmail] =
      (owners[material.resolvedOwnerEmail] ?? 0) + 1;
    types.add(material.resolvedMaterialType);
  }
  return {
    conditions,
    activeOwners: Object.keys(owners).length,
    ownerCounts: owners,
    distinctTypes: types.size,
  };
};
