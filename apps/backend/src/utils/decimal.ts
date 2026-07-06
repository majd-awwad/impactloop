export const decimalToNumber = (
  value: { toNumber(): number } | number | null | undefined,
): number | null => {
  if (value == null) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  return value.toNumber();
};

export const roundCurrency = (value: number): number => {
  return Math.round(value * 100) / 100;
};

/** Display NIS amounts consistently: 10, 6.5, 11.05 (no trailing zeros). */
export const formatNisPrice = (value: number): string => {
  const rounded = roundCurrency(value);
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return String(Math.round(rounded));
  }

  return rounded.toFixed(2);
};
