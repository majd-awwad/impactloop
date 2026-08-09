import { createHash } from "node:crypto";

import { IDEMPOTENCY_ERROR_CODES } from "../contracts/errors/idempotency-error-codes.js";
import { prisma } from "../database/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../utils/app-error.js";

export const SUPPLIER_CREATE_MATERIAL_SCOPE = "SUPPLIER_CREATE_MATERIAL";
export const LEARNING_PROJECT_SUBMIT_SCOPE = "LEARNING_PROJECT_SUBMIT";
export const LEARNING_PROJECT_AI_AUTHORING_DRAFT_SCOPE =
  "LEARNING_PROJECT_AI_AUTHORING_DRAFT";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

type IdempotentOperationInput<TResponse> = {
  userId: string;
  scope: string;
  key: string;
  payload: unknown;
  resourceType: string;
  getResourceId: (response: TResponse) => string;
  handler: (tx: Prisma.TransactionClient) => Promise<TResponse>;
};

const isUniqueConstraintError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(",")}}`;
};

export const validateIdempotencyKey = (key: string | undefined): string => {
  const normalized = key?.trim();

  if (!normalized) {
    throw new AppError(
      "Idempotency-Key header is required.",
      400,
      "VALIDATION_ERROR",
      { field: "Idempotency-Key" },
    );
  }

  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    throw new AppError(
      "Idempotency-Key must be a safe random string between 16 and 128 characters.",
      400,
      "VALIDATION_ERROR",
      { field: "Idempotency-Key" },
    );
  }

  return normalized;
};

export const computeIdempotencyRequestHash = (payload: unknown): string => {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
};

export const runIdempotentOperation = async <TResponse extends object>({
  userId,
  scope,
  key,
  payload,
  resourceType,
  getResourceId,
  handler,
}: IdempotentOperationInput<TResponse>): Promise<{
  response: TResponse;
  replayed: boolean;
}> => {
  const requestHash = computeIdempotencyRequestHash(payload);

  try {
    const response = await prisma.$transaction(async (tx) => {
      await tx.idempotencyRecord.create({
        data: {
          userId,
          scope,
          key,
          requestHash,
          status: "IN_PROGRESS",
        },
      });

      const operationResponse = await handler(tx);
      await tx.idempotencyRecord.update({
        where: {
          userId_scope_key: {
            userId,
            scope,
            key,
          },
        },
        data: {
          status: "SUCCEEDED",
          resourceType,
          resourceId: getResourceId(operationResponse),
          responseJson: operationResponse,
        },
      });

      return operationResponse;
    });

    return { response, replayed: false };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await prisma.idempotencyRecord.findUnique({
      where: {
        userId_scope_key: {
          userId,
          scope,
          key,
        },
      },
    });

    if (!existing) {
      throw error;
    }

    if (existing.requestHash !== requestHash) {
      throw new AppError(
        "Idempotency key was already used with a different request.",
        409,
        IDEMPOTENCY_ERROR_CODES.keyReused,
        {
          reason: IDEMPOTENCY_ERROR_CODES.keyReused,
          resourceType: existing.resourceType,
          resourceId: existing.resourceId,
        },
      );
    }

    if (existing.status === "SUCCEEDED" && existing.responseJson) {
      return {
        response: existing.responseJson as TResponse,
        replayed: true,
      };
    }

    if (existing.status === "IN_PROGRESS") {
      throw new AppError(
        "Request is already being processed.",
        409,
        IDEMPOTENCY_ERROR_CODES.inProgress,
        {
          reason: "REQUEST_IN_PROGRESS",
          resourceType: existing.resourceType,
          resourceId: existing.resourceId,
        },
      );
    }

    throw new AppError(
      "Previous request with this idempotency key failed. Start a new request with a new key.",
      409,
      IDEMPOTENCY_ERROR_CODES.previouslyFailed,
      {
        reason: IDEMPOTENCY_ERROR_CODES.previouslyFailed,
        resourceType: existing.resourceType,
        resourceId: existing.resourceId,
      },
    );
  }
};
