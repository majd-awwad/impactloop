import type { PrismaClient } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { normalizeSearchText } from '../../utils/normalize-search-text.js';

/**
 * Production bilingual aliases for commercially meaningful MaterialTypes.
 * Idempotent: skips existing normalizedAlias per type.
 * Does NOT create MaterialTypes.
 */
export const PRODUCTION_MATERIAL_TYPE_ALIASES: Array<{
  nameEn: string;
  nameAr?: string;
  aliases: Array<{ alias: string; language: 'ar' | 'en' }>;
}> = [
  {
    nameEn: 'Ultrasonic Sensor',
    nameAr: 'حساس التراسونيك',
    aliases: [
      { alias: 'حساس Ultrasonic', language: 'ar' },
      { alias: 'حساس التراسونيك', language: 'ar' },
      { alias: 'حساس مسافة', language: 'ar' },
      { alias: 'حساس مسافة HC-SR04', language: 'ar' },
      { alias: 'HC-SR04', language: 'en' },
      { alias: 'HC SR04', language: 'en' },
      { alias: 'HC-SR04 Sensor', language: 'en' },
      { alias: 'Ultrasonic HC-SR04', language: 'en' },
      { alias: 'Distance sensor', language: 'en' },
    ],
  },
  {
    nameEn: 'Arduino Uno',
    nameAr: 'اردوينو اونو',
    aliases: [
      { alias: 'اردوينو', language: 'ar' },
      { alias: 'اردوينو اونو', language: 'ar' },
      { alias: 'Arduino', language: 'en' },
      { alias: 'Arduino UNO', language: 'en' },
      { alias: 'Arduino Uno R3', language: 'en' },
      { alias: 'Arduino UNO R3', language: 'en' },
      { alias: 'UNO R3', language: 'en' },
    ],
  },
  {
    nameEn: 'Servo Motor',
    nameAr: 'سيرفو',
    aliases: [
      { alias: 'سيرفو', language: 'ar' },
      { alias: 'موتور سيرفو', language: 'ar' },
      { alias: 'SG90', language: 'en' },
      { alias: 'SG90 Micro Servo', language: 'en' },
      { alias: 'Micro servo', language: 'en' },
      { alias: 'MG996R', language: 'en' },
      { alias: 'MG996R Metal Gear Servo', language: 'en' },
    ],
  },
  {
    nameEn: 'Stepper Motor',
    nameAr: 'ستيبير موتور',
    aliases: [
      { alias: 'ستيبير', language: 'ar' },
      { alias: 'ستيبير موتور', language: 'ar' },
      { alias: 'NEMA17', language: 'en' },
      { alias: 'NEMA 17', language: 'en' },
      { alias: 'NEMA17 Stepper', language: 'en' },
      { alias: 'Stepper Motor NEMA17', language: 'en' },
      { alias: 'NEMA23', language: 'en' },
    ],
  },
  {
    nameEn: 'DC Motor',
    nameAr: 'موتور DC',
    aliases: [
      { alias: 'موتور DC', language: 'ar' },
      { alias: 'موتور دي سي', language: 'ar' },
      { alias: 'DC Gear Motor', language: 'en' },
      { alias: 'DC motor 12V', language: 'en' },
      { alias: 'Gear motor', language: 'en' },
    ],
  },
  {
    nameEn: 'Relay Module',
    nameAr: 'ريليه',
    aliases: [
      { alias: 'ريليه', language: 'ar' },
      { alias: 'ريليه 2 Channel', language: 'ar' },
      { alias: 'ريلي', language: 'ar' },
      { alias: '2 Channel Relay', language: 'en' },
      { alias: '1 Channel Relay', language: 'en' },
      { alias: '5V Relay Module', language: 'en' },
    ],
  },
  {
    nameEn: 'ESP32',
    nameAr: 'ESP32',
    aliases: [
      { alias: 'ESP32 DevKit', language: 'en' },
      { alias: 'ESP32 DevKit V1', language: 'en' },
      { alias: 'ESP-WROOM-32', language: 'en' },
    ],
  },
  {
    nameEn: 'Raspberry Pi',
    nameAr: 'راسبيري باي',
    aliases: [
      { alias: 'راسبيري باي', language: 'ar' },
      { alias: 'Raspberry Pi 4', language: 'en' },
      { alias: 'RPi', language: 'en' },
    ],
  },
  {
    nameEn: 'Raspberry Pi Kit',
    nameAr: 'طقم راسبيري باي',
    aliases: [
      { alias: 'Raspberry Pi Starter Kit', language: 'en' },
      { alias: 'Raspberry Pi kit', language: 'en' },
      { alias: 'طقم راسبيري باي', language: 'ar' },
    ],
  },
  {
    nameEn: 'H-Bridge Motor Driver',
    nameAr: 'سائق محركات',
    aliases: [
      { alias: 'H bridge', language: 'en' },
      { alias: 'H-bridge', language: 'en' },
      { alias: 'L298N', language: 'en' },
      { alias: 'سائق محرك H-bridge', language: 'ar' },
    ],
  },
  {
    nameEn: 'Screws and Nuts',
    nameAr: 'براغي وصواميل',
    aliases: [
      { alias: 'براغي', language: 'ar' },
      { alias: 'براغي M3', language: 'ar' },
      { alias: 'M3 screws', language: 'en' },
      { alias: 'M3 screw', language: 'en' },
      { alias: 'screws', language: 'en' },
    ],
  },
  {
    nameEn: 'Heatsink',
    nameAr: 'مبدد حراري',
    aliases: [
      { alias: 'heat sink', language: 'en' },
      { alias: 'مبدد حراري', language: 'ar' },
    ],
  },
  {
    nameEn: 'Soil Moisture Sensor',
    nameAr: 'حساس رطوبة التربة',
    aliases: [
      { alias: 'حساس رطوبة التربة', language: 'ar' },
      { alias: 'حساس رطوبة', language: 'ar' },
      { alias: 'مستشعر رطوبة التربة', language: 'ar' },
      { alias: 'حساس رطوبه التربه', language: 'ar' },
      { alias: 'Soil Moisture Sensor Modules', language: 'en' },
      { alias: 'soil moisture', language: 'en' },
      { alias: 'moisture sensor', language: 'en' },
    ],
  },
  {
    nameEn: 'DHT11 Sensor',
    nameAr: 'حساس DHT11',
    aliases: [
      { alias: 'حساس DHT11', language: 'ar' },
      { alias: 'حساس حرارة ورطوبة', language: 'ar' },
      { alias: 'DHT11', language: 'en' },
      { alias: 'DHT11 Temperature and Humidity Sensors', language: 'en' },
    ],
  },
  {
    nameEn: 'Light Sensor',
    nameAr: 'حساس ضوء LDR',
    aliases: [
      { alias: 'حساس ضوء LDR', language: 'ar' },
      { alias: 'حساس ضوء', language: 'ar' },
      { alias: 'LDR', language: 'en' },
      { alias: 'LDR Light Sensor', language: 'en' },
      { alias: 'photoresistor', language: 'en' },
    ],
  },
];

