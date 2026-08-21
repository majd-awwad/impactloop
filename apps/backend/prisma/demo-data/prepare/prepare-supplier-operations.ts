/**
 * Graduation/report screenshot prep for Figure 3.56:
 * Supplier verification, governance, and operational pickup schedule.
 *
 * Additive and idempotent. Reuses existing verified workshop suppliers and
 * production services. Never runs prisma:seed, never deletes user/material/
 * reservation data, and never touches CASH handover or ON_THE_WAY deliveries.
 */
import { prisma } from '../../../src/database/prisma.js';
import { env } from '../../../src/config/env.js';
import { assertLocalDemoDatabaseUrl } from '../../../scripts/lib/local-database-guard.mjs';
import {
  listSupplierCategoryRequests,
  submitCategoryRequest,
} from '../../../src/modules/category-requests/category-requests.service.js';
import { createReservation } from '../../../src/modules/reservations/reservations.service.js';
import {
  ACTIVE_HOLD_STATUSES,
  getMaterialQuantityState,
} from '../../../src/modules/reservations/reservations.quantity.js';
import { listSupplierSchedulePage } from '../../../src/modules/supplier-reservations/supplier-reservations-schedule.service.js';
import { acceptSupplierReservation } from '../../../src/modules/supplier-reservations/supplier-reservations.service.js';
import { getSupplierProfileManagement } from '../../../src/modules/supplier/supplier-profile.service.js';
import {
  isOrganizationSupplierType,
  normalizeSupplierVerificationStatus,
} from '../../../src/modules/supplier/supplier-verification.status.js';
import {
  ISRAA_LEARNER_EMAIL,
  MAJD_LEARNER_EMAIL,
  MAJD_SUPPLIER_EMAIL,
  MAJD_SUPPLIER_NAME,
  redact,
} from './local-demo-accounts.js';
import {
  CASH_HANDOVER_PREFERRED_TITLES,
  DRIVER_ON_THE_WAY_PREFERRED_TITLES,
  hasDemoMarker,
  isCompletedReservationStatus,
  isTerminalReservationStatus,
  SUPPLIER_OPERATIONS_DEMO_KEY,
} from './local-demo-keys.js';

export const SUPPLIER_OPERATIONS_CATEGORY_NAME_AR =
  'مواد تعليمية للنمذجة والتجارب';
export const SUPPLIER_OPERATIONS_CATEGORY_NAME_EN =
  'Educational Prototyping & Experiment Media';
export const SUPPLIER_OPERATIONS_MATERIAL_NAME =
  'ألواح رغوة لتجارب الاستشعار السعوي';
export const SUPPLIER_OPERATIONS_CATEGORY_REASON =
  'Reusable specialty material for classroom prototyping, capacitance experiments, and sensor-learning activities.';

const FORBIDDEN_PICKUP_TITLES = new Set<string>([
  ...CASH_HANDOVER_PREFERRED_TITLES,
  ...DRIVER_ON_THE_WAY_PREFERRED_TITLES,
]);

const withMarker = (value: string | null | undefined, key: string) => {
  if (hasDemoMarker(value, key)) {
    return value ?? key;
  }
  const base = value?.trim() ?? '';
  return base ? `${base} [${key}]` : key;
};

export const listingDraftHasDemoMarker = (
  listingDraftJson: unknown,
  key: string,
): boolean => JSON.stringify(listingDraftJson ?? '').includes(key);

export const isForbiddenSupplierOperationsMaterial = (title: string): boolean =>
  FORBIDDEN_PICKUP_TITLES.has(title);

export const localDayBoundaries = (now = new Date()) => {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  return { dayStart, dayEnd };
};

export const upcomingPickupWindow = (now = new Date()) => {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 2,
    10,
    0,
    0,
    0,
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 2,
    12,
    0,
    0,
    0,
  );
  return { start, end };
};

