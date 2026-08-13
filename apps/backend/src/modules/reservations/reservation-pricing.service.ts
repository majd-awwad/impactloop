import {
  Prisma,
  type MaterialStatus,
  type PaymentCollectionMethod,
  type ReservationFulfillmentMethod,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import {
  calculateDeliveryPricing,
  DELIVERY_PRICING_CURRENCY,
  DELIVERY_ZONE_UNKNOWN_MESSAGE,
} from '../delivery-pricing/delivery-pricing.service.js';
import {
  computeInitialGroupWindow,
  findCompatibleDeliveryGroupCandidate,
  validateDeliveryGroupForCombine,
} from '../delivery-groups/delivery-groups.repository.js';
import {
  decimalToNumber,
  toDecimal,
} from '../reservations/reservations.quantity.js';

export type MaterialPricingContext = {
  isFree: boolean;
  price: Prisma.Decimal | null;
  currency: string;
  pickupCity: string;
  supplierProfileId: string | null;
  deliveryAllowed: boolean;
  pickupAllowed: boolean;
  status: MaterialStatus;
};

export type ReservationQuoteInput = {
  learnerId: string;
  materialId: string;
  quantity: number;
  fulfillmentMethod: ReservationFulfillmentMethod;
  paymentMethod: PaymentCollectionMethod;
  dropoffCity?: string;
  dropoffArea?: string | null;
  learnerPreferredDeliveryWindows?: { start: string; end: string }[];
  combineWithDeliveryGroupId?: string;
};

export type ReservationQuoteResult = {
  materialId: string;
  unitPrice: number;
  quantity: number;
  materialSubtotal: number;
  deliveryFee: number;
  totalAmount: number;
  currency: string;
  deliveryZone: string | null;
  fulfillmentMethod: ReservationFulfillmentMethod;
  paymentMethod: PaymentCollectionMethod;
  canDeliver: boolean;
  groupingAvailable: boolean;
  groupingApplied: boolean;
  deliveryGroupCandidate: {
    id: string;
    existingReservationsCount: number;
    deliveryFeeAlreadyApplied: boolean;
    sharedWindowStart: string;
    sharedWindowEnd: string;
  } | null;
  messages: string[];
};

export type ReservationPricingSnapshot = {
  unitPriceAtReservation: Prisma.Decimal;
  materialSubtotal: Prisma.Decimal;
  deliveryFee: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  pricingCurrency: string;
  deliveryZone: string | null;
  dropoffCity: string | null;
  dropoffArea: string | null;
  deliveryGroupId: string | null;
  groupedDelivery: boolean;
};

const resolveUnitPrice = (material: MaterialPricingContext): Prisma.Decimal => {
  if (material.isFree) {
    return new Prisma.Decimal(0);
  }

  return toDecimal(material.price ?? 0);
};

const computeMaterialSubtotal = (
  unitPrice: Prisma.Decimal,
  quantity: number,
): Prisma.Decimal => unitPrice.mul(toDecimal(quantity));

export const buildReservationQuote = async (
  material: MaterialPricingContext & { id: string },
  availableQuantity: number,
  input: ReservationQuoteInput,
): Promise<
  | { ok: true; quote: ReservationQuoteResult }
  | { ok: false; code: string; message: string; details?: Record<string, unknown> }
> => {
  if (input.quantity <= 0 || input.quantity > availableQuantity) {
    return {
      ok: false,
      code: 'INVALID_QUANTITY',
      message:
        'Requested quantity must be positive and no more than the available quantity.',
      details: { availableQuantity },
    };
  }

  const unitPrice = resolveUnitPrice(material);
  const materialSubtotal = computeMaterialSubtotal(unitPrice, input.quantity);
  const currency = material.currency || DELIVERY_PRICING_CURRENCY;
  const messages: string[] = [];

  if (input.fulfillmentMethod === 'PICKUP') {
    return {
      ok: true,
      quote: {
        materialId: material.id,
        unitPrice: decimalToNumber(unitPrice),
        quantity: input.quantity,
        materialSubtotal: decimalToNumber(materialSubtotal),
        deliveryFee: 0,
        totalAmount: decimalToNumber(materialSubtotal),
        currency,
        deliveryZone: null,
        fulfillmentMethod: 'PICKUP',
        paymentMethod: input.paymentMethod,
        canDeliver: material.deliveryAllowed,
        groupingAvailable: false,
        groupingApplied: false,
        deliveryGroupCandidate: null,
        messages,
      },
    };
  }

  if (!material.deliveryAllowed) {
    return {
      ok: false,
      code: 'DELIVERY_NOT_ALLOWED',
      message: 'Delivery is not available for this material.',
    };
  }

  const dropoffCity = input.dropoffCity?.trim();
  if (!dropoffCity) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Drop-off city is required for delivery pricing.',
    };
  }

  if (!material.supplierProfileId) {
    return {
      ok: false,
      code: 'DELIVERY_PRICING_ERROR',
      message: DELIVERY_ZONE_UNKNOWN_MESSAGE,
    };
  }

  const deliveryPricing = calculateDeliveryPricing({
    supplierPickupCity: material.pickupCity,
    dropoffCity,
    dropoffArea: input.dropoffArea,
  });

  if (!deliveryPricing.ok) {
    return {
      ok: false,
      code: 'DELIVERY_PRICING_ERROR',
      message: deliveryPricing.message,
    };
  }

  const preferredWindows = input.learnerPreferredDeliveryWindows ?? [];
  let deliveryGroupCandidate = null as ReservationQuoteResult['deliveryGroupCandidate'];
  let groupingApplied = false;
  let deliveryFee = deliveryPricing.deliveryFee;

  if (preferredWindows.length > 0) {
    deliveryGroupCandidate = await findCompatibleDeliveryGroupCandidate({
      learnerId: input.learnerId,
      supplierProfileId: material.supplierProfileId,
      dropoffCity,
      dropoffArea: input.dropoffArea,
      preferredDeliveryWindows: preferredWindows,
      deliveryZone: deliveryPricing.zone,
      paymentMethod: input.paymentMethod,
    });
  }

  if (input.combineWithDeliveryGroupId && preferredWindows.length > 0) {
    const validation = await validateDeliveryGroupForCombine(prisma, {
      groupId: input.combineWithDeliveryGroupId,
      learnerId: input.learnerId,
      supplierProfileId: material.supplierProfileId,
      dropoffCity,
      dropoffArea: input.dropoffArea,
      preferredDeliveryWindows: preferredWindows,
      deliveryZone: deliveryPricing.zone,
      paymentMethod: input.paymentMethod,
    });

    if (!validation.ok) {
      return {
        ok: false,
        code: 'GROUP_NOT_AVAILABLE',
        message: 'Combined delivery is no longer available.',
      };
    }

    groupingApplied = true;
    deliveryFee = 0;
    messages.push('Combined delivery fee charged once for this group.');
  } else if (deliveryGroupCandidate) {
    messages.push(
      'You already have another delivery from this supplier that can be combined.',
    );
  }

  const totalAmount = decimalToNumber(
    materialSubtotal.add(toDecimal(deliveryFee)),
  );

  return {
    ok: true,
    quote: {
      materialId: material.id,
      unitPrice: decimalToNumber(unitPrice),
      quantity: input.quantity,
      materialSubtotal: decimalToNumber(materialSubtotal),
      deliveryFee,
      totalAmount,
      currency,
      deliveryZone: deliveryPricing.zone,
      fulfillmentMethod: 'DELIVERY',
      paymentMethod: input.paymentMethod,
      canDeliver: true,
      groupingAvailable: deliveryGroupCandidate != null,
      groupingApplied,
      deliveryGroupCandidate: deliveryGroupCandidate
        ? {
            id: deliveryGroupCandidate.id,
            existingReservationsCount:
              deliveryGroupCandidate.existingReservationsCount,
            deliveryFeeAlreadyApplied: true,
            sharedWindowStart: deliveryGroupCandidate.sharedWindowStart,
            sharedWindowEnd: deliveryGroupCandidate.sharedWindowEnd,
          }
        : null,
      messages,
    },
  };
};

