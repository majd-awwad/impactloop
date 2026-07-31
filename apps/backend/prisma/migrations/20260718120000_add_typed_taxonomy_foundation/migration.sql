-- Phase 2B: additive, inactive typed-taxonomy foundation.
-- Existing taxonomy fields remain authoritative/display fields and are untouched.

CREATE TYPE "TaxonomyConceptType" AS ENUM (
  'INTEREST',
  'MATERIAL_FAMILY',
  'MATERIAL_FORM',
  'PROJECT_TOPIC',
  'COMPONENT'
);

CREATE TYPE "TaxonomyConceptStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE "TaxonomyLanguage" AS ENUM ('EN', 'AR');

CREATE TYPE "TaxonomyAliasType" AS ENUM (
  'CANONICAL',
  'EXPLICIT',
  'LEGACY',
  'ABBREVIATION',
  'TRANSLATION'
);

CREATE TABLE "taxonomy_concepts" (
  "id" TEXT NOT NULL,
  "canonical_key" TEXT NOT NULL,
  "concept_type" "TaxonomyConceptType" NOT NULL,
  "label_en" TEXT NOT NULL,
  "label_ar" TEXT NOT NULL,
  "status" "TaxonomyConceptStatus" NOT NULL DEFAULT 'ACTIVE',
  "parent_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "taxonomy_concepts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "taxonomy_aliases" (
  "id" TEXT NOT NULL,
  "concept_id" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "normalized_alias" TEXT NOT NULL,
  "language" "TaxonomyLanguage" NOT NULL,
  "alias_type" "TaxonomyAliasType" NOT NULL,
  "source" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "taxonomy_aliases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "learner_interest_concepts" (
  "id" TEXT NOT NULL,
  "learner_interest_key" TEXT NOT NULL,
  "concept_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learner_interest_concepts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "material_concepts" (
  "id" TEXT NOT NULL,
  "material_id" TEXT NOT NULL,
  "concept_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "material_concepts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "learning_project_concepts" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "concept_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_project_concepts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_component_concepts" (
  "id" TEXT NOT NULL,
  "component_id" TEXT NOT NULL,
  "concept_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_component_concepts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "taxonomy_concepts_canonical_key_key"
  ON "taxonomy_concepts"("canonical_key");
CREATE INDEX "taxonomy_concepts_concept_type_status_idx"
  ON "taxonomy_concepts"("concept_type", "status");
CREATE INDEX "taxonomy_concepts_parent_id_idx"
  ON "taxonomy_concepts"("parent_id");

CREATE UNIQUE INDEX "taxonomy_aliases_concept_id_language_normalized_alias_key"
  ON "taxonomy_aliases"("concept_id", "language", "normalized_alias");
CREATE INDEX "taxonomy_aliases_normalized_alias_language_is_active_idx"
  ON "taxonomy_aliases"("normalized_alias", "language", "is_active");
CREATE INDEX "taxonomy_aliases_concept_id_is_active_idx"
  ON "taxonomy_aliases"("concept_id", "is_active");

CREATE UNIQUE INDEX "learner_interest_concepts_learner_interest_key_key"
  ON "learner_interest_concepts"("learner_interest_key");
CREATE INDEX "learner_interest_concepts_concept_id_idx"
  ON "learner_interest_concepts"("concept_id");

CREATE UNIQUE INDEX "material_concepts_material_id_concept_id_key"
  ON "material_concepts"("material_id", "concept_id");
CREATE INDEX "material_concepts_material_id_idx"
  ON "material_concepts"("material_id");
CREATE INDEX "material_concepts_concept_id_idx"
  ON "material_concepts"("concept_id");

CREATE UNIQUE INDEX "learning_project_concepts_project_id_concept_id_key"
  ON "learning_project_concepts"("project_id", "concept_id");
CREATE INDEX "learning_project_concepts_project_id_idx"
  ON "learning_project_concepts"("project_id");
CREATE INDEX "learning_project_concepts_concept_id_idx"
  ON "learning_project_concepts"("concept_id");

CREATE UNIQUE INDEX "project_component_concepts_component_id_concept_id_key"
  ON "project_component_concepts"("component_id", "concept_id");
CREATE INDEX "project_component_concepts_component_id_idx"
  ON "project_component_concepts"("component_id");
CREATE INDEX "project_component_concepts_concept_id_idx"
  ON "project_component_concepts"("concept_id");

ALTER TABLE "taxonomy_concepts"
  ADD CONSTRAINT "taxonomy_concepts_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "taxonomy_concepts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "taxonomy_aliases"
  ADD CONSTRAINT "taxonomy_aliases_concept_id_fkey"
  FOREIGN KEY ("concept_id") REFERENCES "taxonomy_concepts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learner_interest_concepts"
  ADD CONSTRAINT "learner_interest_concepts_concept_id_fkey"
  FOREIGN KEY ("concept_id") REFERENCES "taxonomy_concepts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "material_concepts"
  ADD CONSTRAINT "material_concepts_material_id_fkey"
  FOREIGN KEY ("material_id") REFERENCES "materials"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "material_concepts"
  ADD CONSTRAINT "material_concepts_concept_id_fkey"
  FOREIGN KEY ("concept_id") REFERENCES "taxonomy_concepts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_project_concepts"
  ADD CONSTRAINT "learning_project_concepts_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_project_concepts"
  ADD CONSTRAINT "learning_project_concepts_concept_id_fkey"
  FOREIGN KEY ("concept_id") REFERENCES "taxonomy_concepts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_component_concepts"
  ADD CONSTRAINT "project_component_concepts_component_id_fkey"
  FOREIGN KEY ("component_id") REFERENCES "project_required_components"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_component_concepts"
  ADD CONSTRAINT "project_component_concepts_concept_id_fkey"
  FOREIGN KEY ("concept_id") REFERENCES "taxonomy_concepts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
