import type {
  NoShowReport,
  Prisma,
} from '../../generated/prisma/client.js';
import { isPrismaCode } from '../../utils/transaction-retry.js';
import {
  buildNoShowReportIncidentKey,
  type NoShowReportIncidentKeyInput,
} from './no-show-report.incident-key.js';

export type NoShowReportCreateData = Omit<
  Prisma.NoShowReportUncheckedCreateInput,
  'incidentKey' | 'id'
>;

export const createNoShowReportOnce = async (
  tx: Prisma.TransactionClient,
  input: {
    key: NoShowReportIncidentKeyInput;
    data: NoShowReportCreateData;
  },
): Promise<
  | { created: true; report: NoShowReport }
  | { created: false; report: NoShowReport }
> => {
  const incidentKey = buildNoShowReportIncidentKey(input.key);

  try {
    const report = await tx.noShowReport.create({
      data: {
        ...input.data,
        incidentKey,
      },
    });
    return { created: true, report };
  } catch (error) {
    if (isPrismaCode(error, 'P2002')) {
      const existing = await tx.noShowReport.findUnique({
        where: { incidentKey },
      });
      if (existing) {
        return { created: false, report: existing };
      }
    }
    throw error;
  }
};

export const upsertNoShowReportByIncidentKey = async (
  tx: Prisma.TransactionClient,
  input: {
    key: NoShowReportIncidentKeyInput;
    create: NoShowReportCreateData;
    update: Prisma.NoShowReportUpdateInput;
  },
) => {
  const incidentKey = buildNoShowReportIncidentKey(input.key);

  return tx.noShowReport.upsert({
    where: { incidentKey },
    create: {
      ...input.create,
      incidentKey,
    },
    update: input.update,
  });
};
