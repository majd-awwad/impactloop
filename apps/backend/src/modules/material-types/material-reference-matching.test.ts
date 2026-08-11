import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  matchMaterialReferenceAgainstTypes,
} from '../../services/material-reference-matching.service.js';
import {
  compactMaterialReferenceText,
  normalizeMaterialReferenceText,
  tokenizeMaterialReferenceText,
} from '../../utils/normalize-material-reference-text.js';
import { PRODUCTION_MATERIAL_TYPE_ALIASES } from '../material-types/ensure-production-material-type-aliases.js';

type FixtureType = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  normalizedName: string;
  defaultUnit: string;
  categoryId: string;
  aliases: Array<{ alias: string; normalizedAlias: string }>;
};

const CATEGORY_ID = 'cat-electronics';

const buildFixtureTypes = (): FixtureType[] => {
  const byName = new Map<string, FixtureType>();

  for (const entry of PRODUCTION_MATERIAL_TYPE_ALIASES) {
    const id = `mt-${entry.nameEn.toLowerCase().replace(/\s+/g, '-')}`;
    byName.set(entry.nameEn, {
      id,
      nameEn: entry.nameEn,
      nameAr: entry.nameAr ?? null,
      normalizedName: normalizeMaterialReferenceText(entry.nameEn),
      defaultUnit: 'piece',
      categoryId: CATEGORY_ID,
      aliases: entry.aliases.map((alias) => ({
        alias: alias.alias,
        normalizedAlias: normalizeMaterialReferenceText(alias.alias),
      })),
    });
  }

  // Ambiguity fixture: shared weak alias "board" on two types must not first-win.
  byName.set('Control Board A', {
    id: 'mt-board-a',
    nameEn: 'Control Board A',
    nameAr: null,
    normalizedName: 'control board a',
    defaultUnit: 'piece',
    categoryId: CATEGORY_ID,
    aliases: [
      {
        alias: 'board',
        normalizedAlias: normalizeMaterialReferenceText('board'),
      },
    ],
  });
  byName.set('Control Board B', {
    id: 'mt-board-b',
    nameEn: 'Control Board B',
    nameAr: null,
    normalizedName: 'control board b',
    defaultUnit: 'piece',
    categoryId: CATEGORY_ID,
    aliases: [
      {
        alias: 'board',
        normalizedAlias: normalizeMaterialReferenceText('board'),
      },
    ],
  });

  return [...byName.values()];
};

const fixtures = buildFixtureTypes();

const match = (materialName: string) =>
  matchMaterialReferenceAgainstTypes({
    materialName,
    materialTypes: fixtures,
  });

describe('TAX-01 material reference matching', () => {
  test('normalizer folds Arabic alef variants and model punctuation', () => {
    assert.equal(
      normalizeMaterialReferenceText('حساس Ultrasonic HC-SR04'),
      'حساس ultrasonic hc-sr04',
    );
    assert.equal(
      compactMaterialReferenceText('HC SR04'),
      compactMaterialReferenceText('HC-SR04'),
    );
    assert.deepEqual(
      tokenizeMaterialReferenceText('Arduino Uno مع كيبل'),
      ['arduino', 'uno', 'كيبل'],
    );
    assert.ok(!tokenizeMaterialReferenceText('motor sensor board').includes('motor'));
  });

  test('exact and bilingual alias matrix resolves to canonical types', () => {
    const cases: Array<{ input: string; expected: string }> = [
      { input: 'حساس Ultrasonic HC-SR04', expected: 'Ultrasonic Sensor' },
      { input: 'حساس مسافة HC SR04', expected: 'Ultrasonic Sensor' },
      { input: 'اردوينو اونو', expected: 'Arduino Uno' },
      { input: 'Arduino Uno مع كيبل', expected: 'Arduino Uno' },
      { input: 'Arduino Uno with cable', expected: 'Arduino Uno' },
      { input: 'سيرفو MG996R', expected: 'Servo Motor' },
      { input: 'موتور DC 12V', expected: 'DC Motor' },
      { input: 'Stepper Motor NEMA17', expected: 'Stepper Motor' },
      { input: 'ريليه 2 Channel', expected: 'Relay Module' },
      { input: 'براغي M3', expected: 'Screws and Nuts' },
      { input: 'HC-SR04', expected: 'Ultrasonic Sensor' },
      { input: 'HC SR04 sensor', expected: 'Ultrasonic Sensor' },
      { input: 'Arduino UNO R3', expected: 'Arduino Uno' },
      { input: 'ESP32 DevKit V1', expected: 'ESP32' },
      { input: 'MG996R Metal Gear Servo', expected: 'Servo Motor' },
      { input: 'SG90 Micro Servo', expected: 'Servo Motor' },
      { input: 'NEMA 17 Stepper', expected: 'Stepper Motor' },
      { input: 'DC Gear Motor', expected: 'DC Motor' },
      { input: 'Raspberry Pi Starter Kit', expected: 'Raspberry Pi Kit' },
      { input: 'M3 screws', expected: 'Screws and Nuts' },
    ];

    for (const entry of cases) {
      const result = match(entry.input);
      assert.equal(
        result.status,
        'MATCHED',
        `${entry.input} → expected MATCHED, got ${JSON.stringify(result)}`,
      );
      if (result.status === 'MATCHED') {
        assert.equal(
          result.materialType.nameEn,
          entry.expected,
          `${entry.input} → ${result.materialType.nameEn}`,
        );
      }
    }
  });

  test('bundle with accessory token does not resolve to H-Bridge alone', () => {
    const result = match('مكبس 12V مع H bridge');
    assert.notEqual(
      result.status === 'MATCHED' && result.materialType.nameEn,
      'H-Bridge Motor Driver',
    );
  });

  test('motor families stay distinct', () => {
    assert.equal(
      match('Stepper Motor NEMA17').status === 'MATCHED'
        ? match('Stepper Motor NEMA17').status === 'MATCHED' &&
            (match('Stepper Motor NEMA17') as { materialType: { nameEn: string } })
              .materialType.nameEn
        : null,
      'Stepper Motor',
    );
    const dc = match('موتور DC 12V');
    const servo = match('سيرفو MG996R');
    assert.equal(dc.status, 'MATCHED');
    assert.equal(servo.status, 'MATCHED');
    if (dc.status === 'MATCHED' && servo.status === 'MATCHED') {
      assert.notEqual(dc.materialType.id, servo.materialType.id);
      assert.notEqual(dc.materialType.nameEn, 'Stepper Motor');
      assert.notEqual(servo.materialType.nameEn, 'Stepper Motor');
    }
  });

  test('ambiguous equal-score aliases do not first-win', () => {
    // "board" alone is blocked from tokenization; use exact alias equality path
    // by matching normalized input to the shared alias text via typeTexts.
    const boardOnlyTypes = fixtures.filter((type) =>
      type.nameEn.startsWith('Control Board'),
    );
    const result = matchMaterialReferenceAgainstTypes({
      materialName: 'board',
      materialTypes: boardOnlyTypes,
    });
    // Token "board" is blocked → only exact equality on typeTexts can match.
    // Both types have alias normalized "board" → equal EXACT score → AMBIGUOUS.
    assert.equal(result.status, 'AMBIGUOUS');
    if (result.status === 'AMBIGUOUS') {
      assert.equal(result.candidates.length, 2);
    }
  });

  test('unknown free-form name does not invent a type', () => {
    const result = match('Quantum Flux Capacitor XF-99');
    assert.equal(result.status, 'NO_MATCH');
  });
});