export const isUpcomingConfirmedPickup = (input: {
  status: string;
  fulfillmentMethod: string;
  pickupWindowStart: Date | string | null | undefined;
  now?: Date;
}): boolean => {
  if (input.status !== 'ACCEPTED' || input.fulfillmentMethod !== 'PICKUP') {
    return false;
  }
  if (!input.pickupWindowStart) {
    return false;
  }
  const start =
    input.pickupWindowStart instanceof Date
      ? input.pickupWindowStart
      : new Date(input.pickupWindowStart);
  if (!Number.isFinite(start.getTime())) {
    return false;
  }
  const { dayEnd } = localDayBoundaries(input.now);
  return start.getTime() >= dayEnd.getTime();
};

export type SupplierOperationsPickupAction =
  | 'reuse'
  | 'accept'
  | 'repair-window'
  | 'create';

export const resolveSupplierOperationsPickupAction = (
  existing: {
    status: string;
    fulfillmentMethod: string;
    pickupWindowStart: Date | string | null;
  } | null,
  now = new Date(),
): SupplierOperationsPickupAction => {
  if (!existing || existing.fulfillmentMethod !== 'PICKUP') {
    return 'create';
  }
  if (
    isTerminalReservationStatus(existing.status) ||
    isCompletedReservationStatus(existing.status)
  ) {
    return 'create';
  }
  if (existing.status === 'PENDING') {
    return 'accept';
  }
  if (existing.status === 'ACCEPTED') {
    return isUpcomingConfirmedPickup({ ...existing, now })
      ? 'reuse'
      : 'repair-window';
  }
  return 'create';
};

export const shouldReusePendingCategoryRequest = (existing: {
  status: string;
} | null): boolean => existing?.status === 'PENDING';

export const isSupplierOperationsVerificationReady = (input: {
  supplierType: string | null | undefined;
  verificationStatus: string | null | undefined;
}): boolean =>
  isOrganizationSupplierType(input.supplierType) &&
  normalizeSupplierVerificationStatus(input.verificationStatus) === 'APPROVED';

export type SupplierOperationsDemoSnapshot = {
  verificationReady: boolean;
  pendingCategoryRequest: boolean;
  upcomingSelfPickup: boolean;
};

export const isSupplierOperationsDemoReady = (
  snapshot: SupplierOperationsDemoSnapshot,
): boolean =>
  snapshot.verificationReady &&
  snapshot.pendingCategoryRequest &&
  snapshot.upcomingSelfPickup;

type SupplierAccount = {
  userId: string;
  email: string;
  displayName: string;
  publicName: string;
  supplierType: string | null;
  verificationStatus: string;
  organizationName: string | null;
  organizationType: string | null;
};

const loadSupplierAccount = async (
  userId: string,
): Promise<SupplierAccount | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      supplierProfile: {
        select: {
          publicName: true,
          supplierType: true,
          verificationStatus: true,
          organizationProfile: {
            select: {
              organizationName: true,
              organizationType: true,
            },
          },
        },
      },
    },
  });
  if (!user?.supplierProfile) {
    return null;
  }
  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    publicName: user.supplierProfile.publicName ?? user.displayName,
    supplierType: user.supplierProfile.supplierType,
    verificationStatus: user.supplierProfile.verificationStatus,
    organizationName:
      user.supplierProfile.organizationProfile?.organizationName ?? null,
    organizationType:
      user.supplierProfile.organizationProfile?.organizationType ?? null,
  };
};

