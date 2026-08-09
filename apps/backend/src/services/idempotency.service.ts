import { createHash } from "node:crypto";

import { IDEMPOTENCY_ERROR_CODES } from "../contracts/errors/idempotency-error-codes.js";
import { prisma } from "../database/prisma.js";
import type { IdempotencyStatus, Prisma } from "../generated/prisma/client.js";
import { AppError } from "../utils/app-error.js";
import { isPrismaCode } from "../utils/transaction-retry.js";

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

export type IdempotencyRecordIdentity = {
  userId: string;
  scope: string;
  key: string;
};

type IdempotencyRecordClient = Pick<
  Prisma.TransactionClient,
  "idempotencyRecord"
>;

type ExistingIdempotencyRecord = {
  requestHash: string;
  status: IdempotencyStatus;
  responseJson: Prisma.JsonValue | null;
};

type IdempotencyErrorDetails = {
  keyReused?: unknown;
  inProgress?: unknown;
  previouslyFailed?: unknown;
};

const idempotencyRecordWhere = (identity: IdempotencyRecordIdentity) => ({
  userId_scope_key: identity,
});

export const isIdempotencyClaimConflict = (error: unknown): boolean =>
  isPrismaCode(error, "P2002");

export const claimIdempotencyRecord = async (
  client: IdempotencyRecordClient,
  input: IdempotencyRecordIdentity & { requestHash: string },
) =>
  client.idempotencyRecord.create({
    data: {
      ...input,
      status: "IN_PROGRESS",
    },
  });

export const findIdempotencyRecord = async (
  client: IdempotencyRecordClient,
  identity: IdempotencyRecordIdentity,
) =>
  client.idempotencyRecord.findUnique({
    where: idempotencyRecordWhere(identity),
  });

export const markIdempotencyRecordSucceeded = async <TResponse extends object>(
  client: IdempotencyRecordClient,
  input: IdempotencyRecordIdentity & {
    resourceType: string;
    resourceId: string;
    response: TResponse;
  },
) => {
  const { response, resourceType, resourceId, ...identity } = input;
  return client.idempotencyRecord.update({
    where: idempotencyRecordWhere(identity),
    data: {
      status: "SUCCEEDED",
      resourceType,
      resourceId,
      responseJson: response,
    },
  });
};

export const markIdempotencyRecordFailed = async (
  client: IdempotencyRecordClient,
  identity: IdempotencyRecordIdentity,
) =>
  client.idempotencyRecord.update({
    where: idempotencyRecordWhere(identity),
    data: { status: "FAILED" },
  });

export const idempotencyKeyReusedError = (details?: unknown) =>
  new AppError(
    "Idempotency key was already used with a different request.",
    409,
    IDEMPOTENCY_ERROR_CODES.keyReused,
    details,
  );

export const idempotencyInProgressError = (details?: unknown) =>
  new AppError(
    "Request is already being processed.",
    409,
    IDEMPOTENCY_ERROR_CODES.inProgress,
    details,
  );

export const idempotencyPreviouslyFailedError = (details?: unknown) =>
  new AppError(
    "Previous request with this idempotency key failed. Start a new request with a new key.",
    409,
    IDEMPOTENCY_ERROR_CODES.previouslyFailed,
    details,
  );

export const resolveExistingIdempotencyRecord = <TResponse extends object>(
  input: {
    requestHash: string;
    existing: ExistingIdempotencyRecord;
    details?: IdempotencyErrorDetails;
  },
): { response: TResponse; replayed: true } => {
  if (input.existing.requestHash !== input.requestHash) {
    throw idempotencyKeyReusedError(input.details?.keyReused);
  }

  if (input.existing.status === "SUCCEEDED" && input.existing.responseJson) {
    return {
      response: input.existing.responseJson as TResponse,
      replayed: true,
    };
  }

  if (input.existing.status === "IN_PROGRESS") {
    throw idempotencyInProgressError(input.details?.inProgress);
  }

  throw idempotencyPreviouslyFailedError(input.details?.previouslyFailed);
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
  const identity = { userId, scope, key };

  try {
    const response = await prisma.$transaction(async (tx) => {
      await claimIdempotencyRecord(tx, { ...identity, requestHash });

      const operationResponse = await handler(tx);
      await markIdempotencyRecordSucceeded(tx, {
        ...identity,
        resourceType,
        resourceId: getResourceId(operationResponse),
        response: operationResponse,
      });

      return operationResponse;
    });

    return { response, replayed: false };
  } catch (error) {
    if (!isIdempotencyClaimConflict(error)) {
      throw error;
    }

    const existing = await findIdempotencyRecord(prisma, identity);

    if (!existing) {
      throw error;
    }

    return resolveExistingIdempotencyRecord<TResponse>({
      requestHash,
      existing,
      details: {
        keyReused: {
          reason: IDEMPOTENCY_ERROR_CODES.keyReused,
          resourceType: existing.resourceType,
          resourceId: existing.resourceId,
        },
        inProgress: {
          reason: "REQUEST_IN_PROGRESS",
          resourceType: existing.resourceType,
          resourceId: existing.resourceId,
        },
        previouslyFailed: {
          reason: IDEMPOTENCY_ERROR_CODES.previouslyFailed,
          resourceType: existing.resourceType,
          resourceId: existing.resourceId,
        },
      },
    });
  }
};
