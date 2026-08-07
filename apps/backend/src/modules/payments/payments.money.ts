import { Prisma } from '../../generated/prisma/client.js';

import {
  PAYMENT_AMOUNT_MINOR_MAX,
  PAYMENT_CURRENCY_MINOR_UNITS,
} from './payments.constants.js';

export const toMoneyDecimal = (
  value: Prisma.Decimal | number | string,
): Prisma.Decimal => {
  if (value instanceof Prisma.Decimal) {
    return value;
  }

  return new Prisma.Decimal(value);
};

export const moneyDecimalToString = (value: Prisma.Decimal): string =>
  value.toFixed(2);

export const moneyDecimalToMinorUnits = (value: Prisma.Decimal): number => {
  const minor = value.mul(PAYMENT_CURRENCY_MINOR_UNITS);
  if (!minor.isInteger()) {
    throw new Error('Money amount must have at most two decimal places.');
  }

  if (minor.lte(0)) {
    throw new Error('Money amount must be positive.');
  }

  if (minor.gt(PAYMENT_AMOUNT_MINOR_MAX)) {
    throw new Error(
      `Money amount exceeds supported minor-unit maximum (${PAYMENT_AMOUNT_MINOR_MAX}).`,
    );
  }

  return minor.toNumber();
};

export const minorUnitsToDecimal = (minor: number): Prisma.Decimal =>
  new Prisma.Decimal(minor).div(PAYMENT_CURRENCY_MINOR_UNITS);

export const isPositiveMoney = (value: Prisma.Decimal): boolean =>
  value.gt(0);

export const moneyEquals = (a: Prisma.Decimal, b: Prisma.Decimal): boolean =>
  a.eq(b);
