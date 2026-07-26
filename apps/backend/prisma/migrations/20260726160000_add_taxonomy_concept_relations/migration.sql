-- RP-02.8: additive typed, directed relations between taxonomy concepts.
-- Relation authoring and backfill are intentionally deferred to RP-02.9 or later.

CREATE TYPE "TaxonomyConceptRelationType" AS ENUM (
  'INTEREST_RELEVANT_TO',
  'SATISFIED_BY'
);

CREATE UNIQUE INDEX "taxonomy_concepts_id_concept_type_key"
  ON "taxonomy_concepts"("id", "concept_type");

CREATE TABLE "taxonomy_concept_relations" (
  "id" TEXT NOT NULL,
  "relation_type" "TaxonomyConceptRelationType" NOT NULL,
  "source_concept_id" TEXT NOT NULL,
  "source_concept_type" "TaxonomyConceptType" NOT NULL,
  "target_concept_id" TEXT NOT NULL,
  "target_concept_type" "TaxonomyConceptType" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "taxonomy_concept_relations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "taxonomy_relations_type_source_target_key"
  ON "taxonomy_concept_relations"("relation_type", "source_concept_id", "target_concept_id");

CREATE INDEX "taxonomy_relations_source_type_idx"
  ON "taxonomy_concept_relations"("source_concept_id", "relation_type");

CREATE INDEX "taxonomy_relations_target_type_idx"
  ON "taxonomy_concept_relations"("target_concept_id", "relation_type");

ALTER TABLE "taxonomy_concept_relations"
  ADD CONSTRAINT "taxonomy_concept_relations_distinct_concepts_check"
  CHECK ("source_concept_id" <> "target_concept_id");

ALTER TABLE "taxonomy_concept_relations"
  ADD CONSTRAINT "taxonomy_concept_relations_compatibility_check"
  CHECK (
    (
      "relation_type" = 'INTEREST_RELEVANT_TO'::"TaxonomyConceptRelationType"
      AND "source_concept_type" = 'INTEREST'::"TaxonomyConceptType"
      AND "target_concept_type" IN (
        'MATERIAL_FAMILY'::"TaxonomyConceptType",
        'MATERIAL_FORM'::"TaxonomyConceptType"
      )
    )
    OR
    (
      "relation_type" = 'SATISFIED_BY'::"TaxonomyConceptRelationType"
      AND "source_concept_type" = 'COMPONENT'::"TaxonomyConceptType"
      AND "target_concept_type" = 'MATERIAL_FORM'::"TaxonomyConceptType"
    )
  );

ALTER TABLE "taxonomy_concept_relations"
  ADD CONSTRAINT "taxonomy_relations_source_concept_type_fkey"
  FOREIGN KEY ("source_concept_id", "source_concept_type")
  REFERENCES "taxonomy_concepts"("id", "concept_type")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "taxonomy_concept_relations"
  ADD CONSTRAINT "taxonomy_relations_target_concept_type_fkey"
  FOREIGN KEY ("target_concept_id", "target_concept_type")
  REFERENCES "taxonomy_concepts"("id", "concept_type")
  ON DELETE CASCADE ON UPDATE CASCADE;
