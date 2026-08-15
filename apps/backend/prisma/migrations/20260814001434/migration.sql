-- Idempotent guard migration.
-- These index operations duplicate 20260812175942_project_help_session_zoom_registration
-- on fresh databases where that migration already ran. Use IF EXISTS / conditional
-- renames so deploy succeeds whether or not the prior migration applied them.

DROP INDEX IF EXISTS "locations_geography_gist_idx";

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'handover_code_verification_audits_entity_id_scope_created_at_id'
      AND c.relkind = 'i'
  ) THEN
    ALTER INDEX "handover_code_verification_audits_entity_id_scope_created_at_id"
      RENAME TO "handover_code_verification_audits_entity_id_scope_created_a_idx";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'no_show_reports_reservation_id_target_role_reason_code_status_i'
      AND c.relkind = 'i'
  ) THEN
    ALTER INDEX "no_show_reports_reservation_id_target_role_reason_code_status_i"
      RENAME TO "no_show_reports_reservation_id_target_role_reason_code_stat_idx";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'payment_checkout_session_items_session_order_key'
      AND c.relkind = 'i'
  ) THEN
    ALTER INDEX "payment_checkout_session_items_session_order_key"
      RENAME TO "payment_checkout_session_items_checkout_session_id_payment__key";
  END IF;
END $migration$;
