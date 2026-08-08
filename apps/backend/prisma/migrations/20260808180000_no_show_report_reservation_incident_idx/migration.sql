-- Incident/reservation reads filter by reservation first, then role/reason/status.
CREATE INDEX "no_show_reports_reservation_id_target_role_reason_code_status_idx"
ON "no_show_reports"("reservation_id", "target_role", "reason_code", "status");
