/**
 * TAX-01 production resolution matrix against the live DB catalog.
 *
 * Read-only matcher QA. Does not create materials, delete aliases, or call
 * ensureProductionMaterialTypeAliases. Canonical alias ensure/repair belongs in
 * `demo:seed:materials` (and related seed paths).
 */
import { prisma } from '../../../src/database/prisma.js';
import { matchMaterialReference } from '../../../src/services/material-reference-matching.service.js';
import {
  compactMaterialReferenceText,
  normalizeMaterialReferenceText,
} from '../../../src/utils/normalize-material-reference-text.js';

type CaseSpec = {
  raw: string;
  categoryNameEn: string;
  expectedType?: string | null;
  notes?: string;
};

const CASES: CaseSpec[] = [
  {
    raw: 'حساس Ultrasonic HC-SR04',
    categoryNameEn: 'Electronics & Components',
    expectedType: 'Ultrasonic Sensor',
  },
  {
    raw: 'حساس مسافة HC SR04',
    categoryNameEn: 'Electronics & Components',
    expectedType: 'Ultrasonic Sensor',
  },
  {
    raw: 'اردوينو اونو',
    categoryNameEn: 'Electronics & Components',
    expectedType: 'Arduino Uno',
  },
  {
    raw: 'Arduino Uno مع كيبل',
    categoryNameEn: 'Electronics & Components',
    expectedType: 'Arduino Uno',
  },
  {
    raw: 'سيرفو MG996R',
    categoryNameEn: 'Motors & Mechanical Parts',
    expectedType: 'Servo Motor',
  },
  {
    raw: 'موتور DC 12V',
    categoryNameEn: 'Motors & Mechanical Parts',
    expectedType: 'DC Motor',
  },
  {
    raw: 'Stepper Motor NEMA17',
    categoryNameEn: 'Motors & Mechanical Parts',
    expectedType: 'Stepper Motor',
  },
  {
    raw: 'ريليه 2 Channel',
    categoryNameEn: 'Electronics & Components',
    expectedType: 'Relay Module',
  },
  {
    raw: 'براغي M3',
    categoryNameEn: 'Metal & Fasteners',
    expectedType: 'Screws and Nuts',
  },
  {
    raw: 'مكبس 12V مع H bridge',
    categoryNameEn: 'Electronics & Components',
    expectedType: null,
    notes: 'Bundle/assembly — must not resolve to accessory H-Bridge alone',
  },
  {
    raw: 'HC-SR04',
    categoryNameEn: 'Electronics & Components',
    expectedType: 'Ultrasonic Sensor',
  },
  {
    raw: 'HC SR04 sensor',
    categoryNameEn: 'Electronics & Components',
    expectedType: 'Ultrasonic Sensor',
  },
  {
    raw: 'Arduino UNO R3',
    categoryNameEn: 'Electronics & Components',
    expectedType: 'Arduino Uno',
  },
  {
    raw: 'ESP32 DevKit V1',
    categoryNameEn: 'Electronics & Components',
    expectedType: 'ESP32',
  },
  {
    raw: 'MG996R Metal Gear Servo',
    categoryNameEn: 'Motors & Mechanical Parts',
    expectedType: 'Servo Motor',
  },
  {
    raw: 'SG90 Micro Servo',
    categoryNameEn: 'Motors & Mechanical Parts',
    expectedType: 'Servo Motor',
  },
  {
    raw: 'NEMA 17 Stepper',
    categoryNameEn: 'Motors & Mechanical Parts',
    expectedType: 'Stepper Motor',
  },
  {
    raw: 'DC Gear Motor',
    categoryNameEn: 'Motors & Mechanical Parts',
    expectedType: 'DC Motor',
  },
  {
    raw: 'Raspberry Pi Starter Kit',
    categoryNameEn: 'Electronics & Components',
    expectedType: 'Raspberry Pi Kit',
  },
  {
    raw: 'M3 screws',
    categoryNameEn: 'Metal & Fasteners',
    expectedType: 'Screws and Nuts',
  },
  {
    raw: 'حساس رطوبة التربة',
    categoryNameEn: 'Electronics & Components',
    expectedType: 'Soil Moisture Sensor',
  },
  {
    raw: 'مستشعر رطوبة التربة',
    categoryNameEn: 'Electronics & Components',
    expectedType: 'Soil Moisture Sensor',
  },
];

