import {
  forEachSupplierReservationBatch,
  type SupplierReservationListRecord,
} from './supplier-reservations.repository.js';
import type { ListSupplierScheduleQuery } from './supplier-reservations-schedule.validation.js';

export type SupplierScheduleReservationBatch = (
  records: SupplierReservationListRecord[],
) => void | Promise<void>;

/**
 * Reuses the owner/search/fulfillment Prisma filter and bounded batch query
 * from the existing Supplier reservation repository. Schedule pagination is
 * deliberately applied after the service deduplicates delivery groups.
 */
export const forEachSupplierScheduleReservationBatch = async (input: {
  ownerId: string;
  query: ListSupplierScheduleQuery;
  onBatch: SupplierScheduleReservationBatch;
}) => {
  await forEachSupplierReservationBatch({
    ownerId: input.ownerId,
    filter: {
      historyScope:
        input.query.scope === 'HISTORY'
          ? 'TERMINAL'
          : input.query.scope === 'ACTIVE'
            ? 'ACTIVE'
            : 'ALL',
      fulfillmentMethod: input.query.fulfillmentMethod,
      materialId: input.query.materialId,
      search: input.query.search,
    },
    batchSize: 100,
    onBatch: input.onBatch,
  });
};
