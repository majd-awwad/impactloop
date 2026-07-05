import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

const messageInclude = {
  sender: {
    select: {
      id: true,
      displayName: true,
      profileImageUrl: true,
    },
  },
} satisfies Prisma.ReservationMessageInclude;

export type ReservationMessageRecord = Prisma.ReservationMessageGetPayload<{
  include: typeof messageInclude;
}>;

export const findReservationMessages = async (reservationId: string) => {
  return prisma.reservationMessage.findMany({
    where: { reservationId },
    include: messageInclude,
    orderBy: { createdAt: 'asc' },
  });
};

export const findLatestReservationMessagesByReservationIds = async (
  reservationIds: string[],
) => {
  if (reservationIds.length === 0) {
    return new Map<string, ReservationMessageRecord>();
  }

  const messages = await prisma.reservationMessage.findMany({
    where: { reservationId: { in: reservationIds } },
    include: messageInclude,
    orderBy: [{ reservationId: 'asc' }, { createdAt: 'desc' }],
  });

  const latest = new Map<string, ReservationMessageRecord>();
  for (const message of messages) {
    if (!latest.has(message.reservationId)) {
      latest.set(message.reservationId, message);
    }
  }

  return latest;
};

export const createReservationMessage = async (input: {
  reservationId: string;
  senderUserId: string;
  body: string;
  tx?: Prisma.TransactionClient;
}) => {
  const client = input.tx ?? prisma;
  return client.reservationMessage.create({
    data: {
      reservationId: input.reservationId,
      senderUserId: input.senderUserId,
      body: input.body,
    },
    include: messageInclude,
  });
};

export const mapReservationMessage = (message: ReservationMessageRecord) => ({
  id: message.id,
  reservationId: message.reservationId,
  body: message.body,
  createdAt: message.createdAt.toISOString(),
  sender: {
    id: message.sender.id,
    displayName: message.sender.displayName,
    profileImageUrl: message.sender.profileImageUrl,
  },
});
