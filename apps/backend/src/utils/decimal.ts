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