const resolveVerifiedWorkshopSupplier = async (): Promise<SupplierAccount> => {
  const preferred = await prisma.user.findUnique({
    where: { email: MAJD_SUPPLIER_EMAIL },
    select: { id: true },
  });
  if (preferred) {
    const account = await loadSupplierAccount(preferred.id);
    if (account && isSupplierOperationsVerificationReady(account)) {
      return account;
    }
  }

  const byOrg = await prisma.organizationProfile.findFirst({
    where: { organizationName: MAJD_SUPPLIER_NAME },
    select: { supplierProfile: { select: { userId: true } } },
  });
  if (byOrg) {
    const account = await loadSupplierAccount(byOrg.supplierProfile.userId);
    if (account && isSupplierOperationsVerificationReady(account)) {
      return account;
    }
  }

  const fallbacks = await prisma.supplierProfile.findMany({
    where: {
      supplierType: { in: ['WORKSHOP', 'FACTORY', 'EDUCATIONAL_INSTITUTION'] },
      verificationStatus: { in: ['APPROVED', 'VERIFIED'] },
      organizationProfile: { isNot: null },
      user: { accountStatus: 'ACTIVE' },
    },
    select: { userId: true },
    orderBy: { createdAt: 'asc' },
    take: 8,
  });

  for (const row of fallbacks) {
    const account = await loadSupplierAccount(row.userId);
    if (account && isSupplierOperationsVerificationReady(account)) {
      return account;
    }
  }

  throw new Error(
    'No APPROVED Organization/Workshop supplier was found for Figure 3.56.',
  );
};

const resolvePickupLearner = async () => {
  const preferredEmails = [ISRAA_LEARNER_EMAIL, MAJD_LEARNER_EMAIL];
  for (const email of preferredEmails) {
    const learner = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        displayName: true,
        emailVerifiedAt: true,
        accountStatus: true,
      },
    });
    if (
      learner &&
      learner.accountStatus === 'ACTIVE' &&
      learner.emailVerifiedAt
    ) {
      return learner;
    }
  }
  throw new Error(
    'No email-verified demo learner was found for the supplier pickup screenshot.',
  );
};

const findMarkedCategoryRequest = async (supplierUserId: string) => {
  const requests = await prisma.categoryRequest.findMany({
    where: { requestedByUserId: supplierUserId },
    select: {
      id: true,
      status: true,
      requestedName: true,
      listingDraftJson: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    requests.find(
      (row) =>
        listingDraftHasDemoMarker(row.listingDraftJson, SUPPLIER_OPERATIONS_DEMO_KEY) ||
        row.requestedName === SUPPLIER_OPERATIONS_CATEGORY_NAME_AR,
    ) ?? null
  );
};

const resolveCategoryRequestedName = async (): Promise<string> => {
  const existing = await prisma.category.findFirst({
    where: {
      OR: [
        {
          nameEn: {
            equals: SUPPLIER_OPERATIONS_CATEGORY_NAME_EN,
            mode: 'insensitive',
          },
        },
        { nameAr: SUPPLIER_OPERATIONS_CATEGORY_NAME_AR },
      ],
    },
    select: { id: true, nameEn: true, nameAr: true },
  });
  if (!existing) {
    return SUPPLIER_OPERATIONS_CATEGORY_NAME_AR;
  }
  return `${SUPPLIER_OPERATIONS_CATEGORY_NAME_AR} (سعة)`;
};

const ensurePendingCategoryRequest = async (supplierUserId: string) => {
  const existing = await findMarkedCategoryRequest(supplierUserId);
  const requestedName =
    existing?.status === 'PENDING'
      ? existing.requestedName
      : await resolveCategoryRequestedName();
  const submitted = await submitCategoryRequest(supplierUserId, {
    requestedName,
    listingDraftJson: {
      materialName: SUPPLIER_OPERATIONS_MATERIAL_NAME,
      title: SUPPLIER_OPERATIONS_MATERIAL_NAME,
      description:
        'Reusable foam sheets for classroom capacitance sensing pads, prototyping, and sensor-learning activities.',
      categoryRequestReason: `${SUPPLIER_OPERATIONS_CATEGORY_REASON} English category: ${SUPPLIER_OPERATIONS_CATEGORY_NAME_EN}. [${SUPPLIER_OPERATIONS_DEMO_KEY}]`,
      requestedCategoryName: requestedName,
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      quantity: 8,
      unit: 'sheets',
      isFree: true,
      pickupAllowed: true,
      deliveryAllowed: false,
      currency: 'NIS',
      imageUrls: [],
      suggestedUses: `Classroom prototyping and capacitance experiments [${SUPPLIER_OPERATIONS_DEMO_KEY}]`,
    },
  });

  return {
    id: submitted.id,
    requestedName: submitted.requestedName,
    status: submitted.status,
    reused: shouldReusePendingCategoryRequest(existing) && existing?.id === submitted.id,
  };
};

const pickupReservationSelect = {
  id: true,
  status: true,
  fulfillmentMethod: true,
  pickupWindowStart: true,
  pickupWindowEnd: true,
  message: true,
  supplierNote: true,
  requesterId: true,
  materialId: true,
  material: { select: { title: true } },
  requester: { select: { displayName: true, email: true } },
} as const;

const findMarkedPickupReservation = async (supplierUserId: string) => {
  const rows = await prisma.reservation.findMany({
    where: {
      ownerId: supplierUserId,
      fulfillmentMethod: 'PICKUP',
      OR: [
        { message: { contains: SUPPLIER_OPERATIONS_DEMO_KEY } },
        { supplierNote: { contains: SUPPLIER_OPERATIONS_DEMO_KEY } },
      ],
    },
    select: pickupReservationSelect,
    orderBy: { updatedAt: 'desc' },
  });

  return (
    rows.find((row) => row.status === 'ACCEPTED' || row.status === 'PENDING') ??
    rows[0] ??
    null
  );
};

const stampPickupMarker = async (reservationId: string) => {
  const row = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    select: { message: true, supplierNote: true },
  });
  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      message: withMarker(row.message, SUPPLIER_OPERATIONS_DEMO_KEY),
      supplierNote: withMarker(
        row.supplierNote ?? 'Local supplier operations screenshot pickup',
        SUPPLIER_OPERATIONS_DEMO_KEY,
      ),
    },
  });
};

