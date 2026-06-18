import type {
  MaterialCondition,
  MaterialSourceType,
  PickupType,
  PrismaClient,
  ReservationStatus,
} from '../../src/generated/prisma/client.js';

export const SEED_RESERVATION_PREFIX = '[seed]';
export const SEED_SUPPLIER_EMAIL = 'seed-supplier@impactloop.test';
export const SEED_PASSWORD = 'SeedPassword123!';

export const SEED_LEARNERS = [
  { email: 'seed-learner-ahmad@impactloop.test', displayName: 'Ahmad' },
  { email: 'seed-learner-sara@impactloop.test', displayName: 'Sara' },
  { email: 'seed-learner-omar@impactloop.test', displayName: 'Omar' },
  { email: 'seed-learner-lina@impactloop.test', displayName: 'Lina' },
  { email: 'seed-learner-yousef@impactloop.test', displayName: 'Yousef' },
] as const;

export const SEED_MATERIALS = [
  {
    key: 'arduino-uno',
    title: 'Arduino Uno',
    description: 'Seed material for reservation testing.',
    materialType: 'Microcontroller board',
    unit: 'piece',
    quantity: 5,
    condition: 'GOOD' as MaterialCondition,
    sourceType: 'WORKSHOP_SURPLUS' as MaterialSourceType,
  },
  {
    key: 'cotton-fabric',
    title: 'Cotton fabric scraps',
    description: 'Seed fabric scraps for pickup schedule testing.',
    materialType: 'Fabric',
    unit: 'kg',
    quantity: 12,
    condition: 'USED' as MaterialCondition,
    sourceType: 'WORKSHOP_SURPLUS' as MaterialSourceType,
  },
  {
    key: 'wood-scraps',
    title: 'Wood scraps',
    description: 'Seed wood offcuts for upcoming pickup tests.',
    materialType: 'Wood',
    unit: 'kg',
    quantity: 20,
    condition: 'GOOD' as MaterialCondition,
    sourceType: 'WORKSHOP_SURPLUS' as MaterialSourceType,
  },
  {
    key: 'cardboard-boxes',
    title: 'Cardboard boxes',
    description: 'Seed cardboard boxes for completed pickup tests.',
    materialType: 'Packaging',
    unit: 'boxes',
    quantity: 10,
    condition: 'LIKE_NEW' as MaterialCondition,
    sourceType: 'FACTORY_SURPLUS' as MaterialSourceType,
  },
  {
    key: 'epoxy-resin',
    title: 'Epoxy resin bottles',
    description: 'Seed resin bottles for mixed reservation tests.',
    materialType: 'Chemicals',
    unit: 'bottle',
    quantity: 4,
    condition: 'NEW' as MaterialCondition,
    sourceType: 'EDUCATIONAL_INSTITUTION' as MaterialSourceType,
  },
] as const;

export type SeedReservationSpec = {
  key: string;
  materialKey: (typeof SEED_MATERIALS)[number]['key'];
  learnerEmail: (typeof SEED_LEARNERS)[number]['email'];
  status: ReservationStatus;
  quantityRequested: number;
  learnerMessage: string;
  pickupType?: PickupType;
  supplierNote?: string;
  rejectionReason?: string;
  pickupWindow?: {
    startOffsetDays: number;
    startHour: number;
    startMinute?: number;
    endHour: number;
    endMinute?: number;
  };
  completedOffsetDays?: number;
};