const main = async () => {
  // Report known-bad accessory alias if present; do not delete it here.
  const piKit = await prisma.materialType.findFirst({
    where: { nameEn: 'Raspberry Pi Kit', isActive: true },
    select: { id: true },
  });
  let knownBadHeatsinkAliasOnPiKit = 0;
  if (piKit) {
    knownBadHeatsinkAliasOnPiKit = await prisma.materialTypeAlias.count({
      where: {
        materialTypeId: piKit.id,
        normalizedAlias: normalizeMaterialReferenceText('Heatsink'),
      },
    });
  }

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, nameEn: true },
  });
  const categoryByName = new Map(
    categories.map((category) => [category.nameEn, category]),
  );

  const rows = [];
  for (const entry of CASES) {
    const category = categoryByName.get(entry.categoryNameEn);
    if (!category) {
      rows.push({
        raw: entry.raw,
        error: `category not found: ${entry.categoryNameEn}`,
      });
      continue;
    }

    const result = await matchMaterialReference({
      materialName: entry.raw,
      categoryId: category.id,
    });

    let taxonomyAliasHits: string[] = [];
    if (result.status === 'MATCHED') {
      const hits = await prisma.taxonomyAlias.findMany({
        where: {
          isActive: true,
          OR: [
            { normalizedAlias: normalizeMaterialReferenceText(entry.raw) },
            { normalizedAlias: compactMaterialReferenceText(entry.raw) },
          ],
        },
        select: {
          alias: true,
          concept: { select: { labelEn: true, conceptType: true } },
        },
        take: 5,
      });
      taxonomyAliasHits = hits.map(
        (hit) => `${hit.concept.conceptType}:${hit.concept.labelEn}`,
      );
    }

    const resolvedType =
      result.status === 'MATCHED' ? result.materialType.nameEn : null;
    const pass =
      entry.expectedType === undefined
        ? true
        : entry.expectedType === null
          ? result.status === 'NO_MATCH' ||
            (result.status === 'MATCHED' &&
              resolvedType !== 'H-Bridge Motor Driver' &&
              resolvedType !== 'Heatsink')
          : result.status === 'MATCHED' && resolvedType === entry.expectedType;

    rows.push({
      raw: entry.raw,
      normalized: normalizeMaterialReferenceText(entry.raw),
      category: category.nameEn,
      status: result.status,
      materialType: resolvedType,
      confidence: result.status === 'MATCHED' ? result.confidence : null,
      candidates:
        result.status === 'AMBIGUOUS'
          ? result.candidates.map((candidate) => candidate.nameEn)
          : [],
      taxonomyAliasHits,
      expectedType: entry.expectedType ?? 'any',
      pass,
      confirmationNeeded: result.status === 'AMBIGUOUS',
      reviewLikelyIfPaid: result.status === 'NO_MATCH',
      customIfFree: result.status === 'NO_MATCH',
      notes: entry.notes ?? null,
    });
  }

  const communityCount = await prisma.material.count({
    where: {
      tags: { some: { tag: 'community-demo' } },
    },
  });

  const failed = rows.filter((row) => 'pass' in row && row.pass === false);

  console.log(
    JSON.stringify(
      {
        mode: 'read-only',
        note:
          'Does not mutate aliases. Run npm run demo:seed:materials to ensure/repair production material-type aliases.',
        knownBadHeatsinkAliasOnPiKit,
        communityMaterialsTagged: communityCount,
        passed: rows.length - failed.length,
        failed: failed.length,
        matrix: rows,
      },
      null,
      2,
    ),
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