const repairAcceptedPickupWindow = async (reservationId: string) => {
  const window = upcomingPickupWindow();
  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      pickupWindowStart: window.start,
      pickupWindowEnd: window.end,
      learnerPreferredPickupWindows: [
        { start: window.start.toISOString(), end: window.end.toISOString() },
      ],
    },
  });
  return window;
};

const selectPickupMaterial = async (input: {
  supplierUserId: string;
  learnerId: string;
}) => {
  const materials = await prisma.material.findMany({
    where: {
      ownerId: input.supplierUserId,
      status: 'AVAILABLE',
      pickupAllowed: true,
      title: { notIn: [...FORBIDDEN_PICKUP_TITLES] },
    },
    select: {
      id: true,
      title: true,
      isFree: true,
      deliveryAllowed: true,
      quantity: true,
      reservations: {
        where: {
          requesterId: input.learnerId,
          status: { in: [...ACTIVE_HOLD_STATUSES] },
        },
        select: { id: true },
      },
    },
    orderBy: [{ deliveryAllowed: 'asc' }, { isFree: 'desc' }, { title: 'asc' }],
  });

  for (const material of materials) {
    if (material.reservations.length > 0) {
      continue;
    }
    const quantity = await getMaterialQuantityState(prisma, material.id);
    if (!quantity || quantity.availableQuantity.lt(1)) {
      continue;
    }
    return material;
  }

  throw new Error(
    'No isolated pickup-allowed material with remaining quantity was found for the supplier operations demo.',
  );
};

