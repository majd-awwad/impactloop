import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { prisma } from "../../database/prisma.js";

describe("driver history schema invariants", () => {
  after(async () => {
    await prisma.$disconnect();
  });

  test("delivery_pickup_items table and unique delivery/reservation index exist", async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'delivery_pickup_items'
    `;
    assert.equal(tables.length, 1);

    const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'delivery_pickup_items_delivery_id_reservation_id_key',
          'delivery_pickup_items_delivery_id_was_picked_idx'
        )
      ORDER BY indexname
    `;
    assert.equal(indexes.length, 2);
  });

  test("no_show_reports incident_key and recovery columns exist", async () => {
    const columns = await prisma.$queryRaw<Array<{ column_name: string; is_nullable: string }>>`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'no_show_reports'
        AND column_name IN (
          'incident_key',
          'reporter_reason_detail',
          'reporter_note',
          'recovery_action',
          'recovery_action_at',
          'recovery_delivery_id',
          'recovery_delivery_group_id',
          'recovery_completed_at',
          'hold_released_at'
        )
      ORDER BY column_name
    `;
    assert.equal(columns.length, 9);
    const incident = columns.find((row) => row.column_name === "incident_key");
    assert.ok(incident);
    assert.equal(incident.is_nullable, "NO");

    const unique = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'no_show_reports_incident_key_key'
    `;
    assert.equal(unique.length, 1);
  });

  test("history-oriented indexes exist on deliveries, assignments, and no_show_reports", async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'deliveries_updated_at_id_idx',
          'delivery_assignments_driver_profile_id_accepted_at_id_idx',
          'no_show_reports_reporter_user_id_created_at_id_idx',
          'no_show_reports_operational_occurrence_key'
        )
      ORDER BY indexname
    `;
    assert.equal(indexes.length, 4);
  });
});
