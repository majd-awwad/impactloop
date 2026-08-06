import { createHash } from 'node:crypto';

export type DeliveryObligationFingerprintPart = {
  purpose: 'DELIVERY_FEE' | 'MATERIAL_SUBTOTAL';
  paymentOrderId: string;
  cycleNumber: number;
};

/**
 * Canonical, stable fingerprint of every current payment obligation that made
 * a DeliveryGroup dispatch-ready. Sorted so concurrent final payments produce
 * the same eventKey.
 */
export const buildDeliveryDispatchReadyFingerprint = (
  parts: DeliveryObligationFingerprintPart[],
): string => {
  const normalized = parts
    .map(
      (part) =>
        `${part.purpose}:${part.paymentOrderId}:${part.cycleNumber}`,
    )
    .sort((a, b) => a.localeCompare(b));

  const canonical = normalized.join('|');
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
};

export const buildDeliveryDispatchReadyEventKey = (input: {
  deliveryGroupId: string;
  parts: DeliveryObligationFingerprintPart[];
}): string => {
  const fingerprint = buildDeliveryDispatchReadyFingerprint(input.parts);
  return `delivery-group:${input.deliveryGroupId}:dispatch-ready:${fingerprint}`;
};