const ensureUpcomingSelfPickup = async (input: {
  supplierUserId: string;
  learner: { id: string; email: string; displayName: string };
}) => {
  const existing = await findMarkedPickupReservation(input.supplierUserId);
  const action = resolveSupplierOperationsPickupAction(existing);
  const window = upcomingPickupWindow();

  if (existing && action === 'reuse') {
    await stampPickupMarker(existing.id);
    return {
      reservationId: existing.id,
      action,
      materialTitle: existing.material.title,
      learnerName: existing.requester.displayName,
      pickupWindowStart: existing.pickupWindowStart,
      pickupWindowEnd: existing.pickupWindowEnd,
    };
  }

  if (existing && action === 'repair-window') {
    const repaired = await repairAcceptedPickupWindow(existing.id);
    await stampPickupMarker(existing.id);
    return {
      reservationId: existing.id,
      action,
      materialTitle: existing.material.title,
      learnerName: existing.requester.displayName,
      pickupWindowStart: repaired.start,
      pickupWindowEnd: repaired.end,
    };
  }

  if (existing && action === 'accept') {
    await stampPickupMarker(existing.id);
    await acceptSupplierReservation(input.supplierUserId, existing.id, {
      pickupWindowStart: window.start.toISOString(),
      pickupWindowEnd: window.end.toISOString(),
      supplierNote: withMarker(
        'Local supplier operations screenshot pickup',
        SUPPLIER_OPERATIONS_DEMO_KEY,
      ),
    });
    return {
      reservationId: existing.id,
      action,
      materialTitle: existing.material.title,
      learnerName: existing.requester.displayName,
      pickupWindowStart: window.start,
      pickupWindowEnd: window.end,
    };
  }

  const material = await selectPickupMaterial({
    supplierUserId: input.supplierUserId,
    learnerId: input.learner.id,
  });
  const created = await createReservation(input.learner.id, {
    materialId: material.id,
    quantityRequested: 1,
    fulfillmentMethod: 'PICKUP',
    paymentMethod: 'CASH',
    learnerPreferredPickupWindows: [
      { start: window.start.toISOString(), end: window.end.toISOString() },
    ],
    message: withMarker(
      'Local supplier operations screenshot pickup',
      SUPPLIER_OPERATIONS_DEMO_KEY,
    ),
  });
  await acceptSupplierReservation(input.supplierUserId, created.id, {
    pickupWindowStart: window.start.toISOString(),
    pickupWindowEnd: window.end.toISOString(),
    selectedPreferredWindowIndex: 0,
    supplierNote: withMarker(
      'Local supplier operations screenshot pickup',
      SUPPLIER_OPERATIONS_DEMO_KEY,
    ),
  });
  await stampPickupMarker(created.id);

  return {
    reservationId: created.id,
    action: 'create' as const,
    materialTitle: material.title,
    learnerName: input.learner.displayName,
    pickupWindowStart: window.start,
    pickupWindowEnd: window.end,
  };
};

const verifyScreenshotState = async (input: {
  supplierUserId: string;
  reservationId: string;
  categoryRequestId: string;
}) => {
  const management = await getSupplierProfileManagement(input.supplierUserId);
  const categoryRequests = await listSupplierCategoryRequests(
    input.supplierUserId,
  );
  const pendingCategory = categoryRequests.find(
    (row) => row.id === input.categoryRequestId && row.status === 'PENDING',
  );
  const { dayStart, dayEnd } = localDayBoundaries();
  const schedule = await listSupplierSchedulePage(input.supplierUserId, {
    page: 1,
    limit: 100,
    scope: 'ACTIVE',
    category: 'UPCOMING',
    fulfillmentMethod: 'PICKUP',
    dayStart: dayStart.toISOString(),
    dayEnd: dayEnd.toISOString(),
  });
  const pickupEntry = schedule.items.find(
    (item) =>
      item.representativeReservationId === input.reservationId ||
      item.reservationIds.includes(input.reservationId),
  );

  const verification = management.verification;
  const snapshot: SupplierOperationsDemoSnapshot = {
    verificationReady: isSupplierOperationsVerificationReady({
      supplierType: management.identity?.supplierType,
      verificationStatus: verification.status,
    }),
    pendingCategoryRequest: Boolean(pendingCategory),
    upcomingSelfPickup:
      pickupEntry?.type === 'SELF_PICKUP' &&
      pickupEntry.category === 'UPCOMING' &&
      pickupEntry.reservationStatus === 'ACCEPTED' &&
      pickupEntry.fulfillmentMethod === 'SELF_PICKUP',
  };

  return {
    snapshot,
    verification: {
      status: verification.status,
      rawStatus: verification.rawStatus,
      isVerified: verification.isVerified,
      organizationName: management.organization?.organizationName ?? null,
      organizationType: management.organization?.organizationType ?? null,
      supplierType: management.identity?.supplierType ?? null,
      publicName: management.identity?.publicName ?? null,
    },
    categoryRequest: pendingCategory ?? null,
    pickup: pickupEntry
      ? {
          reservationId: pickupEntry.representativeReservationId,
          type: pickupEntry.type,
          category: pickupEntry.category,
          reservationStatus: pickupEntry.reservationStatus,
          fulfillmentMethod: pickupEntry.fulfillmentMethod,
          learnerName: pickupEntry.learner.displayName,
          materialTitle: pickupEntry.material.title,
          windowStart: pickupEntry.effectiveWindow?.start ?? null,
          windowEnd: pickupEntry.effectiveWindow?.end ?? null,
        }
      : null,
  };
};