export type EnsureProductionMaterialTypeAliasesResult = {
  typesUpdated: number;
  aliasesCreated: number;
  nameArUpdated: number;
  missingTypes: string[];
};

export const ensureProductionMaterialTypeAliases = async (
  db: PrismaClient = prisma,
): Promise<EnsureProductionMaterialTypeAliasesResult> => {
  let typesUpdated = 0;
  let aliasesCreated = 0;
  let nameArUpdated = 0;
  const missingTypes: string[] = [];

  for (const entry of PRODUCTION_MATERIAL_TYPE_ALIASES) {
    const materialType = await db.materialType.findFirst({
      where: {
        isActive: true,
        nameEn: entry.nameEn,
      },
      select: {
        id: true,
        nameAr: true,
        aliases: { select: { normalizedAlias: true } },
      },
    });

    if (!materialType) {
      missingTypes.push(entry.nameEn);
      continue;
    }

    let touched = false;

    if (entry.nameAr && !materialType.nameAr) {
      await db.materialType.update({
        where: { id: materialType.id },
        data: { nameAr: entry.nameAr },
      });
      nameArUpdated += 1;
      touched = true;
    }

    const existing = new Set(
      materialType.aliases.map((alias) => alias.normalizedAlias),
    );

    for (const alias of entry.aliases) {
      const normalizedAlias = normalizeSearchText(alias.alias);
      if (!normalizedAlias || existing.has(normalizedAlias)) {
        continue;
      }

      await db.materialTypeAlias.create({
        data: {
          materialTypeId: materialType.id,
          alias: alias.alias,
          normalizedAlias,
          language: alias.language,
        },
      });
      existing.add(normalizedAlias);
      aliasesCreated += 1;
      touched = true;
    }

    if (touched) {
      typesUpdated += 1;
    }
  }

  return {
    typesUpdated,
    aliasesCreated,
    nameArUpdated,
    missingTypes,
  };
};