export const resolveReservationPricingForCreate = async (
  tx: Prisma.TransactionClient,
  material: MaterialPricingContext & { id: string },
  availableQuantity: number,
  input: ReservationQuoteInput,
): Promise<
  | {
      ok: true;
      snapshot: ReservationPricingSnapshot;
      groupAction:
        | { type: 'JOIN'; groupId: string; sharedWindow: { start: Date; end: Date } }
        | { type: 'CREATE'; window: { start: Date; end: Date }; deliveryFee: number; zone: string }
        | { type: 'NONE' };
    }
  | { ok: false; code: string; message: string; details?: Record<string, unknown> }
> => {
  if (input.quantity <= 0 || input.quantity > availableQuantity) {
    return {
      ok: false,
      code: 'INVALID_QUANTITY',
      message:
        'Requested quantity must be positive and no more than the available quantity.',
      details: { availableQuantity },
    };
  }

  const unitPrice = resolveUnitPrice(material);
  const materialSubtotal = computeMaterialSubtotal(unitPrice, input.quantity);
  const currency = material.currency || DELIVERY_PRICING_CURRENCY;

  if (input.fulfillmentMethod === 'PICKUP') {
    const totalAmount = materialSubtotal;
    return {
      ok: true,
      snapshot: {
        unitPriceAtReservation: unitPrice,
        materialSubtotal,
        deliveryFee: new Prisma.Decimal(0),
        totalAmount,
        pricingCurrency: currency,
        deliveryZone: null,
        dropoffCity: null,
        dropoffArea: null,
        deliveryGroupId: null,
        groupedDelivery: false,
      },
      groupAction: { type: 'NONE' },
    };
  }

  const dropoffCity = input.dropoffCity?.trim();
  if (!dropoffCity) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'Drop-off city is required for delivery.',
    };
  }

  if (!material.supplierProfileId) {
    return {
      ok: false,
      code: 'DELIVERY_PRICING_ERROR',
      message: DELIVERY_ZONE_UNKNOWN_MESSAGE,
    };
  }

  const deliveryPricing = calculateDeliveryPricing({
    supplierPickupCity: material.pickupCity,
    dropoffCity,
    dropoffArea: input.dropoffArea,
  });

  if (!deliveryPricing.ok) {
    return {
      ok: false,
      code: 'DELIVERY_PRICING_ERROR',
      message: deliveryPricing.message,
    };
  }

  const preferredWindows = input.learnerPreferredDeliveryWindows ?? [];
  const initialWindow = computeInitialGroupWindow(preferredWindows);

  let deliveryFee = toDecimal(deliveryPricing.deliveryFee);
  let deliveryGroupId: string | null = null;
  let groupedDelivery = false;
  let groupAction:
    | { type: 'JOIN'; groupId: string; sharedWindow: { start: Date; end: Date } }
    | { type: 'CREATE'; window: { start: Date; end: Date }; deliveryFee: number; zone: string }
    | { type: 'NONE' } = {
    type: 'NONE',
  };

  if (input.combineWithDeliveryGroupId && initialWindow) {
    const validation = await validateDeliveryGroupForCombine(tx, {
      groupId: input.combineWithDeliveryGroupId,
      learnerId: input.learnerId,
      supplierProfileId: material.supplierProfileId,
      dropoffCity,
      dropoffArea: input.dropoffArea,
      preferredDeliveryWindows: preferredWindows,
      deliveryZone: deliveryPricing.zone,
      paymentMethod: input.paymentMethod,
    });

    if (!validation.ok) {
      return {
        ok: false,
        code: 'GROUP_NOT_AVAILABLE',
        message: 'Combined delivery is no longer available.',
      };
    }

    deliveryFee = new Prisma.Decimal(0);
    deliveryGroupId = validation.group.id;
    groupedDelivery = true;
    groupAction = {
      type: 'JOIN',
      groupId: validation.group.id,
      sharedWindow: validation.sharedWindow,
    };
  } else if (initialWindow) {
    groupAction = {
      type: 'CREATE',
      window: initialWindow,
      deliveryFee: deliveryPricing.deliveryFee,
      zone: deliveryPricing.zone,
    };
  } else if (input.combineWithDeliveryGroupId) {
    return {
      ok: false,
      code: 'GROUP_NOT_AVAILABLE',
      message: 'Combined delivery requires a preferred delivery window.',
    };
  }

  const totalAmount = materialSubtotal.add(deliveryFee);

  return {
    ok: true,
    snapshot: {
      unitPriceAtReservation: unitPrice,
      materialSubtotal,
      deliveryFee,
      totalAmount,
      pricingCurrency: currency,
      deliveryZone: deliveryPricing.zone,
      dropoffCity,
      dropoffArea: input.dropoffArea?.trim() || null,
      deliveryGroupId,
      groupedDelivery,
    },
    groupAction,
  };
};