export async function prepareSupplierOperationsDemo() {
  assertLocalDemoDatabaseUrl(env.databaseUrl, 'supplier-operations demo prep');

  const supplier = await resolveVerifiedWorkshopSupplier();
  const learner = await resolvePickupLearner();

  console.log('\nSupplier operations demo prep (Figure 3.56)');
  console.log(
    `Supplier: ${supplier.publicName} <${supplier.email}> (${redact(supplier.userId)}) type=${supplier.supplierType} verification=${supplier.verificationStatus}`,
  );
  console.log(
    `Pickup learner: ${learner.displayName} <${learner.email}> (${redact(learner.id)})`,
  );

  const categoryRequest = await ensurePendingCategoryRequest(supplier.userId);
  const pickup = await ensureUpcomingSelfPickup({
    supplierUserId: supplier.userId,
    learner,
  });
  const verified = await verifyScreenshotState({
    supplierUserId: supplier.userId,
    reservationId: pickup.reservationId,
    categoryRequestId: categoryRequest.id,
  });

  if (!isSupplierOperationsDemoReady(verified.snapshot)) {
    throw new Error(
      'Supplier operations demo is not screenshot-ready after preparation ' +
        `(verification=${verified.snapshot.verificationReady}, ` +
        `category=${verified.snapshot.pendingCategoryRequest}, ` +
        `pickup=${verified.snapshot.upcomingSelfPickup}).`,
    );
  }

  console.log('\n=== FIGURE 3.56 READY ===');
  console.log(
    JSON.stringify(
      {
        marker: SUPPLIER_OPERATIONS_DEMO_KEY,
        supplier: {
          email: supplier.email,
          publicName: verified.verification.publicName,
          organizationName: verified.verification.organizationName,
          organizationType: verified.verification.organizationType,
          supplierType: verified.verification.supplierType,
          verificationStatus: verified.verification.status,
          rawVerificationStatus: verified.verification.rawStatus,
          isVerified: verified.verification.isVerified,
        },
        categoryRequest: {
          id: redact(categoryRequest.id),
          requestedName: categoryRequest.requestedName,
          materialName: SUPPLIER_OPERATIONS_MATERIAL_NAME,
          status: categoryRequest.status,
          reused: categoryRequest.reused,
        },
        pickup: {
          reservationId: redact(pickup.reservationId),
          action: pickup.action,
          learnerName: verified.pickup?.learnerName ?? pickup.learnerName,
          materialTitle: verified.pickup?.materialTitle ?? pickup.materialTitle,
          status: verified.pickup?.reservationStatus ?? 'ACCEPTED',
          fulfillmentMethod: verified.pickup?.fulfillmentMethod ?? 'SELF_PICKUP',
          category: verified.pickup?.category ?? 'UPCOMING',
          windowStart: verified.pickup?.windowStart,
          windowEnd: verified.pickup?.windowEnd,
        },
        screenshotReady: true,
        rerun: 'npm run demo:prepare:supplier-operations -w apps/backend',
      },
      null,
      2,
    ),
  );

  return {
    supplierUserId: supplier.userId,
    categoryRequestId: categoryRequest.id,
    reservationId: pickup.reservationId,
    verificationStatus: verified.verification.status,
    screenshotReady: true as const,
  };
}
