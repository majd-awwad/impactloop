const MEASURABLE_UNITS = new Set([
  'kg',
  'g',
  'liter',
  'ml',
  'meter',
  'cm',
  'm2',
  'm3',
]);

const WHOLE_NUMBER_EPSILON = 1e-8;

export const isMeasurableReservationUnit = (unit: string): boolean =>
  MEASURABLE_UNITS.has(normalizeReservationUnit(unit));

export const isCountLikeReservationUnit = (unit: string): boolean =>
  !isMeasurableReservationUnit(unit);

export const isValidReservationQuantityForUnit = (
  quantity: number,
  unit: string,
): boolean => {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return false;
  }

  const scaled = isMeasurableReservationUnit(unit) ? quantity * 10 : quantity;
  return Math.abs(scaled - Math.round(scaled)) < WHOLE_NUMBER_EPSILON;
};

export const reservationQuantityUnitErrorMessage = (unit: string): string => {
  if (isMeasurableReservationUnit(unit)) {
    return 'Measurable materials must be reserved in increments of 0.1.';
  }

  return 'This material must be reserved in whole numbers.';
};

export const normalizeReservationUnit = (unit: string): string => {
  const trimmed = unit.trim().toLowerCase();
  if (trimmed.length === 0) {
    return '';
  }

  if (/كجم|كغ|كيلو/.test(trimmed)) {
    return 'kg';
  }
  if (/غرام|جرام/.test(trimmed) && !trimmed.includes('كيلو')) {
    return 'g';
  }
  if (/ملليلتر|مليلتر/.test(trimmed)) {
    return 'ml';
  }
  if (/لتر|ليتر/.test(trimmed)) {
    return 'liter';
  }
  if (/سنتيمتر/.test(trimmed) || trimmed === 'سم') {
    return 'cm';
  }
  if (/متر/.test(trimmed)) {
    return 'meter';
  }

  const ascii = trimmed.replace(/[^\x00-\x7F]+/g, ' ').trim();
  const source = ascii.length > 0 ? ascii : trimmed;
  const token =
    source
      .split(/[\s,/_-]+/)
      .filter((part) => part.length > 0)
      .at(-1) ?? source;

  switch (token) {
    case 'pcs':
    case 'pc':
    case 'piece':
    case 'pieces':
      return 'piece';
    case 'kg':
    case 'kilogram':
    case 'kilograms':
    case 'kilo':
      return 'kg';
    case 'g':
    case 'gram':
    case 'grams':
      return 'g';
    case 'l':
    case 'liter':
    case 'liters':
    case 'litre':
    case 'litres':
      return 'liter';
    case 'ml':
    case 'milliliter':
    case 'millilitre':
      return 'ml';
    case 'm':
    case 'meter':
    case 'meters':
    case 'metre':
    case 'metres':
      return 'meter';
    case 'cm':
    case 'centimeter':
    case 'centimetre':
      return 'cm';
    case 'm2':
    case 'm²':
    case 'sqm':
      return 'm2';
    case 'm3':
    case 'm³':
      return 'm3';
    default:
      return token;
  }
};
