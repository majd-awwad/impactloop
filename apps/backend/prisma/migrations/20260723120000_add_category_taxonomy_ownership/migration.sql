-- RP-01.2A1: additive category ownership slots for the canonical taxonomy.
-- This migration deliberately leaves all ownership values null for a later reviewed backfill.

ALTER TABLE "categories"
  ADD COLUMN "material_family_concept_id" TEXT,
  ADD COLUMN "project_topic_concept_id" TEXT;

CREATE INDEX "categories_material_family_concept_id_idx"
  ON "categories"("material_family_concept_id");

CREATE INDEX "categories_project_topic_concept_id_idx"
  ON "categories"("project_topic_concept_id");

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_material_family_concept_id_fkey"
  FOREIGN KEY ("material_family_concept_id") REFERENCES "taxonomy_concepts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_project_topic_concept_id_fkey"
  FOREIGN KEY ("project_topic_concept_id") REFERENCES "taxonomy_concepts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_taxonomy_ownership_slots_check"
  CHECK (
    (
      "category_type" <> 'MATERIAL'::"CategoryType"
      OR "project_topic_concept_id" IS NULL
    )
    AND
    (
      "category_type" <> 'PROJECT'::"CategoryType"
      OR "material_family_concept_id" IS NULL
    )
  );
