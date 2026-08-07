import { createHmac } from 'node:crypto';

import { randomUUID } from 'node:crypto';

import type { Prisma } from '../generated/prisma/client.js';

import { resolveHandoverCodeSecretConfig } from '../config/handover-code-secret.env.js';

import { comparePassword, hashPassword } from './password.js';

export const HANDOVER_CODE_LENGTH = 6;

export type HandoverCodeScope =
  | 'self-pickup'
  | 'supplier-handover'
  | 'learner-delivery';

const handoverCodePattern = /^\d{6}$/;

const { handoverCodeSecret } = resolveHandoverCodeSecretConfig(process.env);

const getHandoverCodeSecret = (): string => handoverCodeSecret;

export const deriveHandoverCode = (
  scope: HandoverCodeScope,
  entityId: string,
): string => {
  const digest = createHmac('sha256', getHandoverCodeSecret())
    .update(`${scope}:${entityId}`)
    .digest('hex');
  const numeric = parseInt(digest.slice(0, 10), 16) % 10 ** HANDOVER_CODE_LENGTH;

  return numeric.toString().padStart(HANDOVER_CODE_LENGTH, '0');
};

export const normalizeHandoverCode = (value: string): string | null => {
  const normalized = value.trim();

  if (!handoverCodePattern.test(normalized)) {
    return null;
  }

  return normalized;
};

export const hashHandoverCode = async (code: string): Promise<string> => {
  return hashPassword(code);
};

export const buildSelfPickupCodeData = async (reservationId: string) => {
  const plainCode = deriveHandoverCode('self-pickup', reservationId);
  const now = new Date();

  return {
    plainCode,
    data: {
      selfPickupCodeHash: await hashHandoverCode(plainCode),
      selfPickupCodeGeneratedAt: now,
    },
  };
};

export const buildDeliveryHandoverCodeData = async (deliveryId: string) => {
  const supplierPlainCode = deriveHandoverCode('supplier-handover', deliveryId);
  const learnerPlainCode = deriveHandoverCode('learner-delivery', deliveryId);
  const now = new Date();

  return {
    supplierHandoverCode: supplierPlainCode,
    learnerDeliveryCode: learnerPlainCode,
    data: {
      supplierHandoverCodeHash: await hashHandoverCode(supplierPlainCode),
      supplierHandoverCodeGeneratedAt: now,
      learnerDeliveryCodeHash: await hashHandoverCode(learnerPlainCode),
      learnerDeliveryCodeGeneratedAt: now,
    },
  };
};

export const verifyHandoverCode = async (
  providedCode: string,
  storedHash: string | null | undefined,
): Promise<boolean> => {
  const normalized = normalizeHandoverCode(providedCode);

  if (!normalized || !storedHash) {
    return false;
  }

  return comparePassword(normalized, storedHash);
};

export const ensureSelfPickupCodeStored = async (
  tx: Prisma.TransactionClient,
  reservationId: string,
) => {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      selfPickupCodeHash: true,
    },
  });

  if (!reservation) {
    return null;
  }

  if (reservation.selfPickupCodeHash) {
    return {
      plainCode: deriveHandoverCode('self-pickup', reservation.id),
      hash: reservation.selfPickupCodeHash,
    };
  }

  const { plainCode, data } = await buildSelfPickupCodeData(reservation.id);

  await tx.reservation.update({
    where: { id: reservation.id },
    data,
    select: { id: true },
  });

  return { plainCode, hash: data.selfPickupCodeHash };
};

export const ensureDeliveryHandoverCodesStored = async (
  tx: Prisma.TransactionClient,
  deliveryId: string,
) => {
  const delivery = await tx.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      supplierHandoverCodeHash: true,
      learnerDeliveryCodeHash: true,
    },
  });

  if (!delivery) {
    return null;
  }

  const supplierPlainCode = deriveHandoverCode('supplier-handover', delivery.id);
  const learnerPlainCode = deriveHandoverCode('learner-delivery', delivery.id);
  const now = new Date();
  const data: Prisma.DeliveryUpdateInput = {};

  if (!delivery.supplierHandoverCodeHash) {
    data.supplierHandoverCodeHash = await hashHandoverCode(supplierPlainCode);
    data.supplierHandoverCodeGeneratedAt = now;
  }

  if (!delivery.learnerDeliveryCodeHash) {
    data.learnerDeliveryCodeHash = await hashHandoverCode(learnerPlainCode);
    data.learnerDeliveryCodeGeneratedAt = now;
  }

  if (Object.keys(data).length > 0) {
    await tx.delivery.update({
      where: { id: delivery.id },
      data,
      select: { id: true },
    });
  }

  return {
    supplierHandoverCode: supplierPlainCode,
    learnerDeliveryCode: learnerPlainCode,
  };
};

export const createDeliveryId = () => randomUUID();