export const SEED_RESERVATIONS: SeedReservationSpec[] = [
  {
    key: 'pending-arduino',
    materialKey: 'arduino-uno',
    learnerEmail: 'seed-learner-ahmad@impactloop.test',
    status: 'PENDING',
    quantityRequested: 1,
    learnerMessage: 'I need it for a robotics project.',
  },
  {
    key: 'pending-fabric',
    materialKey: 'cotton-fabric',
    learnerEmail: 'seed-learner-sara@impactloop.test',
    status: 'PENDING',
    quantityRequested: 2,
    learnerMessage: 'Need fabric for a sewing workshop.',
  },
  {
    key: 'pending-wood',
    materialKey: 'wood-scraps',
    learnerEmail: 'seed-learner-omar@impactloop.test',
    status: 'PENDING',
    quantityRequested: 3,
    learnerMessage: 'Building a small shelf.',
  },
  {
    key: 'accepted-today-morning',
    materialKey: 'arduino-uno',
    learnerEmail: 'seed-learner-ahmad@impactloop.test',
    status: 'ACCEPTED',
    quantityRequested: 1,
    learnerMessage: 'Accepted pickup today morning.',
    supplierNote: 'Pickup near main gate.',
    pickupWindow: {
      startOffsetDays: 0,
      startHour: 10,
      endHour: 12,
    },
  },
  {
    key: 'accepted-today-afternoon',
    materialKey: 'epoxy-resin',
    learnerEmail: 'seed-learner-yousef@impactloop.test',
    status: 'ACCEPTED',
    quantityRequested: 1,
    learnerMessage: 'Accepted pickup today afternoon.',
    supplierNote: 'Ring the workshop bell.',
    pickupWindow: {
      startOffsetDays: 0,
      startHour: 15,
      endHour: 16,
    },
  },
  {
    key: 'accepted-tomorrow-fabric',
    materialKey: 'cotton-fabric',
    learnerEmail: 'seed-learner-sara@impactloop.test',
    status: 'ACCEPTED',
    quantityRequested: 3,
    learnerMessage: 'Accepted pickup tomorrow.',
    supplierNote: 'Call when you arrive.',
    pickupWindow: {
      startOffsetDays: 1,
      startHour: 13,
      endHour: 15,
    },
  },
  {
    key: 'accepted-tomorrow-wood',
    materialKey: 'wood-scraps',
    learnerEmail: 'seed-learner-omar@impactloop.test',
    status: 'ACCEPTED',
    quantityRequested: 5,
    learnerMessage: 'Tomorrow wood pickup.',
    pickupWindow: {
      startOffsetDays: 1,
      startHour: 9,
      endHour: 11,
    },
  },
  {
    key: 'accepted-future-wood',
    materialKey: 'wood-scraps',
    learnerEmail: 'seed-learner-omar@impactloop.test',
    status: 'ACCEPTED',
    quantityRequested: 5,
    learnerMessage: 'Future wood pickup.',
    pickupWindow: {
      startOffsetDays: 5,
      startHour: 9,
      endHour: 11,
    },
  },
  {
    key: 'accepted-future-resin',
    materialKey: 'epoxy-resin',
    learnerEmail: 'seed-learner-lina@impactloop.test',
    status: 'ACCEPTED',
    quantityRequested: 2,
    learnerMessage: 'Future resin pickup.',
    supplierNote: 'Bring gloves.',
    pickupWindow: {
      startOffsetDays: 7,
      startHour: 14,
      endHour: 16,
    },
  },
  {
    key: 'declined-arduino',
    materialKey: 'arduino-uno',
    learnerEmail: 'seed-learner-lina@impactloop.test',
    status: 'REJECTED',
    quantityRequested: 1,
    learnerMessage: 'Declined request sample.',
    rejectionReason: 'Already reserved for another learner.',
  },
  {
    key: 'declined-fabric',
    materialKey: 'cotton-fabric',
    learnerEmail: 'seed-learner-yousef@impactloop.test',
    status: 'REJECTED',
    quantityRequested: 1,
    learnerMessage: 'Declined fabric request.',
    rejectionReason: 'Insufficient quantity available.',
  },
  {
    key: 'completed-cardboard',
    materialKey: 'cardboard-boxes',
    learnerEmail: 'seed-learner-lina@impactloop.test',
    status: 'COMPLETED',
    quantityRequested: 6,
    learnerMessage: 'Completed cardboard pickup.',
    supplierNote: 'Handed over at side entrance.',
    pickupWindow: {
      startOffsetDays: -1,
      startHour: 11,
      endHour: 13,
    },
    completedOffsetDays: -1,
  },
  {
    key: 'completed-resin',
    materialKey: 'epoxy-resin',
    learnerEmail: 'seed-learner-yousef@impactloop.test',
    status: 'COMPLETED',
    quantityRequested: 1,
    learnerMessage: 'Completed resin pickup.',
    pickupWindow: {
      startOffsetDays: -3,
      startHour: 10,
      endHour: 12,
    },
    completedOffsetDays: -3,
  },
  {
    key: 'completed-arduino',
    materialKey: 'arduino-uno',
    learnerEmail: 'seed-learner-ahmad@impactloop.test',
    status: 'COMPLETED',
    quantityRequested: 1,
    learnerMessage: 'Completed arduino pickup.',
    pickupWindow: {
      startOffsetDays: -5,
      startHour: 9,
      endHour: 10,
    },
    completedOffsetDays: -5,
  },
];

export type SeedContext = {
  supplierUserId: string;
  supplierProfileId: string;
  categoryId: string;
  locationId: string;
  learnerIds: Map<string, string>;
  materialIds: Map<string, string>;
};

export const buildPickupWindow = (
  spec: NonNullable<SeedReservationSpec['pickupWindow']>,
): { start: Date; end: Date } => {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + spec.startOffsetDays);

  const start = new Date(base);
  start.setHours(spec.startHour, spec.startMinute ?? 0, 0, 0);

  const end = new Date(base);
  end.setHours(spec.endHour, spec.endMinute ?? 0, 0, 0);

  return { start, end };
};

export const reservationSeedMessage = (key: string, learnerMessage: string) =>
  `${SEED_RESERVATION_PREFIX} ${key}: ${learnerMessage}`;

export const reservationSeedMessagePrefix = (key: string) =>
  `${SEED_RESERVATION_PREFIX} ${key}:`;

export async function countSeedReservations(prisma: PrismaClient): Promise<number> {
  return prisma.reservation.count({
    where: { message: { startsWith: SEED_RESERVATION_PREFIX } },
  });
}
