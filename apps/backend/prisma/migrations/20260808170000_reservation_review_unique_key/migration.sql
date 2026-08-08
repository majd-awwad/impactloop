CREATE UNIQUE INDEX "reviews_reservation_id_reviewer_id_target_type_key"
ON "reviews"("reservation_id", "reviewer_id", "target_type");