export const mapPricingFields = (reservation: {
  unitPriceAtReservation?: Prisma.Decimal | null;
  materialSubtotal?: Prisma.Decimal | null;
  deliveryFee?: Prisma.Decimal | null;
  totalAmount?: Prisma.Decimal | null;
  pricingCurrency?: string | null;
  deliveryZone?: string | null;
  deliveryGroupId?: string | null;
  quantityRequested: Prisma.Decimal;
}) => {
  const groupedDelivery =
    reservation.deliveryGroupId != null &&
    reservation.deliveryFee != null &&
    reservation.deliveryFee.eq(0);

  return {
    unitPriceAtReservation:
      reservation.unitPriceAtReservation != null
        ? decimalToNumber(reservation.unitPriceAtReservation)
        : null,
    materialSubtotal:
      reservation.materialSubtotal != null
        ? decimalToNumber(reservation.materialSubtotal)
        : null,
    deliveryFee:
      reservation.deliveryFee != null
        ? decimalToNumber(reservation.deliveryFee)
        : null,
    totalAmount:
      reservation.totalAmount != null
        ? decimalToNumber(reservation.totalAmount)
        : null,
    currency: reservation.pricingCurrency ?? 'NIS',
    deliveryZone: reservation.deliveryZone,
    deliveryGroupId: reservation.deliveryGroupId ?? null,
    groupedDelivery,
    quantity: decimalToNumber(reservation.quantityRequested),
  };
};
