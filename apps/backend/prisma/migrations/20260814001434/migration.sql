-- DropIndex
DROP INDEX "locations_geography_gist_idx";

-- RenameIndex
ALTER INDEX "handover_code_verification_audits_entity_id_scope_created_at_id" RENAME TO "handover_code_verification_audits_entity_id_scope_created_a_idx";

-- RenameIndex
ALTER INDEX "no_show_reports_reservation_id_target_role_reason_code_status_i" RENAME TO "no_show_reports_reservation_id_target_role_reason_code_stat_idx";

-- RenameIndex
ALTER INDEX "payment_checkout_session_items_session_order_key" RENAME TO "payment_checkout_session_items_checkout_session_id_payment__key";
