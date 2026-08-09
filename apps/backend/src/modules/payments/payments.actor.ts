import type { UserRole } from '../../generated/prisma/client.js';

export type PaymentActor = {
  userId: string;
  roles: readonly UserRole[];
};

export const isPaymentAdminActor = (actor: PaymentActor): boolean =>
  actor.roles.includes('ADMIN');
